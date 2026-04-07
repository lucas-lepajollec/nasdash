'use client';

import { useState, useCallback, Suspense, lazy } from 'react';
import Header from '@/components/Header';
import ExtensionDock from '@/components/ExtensionDock';
import DashboardExtension from '@/components/extensions/DashboardExtension';
import { useExtension, ExtensionId } from '@/hooks/useExtension';
import { useConfig } from '@/hooks/useConfig';

const DockerExtension = lazy(() => import('@/components/extensions/DockerExtension'));
const HomeAssistantExtension = lazy(() => import('@/components/extensions/HomeAssistantExtension'));
const HermesExtension = lazy(() => import('@/components/extensions/HermesExtension'));

export default function Shell() {
  const { activeExtension, switchExtension, extensions, ready } = useExtension();
  const { config, loading, refresh } = useConfig();

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
    <div className={`nd-shell nd-shell--dock-${dockPosition} ${activeExtension === 'ha' ? 'nd-shell--ha' : ''}`}>
      {/* Dock — Extension switcher */}
      <ExtensionDock
        extensions={extensions}
        activeExtension={activeExtension}
        onSwitch={switchExtension}
        position={dockPosition}
        editMode={editMode}
        onTogglePosition={async () => {
          const newPos = dockPosition === 'left' ? 'right' : 'left';
          await fetch('/api/config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'settings', dockPosition: newPos }),
          });
          refresh();
        }}
      />

      {/* Main content area */}
      <div className={`nd-shell-content ${activeExtension === 'ha' && !editMode ? 'nd-shell-content--flush' : ''}`}>
        <Header
          title={title}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          editMode={editMode}
          onToggleEdit={() => setEditMode(prev => !prev)}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          onAddCategory={() => {}} 
          onAddSlot={() => {}}
          secretMode={showSecret}
          activeExtension={activeExtension}
        />

        {/* Extension views - Kept mounted to preserve state */}
        <div className="nd-extension-view">
          {/* Dashboard */}
          <div className="flex-1" style={{ display: activeExtension === 'dashboard' ? 'block' : 'none' }}>
            <DashboardExtension
              editMode={editMode}
              searchQuery={searchQuery}
              showSecret={showSecret}
              onToggleSecret={() => setShowSecret(prev => !prev)}
            />
          </div>

          {/* Docker */}
          <div className="flex-1" style={{ display: activeExtension === 'docker' ? 'block' : 'none' }}>
            <Suspense fallback={<LoadingView text="Chargement Docker…" />}>
              <DockerExtension editMode={editMode} searchQuery={searchQuery} />
            </Suspense>
          </div>

          {/* Home Assistant — conditionally rendered to avoid background iframe costs */}
          {activeExtension === 'ha' && (
            <div className="flex-1" style={{ display: 'flex', flexDirection: 'column' }}>
              <Suspense fallback={<LoadingView text="Chargement HA…" />}>
                <HomeAssistantExtension editMode={editMode} isVisible={activeExtension === 'ha'} />
              </Suspense>
            </div>
          )}

          {/* Hermes Agent */}
          {activeExtension === 'hermes' && (
            <div className="flex-1" style={{ display: 'flex', flexDirection: 'column' }}>
              <Suspense fallback={<LoadingView text="Chargement Hermes…" />}>
                <HermesExtension isVisible={activeExtension === 'hermes'} />
              </Suspense>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
