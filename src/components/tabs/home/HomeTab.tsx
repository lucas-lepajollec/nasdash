'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { WidgetRenderer } from '../../widgets/WidgetRenderer';
import { WIDGET_REGISTRY, getWidgetConfigKeys } from '@/lib/widgetRegistry';
import BentoGrid from './BentoGrid';
import Footer from '../../layout/Footer';
import { useConfig } from '@/hooks/useConfig';
import { useStickyRef } from '@/hooks/useStickyRef';
import { Category, Service, Device, DockerActionConfig } from '@/lib/types';
import { WidgetPanel } from '../../shared/WidgetPanel';
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
    updateConfig,
    user
  } = useConfig();

  const [leftSidebarRef, leftSticky] = useStickyRef<HTMLElement>([config, editMode]);
  const [rightSidebarRef, rightSticky] = useStickyRef<HTMLElement>([config, editMode]);


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

  const handleDeleteService = async (id: string) => {
    await deleteService(id);
    setServiceModal({ open: false });
  };

  const handleDeleteCategory = async (id: string) => {
    await deleteCategory(id);
    setCategoryModal({ open: false });
  };

  const handleDeleteDevice = async (id: string) => {
    await deleteDevice(id);
    setDeviceModal({ open: false });
  };

  const handleDeleteDockerAction = async (id: string) => {
    await deleteDockerAction(id);
    setDockerActionModal({ open: false });
  };

  if (loading || !config) return null;

  const tabConf = config.settings?.tabs?.home || {};

  const hasWidgets = (panelId: string) => {
    const p = config?.settings?.panels?.[panelId];
    if (!p || !p.widgets || p.widgets.length === 0) return false;
    return p.widgets.some((w: any) => {
      if (user && user.role !== 'admin' && user.allowedWidgets && user.allowedWidgets.length > 0) {
        if (!user.allowedWidgets.includes(w.type)) return false;
      }
      const def = WIDGET_REGISTRY.find(x => x.id === w.type);
      if (!def) return false;
      const hideKey = getWidgetConfigKeys(w.type).hide;
      const isGloballyHidden = (config.settings as any)?.[hideKey] ?? def.defaultHidden;
      return !isGloballyHidden;
    });
  };

  const onUpdateWidgetHeight = useCallback(async (id: string, height: number) => {
    if (!config) return;
    const currentWidgets = config.settings.homeWidgets || [];
    const newWidgets = currentWidgets.map(w => w.id === id ? { ...w, height } : w);
    await updateConfig({ homeWidgets: newWidgets });
  }, [config, updateConfig]);

  const onDeleteWidget = useCallback(async (id: string) => {
    if (!config) return;
    const currentWidgets = config.settings.homeWidgets || [];
    const newWidgets = currentWidgets.filter(w => w.id !== id);
    await updateConfig({ homeWidgets: newWidgets });
  }, [config, updateConfig]);

  const onReorderWidgets = useCallback(async (newWidgets: any[]) => {
    if (!config) return;
    await updateConfig({ homeWidgets: newWidgets });
  }, [config, updateConfig]);

  const showLeftPanel = !tabConf.hideLeftSidebar;
  const showRightPanel = !tabConf.hideRightSidebar;

  const leftPanelPos = tabConf.leftSidebarPosition || 'left';
  const rightPanelPos = tabConf.rightSidebarPosition || 'right';

  const leftSidebars = [];
  const rightSidebars = [];

  if (showLeftPanel && (hasWidgets('home-left') || editMode)) {
    const el = (
      <aside key="left-panel" ref={leftSidebarRef} className="nd-sidebar-left" style={{ position: leftSticky ? 'sticky' : 'static' }}>
        <WidgetPanel panelId="home-left" editMode={editMode} showSensitive={showSensitive} />
      </aside>
    );
    if (leftPanelPos === 'left') leftSidebars.push(el);
    else rightSidebars.push(el);
  }

  if (showRightPanel && (hasWidgets('home-right') || editMode)) {
    const el = (
      <aside key="right-panel" ref={rightSidebarRef} className="nd-sidebar-right" style={{ position: rightSticky ? 'sticky' : 'static' }}>
        <WidgetPanel panelId="home-right" editMode={editMode} showSensitive={showSensitive} />
      </aside>
    );
    if (rightPanelPos === 'left') leftSidebars.push(el);
    else rightSidebars.push(el);
  }

  let gridCols = '';
  if (leftSidebars.length === 1) gridCols += 'var(--nd-sidebar-width) ';
  else if (leftSidebars.length === 2) gridCols += 'var(--nd-sidebar-width) var(--nd-sidebar-width) ';
  
  gridCols += 'minmax(0, 1fr)';
  
  if (rightSidebars.length === 1) gridCols += ' var(--nd-right-sidebar-width)';
  else if (rightSidebars.length === 2) gridCols += ' var(--nd-right-sidebar-width) var(--nd-right-sidebar-width)';

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="nd-layout" style={{ gridTemplateColumns: gridCols }}>
          {/* LEFT SIDEBAR(S) */}
          {leftSidebars.length > 0 ? leftSidebars : null}

          {/* CENTER — Service Grid + Monitor */}
          <main className="nd-center">
            <BentoGrid
              categories={config?.categories || []}
              homeWidgets={(config?.settings?.homeWidgets || []).filter(w => {
                if (user && user.role !== 'admin' && user.allowedWidgets && user.allowedWidgets.length > 0) {
                  if (!user.allowedWidgets.includes(w.type)) return false;
                }
                const def = WIDGET_REGISTRY.find(x => x.id === w.type);
                if (!def) return true; // spacer or unknown
                const hideKey = getWidgetConfigKeys(w.type).hide;
                const isGloballyHidden = (config?.settings as any)?.[hideKey] ?? def.defaultHidden;
                return !isGloballyHidden;
              })}
              totalSlots={config?.settings?.totalSlots || Math.max(12, (config?.categories?.length || 0) + (config?.settings?.homeWidgets?.length || 0))}
              editMode={editMode}
              searchQuery={searchQuery}
              showSecretSections={showSecretSections}
              showSensitive={showSensitive}
              onReorder={saveCategories}
              onReorderWidgets={onReorderWidgets}
              onEditCategory={(cat) => setCategoryModal({ open: true, category: cat })}
              onDeleteCategory={deleteCategory}
              onDeleteWidget={onDeleteWidget}
              onUpdateWidgetHeight={onUpdateWidgetHeight}
              onAddService={(catId) => setServiceModal({ open: true, categoryId: catId })}
              onDeleteSlot={removeSlot}
            />

            {!tabConf.hideBottomPanel && hasWidgets('home-bottom') && (
              <section className="nd-bottom-panel" style={{ marginTop: 24, marginBottom: 24 }}>
                {(tabConf.bottomPanelTitle ?? 'Activité réseau') && (
                  <div className="nd-section-title" style={{ marginBottom: 16 }}>
                    {tabConf.bottomPanelTitle ?? 'Activité réseau'}
                  </div>
                )}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                  gap: 16,
                  alignItems: 'stretch'
                }}>
                  <WidgetPanel panelId="home-bottom" editMode={editMode} showSensitive={showSensitive} />
                </div>
              </section>
            )}

            <Footer
              categories={config.categories}
              showSecretSections={showSecretSections}
              showSensitive={showSensitive}
              onToggleSecretSections={onToggleSecretSections}
            />
          </main>

          {/* RIGHT SIDEBAR(S) */}
          {rightSidebars.length > 0 ? rightSidebars : null}
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
    </>
  );
}
