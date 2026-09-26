'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { applySoftEdges } from '@/lib/appearance';
import { DashboardConfig, Category, Service, Device, DockerActionConfig, LocalCalendarEvent, type IntegrationInstance } from '@/lib/types';
import { isCustomCssSafeMode, sanitizeCustomCss } from '@/lib/sanitizeCss';
import { AuthContext } from './AuthProvider';
import { fetchPingBatches } from '@/lib/pingBatches';
import { taskSettings } from '@/lib/tasks';
import { useI18n } from '@/i18n/I18nProvider';

export interface DashboardContextType {
  config: DashboardConfig | null;
  loading: boolean;
  refresh: () => Promise<void>;
  showSecretSections: boolean;
  setShowSecretSections: React.Dispatch<React.SetStateAction<boolean>>;
  /** Resolves with the created category so a view of it can be placed on a page. */
  addCategory: (title: string, emoji: string, isSecret?: boolean, layout?: Category['layout']) => Promise<Category | null>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  addService: (categoryId: string, service: Omit<Service, 'id'>) => Promise<void>;
  updateService: (id: string, updates: Partial<Service>) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  saveCategories: (newCategories: Category[]) => Promise<void>;
  addDevice: (device: Omit<Device, 'id'>) => Promise<void>;
  reorderDevices: (newDevices: Device[]) => Promise<void>;
  updateDevice: (id: string, updates: Partial<Device>) => Promise<void>;
  deleteDevice: (id: string) => Promise<void>;
  updateConfig: (updates: DashboardConfigUpdate) => Promise<boolean>;
  /** Saves one service connection (`config.integrations`); empty or masked secrets are kept. */
  /** Saves a connection and returns it (secrets masked). */
  saveIntegration: (update: IntegrationUpdate) => Promise<IntegrationInstance>;
  deleteIntegration: (id: string) => Promise<void>;
  uploadLogo: (file: File) => Promise<string>;
  
  // Docker Actions
  addDockerAction: (action: Omit<DockerActionConfig, 'id'>) => Promise<void>;
  updateDockerAction: (id: string, updates: Partial<DockerActionConfig>) => Promise<void>;
  deleteDockerAction: (id: string) => Promise<void>;
  reorderDockerActions: (newActions: DockerActionConfig[]) => Promise<void>;

  // Local Events
  addLocalEvent: (event: Omit<LocalCalendarEvent, 'id'>) => Promise<void>;
  updateLocalEvent: (id: string, updates: Partial<LocalCalendarEvent>) => Promise<void>;
  deleteLocalEvent: (id: string) => Promise<void>;
  pingResults: Record<string, { status: string; statusText: string; latency: number; selfSigned?: boolean }>;
}

export type DashboardConfigUpdate = { type?: string } & Record<string, unknown>;

export interface IntegrationUpdate {
  id?: string;
  type: string;
  name?: string;
  settings?: Record<string, string>;
  secrets?: Record<string, string | null>;
}

