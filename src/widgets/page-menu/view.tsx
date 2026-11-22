'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { HeaderPageTabs } from '@/components/layout/HeaderPageTabs';
import { useShellControls } from '@/components/layout/ShellControls';
import { CalmeWidget } from '../calme';
import type { WidgetViewProps } from '../types';
import { MenuWidgetSettings, readAlign, readMenuLimit, readMenuPart, readMenuStyle } from './HeaderWidgetDialog';

/**
 * The page menu, as a widget: the same pages in every menu widget. In edit
 * mode the pages are reordered by drag and drop, renamed in place and a new
 * page is added from the "+" (in the widget that shows the last pages).
 * Its own settings: style (tabs, in a block, a list), icons, alignment, how
 * many pages show before a last button that unfolds the others, and which
 * pages it holds (all, or one half for a menu split around another widget).
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
  const limit = readMenuLimit(settings);
  const title = t('widget.page-menu.name');
  const rowTabs = tabs.slice(start, limit ? Math.min(end, start + limit) : end);
  const [menuBox, fitLevel] = useMenuFit(style !== 'list', rowTabs.map(tab => tab.name).join('\n') + (rowTabs.length < end - start ? `\n…${activeTab}` : ''));
  const menu = (
    <HeaderPageTabs
      tabs={tabs}
      start={start}
      end={end}
      activeTab={activeTab}
      onSwitch={switchTab}
      editing={editMode}
      showIcons={settings.icons === true}
      tabIcons={config?.settings?.tabIcons}
      flushFirst={false}
      last={end >= tabs.length}
      vertical={style === 'list'}
      limit={limit}
    />
  );
  return (
    <CalmeWidget title={title} editMode={editMode} bare={style === 'tabs'} hideTitle>
      {editMode && <MenuWidgetSettings title={title} settings={settings} pageCount={end - start} onSave={onUpdateSettings} />}
      <div ref={menuBox} className={`nd-hw nd-hw--${style === 'list' ? 'start' : align} nd-hw-menu nd-hw-menu--${style} ${fitLevel === 1 ? 'is-tight' : fitLevel === 2 ? 'is-tight is-wrapping' : ''}`}>{menu}</div>
    </CalmeWidget>
  );
}

/**
 * A row of pages that does not fit its widget first draws its tabs closer
 * together, and only then wraps onto a second line: no page is ever hidden.
 * Natural widths are measured at each step and kept, so widening the widget
 * steps back. `content` changes (pages renamed, added) start over.
 */
function useMenuFit(enabled: boolean, content: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ content: string; level: 0 | 1 | 2 }>({ content, level: 0 });
  const needs = useRef<{ content: string; widths: (number | undefined)[] }>({ content, widths: [] });
  // New pages or names: measure again from the roomiest look.
  if (state.content !== content) setState({ content, level: 0 });
  const level = enabled ? state.level : 0;
  useLayoutEffect(() => {
    const box = ref.current;
    if (!enabled || !box) return;
    if (needs.current.content !== content) needs.current = { content, widths: [] };
    const check = () => {
      const nav = box.querySelector<HTMLElement>('.nd-header-menu');
      if (!nav || box.clientWidth < 1) return;
      if (level < 2) needs.current.widths[level] = rowWidth(nav);
      const [roomy, tight] = needs.current.widths;
      // The widget is only as wide as its menu: the room is that of its place
      // on the page, less what surrounds the row (block style).
      const frame = box.closest<HTMLElement>('.nd-page-widget') ?? box;
      const place = frame.parentElement ?? box;
      const around = frame.getBoundingClientRect().width - nav.getBoundingClientRect().width;
      const available = place.clientWidth - Math.max(0, around) + 1;
      let next: 0 | 1 | 2 = 0;
      if (roomy !== undefined && roomy > available) next = tight !== undefined && tight > available ? 2 : 1;
      if (next !== level) setState(current => current.level === next ? current : { ...current, level: next });
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(box);
    const place = box.closest('.nd-page-widget')?.parentElement;
    if (place) observer.observe(place);
    return () => observer.disconnect();
  }, [content, enabled, level]);
  return [ref, level] as const;
}

/** Width of the pages in a row, without the edit mode's "+" (it sits outside the row). */
function rowWidth(nav: HTMLElement): number {
  const left = nav.getBoundingClientRect().left;
  let right = left;
  for (const child of Array.from(nav.children)) {
    if (child.classList.contains('nd-header-tab-add')) continue;
    right = Math.max(right, child.getBoundingClientRect().right);
  }
  return Math.ceil(right - left);
}
