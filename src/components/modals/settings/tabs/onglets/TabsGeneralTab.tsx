import React, { useState } from 'react';
import { ArrowUp, ArrowDown, Ban } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useTabs } from '@/hooks/useTabs';
import { ToggleSwitch } from '../../shared/ToggleSwitch';
import EmojiPickerModal from '../../../EmojiPickerModal';
import { Emoji } from '../../../../shared/Emoji';

export function TabsGeneralTab() {
  const { config, updateConfig } = useConfig();
  const { tabs, refreshTabs } = useTabs();

  const [iconPickerTabId, setIconPickerTabId] = useState<string | null>(null);

  const tabOrder = (() => {
    const savedOrder = config?.settings?.tabOrder || [];
    const savedSet = new Set(savedOrder);
    const newTabs = tabs.map(t => t.id).filter(id => !savedSet.has(id));
    return savedOrder.length > 0 ? [...savedOrder, ...newTabs] : tabs.map(t => t.id);
  })();
  const hiddenTabs = config?.settings?.hiddenTabs || [];

  const handleToggleTabHidden = async (id: string) => {
    const newHidden = hiddenTabs.includes(id) 
      ? hiddenTabs.filter((h: string) => h !== id)
      : [...hiddenTabs, id];
    await updateConfig({ hiddenTabs: newHidden });
  };

  const handleMoveTab = async (id: string, direction: 'up' | 'down') => {
    const currentIndex = tabOrder.indexOf(id);
    if (currentIndex === -1) return;
    const newOrder = [...tabOrder];
    if (direction === 'up' && currentIndex > 0) {
      [newOrder[currentIndex - 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex - 1]];
    } else if (direction === 'down' && currentIndex < newOrder.length - 1) {
      [newOrder[currentIndex + 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex + 1]];
    }
    await updateConfig({ tabOrder: newOrder });
  };

  const commonIcons = ['🏠', '📊', '🛡️', '🐳', '⌚', '📅', '☁️', '⚙️', '📂', '📝', '🔔', '🚀', '🛠️', '💡', '🎵', '📺'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
        <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>Position du Dock</h4>
        <p style={{ margin: '4px 0 12px 0', fontSize: '0.7rem', color: 'var(--nd-text-muted)' }}>
          Choisissez où s'affiche la barre de navigation principale.
        </p>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <button 
            onClick={() => updateConfig({ dockPosition: 'left' })}
            className={`nd-btn ${config?.settings?.dockPosition !== 'right' ? 'nd-settings-nav-item--active' : ''}`}
            style={{ flex: 1, padding: '8px 12px', fontSize: '0.75rem', justifyContent: 'center', border: config?.settings?.dockPosition !== 'right' ? '1px solid var(--nd-accent)' : '1px solid var(--nd-card-border)', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Emoji emoji="⬅️" /> À gauche
          </button>
          <button 
            onClick={() => updateConfig({ dockPosition: 'right' })}
            className={`nd-btn ${config?.settings?.dockPosition === 'right' ? 'nd-settings-nav-item--active' : ''}`}
            style={{ flex: 1, padding: '8px 12px', fontSize: '0.75rem', justifyContent: 'center', border: config?.settings?.dockPosition === 'right' ? '1px solid var(--nd-accent)' : '1px solid var(--nd-card-border)', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            À droite <Emoji emoji="➡️" />
          </button>
        </div>
        <div style={{ borderTop: '1px solid var(--nd-card-border)', paddingTop: 16 }}>
          <ToggleSwitch 
            checked={!config?.settings?.hideDock}
            onChange={(val) => updateConfig({ hideDock: !val })}
            label="Activer le Dock"
            sublabel="Affiche la barre de navigation principale (mode Dock)."
          />
        </div>
      </div>

      <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
        <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>Gestion des Onglets</h4>
        <p style={{ margin: '4px 0 16px 0', fontSize: '0.7rem', color: 'var(--nd-text-muted)' }}>
          Activez/désactivez les onglets, modifiez leurs icônes, et utilisez les flèches pour les réorganiser.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(tabOrder.length > 0 ? tabOrder : tabs.map(t => t.id)).map((tabId, idx) => {
            const t = tabs.find(t => t.id === tabId);
            if (!t) return null;
            const isHidden = hiddenTabs.includes(t.id);
            return (
              <div key={t.id} style={{ display: 'flex', flexDirection: 'column', padding: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
                  <ToggleSwitch 
                    checked={!isHidden}
                    onChange={(val) => handleToggleTabHidden(t.id)}
                    label={t.name}
                    sublabel={`Statut : ${!isHidden ? 'Actif dans le dock' : 'Masqué'}`}
                  />
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', opacity: !isHidden ? 1 : 0.5, transition: 'opacity 0.2s', flexWrap: 'wrap' }}>
                    <button onClick={() => handleMoveTab(t.id, 'up')} disabled={idx === 0} style={{ padding: '6px 10px', background: 'var(--nd-bg-alt)', border: '1px solid var(--nd-card-border)', borderRadius: '6px', cursor: idx === 0 ? 'not-allowed' : 'pointer', color: idx === 0 ? 'var(--nd-text-muted)' : 'var(--nd-text)', opacity: idx === 0 ? 0.3 : 1, display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }} title="Monter">
                      <ArrowUp size={14} /> Monter
                    </button>
                    <button onClick={() => handleMoveTab(t.id, 'down')} disabled={idx === (tabOrder.length > 0 ? tabOrder.length : tabs.length) - 1} style={{ padding: '6px 10px', background: 'var(--nd-bg-alt)', border: '1px solid var(--nd-card-border)', borderRadius: '6px', cursor: idx === (tabOrder.length > 0 ? tabOrder.length : tabs.length) - 1 ? 'not-allowed' : 'pointer', color: idx === (tabOrder.length > 0 ? tabOrder.length : tabs.length) - 1 ? 'var(--nd-text-muted)' : 'var(--nd-text)', opacity: idx === (tabOrder.length > 0 ? tabOrder.length : tabs.length) - 1 ? 0.3 : 1, display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }} title="Descendre">
                      Descendre <ArrowDown size={14} />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: !isHidden ? 1 : 0.5, transition: 'opacity 0.2s', borderTop: '1px dashed var(--nd-card-border)', paddingTop: 12 }}>
                   <span style={{ fontSize: '0.75rem', color: 'var(--nd-text-muted)' }}>Icône du dock :</span>
                     <button
                       onClick={() => setIconPickerTabId(t.id)}
                       style={{
                         background: 'var(--nd-bg-alt)',
                         padding: '4px 8px',
                         border: '1px solid var(--nd-card-border)',
                         borderRadius: '6px',
                         color: 'var(--nd-text)',
                         fontSize: '0.9rem',
                         cursor: 'pointer',
                         display: 'flex',
                         alignItems: 'center',
                         gap: 8,
                         transition: 'all 0.2s'
                       }}
                     >
                       {(() => {
                         const iconVal = config?.settings?.tabIcons?.[t.id] !== undefined ? config?.settings?.tabIcons?.[t.id] : t.icon;
                         return iconVal ? <Emoji emoji={iconVal} /> : <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--nd-text-muted)' }}><Ban size={14} /><span style={{ fontSize: '0.75rem' }}>Aucune</span></div>;
                       })()}
                       <span style={{ fontSize: '0.65rem', color: 'var(--nd-text-muted)', marginLeft: 6 }}>Modifier</span>
                     </button>
                     
                  </div>
                </div>
            );
          })}
        </div>

      </div>

      {/* Icon Picker Modal */}
      {iconPickerTabId && (
        <EmojiPickerModal
          initialEmoji={config?.settings?.tabIcons?.[iconPickerTabId] || ''}
          onSelect={async (icon: string) => {
            await updateConfig({ tabIcons: { ...config?.settings?.tabIcons, [iconPickerTabId]: icon } });
            
            // S'il s'agit d'un onglet personnalisé, on met aussi à jour la source de vérité
            const isCustomTab = !['dashboard', 'widgets', 'docker'].includes(iconPickerTabId);
            if (isCustomTab) {
              try {
                await fetch('/api/custom-tabs', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    type: 'updateTab',
                    id: iconPickerTabId,
                    tabUpdates: { icon }
                  })
                });
                window.dispatchEvent(new Event('customTabsUpdated'));
              } catch (e) {
                console.error("Failed to sync custom tab icon", e);
              }
            }
          }}
          onClose={() => setIconPickerTabId(null)}
          title={`Choisir l'icône de ${tabs.find(t => t.id === iconPickerTabId)?.name || 'l\'onglet'}`}
        />
      )}


    </div>
  );
}
