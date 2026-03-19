'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardConfig, Category, Service, Device } from '@/lib/types';

export function useConfig() {
  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      // Ensure devices array exists (backward compat)
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

  const addCategory = async (title: string, emoji: string, isSecret = false) => {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'category', title, emoji, isSecret }),
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

  const uploadLogo = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    return data.url;
  };

  return {
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
    removeSlot,
    addDevice,
    updateDevice,
    deleteDevice,
    uploadLogo,
  };
}
