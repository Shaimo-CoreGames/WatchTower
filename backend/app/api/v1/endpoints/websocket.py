import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import redis.asyncio.client as aioredis  # Async driver for FastAPI

# 💡 Explicitly set the base prefix path for routing consistency
router = APIRouter(prefix="/ws", tags=["WebSockets"])

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        """Sends raw message to all actively connected frontend tabs."""
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                # Handle dead or broken client connections gracefully
                pass

manager = ConnectionManager()

# 🟢 FIX: Ensure this function accepts the ConnectionManager instance!
async def redis_listener(conn_manager: ConnectionManager):
    """Background listener loop that reads events from Redis and pipes them to the socket."""
    redis = aioredis.from_url("redis://127.0.0.1:6379/0", decode_responses=True)
    pubsub = redis.pubsub()
    await pubsub.subscribe("monitor_updates")
    
    try:
        while True:
            # Non-blocking listen for raw streamed events
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message and message.get("data"):
                raw_payload = message["data"]
                # ⚡ Broadcast through the shared connection manager instance
                await conn_manager.broadcast(raw_payload)
            await asyncio.sleep(0.01)  # Yield execution control safely
    except Exception as e:
        print(f"❌ Redis Pub/Sub Router Connection Lost: {e}")
    finally:
        await pubsub.unsubscribe("monitor_updates")
        await redis.close()


# ⚡ Matches the frontend endpoint structure seamlessly
@router.websocket("/analytics")
async def websocket_analytics_endpoint(websocket: WebSocket):
    # 💡 Let the global connection manager accept and track this browser tab instance
    await manager.connect(websocket)
    
    try:
        while True:
            # 💡 Keep the channel open, listening for client-side disconnects
            await websocket.receive_text()
    except WebSocketDisconnect:
        # 💡 Remove the connection cleanly when the user closes their tab
        manager.disconnect(websocket)
        print("Client disconnected from WatchTower socket cluster.")