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
import { DndContext, pointerWithin, MouseSensor, TouchSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay, defaultDropAnimationSideEffects } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

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
    reorderDevices,
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

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const [activeDevice, setActiveDevice] = useState<Device | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = event.active.id.toString();
    if (activeId.startsWith('drag-device-')) {
      const deviceId = activeId.replace('drag-device-', '');
      const device = config?.devices?.find(d => d.id === deviceId);
      if (device) setActiveDevice(device);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !config?.devices) {
      setActiveDevice(null);
      return;
    }

    const activeId = active.id.toString();
    const overId = over.id.toString();

    // Device drag handling
    if (activeId.startsWith('drag-device-') && overId.startsWith('drag-device-')) {
      const activeDeviceId = activeId.replace('drag-device-', '');
      const overDeviceId = overId.replace('drag-device-', '');

      const oldIndex = config.devices.findIndex(d => d.id === activeDeviceId);
      const newIndex = config.devices.findIndex(d => d.id === overDeviceId);

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
        setActiveDevice(null);
        return;
      }

      const newDevices = arrayMove(config.devices, oldIndex, newIndex);
      reorderDevices(newDevices);
    }

    setActiveDevice(null);
  };

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
  const handleSaveCategory = async (data: { title: string; emoji: string; isSecret: boolean; services?: Service[] }) => {
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
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="nd-layout">
          {/* LEFT SIDEBAR — Devices */}
          <LeftSidebar
            devices={config.devices || []}
            editMode={editMode}
            onAddDevice={() => setDeviceModal({ open: true })}
            onEditDevice={(dev) => setDeviceModal({ open: true, device: dev })}
            onDeleteDevice={handleDeleteDevice}
            onReorderDevices={reorderDevices}
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
          <RightSidebar categories={config.categories} editMode={editMode} />
        </div>
        <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) }}>
          {activeDevice ? (
            <div style={{ transform: 'scale(1.02)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', borderRadius: 'var(--nd-card-radius)', opacity: 0.9 }}>
              <div className="nd-sidebar-card" style={{ padding: 10 }}>
                <span style={{ fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span>{activeDevice.icon}</span>
                  {activeDevice.name}
                </span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

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
