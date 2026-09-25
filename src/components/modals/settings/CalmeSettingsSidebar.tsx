'use client';

import React, { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { WIDGET_CATALOG } from '@/lib/widgets/catalog';

export interface CalmeSettingsSection {
  id: string;
  group: string;
  label: string;
  description?: string;
  /** Sub-sections (one per widget) live under this entry and only show in search results. */
  parent?: string;
  icon?: string;
}

/**
 * The settings sections of the Calme style, in their groups. Tab ids are the
 * historical ones, so links from widgets ("Configure") keep working. Widget
 * sections come from the catalogue: one per shared configuration.
 */
export function useCalmeSettingsSections(): CalmeSettingsSection[] {
  const { t } = useI18n();
  return useMemo(() => {
    const personal = t('settings.calme.groupPersonal');
    const dashboard = t('settings.calme.groupDashboard');
    const system = t('settings.calme.groupSystem');
    const widgetsLabel = t('settings.calme.widgetsNav');
    const widgetSections = WIDGET_CATALOG
      .filter((entry, index, all) => entry.settingsTab && all.findIndex(other => other.settingsTab === entry.settingsTab) === index)
      .map(entry => ({
        id: entry.settingsTab!,
        group: dashboard,
        parent: 'library',
        label: entry.settingsTab === 'widget-services' ? t('settings.services.nav') : t(entry.nameKey),
        description: t(entry.descriptionKey),
        icon: entry.icon,
      }));
    return [
      { id: 'apparence', group: personal, label: t('settings.calme.appearance'), description: t('settings.calme.descAppearance') },
      { id: 'wallpaper', group: personal, label: t('settings.calme.wallpaperNav'), description: t('settings.calme.descWallpaper') },
      { id: 'header', group: personal, label: t('settings.calme.header'), description: t('settings.calme.descHeader') },
      { id: 'mobile', group: personal, label: t('settings.calme.mobile'), description: t('settings.calme.descMobile') },
      { id: 'tabs-general', group: personal, label: t('settings.calme.navigation'), description: t('settings.calme.descNavigation') },
      { id: 'pages', group: dashboard, label: t('settings.calme.pages'), description: t('settings.calme.descPages') },
      { id: 'library', group: dashboard, label: widgetsLabel, description: t('settings.calme.descWidgets') },
      ...widgetSections,
      { id: 'integrations', group: system, label: t('integrations.title'), description: t('integrations.navDescription') },
      { id: 'security', group: system, label: t('settings.calme.security'), description: t('settings.calme.descSecurity') },
      { id: 'developer', group: system, label: t('settings.calme.developer'), description: t('settings.calme.descDeveloper') },
    ];
  }, [t]);
}

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function CalmeSettingsSidebar({ sections, currentTab, setActiveTab, onClose }: {
  sections: CalmeSettingsSection[];
  currentTab: string;
  setActiveTab: (tab: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const needle = normalize(query.trim());
  const shown = needle
    ? sections.filter(section => normalize(`${section.label} ${section.description ?? ''} ${section.group}`).includes(needle))
    : sections.filter(section => !section.parent);
  const activeId = sections.find(section => section.id === currentTab)?.parent ?? currentTab;
  const groups = shown.reduce<Array<{ name: string; items: CalmeSettingsSection[] }>>((all, section) => {
    const group = all.find(item => item.name === section.group);
    if (group) group.items.push(section);
    else all.push({ name: section.group, items: [section] });
    return all;
  }, []);

  return (
    <nav className="nd-settings-sidebar ndc-settings-nav" aria-label={t('Paramètres NasDash')}>
      <div className="ndc-settings-nav-top">
        <label className="ndc-settings-search">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter' && shown[0]) setActiveTab(shown[0].id); }}
            placeholder={t('settings.calme.search')}
            aria-label={t('settings.calme.search')}
          />
        </label>
        <button type="button" className="ndc-icon-button nd-settings-sidebar-close-btn" onClick={onClose} aria-label={t('settings.calme.close')}>
          <X size={16} />
        </button>
      </div>
      <div className="ndc-settings-nav-groups">
        {groups.map(group => (
          <div key={group.name} className="ndc-settings-nav-group">
            <div className="ndc-settings-nav-label">{group.name}</div>
            {group.items.map(section => (
              <button
                key={section.id}
                type="button"
                className={`ndc-settings-nav-item ${activeId === section.id || currentTab === section.id ? 'is-active' : ''} ${section.parent ? 'ndc-settings-nav-item--sub' : ''}`}
                aria-current={currentTab === section.id ? 'page' : undefined}
                onClick={() => setActiveTab(section.id)}
              >
                {section.label}
              </button>
            ))}
          </div>
        ))}
        {groups.length === 0 && <div className="ndc-settings-nav-empty">{t('settings.calme.noResult')}</div>}
      </div>
    </nav>
  );
}
