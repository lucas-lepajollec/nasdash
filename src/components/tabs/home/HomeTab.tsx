'use client';

import React, { useState, useCallback } from 'react';
import LeftSidebar from './LeftSidebar';
import RightSidebar, { QuickStats } from './RightSidebar';
import TailscaleStatus from './TailscaleStatus';
import DockerActions from './DockerActions';
import ClockWidget from './ClockWidget';
import CalendarWidget from './CalendarWidget';
import WeatherWidget from './WeatherWidget';
import BentoGrid from './BentoGrid';
import SystemMonitor from './SystemMonitor';
import Footer from '../../layout/Footer';
import ServiceFormModal from './modals/ServiceFormModal';
import CategoryFormModal from './modals/CategoryFormModal';
import DeviceFormModal from './modals/DeviceFormModal';
import DockerActionFormModal from './modals/DockerActionFormModal';
import { useConfig } from '@/hooks/useConfig';
import { Category, Service, Device, DockerActionConfig } from '@/lib/types';
import { DndContext, pointerWithin, MouseSensor, TouchSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay, defaultDropAnimationSideEffects } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

interface HomeTabProps {
  editMode: boolean;
  searchQuery: string;
  showSecretSections: boolean;
  showSensitive: boolean;
  onToggleSecretSections: () => void;
  isVisible: boolean;
}

