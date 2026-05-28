import time  # 💡 Added time import
import httpx
import json
from redis import Redis
from datetime import datetime
from app.core.celery_app import celery_app
from app.core.database import SyncSessionLocal  # Using our clean sync factory
from app.models.health_check import HealthCheck
from app.models.monitor import Monitor
from app.models.incident import Incident  # 💡 Import your new Incident model
from app.models.integration import Integration

redis_client = Redis(host="127.0.0.1", port=6379, db=0, decode_responses=True)


def process_incident_rules(db, monitor_id: int, status_code: int, error_msg: str):
    """Evaluates ping outcomes to manage incidents and trigger outward alerts."""
    is_check_successful = (status_code == 200)

    # Fetch the parent monitor object to extract its Name and URL strings
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
                started_at=datetime.utcnow(),
                is_resolved=False
            )
            db.add(new_incident)
            print(f"🚨 [Incident Engine] Created new active incident for monitor #{monitor_id}")
            
            # 💡 TRIGGER OUTBOUND DISPATCH SLACK ALERT FOR OUTAGE
            dispatch_external_alert(
                monitor_name=monitor.name, 
                monitor_url=monitor.url, 
                error_details=new_incident.error_details, 
                status="DOWN"
            )
            
    else:
        if active_incident:
            active_incident.is_resolved = True
            active_incident.resolved_at = datetime.utcnow()
            print(f"🎉 [Incident Engine] Monitor #{monitor_id} recovered! Incident resolved.")
            
            # 💡 TRIGGER OUTBOUND DISPATCH SLACK ALERT FOR RECOVERY
            dispatch_external_alert(
                monitor_name=monitor.name, 
                monitor_url=monitor.url, 
                error_details="Service returned completely nominal.", 
                status="RECOVERED"
            )

@celery_app.task(name="tasks.trigger_all_active_monitors")
def trigger_all_active_monitors():
    """Queries active monitors synchronously and dispatches individual ping tasks."""
    db = SyncSessionLocal()
    try:
        active_monitors = db.query(Monitor).filter(Monitor.is_active == True).all()
        current_timestamp = int(datetime.utcnow().timestamp())
        tasks_dispatched = 0

        for monitor in active_monitors:
            interval = monitor.check_interval if monitor.check_interval else 60
            
            # Smart Modulo Check
            if current_timestamp % interval < 10: 
                celery_app.send_task("tasks.execute_endpoint_ping", args=[monitor.id, monitor.url])
                tasks_dispatched += 1
                
        if tasks_dispatched > 0:
            print(f"📡 [Celery Beat] Broadcasted ping tasks for {tasks_dispatched} monitors.")
            
    except Exception as e:
        print(f"❌ Beat failed to orchestrate monitors: {e}")
    finally:
        db.close()  # Instantly release connection to the pool


@celery_app.task(name="tasks.execute_endpoint_ping")
def execute_endpoint_ping(monitor_id: int, target_url: str):
    """Executes network pings and writes telemetry logs via blocking sync context."""
    start_time = time.time()
    status_code = None
    error_msg = None
    
    try:
        with httpx.Client(timeout=10.0, follow_redirects=True) as client:
            response = client.get(target_url)
            status_code = response.status_code
            if status_code != 200:
                error_msg = f"Returned bad status code: {status_code}"
    except Exception as e:
        error_msg = str(e)
        status_code = 500  
        
    latency_ms = int((time.time() - start_time) * 1000)
    
    new_check = HealthCheck(
        monitor_id=monitor_id,
        status_code=status_code,
        latency_ms=latency_ms,
        error_message=error_msg
    )
    
    db = SyncSessionLocal()
    try:
        # 1. Save Health Check Telemetry Row
        db.add(new_check)
        
        # 💡 2. PROCESS INCIDENT RULES (Before commit, leveraging same transaction)
        process_incident_rules(
            db=db, 
            monitor_id=monitor_id, 
            status_code=status_code, 
            error_msg=error_msg
        )
        
        db.commit()
        print(f"✅ Saved Metric: {target_url} -> {status_code} ({latency_ms}ms)")
        
        # 3. BROADCAST EVENT TO REDIS PUB/SUB
        broadcast_payload = {
            "id": new_check.id,
            "monitor_id": monitor_id,
            "status_code": status_code,
            "latency_ms": latency_ms,
            "error_message": error_msg,
            "timestamp": datetime.utcnow().isoformat()
        }
        redis_client.publish("monitor_updates", json.dumps(broadcast_payload))
        
    except Exception as db_err:
        db.rollback()
        print(f"❌ Database write failure: {db_err}")
    finally:
        db.close()

def dispatch_external_alert(monitor_name: str, monitor_url: str, error_details: str, status: str):
    """
    Scans integrations and dispatches Slack notifications with deep error logging.
    """
    db = SyncSessionLocal()
    try:
        # Fetch any active webhook regardless of user constraints for testing parity
        active_hooks = db.query(Integration).filter(Integration.is_active == True).all()
        
        print(f"📡 [DEBUG Alert Dispatch] Found {len(active_hooks)} active webhook targets in database.")
        
        if not active_hooks:
            return

        emoji = "🚨" if status == "DOWN" else "🎉"
        
        # Format payload strictly according to the Slack Incoming Webhook contract
        payload = {
            "text": f"{emoji} *WatchTower Alert Engine Notification*\n\n"
                    f"*Target:* {monitor_name}\n"
                    f"*URL:* `{monitor_url}`\n"
                    f"*Event Status:* `{status}`\n"
                    f"*Diagnostic Log:* _{error_details}_\n"
                    f"*Timestamp:* {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}"
        }

        with httpx.Client(timeout=5.0) as client:
            for hook in active_hooks:
                try:
                    print(f"🚀 [DEBUG Alert Dispatch] Attempting POST to: {hook.name} -> {hook.webhook_url[:30]}...")
                    response = client.post(hook.webhook_url, json=payload)
                    print(f"📦 [Alert Dispatch] Response Status from Slack: {response.status_code} - {response.text}")
                except Exception as dispatch_err:
                    print(f"❌ [DEBUG] Failed to execute HTTP POST to {hook.name}: {dispatch_err}")

    except Exception as general_err:
        print(f"❌ [CRITICAL] Alert dispatcher exploded internally: {general_err}")
    finally:
        db.close()