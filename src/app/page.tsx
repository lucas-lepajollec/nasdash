'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/layout/Header';
import DemoExperience from '@/components/demo/DemoExperience';
import TabDock from '@/components/layout/TabDock';
import { useTabs, TabId } from '@/hooks/useTabs';
import { useConfig } from '@/hooks/useConfig';
import SettingsModal from '@/components/modals/SettingsModal';
import CalendarEventModal from '@/components/modals/CalendarEventModal';
import ViewEventModal from '@/components/modals/ViewEventModal';
import PerfMonitor from '@/components/shared/PerfMonitor';
import ServiceFormModal from '@/components/modals/ServiceFormModal';
import CategoryFormModal from '@/components/modals/CategoryFormModal';
import DeviceFormModal from '@/components/modals/DeviceFormModal';
import DockerActionFormModal from '@/components/modals/DockerActionFormModal';
import { useI18n } from '@/i18n/I18nProvider';
import { PageView, type LibraryTarget } from '@/components/pages/PageView';
import { PageEditorBar } from '@/components/pages/PageEditorBar';
import { WidgetLibraryModal } from '@/components/pages/WidgetLibraryModal';
import { usePages } from '@/providers/PagesProvider';
import { insertWidget, newWidgetInstance, removeWidget } from '@/lib/pages/operations';

