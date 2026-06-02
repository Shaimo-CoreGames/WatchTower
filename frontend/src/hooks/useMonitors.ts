import { useEffect, useRef } from "react";
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

export function useRealTimeAnalytics() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const wsUrl = "ws://localhost:8000/api/v1/ws/analytics";
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("🚀 [WatchTower Socket] Core synchronization layer active!");
    };

    ws.onmessage = (event) => {
      try {
        // 🔍 LOG 1: Raw String Ingestion
        console.log("🔌 [WS RAW INBOUND] Received frame from backend cluster:", event.data);
        
        const incoming = JSON.parse(event.data);
        if (!incoming || !incoming.monitor_id) return;

        const monitorId = Number(incoming.monitor_id);
        const statusCode = incoming.status_code;
        const latency = incoming.latency_ms ?? incoming.response_time ?? 0;
        const isUp = statusCode === 200;

        // 🔍 LOG 2: Safe Cache Pre-Check (Fixed reference error)
        const currentCachedAnalytics = queryClient.getQueryData(["analytics", monitorId]);
        console.log(`📊 [CACHE PRE-CHECK] Current entries in cache for Monitor #${monitorId}:`, currentCachedAnalytics);

        const normalizedMetric: HealthCheckData = {
          id: incoming.id ?? Number(`${monitorId}${Date.now()}`),
          monitor_id: monitorId,
          status_code: statusCode,
          latency_ms: latency,
          error_message: incoming.error_message,
          timestamp: incoming.timestamp || new Date().toISOString(),
          is_active: incoming.is_active ?? isUp
        } as any;

        // 🔍 LOG 3: Mutation Verification Target
        console.log(`💾 [MUTATING CACHE] Appending node onto Monitor #${monitorId}:`, normalizedMetric);

        // Functional updates to avoid race conditions with incoming frames
        queryClient.setQueryData<HealthCheckData[]>(
  ["analytics", monitorId],
  (oldData) => {
    const currentCache = oldData ? [...oldData] : [];
    
    // Guard clause against processing identical frames
    if (currentCache.some((item) => item.id === normalizedMetric.id)) {
      return currentCache;
    }
    
    const updatedCache = [...currentCache, normalizedMetric];
    
    // 💡 INCREASE BOUNDARY: Set this slightly higher than your HTTP limit (e.g., 50) 
    // so you can physically see the list grow and confirm updates in real-time!
    if (updatedCache.length > 50) {
      updatedCache.shift();
    }
    
    return updatedCache;
  }
);
        
        // 🔍 LOG 4: Update Confirmation
        console.log(`✅ [CACHE SUCCESS] Cache key ["analytics", ${monitorId}] updated. Dispatching invalidation signals.`);

        // Soft invalidate metrics data structure keys safely
        queryClient.invalidateQueries({ 
          queryKey: ["monitors"], 
          refetchType: "none" 
        });

        queryClient.invalidateQueries({ queryKey: ["globalStats"] });
        queryClient.invalidateQueries({ queryKey: ["incidents"] });

      } catch (err) {
        console.error("❌ Error running real-time state engine update:", err);
      }
    };

    ws.onerror = (error) => console.error("📡 WatchTower Socket Error:", error);
    ws.onclose = () => console.warn("📡 WatchTower Socket dropped cleanly.");

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
        wsRef.current = null;
      }
    };
  }, [queryClient]);
}

export function useDeleteMonitor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (monitorId: number) => {
      await api.delete(`/monitors/${monitorId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitors"] });
    },
  });
}

export function useToggleMonitorStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (monitorId: number) => {
      const currentMonitors = queryClient.getQueryData<any[]>(["monitors"]) || [];
      const targetMonitor = currentMonitors.find(m => (m.id ?? m._id) === monitorId);
      const nextActiveState = targetMonitor ? !targetMonitor.is_active : true;

      const response = await api.patch(`/monitors/${monitorId}`, {
        is_active: nextActiveState,
      });
      return response.data;
    },
    onSuccess: () => {
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