import React, { useState, useEffect } from 'react';
import { CustomTabRow, CustomTabColumn, CustomTabWidgetInfo, CustomTabLayout } from '@/lib/types';
import { TabDef, globalLayoutCache } from '@/hooks/useTabs';
import { useConfig } from '@/hooks/useConfig';

import { WidgetRenderer } from '../../widgets/WidgetRenderer';
import { Settings2, Plus, PenTool } from 'lucide-react';
import { WIDGET_REGISTRY, getWidgetConfigKeys } from '@/lib/widgetRegistry';
import { useI18n } from '@/i18n/I18nProvider';

interface CustomTabRendererProps {
  tab: TabDef;
  editMode: boolean;
  showSensitive?: boolean;
  isVisible?: boolean;
}

export default function CustomTabRenderer({ tab, editMode, showSensitive = false, isVisible = true }: CustomTabRendererProps) {
  const { t } = useI18n();
  const { config, setSettingsModal, user } = useConfig();
  const [layout, setLayout] = useState<CustomTabLayout | null>(globalLayoutCache[tab.id] || null);

  useEffect(() => {
    // Synchroniser immédiatement depuis le cache global
    if (globalLayoutCache[tab.id]) {
      setLayout(globalLayoutCache[tab.id]);
    }

    const fetchLayout = async () => {
      try {
        const res = await fetch('/api/custom-tabs');
        if (res.ok) {
          const data = await res.json();
          if (data.layouts && data.layouts[tab.id]) {
            const fetched = data.layouts[tab.id];
            globalLayoutCache[tab.id] = fetched;
            setLayout(fetched);
          }
        }
      } catch (e) {
        console.error('Failed to fetch custom tab layout', e);
      }
    };

    if (!globalLayoutCache[tab.id]) {
      fetchLayout();
    }
    
    const handleUpdate = () => fetchLayout();
    window.addEventListener('customTabsUpdated', handleUpdate);
    return () => window.removeEventListener('customTabsUpdated', handleUpdate);
  }, [tab.id]);


  const getLayoutSize = (widthStr: string): 'small' | 'medium' | 'full' => {
    const w = parseInt(widthStr, 10);
    if (w <= 33) return 'small';
    if (w <= 60) return 'medium';
    return 'full';
  };

  const handleUpdateSpacerHeight = async (rowId: string, colId: string, widgetIndex: number, newHeight: number) => {
    if (!layout) return;
    const previousLayout = layout;
    const newLayout = JSON.parse(JSON.stringify(layout)); // Deep copy
    const row = newLayout.rows.find((r: CustomTabRow) => r.id === rowId);
    if (!row) return;
    const col = row.columns.find((c: CustomTabColumn) => c.id === colId);
    if (!col || !col.widgets) return;
    
    col.widgets[widgetIndex].height = newHeight;
    globalLayoutCache[tab.id] = newLayout;
    setLayout(newLayout);

    try {
      const response = await fetch('/api/custom-tabs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tab.id, layout: newLayout })
      });
      if (!response.ok) throw new Error(`Mise à jour refusée (${response.status}).`);
      // Silent update, no need to trigger full refresh to avoid flicker during slider drag
    } catch (e) {
      console.error('Failed to save spacer height', e);
      globalLayoutCache[tab.id] = previousLayout;
      setLayout(previousLayout);
    }
  };

  const handleUpdateWidgetProps = async (rowId: string, colId: string, widgetIndex: number, newProps: any) => {
    if (!layout) return;
    const previousLayout = layout;
    const newLayout = JSON.parse(JSON.stringify(layout)); // Deep copy
    const row = newLayout.rows.find((r: CustomTabRow) => r.id === rowId);
    if (!row) return;
    const col = row.columns.find((c: CustomTabColumn) => c.id === colId);
    if (!col || !col.widgets) return;
    
    col.widgets[widgetIndex].props = { ...(col.widgets[widgetIndex].props || {}), ...newProps };
    globalLayoutCache[tab.id] = newLayout;
    setLayout(newLayout);

    try {
      const response = await fetch('/api/custom-tabs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tab.id, layout: newLayout })
      });
      if (!response.ok) throw new Error(`Mise à jour refusée (${response.status}).`);
    } catch (e) {
      console.error('Failed to save widget props', e);
      globalLayoutCache[tab.id] = previousLayout;
      setLayout(previousLayout);
    }
  };

  const renderWidget = (info: CustomTabWidgetInfo, size: 'small' | 'medium' | 'full', rowId: string, colId: string, index: number) => {
    if (info.type === 'spacer') {
      return (
        <div style={{
          height: info.height || 120,
          minHeight: editMode ? 60 : undefined,
          width: '100%',
          background: editMode ? 'rgba(255,255,255,0.02)' : 'transparent',
          border: editMode ? '1px dashed var(--nd-card-border)' : 'none',
          borderRadius: 'var(--nd-card-radius)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: editMode ? 'none' : 'all 0.2s',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {editMode && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '80%' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--nd-text-muted)', fontWeight: 600 }}>
                {t("Espace (")}{info.height || 120}px)
              </span>
              <input 
                type="range" 
                min="20" 
                max="1000" 
                step="10" 
                value={info.height || 120}
                onChange={(e) => handleUpdateSpacerHeight(rowId, colId, index, parseInt(e.target.value))}
                style={{ width: '100%', cursor: 'ew-resize', accentColor: 'var(--nd-accent)' }}
              />
            </div>
          )}
        </div>
      );
    }
    
    return <WidgetRenderer id={info.type} layoutSize={size} editMode={editMode} showSensitive={showSensitive} widgetInstanceId={`${rowId}-${colId}-${index}`} widgetProps={info.props} isVisible={isVisible} onUpdateProps={(newProps) => handleUpdateWidgetProps(rowId, colId, index, newProps)} />;
  };

  const renderRow = (row: CustomTabRow) => {
    return (
      <div key={row.id} style={{
        display: 'flex',
        flexWrap: 'wrap', // Responsive behavior
        gap: '16px',
        marginBottom: '16px',
        width: '100%'
      }}>
        {row.columns.map(col => {
          const size = getLayoutSize(col.width);
          
          let currentWidgets = col.widgets || [];
          if (col.content && !col.widgets && !('columns' in col.content)) {
            // Legacy widget
            currentWidgets = [col.content as CustomTabWidgetInfo];
          }

          return (
            <div key={col.id} className="nd-custom-column" style={{
              flex: `1 1 calc(${col.width} - 16px)`,
              minWidth: '280px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              {col.content && 'columns' in col.content && (
                // Nested Row
                <div style={{ flex: 1 }}>
                  {renderRow(col.content as CustomTabRow)}
                </div>
              )}

              {currentWidgets.filter(w => {
                if (w.type === 'spacer') return true;
                const def = WIDGET_REGISTRY.find(x => x.id === w.type);
                if (!def) return false;
                
                const isAllowed = !user || user.role === 'admin' || !user.allowedWidgets || user.allowedWidgets.length === 0 || user.allowedWidgets.includes(w.type);
                if (!isAllowed) return false;

                const hideKey = getWidgetConfigKeys(w.type).hide;
                const isGloballyHidden = (config?.settings as any)?.[hideKey] ?? def.defaultHidden;
                return !isGloballyHidden;
              }).map((widget, i) => (
                <div key={i} className={widget.type === 'spacer' ? 'nd-spacer-widget' : ''} style={{ width: '100%' }}>
                  {renderWidget(widget, size, row.id, col.id, i)}
                </div>
              ))}

              {/* Show empty slot indicator only in edit mode if empty */}
              {editMode && currentWidgets.length === 0 && !(col.content && 'columns' in col.content) && (
                <div style={{
                  flex: 1,
                  minHeight: '120px',
                  border: '2px dashed var(--nd-accent)',
                  borderRadius: 'var(--nd-card-radius)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(var(--nd-accent-rgb), 0.05)',
                  flexDirection: 'column',
                  gap: 8,
                  opacity: 0.7
                }}>
                  <Settings2 size={24} color="var(--nd-accent)" />
                  <span style={{ fontSize: '0.8rem', color: 'var(--nd-accent)' }}>{t("Éditez l'onglet dans les paramètres")}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (!layout) {
    return <div style={{ padding: '0 20px 40px', textAlign: 'center', color: 'var(--nd-text-muted)' }}>{t("Chargement du layout...")}</div>;
  }

  return (
    <div className="nd-animate-in" style={{ width: '100%', padding: '0 clamp(12px, 3vw, 20px) 40px', margin: '0 auto', overflowX: 'hidden' }}>
      {layout.rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--nd-text-muted)' }}>
          <p>{t("Ce layout est vide.")}</p>
          <p style={{ fontSize: '0.8rem' }}>{t("Allez dans les paramètres de l'onglet pour construire le layout.")}</p>
        </div>
      ) : (
        layout.rows.map(r => renderRow(r))
      )}
    </div>
  );
}
