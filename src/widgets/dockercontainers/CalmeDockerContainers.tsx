'use client';

import React, { useState } from 'react';
import { SetupGuide } from '@/components/integrations/SetupGuide';
import { ChevronLeft, ChevronRight, Loader2, Pencil, Play, Square } from 'lucide-react';
import { WidgetHeaderActions } from '@/components/widgets/WidgetHeaderActions';
import { useWidgetSize } from '@/components/widgets/WidgetContainer';
import { getDockerErrorPresentation } from '@/lib/dockerErrorContract';
import { useI18n } from '@/i18n/I18nProvider';
import type { WidgetSettings } from '@/lib/pages/types';
import { CalmeWidget } from '../calme';
import { CalmeDialog, CalmeField } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import CustomSelect from '@/components/shared/CustomSelect';
import { DialogPortal } from '../devices/ColorDialog';
import { containerName, getPaddedList, useDockerContainers } from './useDockerContainers';

type Props = {
  editMode?: boolean;
  widgetProps?: { itemsPerPage?: number | 'all' | null; autoScroll?: boolean };
  onUpdateProps?: (settings: WidgetSettings) => void;
  isVisible?: boolean;
};

/**
 * Calme containers: quiet rows (status dot, name, image, uptime, start/stop
 * on hover) in as many columns as the block allows. Same host choice,
 * pagination, "items per page" and automatic scrolling as the Classic version.
 */
export default function CalmeDockerContainers({ editMode, widgetProps, onUpdateProps, isVisible = true }: Props) {
  const { t } = useI18n();
  const { size } = useWidgetSize();
  const { hosts, selectedHostId, setSelectedHostId, containerList, error, isLoading, allowActions, actionRunning, toggleContainer } = useDockerContainers({ editMode, isVisible });
  const [page, setPage] = useState(1);
  const title = t('Conteneurs Docker');

  if (hosts.length === 0) {
    return <CalmeWidget title={title} editMode={editMode}><SetupGuide kind="docker" /></CalmeWidget>;
  }

  let perPage = size === 'wide' && containerList.length > 5 ? 10 : 6;
  if (widgetProps?.itemsPerPage) perPage = widgetProps.itemsPerPage === 'all' ? 9999 : Number(widgetProps.itemsPerPage);
  const autoScroll = !!widgetProps?.autoScroll && containerList.length > perPage;
  const pages = Math.max(1, Math.ceil(containerList.length / perPage));
  const current = Math.min(page, pages);
  const visible = containerList.slice((current - 1) * perPage, current * perPage);
  const running = containerList.filter((c: any) => c.state === 'running').length;
  const errorPresentation = getDockerErrorPresentation(error);

  const row = (c: any, key: string) => {
    const busy = !!actionRunning[c.id];
    const isRunning = c.state === 'running';
    const tone = isRunning && /unhealthy/i.test(String(c.status)) ? 'other' : isRunning ? 'running' : c.state === 'exited' || c.state === 'dead' ? 'stopped' : 'other';
    return (
      <div key={key} className="ndc-ctr">
        <span className={`ndc-dot ndc-dot--${tone}`} title={c.state} />
        <span className="ndc-ctr-text">
          <span className="ndc-ctr-name" title={containerName(c)}>{containerName(c)}</span>
          <span className="ndc-ctr-image">{String(c.image).split('@')[0]}</span>
        </span>
        <span className="ndc-ctr-status" title={c.status}>{shortStatus(c.status)}</span>
        {allowActions && !editMode && (
          <button
            type="button"
            className="ndc-icon-button ndc-ctr-action"
            onClick={() => toggleContainer(c.id, c.state)}
            disabled={busy}
            title={isRunning ? t('Stop') : t('Start')}
            aria-label={[isRunning ? t("Stop") : t("Start"), containerName(c)].join(" ")}
          >
            {busy ? <Loader2 size={12} className="nd-spin" /> : isRunning ? <Square size={10} /> : <Play size={11} />}
          </button>
        )}
      </div>
    );
  };

  const looped = autoScroll ? getPaddedList(containerList, 12) : [];

  return (
    <CalmeWidget
      title={title}
      editMode={editMode}
      aside={containerList.length > 0 ? `${running}/${containerList.length}` : undefined}
    >
      {editMode && onUpdateProps && (
        <WidgetHeaderActions>
          <ContainersOptions widgetProps={widgetProps} onUpdateProps={onUpdateProps} />
        </WidgetHeaderActions>
      )}
      <div className="ndc-ctrs">
        {(hosts.length > 1 || (!autoScroll && pages > 1)) && (
          <div className="ndc-ctrs-bar">
            {hosts.length > 1 ? (
              <select
                className="ndc-select"
                value={selectedHostId ?? ''}
                onChange={event => { setSelectedHostId(event.target.value); setPage(1); }}
                aria-label={t('calme.dockerHost')}
              >
                {hosts.map(host => <option key={host.id} value={host.id}>{host.name}</option>)}
              </select>
            ) : <span />}
            {!autoScroll && pages > 1 && (
              <span className="ndc-pager">
                <button type="button" className="ndc-icon-button" disabled={current === 1} onClick={() => setPage(current - 1)} aria-label={t('calme.previousPage')}><ChevronLeft size={13} /></button>
                <span>{current}/{pages}</span>
                <button type="button" className="ndc-icon-button" disabled={current === pages} onClick={() => setPage(current + 1)} aria-label={t('calme.nextPage')}><ChevronRight size={13} /></button>
              </span>
            )}
          </div>
        )}

        {isLoading && containerList.length === 0 && <div className="ndc-empty"><Loader2 size={16} className="nd-spin" /></div>}
        {error && (
          <div className={`ndc-empty ${errorPresentation.tone === 'warning' ? '' : 'ndc-empty--error'}`}>
            <span>{errorPresentation.title}</span>
            <span className="ndc-sub">{errorPresentation.hint}</span>
          </div>
        )}
        {!isLoading && !error && containerList.length === 0 && <div className="ndc-empty">{t('Aucun conteneur trouvé sur cet hôte.')}</div>}

        {!error && containerList.length > 0 && (autoScroll ? (
          <div className="ndc-ctrs-viewport" style={{ '--ndc-rows': perPage } as React.CSSProperties}>
            <div className="ndc-ctrs-grid ndc-ctrs-loop" style={{ animationDuration: `${looped.length * 2}s` }}>
              {looped.map((c: any, index: number) => row(c, `a-${c.id}-${index}`))}
              {looped.map((c: any, index: number) => row(c, `b-${c.id}-${index}`))}
            </div>
          </div>
        ) : (
          <div className="ndc-ctrs-grid">{visible.map((c: any) => row(c, c.id))}</div>
        ))}
      </div>
    </CalmeWidget>
  );
}

