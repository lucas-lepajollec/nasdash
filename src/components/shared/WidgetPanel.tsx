'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { WidgetRenderer } from '../widgets/WidgetRenderer';
import { WIDGET_REGISTRY, getWidgetConfigKeys } from '@/lib/widgetRegistry';
import { useConfig } from '@/hooks/useConfig';
import { PanelWidgetConfig } from '@/lib/types';
import { ArrowUp, ArrowDown, Trash2, X, Settings, Plus } from 'lucide-react';
import { WidgetSelectionModal } from '@/components/modals/settings/tabs/custom/WidgetSelectionModal';

interface WidgetPanelProps {
  panelId: string;
  editMode: boolean;
  showSensitive: boolean;
  isVisible?: boolean;
}

export function WidgetPanel({ panelId, editMode, showSensitive, isVisible = true }: WidgetPanelProps) {
  const { config, updateConfig, user } = useConfig();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showSelectionModal, setShowSelectionModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!config) return null;

  const panel = config.settings?.panels?.[panelId] || { widgets: [] };

  // Filtrer les widgets autorisés pour l'utilisateur
  const allowedWidgets = (panel.widgets || []).filter((w: PanelWidgetConfig) => {
    // Vérification des permissions
    if (user && user.role !== 'admin' && user.allowedWidgets && user.allowedWidgets.length > 0) {
      if (!user.allowedWidgets.includes(w.type)) return false;
    }
    
    // Vérifier si le type de widget existe dans la registry
    const registryDef = WIDGET_REGISTRY.find(x => x.id === w.type);
    if (!registryDef) return false;

    // Vérifier si le widget est masqué globalement
    const hideKey = getWidgetConfigKeys(w.type).hide;
    const isGloballyHidden = (config.settings as any)?.[hideKey] ?? registryDef.defaultHidden;
    return !isGloballyHidden;
  });

  const getPanelName = (id: string) => {
    switch (id) {
      case 'home-left': return 'Panneau Gauche';
      case 'home-right': return 'Panneau Droit';
      case 'home-bottom': return 'Panneau Inférieur';
      case 'docker-widgets': return 'Widgets Docker';
      case 'networks-widgets': return 'Widgets Réseau';
      default: return id;
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const itemA = allowedWidgets[index];
    const itemB = allowedWidgets[index - 1];
    
    const fullIndexA = panel.widgets.findIndex((x: any) => x.id === itemA.id);
    const fullIndexB = panel.widgets.findIndex((x: any) => x.id === itemB.id);
    
    if (fullIndexA !== -1 && fullIndexB !== -1) {
      const newWidgets = [...panel.widgets];
      const temp = newWidgets[fullIndexA];
      newWidgets[fullIndexA] = newWidgets[fullIndexB];
      newWidgets[fullIndexB] = temp;
      saveWidgets(newWidgets);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index === allowedWidgets.length - 1) return;
    const itemA = allowedWidgets[index];
    const itemB = allowedWidgets[index + 1];
    
    const fullIndexA = panel.widgets.findIndex((x: any) => x.id === itemA.id);
    const fullIndexB = panel.widgets.findIndex((x: any) => x.id === itemB.id);
    
    if (fullIndexA !== -1 && fullIndexB !== -1) {
      const newWidgets = [...panel.widgets];
      const temp = newWidgets[fullIndexA];
      newWidgets[fullIndexA] = newWidgets[fullIndexB];
      newWidgets[fullIndexB] = temp;
      saveWidgets(newWidgets);
    }
  };

  const handleRemove = (instanceId: string) => {
    const newWidgets = panel.widgets.filter((w: any) => w.id !== instanceId);
    saveWidgets(newWidgets);
  };

  const saveWidgets = (newWidgets: any[]) => {
    const currentPanels = config.settings?.panels || {};
    updateConfig({
      panels: {
        ...currentPanels,
        [panelId]: {
          ...currentPanels[panelId],
          widgets: newWidgets
        }
      }
    });
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      width: '100%'
    }}>
      {editMode && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          paddingBottom: '8px', 
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          marginBottom: '8px',
          color: 'var(--nd-text-muted)',
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontWeight: 600
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Settings size={12} style={{ color: 'var(--nd-accent)' }} />
            {getPanelName(panelId)}
          </span>
          <button
            onClick={() => setIsModalOpen(true)}
            className="nd-btn"
            style={{
              padding: '2px 8px',
              fontSize: '0.68rem',
              height: 'auto',
              borderRadius: 'var(--nd-card-radius)',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              background: 'rgba(255, 255, 255, 0.02)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer'
            }}
          >
            Gérer
          </button>
        </div>
      )}

      {allowedWidgets.length > 0 ? (
        allowedWidgets.map((w: PanelWidgetConfig) => {
          const instanceId = w.id;
          const instanceProps = w.props || {};

          return (
            <React.Fragment key={instanceId}>
              <WidgetRenderer
                id={w.type}
                editMode={editMode}
                showSensitive={showSensitive}
                categories={config.categories}
                widgetInstanceId={instanceId}
                widgetProps={instanceProps}
                isVisible={isVisible}
                onUpdateProps={(newProps) => {
                  const currentPanels = config.settings?.panels || {};
                  const currentPanel = currentPanels[panelId] || { widgets: [] };
                  
                  const updatedWidgets = currentPanel.widgets.map((item: PanelWidgetConfig) => {
                    if (item.id === instanceId) {
                      return {
                        ...item,
                        props: {
                          ...(item.props || {}),
                          ...newProps
                        }
                      };
                    }
                    return item;
                  });

                  updateConfig({
                    panels: {
                      ...currentPanels,
                      [panelId]: {
                        ...currentPanel,
                        widgets: updatedWidgets
                      }
                    }
                  });
                }}
              />
            </React.Fragment>
          );
        })
      ) : (
        editMode && (
          <div style={{
            padding: '16px',
            textAlign: 'center',
            color: 'var(--nd-text-muted)',
            fontSize: '0.74rem',
            border: '1px dashed var(--nd-card-border)',
            borderRadius: 'var(--nd-card-radius)'
          }}>
            Aucun widget dans ce panneau.
          </div>
        )
      )}

      {/* Modal de gestion du panneau */}
      {isModalOpen && mounted && createPortal(
        <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }} style={{ zIndex: 99999 }}>
          <div className="nd-modal nd-animate-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, maxHeight: '80svh', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            {/* Header */}
            <div style={{ 
              padding: '16px 20px', 
              borderBottom: '1px solid var(--nd-card-border)', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              flexShrink: 0
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, letterSpacing: -0.2, color: 'var(--nd-text)' }}>
                  Gérer : {getPanelName(panelId)}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.62rem', color: 'var(--nd-text-muted)' }}>
                  Organisez et gérez les widgets actifs dans ce panneau.
                </p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                style={{ 
                  background: 'rgba(255,255,255,0.03)', 
                  border: '1px solid var(--nd-card-border)', 
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--nd-text-muted)', 
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  flexShrink: 0
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {allowedWidgets && allowedWidgets.length > 0 ? (
                allowedWidgets.map((w, index) => {
                  const regDef = WIDGET_REGISTRY.find(r => r.id === w.type);
                  return (
                    <div 
                      key={w.id} 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        background: 'rgba(255, 255, 255, 0.01)',
                        border: '1px solid var(--nd-card-border)',
                        borderRadius: 'var(--nd-card-radius)'
                      }}
                    >
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--nd-text)' }}>
                        <span style={{ fontSize: '1rem' }}>{regDef?.icon || '⚙️'}</span>
                        {regDef?.name || w.type}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          disabled={index === 0}
                          onClick={() => handleMoveUp(index)}
                          className="nd-btn"
                          style={{
                            padding: 6,
                            height: 'auto',
                            minWidth: 0,
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid var(--nd-card-border)',
                            borderRadius: 'var(--nd-card-radius)',
                            color: index === 0 ? 'rgba(255,255,255,0.05)' : 'var(--nd-text-muted)',
                            cursor: index === 0 ? 'not-allowed' : 'pointer'
                          }}
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          disabled={index === allowedWidgets.length - 1}
                          onClick={() => handleMoveDown(index)}
                          className="nd-btn"
                          style={{
                            padding: 6,
                            height: 'auto',
                            minWidth: 0,
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid var(--nd-card-border)',
                            borderRadius: 'var(--nd-card-radius)',
                            color: index === allowedWidgets.length - 1 ? 'rgba(255,255,255,0.05)' : 'var(--nd-text-muted)',
                            cursor: index === allowedWidgets.length - 1 ? 'not-allowed' : 'pointer'
                          }}
                        >
                          <ArrowDown size={12} />
                        </button>
                        <button
                          onClick={() => handleRemove(w.id)}
                          className="nd-btn"
                          style={{
                            padding: 6,
                            height: 'auto',
                            minWidth: 0,
                            background: 'rgba(239, 68, 68, 0.05)',
                            border: '1px solid rgba(239, 68, 68, 0.1)',
                            borderRadius: 'var(--nd-card-radius)',
                            color: 'var(--nd-red)',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--nd-text-muted)', fontSize: '0.74rem', border: '1px dashed var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                  Aucun widget actif dans ce panneau.
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ 
              padding: '12px 20px', 
              borderTop: '1px solid var(--nd-card-border)', 
              display: 'flex', 
              justifyContent: 'flex-end',
              flexShrink: 0
            }}>
              <button
                onClick={() => setShowSelectionModal(true)}
                className="nd-btn nd-btn-accent"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.72rem',
                  height: 28,
                  padding: '0 12px'
                }}
              >
                <Plus size={12} />
                Ajouter un widget
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* Modal de sélection de widget globale */}
      {showSelectionModal && (
        <WidgetSelectionModal
          onClose={() => setShowSelectionModal(false)}
          onSelect={(widgetInfo) => {
            const newInstanceId = `${widgetInfo.type}-${Date.now()}`;
            const newWidgets = [
              ...panel.widgets,
              { id: newInstanceId, type: widgetInfo.type, props: {} }
            ];
            saveWidgets(newWidgets);
            setShowSelectionModal(false);
          }}
        />
      )}
    </div>
  );
}
