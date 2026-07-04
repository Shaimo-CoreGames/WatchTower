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

export interface SparklineData {
  id: number;
  latency_ms: number;
  status_code: number;
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
        console.log("🔌 [WS RAW INBOUND] Received frame from backend cluster:", event.data);
        
        const incoming = JSON.parse(event.data);
        if (!incoming || !incoming.monitor_id) return;

        const monitorId = Number(incoming.monitor_id);
        const statusCode = incoming.status_code;
        const latency = incoming.latency_ms ?? incoming.response_time ?? 0;

        // 📊 Normalize full analytics record payload
        const normalizedMetric: HealthCheckData = {
          id: incoming.id ?? Number(`${monitorId}${Date.now()}`),
          monitor_id: monitorId,
          status_code: statusCode,
          latency_ms: latency,
          error_message: incoming.error_message,
          timestamp: incoming.timestamp || new Date().toISOString(),
        };

        // 📈 Normalize micro sparkline record payload
        const normalizedSpark: SparklineData = {
          id: normalizedMetric.id,
          latency_ms: latency,
          status_code: statusCode ?? 500,
          timestamp: normalizedMetric.timestamp,
        };

        console.log(`💾 [MUTATING CACHE] Synchronizing state updates for Monitor #${monitorId}`);

        // 🎯 1. Direct Real-Time Cache Sync for Detailed Analytics View
        queryClient.setQueryData<HealthCheckData[]>(
          ["analytics", monitorId],
          (oldData) => {
            const currentCache = oldData ? [...oldData] : [];
            if (currentCache.some((item) => item.id === normalizedMetric.id)) return currentCache;
            const updatedCache = [...currentCache, normalizedMetric];
            return updatedCache.length > 50 ? updatedCache.slice(-50) : updatedCache;
          }
        );

        // 🎯 2. Direct Real-Time Cache Sync for the Sparkline Graphs (Keeps the right cards live)
        queryClient.setQueryData<SparklineData[]>(
          ["sparkline", monitorId],
          (oldData) => {
            const currentCache = oldData ? [...oldData] : [];
            if (currentCache.some((item) => item.id === normalizedSpark.id)) return currentCache;
            const updatedCache = [...currentCache, normalizedSpark];
            return updatedCache.length > 40 ? updatedCache.slice(-40) : updatedCache;
          }
        );

        // 🎯 3. INTERCEPT & RECALCULATE GLOBAL STATS LIVE (Fixes the Left Side Panel!)
        queryClient.setQueryData<GlobalStats>(["globalStats"], (oldGlobalData) => {
          if (!oldGlobalData) return oldGlobalData;

          // Fetch the latest monitor status cache array to evaluate general health counts
          const cachedMonitors = queryClient.getQueryData<MonitorData[]>(["monitors"]) || [];
          
          // Fallback calculation using current monitor states if available
          let activeChannelsCount = 0;
          const totalChannelsCount = cachedMonitors.length || 4; // structural default fallback

          if (cachedMonitors.length > 0) {
            // Count how many channels are fully operational
            activeChannelsCount = cachedMonitors.filter(m => m.is_active).length;
          } else {
            // Fallback parsing strategy from structural strings ("4 / 4")
            const parts = oldGlobalData.active_channels.split("/");
            activeChannelsCount = parseInt(parts[0]) || 0;
          }

          // Compute a running average latency mix (skipping total drops/connection timeouts)
          let newRunningAvgLatency = oldGlobalData.avg_latency;
          if (latency > 0 && statusCode === 200) {
            newRunningAvgLatency = oldGlobalData.avg_latency > 0
              ? Math.round((oldGlobalData.avg_latency * 0.8) + (latency * 0.2)) // Exponential smooth tracking
              : latency;
          }

          // Dynamically compute global uptime shifting based on real-time transaction codes
          let updatedUptime = oldGlobalData.global_uptime;
          if (statusCode !== 200) {
            // Introduce a subtle degradation swing down if endpoints are breaking
            updatedUptime = Math.max(0, roundToTwo(oldGlobalData.global_uptime - 0.05));
          } else if (statusCode === 200 && oldGlobalData.global_uptime < 100) {
            // Recover stability points gradually
            updatedUptime = Math.min(100, roundToTwo(oldGlobalData.global_uptime + 0.01));
          }

          return {
            global_uptime: updatedUptime,
            avg_latency: newRunningAvgLatency,
            active_channels: `${activeChannelsCount} / ${totalChannelsCount}`
          };
        });

        // Helper function for clean precision rounding
        function roundToTwo(num: number) {
          return Math.round((num + Number.EPSILON) * 100) / 100;
        }

        // 🎯 4. Soft invalidate lists without blocking active interface threads
        queryClient.invalidateQueries({ queryKey: ["monitors"], refetchType: "none" });
        queryClient.invalidateQueries({ queryKey: ["incidents"], refetchType: "none" });

      } catch (err) {
        console.error("❌ Error running real-time state engine update:", err);
      }
    };

    ws.onerror = (error) => console.error("📡 WatchTower Socket Error:", error);
    ws.onclose = () => console.warn("📡 WatchTower Socket dropped cleanly.");

    return () => {
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        wsRef.current.close();
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

export function useMonitorSparkline(monitorId: number) {
  return useQuery<SparklineData[]>({
    queryKey: ["sparkline", monitorId],
    queryFn: async () => {
      const response = await api.get(`/analytics/monitor/${monitorId}/sparkline`);
      return response.data;
    },
    refetchInterval: false,
  });
}