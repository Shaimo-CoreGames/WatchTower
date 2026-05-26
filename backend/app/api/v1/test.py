from fastapi import APIRouter, Depends, BackgroundTasks
from app.core.celery_app import celery_app

router = APIRouter()

@router.post("/test-celery-ping")
async def test_celery_ping():
    """Manually push a single ping job into Redis to wake up the worker."""
    # Hardcode a quick test case pointing to your portfolio
    # .delay() sends it straight to the Redis broker instance instantly
    celery_app.send_task("tasks.execute_endpoint_ping", args=[13, "http://www.facebook.com"])
    return {"status": "Task dispatched to Redis! Check your worker terminal."}