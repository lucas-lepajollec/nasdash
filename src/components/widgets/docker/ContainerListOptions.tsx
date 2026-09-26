'use client';

import React, { useState } from 'react';
import { Pencil } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import type { WidgetSettings } from '@/lib/pages/types';
import { CalmeDialog, CalmeField } from '@/components/shared/CalmeDialog';
import CustomSelect from '@/components/shared/CustomSelect';
import { DialogPortal } from '@/widgets/devices/ColorDialog';

/** Rows shown before the list scrolls inside, when not chosen. */
export const DEFAULT_VISIBLE_ROWS = 7;

/** `settings.visibleRows`: a number of rows, `'all'` (no inner scroll) or the default. */
export function visibleRowsOf(settings: WidgetSettings | undefined): number | 'all' {
  const value = settings?.visibleRows;
  if (value === 'all') return 'all';
  return typeof value === 'number' && value >= 1 && value <= 50 ? value : DEFAULT_VISIBLE_ROWS;
}

/** Edit mode: the ✎ chooses how many containers show before the list scrolls. */
export function ContainerListOptions({ settings, onUpdate }: { settings: WidgetSettings; onUpdate: (settings: WidgetSettings) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState('default');
  const title = t('dockerList.settingsTitle');
  const choices = [
    { value: 'default', label: t('dockerList.rowsDefault', { count: DEFAULT_VISIBLE_ROWS }) },
    { value: 'all', label: t('Tout afficher') },
    ...[4, 5, 6, 8, 10, 12, 16].map(count => ({ value: String(count), label: t('dockerList.rows', { count }) })),
  ];
  const openDialog = () => {
    const current = settings.visibleRows;
    setRows(current === 'all' ? 'all' : typeof current === 'number' ? String(current) : 'default');
    setOpen(true);
  };
  const save = () => {
    onUpdate({ ...settings, visibleRows: rows === 'default' ? null : rows === 'all' ? 'all' : Number(rows) });
    setOpen(false);
  };
  return (
    <>
      <button type="button" className="nd-action-icon accent" onClick={event => { event.stopPropagation(); openDialog(); }} title={title} aria-label={title}>
        <Pencil size={13} />
      </button>
      {open && (
        <DialogPortal onClose={() => setOpen(false)}>
          {ref => (
            <CalmeDialog
              dialogRef={ref}
              label={title}
              title={title}
              onClose={() => setOpen(false)}
              footer={<>
                <button type="button" className="nd-btn" onClick={() => setOpen(false)}>{t('Annuler')}</button>
                <button type="button" className="nd-btn nd-btn-accent" onClick={save}>{t('Enregistrer')}</button>
              </>}
            >
              <CalmeField label={t('dockerList.rowsLabel')}>
                <CustomSelect ariaLabel={t('dockerList.rowsLabel')} value={rows} options={choices} onChange={setRows} />
              </CalmeField>
            </CalmeDialog>
          )}
        </DialogPortal>
      )}
    </>
  );
}
