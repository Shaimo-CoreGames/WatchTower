from app.core.celery_app import celery_app
from celery.schedules import crontab

@celery_app.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    # Triggers our orchestration task runner every 30 seconds automatically
    sender.add_periodic_task(30.0, trigger_all_active_monitors.s(), name="cycle-every-30-seconds")

@celery_app.task(name="tasks.trigger_all_active_monitors")
def trigger_all_active_monitors():
    """Queries the main database and broadcasts ping commands for all active endpoints to the queue cluster."""
    from app.core.database import SessionLocal
    from app.models.monitor import Monitor
    
    db = SessionLocal()
    try:
        active_monitors = db.query(Monitor).filter(Monitor.is_active == True).all()
        for monitor in active_monitors:
            # .delay() immediately pushes the task command off into Redis so workers can consume it
            celery_app.send_task("tasks.execute_endpoint_ping", args=[monitor.id, monitor.url])
    finally:
        db.close()