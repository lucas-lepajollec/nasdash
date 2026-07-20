import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { CustomTabRow, CustomTabColumn, CustomTabRowType, CustomTabWidgetInfo } from '@/lib/types';
import { ChevronLeft, Plus, Save, Trash2, Layout, Type, GripVertical, Settings2 } from 'lucide-react';
import EmojiPickerModal from '../../../EmojiPickerModal';
import { Emoji } from '../../../../shared/Emoji';
import { useConfig } from '@/hooks/useConfig';
import { WidgetSelectionModal } from './WidgetSelectionModal';
import { WIDGET_REGISTRY, getWidgetConfigKeys } from '@/lib/widgetRegistry';

interface CustomTabBuilderTabProps {
  tabId?: string;
  onBack: () => void;
  onSuccess: () => void;
}

export function CustomTabBuilderTab({ tabId, onBack, onSuccess }: CustomTabBuilderTabProps) {
  const { config, updateConfig } = useConfig();
  const [currentTabId, setCurrentTabId] = useState<string | undefined>(tabId);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📝');
  const [rows, setRows] = useState<CustomTabRow[]>([]);
  const [loading, setLoading] = useState(!!tabId);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [widgetSelectorOpenForCol, setWidgetSelectorOpenForCol] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (currentTabId) {
      setLoading(true);
      fetch(`/api/custom-tabs`)
        .then(res => res.json())
        .then(data => {
          const tabDef = data.tabs.find((t: any) => t.id === currentTabId);
          if (tabDef) {
            setName(tabDef.name);
            setIcon(tabDef.icon || '📝');
          }
          const savedLayout = data.layouts[currentTabId];
          if (savedLayout && savedLayout.rows) {
            setRows(savedLayout.rows);
          }
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [currentTabId]);

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Veuillez donner un nom à votre onglet.');
      return;
    }

    try {
      setIsSaving(true);
      let res;
      if (currentTabId) {
        // Update existing tab
        res = await fetch('/api/custom-tabs', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'updateTab',
            id: currentTabId,
            tabUpdates: { name, icon },
            layoutUpdates: { rows }
          })
        });
      } else {
        // Create new tab
        res = await fetch('/api/custom-tabs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'createTab',
            name,
            icon,
            description: 'Onglet personnalisé',
            layout: { rows }
          })
        });
      }

      if (res.ok) {
        let savedTabId = currentTabId;
        if (!currentTabId) {
          const data = await res.json();
          savedTabId = data.tab.id;
          setCurrentTabId(savedTabId);
        }
        
        // Sync the icon with config so it reflects immediately everywhere
        if (savedTabId) {
          await updateConfig({ tabIcons: { ...config?.settings?.tabIcons, [savedTabId]: icon } });
        }

        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } else {
        const errorData = await res.json();
        alert(`Erreur: ${errorData.error || 'Erreur lors de la sauvegarde.'}`);
      }
    } catch (e) {
      console.error(e);
      alert("Erreur réseau.");
    } finally {
      setIsSaving(false);
    }
  };

  const createRow = (type: CustomTabRowType): CustomTabRow => {
    const id = uuidv4();
    let cols: CustomTabColumn[] = [];
    if (type === '1-col') cols = [{ id: uuidv4(), width: '100%', content: null }];
    else if (type === '50-50') cols = [{ id: uuidv4(), width: '50%', content: null }, { id: uuidv4(), width: '50%', content: null }];
    else if (type === '25-75') cols = [{ id: uuidv4(), width: '25%', content: null }, { id: uuidv4(), width: '75%', content: null }];
    else if (type === '75-25') cols = [{ id: uuidv4(), width: '75%', content: null }, { id: uuidv4(), width: '25%', content: null }];
    else if (type === '3-col') cols = [{ id: uuidv4(), width: '33.33%', content: null }, { id: uuidv4(), width: '33.33%', content: null }, { id: uuidv4(), width: '33.33%', content: null }];
    return { id, type, columns: cols };
  };

  const addRow = (type: CustomTabRowType) => {
    setRows([...rows, createRow(type)]);
  };

  const removeRow = (rowId: string) => {
    setRows(rows.filter(r => r.id !== rowId));
  };

  const addWidgetToColumn = (colId: string, widget: CustomTabWidgetInfo) => {
    setRows(rows.map(row => ({
      ...row,
      columns: row.columns.map(col => {
        if (col.id === colId) {
          const currentWidgets = col.widgets || [];
          if (col.content && !col.widgets && !('columns' in col.content)) {
            // Migration legacy content
            currentWidgets.push(col.content as CustomTabWidgetInfo);
            col.content = null;
          }
          return { ...col, widgets: [...currentWidgets, widget], content: null };
        }
        return col;
      })
    })));
    setWidgetSelectorOpenForCol(null);
  };

  const removeWidgetFromColumn = (colId: string, widgetIndex: number) => {
    setRows(rows.map(row => ({
      ...row,
      columns: row.columns.map(col => {
        if (col.id === colId) {
          let currentWidgets = col.widgets || [];
          if (col.content && !col.widgets && !('columns' in col.content)) {
             currentWidgets = [col.content as CustomTabWidgetInfo];
          }
          currentWidgets = currentWidgets.filter((_, i) => i !== widgetIndex);
          return { ...col, widgets: currentWidgets.length > 0 ? currentWidgets : undefined, content: null };
        }
        return col;
      })
    })));
  };

  const renderWidgetPreview = (widget: CustomTabWidgetInfo): React.ReactNode => {
    const def = WIDGET_REGISTRY.find(w => w.id === widget.type);
    const isGloballyHidden = (() => {
      if (!def) return false;
      const hideKey = getWidgetConfigKeys(widget.type).hide;
      return (config?.settings as any)?.[hideKey] ?? def.defaultHidden;
    })();

    let emoji = '🧩';
    let name = 'Widget';
    switch (widget.type) {
      case 'clock': emoji = '🕒'; name = 'Horloge'; break;
      case 'weather': emoji = '🌤️'; name = 'Météo'; break;
      case 'quickstats': emoji = '📊'; name = 'Vue d\'ensemble'; break;
      case 'devices': emoji = '🖥️'; name = 'Appareils'; break;
      case 'tailscale': emoji = '🛡️'; name = 'Tailscale'; break;
      case 'dockeractions': emoji = '🐳'; name = 'Actions Docker'; break;
      case 'calendar': emoji = '📅'; name = 'Calendrier'; break;
      case 'networkgraph': emoji = '📶'; name = 'Graphe Réseau'; break;
      case 'dockercontainers': emoji = '🐳'; name = 'Conteneurs Docker'; break;
      default: emoji = '🧩'; name = `Widget Inconnu (${widget.type})`; break;
    }

    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Emoji emoji={emoji} />
        <span>{name}</span>
        {isGloballyHidden && <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>(Désactivé)</span>}
      </span>
    );
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Chargement...</div>;

  return (
    <div className="nd-animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      
      {/* Propriétés de base */}
      <div className="nd-settings-card" style={{ padding: '20px', display: 'flex', flexWrap: 'nowrap', gap: '16px', alignItems: 'flex-end', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label className="nd-label">Nom de l&apos;onglet</label>
          <input className="nd-input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Multimédia" style={{ width: '100%', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
          <label className="nd-label" style={{ whiteSpace: 'nowrap', margin: 0, marginBottom: 6 }}>Icône</label>
          <button 
            type="button"
            className="nd-btn-hover-glow" 
            style={{
              width: 38,
              height: 38,
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
              boxSizing: 'border-box'
            }}
            onClick={() => setIsEmojiPickerOpen(true)}
          >
            <Emoji emoji={icon} />
          </button>
        </div>
        <button 
          className="nd-btn nd-btn-outline-accent" 
          onClick={handleSave} 
          disabled={isSaving} 
          style={{ 
            flex: '1 1 auto', 
            height: '42px', 
            padding: '0 24px', 
            justifyContent: 'center',
            background: saveSuccess ? 'var(--nd-success, #2ea043)' : undefined,
            borderColor: saveSuccess ? 'var(--nd-success, #2ea043)' : undefined,
            color: saveSuccess ? '#fff' : undefined,
          }}
        >
          <Save size={16} style={{ marginRight: 8 }} /> {isSaving ? 'Enregistrement...' : saveSuccess ? 'Enregistré !' : 'Enregistrer'}
        </button>
      </div>

        {/* Builder UI */}
        <h3 style={{ fontSize: '1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layout size={18} color="var(--nd-accent)" /> 
          Structure de la page
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
          {rows.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', background: 'var(--nd-bg-alt)', borderRadius: 'var(--nd-card-radius)', border: '1px dashed var(--nd-card-border)' }}>
              <p style={{ color: 'var(--nd-text-muted)', marginBottom: '16px' }}>Votre onglet est vide. Ajoutez une rangée pour commencer.</p>
            </div>
          )}

          {rows.map((row, rIndex) => {
            const getGridTemplateColumns = (r: CustomTabRow) => {
              if (r.columns.length === 1) return '1fr';
              if (r.columns.length === 3) return '1fr 1fr 1fr';
              if (r.columns.length === 2) {
                const w1 = r.columns[0].width;
                const w2 = r.columns[1].width;
                if (w1 === '50%' && w2 === '50%') return '1fr 1fr';
                if (w1 === '25%' && w2 === '75%') return '1fr 3fr';
                if (w1 === '75%' && w2 === '25%') return '3fr 1fr';
              }
              return r.columns.map(c => c.width).join(' ');
            };

            return (
            <div key={row.id} style={{ display: 'grid', gridTemplateColumns: getGridTemplateColumns(row), gap: '16px', position: 'relative', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: 'var(--nd-card-radius)', border: '1px solid var(--nd-card-border)', minWidth: 0 }}>
              
              {/* Row controls */}
              <div style={{ position: 'absolute', top: '-10px', right: '-10px', display: 'flex', gap: 4, zIndex: 10 }}>
                <button 
                  onClick={() => removeRow(row.id)}
                  className="nd-btn nd-btn-danger" 
                  style={{ width: 28, height: 28, padding: 0, borderRadius: '50%', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}
                  title="Supprimer la rangée"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {row.columns.map((col, cIndex) => {
                let currentWidgets = col.widgets || [];
                if (col.content && !col.widgets && !('columns' in col.content)) {
                  currentWidgets = [col.content as CustomTabWidgetInfo];
                }

                return (
                  <div key={col.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
                    
                    {currentWidgets.map((widget, wIndex) => {
                      const def = WIDGET_REGISTRY.find(w => w.id === widget.type);
                      const isGloballyHidden = def ? ((config?.settings as any)?.[getWidgetConfigKeys(widget.type).hide] ?? def.defaultHidden) : false;
                      
                      return (
                        <div key={wIndex} style={{ 
                          background: 'var(--nd-bg)', 
                          border: '1px solid var(--nd-card-border)', 
                          borderRadius: '8px', 
                          padding: '16px', 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          minWidth: 0,
                          opacity: isGloballyHidden ? 0.5 : 1
                        }}>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginRight: '8px' }}>{renderWidgetPreview(widget)}</span>
                          <button onClick={() => removeWidgetFromColumn(col.id, wIndex)} className="nd-btn" style={{ padding: 4, color: 'var(--nd-text-muted)' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}

                    <button 
                      onClick={() => setWidgetSelectorOpenForCol(col.id)}
                      className="nd-btn" 
                      style={{ height: '60px', border: '1px dashed var(--nd-card-border)', background: 'transparent', display: 'flex', justifyContent: 'center', color: 'var(--nd-text-muted)', minWidth: 0, overflow: 'hidden' }}
                    >
                      <Plus size={16} style={{ flexShrink: 0, marginRight: 6 }} /> <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Ajouter un widget</span>
                    </button>

                  </div>
                );
              })}
            </div>
            );
          })}
        </div>

        {/* Add Row Section */}
        <div className="nd-settings-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--nd-text-muted)' }}>Ajouter une rangée</span>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="nd-btn" onClick={() => addRow('1-col')} title="1 Colonne (100%)">
              <div style={{ width: 40, height: 20, background: 'var(--nd-card-border)', borderRadius: 4 }}></div>
            </button>
            <button className="nd-btn" onClick={() => addRow('50-50')} title="2 Colonnes (50% / 50%)">
              <div style={{ display: 'flex', gap: 4, width: 40 }}>
                <div style={{ flex: 1, height: 20, background: 'var(--nd-card-border)', borderRadius: 4 }}></div>
                <div style={{ flex: 1, height: 20, background: 'var(--nd-card-border)', borderRadius: 4 }}></div>
              </div>
            </button>
            <button className="nd-btn" onClick={() => addRow('3-col')} title="3 Colonnes (33% / 33% / 33%)">
              <div style={{ display: 'flex', gap: 2, width: 40 }}>
                <div style={{ flex: 1, height: 20, background: 'var(--nd-card-border)', borderRadius: 4 }}></div>
                <div style={{ flex: 1, height: 20, background: 'var(--nd-card-border)', borderRadius: 4 }}></div>
                <div style={{ flex: 1, height: 20, background: 'var(--nd-card-border)', borderRadius: 4 }}></div>
              </div>
            </button>
            <button className="nd-btn" onClick={() => addRow('25-75')} title="2 Colonnes (25% / 75%)">
              <div style={{ display: 'flex', gap: 4, width: 40 }}>
                <div style={{ flex: 1, height: 20, background: 'var(--nd-card-border)', borderRadius: 4 }}></div>
                <div style={{ flex: 3, height: 20, background: 'var(--nd-card-border)', borderRadius: 4 }}></div>
              </div>
            </button>
            <button className="nd-btn" onClick={() => addRow('75-25')} title="2 Colonnes (75% / 25%)">
              <div style={{ display: 'flex', gap: 4, width: 40 }}>
                <div style={{ flex: 3, height: 20, background: 'var(--nd-card-border)', borderRadius: 4 }}></div>
                <div style={{ flex: 1, height: 20, background: 'var(--nd-card-border)', borderRadius: 4 }}></div>
              </div>
            </button>
          </div>
        </div>

      {isEmojiPickerOpen && (
        <EmojiPickerModal
          onClose={() => setIsEmojiPickerOpen(false)}
          onSelect={(e) => { setIcon(e); setIsEmojiPickerOpen(false); }}
        />
      )}

      {widgetSelectorOpenForCol && (
        <WidgetSelectionModal 
          onClose={() => setWidgetSelectorOpenForCol(null)}
          onSelect={(w) => addWidgetToColumn(widgetSelectorOpenForCol, w)}
        />
      )}
    </div>
  );
}
