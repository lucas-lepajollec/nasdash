'use client';

import React, { useEffect, useState } from 'react';
import { Box, Container, Database, Layers, Loader2, Play, Plus, RefreshCw, RotateCcw, Search, Square, Trash2, X } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { Emoji } from '../../shared/Emoji';
import { ContainerDetailView, DockerErrorNotice, ImagesTab, VolumesTab } from './DockerViews';
import { useDockerWorkspace } from './DockerWorkspace';
import { WidgetHeaderActions } from '../WidgetHeaderActions';
import { CalmeWidget, useCalme } from '@/widgets/calme';

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

function NoHostCallToAction() {
  const { t } = useI18n();
  const { user } = useConfig();
  const { openHostForm } = useDockerWorkspace();
  return (
    <div className="nd-docker-empty nd-card" style={{ borderStyle: 'dashed', borderWidth: 2, width: '100%', boxSizing: 'border-box' }}>
      <div className="nd-docker-empty-icon" style={{ fontSize: '3rem', opacity: 0.9, display: 'flex', justifyContent: 'center', marginBottom: 16 }}><Emoji emoji="🐳" /></div>
      <div className="nd-docker-empty-title" style={{ fontSize: '1.1rem', marginBottom: 10 }}>{t('Docker Manager')}</div>
      <div className="nd-docker-empty-desc" style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: 20, lineHeight: 1.6 }}>
        {t('Aucun hôte Docker configuré. Ajoutez un hôte pour commencer à gérer vos conteneurs, images et volumes depuis votre dashboard.')}
      </div>
      {user?.role === 'admin' && (
        <button className="nd-btn nd-btn-accent" onClick={openHostForm} style={{ margin: '0 auto' }}>
          <Plus size={16} /> {t('Ajouter un hôte Docker')}
        </button>
      )}
    </div>
  );
}

export function DockerHostsWidget({ editMode }: DockerWidgetProps) {
  const { t } = useI18n();
  const { hosts, activeHostId, setActiveHostId, setSelectedContainerId, openHostForm, requestHostRemoval } = useDockerWorkspace();
  if (hosts.length === 0) return <NoHostCallToAction />;
  return (
    <div className="nd-sidebar-card">
      <div className="nd-section-title" style={{ marginBottom: 8 }}>
        <Box size={12} style={{ color: 'var(--nd-accent)' }} />
        {t('Hôtes Docker')}
        {editMode && (
          <WidgetHeaderActions>
            <button className="nd-action-icon success" onClick={openHostForm} style={{ marginLeft: 'auto' }} title={t('Ajouter un hôte Docker')} aria-label={t('Ajouter un hôte Docker')}>
              <Plus size={13} />
            </button>
          </WidgetHeaderActions>
        )}
      </div>
      <div className="nd-host-selector">
        {hosts.map(host => (
          <button
            key={host.id}
            className={`nd-host-btn ${activeHostId === host.id ? 'nd-host-btn--active' : ''}`}
            onClick={() => { setActiveHostId(host.id); setSelectedContainerId(null); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span style={{ display: 'flex', alignItems: 'center' }}><Emoji emoji={host.icon} /></span> {host.name}
            {editMode && (
              <span
                role="button"
                tabIndex={0}
                aria-label={t("Supprimer l'hôte Docker")}
                onClick={event => { event.stopPropagation(); requestHostRemoval({ id: host.id, name: host.name }); }}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    requestHostRemoval({ id: host.id, name: host.name });
                  }
                }}
                style={{ marginLeft: 4, cursor: 'pointer', opacity: 0.5 }}
              >
                <X size={10} />
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DockerSummaryWidget({ editMode }: Partial<DockerWidgetProps>) {
  const { t } = useI18n();
  const calme = useCalme();
  const { hosts, visibleContainers } = useDockerWorkspace();
  if (hosts.length === 0) return null;
  const running = visibleContainers.filter(container => container.state === 'running').length;
  const stopped = visibleContainers.filter(container => container.state === 'exited').length;
  if (calme) {
    return (
      <CalmeWidget title={t('docker.calme.counters')} editMode={editMode}>
        <dl className="ndc-counters">
          <div><dt><span className="ndc-dot ndc-dot--running" />{t('Actifs')}</dt><dd>{running}</dd></div>
          <div><dt><span className="ndc-dot ndc-dot--stopped" />{t('Stoppés')}</dt><dd>{stopped}</dd></div>
        </dl>
      </CalmeWidget>
    );
  }
  return (
    <div className="nd-sidebar-card">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <div style={{ textAlign: 'center', padding: '6px 0' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--nd-green)' }}>{running}</div>
          <div style={{ fontSize: '0.58rem', color: 'var(--nd-text-muted)', textTransform: 'uppercase' }}>{t('Actifs')}</div>
        </div>
        <div style={{ textAlign: 'center', padding: '6px 0' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--nd-red)' }}>{stopped}</div>
          <div style={{ fontSize: '0.58rem', color: 'var(--nd-text-muted)', textTransform: 'uppercase' }}>{t('Stoppés')}</div>
        </div>
      </div>
    </div>
  );
}

export function DockerContainerListWidget({ searchQuery = '' }: DockerWidgetProps) {
  const { t } = useI18n();
  const {
    hosts, visibleContainers, containersError, containersLoading,
    selectedContainerId, setSelectedContainerId, requestAction, actionLoading,
  } = useDockerWorkspace();
  const [localSearch, setLocalSearch] = useState('');
  if (hosts.length === 0) return null;
  const search = (searchQuery || localSearch).toLowerCase();
  const filtered = visibleContainers.filter(container => !search
    || container.names?.some(name => name.toLowerCase().includes(search))
    || container.image?.toLowerCase().includes(search)
    || container.id?.toLowerCase().includes(search));

  return (
    <div className="nd-docker-container-list" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
      <div className="nd-mobile-scroll nd-docker-container-list-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 4, paddingBottom: 4 }}>
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
    containerDetail, images, imagesError, imagesLoading, refreshImages,
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
        selectedContainerId && containerDetail ? (
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
        <ImagesTab images={images} error={imagesError} loading={imagesLoading} containers={visibleContainers} hostId={activeHostId!} refreshImages={() => refreshImages()} selectedContainer={selectedContainer} />
      )}
      {tab === 'volumes' && (
        <VolumesTab volumes={volumes} error={volumesError} loading={volumesLoading} containers={visibleContainers} hostId={activeHostId!} refreshVolumes={() => refreshVolumes()} selectedContainer={selectedContainer} />
      )}
    </div>
  );
}
