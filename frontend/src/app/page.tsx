"use client";

import React, { useState } from "react";
// 💡 Added useIncidents hook import here
import { useMonitors, useRealTimeAnalytics, useGlobalStats, useIncidents } from "@/hooks/useMonitors";
import MonitorCard from "@/components/dashboard/MonitorCard";
import AddMonitorModal from "@/components/dashboard/AddMonitorModal";
import MonitorsWorkspace from "@/components/monitors/MonitorsWorkspace";
import IntegrationWorkspace from "@/components/integration/IntegrationWorkspace";
import SettingsWorkspace from "@/components/settings/SettingsWorkspace";

export default function DashboardHome() {
  useRealTimeAnalytics();
  
  const { data: monitors = [], isLoading, isError, error } = useMonitors();
  const { data: stats, isLoading: isStatsLoading } = useGlobalStats();
  // 💡 Pull real-time incident datasets down smoothly
  const { data: incidents = [], isLoading: isIncidentsLoading } = useIncidents();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<"Dashboard" | "Monitors" | "Incidents" | "Integrations" | "Settings">("Dashboard");

  const totalMonitors = monitors.length;
  const activeMonitors = monitors.filter(m => m.is_active).length;

  // Split incident states efficiently for cleaner UI prioritization components
  const activeOutages = incidents.filter(i => !i.is_resolved);
  const resolvedHistory = incidents.filter(i => i.is_resolved);

  // Helper function to render clean relative timestamp strings
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + " (" + date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ")";
  };

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
            {(["Dashboard", "Monitors", "Incidents", "Integrations", "Settings"] as const).map((item) => (
              <button 
                key={item} 
                onClick={() => setActiveMenu(item)} 
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all text-left ${
                  activeMenu === item 
                    ? "bg-canvas text-text-title font-semibold shadow-sm border border-border-muted/40" 
                    : "text-text-muted hover:bg-canvas/50 hover:text-text-title"
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

      {/* MAIN ROUTER HUB CONTAINER */}
      <main className="flex h-full flex-1 overflow-hidden p-8">
        
        {/* DASHBOARD VIEW (PANEL 1 & 2 HORIZONTAL SCROLL) */}
        {activeMenu === "Dashboard" && (
          <div className="flex h-full flex-1 overflow-x-auto overflow-y-hidden gap-6 scroll-smooth">
            {/* PANEL 1: MACRO HEALTH STATUS AGGREGATES */}
            <section className="flex h-full w-[440px] flex-col gap-6 shrink-0 overflow-y-auto pr-2">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <h2 className="text-xl font-bold text-text-title tracking-tight">Global Health</h2>
                  <p className="text-xs text-text-muted">Macro telemetry overview diagnostics</p>
                </div>
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
                    <span className="text-2xl font-bold tracking-tight text-status-success">
                      {isStatsLoading ? "---" : `${stats?.global_uptime}%`}
                    </span>
                    <span className="text-xs font-medium text-text-muted">Operational</span>
                  </div>
                </div>

                <div className="rounded-xl border border-border-muted bg-card-surface p-5 shadow-sm">
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Average Network Latency</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-2xl font-bold tracking-tight text-text-title font-mono">
                      {isStatsLoading ? "---" : `${stats?.avg_latency}ms`}
                    </span>
                    <span className="text-xs font-medium text-text-muted">Sub-ms Precision</span>
                  </div>
                </div>

                <div className="rounded-xl border border-border-muted bg-card-surface p-5 shadow-sm">
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Active Channels Tracking</span>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-2xl font-bold tracking-tight text-status-success">
                      {isLoading ? "Loading..." : `${activeMonitors} / ${totalMonitors} Online`}
                    </span>
                    <span className="text-xs font-medium text-text-muted">{activeOutages.length} Incidents</span>
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
          </div>
        )}

        {/* 💡 ACTIVE INCIDENTS OPERATION SCREEN CONTAINER */}
        {activeMenu === "Incidents" && (
          <div className="flex-1 overflow-y-auto space-y-8 max-w-5xl pr-4">
            <div>
              <h2 className="text-xl font-bold text-text-title tracking-tight">Incident Operations Hub</h2>
              <p className="text-xs text-text-muted">System crash logs, network timeouts, and downtime audit trails.</p>
            </div>

            {/* SECTION 1: CRITICAL ACTIVE UNRESOLVED OUTAGES */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-status-error flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-status-error animate-ping" />
                Active Incidents ({activeOutages.length})
              </h3>
              
              {activeOutages.length === 0 ? (
                <div className="rounded-xl border border-border-muted bg-card-surface p-6 text-center text-sm text-text-muted shadow-sm">
                  🎉 Everything is completely nominal. No active server outages detected!
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {activeOutages.map((incident) => (
                    <div key={incident.id} className="rounded-xl border border-status-error/20 bg-status-error-bg/20 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h4 className="text-sm font-bold text-text-title">{incident.monitor_name}</h4>
                        <p className="text-xs font-mono text-text-muted truncate max-w-md">{incident.monitor_url}</p>
                        <div className="mt-2 text-xs font-semibold text-status-error bg-status-error-bg/50 px-2 py-1 rounded inline-block">
                          Error Details: {incident.error_details}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs text-text-muted block">Outage Started</span>
                        <span className="text-sm font-mono font-bold text-text-title">{formatTime(incident.started_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION 2: ARCHIVED AND RESOLVED INCIDENTS */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted">
                Historical Incident Logs ({resolvedHistory.length})
              </h3>

              {isIncidentsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, idx) => (
                    <div key={idx} className="h-16 w-full rounded-xl border border-border-muted bg-card-surface animate-pulse" />
                  ))}
                </div>
              ) : resolvedHistory.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border-muted p-8 text-center text-xs text-text-muted">
                  No historical outages have been logged yet.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border-muted bg-card-surface shadow-sm">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-canvas border-b border-border-muted text-xs font-bold uppercase tracking-wider text-text-muted">
                        <th className="p-4">Target Name</th>
                        <th className="p-4">Incident Cause</th>
                        <th className="p-4">Downtime Window</th>
                        <th className="p-4 text-right">Operational Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-muted">
                      {resolvedHistory.map((incident) => (
                        <tr key={incident.id} className="hover:bg-canvas/40 transition-colors">
                          <td className="p-4 font-semibold text-text-title">
                            {incident.monitor_name}
                            <span className="block text-xs font-mono font-normal text-text-muted max-w-[200px] truncate">{incident.monitor_url}</span>
                          </td>
                          <td className="p-4">
                            <span className="text-xs bg-gray-100 dark:bg-neutral-800 font-mono text-text-title px-2 py-1 rounded">
                              {incident.error_details}
                            </span>
                          </td>
                          <td className="p-4 text-xs text-text-muted space-y-0.5">
                            <div><span className="font-semibold text-text-title">From:</span> {formatTime(incident.started_at)}</div>
                            <div><span className="font-semibold text-text-title">To:</span> {formatTime(incident.resolved_at || "")}</div>
                          </td>
                          <td className="p-4 text-right">
                            <span className="inline-flex items-center gap-1 rounded-md bg-status-success-bg text-status-success px-2 py-0.5 text-xs font-bold border border-status-success/10">
                              ✓ Resolved
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 💡 LIVE MONITORS WORKSPACE CONTROLLER */}
        {activeMenu === "Monitors" && (
          <MonitorsWorkspace />
        )}

        {/* 💡 ACTIVE INTEGRATIONS PROVISIONING WORKSPACE CONTROLLER */}
        {activeMenu === "Integrations" && (
          <IntegrationWorkspace />
            )}

        {/* 💡 SYSTEM ECOSYSTEM SETTINGS WORKSPACE CONTROLLER */}
        {activeMenu === "Settings" && (
          <SettingsWorkspace />
        )}

      </main>

      <AddMonitorModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}