"use client";

import React from "react";
import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";
import { useMonitorSparkline } from "@/hooks/useMonitors";

interface LatencySparklineProps {
  monitorId: number;
}

export default function LatencySparkline({ monitorId }: LatencySparklineProps) {
  const { data: chartData = [], isLoading } = useMonitorSparkline(monitorId);

  if (isLoading) {
    return <div className="h-16 w-full animate-pulse bg-slate-800/50 rounded-lg" />;
  }

  const normalizedData = chartData.length > 0 
    ? chartData 
    : Array(20).fill(0).map((_, i) => ({ id: i, latency_ms: 0 }));

  return (
    // 🎯 FIX: Added explicit h-16 (4rem) block sizing and min-w-0 to prevent flex collapses
    <div className="w-full h-16 min-w-0 relative block">
      {/* 🎯 FIX: Added minWidth={0} so Recharts handles dynamic layout constraints safely */}
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart
          data={normalizedData}
          margin={{ top: 2, right: 2, left: 2, bottom: 2 }}
        >
          <defs>
            <linearGradient id={`colorLatency-${monitorId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
          </defs>
          
          <YAxis domain={["dataMin - 5", "dataMax + 5"]} hide />
          
          <Area
            type="monotone"
            dataKey="latency_ms"
            stroke="#10B981"
            strokeWidth={1.5}
            fillOpacity={1}
            fill={`url(#colorLatency-${monitorId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}