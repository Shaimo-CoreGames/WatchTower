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

redis_client = Redis(host="127.0.0.1", port=6379, db=0, decode_responses=True)


def process_incident_rules(db, monitor_id: int, status_code: int, error_msg: str):
    """
    Evaluates ping outcomes inside the synchronous worker block to automatically 
    open active incidents or close recovered tracking profiles.
    """
    is_check_successful = (status_code == 200)

    # Look for an active, unresolved incident for this target monitor
    active_incident = db.query(Incident).filter(
        Incident.monitor_id == monitor_id, 
        Incident.is_resolved == False
    ).first()

    if not is_check_successful:
        # 🚨 Target is down, open a fresh incident if one isn't open yet
        if not active_incident:
            new_incident = Incident(
                monitor_id=monitor_id,
                error_details=error_msg if error_msg else f"HTTP Error Status {status_code}",
                started_at=datetime.utcnow(),
                is_resolved=False
            )
            db.add(new_incident)
            print(f"🚨 [Incident Engine] Created new active incident for monitor #{monitor_id}")
            
    else:
        # ✅ Target is up and healthy, close any lingering active incidents
        if active_incident:
            active_incident.is_resolved = True
            active_incident.resolved_at = datetime.utcnow()
            print(f"🎉 [Incident Engine] Monitor #{monitor_id} recovered! Incident resolved.")


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