"use client";

import React from "react";
import { MonitorData, useMonitorAnalytics } from "@/hooks/useMonitors";

interface MonitorCardProps {
  monitor: MonitorData;
}

export default function MonitorCard({ monitor }: MonitorCardProps) {
  // Pull historical health-check runs for this specific tracking id
  const { data: checks = [], isLoading } = useMonitorAnalytics(monitor.id);

  // Compute live current stats based on the latest time-series entry returned
  const latestCheck = checks[checks.length - 1];
  const isUp = latestCheck ? latestCheck.status_code === 200 : monitor.is_active;
  const currentLatency = latestCheck ? `${latestCheck.latency_ms}ms` : "--";

  return (
    <div className="rounded-xl border border-border-muted bg-card-surface p-5 shadow-sm flex flex-col gap-4 transition-all hover:border-text-muted/30">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-text-title">{monitor.name}</h3>
          <span className="text-xs text-text-muted font-mono">{monitor.url}</span>
        </div>
        
        {/* Dynamic Status Badges */}
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
          isUp 
            ? "bg-status-success-bg text-status-success border-status-success/20" 
            : "bg-status-error-bg text-status-error border-status-error/20"
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${isUp ? "bg-status-success animate-pulse" : "bg-status-error"}`} />
          {latestCheck ? `${latestCheck.status_code} ${isUp ? 'OK' : 'FAIL'}` : "Pending"}
        </span>
      </div>
      
      {/* Dynamic 42-Pill Sparkline Availability Matrix */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>42 checks ago</span>
          <span className="font-medium text-text-title">Latency: {currentLatency}</span>
          <span>Now</span>
        </div>
        
        {/* Replace the current sparklines div container code with this optimized v4 rendering block */}
<div className="flex gap-[3px] h-6 w-full">
  {isLoading ? (
    <div className="h-full w-full bg-canvas animate-pulse rounded-sm" />
  ) : checks.length === 0 ? (
    // Render neutral placeholder bars instead of a blank layout block when data is pending
    Array.from({ length: 42 }).map((_, i) => (
      <div 
        key={i} 
        className="h-full flex-1 rounded-sm bg-gray-200/50" 
        title="Awaiting initial background check execution sequence..."
      />
    ))
  ) : (
    checks.map((check) => {
      const checkUp = check.status_code === 200;
      const checkDegraded = checkUp && check.latency_ms > 300;
      
      let statusBg = "bg-status-success";
      if (checkDegraded) statusBg = "bg-status-warning";
      if (!checkUp) statusBg = "bg-status-error";

      return (
        <div 
          key={check.id} 
          className={`h-full flex-1 rounded-sm ${statusBg}`} 
          title={`Time: ${new Date(check.timestamp).toLocaleTimeString()} | Latency: ${check.latency_ms}ms`}
        />
      );
    })
  )}
</div>
      </div>
    </div>
  );
}