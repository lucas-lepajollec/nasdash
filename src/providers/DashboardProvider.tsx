'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DashboardConfig, Category, Service, Device, DockerActionConfig, LocalCalendarEvent } from '@/lib/types';
import { sanitizeCustomCss } from '@/lib/sanitizeCss';
import { AuthContext } from './AuthProvider';
import { fetchPingBatches } from '@/lib/pingBatches';

export interface DashboardContextType {
  config: DashboardConfig | null;
  loading: boolean;
  refresh: () => Promise<void>;
  showSecretSections: boolean;
  setShowSecretSections: React.Dispatch<React.SetStateAction<boolean>>;
  addCategory: (title: string, emoji: string, isSecret?: boolean, layout?: Category['layout']) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  addService: (categoryId: string, service: Omit<Service, 'id'>) => Promise<void>;
  updateService: (id: string, updates: Partial<Service>) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  saveCategories: (newCategories: Category[]) => Promise<void>;
  addSlot: () => Promise<void>;
  addWidgetsSlot: () => Promise<void>;
  removeSlot: (slotId: number) => Promise<void>;
  addDevice: (device: Omit<Device, 'id'>) => Promise<void>;
  reorderDevices: (newDevices: Device[]) => Promise<void>;
  updateDevice: (id: string, updates: Partial<Device>) => Promise<void>;
  deleteDevice: (id: string) => Promise<void>;
  updateConfig: (updates: DashboardConfigUpdate) => Promise<void>;
  updateHomeWidgetProps: (widgetId: string, newProps: Record<string, unknown>) => Promise<void>;
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
  pingResults: Record<string, { status: string; statusText: string; latency: number }>;
}

export type DashboardConfigUpdate = { type?: string } & Record<string, unknown>;

