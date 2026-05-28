import React, { useState } from "react";
import { useMonitors, useCreateMonitor, useToggleMonitorStatus, useDeleteMonitor } from "@/hooks/useMonitors";
function MonitorsWorkspace() {
  const { data: monitors = [], isLoading } = useMonitors();
  const createMonitorMutation = useCreateMonitor();
  const toggleMonitorMutation = useToggleMonitorStatus();
  const deleteMonitorMutation = useDeleteMonitor();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [interval, setInterval] = useState(60);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url) return;

    createMonitorMutation.mutate(
      { name, url, check_interval: interval },
      {
        onSuccess: () => {
          setName("");
          setUrl("");
          setInterval(60);
          setIsFormOpen(false);
        },
      }
    );
  };

  if (isLoading) {
    return <div className="text-xs text-text-muted animate-pulse">Gathering provisioned endpoints...</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-8 max-w-5xl pr-4">
      {/* HEADER BAR CONTROL SECTION */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-title tracking-tight">Telemetry Monitors</h2>
          <p className="text-xs text-text-muted">Provision, toggle, and analyze real-time polling targets across your infrastructure.</p>
        </div>
        {!isFormOpen && (
          <button
            onClick={() => setIsFormOpen(true)}
            className="rounded-lg bg-text-title px-3 py-1.5 text-xs font-semibold text-card-surface hover:bg-text-title/90 transition-all shadow-sm cursor-pointer"
          >
            + Create New Monitor
          </button>
        )}
      </div>

      {/* PROVISIONING INTERACTIVE SLIDE FORM */}
      {isFormOpen && (
        <form onSubmit={handleSubmit} className="p-5 border border-border-muted bg-card-surface rounded-xl space-y-4 shadow-sm animate-fadeIn">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-title">Provision New Target Endpoint</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase text-text-muted block mb-1">Friendly Monitor Name</label>
              <input
                type="text"
                placeholder="e.g., Production API Gateway"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-canvas border border-border-muted text-xs rounded-lg p-2 text-text-title font-medium focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-text-muted block mb-1">Target Endpoint URL</label>
              <input
                type="url"
                placeholder="https://api.yourdomain.com/health"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-canvas border border-border-muted text-xs rounded-lg p-2 text-text-title font-mono focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-text-muted block mb-1">Polling Freq (Seconds)</label>
              <select
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                className="w-full bg-canvas border border-border-muted text-xs rounded-lg p-2 text-text-title focus:outline-none"
              >
                <option value={30}>30 Seconds (Aggressive)</option>
                <option value={60}>60 Seconds (Standard)</option>
                <option value={300}>300 Seconds (Relaxed)</option>
              </select>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 text-xs">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-3 py-1.5 border border-border-muted rounded-lg text-text-muted font-medium hover:bg-canvas cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMonitorMutation.isPending}
              className="px-3 py-1.5 bg-text-title text-card-surface font-semibold rounded-lg hover:bg-text-title/90 transition-all cursor-pointer disabled:opacity-50"
            >
              {createMonitorMutation.isPending ? "Provisioning..." : "Activate Monitor"}
            </button>
          </div>
        </form>
      )}

      {/* MONITORS INTERACTIVE INVENTORY GRID */}
      {monitors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-muted p-12 text-center space-y-2">
          <p className="text-sm font-semibold text-text-title">No monitoring vectors active.</p>
          <p className="text-xs text-text-muted max-w-sm mx-auto">Launch a fresh endpoint target tracking link using the wizard above to begin streaming uptime telemetry metrics.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {monitors.map((monitor: any) => (
            <div
              key={monitor.id}
              className="rounded-xl border border-border-muted bg-card-surface p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-all"
            >
              {/* METRIC PROFILE SUMMARY */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${monitor.is_active ? "bg-status-success shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-gray-400"}`} />
                  <h4 className="text-sm font-bold text-text-title tracking-tight">{monitor.name}</h4>
                  <span className="text-[10px] bg-canvas border border-border-muted/50 text-text-muted px-1.5 py-0.5 rounded font-mono">
                    {monitor.check_interval}s interval
                  </span>
                </div>
                <p className="text-xs text-text-muted font-mono truncate max-w-xl">{monitor.url}</p>
              </div>

              {/* LIVE OPERATION TOGGLES & ACTIONS CONTROL BLOCK */}
              <div className="flex items-center gap-3 justify-end">
                <button
              onClick={() => {
                const targetId = monitor.id ?? monitor._id;
                if (!targetId) return;
                
                // 💡 Fires with just the clean identifier integer now
                toggleMonitorMutation.mutate(targetId);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                monitor.is_active
                  ? "bg-status-success-bg/10 border-status-success/20 text-status-success hover:bg-status-success-bg/20"
                  : "bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {monitor.is_active ? "Tracking Active" : "Paused"}
            </button>

                <button
                  onClick={() => {
                    if (confirm(`Permanently de-provision tracking vector "${monitor.name}"?`)) {
                      deleteMonitorMutation.mutate(monitor.id);
                    }
                  }}
                  className="p-1.5 rounded-lg border border-border-muted hover:border-status-error/30 text-text-muted hover:text-status-error transition-all cursor-pointer"
                  title="Delete Monitor"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MonitorsWorkspace