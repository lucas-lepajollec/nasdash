'use client';

import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import type { HeaderAlign } from '@/lib/pages/header';
import { WidgetHeaderActions } from '@/components/widgets/WidgetHeaderActions';
import { CalmeDialog } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSegmented, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { useI18n } from '@/i18n/I18nProvider';
import { DialogPortal } from '../devices/ColorDialog';

export type MenuStyle = 'tabs' | 'boxed' | 'list';
export type MenuPart = 'all' | 'first' | 'second';

export function readAlign(settings: WidgetSettings, fallback: HeaderAlign): HeaderAlign {
  return settings.align === 'start' || settings.align === 'center' || settings.align === 'end' ? settings.align : fallback;
}
export function readMenuStyle(settings: WidgetSettings): MenuStyle {
  return settings.style === 'boxed' || settings.style === 'list' ? settings.style : 'tabs';
}
export function readMenuPart(settings: WidgetSettings): MenuPart {
  return settings.part === 'first' || settings.part === 'second' ? settings.part : 'all';
}

/**
 * Edit mode: the settings button of a header widget and its dialog. The menu
 * offers its style, icons, alignment and the pages it shows; the buttons only
 * their alignment. These are per widget: the pages themselves are shared.
 */
export function HeaderWidgetSettings({ kind, title, settings, fallbackAlign, onSave }: {
  kind: 'menu' | 'actions';
  title: string;
  settings: WidgetSettings;
  fallbackAlign: HeaderAlign;
  onSave: (settings: WidgetSettings) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const label = t('pages.header.settingsOf', { name: title });
  return (
    <WidgetHeaderActions>
      <button type="button" className="nd-action-icon accent" onClick={event => { event.stopPropagation(); setOpen(true); }} title={label} aria-label={label}>
        <SlidersHorizontal size={13} />
      </button>
      {open && <Dialog kind={kind} label={label} settings={settings} fallbackAlign={fallbackAlign} onSave={onSave} onClose={() => setOpen(false)} />}
    </WidgetHeaderActions>
  );
}

function Dialog({ kind, label, settings, fallbackAlign, onSave, onClose }: {
  kind: 'menu' | 'actions';
  label: string;
  settings: WidgetSettings;
  fallbackAlign: HeaderAlign;
  onSave: (settings: WidgetSettings) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<WidgetSettings>(settings);
  const change = (patch: WidgetSettings) => setDraft(current => ({ ...current, ...patch }));
  const style = readMenuStyle(draft);
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
            <button type="button" className="nd-btn nd-btn-accent" onClick={() => { onSave(draft); onClose(); }}>{t('Enregistrer')}</button>
          </>}
        >
          {kind === 'menu' && (
            <>
              <CalmeRow label={t('pages.header.style')}>
                <CalmeSegmented
                  label={t('pages.header.style')}
                  value={style}
                  options={[
                    { value: 'tabs', label: t('pages.header.styleTabs') },
                    { value: 'boxed', label: t('pages.header.styleBoxed') },
                    { value: 'list', label: t('pages.header.styleList') },
                  ]}
                  onChange={value => change({ style: value })}
                />
              </CalmeRow>
              <CalmeRow label={t('settings.calme.tabIcons')}>
                <CalmeSwitch label={t('settings.calme.tabIcons')} checked={draft.icons === true} onChange={value => change({ icons: value })} />
              </CalmeRow>
              <CalmeRow label={t('pages.header.part')} info={t('pages.header.partInfo')}>
                <CalmeSegmented
                  label={t('pages.header.part')}
                  value={readMenuPart(draft)}
                  options={[
                    { value: 'all', label: t('pages.header.partAll') },
                    { value: 'first', label: t('pages.header.partFirst') },
                    { value: 'second', label: t('pages.header.partSecond') },
                  ]}
                  onChange={value => change({ part: value })}
                />
              </CalmeRow>
            </>
          )}
          {(kind === 'actions' || style !== 'list') && (
            <CalmeRow label={t('pages.header.align')}>
              <CalmeSegmented
                label={t('pages.header.align')}
                value={readAlign(draft, fallbackAlign)}
                options={[
                  { value: 'start', label: t('pages.header.alignStart') },
                  { value: 'center', label: t('pages.header.alignCenter') },
                  { value: 'end', label: t('pages.header.alignEnd') },
                ]}
                onChange={value => change({ align: value })}
              />
            </CalmeRow>
          )}
        </CalmeDialog>
      )}
    </DialogPortal>
  );
}
