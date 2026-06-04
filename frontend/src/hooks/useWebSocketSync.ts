import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface LiveTelemetryPacket {
  id: number;
  monitor_id: number;
  status_code: number;
  latency_ms: number;
  response_time: number;
  error_message: string | null;
  is_active: boolean;
  timestamp: string;
}

export function useWebSocketSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // 🔌 Connect straight out to our FastAPI async streaming network layer
    const ws = new WebSocket("ws://127.0.0.1:8000/ws/analytics");

    ws.onmessage = (event) => {
      try {
        const payload: LiveTelemetryPacket = JSON.parse(event.data);
        const monitorId = payload.monitor_id;

        // 🎯 MAGIC STEP: Directly push the packet into the Sparkline's React Query Cache array!
        queryClient.setQueryData(["monitor-sparkline", monitorId], (oldData: any) => {
          const currentArray = Array.isArray(oldData) ? oldData : [];
          const updatedArray = [...currentArray, {
            id: payload.id,
            status_code: payload.status_code,
            latency_ms: payload.latency_ms,
            timestamp: payload.timestamp
          }];
          
          // Maintain a sliding window history of the last 30 data points so memory doesn't leak
          return updatedArray.slice(-30);
        });

        // Optional: Force update individual parent list collections if necessary
        queryClient.invalidateQueries({ queryKey: ["monitors-list"] });

      } catch (err) {
        console.error("❌ Failed parsing real-time packet structure:", err);
      }
    };

    ws.onerror = (error) => console.error("🔌 WebSocket Error:", error);
    ws.onclose = () => console.log("🔌 WebSocket Connection closed. Retrying...");

    return () => ws.close();
  }, [queryClient]);
}