import React, { useState } from 'react';
import { ArrowUp, ArrowDown, Ban } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useTabs } from '@/hooks/useTabs';
import { usePages } from '@/providers/PagesProvider';
import { ToggleSwitch } from '../../shared/ToggleSwitch';
import EmojiPickerModal from '../../../EmojiPickerModal';
import { Emoji } from '../../../../shared/Emoji';
import { useI18n } from '@/i18n/I18nProvider';
import { useCalme } from '@/widgets/calme';
import { CalmeHeading, CalmeOrderList, CalmeRow, CalmeSegmented, CalmeSwitch } from '../../shared/CalmeControls';

export function TabsGeneralTab() {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();
  const { tabs } = useTabs();
  const { updatePageDetails } = usePages();

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

  const calme = useCalme();
  if (calme) {
    const ordered = (tabOrder.length > 0 ? tabOrder : tabs.map(tab => tab.id))
      .map(id => tabs.find(candidate => candidate.id === id))
      .filter((tab): tab is NonNullable<typeof tab> => !!tab);
    const iconOf = (tab: typeof ordered[number]) => config?.settings?.tabIcons?.[tab.id] !== undefined ? config?.settings?.tabIcons?.[tab.id] : tab.icon;
    return (
      <div className="ndc-set-page">
        <section className="ndc-set-block">
          <CalmeHeading>{t('settings.calme.dock')}</CalmeHeading>
          <CalmeRow label={t("Activer le Dock")} info={t("Affiche la barre de navigation principale (mode Dock).")}>
            <CalmeSwitch label={t("Activer le Dock")} checked={!config?.settings?.hideDock} onChange={(val) => updateConfig({ hideDock: !val })} />
          </CalmeRow>
          <CalmeRow label={t("Position du Dock")}>
            <CalmeSegmented
              label={t("Position du Dock")}
              value={config?.settings?.dockPosition === 'right' ? 'right' : 'left'}
              options={[{ value: 'left', label: t("À gauche") }, { value: 'right', label: t("À droite") }]}
              onChange={value => updateConfig({ dockPosition: value })}
            />
          </CalmeRow>
        </section>
        <section className="ndc-set-block">
          <CalmeHeading info={t("Activez/désactivez les onglets, modifiez leurs icônes, et utilisez les flèches pour les réorganiser.")}>{t('settings.calme.tabs')}</CalmeHeading>
          <CalmeOrderList
            moveUpLabel={t("Monter")}
            moveDownLabel={t("Descendre")}
            onMove={(index, direction) => { void handleMoveTab(ordered[index].id, direction < 0 ? 'up' : 'down'); }}
            items={ordered.map(tab => {
              const icon = iconOf(tab);
              return {
                id: tab.id,
                label: t(tab.name),
                enabled: !hiddenTabs.includes(tab.id),
                onToggle: () => { void handleToggleTabHidden(tab.id); },
                extra: (
                  <button type="button" className="ndc-icon-button ndc-order-icon" onClick={() => setIconPickerTabId(tab.id)} aria-label={t('tabs.chooseIcon', { name: t(tab.name) })} title={t('tabs.chooseIcon', { name: t(tab.name) })}>
                    {icon ? <Emoji emoji={icon} /> : <Ban size={13} />}
                  </button>
                ),
              };
            })}
          />
        </section>
      {/* Icon Picker Modal */}
      {iconPickerTabId && (
        <EmojiPickerModal
          initialEmoji={config?.settings?.tabIcons?.[iconPickerTabId] ?? tabs.find(tab => tab.id === iconPickerTabId)?.icon ?? ''}
          onSelect={async (icon: string) => {
            // The page carries its icon; a historical dock override is cleared.
            await updatePageDetails(iconPickerTabId, { icon });
            if (config?.settings?.tabIcons && iconPickerTabId in config.settings.tabIcons) {
              const overrides = { ...config.settings.tabIcons };
              delete overrides[iconPickerTabId];
              await updateConfig({ tabIcons: overrides });
            }
          }}
          onClose={() => setIconPickerTabId(null)}
          title={t('tabs.chooseIcon', { name: t(tabs.find(tab => tab.id === iconPickerTabId)?.name || "l&apos;onglet") })}
        />
      )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
        <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>{t("Position du Dock")}</h4>
        <p style={{ margin: '4px 0 12px 0', fontSize: '0.7rem', color: 'var(--nd-text-muted)' }}>
          {t("Choisissez où s&apos;affiche la barre de navigation principale.")}
        </p>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <button 
            onClick={() => updateConfig({ dockPosition: 'left' })}
            className={`nd-btn ${config?.settings?.dockPosition !== 'right' ? 'nd-settings-nav-item--active' : ''}`}
            style={{ flex: 1, padding: '8px 12px', fontSize: '0.75rem', justifyContent: 'center', border: config?.settings?.dockPosition !== 'right' ? '1px solid var(--nd-accent)' : '1px solid var(--nd-card-border)', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Emoji emoji="⬅️" /> {t("À gauche")}
          </button>
          <button 
            onClick={() => updateConfig({ dockPosition: 'right' })}
            className={`nd-btn ${config?.settings?.dockPosition === 'right' ? 'nd-settings-nav-item--active' : ''}`}
            style={{ flex: 1, padding: '8px 12px', fontSize: '0.75rem', justifyContent: 'center', border: config?.settings?.dockPosition === 'right' ? '1px solid var(--nd-accent)' : '1px solid var(--nd-card-border)', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {t("À droite")} <Emoji emoji="➡️" />
          </button>
        </div>
        <div style={{ borderTop: '1px solid var(--nd-card-border)', paddingTop: 16 }}>
          <ToggleSwitch 
            checked={!config?.settings?.hideDock}
            onChange={(val) => updateConfig({ hideDock: !val })}
            label={t("Activer le Dock")}
            sublabel={t("Affiche la barre de navigation principale (mode Dock).")}
          />
        </div>
      </div>

      <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
        <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>{t("Gestion des Onglets")}</h4>
        <p style={{ margin: '4px 0 16px 0', fontSize: '0.7rem', color: 'var(--nd-text-muted)' }}>
          {t("Activez/désactivez les onglets, modifiez leurs icônes, et utilisez les flèches pour les réorganiser.")}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(tabOrder.length > 0 ? tabOrder : tabs.map(tab => tab.id)).map((tabId, idx) => {
            const tab = tabs.find(candidate => candidate.id === tabId);
            if (!tab) return null;
            const isHidden = hiddenTabs.includes(tab.id);
            return (
              <div key={tab.id} style={{ display: 'flex', flexDirection: 'column', padding: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
                  <ToggleSwitch 
                    checked={!isHidden}
                    onChange={() => handleToggleTabHidden(tab.id)}
                    label={t(tab.name)}
                    sublabel={t('tabs.status', { status: !isHidden ? t("Actif dans le dock") : t("Masqué") })}
                  />
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', opacity: !isHidden ? 1 : 0.5, transition: 'opacity 0.2s', flexWrap: 'wrap' }}>
                    <button onClick={() => handleMoveTab(tab.id, 'up')} disabled={idx === 0} style={{ padding: '6px 10px', background: 'var(--nd-bg-alt)', border: '1px solid var(--nd-card-border)', borderRadius: '6px', cursor: idx === 0 ? 'not-allowed' : 'pointer', color: idx === 0 ? 'var(--nd-text-muted)' : 'var(--nd-text)', opacity: idx === 0 ? 0.3 : 1, display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }} title={t("Monter")}>
                      <ArrowUp size={14} /> {t("Monter")}
                    </button>
                    <button onClick={() => handleMoveTab(tab.id, 'down')} disabled={idx === (tabOrder.length > 0 ? tabOrder.length : tabs.length) - 1} style={{ padding: '6px 10px', background: 'var(--nd-bg-alt)', border: '1px solid var(--nd-card-border)', borderRadius: '6px', cursor: idx === (tabOrder.length > 0 ? tabOrder.length : tabs.length) - 1 ? 'not-allowed' : 'pointer', color: idx === (tabOrder.length > 0 ? tabOrder.length : tabs.length) - 1 ? 'var(--nd-text-muted)' : 'var(--nd-text)', opacity: idx === (tabOrder.length > 0 ? tabOrder.length : tabs.length) - 1 ? 0.3 : 1, display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }} title={t("Descendre")}>
                      {t("Descendre")} <ArrowDown size={14} />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: !isHidden ? 1 : 0.5, transition: 'opacity 0.2s', borderTop: '1px dashed var(--nd-card-border)', paddingTop: 12 }}>
                   <span style={{ fontSize: '0.75rem', color: 'var(--nd-text-muted)' }}>{t("Icône du dock :")}</span>
                     <button
                       onClick={() => setIconPickerTabId(tab.id)}
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
                         const iconVal = config?.settings?.tabIcons?.[tab.id] !== undefined ? config?.settings?.tabIcons?.[tab.id] : tab.icon;
                         return iconVal ? <Emoji emoji={iconVal} /> : <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--nd-text-muted)' }}><Ban size={14} /><span style={{ fontSize: '0.75rem' }}>{t("Aucune")}</span></div>;
                       })()}
                       <span style={{ fontSize: '0.65rem', color: 'var(--nd-text-muted)', marginLeft: 6 }}>{t("Modifier")}</span>
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
          initialEmoji={config?.settings?.tabIcons?.[iconPickerTabId] ?? tabs.find(tab => tab.id === iconPickerTabId)?.icon ?? ''}
          onSelect={async (icon: string) => {
            // The page carries its icon; a historical dock override is cleared.
            await updatePageDetails(iconPickerTabId, { icon });
            if (config?.settings?.tabIcons && iconPickerTabId in config.settings.tabIcons) {
              const overrides = { ...config.settings.tabIcons };
              delete overrides[iconPickerTabId];
              await updateConfig({ tabIcons: overrides });
            }
          }}
          onClose={() => setIconPickerTabId(null)}
          title={t('tabs.chooseIcon', { name: t(tabs.find(tab => tab.id === iconPickerTabId)?.name || "l&apos;onglet") })}
        />
      )}


    </div>
  );
}
