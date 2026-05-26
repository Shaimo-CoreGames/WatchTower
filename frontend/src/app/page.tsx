"use client";

import React, { useState } from "react";
import { useMonitors } from "@/hooks/useMonitors";
import MonitorCard from "@/components/dashboard/MonitorCard";
import AddMonitorModal from "@/components/dashboard/AddMonitorModal";

export default function DashboardHome() {
  const { data: monitors = [], isLoading, isError, error } = useMonitors();
  
  // Track open state for the monitor creation form overlay
  const [isModalOpen, setIsModalOpen] = useState(false);

  const totalMonitors = monitors.length;
  const activeMonitors = monitors.filter(m => m.is_active).length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-canvas">
      
      {/* SIDEBAR NAVIGATION PANEL */}
      <aside className="flex h-full w-[260px] flex-col justify-between border-r border-border-muted bg-card-surface p-6 shrink-0 z-10 shadow-sm">
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-text-title flex items-center justify-center text-card-surface font-bold text-xs">W</div>
            <h1 className="text-lg font-bold text-text-title tracking-tight">WatchTower</h1>
          </div>
          
          <nav className="flex flex-col gap-1">
            {["Dashboard", "Monitors", "Incidents", "Integrations", "Settings"].map((item, idx) => (
              <button 
                key={item} 
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors text-left ${
                  idx === 0 ? "bg-canvas text-text-title" : "text-text-muted hover:bg-canvas hover:text-text-title"
                }`}
              >
                {item}
              </button>
            ))}
          </nav>
        </div>
        
        <div className="flex items-center gap-3 border-t border-border-muted pt-4">
          <div className="h-9 w-9 rounded-full bg-border-muted flex items-center justify-center font-semibold text-text-title text-sm">AO</div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-text-title">Alex Operator</span>
            <span className="text-xs text-text-muted">demo@watchtower.io</span>
          </div>
        </div>
      </aside>

      {/* HORIZONTALLY SCROLLABLE PANELS HUB CONTAINER */}
      <main className="flex h-full flex-1 overflow-x-auto overflow-y-hidden p-8 gap-6 scroll-smooth">
        
        {/* PANEL 1: MACRO HEALTH STATUS AGGREGATES */}
        <section className="flex h-full w-[440px] flex-col gap-6 shrink-0 overflow-y-auto pr-2">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h2 className="text-xl font-bold text-text-title tracking-tight">Global Health</h2>
              <p className="text-xs text-text-muted">Macro telemetry overview diagnostics</p>
            </div>
            
            {/* INJECTED FORM LAUNCH BUTTON ELEMENT */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-text-title px-3 py-1.5 text-xs font-semibold text-card-surface hover:bg-text-title/90 transition-colors shadow-sm"
            >
              + Add Monitor
            </button>
          </div>
          
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-border-muted bg-card-surface p-5 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Global System Uptime</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold tracking-tight text-status-success">99.98%</span>
                <span className="text-xs font-medium text-text-muted">Operational</span>
              </div>
            </div>

            <div className="rounded-xl border border-border-muted bg-card-surface p-5 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Average Network Latency</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold tracking-tight text-text-title font-mono">42ms</span>
                <span className="text-xs font-medium text-text-muted">Sub-ms Precision</span>
              </div>
            </div>

            <div className="rounded-xl border border-border-muted bg-card-surface p-5 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Active Channels Tracking</span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold tracking-tight text-status-success">
                  {isLoading ? "Loading..." : `${activeMonitors} / ${totalMonitors} Online`}
                </span>
                <span className="text-xs font-medium text-text-muted">0 Incidents</span>
              </div>
            </div>
          </div>
        </section>

        {/* PANEL 2: DYNAMIC LIVE MONITOR TRACKING STREAM */}
        <section className="flex h-full w-[620px] flex-col gap-6 shrink-0 overflow-y-auto pr-2">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-text-title tracking-tight">Live Monitors</h2>
            <p className="text-xs text-text-muted">Real-time execution endpoints stream</p>
          </div>
          
          <div className="flex flex-col gap-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="h-32 w-full rounded-xl border border-border-muted bg-card-surface animate-pulse" />
              ))
            ) : isError ? (
              <div className="rounded-xl border border-status-error/30 bg-status-error-bg p-4 text-sm text-status-error">
                <strong>API connection issue:</strong> {error instanceof Error ? error.message : "Ensure backend is running on port 8000"}
              </div>
            ) : monitors.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border-muted bg-white p-8 text-center text-sm text-text-muted">
                No active monitors configured. Click "+ Add Monitor" to provision one.
              </div>
            ) : (
              monitors.map((monitor) => (
                <MonitorCard key={monitor.id} monitor={monitor} />
              ))
            )}
          </div>
        </section>

      </main>

      {/* CENTRALIZED MODAL ACTION RENDER LAYER */}
      <AddMonitorModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}