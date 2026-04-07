'use client';

import { useState, useCallback, useEffect } from 'react';
import { useHermesStatus } from '@/hooks/useHermes';
import { useConfig } from '@/hooks/useConfig';
import {
  Settings, MessageSquare, Activity, FolderCog,
  Clock, BrainCircuit, Plug, ChevronRight
} from 'lucide-react';
import HermesSetup from '@/components/hermes/HermesSetup';
import HermesConfigPanel from '@/components/hermes/HermesConfigPanel';

type HermesPanel = 'config' | 'status' | 'chat' | 'memory' | 'cron' | 'skills';

const NAV_ITEMS: { id: HermesPanel; icon: any; label: string; badge?: string }[] = [
  { id: 'config', icon: Settings, label: 'Configuration' },
  { id: 'status', icon: Activity, label: 'Monitoring', badge: 'soon' },
  { id: 'chat', icon: MessageSquare, label: 'Chat', badge: 'soon' },
  { id: 'memory', icon: BrainCircuit, label: 'Mémoire', badge: 'soon' },
  { id: 'cron', icon: Clock, label: 'Cron Jobs', badge: 'soon' },
  { id: 'skills', icon: FolderCog, label: 'Skills', badge: 'soon' },
];

export default function HermesExtension({ isVisible }: { isVisible: boolean }) {
  const { config } = useConfig();
  const { status } = useHermesStatus(isVisible ? 15000 : 0);
  const [activePanel, setActivePanel] = useState<HermesPanel>('config');
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

  // Check if Hermes is configured
  useEffect(() => {
    if (!config) return;
    const s = config.settings || {};
    setIsConfigured(!!(s.hermesDataPath));
  }, [config]);

  const handleSetupComplete = useCallback(() => {
    setIsConfigured(true);
  }, []);

  if (!isVisible) return null;

  // Loading state
  if (isConfigured === null) {
    return (
      <div className="nd-hermes-loading">
        <div className="animate-spin" style={{ width: 20, height: 20, border: '2px solid var(--nd-text-dimmed)', borderTopColor: 'var(--nd-accent)', borderRadius: '50%' }} />
      </div>
    );
  }

  // Setup needed
  if (!isConfigured) {
    return <HermesSetup onComplete={handleSetupComplete} />;
  }

  const isRunning = status?.container?.running;

  return (
    <div className="nd-hermes">
      {/* Sidebar */}
      <nav className="nd-hermes-nav">
        <div className="nd-hermes-nav-header">
          <div className="nd-hermes-nav-logo">
            <span style={{ fontSize: '1.2rem' }}>🧠</span>
            <span>Hermes</span>
          </div>
          <div className={`nd-hermes-status-dot ${isRunning ? 'nd-hermes-status-dot--ok' : 'nd-hermes-status-dot--error'}`}
            title={isRunning ? 'En ligne' : 'Hors ligne'} />
        </div>

        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const active = activePanel === item.id;
          return (
            <button
              key={item.id}
              className={`nd-hermes-nav-item ${active ? 'nd-hermes-nav-item--active' : ''}`}
              onClick={() => setActivePanel(item.id)}
            >
              <Icon size={15} />
              <span>{item.label}</span>
              {item.badge && (
                <span className="nd-hermes-badge">{item.badge}</span>
              )}
              {active && <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.4 }} />}
            </button>
          );
        })}

        {/* Setup link at bottom */}
        <button
          className="nd-hermes-nav-item"
          style={{ marginTop: 'auto', opacity: 0.6 }}
          onClick={() => setIsConfigured(false)}
        >
          <Plug size={15} />
          <span>Reconfigurer</span>
        </button>
      </nav>

      {/* Panel content */}
      <main className="nd-hermes-main">
        {activePanel === 'config' && <HermesConfigPanel />}
        {activePanel === 'status' && <ComingSoon label="Monitoring" desc="Logs temps réel, statut conteneur, métriques" />}
        {activePanel === 'chat' && <ComingSoon label="Chat" desc="Conversation avec Hermes via l'API streaming" />}
        {activePanel === 'memory' && <ComingSoon label="Mémoire" desc="Éditeur MEMORY.md, USER.md et SOUL.md" />}
        {activePanel === 'cron' && <ComingSoon label="Cron Jobs" desc="Gestion des tâches planifiées" />}
        {activePanel === 'skills' && <ComingSoon label="Skills" desc="Liste et éditeur des compétences de l'agent" />}
      </main>
    </div>
  );
}

// Placeholder for upcoming panels
function ComingSoon({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="nd-hermes-loading" style={{ flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: '2rem', opacity: 0.3 }}>🚧</div>
      <h3 style={{ fontWeight: 700, fontSize: '0.85rem' }}>{label}</h3>
      <p style={{ color: 'var(--nd-text-muted)', fontSize: '0.7rem', maxWidth: 300, textAlign: 'center' }}>{desc}</p>
      <span className="nd-hermes-badge" style={{ fontSize: '0.6rem' }}>Phase 2</span>
    </div>
  );
}
