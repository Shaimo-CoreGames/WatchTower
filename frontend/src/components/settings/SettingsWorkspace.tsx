import { useSystemSettings } from "@/hooks/useMonitors";
import { useState } from "react";

function SettingsWorkspace() {
  const { data: config, isLoading, purgeMutation } = useSystemSettings();
  const [retentionDays, setRetentionDays] = useState(30);

  if (isLoading || !config) {
    return <div className="text-xs text-text-muted animate-pulse">Loading system settings...</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-8 max-w-5xl pr-4">
      <div>
        <h2 className="text-xl font-bold text-text-title tracking-tight">Ecosystem Settings</h2>
        <p className="text-xs text-text-muted">Manage your operator workspace parameters, global telemetry retention, and database storage.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* CARD 1: OPERATOR ACCOUNT PROFILE BOX */}
        <div className="md:col-span-1 rounded-xl border border-border-muted bg-card-surface p-6 shadow-sm flex flex-col gap-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">Active Operator</h3>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-text-title/10 text-text-title flex items-center justify-center font-bold text-base">
              {config.operator.name.split(" ").map(n => n[0]).join("")}
            </div>
            <div>
              <h4 className="text-sm font-bold text-text-title">{config.operator.name}</h4>
              <p className="text-xs text-text-muted">{config.operator.role}</p>
            </div>
          </div>
          <div className="border-t border-border-muted/60 pt-3 text-[11px] text-text-muted">
            Workspace Joined: <span className="font-mono text-text-title">{config.operator.joined}</span>
          </div>
        </div>

        {/* CARD 2: DATABASE TELEMETRY HEALTH METRICS */}
        <div className="md:col-span-2 rounded-xl border border-border-muted bg-card-surface p-6 shadow-sm flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">Database Engine Status</h3>
            <span className="inline-flex items-center rounded-md bg-status-success-bg px-2 py-0.5 text-[10px] font-bold text-status-success border border-status-success/10 uppercase">
              ● {config.database_stats.status}
            </span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2 border-b border-t border-border-muted/50">
            <div>
              <span className="text-[10px] text-text-muted block">DB Engine</span>
              <span className="text-xs font-bold text-text-title font-mono">{config.database_stats.engine}</span>
            </div>
            <div>
              <span className="text-[10px] text-text-muted block">Monitors Provisioned</span>
              <span className="text-xs font-bold text-text-title font-mono">{config.database_stats.total_monitors_provisioned}</span>
            </div>
            <div>
              <span className="text-[10px] text-text-muted block">Telemetry Metric Rows</span>
              <span className="text-xs font-bold text-text-title font-mono">{config.database_stats.total_telemetry_rows}</span>
            </div>
            <div>
              <span className="text-[10px] text-text-muted block">Incidents Logged</span>
              <span className="text-xs font-bold text-text-title font-mono">{config.database_stats.total_incidents_logged}</span>
            </div>
          </div>

          <div className="text-[11px] text-text-muted">
            Connection parameters optimized via internal connection pool.
          </div>
        </div>

      </div>

      {/* CORE CONTROL SETTING: RETENTION POLICIES */}
      <div className="rounded-xl border border-border-muted bg-card-surface p-6 shadow-sm space-y-6">
        <div>
          <h3 className="text-sm font-bold text-text-title">Global Telemetry Data Retention</h3>
          <p className="text-xs text-text-muted">Control how long WatchTower stores granular ping logs inside PostgreSQL before cleaning up old rows to preserve disk space.</p>
        </div>

        <div className="max-w-md space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted block">Pruning Threshold (Days)</label>
          <div className="flex gap-4">
            <input 
              type="number" 
              value={retentionDays} 
              onChange={(e) => setRetentionDays(Number(e.target.value))}
              className="bg-canvas border border-border-muted text-xs font-mono rounded-lg px-3 py-2 w-24 text-text-title font-bold focus:outline-none" 
              min="7" max="365"
            />
            <button 
              type="button"
              onClick={() => {
                if(confirm("Are you sure you want to run database maintenance and drop old telemetry records?")) {
                  purgeMutation.mutate();
                }
              }}
              className="px-4 py-2 border border-status-error/20 hover:border-status-error/40 text-status-error bg-status-error-bg/10 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            >
              {purgeMutation.isPending ? "Executing Maintenance..." : "Purge Telemetry Metrics Now"}
            </button>
          </div>
        </div>
        
        {purgeMutation.isSuccess && (
          <div className="text-xs font-semibold text-status-success bg-status-success-bg/20 border border-status-success/20 p-3 rounded-lg animate-fadeIn">
            ✓ Database optimization sequence finished! Old metrics dropped successfully.
          </div>
        )}
      </div>
    </div>
  );
}

export default SettingsWorkspace;