"use client";

import React from "react";
import type { MonitorData } from "@/hooks/useMonitors";
import { useDeleteMonitor, useToggleMonitorStatus, useMonitorSparkline } from "@/hooks/useMonitors";
import LatencySparkline from "./LatencySparkline";

interface MonitorCardProps {
  monitor: MonitorData;
}

export default function MonitorCard({ monitor }: MonitorCardProps) {
  // 🎯 FIX: Pull data from the same sparkline hook that updates via WebSocket!
  const { data: chartData = [] } = useMonitorSparkline(monitor.id);
  
  const deleteMonitorMutation = useDeleteMonitor();
  const toggleStatusMutation = useToggleMonitorStatus();

  // Find the latest live node check from the end of the chronological list
  const latestCheck = chartData.length > 0 ? chartData[chartData.length - 1] : null;

  // Derive dynamic color states
  const isUp = monitor.is_active
    ? latestCheck
      ? latestCheck.latency_ms > 0 // Optimistic check updates
      : true
    : false;

  // 🎯 FIX: Dynamically displays the live metric text value instantly
  const currentLatency = latestCheck ? `${latestCheck.latency_ms}ms` : "--";

  const handleToggleStatus = async () => {
    await toggleStatusMutation.mutateAsync(monitor.id);
  };

  const handleDelete = async () => {
    if (
      confirm(
        `Are you sure you want to permanently delete "${monitor.name}" and all historical data rows?`
      )
    ) {
      await deleteMonitorMutation.mutateAsync(monitor.id);
    }
  };

  return (
    <div
      className={`rounded-xl border bg-card-surface p-5 shadow-sm flex flex-col gap-4 transition-all ${
        monitor.is_active
          ? "border-border-muted hover:border-text-muted/30"
          : "border-border-muted bg-gray-50/50 dark:bg-neutral-900/30 opacity-75"
      }`}
    >
      {/* Card Header metadata layer */}
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
          <p
            className="text-xs text-text-muted font-mono truncate max-w-[200px]"
            title={monitor.url}
          >
            {monitor.url}
          </p>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
            !monitor.is_active
              ? "bg-gray-100 text-gray-500 border-gray-200"
              : isUp
                ? "bg-status-success-bg text-status-success border-status-success/20"
                : "bg-status-error-bg text-status-error border-status-error/20"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              !monitor.is_active
                ? "bg-gray-400"
                : isUp
                  ? "bg-status-success animate-pulse"
                  : "bg-status-error"
            }`}
          />
          {!monitor.is_active
            ? "Offline"
            : latestCheck
              ? "Operational"
              : "Pending"}
        </span>
      </div>

      {/* Latency Visual Stream and Sparkline Chart layout area */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>Rolling History</span>
          <span className="font-bold font-mono text-emerald-400 text-sm">
            {currentLatency}
          </span>
          <span>Now</span>
        </div>

        {/* Integrated Sparkline graph container */}
        <div className="mt-1">
          <LatencySparkline monitorId={monitor.id} />
        </div>
      </div>

      {/* Action panel triggers section */}
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