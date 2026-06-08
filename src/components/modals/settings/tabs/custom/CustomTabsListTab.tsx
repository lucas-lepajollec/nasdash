import React from 'react';
import { useTabs } from '@/hooks/useTabs';
import { Layout, Plus, Trash2, Edit2 } from 'lucide-react';
import ConfirmModal from '../../../ConfirmModal';

interface CustomTabsListTabProps {
  onEditTab: (tabId?: string) => void;
}

export function CustomTabsListTab({ onEditTab }: CustomTabsListTabProps) {
  const { tabs, refreshTabs } = useTabs();
  const customTabs = tabs.filter(t => t.isCustom);
  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null);

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/custom-tabs?id=${id}`, { method: 'DELETE' });
      refreshTabs();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 'var(--nd-card-radius)', background: 'var(--nd-bg)', border: '1px solid var(--nd-card-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                  {tab.icon}
                </div>
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
