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

  // 🎯 COMPUTE COLOR MATRIX BASED ON STATUS CODE AND LATENCY
  const latestCheck = chartData.length > 0 ? chartData[chartData.length - 1] : null;
  
  let strokeColor = "#10B981"; // Healthy (Emerald)
  let glowOpacity = 0.25;

  if (latestCheck) {
    const isDown = latestCheck.status_code !== 200 || latestCheck.latency_ms === 0;
    const isDegraded = latestCheck.status_code === 200 && latestCheck.latency_ms > 1000;

    if (isDown) {
      strokeColor = "#EF4444"; // Incident Warning (Red)
      glowOpacity = 0.40;
    } else if (isDegraded) {
      strokeColor = "#F59E0B"; // Performance Bottleneck (Amber)
      glowOpacity = 0.30;
    }
  }

  return (
    <div className="w-full h-16 min-w-0 relative block">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart
          data={normalizedData}
          margin={{ top: 2, right: 2, left: 2, bottom: 2 }}
        >
          <defs>
            {/* The gradient ID remains unique, but its color properties are dynamic */}
            <linearGradient id={`colorLatency-${monitorId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={strokeColor} stopOpacity={glowOpacity} />
              <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          
          <YAxis domain={["dataMin - 5", "dataMax + 5"]} hide />
          
          <Area
            type="monotone"
            dataKey="latency_ms"
            stroke={strokeColor} // 🟢 Injects dynamic status color to stroke line
            strokeWidth={1.75}
            fillOpacity={1}
            fill={`url(#colorLatency-${monitorId})`} // 🟢 References the reactive color template
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}