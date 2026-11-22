'use client';

import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { HeaderAlign } from '@/lib/pages/header';
import { MENU_LIMITS, MENU_STYLES, menuItems, type MenuGroup, type MenuSettings, type MenuStyle } from '@/lib/pages/menu';
import type { TabDef } from '@/hooks/useTabs';
import { WidgetHeaderActions } from '@/components/widgets/WidgetHeaderActions';
import { CalmeDialog } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSegmented, CalmeSlider, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { useI18n } from '@/i18n/I18nProvider';
import { useConfig } from '@/hooks/useConfig';
import { DialogPortal } from '../devices/ColorDialog';

export type MenuPart = 'all' | 'first' | 'second';

export function readAlign(settings: WidgetSettings, fallback: HeaderAlign): HeaderAlign {
  return settings.align === 'start' || settings.align === 'center' || settings.align === 'end' ? settings.align : fallback;
}
export function readMenuPart(settings: WidgetSettings): MenuPart {
  return settings.part === 'first' || settings.part === 'second' ? settings.part : 'all';
}

/**
 * Edit mode: the ✎ of a menu widget and its dialog. The settings are those
 * of every menu of the dashboard, unless "This menu only" keeps this widget's
 * own. (A menu split in two halves only comes from an upgraded header; see
 * `readMenuPart`.)
 */
export function MenuWidgetSettings({ title, settings, resolved, tabs, onSave }: {
  title: string;
  settings: WidgetSettings;
  /** What the menu uses now (shared or its own). */
  resolved: MenuSettings;
  /** The pages of this menu, in order. */
  tabs: TabDef[];
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
      {open && <Dialog label={label} own={settings.ownSettings === true} resolved={resolved} tabs={tabs} onSave={onSave} onClose={() => setOpen(false)} />}
    </WidgetHeaderActions>
  );
}

function Dialog({ label, own: initiallyOwn, resolved, tabs, onSave, onClose }: {
  label: string;
  own: boolean;
  resolved: MenuSettings;
  tabs: TabDef[];
  onSave: (settings: WidgetSettings) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { updateConfig } = useConfig();
  const [own, setOwn] = useState(initiallyOwn);
  const [draft, setDraft] = useState<MenuSettings>(resolved);
  const change = (patch: Partial<MenuSettings>) => setDraft(current => ({ ...current, ...patch }));
  const itemCount = menuItems(tabs, draft.groups).length;
  const shown = Math.min(draft.maxPages ?? itemCount, itemCount);
  // Pages per line count the "Others" button as one.
  const perRowMax = Math.max(1, shown < itemCount ? shown + 1 : itemCount);
  const perRow = Math.min(draft.perRow ?? 0, perRowMax);
  const save = () => {
    // 0 stands for "all" / "as many as fit", saved so that it wins.
    const values = {
      style: draft.style, icons: draft.icons, align: draft.align,
      perRow: draft.perRow ?? 0, maxPages: draft.maxPages ?? 0,
      groups: draft.groups
        .map(group => ({ ...group, name: group.name.trim() || t('pages.header.groupUntitled') }))
        .filter(group => group.pages.length > 0),
    };
    if (own) onSave({ ownSettings: true, ...values });
    else {
      onSave({ ownSettings: false });
      void updateConfig({ pageMenu: values });
    }
    onClose();
  };
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
          <CalmeRow label={t('pages.header.ownSettings')} info={t('pages.header.ownSettingsInfo')}>
            <CalmeSwitch label={t('pages.header.ownSettings')} checked={own} onChange={setOwn} />
          </CalmeRow>
          <MenuStylePicker value={draft.style} onChange={style => change({ style })} />
          {draft.style !== 'icons' && (
            <CalmeRow label={t('settings.calme.tabIcons')}>
              <CalmeSwitch label={t('settings.calme.tabIcons')} checked={draft.icons} onChange={icons => change({ icons })} />
            </CalmeRow>
          )}
          {itemCount > 1 && (
            <CalmeRow label={t('pages.header.shown')} info={t('pages.header.shownInfo')}>
              <CalmeSlider
                label={t('pages.header.shown')}
                value={shown}
                min={1}
                max={itemCount}
                step={1}
                onChange={value => change({ maxPages: value >= itemCount ? undefined : value })}
                onCommit={value => change({ maxPages: value >= itemCount ? undefined : value })}
                format={value => value >= itemCount ? t('pages.header.shownAll') : String(value)}
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
                onChange={value => change({ perRow: value < 1 ? undefined : value })}
                onCommit={value => change({ perRow: value < 1 ? undefined : value })}
                format={value => value < 1 ? t('pages.header.perRowAuto') : String(value)}
              />
            </CalmeRow>
          )}
          <CalmeRow label={t('pages.header.align')}>
            <CalmeSegmented
              label={t('pages.header.align')}
              value={draft.align}
              options={[
                { value: 'start', label: t('pages.header.alignStart') },
                { value: 'center', label: t('pages.header.alignCenter') },
                { value: 'end', label: t('pages.header.alignEnd') },
              ]}
              onChange={align => change({ align })}
            />
          </CalmeRow>
          <GroupsEditor tabs={tabs} groups={draft.groups} onChange={groups => change({ groups })} />
        </CalmeDialog>
      )}
    </DialogPortal>
  );
}

