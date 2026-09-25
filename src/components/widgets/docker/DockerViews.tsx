'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { Box, Container, Image, HardDrive, Play, Square, RotateCcw, Trash2, Search, Loader2, AlertCircle, ChevronDown, Terminal, Layers, Database, Plus, X, RefreshCw } from 'lucide-react';
import ConfirmModal from '../../modals/ConfirmModal';
import EmojiPickerModal from '../../modals/EmojiPickerModal';
import useSWR from 'swr';
import { Emoji } from '../../shared/Emoji';
import { dockerJsonFetcher, getDockerErrorPresentation } from '@/lib/dockerErrorContract';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';
import { useI18n } from '@/i18n/I18nProvider';
import CustomSelect from '@/components/shared/CustomSelect';
import { CalmeDialog, CalmeField } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSegmented, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';

const fetcher = dockerJsonFetcher;

/**
 * Views shared by the Docker widgets (formerly the fixed Docker page).
 * Behaviour and markup are unchanged; only their placement became modular.
 */

export function DockerErrorNotice({ error, compact = false }: { error: unknown; compact?: boolean }) {
  const { t } = useI18n();
  const presentation = getDockerErrorPresentation(error);
  const color = presentation.tone === 'warning' ? 'var(--nd-orange)' : 'var(--nd-red)';

  return (
    <div className="nd-sidebar-card" style={{ textAlign: 'center', padding: compact ? 16 : 24 }}>
      <AlertCircle size={compact ? 16 : 20} style={{ color, marginBottom: 6 }} />
      <div style={{ fontSize: compact ? '0.7rem' : '0.75rem', color, fontWeight: 600 }}>{t(presentation.title)}</div>
      <div style={{ fontSize: compact ? '0.6rem' : '0.64rem', color: 'var(--nd-text-dimmed)', marginTop: 4 }}>{t(presentation.hint)}</div>
    </div>
  );
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatUptime(dateStr: string, t: (key: string, variables?: Record<string, string | number>) => string): string {
  const started = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - started.getTime();
  const days = Math.floor(diffMs / 86400000);
  const hours = Math.floor((diffMs % 86400000) / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  if (days > 0) return t('duration.daysHours', { days, hours });
  if (hours > 0) return t('duration.hoursMinutes', { hours, minutes: mins });
  return t('duration.minutes', { minutes: mins });
}

export function formatTimestamp(ts: number, locale: string): string {
  return new Date(ts * 1000).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function condensePorts(ports: any[]): Array<{ hostDisplay: string; containerDisplay: string }> {
  if (!ports || ports.length === 0) return [];

  const parsed = ports.map(p => {
    let hostPort: number | null = null;
    let hostIp = '';

    if (p.hostBindings && p.hostBindings.length > 0) {
      const binding = p.hostBindings[0];
      const parts = binding.split(':');
      if (parts.length > 1) {
        hostIp = parts.slice(0, -1).join(':');
        const parsedPort = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(parsedPort)) hostPort = parsedPort;
      } else {
        const parsedPort = parseInt(binding, 10);
        if (!isNaN(parsedPort)) hostPort = parsedPort;
      }
    }

    const containerPort = typeof p.containerPort === 'number' ? p.containerPort : parseInt(p.containerPort, 10);
    const validContainerPort = !isNaN(containerPort) ? containerPort : 0;

    return {
      raw: p,
      hostPort,
      hostIp,
      containerPort: validContainerPort,
      type: p.type || 'tcp'
    };
  });

  parsed.sort((a, b) => {
    if (a.hostPort !== null && b.hostPort !== null) {
      if (a.hostPort !== b.hostPort) return a.hostPort - b.hostPort;
    } else if (a.hostPort !== null) {
      return -1;
    } else if (b.hostPort !== null) {
      return 1;
    }
    return a.containerPort - b.containerPort;
  });

  const groups: Array<typeof parsed> = [];
  parsed.forEach(p => {
    if (groups.length === 0) {
      groups.push([p]);
      return;
    }

    const currentGroup = groups[groups.length - 1];
    const last = currentGroup[currentGroup.length - 1];

    const isHostSequential = (p.hostPort !== null && last.hostPort !== null && p.hostPort === last.hostPort + 1 && p.hostIp === last.hostIp);
    const isHostBothNull = (p.hostPort === null && last.hostPort === null);

    const isContainerSequential = (p.containerPort === last.containerPort + 1);
    const isSameType = (p.type === last.type);

    if ((isHostSequential || isHostBothNull) && isContainerSequential && isSameType) {
      currentGroup.push(p);
    } else {
      groups.push([p]);
    }
  });

  return groups.map(group => {
    const first = group[0];
    const last = group[group.length - 1];

    let hostDisplay = '—';
    if (first.hostPort !== null) {
      const ipPrefix = first.hostIp ? `${first.hostIp}:` : '';
      if (first.hostPort === last.hostPort || last.hostPort === null) {
        hostDisplay = `${ipPrefix}${first.hostPort}`;
      } else {
        hostDisplay = `${ipPrefix}${first.hostPort}-${last.hostPort}`;
      }
    }

    let containerDisplay = '';
    if (first.containerPort === last.containerPort) {
      containerDisplay = `${first.containerPort}/${first.type}`;
    } else {
      containerDisplay = `${first.containerPort}-${last.containerPort}/${first.type}`;
    }

    return {
      hostDisplay,
      containerDisplay
    };
  });
}

// ======================== DOCKER HOST FORM MODAL ========================
/** What the form sends: an HTTP(S) address (direct or socket proxy) or a mounted Unix socket. */
export type DockerHostDraft =
  | { name: string; icon: string; type: 'tcp'; url: string; allowSelfSigned?: boolean }
  | { name: string; icon: string; type: 'socket'; socketPath: string }
  | { name: string; icon: string; type: 'portainer' | 'dockhand'; url: string; target: string; token: string; allowSelfSigned?: boolean };

type DockerConnection = DockerHostDraft['type'];

export function DockerHostFormModal({ onClose, onSave }: {
  onClose: () => void;
  onSave: (h: DockerHostDraft) => Promise<void>;
}) {
  const { t } = useI18n();
  const { config } = useConfig();
  const demoMode = config?.demoMode === true;
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🐳');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('2375');
  const [connection, setConnection] = useState<DockerConnection>('tcp');
  const [serverUrl, setServerUrl] = useState('');
  const [environment, setEnvironment] = useState('1');
  const [apiKey, setApiKey] = useState('');
  const relay = connection === 'portainer' || connection === 'dockhand';
  const [socketPath, setSocketPath] = useState('/var/run/docker.sock');
  const [allowSelfSigned, setAllowSelfSigned] = useState(false);
  const isHttps = (relay ? serverUrl : host).trim().startsWith('https://');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const dialogRef = useDialogAccessibility(onClose);

  const submit = async () => {
              if (!name) return;
              if (relay) {
                if (!serverUrl.trim() || !environment.trim() || !apiKey) return;
                setIsSaving(true);
                setSaveError('');
                try {
                  const url = serverUrl.trim().replace(/\/$/, '');
                  await onSave({ name: name.trim(), icon, type: connection, url: /^https?:\/\//.test(url) ? url : `http://${url}`, target: environment.trim(), token: apiKey, ...(isHttps && allowSelfSigned ? { allowSelfSigned: true } : {}) });
                } catch (error) {
                  setSaveError(error instanceof Error ? error.message : 'Impossible d’ajouter cet hôte Docker.');
                } finally {
                  setIsSaving(false);
                }
                return;
              }
              if (connection === 'socket') {
                setIsSaving(true);
                setSaveError('');
                try {
                  await onSave({ name: name.trim(), icon, type: 'socket', socketPath: socketPath.trim() });
                } catch (error) {
                  setSaveError(error instanceof Error ? error.message : 'Impossible d’ajouter cet hôte Docker.');
                } finally {
                  setIsSaving(false);
                }
                return;
              }
              if (!host) return;
              const portNumber = Number(port || '2375');
              if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65_535) {
                setSaveError(t('docker.invalidPort'));
                return;
              }
              setIsSaving(true);
              setSaveError('');
              try {
                // "https://nas" keeps HTTPS; a bare name or IP means HTTP (socket proxy, TCP).
                const scheme = isHttps ? 'https' : 'http';
                const address = host.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
                await onSave({ name: name.trim(), icon, type: 'tcp', url: `${scheme}://${address}:${portNumber}`, ...(isHttps && allowSelfSigned ? { allowSelfSigned: true } : {}) });
              } catch (error) {
                setSaveError(error instanceof Error ? error.message : 'Impossible d’ajouter cet hôte Docker.');
              } finally {
                setIsSaving(false);
              }
  };
  const selfSigned = isHttps && (
    <CalmeRow label={t('integrations.allowSelfSigned')} info={t('integrations.allowSelfSignedHint')}>
      <CalmeSwitch label={t('integrations.allowSelfSigned')} checked={allowSelfSigned} onChange={setAllowSelfSigned} />
    </CalmeRow>
  );
  const connectionHint = relay
    ? t(connection === 'portainer' ? 'docker.portainerHint' : 'docker.dockhandHint')
    : connection === 'socket' ? t('docker.socketHint', { proxy: 'docker-socket-proxy' }) : t('docker.proxyHint', { proxy: 'docker-socket-proxy' });

  return (
    <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <CalmeDialog
        dialogRef={dialogRef}
        label={t("Ajouter un hôte Docker")}
        title={t("Ajouter un hôte Docker")}
        subtitle={demoMode ? t('docker.hostDemoHint', { example: 'docker-demo.invalid' }) : undefined}
        width={480}
        onClose={onClose}
        footer={<>
          <button type="button" className="nd-btn" onClick={onClose} disabled={isSaving}>{t("Annuler")}</button>
          <button type="button" className="nd-btn nd-btn-accent" disabled={isSaving || !name} onClick={() => { void submit(); }}>{isSaving ? t("Enregistrement…") : t("Ajouter")}</button>
        </>}
      >
        <div className="ndc-field-inline">
          <button type="button" className="ndc-icon-pick" aria-label={t("Choisir l’icône de l’hôte Docker")} title={t("Choisir l’icône de l’hôte Docker")} onClick={() => setIsPickerOpen(true)}>
            <Emoji emoji={icon} />
          </button>
          <CalmeField label={t("Nom de l&apos;hôte")} htmlFor="docker-host-name">
            <input id="docker-host-name" className="nd-input" value={name} onChange={e => setName(e.target.value)} placeholder={t("Mon NAS")} />
          </CalmeField>
        </div>
        {!demoMode && (
          <CalmeField label={t('docker.connection')} info={connectionHint}>
            <CalmeSegmented
              label={t('docker.connection')}
              value={connection}
              onChange={value => setConnection(value)}
              options={[
                { value: 'tcp', label: t('docker.calme.address') },
                { value: 'socket', label: t('docker.calme.socket') },
                { value: 'portainer', label: t('docker.connection.portainer') },
                { value: 'dockhand', label: t('docker.connection.dockhand') },
              ]}
            />
          </CalmeField>
        )}
        {relay ? (
          <>
            <CalmeField label={t('docker.serverUrl')}>
              <input className="nd-input" value={serverUrl} onChange={e => setServerUrl(e.target.value)} placeholder={connection === 'portainer' ? 'https://portainer.lan:9443' : 'http://dockhand.lan:3000'} />
            </CalmeField>
            <div className="ndc-field-grid">
              <CalmeField label={t('docker.environmentId')}>
                <input className="nd-input" value={environment} onChange={e => setEnvironment(e.target.value)} placeholder="1" />
              </CalmeField>
              <CalmeField label={t('docker.apiKey')}>
                <input className="nd-input" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="••••••••" />
              </CalmeField>
            </div>
            {selfSigned}
          </>
        ) : connection === 'socket' ? (
          <CalmeField label={t('docker.socketPath')}>
            <input className="nd-input" value={socketPath} onChange={e => setSocketPath(e.target.value)} placeholder="/var/run/docker.sock" />
          </CalmeField>
        ) : (
          <>
            <div className="ndc-field-grid" style={{ gridTemplateColumns: '1fr 110px' }}>
              <CalmeField label={t("Adresse / Hôte Docker")} info={demoMode ? undefined : connectionHint}>
                <input className="nd-input" value={host} onChange={e => setHost(e.target.value)} placeholder={demoMode ? 'docker-demo.invalid' : t("docker-proxy ou 192.168.0.200")} />
              </CalmeField>
              <CalmeField label={t("Port API Docker")}>
                <input className="nd-input" value={port} onChange={e => setPort(e.target.value)} placeholder="2375" />
              </CalmeField>
            </div>
            {selfSigned}
          </>
        )}
        {saveError && <p className="ndc-dialog-hint" style={{ color: 'var(--nd-red)' }}>{saveError}</p>}
      </CalmeDialog>
      {isPickerOpen && (
        <EmojiPickerModal
          initialEmoji={icon}
          onSelect={(emoji: string) => {
            setIcon(emoji);
            setIsPickerOpen(false);
          }}
          onClose={() => setIsPickerOpen(false)}
        />
      )}
    </div>
  );
}

// ======================== CONTAINER LOGS ========================
export function ContainerLogs({ hostId, containerId, showSensitive, enabled }: { hostId: string; containerId: string; showSensitive: boolean; enabled: boolean }) {
  const { t } = useI18n();
  const { data, error } = useSWR(
    enabled ? `/api/docker/${hostId}/containers/${containerId}/logs?tail=150` : null,
    fetcher,
    { refreshInterval: 3000 }
  );
  const terminalRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [data, autoScroll]);

  const lines: string[] = data?.lines || [];

  const classifyLine = (line: string) => {
    const lower = line.toLowerCase();
    if (lower.includes('error') || lower.includes('fatal') || lower.includes('panic')) return 'nd-terminal-line--error';
    if (lower.includes('warn') || lower.includes('warning')) return 'nd-terminal-line--warn';
    if (lower.includes('info')) return 'nd-terminal-line--info';
    return '';
  };

  if (error) {
    const presentation = getDockerErrorPresentation(error);
    return <div style={{ fontSize: '0.7rem', color: presentation.tone === 'warning' ? 'var(--nd-orange)' : 'var(--nd-red)', padding: 12 }}>{t(presentation.title)} — {t(presentation.hint)}</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--nd-text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Terminal size={12} /> {t("Logs")}
        </span>
        <label style={{ fontSize: '0.6rem', color: 'var(--nd-text-dimmed)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} style={{ width: 12, height: 12 }} />
          {t("Auto-scroll")}
        </label>
      </div>
      <div ref={terminalRef} className="nd-terminal" onScroll={() => {
        if (!terminalRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = terminalRef.current;
        setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
      }}>
        {!showSensitive ? (
          <span style={{ color: 'var(--nd-text-dimmed)' }}>{t("Logs masqués — désactivez le mode secret pour afficher")}</span>
        ) : lines.length === 0 ? (
          <span style={{ color: 'var(--nd-text-dimmed)' }}>{t("Aucun log disponible")}</span>
        ) : (
          lines.map((line, i) => (
            <span key={i} className={`nd-terminal-line ${classifyLine(line)}`}>{line}{'\n'}</span>
          ))
        )}
      </div>
    </div>
  );
}

// ======================== CONTAINER DETAIL VIEW ========================
export function ContainerDetailView({ hostId, detail, onAction, actionLoading, showSensitive, isVisible }: {
  hostId: string;
  detail: any;
  onAction: (id: string, action: 'start' | 'stop' | 'restart' | 'remove') => void;
  actionLoading: string | null;
  showSensitive: boolean;
  isVisible: boolean;
}) {
  const { t } = useI18n();
  if (!detail) return null;

  const isRunning = detail.state === 'running';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div className="nd-docker-detail">
        <div className="nd-docker-detail-header">
          <div>
            <div className="nd-docker-detail-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`nd-status-dot nd-status-dot--${detail.state}`} />
              {detail.name}
            </div>
            <div className="nd-docker-detail-image">{detail.image}</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {isRunning ? (
              <>
                <button className="nd-action-icon accent" onClick={() => onAction(detail.fullId, 'restart')} disabled={!!actionLoading} title={t("Redémarrer")}>
                  <RotateCcw size={14} />
                </button>
                <button className="nd-action-icon danger" onClick={() => onAction(detail.fullId, 'stop')} disabled={!!actionLoading} title={t("Arrêter")}>
                  <Square size={14} />
                </button>
                <button className="nd-action-icon danger" onClick={() => onAction(detail.fullId, 'remove')} disabled={!!actionLoading} title={t("Supprimer")}>
                  <Trash2 size={14} />
                </button>
              </>
            ) : (
              <>
                <button className="nd-action-icon success" onClick={() => onAction(detail.fullId, 'start')} disabled={!!actionLoading} title={t("Démarrer")}>
                  <Play size={14} />
                </button>
                <button className="nd-action-icon danger" onClick={() => onAction(detail.fullId, 'remove')} disabled={!!actionLoading} title={t("Supprimer")}>
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        {detail.stats && isRunning && (
          <div className="nd-docker-stats-grid">
            <div className="nd-docker-stat-card">
              <div className="nd-docker-stat-value">{detail.stats.cpuPercent}%</div>
              <div className="nd-docker-stat-label">CPU</div>
            </div>
            <div className="nd-docker-stat-card">
              <div className="nd-docker-stat-value">{detail.stats.memPercent}%</div>
              <div className="nd-docker-stat-label">{t("RAM (")}{formatBytes(detail.stats.memUsage)} / {formatBytes(detail.stats.memLimit)})</div>
            </div>
            <div className="nd-docker-stat-card">
              <div className="nd-docker-stat-value">{formatBytes(detail.stats.netInput)}</div>
              <div className="nd-docker-stat-label">{t("↓ Réseau (IN)")}</div>
            </div>
            <div className="nd-docker-stat-card">
              <div className="nd-docker-stat-value">{formatBytes(detail.stats.netOutput)}</div>
              <div className="nd-docker-stat-label">{t("↑ Réseau (OUT)")}</div>
            </div>
          </div>
        )}

        {/* Ports */}
        {detail.ports && detail.ports.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--nd-text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{t("Ports")}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {condensePorts(detail.ports).map((p: any, i: number) => (
                <span key={i} className="nd-port-pill" style={{ fontSize: '0.62rem' }}>
                  {!showSensitive ? '***' : p.hostDisplay} → {!showSensitive ? '***' : p.containerDisplay}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Mounts */}
        {detail.mounts && detail.mounts.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--nd-text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{t("Volumes")}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {detail.mounts.map((m: any, i: number) => (
                <div key={i} style={{ fontSize: '0.62rem', color: 'var(--nd-text-dimmed)', fontFamily: 'monospace', display: 'flex', gap: 6 }}>
                  <span style={{ color: 'var(--nd-text-muted)' }}>{!showSensitive ? '***' : m.source?.substring(0, 40)}</span>
                  <span>→</span>
                  <span style={{ color: 'var(--nd-accent)' }}>{!showSensitive ? '***' : m.destination}</span>
                  <span style={{ opacity: 0.5 }}>{m.rw ? 'rw' : 'ro'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Uptime */}
        {isRunning && detail.startedAt && (
          <div style={{ fontSize: '0.62rem', color: 'var(--nd-text-dimmed)', marginTop: 4 }}>
            {t("Démarré il y a")} {formatUptime(detail.startedAt, t)}
          </div>
        )}
      </div>

      {/* Logs */}
      {isRunning && (
        <ContainerLogs hostId={hostId} containerId={detail.fullId} showSensitive={showSensitive} enabled={isVisible} />
      )}
    </div>
  );
}

// ======================== IMAGES TAB ========================
export function ImagesTab({ images, error, loading, containers, hostId, refreshImages, selectedContainer }: { images: any[]; error?: unknown; loading: boolean; containers: any[]; hostId: string; refreshImages: () => void; selectedContainer?: any }) {
  const { t, locale } = useI18n();
  const { config } = useConfig();
  const demoMode = config?.demoMode === true;
  const [selected, setSelected] = useState<string[]>([]);
  const [deleteTargets, setDeleteTargets] = useState<string[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deleteDialogRef = useDialogAccessibility(
    () => { if (!isDeleting) setDeleteTargets(null); },
    Boolean(deleteTargets),
  );

  const availableImages = images.filter(img => !containers.some((c: any) => c.imageId === img.id || (img.repoTags && img.repoTags.includes(c.image))));

  if (error) return <DockerErrorNotice error={error} />;
  if (loading) return <div style={{ padding: 20, textAlign: 'center' }}><Loader2 size={18} className="nd-spin" style={{ color: 'var(--nd-text-dimmed)' }} /></div>;

  const toggleSelectAll = () => {
    if (selected.length === availableImages.length && availableImages.length > 0) setSelected([]);
    else setSelected(availableImages.map(i => i.id));
  };

  const toggleSelect = (id: string) => {
    if (selected.includes(id)) setSelected(selected.filter(i => i !== id));
    else setSelected([...selected, id]);
  };

  const handleDelete = async () => {
    if (!deleteTargets || deleteTargets.length === 0) return;
    setIsDeleting(true);
    setDeleteError('');
    let hasError = false;
    let errMessage = '';

    for (const target of deleteTargets) {
      try {
        const res = await fetch(`/api/docker/${hostId}/images?id=${encodeURIComponent(target)}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || `Erreur: ${target.substring(0, 12)}`);
        }
      } catch (e: any) {
        hasError = true;
        errMessage += e.message + '\n';
      }
    }

    refreshImages();
    if (hasError) {
      setDeleteError(errMessage);
    } else {
      setDeleteTargets(null);
      setSelected([]);
    }
    setIsDeleting(false);
  };

  return (
    <>
      {/* Top action bar if selected */}
      {selected.length > 0 && (
        <div style={{ padding: '8px 12px', background: 'var(--nd-card-bg)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--nd-text)' }}>{t('docker.imagesSelected', { count: selected.length })}</span>
          <button
            className="nd-btn"
            style={{ background: 'rgba(248, 81, 73, 0.1)', color: 'var(--nd-red)', borderColor: 'rgba(248, 81, 73, 0.3)' }}
            onClick={() => setDeleteTargets(selected)}
          >
            <Trash2 size={12} /> {t("Supprimer la sélection")}
          </button>
        </div>
      )}

      <div className="nd-docker-detail nd-mobile-scroll" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="nd-responsive-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--nd-card-border)' }}>
              <th style={{ padding: '10px 12px', width: 30, textAlign: 'center' }}>
                <input type="checkbox" checked={availableImages.length > 0 && selected.length === availableImages.length} onChange={toggleSelectAll} />
              </th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--nd-text-muted)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 1 }}>{t("Image")}</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--nd-text-muted)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 1 }}>{t("Statut")}</th>
              <th className="nd-desktop-only" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--nd-text-muted)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 1 }}>{t("Taille")}</th>
              <th className="nd-desktop-only" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--nd-text-muted)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 1 }}>{t("Créé")}</th>
              <th className="nd-desktop-only" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--nd-text-muted)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 1 }}>{t("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {images.map((img: any) => {
              const isUsed = containers.some((c: any) => c.imageID === img.id || (img.repoTags && img.repoTags.includes(c.image)));
              const isHighlighted = selectedContainer && (selectedContainer.imageID === img.id || (img.repoTags && img.repoTags.includes(selectedContainer.image)));
              return (
                <tr key={img.id} style={{ borderBottom: '1px solid var(--nd-card-border)', background: isHighlighted ? 'rgba(63, 185, 80, 0.15)' : selected.includes(img.id) ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                  <td style={{ padding: '8px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: '40px' }}>
                    <input type="checkbox" checked={selected.includes(img.id)} onChange={() => toggleSelect(img.id)} disabled={isUsed} />
                    <button className="nd-btn nd-mobile-only" style={{ padding: '4px', width: 28, height: 28, justifyContent: 'center' }} title={t("Supprimer")} disabled={isUsed} onClick={() => setDeleteTargets([img.id])}>
                      <Trash2 size={14} style={{ color: isUsed ? 'var(--nd-text-dimmed)' : 'var(--nd-red)' }} />
                    </button>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, gap: 2 }}>
                      <div style={{ fontWeight: 600, color: 'var(--nd-text)', wordBreak: 'break-all' }}>{img.repoTags[0]}</div>
                      <div style={{ fontSize: '0.6rem', color: 'var(--nd-text-dimmed)', fontFamily: 'monospace' }}>{img.id.substring(0, 12)}</div>
                    </div>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {isUsed ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px', background: 'rgba(63, 185, 80, 0.1)', color: 'var(--nd-green)', borderRadius: 4, fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase' }}>
                          <span className="nd-status-dot nd-status-dot--running" style={{ width: 6, height: 6 }} /> {t("Utilisée")}
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--nd-text-dimmed)', borderRadius: 4, fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase' }}>
                          <span className="nd-status-dot nd-status-dot--exited" style={{ width: 6, height: 6 }} /> {t("Inactive")}
                        </span>
                      )}
                      {/* Formatted for mobile only, groups with status */}
                      <span className="nd-mobile-only" style={{ fontSize: '0.65rem', color: 'var(--nd-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{formatBytes(img.size)}</span>
                      <span className="nd-mobile-only" style={{ fontSize: '0.65rem', color: 'var(--nd-text-dimmed)' }}>{formatTimestamp(img.created, locale)}</span>
                    </div>
                  </td>
                  <td className="nd-desktop-only" style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--nd-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{formatBytes(img.size)}</td>
                  <td className="nd-desktop-only" style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--nd-text-dimmed)' }}>{formatTimestamp(img.created, locale)}</td>
                  <td className="nd-desktop-only" style={{ padding: '8px 12px', textAlign: 'right' }}>
                    <button
                      className="nd-btn"
                      style={{ padding: '4px', width: 24, height: 24, justifyContent: 'center' }}
                      title={t("Supprimer")}
                      disabled={isUsed}
                      onClick={() => setDeleteTargets([img.id])}
                    >
                      <Trash2 size={12} style={{ color: isUsed ? 'var(--nd-text-dimmed)' : 'var(--nd-red)' }} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {images.length === 0 && <div style={{ padding: 20, textAlign: 'center', fontSize: '0.72rem', color: 'var(--nd-text-dimmed)' }}>{t("Aucune image")}</div>}
      </div>

      {deleteTargets && typeof document !== 'undefined' && require('react-dom').createPortal(
        <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !isDeleting) setDeleteTargets(null); }}>
          <div ref={deleteDialogRef} role="dialog" aria-modal="true" aria-label={t("Confirmer la suppression des images Docker")} tabIndex={-1} className="nd-modal">
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 16 }}>{t(deleteTargets.length > 1 ? 'docker.deleteImagesTitle' : 'docker.deleteImageTitle')}</h3>
            <p style={{ fontSize: '0.72rem', color: 'var(--nd-text-muted)', lineHeight: 1.5, marginBottom: 16 }}>
              {demoMode ? (
                <>{t("Cette action est simulée et temporaire.")} {deleteTargets.length > 1 ? t('docker.imagesWillHide', { count: deleteTargets.length }) : t('docker.imageWillHide', { id: deleteTargets[0].substring(0, 12) })} {t("jusqu’à la réinitialisation de votre démo.")}</>
              ) : (
                <>{t('docker.confirmImageDelete', { target: deleteTargets.length > 1 ? t('docker.imagesCount', { count: deleteTargets.length }) : t('docker.thisImage', { id: deleteTargets[0].substring(0, 12) }) })}</>
              )}
            </p>
            {deleteError && (
              <div style={{ padding: 10, background: 'rgba(248, 81, 73, 0.1)', border: '1px solid rgba(248, 81, 73, 0.2)', borderRadius: 'var(--nd-card-radius)', color: 'var(--nd-red)', fontSize: '0.65rem', marginBottom: 16, whiteSpace: 'pre-wrap' }}>
                {deleteError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="nd-btn" onClick={() => { setDeleteTargets(null); setDeleteError(''); }} disabled={isDeleting}>{t("Annuler")}</button>
              <button className="nd-btn" style={{ background: 'rgba(248, 81, 73, 0.1)', color: 'var(--nd-red)', borderColor: 'rgba(248, 81, 73, 0.3)' }} onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? <Loader2 size={12} className="nd-spin" /> : <Trash2 size={12} />} {t("Supprimer")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// ======================== VOLUMES TAB ========================
export function VolumesTab({ volumes, error, loading, containers, hostId, refreshVolumes, selectedContainer }: { volumes: any[]; error?: unknown; loading: boolean; containers: any[]; hostId: string; refreshVolumes: () => void; selectedContainer?: any }) {
  const { t } = useI18n();
  const { config } = useConfig();
  const demoMode = config?.demoMode === true;
  const [selected, setSelected] = useState<string[]>([]);
  const [deleteTargets, setDeleteTargets] = useState<string[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deleteDialogRef = useDialogAccessibility(
    () => { if (!isDeleting) setDeleteTargets(null); },
    Boolean(deleteTargets),
  );

  const availableVolumes = volumes.filter(vol => !containers.some((c: any) => c.mounts?.some((m: any) => m.name === vol.name)));

  if (error) return <DockerErrorNotice error={error} />;
  if (loading) return <div style={{ padding: 20, textAlign: 'center' }}><Loader2 size={18} className="nd-spin" style={{ color: 'var(--nd-text-dimmed)' }} /></div>;

  const toggleSelectAll = () => {
    if (selected.length === availableVolumes.length && availableVolumes.length > 0) setSelected([]);
    else setSelected(availableVolumes.map(v => v.name));
  };

  const toggleSelect = (name: string) => {
    if (selected.includes(name)) setSelected(selected.filter(n => n !== name));
    else setSelected([...selected, name]);
  };

  const handleDelete = async () => {
    if (!deleteTargets || deleteTargets.length === 0) return;
    setIsDeleting(true);
    setDeleteError('');
    let hasError = false;
    let errMessage = '';

    for (const target of deleteTargets) {
      try {
        const res = await fetch(`/api/docker/${hostId}/volumes?name=${encodeURIComponent(target)}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || `Erreur: ${target}`);
        }
      } catch (e: any) {
        hasError = true;
        errMessage += e.message + '\n';
      }
    }

    refreshVolumes();
    if (hasError) {
      setDeleteError(errMessage);
    } else {
      setDeleteTargets(null);
      setSelected([]);
    }
    setIsDeleting(false);
  };

  return (
    <>
      {/* Top action bar if selected */}
      {selected.length > 0 && (
        <div style={{ padding: '8px 12px', background: 'var(--nd-card-bg)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--nd-text)' }}>{selected.length} {t("volume(s) sélectionné(s)")}</span>
          <button
            className="nd-btn"
            style={{ background: 'rgba(248, 81, 73, 0.1)', color: 'var(--nd-red)', borderColor: 'rgba(248, 81, 73, 0.3)' }}
            onClick={() => setDeleteTargets(selected)}
          >
            <Trash2 size={12} /> {t("Supprimer la sélection")}
          </button>
        </div>
      )}

      <div className="nd-docker-detail nd-mobile-scroll" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="nd-responsive-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--nd-card-border)' }}>
              <th style={{ padding: '10px 12px', width: 30, textAlign: 'center' }}>
                <input type="checkbox" checked={availableVolumes.length > 0 && selected.length === availableVolumes.length} onChange={toggleSelectAll} />
              </th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--nd-text-muted)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 1 }}>{t("Volume")}</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--nd-text-muted)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 1 }}>{t("Statut")}</th>
              <th className="nd-desktop-only" style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--nd-text-muted)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 1 }}>{t("Driver")}</th>
              <th className="nd-desktop-only" style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--nd-text-muted)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 1 }}>{t("Mountpoint")}</th>
              <th className="nd-desktop-only" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--nd-text-muted)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 1 }}>{t("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {volumes.map((vol: any) => {
              const isUsed = containers.some((c: any) => c.mounts?.some((m: any) => m.name === vol.name));
              const isHighlighted = selectedContainer && selectedContainer.mounts?.some((m: any) => m.name === vol.name);
              return (
                <tr key={vol.name} style={{ borderBottom: '1px solid var(--nd-card-border)', background: isHighlighted ? 'rgba(63, 185, 80, 0.15)' : selected.includes(vol.name) ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                  <td style={{ padding: '8px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: '40px' }}>
                    <input type="checkbox" checked={selected.includes(vol.name)} onChange={() => toggleSelect(vol.name)} disabled={isUsed} />
                    <button className="nd-btn nd-mobile-only" style={{ padding: '4px', width: 28, height: 28, justifyContent: 'center' }} title={t("Supprimer")} disabled={isUsed} onClick={() => setDeleteTargets([vol.name])}>
                      <Trash2 size={14} style={{ color: isUsed ? 'var(--nd-text-dimmed)' : 'var(--nd-red)' }} />
                    </button>
                  </td>
                  <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--nd-text)', minWidth: 0, wordBreak: 'break-all' }}>
                    {vol.name?.length > 40 ? vol.name.substring(0, 40) + '...' : vol.name}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {isUsed ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px', background: 'rgba(63, 185, 80, 0.1)', color: 'var(--nd-green)', borderRadius: 4, fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase' }}>
                          <span className="nd-status-dot nd-status-dot--running" style={{ width: 6, height: 6 }} /> {t("Utilisé")}
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--nd-text-dimmed)', borderRadius: 4, fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase' }}>
                          <span className="nd-status-dot nd-status-dot--exited" style={{ width: 6, height: 6 }} /> {t("Inactif")}
                        </span>
                      )}
                      {/* Formatted for mobile only, groups with status */}
                      <span className="nd-mobile-only" style={{ fontSize: '0.65rem', color: 'var(--nd-text-muted)' }}>{vol.driver}</span>
                      <span className="nd-mobile-only" style={{ fontSize: '0.62rem', color: 'var(--nd-text-dimmed)', fontFamily: 'monospace', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{vol.mountpoint?.split('/').pop() || vol.mountpoint}</span>
                    </div>
                  </td>
                  <td className="nd-desktop-only" style={{ padding: '8px 12px', color: 'var(--nd-text-muted)' }}>{vol.driver}</td>
                  <td className="nd-desktop-only" style={{ padding: '8px 12px', color: 'var(--nd-text-dimmed)', fontSize: '0.62rem', fontFamily: 'monospace', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vol.mountpoint}</td>
                  <td className="nd-desktop-only" style={{ padding: '8px 12px', textAlign: 'right' }}>
                    <button
                      className="nd-btn"
                      style={{ padding: '4px', width: 24, height: 24, justifyContent: 'center' }}
                      title={t("Supprimer")}
                      disabled={isUsed}
                      onClick={() => setDeleteTargets([vol.name])}
                    >
                      <Trash2 size={12} style={{ color: isUsed ? 'var(--nd-text-dimmed)' : 'var(--nd-red)' }} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {volumes.length === 0 && <div style={{ padding: 20, textAlign: 'center', fontSize: '0.72rem', color: 'var(--nd-text-dimmed)' }}>{t("Aucun volume")}</div>}
      </div>

      {deleteTargets && typeof document !== 'undefined' && require('react-dom').createPortal(
        <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !isDeleting) setDeleteTargets(null); }}>
          <div ref={deleteDialogRef} role="dialog" aria-modal="true" aria-label={t("Confirmer la suppression des volumes Docker")} tabIndex={-1} className="nd-modal">
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 16 }}>{t(deleteTargets.length > 1 ? 'docker.deleteVolumesTitle' : 'docker.deleteVolumeTitle')}</h3>
            <p style={{ fontSize: '0.72rem', color: 'var(--nd-text-muted)', lineHeight: 1.5, marginBottom: 16 }}>
              {demoMode ? (
                <>{t("Cette suppression est simulée et réversible en réinitialisant la démo. Aucun volume ni fichier réel ne sera touché.")}</>
              ) : (
                <>{t('docker.confirmVolumeDelete', { target: deleteTargets.length > 1 ? t('docker.volumesCount', { count: deleteTargets.length }) : (deleteTargets[0]?.length > 30 ? deleteTargets[0].substring(0, 30) + '…' : deleteTargets[0]) })}</>
              )}
            </p>
            {deleteError && (
              <div style={{ padding: 10, background: 'rgba(248, 81, 73, 0.1)', border: '1px solid rgba(248, 81, 73, 0.2)', borderRadius: 'var(--nd-card-radius)', color: 'var(--nd-red)', fontSize: '0.65rem', marginBottom: 16, whiteSpace: 'pre-wrap' }}>
                {deleteError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="nd-btn" onClick={() => { setDeleteTargets(null); setDeleteError(''); }} disabled={isDeleting}>{t("Annuler")}</button>
              <button className="nd-btn" style={{ background: 'rgba(248, 81, 73, 0.1)', color: 'var(--nd-red)', borderColor: 'rgba(248, 81, 73, 0.3)' }} onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? <Loader2 size={12} className="nd-spin" /> : <Trash2 size={12} />} {t("Supprimer")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// ======================== MAIN DOCKER TAB ========================
