import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "./useApi";

export interface MonitorData {
  id: number;
  name: string;
  url: string;
  check_interval: number;
  is_active: boolean;
  user_id: number;
  created_at: string;
}

export interface HealthCheckData {
  id: number;
  monitor_id: number;
  status_code: number | null;
  latency_ms: number;
  error_message: string | null;
  timestamp: string;
}

export function useMonitors() {
  return useQuery<MonitorData[]>({
    queryKey: ["monitors"],
    queryFn: async () => {
      const response = await api.get("/monitors/");
      return response.data;
    },
    // 💡 Polling is disabled! The system relies entirely on real-time event updates.
    refetchInterval: false, 
  });
}

export function useMonitorAnalytics(monitorId: number | null) {
  return useQuery<HealthCheckData[]>({
    queryKey: ["analytics", monitorId],
    queryFn: async () => {
      if (!monitorId) return [];
      const response = await api.get(`/analytics/monitor/${monitorId}?limit=42`);
      return response.data;
    },
    enabled: !!monitorId,
    // 💡 Polling is disabled!
    refetchInterval: false,
  });
}

export function useCreateMonitor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newMonitor: { name: string; url: string; check_interval: number }) => {
      const response = await api.post("/monitors/", {
        ...newMonitor,
        is_active: true,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
    },
  });
}

// 💡 NEW: The real-time WebSocket connection loop manager
export function useRealTimeAnalytics() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Connect to your FastAPI high-speed socket gateway
    const ws = new WebSocket("ws://127.0.0.1:8000/ws/analytics");

    ws.onmessage = (event) => {
      const incomingMetric: HealthCheckData = JSON.parse(event.data);
      
      // ⚡ TanStack Query Cache Mutation Logic
      queryClient.setQueryData(
        ["analytics", incomingMetric.monitor_id],
        (oldData: HealthCheckData[] | undefined) => {
          const currentCache = oldData ? [...oldData] : [];
          
          // Append the fresh metric to the end of your time-series history tracking array
          currentCache.push(incomingMetric);
          
          // Enforce your strict 42-pillar grid capacity limitation constraint dynamically
          if (currentCache.length > 42) {
            currentCache.shift();
          }
          
          return currentCache;
        }
      );
    };

    ws.onerror = (error) => console.error("📡 WatchTower Socket Error:", error);
    ws.onclose = () => console.warn("📡 WatchTower Socket connection closed. Retrying...");

    return () => {
      ws.close();
    };
  }, [queryClient]);
}

export function useDeleteMonitor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (monitorId: number) => {
      // Calls your DELETE /{monitor_id} endpoint natively
      await api.delete(`/monitors/${monitorId}`);
    },
    onSuccess: () => {
      // Instantly refresh the UI monitor list cache
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
    },
  });
}

export function useToggleMonitorStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ monitorId, isActive }: { monitorId: number; isActive: boolean }) => {
      // Calls your PATCH /{monitor_id} endpoint to toggle tracking states
      const response = await api.patch(`/monitors/${monitorId}`, {
        is_active: isActive,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      // Refresh the monitor configurations cache structure immediately
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
      // Clear out old time-series graphs cache lines if we are pausing tracking
      if (!variables.isActive) {
        queryClient.invalidateQueries({ queryKey: ["analytics", variables.monitorId] });
      }
    },
  });
}