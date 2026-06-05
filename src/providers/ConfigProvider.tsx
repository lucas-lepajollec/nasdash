'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DashboardConfig, Category, Service, Device } from '@/lib/types';

interface ConfigContextType {
  config: DashboardConfig | null;
  loading: boolean;
  refresh: () => Promise<void>;
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
  updateConfig: (updates: any) => Promise<void>;
  uploadLogo: (file: File) => Promise<string>;
  
  // Docker Actions
  addDockerAction: (action: any) => Promise<void>;
  updateDockerAction: (id: string, updates: any) => Promise<void>;
  deleteDockerAction: (id: string) => Promise<void>;
  reorderDockerActions: (newActions: any[]) => Promise<void>;

  // Local Events
  addLocalEvent: (event: Omit<any, 'id'>) => Promise<void>;
  updateLocalEvent: (id: string, updates: any) => Promise<void>;
  deleteLocalEvent: (id: string) => Promise<void>;

  // Shared Modal States
  serviceModal: { open: boolean; service?: Service; categoryId?: string };
  setServiceModal: (state: { open: boolean; service?: Service; categoryId?: string }) => void;
  categoryModal: { open: boolean; category?: Category };
  setCategoryModal: (state: { open: boolean; category?: Category }) => void;
  deviceModal: { open: boolean; device?: Device };
  setDeviceModal: (state: { open: boolean; device?: Device }) => void;
  dockerActionModal: { open: boolean; action?: any };
  setDockerActionModal: (state: { open: boolean; action?: any }) => void;
  settingsModal: { open: boolean; targetTab?: string; targetCustomTabId?: string };
  setSettingsModal: (state: { open: boolean; targetTab?: string; targetCustomTabId?: string }) => void;

  calendarEventModal: { open: boolean; date?: string; events?: any[] };
  setCalendarEventModal: (state: { open: boolean; date?: string; events?: any[] }) => void;
  viewEventModal: { open: boolean; event?: any };
  setViewEventModal: (state: { open: boolean; event?: any }) => void;
}

