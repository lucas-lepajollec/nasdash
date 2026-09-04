import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { WIDGET_REGISTRY, getWidgetConfigKeys } from '@/lib/widgetRegistry';
import { Emoji } from '../../../shared/Emoji';
import { useI18n } from '@/i18n/I18nProvider';

interface LibraryTabProps {
  setActiveTab: (tabId: string) => void;
}

export function LibraryTab({ setActiveTab }: LibraryTabProps) {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();

  const hideWidgetTitles = config?.settings?.hideWidgetTitles ?? false;

  const handleToggleWidget = async (key: string, value: boolean) => {
    await updateConfig({ [key]: value });
  };

  const getWidgetState = (id: string, defaultHidden: boolean) => {
    const keys = getWidgetConfigKeys(id);
    return (config?.settings as any)?.[keys.hide] ?? defaultHidden;
  };

  const activeWidgets = WIDGET_REGISTRY.filter(w => !getWidgetState(w.id, w.defaultHidden));
  const inactiveWidgets = WIDGET_REGISTRY.filter(w => getWidgetState(w.id, w.defaultHidden));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--nd-text-muted)', lineHeight: 1.4 }}>
          {t("Activez ou désactivez les extensions de NasDash. Les widgets activés apparaissent dans vos barres latérales selon leur ordre de priorité.")}
        </p>
      </div>



      {/* Section 1: Active Widgets */}
      <div>
        <h5 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--nd-green)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--nd-green)', boxShadow: '0 0 8px var(--nd-green)' }} />
          {t("Widgets Activés (")}{activeWidgets.length})
        </h5>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {activeWidgets.map(w => {
            const hideKey = getWidgetConfigKeys(w.id).hide;
            return (
              <div key={w.id} style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Emoji emoji={w.icon} />
                      {t(w.name)}
                    </span>
                    <span style={{ fontSize: '0.6rem', background: w.bg, color: w.color, padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>{t(w.category)}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--nd-text-muted)', lineHeight: 1.3 }}>
                    {t(w.description)}
                  </p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <button onClick={() => setActiveTab(`widget-${w.id}`)} style={{ background: 'none', border: 'none', color: 'var(--nd-accent)', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                    {t("Configurer →")}
                  </button>
                  <div 
                    onClick={() => handleToggleWidget(hideKey, true)}
                    style={{ width: '36px', height: '18px', borderRadius: '9px', background: 'var(--nd-green)', position: 'relative', cursor: 'pointer', boxShadow: '0 0 8px rgba(63, 185, 80, 0.3)', transition: 'all 0.2s' }}
                  >
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: '21px', transition: 'all 0.2s' }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Inactive Widgets */}
      <div style={{ marginTop: 10 }}>
        <h5 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--nd-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--nd-card-border)' }} />
          {t("Widgets Désactivés (")}{inactiveWidgets.length})
        </h5>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, opacity: 0.7 }}>
          {inactiveWidgets.map(w => {
            const hideKey = getWidgetConfigKeys(w.id).hide;
            return (
              <div key={w.id} style={{ padding: '14px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--nd-text-muted)' }}>
                      <Emoji emoji={w.icon} />
                      {t(w.name)}
                    </span>
                    <span style={{ fontSize: '0.6rem', background: 'rgba(255,255,255,0.05)', color: 'var(--nd-text-muted)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>{t(w.category)}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--nd-text-muted)', lineHeight: 1.3 }}>
                    {t(w.description)}
                  </p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4 }}>
                  <div 
                    onClick={() => handleToggleWidget(hideKey, false)}
                    style={{ width: '36px', height: '18px', borderRadius: '9px', background: 'var(--nd-card-border)', position: 'relative', cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: '3px', transition: 'all 0.2s' }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
