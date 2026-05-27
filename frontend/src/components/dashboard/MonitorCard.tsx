"use client";

import React from "react";
import { MonitorData, useMonitorAnalytics, useDeleteMonitor, useToggleMonitorStatus } from "@/hooks/useMonitors";

interface MonitorCardProps {
  monitor: MonitorData;
}

export default function MonitorCard({ monitor }: MonitorCardProps) {
  const { data: checks = [], isLoading } = useMonitorAnalytics(monitor.id);
  
  // 💡 Initialize our fresh data management mutations
  const deleteMonitorMutation = useDeleteMonitor();
  const toggleStatusMutation = useToggleMonitorStatus();

  const latestCheck = checks.length > 0 ? checks[checks.length - 1] : null;
  
  // A monitor is considered operational only if it's active AND returning a 200 status code
  const isUp = monitor.is_active && latestCheck ? latestCheck.status_code === 200 : monitor.is_active;
  const currentLatency = monitor.is_active && latestCheck ? `${latestCheck.latency_ms}ms` : "--";

  const totalSlots = 42;
  const paddedChecks = [...Array(Math.max(0, totalSlots - checks.length)).fill(null), ...checks];

  // 💡 Action Handlers
  const handleToggleStatus = async () => {
    await toggleStatusMutation.mutateAsync({
      monitorId: monitor.id,
      isActive: !monitor.is_active,
    });
  };

  const handleDelete = async () => {
    if (confirm(`Are you sure you want to permanently delete "${monitor.name}" and all historical data rows?`)) {
      await deleteMonitorMutation.mutateAsync(monitor.id);
    }
  };

  return (
    <div className={`rounded-xl border bg-card-surface p-5 shadow-sm flex flex-col gap-4 transition-all ${
      monitor.is_active 
        ? "border-border-muted hover:border-text-muted/30" 
        : "border-border-muted bg-gray-50/50 dark:bg-neutral-900/30 opacity-75"
    }`}>
      
      <div className="flex items-start justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-text-title">{monitor.name}</h3>
            {!monitor.is_active && (
              <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 uppercase tracking-wide">
                Paused
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted font-mono truncate max-w-[200px]" title={monitor.url}>
            {monitor.url}
          </p>
        </div>
        
        {/* Status Indicator Pill */}
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
          !monitor.is_active
            ? "bg-gray-100 text-gray-500 border-gray-200"
            : isUp 
              ? "bg-status-success-bg text-status-success border-status-success/20" 
              : "bg-status-error-bg text-status-error border-status-error/20"
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${!monitor.is_active ? "bg-gray-400" : isUp ? "bg-status-success animate-pulse" : "bg-status-error"}`} />
          {!monitor.is_active ? "Offline" : latestCheck ? `${latestCheck.status_code} OK` : "Pending"}
        </span>
      </div>
      
      {/* Sparkline Visualization Area */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>42 checks ago</span>
          <span className="font-medium text-text-title">Latency: {currentLatency}</span>
          <span>Now</span>
        </div>
        
        <div className="flex gap-[3px] h-6 w-full">
          {isLoading ? (
            <div className="h-full w-full bg-canvas animate-pulse rounded-sm" />
          ) : !monitor.is_active ? (
            // Greyscale placeholder bar array if target tracking state is paused
            <div className="h-full w-full bg-gray-100 dark:bg-neutral-800/20 rounded-md border border-dashed border-gray-200 flex items-center justify-center text-[10px] text-gray-400 font-medium">
              Monitoring Paused
            </div>
          ) : (
            paddedChecks.map((check, index) => {
              if (!check) {
                return (
                  <div key={`empty-${index}`} className="h-full flex-1 rounded-sm bg-gray-100 dark:bg-neutral-800/40" />
                );
              }

              const checkUp = check.status_code === 200;
              const checkDegraded = checkUp && check.latency_ms > 500;
              
              let statusBg = "bg-status-success"; 
              if (checkDegraded) statusBg = "bg-status-warning"; 
              if (!checkUp) statusBg = "bg-status-error"; 

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

      {/* 💡 Action Controls Footnote Bar */}
      <div className="flex items-center justify-end gap-2 border-t border-border-muted pt-3 mt-1">
        <button
          onClick={handleToggleStatus}
          disabled={toggleStatusMutation.isPending}
          className={`text-xs font-semibold px-2.5 py-1 rounded-md border transition-all ${
            monitor.is_active
              ? "bg-canvas text-text-muted hover:text-text-title border-border-muted"
              : "bg-text-title text-card-surface hover:bg-text-title/90 border-transparent shadow-sm"
          }`}
        >
          {monitor.is_active ? "Pause" : "Resume"}
        </button>
        
        <button
          onClick={handleDelete}
          disabled={deleteMonitorMutation.isPending}
          className="p-1 rounded-md border border-border-muted hover:border-status-error/30 text-text-muted hover:text-status-error hover:bg-status-error-bg/30 transition-all"
          title="Delete Target Profile Permanently"
        >
          🗑️
        </button>
      </div>

    </div>
  );
}