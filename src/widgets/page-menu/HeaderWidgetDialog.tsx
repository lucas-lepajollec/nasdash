'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { HeaderAlign } from '@/lib/pages/header';
import { WidgetHeaderActions } from '@/components/widgets/WidgetHeaderActions';
import { CalmeDialog } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSegmented, CalmeSlider, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { useI18n } from '@/i18n/I18nProvider';
import { useConfig } from '@/hooks/useConfig';
import { DialogPortal } from '../devices/ColorDialog';

/**
 * Menu looks: underlined tabs (the original), a soft capsule on the page
 * shown, a segmented control (one track, the page shown raised in it) and
 * icons over their names, like a dock.
 */
export type MenuStyle = 'tabs' | 'pill' | 'segmented' | 'icons';
export const MENU_STYLES: MenuStyle[] = ['tabs', 'pill', 'segmented', 'icons'];
export type MenuPart = 'all' | 'first' | 'second';

export function readAlign(settings: WidgetSettings, fallback: HeaderAlign): HeaderAlign {
  return settings.align === 'start' || settings.align === 'center' || settings.align === 'end' ? settings.align : fallback;
}
/** The look of every menu: one setting for the whole dashboard (`settings.menuStyle`). */
export function readMenuStyle(value: unknown): MenuStyle {
  return MENU_STYLES.includes(value as MenuStyle) ? value as MenuStyle : 'tabs';
}
export function readMenuPart(settings: WidgetSettings): MenuPart {
  return settings.part === 'first' || settings.part === 'second' ? settings.part : 'all';
}
/** Pages on each line of the menu; undefined: as many as fit. */
export function readMenuPerRow(settings: WidgetSettings): number | undefined {
  const perRow = settings.perRow;
  return typeof perRow === 'number' && Number.isFinite(perRow) && perRow >= 1 ? Math.floor(perRow) : undefined;
}
/** How many pages the menu shows before its last button; undefined: all of them. */
export function readMenuLimit(settings: WidgetSettings): number | undefined {
  const limit = settings.maxPages;
  return typeof limit === 'number' && Number.isFinite(limit) && limit >= 1 ? Math.floor(limit) : undefined;
}

/**
 * Edit mode: the ✎ of a menu widget and its dialog. The look (style, icons)
 * is the same for every menu of the dashboard; pages per line, how many pages
 * show before the "Others" button and alignment belong to this widget. (A
 * menu split in two halves only comes from an upgraded header; see `readMenuPart`.)
 */
