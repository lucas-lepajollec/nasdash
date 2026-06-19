'use client';

import { useState, useCallback, useEffect } from 'react';

export type TabId = 'dashboard' | 'widgets' | 'docker' | 'networks' | string;

export interface TabDef {
  id: TabId;
  name: string;
  icon: string;
  description: string;
  isCustom?: boolean;
}

export const TABS: TabDef[] = [
  { id: 'dashboard', name: 'Home', icon: '🏠', description: 'Services & monitoring' },
  { id: 'widgets', name: 'Widgets', icon: '🎛️', description: 'Grille de widgets fluide' },
  { id: 'docker', name: 'Docker', icon: '🐳', description: 'Conteneurs & images' },
  { id: 'networks', name: 'Réseaux', icon: '📶', description: 'Cartographie & outils réseau' },
];

const STORAGE_KEY = 'nasdash-active-tab';

export function useTabs() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [ready, setReady] = useState(false);
  const [customTabs, setCustomTabs] = useState<TabDef[]>([]);

  const fetchCustomTabs = useCallback(async () => {
    try {
      const res = await fetch('/api/custom-tabs');
      if (res.ok) {
        const data = await res.json();
        setCustomTabs(data.tabs || []);
      }
    } catch (e) {
      console.error('Failed to fetch custom tabs:', e);
    }
  }, []);

  useEffect(() => {
    fetchCustomTabs();
    const handleUpdate = () => fetchCustomTabs();
    window.addEventListener('customTabsUpdated', handleUpdate);
    return () => window.removeEventListener('customTabsUpdated', handleUpdate);
  }, [fetchCustomTabs]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as TabId | null;
    const allTabs = [...TABS, ...customTabs];
    if (saved && allTabs.some(e => e.id === saved)) {
      setActiveTab(saved);
    }
    setReady(true);
  }, [customTabs]);

  const switchTab = useCallback((id: TabId) => {
    setActiveTab(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const allTabs = [...TABS, ...customTabs];

  const refreshTabs = useCallback(() => {
    fetchCustomTabs().then(() => {
      window.dispatchEvent(new Event('customTabsUpdated'));
    });
  }, [fetchCustomTabs]);

  return { activeTab, switchTab, tabs: allTabs, ready, refreshTabs };
}
