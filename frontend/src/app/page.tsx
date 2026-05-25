"use client";

import React from "react";

export default function DashboardHome() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-canvas">
      
      {/* 1. FIXED LEFT SIDEBAR PANEL */}
      <aside className="flex h-full w-[260px] flex-col justify-between border-r border-border-muted bg-card-surface p-6 shrink-0 z-10 shadow-sm">
        <div className="flex flex-col gap-8">
          {/* Logo Heading */}
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-text-title flex items-center justify-center text-card-surface font-bold text-xs">W</div>
            <h1 className="text-lg font-bold text-text-title tracking-tight">WatchTower</h1>
          </div>
          
          {/* Navigation Links */}
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
        
        {/* User Account Capsule Section */}
        <div className="flex items-center gap-3 border-t border-border-muted pt-4">
          <div className="h-9 w-9 rounded-full bg-border-muted flex items-center justify-center font-semibold text-text-title text-sm">AO</div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-text-title">Alex Operator</span>
            <span className="text-xs text-text-muted">demo@watchtower.io</span>
          </div>
        </div>
      </aside>

      {/* 2. HORIZONTALLY SCROLLABLE PANELS CONTAINER */}
      <main className="flex h-full flex-1 overflow-x-auto overflow-y-hidden p-8 gap-6 scroll-smooth">
        
        {/* PANEL 1: MACRO PERFORMANCE AGGREGATES */}
        <section className="flex h-full w-[440px] flex-col gap-6 shrink-0 overflow-y-auto pr-2">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-text-title tracking-tight">Global Health</h2>
            <p className="text-xs text-text-muted">Macro telemetry overview diagnostics</p>
          </div>
          
          {/* KPI Blocks */}
          <div className="flex flex-col gap-4">
            {[
              { label: "Global System Uptime", val: "99.98%", sub: "Operational", color: "text-status-success" },
              { label: "Average Network Latency", val: "42ms", sub: "Sub-ms Precision", color: "text-text-title font-mono" },
              { label: "Active Tracking Channels", val: "4 / 4 Online", sub: "0 Incidents", color: "text-status-success" }
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-border-muted bg-card-surface p-5 shadow-sm">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">{kpi.label}</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className={`text-2xl font-bold tracking-tight ${kpi.color}`}>{kpi.val}</span>
                  <span className="text-xs font-medium text-text-muted">{kpi.sub}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* PANEL 2: LIVE MONITOR TRACKING STREAM */}
        <section className="flex h-full w-[620px] flex-col gap-6 shrink-0 overflow-y-auto pr-2">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-text-title tracking-tight">Live Monitors</h2>
            <p className="text-xs text-text-muted">Real-time execution endpoints stream</p>
          </div>
          
          {/* Target List Container */}
          <div className="flex flex-col gap-4">
            {["Primary API Gateway", "Main DB Cluster", "Asset Delivery Edge"].map((name) => (
              <div key={name} className="rounded-xl border border-border-muted bg-card-surface p-5 shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-text-title">{name}</h3>
                    <span className="text-xs text-text-muted font-mono">api.watchtower.io</span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-status-success-bg px-2.5 py-0.5 text-xs font-medium text-status-success border border-border-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-status-success" /> 200 OK
                  </span>
                </div>
                
                {/* 30-Day Sparkline Uptime Row */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span>30 days ago</span>
                    <span className="font-medium text-text-title">100% availability</span>
                    <span>Today</span>
                  </div>
                  <div className="flex gap-[3px] h-6 w-full">
                    {Array.from({ length: 42 }).map((_, i) => (
                      <div 
                        key={i} 
                        className={`h-full flex-1 rounded-sm ${i === 18 ? "bg-status-warning" : i === 31 ? "bg-status-error" : "bg-status-success"}`} 
                        title="Day trace operational status"
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}