export function MenuWidgetSettings({ title, settings, pageCount, onSave }: {
  title: string;
  settings: WidgetSettings;
  /** Pages in this menu's part, the most the slider offers. */
  pageCount: number;
  onSave: (settings: WidgetSettings) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const label = t('pages.header.settingsOf', { name: title });
  return (
    <WidgetHeaderActions>
      <button type="button" className="nd-action-icon accent" onClick={event => { event.stopPropagation(); setOpen(true); }} title={label} aria-label={label}>
        <Pencil size={13} />
      </button>
      {open && <Dialog label={label} settings={settings} pageCount={pageCount} onSave={onSave} onClose={() => setOpen(false)} />}
    </WidgetHeaderActions>
  );
}

function Dialog({ label, settings, pageCount, onSave, onClose }: {
  label: string;
  settings: WidgetSettings;
  pageCount: number;
  onSave: (settings: WidgetSettings) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();
  const [draft, setDraft] = useState<WidgetSettings>(settings);
  const change = (patch: WidgetSettings) => setDraft(current => ({ ...current, ...patch }));
  // Shared by every menu: saved in the dashboard settings.
  const [look, setLook] = useState(() => ({
    style: readMenuStyle(config?.settings?.menuStyle),
    icons: config?.settings?.showHeaderMenuIcons === true,
  }));
  const style = look.style;
  const save = () => {
    onSave(draft);
    if (look.style !== readMenuStyle(config?.settings?.menuStyle) || look.icons !== (config?.settings?.showHeaderMenuIcons === true)) {
      void updateConfig({ menuStyle: look.style, showHeaderMenuIcons: look.icons });
    }
    onClose();
  };
  const shown = Math.min(readMenuLimit(draft) ?? pageCount, pageCount);
  // At the top of the slider every page shows, the ones added later too.
  const setShown = (value: number) => change({ maxPages: value >= pageCount ? 0 : value });
  // Pages per line count the "Others" button as one.
  const perRowMax = Math.max(1, shown < pageCount ? shown + 1 : pageCount);
  const perRow = Math.min(readMenuPerRow(draft) ?? 0, perRowMax);
  return (
    <DialogPortal onClose={onClose}>
      {ref => (
        <CalmeDialog
          dialogRef={ref}
          label={label}
          title={label}
          onClose={onClose}
          footer={<>
            <button type="button" className="nd-btn" onClick={onClose}>{t('Annuler')}</button>
            <button type="button" className="nd-btn nd-btn-accent" onClick={save}>{t('Enregistrer')}</button>
          </>}
        >
          <p className="nd-menu-styles-note">{t('pages.header.styleShared')}</p>
          <MenuStylePicker value={style} onChange={value => setLook(current => ({ ...current, style: value }))} />
          {style !== 'icons' && (
            <CalmeRow label={t('settings.calme.tabIcons')}>
              <CalmeSwitch label={t('settings.calme.tabIcons')} checked={look.icons} onChange={value => setLook(current => ({ ...current, icons: value }))} />
            </CalmeRow>
          )}
          {pageCount > 1 && (
            <CalmeRow label={t('pages.header.shown')} info={t('pages.header.shownInfo')}>
              <CalmeSlider
                label={t('pages.header.shown')}
                value={shown}
                min={1}
                max={pageCount}
                step={1}
                onChange={setShown}
                onCommit={setShown}
                format={value => value >= pageCount ? t('pages.header.shownAll') : String(value)}
              />
            </CalmeRow>
          )}
          {perRowMax > 1 && (
            <CalmeRow label={t('pages.header.perRow')} info={t('pages.header.perRowInfo')}>
              <CalmeSlider
                label={t('pages.header.perRow')}
                value={perRow}
                min={0}
                max={perRowMax}
                step={1}
                onChange={value => change({ perRow: value })}
                onCommit={value => change({ perRow: value })}
                format={value => value < 1 ? t('pages.header.perRowAuto') : String(value)}
              />
            </CalmeRow>
          )}
          <CalmeRow label={t('pages.header.align')}>
            <CalmeSegmented
              label={t('pages.header.align')}
              value={readAlign(draft, 'center')}
              options={[
                { value: 'start', label: t('pages.header.alignStart') },
                { value: 'center', label: t('pages.header.alignCenter') },
                { value: 'end', label: t('pages.header.alignEnd') },
              ]}
              onChange={value => change({ align: value })}
            />
          </CalmeRow>
        </CalmeDialog>
      )}
    </DialogPortal>
  );
}

/** The four looks, each drawn as a small sample of the menu itself. */
function MenuStylePicker({ value, onChange }: { value: MenuStyle; onChange: (style: MenuStyle) => void }) {
  const { t } = useI18n();
  const names: Record<MenuStyle, string> = {
    tabs: t('pages.header.styleTabs'),
    pill: t('pages.header.stylePill'),
    segmented: t('pages.header.styleSegmented'),
    icons: t('pages.header.styleIcons'),
  };
  const samples: [string, string][] = [['⌂', t('Home')], ['▶', t('Médias')], ['♪', t('Music')]];
  return (
    <div className="nd-menu-styles" role="radiogroup" aria-label={t('pages.header.style')}>
      {MENU_STYLES.map(style => (
        <button key={style} type="button" role="radio" aria-checked={value === style} className="nd-menu-style" onClick={() => onChange(style)}>
          <span className={`nd-menu-style-sample nd-hw-menu nd-hw-menu--${style}`} aria-hidden="true">
            <span className="nd-header-menu">
              {samples.map(([icon, name], index) => (
                <span key={name} className={`nd-header-tab-link ${index === 0 ? 'is-active' : ''}`}>
                  {style === 'icons' && <span className="nd-header-tab-icon">{icon}</span>}
                  <span className="nd-header-tab-name">{name}</span>
                </span>
              ))}
            </span>
          </span>
          <span className="nd-menu-style-name">{names[style]}</span>
        </button>
      ))}
    </div>
  );
}
