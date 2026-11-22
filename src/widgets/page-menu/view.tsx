'use client';

import type React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { HeaderPageTabs } from '@/components/layout/HeaderPageTabs';
import { useShellControls } from '@/components/layout/ShellControls';
import { resolveMenuSettings } from '@/lib/pages/menu';
import { CalmeWidget } from '../calme';
import type { WidgetViewProps } from '../types';
import { MenuWidgetSettings, readMenuPart } from './HeaderWidgetDialog';

/**
 * The page menu, as a widget: the same pages in every menu widget, resized
 * like any widget. Pages keep their spacing and go to a new line when the
 * widget is full, or after a set number of pages per line. In edit mode the
 * pages are reordered by drag and drop, renamed and deleted in place, and the
 * "+" among the widget's controls adds one.
 * Every menu of the dashboard shares its settings (style, icons, pages per
 * line, pages shown before "Others", alignment, sub-menus), unless one keeps
 * its own (src/lib/pages/menu.ts). A header split around its title by an
 * upgrade keeps one half of the pages in each menu.
 */
export default function PageMenuView({ instance, editMode, onUpdateSettings }: WidgetViewProps) {
  const { t } = useI18n();
  const { config } = useConfig();
  const { tabs, activeTab, switchTab } = useShellControls();
  const { settings } = instance;
  const menu = resolveMenuSettings(settings, config?.settings?.pageMenu, config?.settings?.showHeaderMenuIcons);
  const part = readMenuPart(settings);
  const middle = Math.ceil(tabs.length / 2);
  const start = part === 'second' ? middle : 0;
  const end = part === 'first' ? middle : tabs.length;
  const title = t('widget.page-menu.name');
  return (
    <CalmeWidget title={title} editMode={editMode} bare hideTitle>
      <div
        className={`nd-hw nd-hw--${menu.align} nd-hw-menu nd-hw-menu--${menu.style} ${menu.perRow ? 'has-per-row' : ''}`}
        style={menu.perRow ? { '--nd-menu-per-row': menu.perRow } as React.CSSProperties : undefined}
      >
        <HeaderPageTabs
          tabs={tabs}
          start={start}
          end={end}
          activeTab={activeTab}
          onSwitch={switchTab}
          editing={editMode}
          // The icon style always shows them.
          showIcons={menu.style === 'icons' || menu.icons}
          tabIcons={config?.settings?.tabIcons}
          flushFirst={false}
          last={end >= tabs.length}
          limit={menu.maxPages}
          groups={menu.groups}
        />
      </div>
      {/* After the menu: its "+" comes first among the controls, then this ✎. */}
      {editMode && <MenuWidgetSettings title={title} settings={settings} resolved={menu} tabs={tabs.slice(start, end)} onSave={onUpdateSettings} />}
    </CalmeWidget>
  );
}
