'use client';

import { useState, useCallback, useEffect } from 'react';

export type TabId = 'dashboard' | 'docker' | 'ha';

export interface TabDef {
  id: TabId;
  name: string;
  icon: string;
  description: string;
}

export const TABS: TabDef[] = [
  { id: 'dashboard', name: 'Home', icon: '🏠', description: 'Services & monitoring' },
  { id: 'docker', name: 'Docker', icon: '🐳', description: 'Conteneurs & images' },
  { id: 'ha', name: 'HA', icon: '🔌', description: 'Domotique' },
];

const STORAGE_KEY = 'nasdash-active-tab';

export function useTabs() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as TabId | null;
    if (saved && TABS.some(e => e.id === saved)) {
      setActiveTab(saved);
    }
    setReady(true);
  }, []);

  const switchTab = useCallback((id: TabId) => {
    setActiveTab(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  return { activeTab, switchTab, tabs: TABS, ready };
}