export const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const auth = useContext(AuthContext);
  const fetchWithAuth = auth?.fetchWithAuth || fetch;
  const user = auth?.user || null;
  const authLoading = auth?.authLoading ?? true;

  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [pingResults, setPingResults] = useState<Record<string, { status: string; statusText: string; latency: number; selfSigned?: boolean }>>({});
  const [showSecretSections, setShowSecretSections] = useState(false);
  const [activeBgUrl, setActiveBgUrl] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [bgStyle, setBgStyle] = useState({ top: '-10vh', height: '120vh' });
  const customCssSafeMode = typeof window === 'undefined' || isCustomCssSafeMode(window.location.search);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('nd-theme-preset');
      if (savedTheme && savedTheme !== 'nasdash') {
        document.body.classList.add(`theme-${savedTheme}`);
        if (document.body.classList.contains('light')) {
          document.body.classList.remove('light');
          localStorage.setItem('nd-theme', 'dark');
        }
      }
      const savedBg = localStorage.getItem('nd-bg-preset');
      if (savedBg) {
        setActiveBgUrl(savedBg);
      }
    }
  }, []);

  useEffect(() => {
    if (user?.role !== 'admin') {
      setShowSecretSections(false);
    }
  }, [user]);

  const fetchConfig = useCallback(async (retryCount = 0) => {
    try {
      const res = await fetch('/api/config');
      if (res.status === 401) {
        const isLoginPage = window.location.pathname === '/login';
        if (!isLoginPage) {
          // A full reload prevents stale dashboard state surviving a rejected session.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        }
        return;
      }
      if (res.status === 429) {
        setLoading(false);
        return;
      }
      if (!res.ok) {
        throw new Error(`Failed to fetch config: ${res.status}`);
      }
      const data = await res.json();
      if (!data.devices) data.devices = [];
      setConfig(data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch config:', err);
      if (retryCount < 3) {
        setTimeout(() => fetchConfig(retryCount + 1), 500);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Redirection automatique vers /login en mode privé si non authentifié
  useEffect(() => {
    if (loading || authLoading || !config) return;
    
    const securityMode = config.settings?.securityMode || 'public';
    const isLoginPage = window.location.pathname === '/login';
    
    if (securityMode === 'private' && !user && !isLoginPage) {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }, [config, user, loading, authLoading]);

  // Custom CSS, fonts, and background themes injection
  useEffect(() => {
    if (!config) return;

    const activeTheme = (isMobile && config.settings?.mobileTheme) ? config.settings.mobileTheme : (config.settings?.theme || 'nasdash');
    // Values equal to the historical defaults (written into every
    // configuration by config.example.json) count as "not customised", so the
    // interface's own radius, opacity and font show. Values the user actually
    // chose still win.
    const custom = <T,>(value: T | undefined, legacyDefault: T): T | undefined => (value === legacyDefault ? undefined : value);
    const activeRadius = custom((isMobile && config.settings?.mobileBorderRadius !== undefined) ? config.settings.mobileBorderRadius : config.settings?.borderRadius, 12);
    const activeOpacity = custom((isMobile && config.settings?.mobileCardOpacity !== undefined) ? config.settings.mobileCardOpacity : config.settings?.cardOpacity, 0.8);
    const activeFont = custom((isMobile && config.settings?.mobileGlobalFont) ? config.settings.mobileGlobalFont : config.settings?.globalFont, 'Outfit');
    const activeBg = (isMobile && config.settings?.mobileWallpaper) ? config.settings.mobileWallpaper : (config.settings?.backgroundImage || '');
    
    setActiveBgUrl(activeBg);
    if (typeof window !== 'undefined') {
      localStorage.setItem('nd-theme-preset', activeTheme);
      if (activeBg) {
        localStorage.setItem('nd-bg-preset', activeBg);
      } else {
        localStorage.removeItem('nd-bg-preset');
      }
    }
    
    if (activeBg) {
      document.body.style.backgroundColor = 'transparent';
    } else {
      document.body.style.backgroundColor = '';
    }
    document.body.style.backgroundImage = '';
    document.body.style.backgroundSize = '';
    document.body.style.backgroundAttachment = '';
    document.body.style.backgroundPosition = '';
    document.body.style.backgroundRepeat = '';

    const LIGHT_THEMES = ['apple-light', 'github-light', 'rose-pine-dawn', 'solarized-light', 'catppuccin-latte', 'everforest-light', 'tokyo-night-day', 'gruvbox-light', 'nord-light', 'light'];
    const activeMode = config?.settings?.mode || (typeof window !== 'undefined' ? localStorage.getItem('nd-theme') : 'dark');
    const isLightTheme = LIGHT_THEMES.includes(activeTheme) || (activeTheme === 'nasdash' && activeMode === 'light');

    const themeClasses = Array.from(document.body.classList).filter(cls => cls.startsWith('theme-'));
    themeClasses.forEach(cls => document.body.classList.remove(cls));
    
    if (activeTheme !== 'nasdash') {
      document.body.classList.add(`theme-${activeTheme}`);
    }

    if (isLightTheme) {
      document.body.classList.add('light');
      localStorage.setItem('nd-theme', 'light');
    } else {
      document.body.classList.remove('light');
      localStorage.setItem('nd-theme', 'dark');
    }

    // Outlines and background blur of surfaces (Appearance).
    if (config.settings?.hideOutlines) document.body.setAttribute('data-outlines', 'off');
    else document.body.removeAttribute('data-outlines');
    const blur = config.settings?.surfaceBlur ?? 0;
    if (blur > 0) {
      document.body.style.setProperty('--nd-surface-blur', `${blur}px`);
      document.body.setAttribute('data-blur', 'on');
    } else {
      document.body.style.removeProperty('--nd-surface-blur');
      document.body.removeAttribute('data-blur');
    }

    applySoftEdges(config.settings?.softEdges ?? 0);

    // Accent colour chosen in Appearance; otherwise the theme's own accent.
    const accent = config.settings?.accentColor;
    if (accent && /^#[0-9a-f]{6}$/i.test(accent)) {
      document.body.style.setProperty('--nd-accent', accent);
      document.body.style.setProperty('--nd-accent-glow', `color-mix(in srgb, ${accent} 14%, transparent)`);
      document.body.style.setProperty('--nd-accent-dim', `color-mix(in srgb, ${accent} 50%, transparent)`);
    } else {
      ['--nd-accent', '--nd-accent-glow', '--nd-accent-dim'].forEach(name => document.body.style.removeProperty(name));
    }

    if (activeRadius !== undefined) {
      document.body.style.setProperty('--nd-card-radius', `${activeRadius}px`);
    } else {
      document.body.style.removeProperty('--nd-card-radius');
    }

    if (activeOpacity !== undefined) {
      document.body.style.setProperty('--nd-card-bg-opacity', String(activeOpacity));
      requestAnimationFrame(() => {
        const rgb = getComputedStyle(document.body).getPropertyValue('--nd-card-bg-rgb').trim();
        if (rgb) {
          document.body.style.setProperty('--nd-card-bg', `rgba(${rgb}, ${activeOpacity})`);
        }
      });
    } else {
      document.body.style.removeProperty('--nd-card-bg-opacity');
      document.body.style.removeProperty('--nd-card-bg');
    }

    const fontId = 'dynamic-google-font';
    let linkEl = document.getElementById(fontId) as HTMLLinkElement | null;
    if (activeFont) {
      if (!linkEl) {
        linkEl = document.createElement('link');
        linkEl.id = fontId;
        linkEl.rel = 'stylesheet';
        document.head.appendChild(linkEl);
      }
      const encodedFont = encodeURIComponent(activeFont);
      linkEl.href = `https://fonts.googleapis.com/css2?family=${encodedFont}:wght@300;400;500;600;700;800&display=swap`;
      document.body.style.fontFamily = `"${activeFont}", sans-serif`;
    } else {
      if (linkEl) linkEl.remove();
      document.body.style.fontFamily = '';
    }
  }, [config, isMobile]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (window.innerWidth <= 768) {
      const h = window.screen.height;
      setBgStyle({
        top: `-${h * 0.1}px`,
        height: `${h * 1.2}px`
      });
    }
  }, []);

  // Addresses to ping, as a stable key: saving an unrelated setting (theme,
  // blur…) no longer restarts every ping.
  const securityMode = config?.settings?.securityMode || 'public';
  const pingKey = React.useMemo(() => {
    const urls = new Set<string>();
    config?.categories?.forEach(cat => cat.services?.forEach(svc => {
      if (svc.localUrl) urls.add(svc.localUrl);
      if (svc.secondaryUrl) urls.add(svc.secondaryUrl);
    }));
    return Array.from(urls).join('\n');
  }, [config?.categories]);

  // Grouped ping of every service at the rhythm of Settings → Tasks (30 s by
  // default; saves browser sockets), paused while the tab is in the background.
  const pingEveryMs = taskSettings(config).pingSeconds * 1000;
  useEffect(() => {
    if (!pingKey) return;
    // Private mode without a session: nothing to ping.
    if (securityMode === 'private' && !user) return;
    const urlsArray = pingKey.split('\n');

    let cancelled = false;
    let nextRun: ReturnType<typeof setTimeout> | undefined;
    let pending = false;

    const runBatchPing = async () => {
      if (document.visibilityState === 'hidden') { pending = true; return; }
      try {
        const results = await fetchPingBatches(urlsArray);
        if (!cancelled) setPingResults(results);
      } catch (err) {
        console.error('Failed to run batch ping:', err);
      } finally {
        if (!cancelled) nextRun = setTimeout(runBatchPing, pingEveryMs);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && pending && !cancelled) { pending = false; void runBatchPing(); }
    };

    document.addEventListener('visibilitychange', onVisible);
    runBatchPing();
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      if (nextRun) clearTimeout(nextRun);
    };
  }, [pingKey, securityMode, user, pingEveryMs]);

  // API operations
  const assertApiOk = async (response: Response, fallback: string) => {
    if (response.ok) return;
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ? t(payload.error) : `${t(fallback)} (${response.status}).`);
  };

  const addCategory = async (title: string, emoji: string, isSecret = false, layout?: Category['layout']) => {
    const res = await fetchWithAuth('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'category', title, emoji, isSecret, layout }),
    });
    await assertApiOk(res, 'errors.categoryAdd');
    const created = await res.json().catch(() => null) as Category | null;
    await fetchConfig();
    return created && typeof created.id === 'string' ? created : null;
  };

  const updateCategory = async (id: string, updates: Partial<Category>) => {
    const res = await fetchWithAuth('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'category', id, ...updates }),
    });
    await assertApiOk(res, 'errors.categoryUpdate');
    await fetchConfig();
  };

  const deleteCategory = async (id: string) => {
    const res = await fetchWithAuth(`/api/config?type=category&id=${id}`, { method: 'DELETE' });
    await assertApiOk(res, 'errors.categoryDelete');
    await fetchConfig();
  };

  const addService = async (categoryId: string, service: Omit<Service, 'id'>) => {
    const res = await fetchWithAuth('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'service', categoryId, ...service }),
    });
    await assertApiOk(res, 'errors.serviceAdd');
    await fetchConfig();
  };

  const updateService = async (id: string, updates: Partial<Service>) => {
    const res = await fetchWithAuth('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'service', id, ...updates }),
    });
    await assertApiOk(res, 'errors.serviceUpdate');
    await fetchConfig();
  };

  const deleteService = async (id: string) => {
    const res = await fetchWithAuth(`/api/config?type=service&id=${id}`, { method: 'DELETE' });
    await assertApiOk(res, 'errors.serviceDelete');
    await fetchConfig();
  };

  const saveCategories = async (newCategories: Category[]) => {
    if (!config) return;
    setConfig(prev => prev ? { ...prev, categories: newCategories } : prev);
    const res = await fetchWithAuth('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'reorder', categories: newCategories }),
    });
    if (!res.ok) await fetchConfig();
  };

  const addDevice = async (device: Omit<Device, 'id'>) => {
    const res = await fetchWithAuth('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'device', ...device }),
    });
    await assertApiOk(res, 'errors.deviceAdd');
    await fetchConfig();
  };

  const reorderDevices = async (newDevices: Device[]) => {
    if (!config) return;
    setConfig(prev => prev ? { ...prev, devices: newDevices } : prev);
    const res = await fetchWithAuth('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'reorderDevices', devices: newDevices }),
    });
    if (!res.ok) await fetchConfig();
  };

  const updateDevice = async (id: string, updates: Partial<Device>) => {
    const res = await fetchWithAuth('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'device', id, ...updates }),
    });
    await assertApiOk(res, 'errors.deviceUpdate');
    await fetchConfig();
  };

  const deleteDevice = async (id: string) => {
    const res = await fetchWithAuth(`/api/config?type=device&id=${id}`, { method: 'DELETE' });
    await assertApiOk(res, 'errors.deviceDelete');
    await fetchConfig();
  };

  const saveIntegration = async (update: IntegrationUpdate) => {
    const res = await fetchWithAuth('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'integration', integration: update }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error ? t(payload.error) : t('errors.configSave', { status: res.status }));
    }
    const saved = await res.json() as IntegrationInstance;
    await fetchConfig();
    return saved;
  };

  const deleteIntegration = async (id: string) => {
    const res = await fetchWithAuth(`/api/config?type=integration&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    await assertApiOk(res, 'errors.configSave');
    await fetchConfig();
  };

  const updateConfig = async (updates: DashboardConfigUpdate) => {
    setConfig(prev => {
      if (!prev) return prev;
      const next = { ...prev };
      const settingsUpdates: Record<string, unknown> = {};

      Object.keys(updates).forEach(key => {
        if (key === 'type') {
          return;
        }
        if (key === 'appearanceProfiles' || key === 'categories' || key === 'devices' || key === 'dockerHosts' || key === 'dockerActions' || key === 'localEvents') {
          Object.assign(next, { [key]: updates[key] });
        } else {
          settingsUpdates[key] = updates[key];
        }
      });

      next.settings = {
        ...next.settings,
        ...settingsUpdates
      };

      return next;
    });

    try {
      const response = await fetchWithAuth('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'settings', ...updates }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ? t(payload.error) : t('errors.configSave', { status: response.status }));
      }
      return true;
    } catch (err) {
      console.warn('Failed to persist config update:', err);
      // The UI updates optimistically. Restore the last persisted state when
      // validation, authentication, persistence or the network rejects it.
      await fetchConfig();
      return false;
    }
  };

  const uploadLogo = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetchWithAuth('/api/upload', { method: 'POST', body: formData });
    await assertApiOk(res, 'errors.logoUpload');
    const data = await res.json();
    return data.url;
  };

  const addDockerAction = async (action: Omit<DockerActionConfig, 'id'>) => {
    const res = await fetchWithAuth('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'dockerAction', ...action }),
    });
    if (res.ok) await fetchConfig();
  };

  const updateDockerAction = async (id: string, updates: Partial<DockerActionConfig>) => {
    const res = await fetchWithAuth('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'dockerAction', id, ...updates }),
    });
    if (res.ok) await fetchConfig();
  };

  const deleteDockerAction = async (id: string) => {
    const res = await fetchWithAuth(`/api/config?type=dockerAction&id=${id}`, { method: 'DELETE' });
    if (res.ok) await fetchConfig();
  };

  const reorderDockerActions = async (newActions: DockerActionConfig[]) => {
    if (!config) return;
    setConfig(prev => prev ? { ...prev, dockerActions: newActions } : prev);
    const res = await fetchWithAuth('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'reorderDockerActions', dockerActions: newActions }),
    });
    if (!res.ok) await fetchConfig();
  };

  const addLocalEvent = async (event: Omit<LocalCalendarEvent, 'id'>) => {
    const res = await fetchWithAuth('/api/config/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    if (res.ok) await fetchConfig();
  };

  const updateLocalEvent = async (id: string, updates: Partial<LocalCalendarEvent>) => {
    const res = await fetchWithAuth('/api/config/calendar', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    if (res.ok) await fetchConfig();
  };

  const deleteLocalEvent = async (id: string) => {
    const res = await fetchWithAuth(`/api/config/calendar?id=${id}`, { method: 'DELETE' });
    if (res.ok) await fetchConfig();
  };

  return (
    <DashboardContext.Provider
      value={{
        config,
        loading,
        refresh: fetchConfig,
        showSecretSections: user?.role === 'admin' ? showSecretSections : false,
        setShowSecretSections: user?.role === 'admin' ? setShowSecretSections : () => {},
        addCategory,
        updateCategory,
        deleteCategory,
        addService,
        updateService,
        deleteService,
        saveCategories,
        addDevice,
        reorderDevices,
        updateDevice,
        deleteDevice,
        updateConfig,
        saveIntegration,
        deleteIntegration,
        uploadLogo,
        addDockerAction,
        updateDockerAction,
        deleteDockerAction,
        reorderDockerActions,
        addLocalEvent,
        updateLocalEvent,
        deleteLocalEvent,
        pingResults
      }}
    >
      <div 
        style={{
          position: 'fixed',
          top: bgStyle.top,
          left: '-10vw',
          width: '120vw',
          height: bgStyle.height,
          zIndex: -1,
          backgroundColor: 'var(--nd-bg)',
          backgroundImage: activeBgUrl ? `url("${activeBgUrl}")` : 'var(--nd-bg-gradient)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          pointerEvents: 'none',
        }}
      />
      {!customCssSafeMode && config?.settings?.customCss && (
        <style>{sanitizeCustomCss(config.settings.customCss)}</style>
      )}
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}

