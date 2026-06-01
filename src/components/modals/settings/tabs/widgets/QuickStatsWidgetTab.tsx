import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { ToggleSwitch } from '../../shared/ToggleSwitch';

export function QuickStatsWidgetTab() {
  const { config, updateConfig } = useConfig();

  const hideQuickStats = !!config?.settings?.hideQuickStats;
  const quickStatsSidebar = config?.settings?.quickStatsSidebar || 'right';
  const quickStatsOrder = config?.settings?.quickStatsOrder ?? 1;

  const handleToggleWidget = async (key: string, value: boolean) => {
    await updateConfig({ [key]: value });
  };

  const handleWidgetPosition = async (widgetKey: string, sidebar: 'left' | 'right') => {
    await updateConfig({ [`${widgetKey}Sidebar`]: sidebar });
  };

  const handleWidgetOrder = async (widgetKey: string, order: number) => {
    await updateConfig({ [`${widgetKey}Order`]: order });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
        <ToggleSwitch
          checked={!hideQuickStats}
          onChange={(val) => handleToggleWidget('hideQuickStats', !val)}
          label="Activer le widget Vue d'ensemble"
          sublabel="Choisissez si le résumé des statistiques du dashboard doit s'afficher dans une barre latérale."
        />
      </div>

      {!hideQuickStats && (
        <>
          <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>Panneau d'affichage</h4>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => handleWidgetPosition('quickstats', 'left')}
                style={{
                  flex: 1, padding: '10px 14px', border: '1px solid',
                  borderColor: quickStatsSidebar === 'left' ? 'var(--nd-accent)' : 'var(--nd-card-border)',
                  background: quickStatsSidebar === 'left' ? 'var(--nd-accent-glow)' : 'rgba(255,255,255,0.01)',
                  color: quickStatsSidebar === 'left' ? 'var(--nd-accent)' : 'var(--nd-text)',
                  borderRadius: 'var(--nd-card-radius)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: quickStatsSidebar === 'left' ? '0 0 8px var(--nd-accent-glow)' : 'none'
                }}
              >
                👈 Barre Gauche
              </button>
              <button
                onClick={() => handleWidgetPosition('quickstats', 'right')}
                style={{
                  flex: 1, padding: '10px 14px', border: '1px solid',
                  borderColor: quickStatsSidebar === 'right' ? 'var(--nd-accent)' : 'var(--nd-card-border)',
                  background: quickStatsSidebar === 'right' ? 'var(--nd-accent-glow)' : 'rgba(255,255,255,0.01)',
                  color: quickStatsSidebar === 'right' ? 'var(--nd-accent)' : 'var(--nd-text)',
                  borderRadius: 'var(--nd-card-radius)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: quickStatsSidebar === 'right' ? '0 0 8px var(--nd-accent-glow)' : 'none'
                }}
              >
                Barre Droite 👉
              </button>
            </div>
          </div>

          <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>Ordre de priorité verticale</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button 
                onClick={() => handleWidgetOrder('quickstats', Math.max(0, quickStatsOrder - 1))}
                style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', color: 'var(--nd-text)', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
              >
                -
              </button>
              <input
                type="number"
                className="nd-input"
                min="0"
                max="20"
                value={quickStatsOrder}
                onChange={(e) => handleWidgetOrder('quickstats', Number(e.target.value))}
                style={{ flex: 1, height: '32px', fontSize: '0.8rem', textAlign: 'center', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', color: 'var(--nd-text)', borderRadius: 'var(--nd-card-radius)' }}
              />
              <button 
                onClick={() => handleWidgetOrder('quickstats', quickStatsOrder + 1)}
                style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', color: 'var(--nd-text)', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
              >
                +
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
