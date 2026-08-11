import React from 'react';
import { useTabs } from '@/hooks/useTabs';
import { Layout, Trash2, Edit2 } from 'lucide-react';
import ConfirmModal from '../../../ConfirmModal';
import EmojiPickerModal from '../../../EmojiPickerModal';
import { Emoji } from '../../../../shared/Emoji';
import { useConfig } from '@/hooks/useConfig';

interface CustomTabsListTabProps {
  onEditTab: (tabId?: string) => void;
}

export function CustomTabsListTab({ onEditTab }: CustomTabsListTabProps) {
  const { config, updateConfig } = useConfig();
  const { tabs, refreshTabs } = useTabs();
  const customTabs = tabs.filter(t => t.isCustom);
  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null);
  const [iconPickerTabId, setIconPickerTabId] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState('');

  const handleDelete = async (id: string) => {
    try {
      setActionError('');
      const response = await fetch(`/api/custom-tabs?id=${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error || `Suppression refusée (${response.status}).`);
      }
      refreshTabs();
    } catch (e) {
      console.error(e);
      setActionError(e instanceof Error ? e.message : 'Impossible de supprimer cet onglet.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {actionError && <div style={{ padding: 10, color: 'var(--nd-red)', border: '1px solid color-mix(in srgb, var(--nd-red) 30%, transparent)', borderRadius: 'var(--nd-card-radius)', fontSize: '0.7rem' }}>{actionError}</div>}
      <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
        <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>Onglets Libres</h4>
        <p style={{ margin: '4px 0 16px 0', fontSize: '0.7rem', color: 'var(--nd-text-muted)' }}>
          Créez vos propres pages de dashboard avec des layouts sur mesure, et ajoutez-y tous les widgets que vous souhaitez.
        </p>
        <button className="nd-btn nd-btn-primary" onClick={() => onEditTab()} style={{ width: '100%', justifyContent: 'center' }}>
          + Créer un nouvel onglet
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {customTabs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--nd-bg-alt)', borderRadius: 'var(--nd-card-radius)', border: '1px dashed var(--nd-card-border)' }}>
            <Layout size={32} style={{ color: 'var(--nd-text-muted)', marginBottom: 12, opacity: 0.5 }} />
            <h3 style={{ fontSize: '0.9rem', marginBottom: 4 }}>Aucun onglet libre</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--nd-text-muted)', marginBottom: 16 }}>Commencez par en créer un pour organiser vos widgets comme bon vous semble.</p>
            <button className="nd-btn nd-btn-primary" onClick={() => onEditTab()} style={{ margin: '0 auto' }}>
              Créer mon premier onglet
            </button>
          </div>
        ) : (
          customTabs.map(tab => (
            <div key={tab.id} className="nd-settings-card" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 150, flex: 1 }}>
                {/* Icon button — same style as CategoryFormModal / CustomTabBuilderTab */}
                <button
                  type="button"
                  onClick={() => setIconPickerTabId(tab.id)}
                  title="Changer l'icône"
                  className="nd-btn-hover-glow"
                  style={{
                    width: 38,
                    height: 38,
                    flexShrink: 0,
                    borderRadius: '10px',
                    border: '1px solid var(--nd-card-border)',
                    background: 'var(--nd-subcard-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    color: 'var(--nd-text)',
                    transition: 'all 0.2s',
                    outline: 'none',
                    padding: 0,
                    boxSizing: 'border-box',
                  }}
                >
                  <Emoji emoji={config?.settings?.tabIcons?.[tab.id] || tab.icon} />
                </button>
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tab.name}</h4>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="nd-btn" onClick={() => onEditTab(tab.id)}>
                  <Edit2 size={14} /> Éditer
                </button>
                <button className="nd-btn nd-btn-danger" onClick={() => setDeleteConfirm(tab.id)}>
                  <Trash2 size={14} /> Supprimer
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Icon Picker Modal */}
      {iconPickerTabId && (
        <EmojiPickerModal
          initialEmoji={config?.settings?.tabIcons?.[iconPickerTabId] || customTabs.find(t => t.id === iconPickerTabId)?.icon || ''}
          onSelect={async (emoji) => {
            await updateConfig({ tabIcons: { ...(config?.settings?.tabIcons || {}), [iconPickerTabId]: emoji } });
            // Also update the custom tab source of truth
            try {
              const response = await fetch('/api/custom-tabs', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'updateTab', id: iconPickerTabId, tabUpdates: { icon: emoji } }),
              });
              if (!response.ok) throw new Error(`Mise à jour refusée (${response.status}).`);
              refreshTabs();
            } catch (e) {
              console.error(e);
              setActionError(e instanceof Error ? e.message : 'Impossible de modifier l’icône.');
            }
            setIconPickerTabId(null);
          }}
          onClose={() => setIconPickerTabId(null)}
        />
      )}

      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) handleDelete(deleteConfirm);
          setDeleteConfirm(null);
        }}
        title="Supprimer cet onglet ?"
        description={`Voulez-vous vraiment supprimer l'onglet "${customTabs.find(t => t.id === deleteConfirm)?.name}" ? Cette action est irréversible.`}
      />
    </div>
  );
}
