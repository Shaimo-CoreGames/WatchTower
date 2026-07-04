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

# 🎯 Shared persistent HTTPX client pool with full browser attributes
http_client_pool = httpx.Client(
    verify=False,
    timeout=httpx.Timeout(12.0, connect=5.0, read=5.0),
    limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
    headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br", # 🛡️ CRITICAL: Signals the client handles compression natively
        "Connection": "keep-alive",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    },
    follow_redirects=True
)

def process_incident_rules(db, monitor_id: int, status_code: int, error_msg: str):
    """
    Evaluates synchronous validation metrics to control active downtime records
    and generate outward notification triggers.
    """
    is_check_successful = (status_code == 200)

    monitor = db.query(Monitor).filter(Monitor.id == monitor_id).first()
    if not monitor:
        return

    active_incident = db.query(Incident).filter(
        Incident.monitor_id == monitor_id, 
        Incident.is_resolved == False
    ).first()

    if not is_check_successful:
        if not active_incident:
            new_incident = Incident(
                monitor_id=monitor_id,
                error_details=error_msg if error_msg else f"HTTP Error Status {status_code}",
                started_at=datetime.now(timezone.utc),
                is_resolved=False
            )
            db.add(new_incident)
            db.flush() # Populate ID parameters before committing safely
            print(f"🚨 [Incident Engine] Created new active incident for monitor #{monitor_id}")
            
            dispatch_external_alert(
                monitor_name=monitor.name, 
                monitor_url=monitor.url, 
                error_details=new_incident.error_details, 
                status="DOWN"
            )
    else:
        if active_incident:
            active_incident.is_resolved = True
            active_incident.resolved_at = datetime.now(timezone.utc)
            print(f"🎉 [Incident Engine] Monitor #{monitor_id} recovered! Incident resolved.")
            
            dispatch_external_alert(
                monitor_name=monitor.name, 
                monitor_url=monitor.url, 
                error_details="Service returned completely nominal status codes.", 
                status="RECOVERED"
            )


@celery_app.task(name="tasks.trigger_all_active_monitors")
def trigger_all_active_monitors():
    """
    Queries targets synchronously and distributes execution blocks across the cluster queues
    based on custom intervals.
    """
    db = SyncSessionLocal()
    try:
        active_monitors = db.query(Monitor).filter(Monitor.is_active == True).all()
        current_timestamp = int(datetime.now(timezone.utc).timestamp())
        tasks_dispatched = 0

        for monitor in active_monitors:
            # Fallback to 60 seconds default mapping if interval field is undefined
            interval = monitor.check_interval if monitor.check_interval else 60
            
            # Match the execution slot timeframe securely
            if current_timestamp % interval < 10: 
                celery_app.send_task("tasks.execute_endpoint_ping", args=[monitor.id, monitor.url])
                tasks_dispatched += 1
                
        if tasks_dispatched > 0:
            print(f"📡 [Celery Beat] Broadcasted ping tasks for {tasks_dispatched} monitors.")
            
    except Exception as e:
        print(f"❌ Beat orchestrator encountered an infrastructure error: {e}")
    finally:
        db.close()

def process_incident_rules(db, monitor_id: int, status_code: int, error_msg: str, threshold: int = 3):
    """
    Evaluates recent historical health logs to determine if an incident should trigger.
    Requires 'threshold' consecutive failures before sounding the alarm.
    """
    is_current_check_healthy = (status_code == 200 and error_msg is None)

    monitor = db.query(Monitor).filter(Monitor.id == monitor_id).first()
    if not monitor:
        return

    # 1. FETCH RECENT HISTORY (Get the last 'threshold' checks ordered by most recent)
    # Includes the newly inserted check flushed right before calling this function
    recent_checks = (
        db.query(HealthCheck)
        .filter(HealthCheck.monitor_id == monitor_id)
        .order_by(HealthCheck.id.desc())
        .limit(threshold)
        .all()
    )

    # 2. CHECK FOR AN ACTIVE INCIDENT
    active_incident = db.query(Incident).filter(
        Incident.monitor_id == monitor_id, 
        Incident.is_resolved == False
    ).first()

    # 3. EVALUATE DOWN TRIGGER RULE
    if not is_current_check_healthy:
        # Check how many of our recent checks failed
        consecutive_failures = [c for c in recent_checks if c.status_code != 200 or c.error_message is not None]
        
        # Only raise an incident if we hit or exceed the continuous limit threshold
        if len(consecutive_failures) >= threshold:
            if not active_incident:
                # 🚨 TRIGGER NEW INCIDENT: Sound the alarms!
                new_incident = Incident(
                    monitor_id=monitor_id,
                    error_details=error_msg if error_msg else f"HTTP Error Status {status_code}",
                    started_at=datetime.now(timezone.utc),
                    is_resolved=False
                )
                db.add(new_incident)
                db.flush() # Populate ID parameters safely
                print(f"🚨 [Alert Engine] Target #{monitor_id} breached threshold ({threshold} continuous failures). Incident Opened!")
                
                # Corrected call to use your actual dispatch engine function
                dispatch_external_alert(
                    monitor_name=monitor.name, 
                    monitor_url=monitor.url, 
                    error_details=new_incident.error_details, 
                    status="DOWN"
                )
        else:
            print(f"⚠️ [Alert Engine] Target #{monitor_id} missed a ping, but failure count ({len(consecutive_failures)}/{threshold}) is below threshold. Suppressing alert.")

    # 4. EVALUATE RECOVERY TRIGGER RULE
    else:
        # The current check is completely healthy! If an incident was active, close it out.
        if active_incident:
            active_incident.is_resolved = True
            active_incident.resolved_at = datetime.now(timezone.utc)
            print(f"🎉 [Alert Engine] Target #{monitor_id} returned to operational baseline. Incident Closed!")
            
            # Corrected call to use your actual dispatch engine function
            dispatch_external_alert(
                monitor_name=monitor.name, 
                monitor_url=monitor.url, 
                error_details="Service returned completely nominal status codes.", 
                status="RECOVERED"
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

        # Reuse the existing client layout definitions safely
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
        print(f"Payload: {json.dumps(broadcast_payload)}")
        print(f"==================================================")

        redis_client.publish("monitor_updates", json.dumps(broadcast_payload))
    except Exception as e:
        print(f"❌ Failed to publish live payload packet to Redis pipeline: {e}")