/**
 * Sub-menus: a name and the pages it gathers. A page belongs to one sub-menu
 * at most; choosing it in another moves it there.
 */
function GroupsEditor({ tabs, groups, onChange }: { tabs: TabDef[]; groups: MenuGroup[]; onChange: (groups: MenuGroup[]) => void }) {
  const { t } = useI18n();
  const update = (id: string, patch: Partial<MenuGroup>) => onChange(groups.map(group => group.id === id ? { ...group, ...patch } : group));
  const toggle = (id: string, page: string) => onChange(groups.map(group => {
    if (group.id === id) return { ...group, pages: group.pages.includes(page) ? group.pages.filter(candidate => candidate !== page) : [...group.pages, page] };
    return { ...group, pages: group.pages.filter(candidate => candidate !== page) };
  }));
  const add = () => onChange([...groups, { id: `g${Date.now().toString(36)}`, name: '', pages: [] }]);
  return (
    <section className="nd-menu-groups">
      <div className="nd-menu-groups-head">
        <span className="nd-menu-groups-title">{t('pages.header.groups')}</span>
        {groups.length < MENU_LIMITS.groups && (
          <button type="button" className="ndc-text-button" onClick={add}><Plus size={12} aria-hidden="true" /> {t('pages.header.groupAdd')}</button>
        )}
      </div>
      {groups.length === 0 && <p className="nd-menu-groups-empty">{t('pages.header.groupsInfo')}</p>}
      {groups.map(group => (
        <div key={group.id} className="nd-menu-group">
          <div className="nd-menu-group-head">
            <input
              className="nd-input"
              value={group.name}
              maxLength={MENU_LIMITS.groupName}
              placeholder={t('pages.header.groupName')}
              aria-label={t('pages.header.groupName')}
              onChange={event => update(group.id, { name: event.target.value })}
            />
            <button type="button" className="ndc-icon-button" onClick={() => onChange(groups.filter(candidate => candidate.id !== group.id))}
              aria-label={t('pages.header.groupRemove')} title={t('pages.header.groupRemove')}>
              <Trash2 size={13} />
            </button>
          </div>
          <div className="nd-menu-group-pages" role="group" aria-label={group.name || t('pages.header.groupName')}>
            {tabs.map(tab => (
              <button key={tab.id} type="button" aria-pressed={group.pages.includes(tab.id)} className="nd-menu-group-page" onClick={() => toggle(group.id, tab.id)}>
                {t(tab.name)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
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
