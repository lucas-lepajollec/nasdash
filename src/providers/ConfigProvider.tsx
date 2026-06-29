'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DashboardConfig, Category, Service, Device } from '@/lib/types';
import { sanitizeCustomCss } from '@/lib/sanitizeCss';

interface ConfigContextType {
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
  updateConfig: (updates: any) => Promise<void>;
  updateHomeWidgetProps: (widgetId: string, newProps: any) => Promise<void>;
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

  // Authentification
  user: { username: string; role: 'admin' | 'viewer'; allowedTabs?: string[]; allowedWidgets?: string[]; isAnonymous?: boolean } | null;
  authLoading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSecretSections, setShowSecretSections] = useState(false);
  const [activeBgUrl, setActiveBgUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('nd-bg-preset') || '';
    }
    return '';
  });
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
    }
  }, []);

  // Authentification
  const [user, setUser] = useState<{ username: string; role: 'admin' | 'viewer'; allowedTabs?: string[]; allowedWidgets?: string[]; isAnonymous?: boolean } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await res.json();
      setUser(data.user);
    } catch (e) {
      console.error('Erreur vérification session:', e);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const logout = async () => {
    try {
      // Fermer l'EventSource de manière proactive pour libérer immédiatement le slot de connexion du navigateur
      if (typeof window !== 'undefined' && (window as any).globalEventSource) {
        try {
          (window as any).globalEventSource.close();
          (window as any).globalEventSource = null;
        } catch {}
      }
      // Attendre la suppression effective du cookie de session
      await fetch('/api/auth/logout', { method: 'POST' });
      
      // Mettre à jour l'état local uniquement après la suppression réussie du cookie
      setUser(null);
      
      // Rediriger vers la page de connexion
      window.location.href = '/login';
    } catch (e) {
      console.error('Erreur déconnexion:', e);
      window.location.href = '/login';
    }
  };

  // Wrapper Fetch avec validation de session (intercepte les codes 401 et 403)
  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
    try {
      const res = await fetch(url, options);
      if (res.status === 401 || res.status === 403) {
        // Alerte et redirection
        alert("Accès refusé. Session administrateur requise.");
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        throw new Error('Unauthorized');
      }
      return res;
    } catch (err) {
      console.error('Erreur Fetch sécurisé:', err);
      throw err;
    }
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

  useEffect(() => {
    if (user?.role !== 'admin') {
      setShowSecretSections(false);
    }
  }, [user]);

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
    fetchUser();
  }, [fetchConfig, fetchUser]);

  // Redirection automatique vers /login en mode privé si non authentifié
  useEffect(() => {
    if (loading || authLoading || !config) return;
    
    const securityMode = config.settings?.securityMode || 'public';
    const isLoginPage = window.location.pathname === '/login';
    
    if (securityMode === 'private' && !user && !isLoginPage) {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }
  }, [config, user, loading, authLoading]);

  useEffect(() => {
    if (!config) return;

    // Determine current values (with mobile overrides)
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
    const res = await fetchWithAuth('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'category', title, emoji, isSecret, layout }),
    });
    if (res.ok) await fetchConfig();
  };

  const updateCategory = async (id: string, updates: Partial<Category>) => {
    const res = await fetchWithAuth('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'category', id, ...updates }),
    });
    if (res.ok) await fetchConfig();
  };

  const deleteCategory = async (id: string) => {
    const res = await fetchWithAuth(`/api/config?type=category&id=${id}`, { method: 'DELETE' });
    if (res.ok) await fetchConfig();
  };

  const addService = async (categoryId: string, service: Omit<Service, 'id'>) => {
    const res = await fetchWithAuth('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'service', categoryId, ...service }),
    });
    if (res.ok) await fetchConfig();
  };

  const updateService = async (id: string, updates: Partial<Service>) => {
    const res = await fetchWithAuth('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'service', id, ...updates }),
    });
    if (res.ok) await fetchConfig();
  };

  const deleteService = async (id: string) => {
    const res = await fetchWithAuth(`/api/config?type=service&id=${id}`, { method: 'DELETE' });
    if (res.ok) await fetchConfig();
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
    if (res.ok) await fetchConfig();
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
    if (res.ok) await fetchConfig();
  };

  const deleteDevice = async (id: string) => {
    const res = await fetchWithAuth(`/api/config?type=device&id=${id}`, { method: 'DELETE' });
    if (res.ok) await fetchConfig();
  };

  const updateHomeWidgetProps = async (widgetId: string, newProps: any) => {
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
    if (!res.ok) await fetchConfig();
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

    const res = await fetchWithAuth('/api/config', {
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
    const res = await fetchWithAuth('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    return data.url;
  };

  const addDockerAction = async (action: any) => {
    const res = await fetchWithAuth('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'dockerAction', ...action }),
    });
    if (res.ok) await fetchConfig();
  };

  const updateDockerAction = async (id: string, updates: any) => {
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

  const reorderDockerActions = async (newActions: any[]) => {
    if (!config) return;
    setConfig(prev => prev ? { ...prev, dockerActions: newActions } : prev);
    const res = await fetchWithAuth('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'reorderDockerActions', dockerActions: newActions }),
    });
    if (!res.ok) await fetchConfig();
  };

  const addLocalEvent = async (event: Omit<any, 'id'>) => {
    const res = await fetchWithAuth('/api/config/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    if (res.ok) await fetchConfig();
  };

  const updateLocalEvent = async (id: string, updates: any) => {
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

  const value: any = {
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

    // Auth exports
    user,
    authLoading,
    logout,
    refreshUser: fetchUser
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
        <style dangerouslySetInnerHTML={{ __html: sanitizeCustomCss(config.settings.customCss) }} />
      )}
      {children}
    </ConfigContext.Provider>
  );
}
