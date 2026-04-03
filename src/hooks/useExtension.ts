'use client';

import { useState, useCallback, useEffect } from 'react';

export type ExtensionId = 'dashboard' | 'docker';

export interface ExtensionDef {
  id: ExtensionId;
  name: string;
  icon: string;
  description: string;
}

export const EXTENSIONS: ExtensionDef[] = [
  { id: 'dashboard', name: 'Home', icon: '🏠', description: 'Services & monitoring' },
  { id: 'docker', name: 'Docker', icon: '🐳', description: 'Conteneurs & images' },
];

const STORAGE_KEY = 'nasdash-active-extension';

export function useExtension() {
  const [activeExtension, setActiveExtension] = useState<ExtensionId>('dashboard');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ExtensionId | null;
    if (saved && EXTENSIONS.some(e => e.id === saved)) {
      setActiveExtension(saved);
    }
    setReady(true);
  }, []);

  const switchExtension = useCallback((id: ExtensionId) => {
    setActiveExtension(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  return { activeExtension, switchExtension, extensions: EXTENSIONS, ready };
}
