import time
import httpx
import json
from redis import Redis
from datetime import datetime
from app.core.celery_app import celery_app
from app.core.database import SyncSessionLocal  # 💡 Using our clean sync factory
from app.models.health_check import HealthCheck
from app.models.monitor import Monitor

redis_client = Redis(host="127.0.0.1", port=6379, db=0, decode_responses=True)

@celery_app.task(name="tasks.trigger_all_active_monitors")
def trigger_all_active_monitors():
    """Queries active monitors synchronously and dispatches individual ping tasks."""
    db = SyncSessionLocal()
    try:
        # Straightforward, blocking query that leaves no trailing async leaks
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
        db.add(new_check)
        db.commit()
        print(f"✅ Saved Metric: {target_url} -> {status_code} ({latency_ms}ms)")
        
        # 💡 BROADCAST EVENT TO REDIS PUB/SUB
        # We package the live metric data into a JSON string payload
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