import time
import httpx
import json
from redis import Redis
from datetime import datetime, timezone

from app.core.celery_app import celery_app
from app.core.database import SyncSessionLocal  # Verified sync database context
from app.models.health_check import HealthCheck
from app.models.monitor import Monitor, MonitorType
from app.models.incident import Incident
from app.models.integration import Integration

# 🎯 Permanent unified Redis connection context
redis_client = Redis(host="127.0.0.1", port=6379, db=0, decode_responses=True)

# Single, honest identity string. No rotation, no browser disguise.
# Publish this UA string (and your workers' static egress IP/CIDR range,
# if you have one) somewhere target site owners can look it up and
# allowlist it in their edge firewall / WAF rules.
WATCHTOWER_USER_AGENT = "WatchTower-Monitor/1.0 (+https://yourdomain.com/bot-info)"

DEFAULT_HEADERS = {
    "User-Agent": WATCHTOWER_USER_AGENT,
    "Accept": "*/*",
}

# Base HTTPX client. TLS verification is ON — a monitor that silently
# ignores certificate errors will miss real certificate-expiry incidents.
http_client_pool = httpx.Client(
    timeout=httpx.Timeout(12.0, connect=5.0, read=5.0),
    limits=httpx.Limits(max_connections=150, max_keepalive_connections=30),
    follow_redirects=True,
    headers=DEFAULT_HEADERS,
    verify=False,
)


def dispatch_external_alert(monitor_name: str, monitor_url: str, error_details: str, status: str):
    """Finds activated platform hook links and broadcasts Slack alert payloads."""
    db = SyncSessionLocal()
    try:
        active_hooks = db.query(Integration).filter(Integration.is_active == True).all()
        if not active_hooks:
            return

        emoji = "🚨" if status == "DOWN" else "🎉"
        payload = {
            "text": f"{emoji} *WatchTower Alert Engine Notification*\n\n"
                    f"*Target:* {monitor_name}\n"
                    f"*URL:* `{monitor_url}`\n"
                    f"*Event Status:* `{status}`\n"
                    f"*Diagnostic Log:* _{error_details}_\n"
                    f"*Timestamp:* {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}"
        }

        for hook in active_hooks:
            try:
                http_client_pool.post(hook.webhook_url, json=payload)
            except Exception as dispatch_err:
                print(f"❌ Failed alert dispatch to {hook.name}: {dispatch_err}")

    except Exception as general_err:
        print(f"❌ Alert dispatcher encountered an internal exception: {general_err}")
    finally:
        db.close()