export default function Shell() {
  const { t } = useI18n();
  const { activeTab, switchTab, tabs, ready } = useTabs();
  const {
    config, loading, refresh,
    settingsModal, setSettingsModal, updateConfig,
    serviceModal, setServiceModal, addService, updateService, deleteService, uploadLogo,
    categoryModal, setCategoryModal, addCategory, updateCategory, deleteCategory,
    deviceModal, setDeviceModal, addDevice, updateDevice, deleteDevice,
    dockerActionModal, setDockerActionModal, addDockerAction, updateDockerAction, deleteDockerAction,
    showSecretSections, setShowSecretSections,
    user
  } = useConfig();

  const { pages, editing, startEditing, finishEditing, getPage, applyToPage, applyToPages, loadError: pagesError } = usePages();
  const editMode = user?.role === 'admin' && editing;
  const [libraryTarget, setLibraryTarget] = useState<LibraryTarget | null>(null);
  // Pages are mounted on first visit, then kept mounted to preserve their state.
  const [visitedPages, setVisitedPages] = useState<string[]>([]);
  const settingsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSensitive, setShowSensitive] = useState(true);
  if (activeTab && !visitedPages.includes(activeTab)) {
    // Derived during render: the first visit mounts the page once.
    setVisitedPages([...visitedPages, activeTab]);
  }

  useEffect(() => {
    if (!loading && ready && user && user.role !== 'admin' && user.allowedTabs && user.allowedTabs.length > 0) {
      if (!user.allowedTabs.includes(activeTab)) {
        const firstAllowed = user.allowedTabs[0];
        if (firstAllowed) {
          switchTab(firstAllowed);
        }
      }
    }
  }, [user, activeTab, switchTab, loading, ready]);

  const dockPosition = config?.settings?.dockPosition || 'left';
  const hiddenIds = config?.settings?.hiddenTabs || [];
  
  const sortedTabs = (() => {
    const savedOrder = config?.settings?.tabOrder || [];
    const savedSet = new Set(savedOrder);
    const newTabs = tabs.map(t => t.id).filter(id => !savedSet.has(id));
    const tabOrder = savedOrder.length > 0 ? [...savedOrder, ...newTabs] : tabs.map(t => t.id);

    const customIcons = config?.settings?.tabIcons || {};
    const sorted = [...tabs].sort((a, b) => {
      const idxA = tabOrder.indexOf(a.id);
      const idxB = tabOrder.indexOf(b.id);
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });
    
    let mapped = sorted.map(t => ({ ...t, icon: customIcons[t.id] !== undefined ? customIcons[t.id] : t.icon }));

    // Filter based on user allowedTabs
    if (user && user.role !== 'admin' && user.allowedTabs && user.allowedTabs.length > 0) {
      mapped = mapped.filter(t => user.allowedTabs!.includes(t.id));
    }
    
    return mapped;
  })();

  if (loading || !ready || !config) {
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
            {t("Chargement…")}
          </span>
        </div>
      </div>
    );
  }

  const title = config?.settings?.title || process.env.NEXT_PUBLIC_DASHBOARD_TITLE || 'NASDASH';
  const activePage = getPage(activeTab);

  const isDockHidden = config?.settings?.hideDock ?? false;

  return (
    <div className={`nd-shell ${isDockHidden ? 'nd-shell--dock-hidden' : `nd-shell--dock-${dockPosition}`}`}>
      {/* Dock — Tab switcher */}
      {!isDockHidden && (
        <TabDock
          tabs={sortedTabs}
          activeTab={activeTab}
          onSwitch={switchTab}
          position={dockPosition}
          editMode={editMode}
          hiddenIds={hiddenIds}
          onTogglePosition={async () => {
            const newPos = dockPosition === 'left' ? 'right' : 'left';
            await updateConfig({ type: 'settings', dockPosition: newPos });
            refresh();
          }}
        />
      )}

      {/* Main content area */}
      <div className="nd-shell-content">
        <h1 style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}>
          {title}
        </h1>
        <Header
          title={title}
          titleLogo={config?.settings?.titleLogo}
          titleMobile={config?.settings?.titleMobile}
          titleFont={config?.settings?.titleFont}
          titleAnimation={config?.settings?.titleAnimation}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          editMode={editMode}
          onToggleEdit={() => { if (editing) void finishEditing(); else startEditing(); }}
          onOpenSettings={(trigger) => {
            settingsTriggerRef.current = trigger ?? null;
            setSettingsModal({ open: true });
          }}
          onAddCategory={() => {
            setCategoryModal({ open: true, placement: activePage ? { pageId: activePage.id } : undefined });
          }}
          onAddWidget={() => setLibraryTarget({ pageId: activeTab })}
          hasTopology={!!activePage?.widgets.some(widget => widget.type === 'network-topology' && !widget.hidden)}
          secretMode={showSensitive}
          onToggleSecret={() => setShowSensitive(prev => !prev)}
          activeTab={activeTab}
          tabs={sortedTabs}
          onSwitchTab={switchTab}
        />

        {pagesError && (
          <div className="nd-page-load-error" role="alert">{t('pages.loadError', { error: pagesError })}</div>
        )}

        {/* Every page, official or custom, is rendered by the same engine.
            Visited pages stay mounted (hidden) to preserve their state. */}
        <div className="nd-tab-view">
          {tabs.filter(tab => tab.id === activeTab || visitedPages.includes(tab.id)).map(tab => (
            <div key={tab.id} className="flex-1" style={{ display: activeTab === tab.id ? 'block' : 'none' }}>
              <PageView
                pageId={tab.id}
                isVisible={activeTab === tab.id}
                searchQuery={searchQuery}
                showSensitive={showSensitive}
                showSecretSections={showSecretSections}
                onToggleSecretSections={() => setShowSecretSections(prev => !prev)}
                onOpenLibrary={setLibraryTarget}
              />
            </div>
          ))}
        </div>
      </div>

      {settingsModal.open && user?.role === 'admin' && (
        <SettingsModal onClose={() => {
          setSettingsModal({ open: false });
        }} restoreFocus={() => {
          if (settingsTriggerRef.current?.isConnected) return settingsTriggerRef.current;
          return Array.from(document.querySelectorAll<HTMLButtonElement>('[data-settings-trigger="true"]'))
            .find(button => button.getClientRects().length > 0) ?? null;
        }} />
      )}

      {serviceModal.open && user?.role === 'admin' && (
        <ServiceFormModal
          service={serviceModal.service}
          categoryId={serviceModal.categoryId}
          onClose={() => setServiceModal({ open: false })}
          onSave={async (data: any) => {
            if (serviceModal.service) await updateService(serviceModal.service.id, data);
            else if (data.categoryId) await addService(data.categoryId, data);
            setServiceModal({ open: false });
          }}
          onDelete={serviceModal.service ? async (id: string) => { await deleteService(id); setServiceModal({ open: false }); } : undefined}
          onUploadLogo={uploadLogo}
          showSensitive={showSensitive}
        />
      )}

      {categoryModal.open && user?.role === 'admin' && (
        <CategoryFormModal
          category={categoryModal.category}
          onClose={() => setCategoryModal({ open: false })}
          onSave={async (data: any) => {
            if (categoryModal.category) await updateCategory(categoryModal.category.id, data);
            else {
              const created = await addCategory(data.title, data.emoji, data.isSecret, data.layout);
              const placement = categoryModal.placement;
              // A new category appears where it was requested, as a page widget.
              if (created && placement && editing) {
                applyToPage(placement.pageId, page => insertWidget(page, newWidgetInstance('service-category', { categoryId: created.id }, page)));
              }
            }
            setCategoryModal({ open: false });
          }}
          onDelete={categoryModal.category ? async (id: string) => {
            await deleteCategory(id);
            // Views of a deleted category disappear from the pages being edited.
            if (editing) {
              const affected = pages.filter(page => (getPage(page.id) ?? page).widgets.some(widget => widget.type === 'service-category' && widget.settings.categoryId === id));
              if (affected.length) {
                applyToPages(affected.map(page => page.id), drafts => drafts.map(draft => draft.widgets
                  .filter(widget => widget.type === 'service-category' && widget.settings.categoryId === id)
                  .reduce((current, widget) => removeWidget(current, widget.id), draft)));
              }
            }
            setCategoryModal({ open: false });
          } : undefined}
          showSecretSections={showSecretSections}
          showSensitive={showSensitive}
        />
      )}

      {deviceModal.open && user?.role === 'admin' && (
        <DeviceFormModal
          device={deviceModal.device}
          onClose={() => setDeviceModal({ open: false })}
          onSave={async (data: any) => {
            if (data.id) await updateDevice(data.id, data);
            else await addDevice(data);
            setDeviceModal({ open: false });
          }}
          onDelete={deviceModal.device ? async (id: string) => { await deleteDevice(id); setDeviceModal({ open: false }); } : undefined}
          showSensitive={showSensitive}
        />
      )}

      {dockerActionModal.open && user?.role === 'admin' && (
        <DockerActionFormModal
          action={dockerActionModal.action}
          onClose={() => setDockerActionModal({ open: false })}
          onSave={async (data: any) => {
            if (dockerActionModal.action) await updateDockerAction(dockerActionModal.action.id, data);
            else await addDockerAction(data);
            setDockerActionModal({ open: false });
          }}
          onDelete={dockerActionModal.action ? async (id: string) => { await deleteDockerAction(id); setDockerActionModal({ open: false }); } : undefined}
        />
      )}

      <CalendarEventModal />
      <ViewEventModal />

      {/* Performance Monitor — petit bouton en bas à droite */}
      <PerfMonitor />

      {libraryTarget && user?.role === 'admin' && editing && (
        <WidgetLibraryModal target={libraryTarget} onClose={() => setLibraryTarget(null)} />
      )}
      {user?.role === 'admin' && <PageEditorBar onAddWidget={() => setLibraryTarget({ pageId: activeTab })} />}
      {config?.demoMode === true && <DemoExperience />}
    </div>
  );
}
