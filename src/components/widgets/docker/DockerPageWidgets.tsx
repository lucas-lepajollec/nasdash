'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SetupGuide } from '@/components/integrations/SetupGuide';
import { useOpenSettings } from '@/components/integrations/useOpenSettings';
import type { WidgetSettings } from '@/lib/pages/types';
import { ContainerListOptions, visibleRowsOf } from './ContainerListOptions';
import { AlertCircle, Container, Database, Hash, Layers, Loader2, Pencil, Play, Plus, RefreshCw, RotateCcw, Search, SlidersHorizontal, Square, Trash2, X } from 'lucide-react';
import { SortableMetrics } from '@/widgets/devices/SortableMetrics';
import { useI18n } from '@/i18n/I18nProvider';
import { Emoji } from '../../shared/Emoji';
import { ContainerDetailView, DockerErrorNotice, ImagesTab, VolumesTab } from './DockerViews';
import { useDockerWorkspace } from './DockerWorkspace';
import { WidgetHeaderActions } from '../WidgetHeaderActions';
import { CalmeWidget } from '@/widgets/calme';

/**
 * The historical Docker page, split into linked widgets. Their markup and
 * behaviour are those of the former page; widgets on the same page share the
 * active host and the selected container through the Docker workspace.
 */

interface DockerWidgetProps {
  editMode: boolean;
  searchQuery?: string;
  showSensitive?: boolean;
  isVisible?: boolean;
}

/** No Docker engine yet: the first step, linking to the Integrations page. */
function NoHostCallToAction() {
  return <div className="nd-card ndc-box"><SetupGuide kind="docker" /></div>;
}

/** Running and stopped containers of the active host; a dash while they load. */
function DockerCounters({ loading }: { loading: boolean }) {
  const { t } = useI18n();
  const { visibleContainers } = useDockerWorkspace();
  const running = visibleContainers.filter(container => container.state === 'running').length;
  const stopped = visibleContainers.filter(container => container.state === 'exited').length;
  return (
    <dl className={`ndc-counters ${loading ? 'is-loading' : ''}`} aria-busy={loading}>
      <div><dt><span className="ndc-dot ndc-dot--running" />{t('Actifs')}</dt><dd>{loading ? '–' : running}</dd></div>
      <div><dt><span className="ndc-dot ndc-dot--stopped" />{t('Stoppés')}</dt><dd>{loading ? '–' : stopped}</dd></div>
    </dl>
  );
}

/**
 * The Docker hosts and, under them, the containers of the chosen one
 * (running / stopped). In edit mode a host can be edited, removed or dragged
 * to a new place; the host being opened or removed shows a spinner.
 */
