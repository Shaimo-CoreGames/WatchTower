import time
import httpx
import asyncio
from app.core.celery_app import celery_app
from app.core.database import AsyncSessionLocal
from app.models.health_check import HealthCheck

async def save_health_check_to_db(new_check: HealthCheck):
    """
    Asynchronous runner that properly awaits the database transaction 
    lifecycle using your AsyncSessionLocal factory.
    """
    async with AsyncSessionLocal() as db:
        try:
            db.add(new_check)
            await db.commit()  # 💡 Crucial: Await the transaction commit!
        except Exception as db_err:
            await db.rollback()  # 💡 Crucial: Await the rollback if something breaks!
            print(f"❌ Failed to commit monitoring log to DB: {db_err}")
            raise db_err
        # The session automatically closes here via the 'async with' context manager

@celery_app.task(name="tasks.execute_endpoint_ping")
def execute_endpoint_ping(monitor_id: int, target_url: str):
    """Executes a global networking trace, measures latency, and persists data."""
    start_time = time.time()
    status_code = None
    error_msg = None
    
    try:
        # Execute the HTTP request safely inside the worker process
        with httpx.Client(timeout=10.0, follow_redirects=True) as client:
            response = client.get(target_url)
            status_code = response.status_code
    except Exception as e:
        error_msg = str(e)
        status_code = 500  # Internal fallback server failure code
        
    latency_ms = int((time.time() - start_time) * 1000)
    
    # Construct the ORM model instance
    new_check = HealthCheck(
        monitor_id=monitor_id,
        status_code=status_code,
        latency_ms=latency_ms,
        error_message=error_msg
    )
    
    # Use asyncio.run to safely execute the async database write inside this synchronous worker thread
    try:
        asyncio.run(save_health_check_to_db(new_check))
        print(f"✅ Celery Worker Processed Task: {target_url} -> {status_code} ({latency_ms}ms)")
    except Exception:
        pass