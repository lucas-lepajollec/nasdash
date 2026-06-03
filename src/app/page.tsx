'use client';

import { useState, useCallback, Suspense, lazy } from 'react';
import Header from '@/components/layout/Header';
import TabDock from '@/components/layout/TabDock';
import HomeTab from '@/components/tabs/home/HomeTab';
import { useTabs, TabId } from '@/hooks/useTabs';
import { useConfig } from '@/hooks/useConfig';
import { Category, Service, Device } from '@/lib/types';
import SettingsModal from '@/components/modals/SettingsModal';
import CalendarEventModal from '@/components/modals/CalendarEventModal';
import ViewEventModal from '@/components/modals/ViewEventModal';
import PerfMonitor from '@/components/shared/PerfMonitor';

const DockerTab = lazy(() => import('@/components/tabs/docker/DockerTab'));
const WidgetsTab = lazy(() => import('@/components/tabs/widgets/WidgetsTab'));

export default function Shell() {
  const { activeTab, switchTab, tabs, ready } = useTabs();
  const { config, loading, refresh, addSlot, addWidgetsSlot, setCategoryModal, settingsModal, setSettingsModal, updateConfig } = useConfig();

  const [isDark, setIsDark] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSecretSections, setShowSecretSections] = useState(false);
  const [showSensitive, setShowSensitive] = useState(true);
  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      document.body.dataset.theme = next ? 'dark' : 'light';
      document.body.classList.toggle('light', !next);
      return next;
    });
  }, []);

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
    return sorted.map(t => ({ ...t, icon: customIcons[t.id] !== undefined ? customIcons[t.id] : t.icon }));
  })();

  const handleToggleTabHidden = async (id: TabId) => {
    const newHidden = hiddenIds.includes(id) 
      ? hiddenIds.filter((h: string) => h !== id)
      : [...hiddenIds, id];
    
    await updateConfig({ type: 'settings', hiddenTabs: newHidden });
    refresh();

    // If current is now hidden, fallback to first visible
    if (activeTab === id && !hiddenIds.includes(id)) {
      const firstVisible = tabs.find(e => !newHidden.includes(e.id));
      if (firstVisible) switchTab(firstVisible.id);
    }
  };

  const handleMoveTab = async (id: TabId, direction: 'up' | 'down') => {
    const tabOrder = config?.settings?.tabOrder || tabs.map(t => t.id);
    const idx = tabOrder.indexOf(id);
    if (idx === -1) return;
    
    const newOrder = [...tabOrder];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= newOrder.length) return;
    
    [newOrder[idx], newOrder[targetIdx]] = [newOrder[targetIdx], newOrder[idx]];
    await updateConfig({ type: 'settings', tabOrder: newOrder });
    refresh();
  };

  if (loading || !ready) {
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

  const title = config?.settings?.title || process.env.NEXT_PUBLIC_DASHBOARD_TITLE || 'NASDASH';

  const LoadingView = ({ text }: { text: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid var(--nd-card-border)', borderTopColor: 'var(--nd-accent)', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontSize: '0.72rem', color: 'var(--nd-text-muted)' }}>{text}</span>
      </div>
    </div>
  );

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
        <Header
          title={title}
          titleLogo={config?.settings?.titleLogo}
          titleMobile={config?.settings?.titleMobile}
          titleFont={config?.settings?.titleFont}
          titleAnimation={config?.settings?.titleAnimation}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          editMode={editMode}
          onToggleEdit={() => setEditMode(prev => !prev)}
          onOpenSettings={() => setSettingsModal({ open: true })}
          onAddCategory={() => setCategoryModal({ open: true })} 
          onAddSlot={() => activeTab === 'widgets' ? addWidgetsSlot() : addSlot()}
          secretMode={showSensitive}
          onToggleSecret={() => setShowSensitive(prev => !prev)}
          activeTab={activeTab}
          tabs={sortedTabs}
          onSwitchTab={switchTab}
        />

        {/* Tab views - Kept mounted to preserve state */}
        <div className="nd-tab-view">
          {/* Dashboard */}
          <div className="flex-1" style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}>
            <HomeTab
              editMode={editMode}
              searchQuery={searchQuery}
              showSecretSections={showSecretSections}
              showSensitive={showSensitive}
              onToggleSecretSections={() => setShowSecretSections(prev => !prev)}
              isVisible={activeTab === 'dashboard'}
            />
          </div>

          {/* Docker */}
          <div className="flex-1" style={{ display: activeTab === 'docker' ? 'block' : 'none' }}>
            <Suspense fallback={<LoadingView text="Chargement Docker…" />}>
              <DockerTab editMode={editMode} searchQuery={searchQuery} isVisible={activeTab === 'docker'} showSensitive={showSensitive} />
            </Suspense>
          </div>

          {/* Widgets Tab */}
          <div className="flex-1" style={{ display: activeTab === 'widgets' ? 'block' : 'none' }}>
            <Suspense fallback={<LoadingView text="Chargement Widgets…" />}>
              <WidgetsTab editMode={editMode} isVisible={activeTab === 'widgets'} showSensitive={showSensitive} categories={config?.categories || []} />
            </Suspense>
          </div>
        </div>
      </div>

      {settingsModal.open && (
        <SettingsModal onClose={() => setSettingsModal({ open: false })} />
      )}

      <CalendarEventModal />
      <ViewEventModal />

      {/* Performance Monitor — petit bouton en bas à droite */}
      <PerfMonitor />
    </div>
  );
}