/** "Up 3 hours (healthy)" → "3 hours"; other states keep their text without the details in brackets. */
function shortStatus(status: string): string {
  const text = String(status || '').replace(/\s*\([^)]*\)/g, '').trim();
  return /^up\s/i.test(text) ? text.replace(/^up\s+/i, '') : text;
}

/** Edit mode: the ✎ opens the settings dialog (items per page, automatic scrolling). */
function ContainersOptions({ widgetProps, onUpdateProps }: Required<Pick<Props, 'onUpdateProps'>> & Pick<Props, 'widgetProps'>) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [perPage, setPerPage] = useState<string>(String(widgetProps?.itemsPerPage ?? 'default'));
  const [autoScroll, setAutoScroll] = useState(!!widgetProps?.autoScroll);
  const title = t('dockerContainers.settingsTitle');
  const choices = [
    { value: 'default', label: t('Par défaut') },
    { value: 'all', label: t('Tout afficher') },
    ...[4, 6, 8, 12, 16].map(count => ({ value: String(count), label: t('dockerContainers.perPage', { count }) })),
  ];
  const openDialog = () => {
    setPerPage(String(widgetProps?.itemsPerPage ?? 'default'));
    setAutoScroll(!!widgetProps?.autoScroll);
    setOpen(true);
  };
  const save = () => {
    onUpdateProps({ itemsPerPage: perPage === 'default' ? null : perPage === 'all' ? 'all' : Number(perPage), autoScroll });
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
              <CalmeField label={t('ÉLÉMENTS PAR PAGE')}>
                <CustomSelect ariaLabel={t('ÉLÉMENTS PAR PAGE')} value={perPage} options={choices} onChange={setPerPage} />
              </CalmeField>
              <CalmeRow label={t('Défilement automatique')} info={t('dockerContainers.autoScrollHint')}>
                <CalmeSwitch label={t('Défilement automatique')} checked={autoScroll} onChange={setAutoScroll} />
              </CalmeRow>
            </CalmeDialog>
          )}
        </DialogPortal>
      )}
    </>
  );
}
