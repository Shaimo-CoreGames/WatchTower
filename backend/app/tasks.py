import time
import httpx
import json
from redis import Redis
from datetime import datetime, timezone
from celery import Celery
from celery.schedules import crontab

from app.core.celery_app import celery_app
from app.core.database import SyncSessionLocal  # Verified sync database context
from app.models.health_check import HealthCheck
from app.models.monitor import Monitor
from app.models.incident import Incident
from app.models.integration import Integration
from urllib.parse import urlparse

# 🎯 Permanent unified Redis connection context
redis_client = Redis(host="127.0.0.1", port=6379, db=0, decode_responses=True)

# 🎯 Shared persistent HTTPX client pool updated with modern 2026 browser properties
http_client_pool = httpx.Client(
    verify=False,
    timeout=httpx.Timeout(12.0, connect=5.0, read=5.0),
    limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
    headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        # 🛡️ Modernized Anti-bot bypass properties for Vercel Edge Protection (Chrome 148 baseline)
        "Sec-Ch-Ua": '"An Introduction to Client Hints";v="148", "Chromium";v="148", "Google Chrome";v="148"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "cross-site",  # Changed from 'none' to better simulate clicking a dashboard link
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1"
    },
    follow_redirects=True
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


def broadcast_monitor_update(check_id: int, monitor_id: int, status_code: int, latency_ms: int, error_msg: str | None):
    """Publishes structural telemetry packets out to Redis channels."""
    try:
        broadcast_payload = {
            "id": check_id,
            "monitor_id": monitor_id,
            "status_code": status_code,
            "latency_ms": latency_ms,
            "response_time": latency_ms,  
            "error_message": error_msg,
            "is_active": (status_code == 200),  
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        print(f"==================================================")
        print(f"📤 [CELERY BROADCAST] Publishing to Redis channel 'monitor_updates' for Monitor #{monitor_id}")
        print(f"==================================================")

        redis_client.publish("monitor_updates", json.dumps(broadcast_payload))
    except Exception as e:
        print(f"❌ Failed to publish live payload packet to Redis pipeline: {e}")


def process_incident_rules(db, monitor_id: int, status_code: int, error_msg: str, threshold: int = 3):
    """
    Evaluates recent historical health logs to determine if an incident should trigger.
    Requires 'threshold' consecutive failures before sounding the alarm.
    """
    is_current_check_healthy = (status_code == 200 and error_msg is None)

    monitor = db.query(Monitor).filter(Monitor.id == monitor_id).first()
    if not monitor:
        return

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
        # Track true consecutive failures moving backward
        consecutive_failures_count = 0
        for check in recent_checks:
            if check.status_code != 200 or check.error_message is not None:
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
                error_details="Service returned completely nominal status codes.", 
                status="RECOVERED"
            )


# 🛠️ THE MISSING LINK: The actual worker execution task definition
@celery_app.task(name="tasks.execute_endpoint_ping")
def execute_endpoint_ping(monitor_id: int, target_url: str):
    """Executes the HTTP network probe, persists the metrics, and updates middleware."""
    db = SyncSessionLocal()
    start_time = time.perf_counter()
    
    status_code = 0
    latency_ms = 0
    error_message = None

    try:
        # Perform the actual HTTP validation probe
        # Perform a HEAD request to minimize data transfer and bypass basic bot filters
        response = http_client_pool.request("HEAD", target_url)
        latency_ms = int((time.perf_counter() - start_time) * 1000)
        status_code = response.status_code
        
        if status_code != 200:
            error_message = f"Bad Status Code: {status_code}"

    except httpx.RequestError as exc:
        latency_ms = int((time.perf_counter() - start_time) * 1000)
        status_code = 0
        error_message = f"Network Connection Failure: {str(exc)}"
    except Exception as general_exc:
        latency_ms = int((time.perf_counter() - start_time) * 1000)
        status_code = 0
        error_message = f"Internal Worker Exception: {str(general_exc)}"

    try:
                # 1. Log metrics to your SQL backend database using 'timestamp' instead of 'checked_at'
        health_check_log = HealthCheck(
            monitor_id=monitor_id,
            status_code=status_code,
            latency_ms=latency_ms,
            error_message=error_message,
            timestamp=datetime.now(timezone.utc)  # 👈 CHANGED THIS FROM checked_at TO timestamp
        )
        db.add(health_check_log)
        db.flush() # 👈 Use flush here to generate the health_check_log.id without committing yet

        # 2. Evaluate alert thresholds and incident changes
        process_incident_rules(db, monitor_id, status_code, error_message)

        # 3. Commit EVERYTHING (The health check log + any incident updates/creations)
        db.commit() # 👈 MOVE COMMIT HERE TO SAVE ALL CHANGES AT ONCE
        db.refresh(health_check_log)

        # 4. Stream real-time metrics back out to your WebSocket channels
        broadcast_monitor_update(health_check_log.id, monitor_id, status_code, latency_ms, error_message)

    except Exception as write_err:
        print(f"❌ Core engine state database tracking layer broken down: {write_err}")
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