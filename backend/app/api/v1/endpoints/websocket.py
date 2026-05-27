import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import redis.asyncio.client as aioredis  # 💡 Use async redis driver for FastAPI

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
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

async def redis_listener():
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
                await manager.broadcast(raw_payload)
            await asyncio.sleep(0.01)  # Yield execution control safely
    except Exception as e:
        print(f"❌ Redis Pub/Sub Router Connection Lost: {e}")
    finally:
        await pubsub.unsubscribe("monitor_updates")
        await redis.close()

# ⚡ Ensure the endpoint string matches exactly what your frontend calls
@router.websocket("/ws/analytics")
async def websocket_analytics_endpoint(websocket: WebSocket):
    # 🤝 Accept the initial browser handshake
    await websocket.accept()
    try:
        while True:
            # Keep the channel open listening for client-side dropouts
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        print("Client disconnected from WatchTower socket cluster.")