export function DockerHostsWidget({ editMode, settings = {}, onUpdateSettings }: DockerWidgetProps & { settings?: WidgetSettings; onUpdateSettings?: (settings: WidgetSettings) => void }) {
  const { t } = useI18n();
  const {
    hosts, activeHostId, setActiveHostId, setSelectedContainerId, openHostForm, requestHostRemoval, moveHost, removingHostIds,
    containersLoading, containersError, summaryOnPage,
  } = useDockerWorkspace();
  const { openIntegrations } = useOpenSettings();
  if (hosts.length === 0) return <NoHostCallToAction />;
  const showCounters = settings.counters !== false && !summaryOnPage;
  const loading = containersLoading && !containersError;
  const chip = (host: typeof hosts[number]) => {
    const active = activeHostId === host.id;
    const removing = removingHostIds.includes(host.id);
    const state = removing ? t('docker.hosts.removing') : active && loading ? t('docker.hosts.loading') : active && containersError ? t('docker.hosts.unreachable') : '';
    return (
      <span className={`ndc-host ${removing ? 'is-busy' : ''}`}>
        <button
          type="button"
          className="ndc-chip"
          aria-pressed={active}
          disabled={removing}
          title={state || undefined}
          onClick={() => { setActiveHostId(host.id); setSelectedContainerId(null); }}
        >
          <Emoji emoji={host.icon} />
          <span className="ndc-host-name">{host.name}</span>
          {(removing || (active && loading)) && <Loader2 size={12} className="nd-spin" aria-hidden="true" />}
          {!removing && active && containersError && <AlertCircle size={12} className="ndc-host-error" aria-hidden="true" />}
          {state && <span className="nd-sr-only">{state}</span>}
        </button>
        {editMode && (
          <>
            <button type="button" className="ndc-icon-button ndc-host-tool" disabled={removing} onClick={() => openHostForm(host)} title={t('docker.hosts.editNamed', { name: host.name })} aria-label={t('docker.hosts.editNamed', { name: host.name })}>
              <Pencil size={12} />
            </button>
            <button type="button" className="ndc-icon-button ndc-host-tool is-danger" disabled={removing} onClick={() => requestHostRemoval({ id: host.id, name: host.name })} title={t("Supprimer l'hôte Docker")} aria-label={[t("Supprimer l'hôte Docker"), host.name].join(' · ')}>
              <X size={12} />
            </button>
          </>
        )}
      </span>
    );
  };
  // Calme shell: the title follows "hide titles" and can be renamed; hosts are
  // neutral chips, only the chosen one takes the accent.
  return (
    <CalmeWidget title={t('Hôtes Docker')} editMode={editMode}>
      {editMode && (
        <WidgetHeaderActions>
          {onUpdateSettings && !summaryOnPage && (
            <button type="button" className={`nd-action-icon ${showCounters ? 'accent' : ''}`} aria-pressed={showCounters} onClick={() => onUpdateSettings({ ...settings, counters: showCounters ? false : null })} title={t('docker.hosts.counters')} aria-label={t('docker.hosts.counters')}>
              <Hash size={13} />
            </button>
          )}
          {/* Connections are also listed on the Integrations page, Docker section. */}
          <button type="button" className="nd-action-icon" onClick={() => openIntegrations('docker')} title={t('docker.hosts.manage')} aria-label={t('docker.hosts.manage')}>
            <SlidersHorizontal size={13} />
          </button>
          <button type="button" className="nd-action-icon success" onClick={() => openHostForm()} title={t('Ajouter un hôte Docker')} aria-label={t('Ajouter un hôte Docker')}>
            <Plus size={13} />
          </button>
        </WidgetHeaderActions>
      )}
      <SortableMetrics
        className={`ndc-hosts ${editMode ? 'is-editing' : ''}`}
        enabled={editMode}
        items={hosts.map(host => ({ id: host.id, label: host.name, content: chip(host) }))}
        onMove={moveHost}
      />
      {showCounters && <DockerCounters loading={loading} />}
    </CalmeWidget>
  );
}

/** The former counters widget: its figures now live in the hosts widget. */
export function DockerSummaryWidget({ editMode, onRemove }: Partial<DockerWidgetProps> & { onRemove?: () => void }) {
  const { t } = useI18n();
  const { hosts, containersError, containersLoading } = useDockerWorkspace();
  if (hosts.length === 0) return null;
  if (containersError) return <DockerErrorNotice error={containersError} compact />;
  return (
    <CalmeWidget title={t('docker.calme.counters')} editMode={editMode}>
      <DockerCounters loading={containersLoading} />
      {editMode && (
        <p className="ndc-merge-note">
          <span>{t('docker.hosts.countersMoved')}</span>
          {onRemove && <button type="button" className="nd-btn" onClick={onRemove}>{t('docker.hosts.removeCounters')}</button>}
        </p>
      )}
    </CalmeWidget>
  );
}