export default function HomeTab({ 
  editMode, 
  searchQuery, 
  showSecretSections, 
  showSensitive,
  onToggleSecretSections,
  isVisible
}: HomeTabProps) {
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
    serviceModal,
    setServiceModal,
    categoryModal,
    setCategoryModal,
    deviceModal,
    setDeviceModal,
    addDockerAction,
    updateDockerAction,
    deleteDockerAction,
    dockerActionModal,
    setDockerActionModal,
    settingsModal,
    setSettingsModal,
  } = useConfig();

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
    secondaryUrl: string;
    logo: string;
    secondaryLogo: string;
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
  const handleSaveCategory = async (data: { 
    title: string; 
    emoji: string; 
    isSecret: boolean; 
    services?: Service[]; 
    layout?: Category['layout'];
  }) => {
    if (categoryModal.category) {
      await updateCategory(categoryModal.category.id, data);
    } else {
      await addCategory(data.title, data.emoji, data.isSecret, data.layout);
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

  // Docker Action handlers
  const handleSaveDockerAction = async (data: any) => {
    if (dockerActionModal.action) {
      await updateDockerAction(dockerActionModal.action.id, data);
    } else {
      await addDockerAction(data);
    }
    setDockerActionModal({ open: false });
  };

  const handleDeleteDockerAction = async (id: string) => {
    await deleteDockerAction(id);
    setDockerActionModal({ open: false });
  };

  if (loading || !config) return null;

  const widgets = [
    {
      id: 'devices',
      visible: !config.settings?.hideDevices,
      sidebar: config.settings?.devicesSidebar || 'left',
      order: config.settings?.devicesOrder ?? 0,
      render: () => (
        <LeftSidebar
          devices={config.devices || []}
          editMode={editMode}
          onAddDevice={() => setDeviceModal({ open: true })}
          onEditDevice={(dev) => setDeviceModal({ open: true, device: dev })}
          onDeleteDevice={handleDeleteDevice}
          onReorderDevices={reorderDevices}
        />
      )
    },
    {
      id: 'quickstats',
      visible: !config.settings?.hideQuickStats,
      sidebar: config.settings?.quickStatsSidebar || 'right',
      order: config.settings?.quickStatsOrder ?? 1,
      render: () => (
        <QuickStats categories={config.categories} />
      )
    },
    {
      id: 'tailscale',
      visible: !config.settings?.hideTailscaleStatus,
      sidebar: config.settings?.tailscaleSidebar || 'right',
      order: config.settings?.tailscaleOrder ?? 2,
      render: () => (
        <TailscaleStatus editMode={editMode} showSensitive={showSensitive} />
      )
    },
    {
      id: 'dockeractions',
      visible: !config.settings?.hideDockerActions,
      sidebar: config.settings?.dockerActionsSidebar || 'right',
      order: config.settings?.dockerActionsOrder ?? 3,
      render: () => (
        <DockerActions editMode={editMode} />
      )
    },
    {
      id: 'clock',
      visible: !config.settings?.hideClock,
      sidebar: config.settings?.clockSidebar || 'right',
      order: config.settings?.clockOrder ?? 4,
      render: () => (
        <ClockWidget />
      )
    },
    {
      id: 'calendar',
      visible: !config.settings?.hideCalendar,
      sidebar: config.settings?.calendarSidebar || 'right',
      order: config.settings?.calendarOrder ?? 5,
      render: () => (
        <CalendarWidget />
      )
    },
    {
      id: 'weather',
      visible: !config.settings?.hideWeather,
      sidebar: config.settings?.weatherSidebar || 'right',
      order: config.settings?.weatherOrder ?? 6,
      render: () => (
        <WeatherWidget />
      )
    }
  ];

  const leftWidgets = widgets
    .filter(w => w.visible && w.sidebar === 'left')
    .sort((a, b) => a.order - b.order);

  const rightWidgets = widgets
    .filter(w => w.visible && w.sidebar === 'right')
    .sort((a, b) => a.order - b.order);

  const hasLeftContent = leftWidgets.length > 0;
  const hasRightContent = rightWidgets.length > 0;

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="nd-layout" style={{ gridTemplateColumns: 'var(--nd-sidebar-width) minmax(0, 1fr) var(--nd-right-sidebar-width)' }}>
          {/* LEFT SIDEBAR COLUMN */}
          {hasLeftContent ? (
            <aside className="nd-sidebar-left">
              {leftWidgets.map(w => (
                <React.Fragment key={w.id}>{w.render()}</React.Fragment>
              ))}
            </aside>
          ) : (
            <div className="nd-column-spacer" style={{ width: 'var(--nd-sidebar-width)' }} />
          )}

          {/* CENTER — Service Grid + Monitor */}
          <main className="nd-center">
            <BentoGrid
              categories={config.categories}
              totalSlots={config.settings.totalSlots || Math.max(12, config.categories.length)}
              editMode={editMode}
              searchQuery={searchQuery}
              showSecretSections={showSecretSections}
              showSensitive={showSensitive}
              onReorder={saveCategories}
              onEditCategory={(cat) => setCategoryModal({ open: true, category: cat })}
              onDeleteCategory={handleDeleteCategory}
              onAddService={(catId) => setServiceModal({ open: true, categoryId: catId })}
              onDeleteSlot={removeSlot}
            />

            {config.settings.showMonitor && (
              <SystemMonitor isDark={true} isVisible={isVisible} />
            )}

            <Footer
              categories={config.categories}
              showSecretSections={showSecretSections}
              showSensitive={showSensitive}
              onToggleSecretSections={onToggleSecretSections}
            />
          </main>

          {/* RIGHT SIDEBAR COLUMN */}
          {hasRightContent ? (
            <aside className="nd-sidebar-right">
              {rightWidgets.map(w => (
                <React.Fragment key={w.id}>{w.render()}</React.Fragment>
              ))}
            </aside>
          ) : (
            <div className="nd-column-spacer" style={{ width: 'var(--nd-right-sidebar-width)' }} />
          )}
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
          showSensitive={showSensitive}
        />
      )}

      {categoryModal.open && (
        <CategoryFormModal
          category={categoryModal.category}
          onClose={() => setCategoryModal({ open: false })}
          onSave={handleSaveCategory}
          onDelete={categoryModal.category ? handleDeleteCategory : undefined}
          showSecretSections={showSecretSections}
          showSensitive={showSensitive}
        />
      )}

      {deviceModal.open && (
        <DeviceFormModal
          device={deviceModal.device}
          onClose={() => setDeviceModal({ open: false })}
          onSave={handleSaveDevice}
          onDelete={deviceModal.device ? handleDeleteDevice : undefined}
          showSensitive={showSensitive}
        />
      )}

      {dockerActionModal.open && (
        <DockerActionFormModal
          action={dockerActionModal.action}
          onClose={() => setDockerActionModal({ open: false })}
          onSave={handleSaveDockerAction}
          onDelete={dockerActionModal.action ? handleDeleteDockerAction : undefined}
        />
      )}
    </>
  );
}