export const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeBgUrl, setActiveBgUrl] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [bgStyle, setBgStyle] = useState({ top: '-10vh', height: '120vh' });

  useEffect(() => {
    if (window.innerWidth <= 768) {
      // Use screen.height to get a stable value that doesn't change
      // when the mobile browser address bar appears/disappears
      const h = window.screen.height;
      setBgStyle({
        top: `-${h * 0.1}px`,
        height: `${h * 1.2}px`
      });
    }
  }, []);

  // Modals
  const [serviceModal, setServiceModal] = useState<{
    open: boolean;
    service?: Service;
    categoryId?: string;
  }>({ open: false });
  const [categoryModal, setCategoryModal] = useState<{
    open: boolean;
    category?: Category;
  }>({ open: false });
  const [deviceModal, setDeviceModal] = useState<{
    open: boolean;
    device?: Device;
  }>({ open: false });
  const [dockerActionModal, setDockerActionModal] = useState<{
    open: boolean;
    action?: any;
  }>({ open: false });
  const [settingsModal, setSettingsModal] = useState<{
    open: boolean;
    targetTab?: string;
    targetCustomTabId?: string;
  }>({ open: false });

  const [calendarEventModal, setCalendarEventModal] = useState<{
    open: boolean;
    date?: string;
    events?: any[];
  }>({ open: false });
  const [viewEventModal, setViewEventModal] = useState<{
    open: boolean;
    event?: any;
  }>({ open: false });

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      if (!data.devices) data.devices = [];
      setConfig(data);
    } catch (err) {
      console.error('Failed to fetch config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (!config) return;

    // Determine current values (with mobile overrides)
    const activeTheme = (isMobile && config.settings?.mobileTheme) ? config.settings.mobileTheme : (config.settings?.theme || 'nasdash');
    const activeRadius = (isMobile && config.settings?.mobileBorderRadius !== undefined) ? config.settings.mobileBorderRadius : config.settings?.borderRadius;
    const activeOpacity = (isMobile && config.settings?.mobileCardOpacity !== undefined) ? config.settings.mobileCardOpacity : config.settings?.cardOpacity;
    const activeFont = (isMobile && config.settings?.mobileGlobalFont) ? config.settings.mobileGlobalFont : config.settings?.globalFont;
    const activeBg = (isMobile && config.settings?.mobileWallpaper) ? config.settings.mobileWallpaper : (config.settings?.backgroundImage || '');
    
    setActiveBgUrl(activeBg);
    
    // Clean up legacy inline styles if they exist
    document.body.style.backgroundImage = '';
    document.body.style.backgroundSize = '';
    document.body.style.backgroundAttachment = '';
    document.body.style.backgroundPosition = '';
    document.body.style.backgroundRepeat = '';

    // Apply active theme
    const themeClasses = Array.from(document.body.classList).filter(cls => cls.startsWith('theme-'));
    themeClasses.forEach(cls => document.body.classList.remove(cls));
    
    if (activeTheme !== 'nasdash') {
      document.body.classList.add(`theme-${activeTheme}`);
      // Force remove light mode for other themes
      if (document.body.classList.contains('light')) {
        document.body.classList.remove('light');
        localStorage.setItem('nd-theme', 'dark');
      }
    }

    // Apply Border Radius
    if (activeRadius !== undefined) {
      document.body.style.setProperty('--nd-card-radius', `${activeRadius}px`);
    } else {
      document.body.style.removeProperty('--nd-card-radius');
    }

    // Apply Card Opacity
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

    // Dynamic Google Font Injection
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

  const addCategory = async (title: string, emoji: string, isSecret = false, layout?: Category['layout']) => {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'category', title, emoji, isSecret, layout }),
    });
    if (res.ok) await fetchConfig();
  };

  const updateCategory = async (id: string, updates: Partial<Category>) => {
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'category', id, ...updates }),
    });
    if (res.ok) await fetchConfig();
  };

  const deleteCategory = async (id: string) => {
    const res = await fetch(`/api/config?type=category&id=${id}`, { method: 'DELETE' });
    if (res.ok) await fetchConfig();
  };

  const addService = async (categoryId: string, service: Omit<Service, 'id'>) => {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'service', categoryId, ...service }),
    });
    if (res.ok) await fetchConfig();
  };

  const updateService = async (id: string, updates: Partial<Service>) => {
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'service', id, ...updates }),
    });
    if (res.ok) await fetchConfig();
  };

  const deleteService = async (id: string) => {
    const res = await fetch(`/api/config?type=service&id=${id}`, { method: 'DELETE' });
    if (res.ok) await fetchConfig();
  };

  const saveCategories = async (newCategories: Category[]) => {
    if (!config) return;
    setConfig(prev => prev ? { ...prev, categories: newCategories } : prev);
    const res = await fetch('/api/config', {
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
    await fetch('/api/config', {
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

    await fetch('/api/config', {
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

    await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'settings', totalSlots: newTotalSlots }),
    });

    await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'reorder', categories: newCategories }),
    });
  };

  const addDevice = async (device: Omit<Device, 'id'>) => {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'device', ...device }),
    });
    if (res.ok) await fetchConfig();
  };

  const reorderDevices = async (newDevices: Device[]) => {
    if (!config) return;
    setConfig(prev => prev ? { ...prev, devices: newDevices } : prev);
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'reorderDevices', devices: newDevices }),
    });
    if (!res.ok) await fetchConfig();
  };

  const updateDevice = async (id: string, updates: Partial<Device>) => {
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'device', id, ...updates }),
    });
    if (res.ok) await fetchConfig();
  };

  const deleteDevice = async (id: string) => {
    const res = await fetch(`/api/config?type=device&id=${id}`, { method: 'DELETE' });
    if (res.ok) await fetchConfig();
  };

  const updateConfig = async (updates: any) => {
    setConfig(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        settings: {
          ...prev.settings,
          ...updates
        }
      };
    });

    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'settings', ...updates }),
    });
    // We still fetch to ensure server state is perfectly synced, but the local update above prevents UI flicker
    if (res.ok) {
      await fetchConfig();
    } else {
      await fetchConfig(); // Revert on error
    }
  };

  const uploadLogo = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    return data.url;
  };

  const addDockerAction = async (action: any) => {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'dockerAction', ...action }),
    });
    if (res.ok) await fetchConfig();
  };

  const updateDockerAction = async (id: string, updates: any) => {
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'dockerAction', id, ...updates }),
    });
    if (res.ok) await fetchConfig();
  };

  const deleteDockerAction = async (id: string) => {
    const res = await fetch(`/api/config?type=dockerAction&id=${id}`, { method: 'DELETE' });
    if (res.ok) await fetchConfig();
  };

  const reorderDockerActions = async (newActions: any[]) => {
    if (!config) return;
    setConfig(prev => prev ? { ...prev, dockerActions: newActions } : prev);
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'reorderDockerActions', dockerActions: newActions }),
    });
    if (!res.ok) await fetchConfig();
  };

  const addLocalEvent = async (event: Omit<any, 'id'>) => {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'localEvent', ...event }),
    });
    if (res.ok) await fetchConfig();
  };

  const updateLocalEvent = async (id: string, updates: any) => {
    const res = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'localEvent', id, ...updates }),
    });
    if (res.ok) await fetchConfig();
  };

  const deleteLocalEvent = async (id: string) => {
    const res = await fetch(`/api/config?type=localEvent&id=${id}`, { method: 'DELETE' });
    if (res.ok) await fetchConfig();
  };

  const value: any = {
    config,
    loading,
    refresh: fetchConfig,
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
    uploadLogo,
    addDockerAction,
    updateDockerAction,
    deleteDockerAction,
    reorderDockerActions,
    addLocalEvent,
    updateLocalEvent,
    deleteLocalEvent,
    serviceModal,
    setServiceModal,
    categoryModal,
    setCategoryModal,
    deviceModal,
    setDeviceModal,
    dockerActionModal,
    setDockerActionModal,
    settingsModal,
    setSettingsModal,

    calendarEventModal,
    setCalendarEventModal,
    viewEventModal,
    setViewEventModal,
  };

  return (
    <ConfigContext.Provider value={value}>
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
        <style dangerouslySetInnerHTML={{ __html: config.settings.customCss }} />
      )}
      {children}
    </ConfigContext.Provider>
  );
}