export function DockerContainerListWidget({ editMode, searchQuery = '', settings = {}, onUpdateSettings }: DockerWidgetProps & { settings?: WidgetSettings; onUpdateSettings?: (settings: WidgetSettings) => void }) {
  const { t } = useI18n();
  const {
    hosts, visibleContainers, containersError, containersLoading,
    selectedContainerId, setSelectedContainerId, requestAction, actionLoading,
  } = useDockerWorkspace();
  const [localSearch, setLocalSearch] = useState('');
  const rows = visibleRowsOf(settings);
  const list = useRef<HTMLDivElement>(null);
  const [rowsHeight, setRowsHeight] = useState<number | null>(null);
  const search = (searchQuery || localSearch).toLowerCase();
  const filtered = visibleContainers.filter(container => !search
    || container.names?.some(name => name.toLowerCase().includes(search))
    || container.image?.toLowerCase().includes(search)
    || container.id?.toLowerCase().includes(search));
  // Exactly the chosen number of cards, measured: the next one starts below the fold, not half visible.
  useLayoutEffect(() => {
    const element = list.current;
    if (!element || rows === 'all') return;
    const measure = () => {
      const cards = element.querySelectorAll<HTMLElement>('.nd-container-card');
      const last = cards[Math.min(rows, cards.length) - 1];
      if (!last || cards.length <= rows) { setRowsHeight(null); return; }
      setRowsHeight(Math.ceil(last.getBoundingClientRect().bottom - element.getBoundingClientRect().top + element.scrollTop + 4));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [rows, filtered.length]);
  if (hosts.length === 0) return null;

  return (
    <div className="nd-docker-container-list" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {editMode && onUpdateSettings && (
        <WidgetHeaderActions><ContainerListOptions settings={settings} onUpdate={onUpdateSettings} /></WidgetHeaderActions>
      )}
      <div style={{ position: 'relative' }}>
        <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--nd-text-dimmed)', pointerEvents: 'none' }} />
        <input
          className="nd-input"
          value={localSearch}
          onChange={event => setLocalSearch(event.target.value)}
          placeholder={t('Filtrer les conteneurs...')}
          aria-label={t('Filtrer les conteneurs...')}
          style={{ paddingLeft: 30, fontSize: '0.72rem' }}
        />
      </div>
      <div
        ref={list}
        className={`nd-mobile-scroll nd-docker-container-list-scroll ${rows === 'all' ? 'is-unbounded' : ''}`}
        style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 4, paddingBottom: 4, ...(rows !== 'all' ? { '--nd-list-rows': rows } : {}), ...(rowsHeight ? { maxHeight: rowsHeight } : {}) } as React.CSSProperties}
      >
        {containersLoading && visibleContainers.length === 0 && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Loader2 size={16} className="nd-spin" style={{ color: 'var(--nd-text-dimmed)' }} />
          </div>
        )}
        {containersError && <DockerErrorNotice error={containersError} compact />}
        {!containersError && filtered.map(container => {
          const name = container.names[0] || container.id;
          return (
            <div
              key={container.id}
              role="button"
              tabIndex={0}
              aria-pressed={selectedContainerId === container.fullId}
              className={`nd-container-card nd-container-card--${container.state} ${selectedContainerId === container.fullId ? 'nd-container-card--selected' : ''}`}
              onClick={() => setSelectedContainerId(container.fullId)}
              onKeyDown={event => {
                if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault();
                  setSelectedContainerId(container.fullId);
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className={`nd-status-dot nd-status-dot--${container.state}`} />
                    <span style={{ fontWeight: 700, fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                  </div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--nd-text-dimmed)', marginTop: 2, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {container.image}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {container.state === 'running' ? (
                    <>
                      <button className="nd-action-icon accent" onClick={event => { event.stopPropagation(); requestAction(container.fullId, 'restart', name); }} title={t('Redémarrer')} aria-label={t('docker.restartNamed', { name })} disabled={!!actionLoading}>
                        <RotateCcw size={12} />
                      </button>
                      <button className="nd-action-icon danger" onClick={event => { event.stopPropagation(); requestAction(container.fullId, 'stop', name); }} title={t('Arrêter')} aria-label={t('docker.stopNamed', { name })} disabled={!!actionLoading}>
                        <Square size={12} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="nd-action-icon success" onClick={event => { event.stopPropagation(); requestAction(container.fullId, 'start', name); }} title={t('Démarrer')} aria-label={t('docker.startNamed', { name })} disabled={!!actionLoading}>
                        <Play size={12} />
                      </button>
                      <button className="nd-action-icon danger" onClick={event => { event.stopPropagation(); requestAction(container.fullId, 'remove', name); }} title={t('Supprimer')} aria-label={t('docker.removeNamed', { name })} disabled={!!actionLoading}>
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div style={{ fontSize: '0.58rem', color: 'var(--nd-text-dimmed)', marginTop: 4 }}>{container.status}</div>
            </div>
          );
        })}
        {!containersError && !containersLoading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 16, fontSize: '0.7rem', color: 'var(--nd-text-dimmed)' }}>
            {search ? t('Aucun conteneur correspondant') : t('Aucun conteneur')}
          </div>
        )}
      </div>
    </div>
  );
}

