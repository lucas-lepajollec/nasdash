'use client';

import { demoFetch } from '@/lib/demoTransport';

import { useState, useEffect, useRef } from 'react';
import React from 'react';
import { createPortal } from 'react-dom';
import { imageResourceRows, volumeResourceRows } from '@/lib/dockerResourceList';
import { DockerResourceBrowser } from './DockerResourceBrowser';
import { useConfig } from '@/hooks/useConfig';
import { Play, Square, RotateCcw, Trash2, Loader2, AlertCircle, Terminal } from 'lucide-react';
import EmojiPickerModal from '../../modals/EmojiPickerModal';
import useSWR from 'swr';
import { Emoji } from '../../shared/Emoji';
import { dockerJsonFetcher, getDockerErrorPresentation, readDockerResponse, dockerActionError, DockerRequestError } from '@/lib/dockerErrorContract';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';
import { useI18n } from '@/i18n/I18nProvider';
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

export function DockerHostFormModal({ onClose, onSave, initialConnection = 'tcp' }: {
  onClose: () => void;
  onSave: (h: DockerHostDraft) => Promise<void>;
  /** Kind of connection selected when the form opens (from the Integrations page tiles). */
  initialConnection?: DockerHostDraft['type'];
}) {
  const { t } = useI18n();
  const { config } = useConfig();
  const demoMode = config?.demoMode === true;
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🐳');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('2375');
  const [connection, setConnection] = useState<DockerConnection>(initialConnection);
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
                  setSaveError(error instanceof Error && /socket/i.test(error.message) ? t('docker.failure.invalid_socket') : t('docker.failure.save_host'));
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
                  setSaveError(error instanceof Error && /socket/i.test(error.message) ? t('docker.failure.invalid_socket') : t('docker.failure.save_host'));
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
                setSaveError(error instanceof Error && /socket/i.test(error.message) ? t('docker.failure.invalid_socket') : t('docker.failure.save_host'));
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
            <CalmeField label={t('docker.serverUrl')} htmlFor="docker-serverUrl">
              <input id="docker-serverUrl" aria-label={t('docker.serverUrl')} className="nd-input" value={serverUrl} onChange={e => setServerUrl(e.target.value)} placeholder={connection === 'portainer' ? 'https://portainer.lan:9443' : 'http://dockhand.lan:3000'} />
            </CalmeField>
            <div className="ndc-field-grid">
              <CalmeField label={t('docker.environmentId')} htmlFor="docker-environment">
                <input id="docker-environment" aria-label={t('docker.environmentId')} className="nd-input" value={environment} onChange={e => setEnvironment(e.target.value)} placeholder="1" />
              </CalmeField>
              <CalmeField label={t('docker.apiKey')} htmlFor="docker-apiKey">
                <input id="docker-apiKey" aria-label={t('docker.apiKey')} className="nd-input" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="••••••••" />
              </CalmeField>
            </div>
            {selfSigned}
          </>
        ) : connection === 'socket' ? (
          <CalmeField label={t('docker.socketPath')} htmlFor="docker-socketPath">
            <input id="docker-socketPath" aria-label={t('docker.socketPath')} className="nd-input" value={socketPath} onChange={e => setSocketPath(e.target.value)} placeholder="/var/run/docker.sock" />
          </CalmeField>
        ) : (
          <>
            <div className="ndc-field-grid" style={{ gridTemplateColumns: '1fr 110px' }}>
              <CalmeField label={t("Adresse / Hôte Docker")} info={demoMode ? undefined : connectionHint}>
                <input id="docker-host" aria-label={t('Adresse / Hôte Docker')} className="nd-input" value={host} onChange={e => setHost(e.target.value)} placeholder={demoMode ? 'docker-demo.invalid' : t("docker-proxy ou 192.168.0.200")} />
              </CalmeField>
              <CalmeField label={t("Port API Docker")}>
                <input id="docker-port" aria-label={t('Port API Docker')} className="nd-input" value={port} onChange={e => setPort(e.target.value)} placeholder="2375" />
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

      {detail.statsError && <DockerErrorNotice error={new DockerRequestError(502, detail.statsError)} compact />}
      {/* Logs */}
      {isRunning && (
        <ContainerLogs hostId={hostId} containerId={detail.fullId} showSensitive={showSensitive} enabled={isVisible} />
      )}
    </div>
  );
}

// ======================== RESOURCE TABS ========================
export function ImagesTab({ images, error, loading, containers, hostId, refreshImages, selectedContainer }: { images: any[]; error?: unknown; loading: boolean; containers: any[]; hostId: string; refreshImages: () => void; selectedContainer?: any }) {
  return <DockerResourceBrowser key={`images-${hostId}`} kind="images" rows={imageResourceRows(images, containers, selectedContainer)} hostId={hostId} loading={loading} errorNotice={error ? <DockerErrorNotice error={error} /> : undefined} refresh={refreshImages} formatSize={formatBytes} />;
}

export function VolumesTab({ volumes, error, loading, containers, hostId, refreshVolumes, selectedContainer }: { volumes: any[]; error?: unknown; loading: boolean; containers: any[]; hostId: string; refreshVolumes: () => void; selectedContainer?: any }) {
  return <DockerResourceBrowser key={`volumes-${hostId}`} kind="volumes" rows={volumeResourceRows(volumes, containers, selectedContainer)} hostId={hostId} loading={loading} errorNotice={error ? <DockerErrorNotice error={error} /> : undefined} refresh={refreshVolumes} formatSize={formatBytes} />;
}

// ======================== MAIN DOCKER TAB ========================
