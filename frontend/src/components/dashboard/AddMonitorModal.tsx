"use client";

import React, { useState } from "react";
import { useCreateMonitor } from "@/hooks/useMonitors";

interface AddMonitorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddMonitorModal({ isOpen, onClose }: AddMonitorModalProps) {
  const createMonitorMutation = useCreateMonitor();
  
  // Local form tracking states
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [interval, setInterval] = useState(60);
  const [formError, setFormError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    // Basic structural data assertions
    if (!name.trim() || !url.trim()) {
      setFormError("All identity field properties are required.");
      return;
    }

    try {
      await createMonitorMutation.mutateAsync({
        name: name.trim(),
        url: url.trim(),
        check_interval: Number(interval),
      });
      
      // Clean up local layout inputs upon complete execution success
      setName("");
      setUrl("");
      setInterval(60);
      onClose();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || "Failed to commit target tracking parameters.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-xl border border-border-muted bg-card-surface p-6 shadow-xl animate-scale-up">
        
        <div className="flex items-center justify-between border-b border-border-muted pb-4">
          <div>
            <h3 className="text-base font-bold text-text-title">Add Infrastructure Monitor</h3>
            <p className="text-xs text-text-muted">Register a new target pipeline check configuration</p>
          </div>
          <button 
            onClick={onClose} 
            className="rounded-lg p-1 text-text-muted hover:bg-canvas hover:text-text-title transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          {formError && (
            <div className="rounded-lg bg-status-error-bg border border-status-error/10 p-3 text-xs font-medium text-status-error">
              {formError}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Monitor Friendly Name</label>
            <input
              type="text"
              placeholder="e.g., Auth Microservice Edge"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border-muted bg-canvas px-3 py-2 text-sm text-text-title placeholder:text-text-muted/50 focus:border-text-title focus:outline-none transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Target Connection URL / Endpoint</label>
            <input
              type="text"
              placeholder="https://api.yourdomain.com/health"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-lg border border-border-muted bg-canvas px-3 py-2 text-sm font-mono text-text-title placeholder:text-text-muted/50 focus:border-text-title focus:outline-none transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wider">Evaluation Frequency Interval</label>
            <select
              value={interval}
              onChange={(e) => setInterval(Number(e.target.value))}
              className="w-full rounded-lg border border-border-muted bg-canvas px-3 py-2 text-sm text-text-title focus:border-text-title focus:outline-none transition-colors"
            >
              <option value={30}>Every 30 Seconds</option>
              <option value={60}>Every 1 Minute</option>
              <option value={300}>Every 5 Minutes</option>
              <option value={900}>Every 15 Minutes</option>
            </select>
          </div>

          <div className="mt-2 flex items-center justify-end gap-3 border-t border-border-muted pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-text-muted hover:bg-canvas hover:text-text-title transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMonitorMutation.isPending}
              className="rounded-lg bg-text-title px-4 py-2 text-sm font-semibold text-card-surface hover:bg-text-title/90 disabled:opacity-50 transition-colors shadow-sm"
            >
              {createMonitorMutation.isPending ? "Provisioning..." : "Deploy Monitor"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}