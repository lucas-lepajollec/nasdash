import React, { useState } from 'react';
import { Ban } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useTabs } from '@/hooks/useTabs';
import { usePages } from '@/providers/PagesProvider';
import EmojiPickerModal from '../../../EmojiPickerModal';
import { Emoji } from '../../../../shared/Emoji';
import { useI18n } from '@/i18n/I18nProvider';
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
