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
    const ws = new WebSocket("ws://localhost:8000/api/v1/ws/analytics");

    ws.onmessage = (event) => {
      const incomingMetric: HealthCheckData = JSON.parse(event.data);
      
      // ⚡ 1. Update the individual monitor's sparkline array cache instantly
      queryClient.setQueryData(
        ["analytics", incomingMetric.monitor_id],
        (oldData: HealthCheckData[] | undefined) => {
          const currentCache = oldData ? [...oldData] : [];
          currentCache.push(incomingMetric);
          if (currentCache.length > 42) currentCache.shift();
          return currentCache;
        }
      );

      // ⚡ 2. NEW: Instantly trigger an automatic background update for your global top stats card!
      queryClient.invalidateQueries({ queryKey: ["globalStats"] });
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
    // 💡 Accepting a simple number ID directly to fix the 'undefined' issue
    mutationFn: async (monitorId: number) => {
      // 1. Grab current cached monitors list to find this specific monitor's current state
      const currentMonitors = queryClient.getQueryData<any[]>(["monitors"]) || [];
      const targetMonitor = currentMonitors.find(m => (m.id ?? m._id) === monitorId);
      
      // 2. Flip the state (if it's true, send false; if missing, default to true)
      const nextActiveState = targetMonitor ? !targetMonitor.is_active : true;

      // 💡 Match the precise route shape your backend uses!
      // If your backend route is actually /api/v1/monitors/{id}, keep it like this:
      const response = await api.patch(`/monitors/${monitorId}`, {
        is_active: nextActiveState,
      });

      // NOTE: If your backend endpoint route is *actually* named `/monitors/{id}/toggle`, 
      // uncomment the line below and delete the one above:
      // const response = await api.patch(`/monitors/${monitorId}/toggle`);

      return response.data;
    },
    onSuccess: () => {
      // Instantly trigger dashboard graph cache refreshes
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
      queryClient.invalidateQueries({ queryKey: ["systemSettings"] });
    },
  });
}

export interface GlobalStats {
  global_uptime: number;
  avg_latency: number;
  active_channels: string;
}

export function useGlobalStats() {
  return useQuery<GlobalStats>({
    queryKey: ["globalStats"],
    queryFn: async () => {
      const response = await api.get("/analytics/global-stats");
      return response.data;
    },
    // Refresh these high-level dashboard metrics every 10 seconds automatically
    refetchInterval: 10000, 
  });
}

export interface IncidentData {
  id: number;
  monitor_id: number;
  monitor_name: string;
  monitor_url: string;
  error_details: string;
  started_at: string;
  resolved_at: string | null;
  is_resolved: boolean;
}

export function useIncidents() {
  return useQuery<IncidentData[]>({
    queryKey: ["incidents"],
    queryFn: async () => {
      const response = await api.get("/incidents/");
      return response.data;
    },
    // Poll for structural incident updates every 5 seconds to keep dashboard accurate
    refetchInterval: 5000,
  });
}


export interface IntegrationData {
  id: number;
  name: string;
  channel_type: string;
  webhook_url: string;
  is_active: boolean;
}

export function useIntegrations() {
  const queryClient = useQueryClient();

  const { data: integrations = [], isLoading } = useQuery<IntegrationData[]>({
    queryKey: ["integrations"],
    queryFn: async () => {
      const response = await api.get("/integrations/");
      return response.data;
    }
  });

  const createMutation = useMutation({
    mutationFn: async (newHook: { name: string; channel_type: string; webhook_url: string }) => {
      return await api.post("/integrations/", newHook);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integrations"] })
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: number) => {
      return await api.patch(`/integrations/${id}/toggle`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integrations"] })
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await api.delete(`/integrations/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integrations"] })
  });

  return { integrations, isLoading, createMutation, toggleMutation, deleteMutation };
}

export interface SystemSettingsData {
  operator: { name: string; role: string; joined: string };
  database_stats: {
    engine: string;
    status: string;
    total_monitors_provisioned: number;
    total_telemetry_rows: number;
    total_incidents_logged: number;
  };
  retention_policy_days: number;
}

export function useSystemSettings() {
  const queryClient = useQueryClient();
  
  const query = useQuery<SystemSettingsData>({
    queryKey: ["systemSettings"],
    queryFn: async () => {
      const response = await api.get("/settings/system-stats");
      return response.data;
    }
  });

  const purgeMutation = useMutation({
    mutationFn: async () => {
      return await api.post("/settings/purge-metrics");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["systemSettings"] })
  });

  return { ...query, purgeMutation };
}