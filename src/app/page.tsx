'use client';

import { useState, useCallback, Suspense, lazy } from 'react';
import Header from '@/components/layout/Header';
import TabDock from '@/components/layout/TabDock';
import HomeTab from '@/components/tabs/home/HomeTab';
import { useTabs, TabId } from '@/hooks/useTabs';
import { useConfig } from '@/hooks/useConfig';
import { Category, Service, Device } from '@/lib/types';

const DockerTab = lazy(() => import('@/components/tabs/docker/DockerTab'));
const HomeAssistantTab = lazy(() => import('@/components/tabs/ha/HomeAssistantTab'));

export default function Shell() {
  const { activeTab, switchTab, tabs, ready } = useTabs();
  const { config, loading, refresh, addSlot, setCategoryModal, updateConfig } = useConfig();

  const [isDark, setIsDark] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  const toggleTheme = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      document.body.dataset.theme = next ? 'dark' : 'light';
      document.body.classList.toggle('light', !next);
      return next;
    });
  }, []);

  const dockPosition = config?.settings?.dockPosition || 'left';

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

  return (
    <div className={`nd-shell nd-shell--dock-${dockPosition} ${activeTab === 'ha' ? 'nd-shell--ha' : ''}`}>
      {/* Dock — Tab switcher */}
      <TabDock
        tabs={(() => {
          const tabOrder = config?.settings?.tabOrder || tabs.map(t => t.id);
          const sortedTabs = [...tabs].sort((a, b) => {
            const idxA = tabOrder.indexOf(a.id);
            const idxB = tabOrder.indexOf(b.id);
            return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
          });
          return sortedTabs;
        })()}
        activeTab={activeTab}
        onSwitch={switchTab}
        position={dockPosition}
        editMode={editMode}
        hiddenIds={config?.settings?.hiddenTabs || []}
        onToggleHidden={async (id) => {
          const hiddenTabs = config?.settings?.hiddenTabs || [];
          const newHidden = hiddenTabs.includes(id) 
            ? hiddenTabs.filter(h => h !== id)
            : [...hiddenTabs, id];
          
          await updateConfig({ type: 'settings', hiddenTabs: newHidden });
          refresh();

          // If current is now hidden, fallback to first visible
          if (activeTab === id && !hiddenTabs.includes(id)) {
            const firstVisible = tabs.find(e => !newHidden.includes(e.id));
            if (firstVisible) switchTab(firstVisible.id);
          }
        }}
        onMove={async (id, direction) => {
          const tabOrder = config?.settings?.tabOrder || tabs.map(t => t.id);
          const idx = tabOrder.indexOf(id);
          if (idx === -1) return;
          
          const newOrder = [...tabOrder];
          const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
          if (targetIdx < 0 || targetIdx >= newOrder.length) return;
          
          [newOrder[idx], newOrder[targetIdx]] = [newOrder[targetIdx], newOrder[idx]];
          await updateConfig({ type: 'settings', tabOrder: newOrder });
          refresh();
        }}
        onTogglePosition={async () => {
          const newPos = dockPosition === 'left' ? 'right' : 'left';
          await updateConfig({ type: 'settings', dockPosition: newPos });
          refresh();
        }}
      />

      {/* Main content area */}
      <div className={`nd-shell-content ${activeTab === 'ha' && !editMode ? 'nd-shell-content--flush' : ''}`}>
        <Header
          title={title}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          editMode={editMode}
          onToggleEdit={() => setEditMode(prev => !prev)}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          onAddCategory={() => setCategoryModal({ open: true })} 
          onAddSlot={addSlot}
          secretMode={showSecret}
          activeTab={activeTab}
        />

        {/* Tab views - Kept mounted to preserve state */}
        <div className="nd-tab-view">
          {/* Dashboard */}
          <div className="flex-1" style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}>
            <HomeTab
              editMode={editMode}
              searchQuery={searchQuery}
              showSecret={showSecret}
              onToggleSecret={() => setShowSecret(prev => !prev)}
              isVisible={activeTab === 'dashboard'}
            />
          </div>

          {/* Docker */}
          <div className="flex-1" style={{ display: activeTab === 'docker' ? 'block' : 'none' }}>
            <Suspense fallback={<LoadingView text="Chargement Docker…" />}>
              <DockerTab editMode={editMode} searchQuery={searchQuery} isVisible={activeTab === 'docker'} />
            </Suspense>
          </div>

          {/* Home Assistant — conditionally rendered to avoid background iframe costs */}
          {activeTab === 'ha' && (
            <div className="flex-1">
              <Suspense fallback={<LoadingView text="Chargement HA…" />}>
                <HomeAssistantTab editMode={editMode} isVisible={activeTab === 'ha'} />
              </Suspense>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