export const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const auth = useContext(AuthContext);
  const fetchWithAuth = auth?.fetchWithAuth || fetch;
  const user = auth?.user || null;
  const authLoading = auth?.authLoading ?? true;

  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [pingResults, setPingResults] = useState<Record<string, { status: string; statusText: string; latency: number }>>({});
  const [showSecretSections, setShowSecretSections] = useState(false);
  const [activeBgUrl, setActiveBgUrl] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [bgStyle, setBgStyle] = useState({ top: '-10vh', height: '120vh' });

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
    const activeRadius = (isMobile && config.settings?.mobileBorderRadius !== undefined) ? config.settings.mobileBorderRadius : config.settings?.borderRadius;
    const activeOpacity = (isMobile && config.settings?.mobileCardOpacity !== undefined) ? config.settings.mobileCardOpacity : config.settings?.cardOpacity;
    const activeFont = (isMobile && config.settings?.mobileGlobalFont) ? config.settings.mobileGlobalFont : config.settings?.globalFont;
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

  // Effectuer un ping global groupé toutes les 30 secondes pour économiser les sockets du navigateur
  useEffect(() => {
    if (!config) return;

    // Si en mode privé et non connecté, ne rien faire
    const securityMode = config.settings?.securityMode || 'public';
    if (securityMode === 'private' && !user) return;

    const urlsToPing = new Set<string>();

    config.categories?.forEach((cat) => {
      cat.services?.forEach((svc) => {
        if (svc.localUrl) urlsToPing.add(svc.localUrl);
        if (svc.secondaryUrl) urlsToPing.add(svc.secondaryUrl);
      });
    });

    const urlsArray = Array.from(urlsToPing);
    if (urlsArray.length === 0) return;

    let cancelled = false;
    let nextRun: ReturnType<typeof setTimeout> | undefined;

    const runBatchPing = async () => {
      try {
        const results = await fetchPingBatches(urlsArray);
        if (!cancelled) setPingResults(results);
      } catch (err) {
        console.error('Failed to run batch ping:', err);
      } finally {
        if (!cancelled) nextRun = setTimeout(runBatchPing, 30000);
      }
    };

    runBatchPing();
    return () => {
      cancelled = true;
      if (nextRun) clearTimeout(nextRun);
    };
  }, [config, user]);

  // API operations
  const assertApiOk = async (response: Response, fallback: string) => {
    if (response.ok) return;
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || `${fallback} (${response.status}).`);
  };

  const addCategory = async (title: string, emoji: string, isSecret = false, layout?: Category['layout']) => {
    const res = await fetchWithAuth('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'category', title, emoji, isSecret, layout }),
    });
    await assertApiOk(res, 'Impossible d’ajouter la catégorie');
    await fetchConfig();
  };

  const updateCategory = async (id: string, updates: Partial<Category>) => {
    const res = await fetchWithAuth('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'category', id, ...updates }),
    });
    await assertApiOk(res, 'Impossible de modifier la catégorie');
    await fetchConfig();
  };

  const deleteCategory = async (id: string) => {
    const res = await fetchWithAuth(`/api/config?type=category&id=${id}`, { method: 'DELETE' });
    await assertApiOk(res, 'Impossible de supprimer la catégorie');
    await fetchConfig();
  };

  const addService = async (categoryId: string, service: Omit<Service, 'id'>) => {
    const res = await fetchWithAuth('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'service', categoryId, ...service }),
    });
    await assertApiOk(res, 'Impossible d’ajouter le service');
    await fetchConfig();
  };

  const updateService = async (id: string, updates: Partial<Service>) => {
    const res = await fetchWithAuth('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'service', id, ...updates }),
    });
    await assertApiOk(res, 'Impossible de modifier le service');
    await fetchConfig();
  };

  const deleteService = async (id: string) => {
    const res = await fetchWithAuth(`/api/config?type=service&id=${id}`, { method: 'DELETE' });
    await assertApiOk(res, 'Impossible de supprimer le service');
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

  const addSlot = async () => {
    if (!config) return;
    const currentSlots = config.settings.totalSlots || Math.max(12, config.categories.length);
    setConfig(prev => prev ? { ...prev, settings: { ...prev.settings, totalSlots: currentSlots + 1 } } : prev);
    await fetchWithAuth('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'settings', totalSlots: currentSlots + 1 }),
    });
  };

  const addWidgetsSlot = async () => {
    if (!config) return;
    const currentSlots = config.settings.widgetsTotalSlots || config.settings.widgetsOrder?.length || 5;
    const newGrid = [...(config.settings.widgetsOrder || [])];
    newGrid.push(`empty-${Math.random().toString(36).substr(2, 9)}`);

    setConfig(prev => prev ? {
      ...prev,
      settings: { ...prev.settings, widgetsTotalSlots: currentSlots + 1, widgetsOrder: newGrid }
    } : prev);

    await fetchWithAuth('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'settings', widgetsTotalSlots: currentSlots + 1, widgetsOrder: newGrid }),
    });
  };

  const removeSlot = async (slotId: number) => {
    if (!config) return;
    const currentSlots = config.settings.totalSlots || Math.max(12, config.categories.length);
    const newTotalSlots = Math.max(1, currentSlots - 1);
    const newCategories = config.categories.map(c => {
      if (c.order > slotId) return { ...c, order: c.order - 1 };
      return c;
    });

    setConfig(prev => prev ? {
      ...prev,
      settings: { ...prev.settings, totalSlots: newTotalSlots },
      categories: newCategories
    } : prev);

    await fetchWithAuth('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'settings', totalSlots: newTotalSlots }),
    });

    await fetchWithAuth('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'reorder', categories: newCategories }),
    });
  };

  const addDevice = async (device: Omit<Device, 'id'>) => {
    const res = await fetchWithAuth('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'device', ...device }),
    });
    await assertApiOk(res, 'Impossible d’ajouter l’appareil');
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
    await assertApiOk(res, 'Impossible de modifier l’appareil');
    await fetchConfig();
  };

  const deleteDevice = async (id: string) => {
    const res = await fetchWithAuth(`/api/config?type=device&id=${id}`, { method: 'DELETE' });
    await assertApiOk(res, 'Impossible de supprimer l’appareil');
    await fetchConfig();
  };

  const updateHomeWidgetProps = async (widgetId: string, newProps: Record<string, unknown>) => {
    setConfig(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        settings: {
          ...prev.settings,
          homeWidgets: prev.settings.homeWidgets?.map(w => w.id === widgetId ? { ...w, props: { ...w.props, ...newProps } } : w) || []
        }
      };
    });

    const res = await fetchWithAuth('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'homeWidgetProps', id: widgetId, props: newProps }),
    });
    if (res.status === 429) {
      setLoading(false);
      return;
    }
    if (!res.ok) await fetchConfig();
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
        throw new Error(payload?.error || `Échec de sauvegarde de la configuration (${response.status}).`);
      }
    } catch (err) {
      console.warn('Failed to persist config update:', err);
      // The UI updates optimistically. Restore the last persisted state when
      // validation, authentication, persistence or the network rejects it.
      await fetchConfig();
    }
  };

  const uploadLogo = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetchWithAuth('/api/upload', { method: 'POST', body: formData });
    await assertApiOk(res, 'Impossible d’importer le logo');
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
        addSlot,
        addWidgetsSlot,
        removeSlot,
        addDevice,
        reorderDevices,
        updateDevice,
        deleteDevice,
        updateConfig,
        updateHomeWidgetProps,
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
      {config?.settings?.customCss && (
        <style dangerouslySetInnerHTML={{ __html: sanitizeCustomCss(config.settings.customCss) }} />
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
