'use client';

import { useEffect, useState } from 'react';

/** Devices of the saved Tailscale/Headscale connection, refreshed every minute. Shared by both widget versions. */
export function useTailscaleDevices(isVisible: boolean) {
  const [devices, setDevices] = useState<any[] | null>(null);
  const [error, setError] = useState(false);
  const [unconfigured, setUnconfigured] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isVisible) return;
    const fetchDevices = async () => {
      try {
        const res = await fetch('/api/tailscale');
        const data = await res.json();
        if (data.unconfigured) {
          setUnconfigured(true);
          setError(false);
        } else if (data.error) {
          setError(true);
          setUnconfigured(false);
        } else {
          setDevices(data.devices || []);
          setUnconfigured(false);
          setError(false);
        }
      } catch {
        setError(true);
        setUnconfigured(false);
      } finally {
        setLoading(false);
      }
    };
    fetchDevices();
    const interval = setInterval(fetchDevices, 60000);
    return () => clearInterval(interval);
  }, [isVisible]);

  return { devices, error, unconfigured, loading };
}
