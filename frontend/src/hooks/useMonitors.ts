import { useQuery,useMutation, useQueryClient } from "@tanstack/react-query";
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
  // 1. Fetch all monitor configurations belonging to user
  return useQuery<MonitorData[]>({
    queryKey: ["monitors"],
    queryFn: async () => {
      const response = await api.get("/monitors/");
      return response.data;
    },
    // Background polling frequency: Fetch new data updates every 10 seconds automatically
    refetchInterval: 10000, 
  });
}

export function useMonitorAnalytics(monitorId: number | null) {
  // 2. Fetch the latest 42 time-series health checks logs for sparkline graphs mapping
  return useQuery<HealthCheckData[]>({
    queryKey: ["analytics", monitorId],
    queryFn: async () => {
      if (!monitorId) return [];
      const response = await api.get(`/analytics/monitor/${monitorId}?limit=42`);
      return response.data;
    },
    enabled: !!monitorId,
    refetchInterval: 10000,
  });
}

export function useCreateMonitor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newMonitor: { name: string; url: string; check_interval: number }) => {
      const response = await api.post("/monitors/", {
        ...newMonitor,
        is_active: true, // Default to operational on creation
      });
      return response.data;
    },
    onSuccess: () => {
      // Force TanStack Query to re-fetch the monitor list immediately in the background
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
    },
  });
}