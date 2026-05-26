"use client";

import React from "react";
import { MonitorData, useMonitorAnalytics } from "@/hooks/useMonitors";

interface MonitorCardProps {
  monitor: MonitorData;
}

export default function MonitorCard({ monitor }: MonitorCardProps) {
  const { data: checks = [], isLoading } = useMonitorAnalytics(monitor.id);

  const latestCheck = checks[checks.length - 1];
  const isUp = latestCheck ? latestCheck.status_code === 200 : monitor.is_active;
  const currentLatency = latestCheck ? `${latestCheck.latency_ms}ms` : "--";

  // Build a fixed-size historical execution array of exactly 42 slots
  const totalSlots = 42;
  
  // Pad the array with empty placeholders if we don't have 42 runs logged yet
  const paddedChecks = [...Array(Math.max(0, totalSlots - checks.length)).fill(null), ...checks];

  return (
    <div className="rounded-xl border border-border-muted bg-card-surface p-5 shadow-sm flex flex-col gap-4 transition-all hover:border-text-muted/30">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-text-title">{monitor.name}</h3>
          <span className="text-xs text-text-muted font-mono">{monitor.url}</span>
        </div>
        
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
          isUp 
            ? "bg-status-success-bg text-status-success border-status-success/20" 
            : "bg-status-error-bg text-status-error border-status-error/20"
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${isUp ? "bg-status-success animate-pulse" : "bg-status-error"}`} />
          {latestCheck ? `${latestCheck.status_code} OK` : "Pending"}
        </span>
      </div>
      
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>42 checks ago</span>
          <span className="font-medium text-text-title">Latency: {currentLatency}</span>
          <span>Now</span>
        </div>
        
        {/* Render a clean grid containing exactly 42 visual pillars */}
        <div className="flex gap-[3px] h-6 w-full">
          {isLoading ? (
            <div className="h-full w-full bg-canvas animate-pulse rounded-sm" />
          ) : (
            paddedChecks.map((check, index) => {
              // 1. If slot is null (no database check run exists yet for this point in time)
              if (!check) {
                return (
                  <div 
                    key={`empty-${index}`} 
                    className="h-full flex-1 rounded-sm bg-gray-100 dark:bg-neutral-800/40"
                  />
                );
              }

              // 2. Calculate thresholds: loose limits for global websites (degraded if > 1500ms)
              const checkUp = check.status_code === 200;
              const checkDegraded = checkUp && check.latency_ms > 500;
              
              let statusBg = "bg-status-success"; // Green
              if (checkDegraded) statusBg = "bg-status-warning"; // Orange
              if (!checkUp) statusBg = "bg-status-error"; // Red

              return (
                <div 
                  key={check.id} 
                  className={`h-full flex-1 rounded-sm ${statusBg}`} 
                  title={`Latency: ${check.latency_ms}ms | Status: ${check.status_code}`}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}