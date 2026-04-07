'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

interface HermesStatus {
  container: {
    state: string;
    running: boolean;
    startedAt?: string;
    image?: string;
    uptime?: number;
  } | null;
  api: { online: boolean; models?: any } | null;
  configured: boolean;
}

interface HermesConfig {
  config: Record<string, any>;
  env: Record<string, string>;
  raw: string;
  configured: boolean;
}

export function useHermesStatus(pollInterval = 15000) {
  const [status, setStatus] = useState<HermesStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/hermes/status');
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, pollInterval);
    return () => clearInterval(interval);
  }, [fetchStatus, pollInterval]);

  return { status, loading, refresh: fetchStatus };
}

export function useHermesConfig() {
  const [config, setConfig] = useState<HermesConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hermes/config');
      const data = await res.json();
      if (res.ok) {
        setConfig(data);
      } else {
        setError(data.error || 'Failed to load config');
      }
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  const saveConfig = useCallback(async (
    configData: Record<string, any>,
    envUpdates?: Record<string, string>
  ) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/hermes/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: configData, envUpdates }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save');
        return false;
      }
      await fetchConfig(); // Refresh
      return true;
    } catch (e: any) {
      setError(e.message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [fetchConfig]);

  const restartContainer = useCallback(async () => {
    try {
      const res = await fetch('/api/hermes/restart', { method: 'POST' });
      const data = await res.json();
      return { ok: res.ok, message: data.message || data.error };
    } catch (e: any) {
      return { ok: false, message: e.message };
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  return { config, loading, saving, error, saveConfig, restartContainer, refresh: fetchConfig };
}