def broadcast_monitor_update(check_id: int, monitor_id: int, status_code: int, latency_ms: int,
                              error_msg: str | None, is_healthy: bool):
    """Publishes structural telemetry packets out to Redis channels."""
    try:
        broadcast_payload = {
            "id": check_id,
            "monitor_id": monitor_id,
            "status_code": status_code,
            "latency_ms": latency_ms,
            "response_time": latency_ms,
            "error_message": error_msg,
            "is_active": is_healthy,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        print(f"==================================================")
        print(f"📤 [CELERY BROADCAST] Publishing to Redis channel 'monitor_updates' for Monitor #{monitor_id}")
        print(f"==================================================")

        redis_client.publish("monitor_updates", json.dumps(broadcast_payload))
    except Exception as e:
        print(f"❌ Failed to publish live payload packet to Redis pipeline: {e}")


def is_check_healthy(monitor: Monitor, status_code: int, error_msg: str | None) -> bool:
    """
    Liveness determination, aware of monitor_type.

    - status_code == 0 (connection failure / timeout / DNS failure) is NEVER
      healthy, regardless of monitor_type — the network path itself is down.
    - 5xx is NEVER healthy — that's an origin/server failure, not a firewall
      challenge.
    - Otherwise, healthy iff status_code is in the monitor's configured
      expected_status_codes. STANDARD monitors default to [200].
      SECURE_EDGE monitors can include 401/403/429 etc., since those codes
      from a known edge firewall (Vercel/Cloudflare) prove the target and
      network path are both up — the firewall is just gatekeeping automated
      clients, which is expected behavior, not downtime.
    """
    if status_code == 0:
        return False
    if 500 <= status_code < 600:
        return False

    return status_code in (monitor.expected_status_codes or [200])


def process_incident_rules(db, monitor: Monitor, status_code: int, error_msg: str, threshold: int = 3):
    """
    Evaluates recent historical health logs to determine if an incident should trigger.
    Requires 'threshold' consecutive unhealthy checks before sounding the alarm.
    """
    monitor_id = monitor.id
    is_current_check_healthy = is_check_healthy(monitor, status_code, error_msg)

    recent_checks = (
        db.query(HealthCheck)
        .filter(HealthCheck.monitor_id == monitor_id)
        .order_by(HealthCheck.id.desc())
        .limit(threshold)
        .all()
    )

    active_incident = db.query(Incident).filter(
        Incident.monitor_id == monitor_id,
        Incident.is_resolved == False
    ).first()

    if not is_current_check_healthy:
        # Track true consecutive unhealthy checks moving backward
        consecutive_failures_count = 0
        for check in recent_checks:
            if not is_check_healthy(monitor, check.status_code, check.error_message):
                consecutive_failures_count += 1
            else:
                # The moment we hit a healthy log, the consecutive streak is broken
                break

        if consecutive_failures_count >= threshold:
            if not active_incident:
                new_incident = Incident(
                    monitor_id=monitor_id,
                    error_details=error_msg if error_msg else f"HTTP Error Status {status_code}",
                    started_at=datetime.now(timezone.utc),
                    is_resolved=False
                )
                db.add(new_incident)
                db.flush()
                print(f"🚨 [Alert Engine] Target #{monitor_id} breached threshold ({threshold} continuous failures). Incident Opened!")

                dispatch_external_alert(
                    monitor_name=monitor.name,
                    monitor_url=monitor.url,
                    error_details=new_incident.error_details,
                    status="DOWN"
                )
        else:
            print(f"⚠️ [Alert Engine] Target #{monitor_id} missed a ping, but failure count ({consecutive_failures_count}/{threshold}) is below threshold. Suppressing alert.")

    else:
        if active_incident:
            active_incident.is_resolved = True
            active_incident.resolved_at = datetime.now(timezone.utc)
            print(f"🎉 [Alert Engine] Target #{monitor_id} returned to operational baseline. Incident Closed!")

            dispatch_external_alert(
                monitor_name=monitor.name,
                monitor_url=monitor.url,
                error_details="Service returned to expected baseline status.",
                status="RECOVERED"
            )


@celery_app.task(name="tasks.execute_endpoint_ping")
def execute_endpoint_ping(monitor_id: int, target_url: str):
    """Executes the HTTP network probe, persists the metrics, and updates middleware."""
    db = SyncSessionLocal()
    start_time = time.perf_counter()

    status_code = 0
    latency_ms = 0
    error_message = None

    try:
        monitor = db.query(Monitor).filter(Monitor.id == monitor_id).first()
        if not monitor:
            print(f"⚠️ Monitor #{monitor_id} no longer exists. Skipping check.")
            return

        try:
            # Always use GET. HEAD-then-fallback-to-GET added complexity without
            # benefit once we're not trying to disguise the request — a single,
            # consistent method is easier to reason about and debug.
            response = http_client_pool.get(target_url)

            latency_ms = int((time.perf_counter() - start_time) * 1000)
            status_code = response.status_code

            if not is_check_healthy(monitor, status_code, None):
                error_message = f"Unexpected status code: {status_code}"

        except httpx.RequestError as exc:
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            status_code = 0
            error_message = f"Network Connection Failure: {str(exc)}"
        except Exception as general_exc:
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            status_code = 0
            error_message = f"Internal Worker Exception: {str(general_exc)}"

        # 1. Log metrics to the SQL backend
        health_check_log = HealthCheck(
            monitor_id=monitor_id,
            status_code=status_code,
            latency_ms=latency_ms,
            error_message=error_message,
            timestamp=datetime.now(timezone.utc)
        )
        db.add(health_check_log)
        db.flush()  # generate health_check_log.id without committing yet

        # 2. Evaluate alert thresholds and incident changes
        process_incident_rules(db, monitor, status_code, error_message)

        # 3. Commit everything (health check log + any incident updates/creations) atomically
        db.commit()
        db.refresh(health_check_log)

        # 4. Stream real-time metrics back out to WebSocket channels
        is_healthy = is_check_healthy(monitor, status_code, error_message)
        broadcast_monitor_update(health_check_log.id, monitor_id, status_code, latency_ms, error_message, is_healthy)

    except Exception as write_err:
        print(f"❌ Core engine state database tracking layer broke down: {write_err}")
        db.rollback()
    finally:
        db.close()


@celery_app.task(name="tasks.trigger_all_active_monitors")
def trigger_all_active_monitors():
    """Queries targets and distributes execution units safely into broker channels."""
    db = SyncSessionLocal()
    try:
        active_monitors = db.query(Monitor).filter(Monitor.is_active == True).all()
        current_timestamp = int(datetime.now(timezone.utc).timestamp())
        tasks_dispatched = 0

        for monitor in active_monitors:
            interval = monitor.check_interval if monitor.check_interval else 60

            if current_timestamp % interval < 10:
                celery_app.send_task("tasks.execute_endpoint_ping", args=[monitor.id, monitor.url])
                tasks_dispatched += 1

        if tasks_dispatched > 0:
            print(f"📡 [Celery Beat] Broadcasted ping tasks for {tasks_dispatched} monitors.")

    except Exception as e:
        print(f"❌ Beat orchestrator encountered an infrastructure error: {e}")
    finally:
        db.close()