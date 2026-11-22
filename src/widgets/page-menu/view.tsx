'use client';

import type React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { HeaderPageTabs } from '@/components/layout/HeaderPageTabs';
import { useShellControls } from '@/components/layout/ShellControls';
import { CalmeWidget } from '../calme';
import type { WidgetViewProps } from '../types';
import { MenuWidgetSettings, readAlign, readMenuLimit, readMenuPart, readMenuPerRow, readMenuStyle } from './HeaderWidgetDialog';

/**
 * The page menu, as a widget: the same pages in every menu widget, resized
 * like any widget. Pages keep their spacing and go to a new line when the
 * widget is full, or after a set number of pages per line. In edit mode the
 * pages are reordered by drag and drop, renamed and deleted in place, and the
 * "+" among the widget's controls adds one.
 * Its own settings: style, icons, pages per line, how many pages show before
 * an "Others" button that unfolds the rest, and alignment. A header split
 * around its title by an upgrade keeps one half of the pages in each menu.
 */
export default function PageMenuView({ instance, editMode, onUpdateSettings }: WidgetViewProps) {
  const { t } = useI18n();
  const { config } = useConfig();
  const { tabs, activeTab, switchTab } = useShellControls();
  const { settings } = instance;
  const style = readMenuStyle(settings);
  const align = readAlign(settings, 'center');
  const part = readMenuPart(settings);
  const middle = Math.ceil(tabs.length / 2);
  const start = part === 'second' ? middle : 0;
  const end = part === 'first' ? middle : tabs.length;
  const perRow = readMenuPerRow(settings);
  const title = t('widget.page-menu.name');
  return (
    <CalmeWidget title={title} editMode={editMode} bare hideTitle>
      <div
        className={`nd-hw nd-hw--${align} nd-hw-menu nd-hw-menu--${style} ${perRow ? 'has-per-row' : ''}`}
        style={perRow ? { '--nd-menu-per-row': perRow } as React.CSSProperties : undefined}
      >
        <HeaderPageTabs
          tabs={tabs}
          start={start}
          end={end}
          activeTab={activeTab}
          onSwitch={switchTab}
          editing={editMode}
          // The icon style always shows them.
          showIcons={style === 'icons' || settings.icons === true}
          tabIcons={config?.settings?.tabIcons}
          flushFirst={false}
          last={end >= tabs.length}
          limit={readMenuLimit(settings)}
        />
      </div>
      {/* After the menu: its "+" comes first among the controls, then this ✎. */}
      {editMode && <MenuWidgetSettings title={title} settings={settings} pageCount={end - start} onSave={onUpdateSettings} />}
    </CalmeWidget>
  );
}
