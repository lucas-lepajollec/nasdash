import React, { useState } from 'react';
import { ArrowUp, ArrowDown, Ban } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useTabs } from '@/hooks/useTabs';
import { ToggleSwitch } from '../../shared/ToggleSwitch';

export function TabsGeneralTab() {
  const { config, updateConfig } = useConfig();
  const { tabs } = useTabs();

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
        <div style={{ display: 'flex', gap: 12 }}>
          <button 
            onClick={() => updateConfig({ dockPosition: 'left' })}
            className={`nd-btn ${config?.settings?.dockPosition !== 'right' ? 'nd-settings-nav-item--active' : ''}`}
            style={{ flex: 1, padding: '8px 12px', fontSize: '0.75rem', justifyContent: 'center', border: config?.settings?.dockPosition !== 'right' ? '1px solid var(--nd-accent)' : '1px solid var(--nd-card-border)' }}
          >
            ⬅️ À gauche
          </button>
          <button 
            onClick={() => updateConfig({ dockPosition: 'right' })}
            className={`nd-btn ${config?.settings?.dockPosition === 'right' ? 'nd-settings-nav-item--active' : ''}`}
            style={{ flex: 1, padding: '8px 12px', fontSize: '0.75rem', justifyContent: 'center', border: config?.settings?.dockPosition === 'right' ? '1px solid var(--nd-accent)' : '1px solid var(--nd-card-border)' }}
          >
            À droite ➡️
          </button>
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
                       return iconVal ? <span style={{ fontSize: '1rem' }}>{iconVal}</span> : <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--nd-text-muted)' }}><Ban size={14} /><span style={{ fontSize: '0.75rem' }}>Aucune</span></div>;
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setIconPickerTabId(null)} />
          <div className="nd-settings-card" style={{ position: 'relative', width: '100%', maxWidth: '300px', background: 'var(--nd-bg)', padding: '20px', borderRadius: 'var(--nd-card-radius)', border: '1px solid var(--nd-card-border)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
             <h4 style={{ margin: '0 0 16px 0', fontSize: '0.9rem', textAlign: 'center' }}>Choisir une icône</h4>
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
               <button
                 onClick={async () => {
                   await updateConfig({ tabIcons: { ...config?.settings?.tabIcons, [iconPickerTabId]: '' } });
                   setIconPickerTabId(null);
                 }}
                 style={{ background: 'var(--nd-bg-alt)', border: '1px solid var(--nd-card-border)', borderRadius: '8px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexDirection: 'column', gap: 4 }}
                 title="Aucune icône"
               >
                 <Ban size={18} color="var(--nd-text-muted)" />
               </button>
               {commonIcons.map(icon => (
                 <button
                   key={icon}
                   onClick={async () => {
                     await updateConfig({ tabIcons: { ...config?.settings?.tabIcons, [iconPickerTabId]: icon } });
                     setIconPickerTabId(null);
                   }}
                   style={{ background: 'var(--nd-bg-alt)', border: '1px solid var(--nd-card-border)', borderRadius: '8px', padding: '10px', fontSize: '1.2rem', cursor: 'pointer', transition: 'all 0.2s' }}
                 >
                   {icon}
                 </button>
               ))}
             </div>
             <button onClick={() => setIconPickerTabId(null)} className="nd-btn" style={{ width: '100%', marginTop: 20, justifyContent: 'center', background: 'rgba(255,255,255,0.05)' }}>
               Fermer
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
