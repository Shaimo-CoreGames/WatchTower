import { useIntegrations } from "@/hooks/useMonitors";
import { useState } from "react";

function IntegrationWorkspace() {
  const { integrations, isLoading, createMutation, toggleMutation, deleteMutation } = useIntegrations();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [channelType, setChannelType] = useState<"Slack" | "Discord">("Slack");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url) return;
    createMutation.mutate({ name, channel_type: channelType, webhook_url: url }, {
      onSuccess: () => {
        setName("");
        setUrl("");
        setIsFormOpen(false);
      }
    });
  };

  const slackHook = integrations.find(i => i.channel_type === "Slack");
  const discordHook = integrations.find(i => i.channel_type === "Discord");

  return (
    <div className="flex-1 overflow-y-auto space-y-8 max-w-5xl pr-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-title tracking-tight">Notification Integrations</h2>
          <p className="text-xs text-text-muted">Dispatch live telemetry alerts instantly to external dev communication endpoints.</p>
        </div>
        {!isFormOpen && (
          <button 
            onClick={() => setIsFormOpen(true)}
            className="rounded-lg bg-text-title px-3 py-1.5 text-xs font-semibold text-card-surface hover:bg-text-title/90 transition-all shadow-sm"
          >
            + Connect New Channel
          </button>
        )}
      </div>

      {/* CONDITIONAL ADD CONNECTION FORM VIEW DRAWER */}
      {isFormOpen && (
        <form onSubmit={handleSubmit} className="p-5 border border-border-muted bg-card-surface rounded-xl space-y-4 shadow-sm animate-fadeIn">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-title">Configure Notification Endpoint</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase text-text-muted block mb-1">App Channel Type</label>
              <select 
                value={channelType} 
                onChange={(e) => setChannelType(e.target.value as any)}
                className="w-full bg-canvas border border-border-muted text-xs rounded-lg p-2 text-text-title"
              >
                <option value="Slack">💬 Slack Webhook Target</option>
                <option value="Discord">🎮 Discord Bot Endpoint</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-text-muted block mb-1">Configuration Name</label>
              <input 
                type="text" placeholder="e.g., Core Dev Alerts" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full bg-canvas border border-border-muted text-xs rounded-lg p-2 text-text-title font-medium"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-text-muted block mb-1">Webhook Secret URL</label>
              <input 
                type="url" placeholder="https://hooks.slack.com/services/..." value={url} onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-canvas border border-border-muted text-xs rounded-lg p-2 text-text-title font-mono"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 text-xs">
            <button type="button" onClick={() => setIsFormOpen(false)} className="px-3 py-1.5 border border-border-muted rounded-lg text-text-muted font-medium hover:bg-canvas">Cancel</button>
            <button type="submit" className="px-3 py-1.5 bg-text-title text-card-surface font-semibold rounded-lg hover:bg-text-title/90">Save Integration Link</button>
          </div>
        </form>
      )}

      {/* LIVE SYNCED STATUS CARDS DECK */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* DISPATCH SLOT 1: SLACK SYSTEM APP */}
        <div className={`rounded-xl border border-border-muted bg-card-surface p-6 shadow-sm flex flex-col justify-between gap-6 transition-all ${!slackHook && 'opacity-50'}`}>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">💬</span>
                <h3 className="text-sm font-bold text-text-title">Slack Webhooks App</h3>
              </div>
              <p className="text-xs text-text-muted max-w-xs">Stream incidents directly to dedicated internal DevOps channels.</p>
            </div>
            {slackHook ? (
              <button 
                onClick={() => toggleMutation.mutate(slackHook.id)}
                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${slackHook.is_active ? 'bg-status-success-bg text-status-success border-status-success/20' : 'bg-gray-100 text-gray-500 border-gray-300'}`}
              >
                {slackHook.is_active ? "Active" : "Paused"}
              </button>
            ) : (
              <span className="inline-flex items-center rounded-md bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-400 uppercase">Unconfigured</span>
            )}
          </div>

          {slackHook && (
            <div className="space-y-2 animate-fadeIn">
              <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted block">Active Destination Target</label>
              <div className="flex items-center gap-2">
                <input type="password" readOnly value={slackHook.webhook_url} className="bg-canvas border border-border-muted/60 text-xs font-mono rounded-lg px-3 py-2 flex-1 text-text-muted select-none" />
                <button onClick={() => deleteMutation.mutate(slackHook.id)} className="text-xs font-semibold px-3 py-2 rounded-lg border border-border-muted hover:border-status-error/30 text-text-muted hover:text-status-error transition-all">Revoke</button>
              </div>
            </div>
          )}
        </div>

        {/* DISPATCH SLOT 2: DISCORD SYSTEM BOT */}
        <div className={`rounded-xl border border-border-muted bg-card-surface p-6 shadow-sm flex flex-col justify-between gap-6 transition-all ${!discordHook && 'opacity-50'}`}>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎮</span>
                <h3 className="text-sm font-bold text-text-title">Discord Bot Webhook</h3>
              </div>
              <p className="text-xs text-text-muted max-w-xs">Broadcast critical crash alerts directly to discord dev channels.</p>
            </div>
            {discordHook ? (
              <button 
                onClick={() => toggleMutation.mutate(discordHook.id)}
                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${discordHook.is_active ? 'bg-status-success-bg text-status-success border-status-success/20' : 'bg-gray-100 text-gray-500 border-gray-300'}`}
              >
                {discordHook.is_active ? "Active" : "Paused"}
              </button>
            ) : (
              <span className="inline-flex items-center rounded-md bg-gray-100 border border-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-400 uppercase">Unconfigured</span>
            )}
          </div>

          {discordHook ? (
            <div className="space-y-2 animate-fadeIn">
              <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted block">Active Destination Target</label>
              <div className="flex items-center gap-2">
                <input type="password" readOnly value={discordHook.webhook_url} className="bg-canvas border border-border-muted/60 text-xs font-mono rounded-lg px-3 py-2 flex-1 text-text-muted select-none" />
                <button onClick={() => deleteMutation.mutate(discordHook.id)} className="text-xs font-semibold px-3 py-2 rounded-lg border border-border-muted hover:border-status-error/30 text-text-muted hover:text-status-error transition-all">Revoke</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-end">
              <button onClick={() => { setIsFormOpen(true); setChannelType("Discord"); }} className="bg-text-title text-card-surface text-xs font-semibold px-4 py-2 rounded-lg hover:bg-text-title/90 transition-all shadow-sm">Setup Connection</button>
            </div>
          )}
        </div>

      </div>

      {/* STATIC STRUCTURAL SCHEMA REFERENCE PANEL */}
      <div className="rounded-xl border border-border-muted bg-card-surface p-5 shadow-sm space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-text-title">Outgoing Webhook Data Structural Schema</h4>
        <p className="text-xs text-text-muted">WatchTower delivers outbound operational logging events modeled precisely against standard messaging cards:</p>
        <pre className="bg-canvas text-[11px] font-mono p-4 rounded-lg border border-border-muted/50 text-text-title overflow-x-auto select-all">
{`{
  "text": "🚨 *WatchTower Alert Engine Notification*\\n*Target:* Production Auth Server\\n*Event Status:* DOWN\\n*Diagnostic Log:* Status 500 - Internal Connection Error"
}`}
        </pre>
      </div>
    </div>
  );
}

export default IntegrationWorkspace