'use client';

import { useState, useCallback } from 'react';
import Header from '@/components/Header';
import LeftSidebar from '@/components/LeftSidebar';
import RightSidebar from '@/components/RightSidebar';
import BentoGrid from '@/components/BentoGrid';
import SystemMonitor from '@/components/SystemMonitor';
import Footer from '@/components/Footer';
import ServiceFormModal from '@/components/ServiceFormModal';
import CategoryFormModal from '@/components/CategoryFormModal';
import DeviceFormModal from '@/components/DeviceFormModal';
import { useSystemStats } from '@/hooks/useSystemStats';
import { useConfig } from '@/hooks/useConfig';
import { Category, Service, Device } from '@/lib/types';

export default function Dashboard() {
  const { stats, history } = useSystemStats();
  const {
    config,
    loading,
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
  } = useConfig();

  const [isDark, setIsDark] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  // Modal states
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

  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      document.body.dataset.theme = next ? 'dark' : 'light';
      document.body.classList.toggle('light', !next);
      return next;
    });
  }, []);

  // Service handlers
  const handleSaveService = async (data: {
    name: string;
    localUrl: string;
    tailscaleUrl: string;
    logo: string;
    categoryId?: string;
  }) => {
    if (serviceModal.service) {
      await updateService(serviceModal.service.id, data);
    } else if (data.categoryId) {
      await addService(data.categoryId, data);
    }
    setServiceModal({ open: false });
  };

  const handleDeleteService = async (id: string) => {
    await deleteService(id);
    setServiceModal({ open: false });
  };

  // Category handlers
  const handleSaveCategory = async (data: { title: string; emoji: string; isSecret: boolean }) => {
    if (categoryModal.category) {
      await updateCategory(categoryModal.category.id, data);
    } else {
      await addCategory(data.title, data.emoji, data.isSecret);
    }
    setCategoryModal({ open: false });
  };

  const handleDeleteCategory = async (id: string) => {
    await deleteCategory(id);
    setCategoryModal({ open: false });
  };

  // Device handlers
  const handleSaveDevice = async (data: Omit<Device, 'id'> & { id?: string }) => {
    if (data.id) {
      await updateDevice(data.id, data);
    } else {
      await addDevice(data);
    }
    setDeviceModal({ open: false });
  };

  const handleDeleteDevice = async (id: string) => {
    await deleteDevice(id);
    setDeviceModal({ open: false });
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: '50%',
              border: '3px solid var(--nd-card-border)',
              borderTopColor: 'var(--nd-accent)',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--nd-text-muted)' }}>
            Chargement…
          </span>
        </div>
      </div>
    );
  }

  if (!config) return null;

  return (
    <>
      <Header
        title={process.env.NEXT_PUBLIC_DASHBOARD_TITLE || 'NASDASH'}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        editMode={editMode}
        onToggleEdit={() => setEditMode(prev => !prev)}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onAddCategory={() => setCategoryModal({ open: true })}
        onAddSlot={addSlot}
        secretMode={showSecret}
      />

      {/* 3-COLUMN LAYOUT */}
      <div className="nd-layout">
        {/* LEFT SIDEBAR — Devices */}
        <LeftSidebar
          devices={config.devices || []}
          editMode={editMode}
          onAddDevice={() => setDeviceModal({ open: true })}
          onEditDevice={(dev) => setDeviceModal({ open: true, device: dev })}
          onDeleteDevice={handleDeleteDevice}
        />

        {/* CENTER — Service Grid + Monitor */}
        <main className="nd-center">
          <BentoGrid
            categories={config.categories}
            totalSlots={config.settings.totalSlots || Math.max(12, config.categories.length)}
            editMode={editMode}
            searchQuery={searchQuery}
            showSecret={showSecret}
            onReorder={saveCategories}
            onEditCategory={(cat) => setCategoryModal({ open: true, category: cat })}
            onDeleteCategory={handleDeleteCategory}
            onEditService={(svc) => setServiceModal({ open: true, service: svc })}
            onDeleteService={handleDeleteService}
            onAddService={(catId) => setServiceModal({ open: true, categoryId: catId })}
            onDeleteSlot={removeSlot}
          />

          {config.settings.showMonitor && (
            <SystemMonitor history={history} isDark={isDark} />
          )}

          <Footer
            categories={config.categories}
            showSecret={showSecret}
            onToggleSecret={() => setShowSecret(prev => !prev)}
          />
        </main>

        {/* RIGHT SIDEBAR — Stats Overview + Tailscale */}
        <RightSidebar categories={config.categories} />
      </div>

      {/* Modals */}
      {serviceModal.open && (
        <ServiceFormModal
          service={serviceModal.service}
          categoryId={serviceModal.categoryId}
          onClose={() => setServiceModal({ open: false })}
          onSave={handleSaveService}
          onDelete={serviceModal.service ? handleDeleteService : undefined}
          onUploadLogo={uploadLogo}
        />
      )}

      {categoryModal.open && (
        <CategoryFormModal
          category={categoryModal.category}
          onClose={() => setCategoryModal({ open: false })}
          onSave={handleSaveCategory}
          onDelete={categoryModal.category ? handleDeleteCategory : undefined}
          secretMode={showSecret}
        />
      )}

      {deviceModal.open && (
        <DeviceFormModal
          device={deviceModal.device}
          onClose={() => setDeviceModal({ open: false })}
          onSave={handleSaveDevice}
          onDelete={deviceModal.device ? handleDeleteDevice : undefined}
        />
      )}
    </>
  );
}