type ExplorerTab = 'containers' | 'images' | 'volumes';

export function DockerExplorerWidget({ showSensitive = false, isVisible = true }: DockerWidgetProps) {
  const { t } = useI18n();
  const {
    hosts, activeHostId, visibleContainers, selectedContainerId, setSelectedContainerId,
    containerDetail, detailError, images, imagesError, imagesLoading, refreshImages,
    volumes, volumesError, volumesLoading, refreshVolumes, refreshContainers,
    requestAction, actionLoading,
  } = useDockerWorkspace();
  const [tab, setTab] = useState<ExplorerTab>('containers');

  // Like the former page, show the first container instead of an empty panel.
  useEffect(() => {
    if (tab === 'containers' && !selectedContainerId && visibleContainers.length > 0) {
      setSelectedContainerId(visibleContainers[0].fullId);
    }
  }, [tab, visibleContainers, selectedContainerId, setSelectedContainerId]);

  if (hosts.length === 0) return <NoHostCallToAction />;
  const selectedContainer = visibleContainers.find(container => container.fullId === selectedContainerId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div className="nd-docker-tabs" role="tablist" style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 12 }}>
        <button role="tab" aria-selected={tab === 'containers'} className={`nd-docker-tab ${tab === 'containers' ? 'nd-docker-tab--active' : ''}`} onClick={() => setTab('containers')} style={{ flexShrink: 0 }}>
          <Container size={12} /> {t('Conteneurs (')}{visibleContainers.length})
        </button>
        <button role="tab" aria-selected={tab === 'images'} className={`nd-docker-tab ${tab === 'images' ? 'nd-docker-tab--active' : ''}`} onClick={() => setTab('images')} style={{ flexShrink: 0 }}>
          <Layers size={12} /> {t('Images (')}{images.length})
        </button>
        <button role="tab" aria-selected={tab === 'volumes'} className={`nd-docker-tab ${tab === 'volumes' ? 'nd-docker-tab--active' : ''}`} onClick={() => setTab('volumes')} style={{ flexShrink: 0 }}>
          <Database size={12} /> {t('Volumes (')}{volumes.length})
        </button>
        <button
          className="nd-action-icon"
          onClick={() => refreshContainers()}
          title={t('Rafraîchir')}
          aria-label={t('Rafraîchir')}
          style={{ background: 'transparent', border: 'none', padding: 4, flexShrink: 0, marginLeft: 'auto' }}
        >
          <RefreshCw size={14} style={{ color: 'var(--nd-text-muted)' }} />
        </button>
      </div>

      {tab === 'containers' && (
        detailError ? <DockerErrorNotice error={detailError} /> : selectedContainerId && containerDetail ? (
          <ContainerDetailView
            hostId={activeHostId!}
            detail={containerDetail}
            onAction={(id, action) => requestAction(id, action, containerDetail?.name || id)}
            actionLoading={actionLoading}
            showSensitive={showSensitive}
            isVisible={isVisible}
          />
        ) : (
          <div className="nd-docker-detail" style={{ minHeight: 300 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12 }}>
              <Container size={32} style={{ color: 'var(--nd-text-dimmed)', opacity: 0.3 }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--nd-text-dimmed)' }}>
                {t('Sélectionnez un conteneur dans la liste pour voir ses détails')}
              </span>
            </div>
          </div>
        )
      )}
      {tab === 'images' && (
        <ImagesTab key={activeHostId} images={images} error={imagesError} loading={imagesLoading} containers={visibleContainers} hostId={activeHostId!} refreshImages={() => refreshImages()} selectedContainer={selectedContainer} />
      )}
      {tab === 'volumes' && (
        <VolumesTab key={activeHostId} volumes={volumes} error={volumesError} loading={volumesLoading} containers={visibleContainers} hostId={activeHostId!} refreshVolumes={() => refreshVolumes()} selectedContainer={selectedContainer} />
      )}
    </div>
  );
}
