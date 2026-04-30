'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { useDocker } from '@/hooks/useDocker';
import { Box, Container, Image, HardDrive, Play, Square, RotateCcw, Trash2, Search, Loader2, AlertCircle, ChevronDown, Terminal, Layers, Database, Plus, X, RefreshCw } from 'lucide-react';
import ConfirmModal from '../../shared/ConfirmModal';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.ok ? r.json() : null);

interface DockerTabProps {
  editMode: boolean;
  searchQuery: string;
  isVisible: boolean;
  showSecret?: boolean;
}

type DockerTab = 'containers' | 'images' | 'volumes';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'Ko', 'Mo', 'Go', 'To'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatUptime(dateStr: string): string {
  const started = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - started.getTime();
  const days = Math.floor(diffMs / 86400000);
  const hours = Math.floor((diffMs % 86400000) / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  if (days > 0) return `${days}j ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// ======================== DOCKER HOST FORM MODAL ========================
function DockerHostFormModal({ onClose, onSave }: {
  onClose: () => void;
  onSave: (h: { name: string; icon: string; url: string }) => void;
}) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🐳');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('2375');

  return (
    <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="nd-modal">
        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 16 }}>Ajouter un hôte Docker</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="nd-label">Nom</label>
            <input className="nd-input" value={name} onChange={e => setName(e.target.value)} placeholder="Mon NAS" />
          </div>
          <div>
            <label className="nd-label">Icône (emoji)</label>
            <input className="nd-input" value={icon} onChange={e => setIcon(e.target.value)} placeholder="🐳" style={{ width: 80 }} />
          </div>
          <div>
            <label className="nd-label">Adresse / Hôte Docker</label>
            <input className="nd-input" value={host} onChange={e => setHost(e.target.value)} placeholder="docker-proxy ou 192.168.0.200" />
          </div>
          <div>
            <label className="nd-label">Port API Docker</label>
            <input className="nd-input" value={port} onChange={e => setPort(e.target.value)} placeholder="2375" />
          </div>
          <p style={{ fontSize: '0.62rem', color: 'var(--nd-text-dimmed)', lineHeight: 1.5 }}>
            Pour des raisons de sécurité, veuillez utiliser un conteneur proxy local (ex: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 4px', borderRadius: 3 }}>docker-socket-proxy</code>) et indiquez son nom d&apos;hôte.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="nd-btn" onClick={onClose}>Annuler</button>
            <button className="nd-btn nd-btn-accent" onClick={() => {
              if (!name || !host) return;
              const url = `http://${host}:${port || '2375'}`;
              onSave({ name, icon, url });
            }}>Ajouter</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ======================== CONTAINER LOGS ========================
function ContainerLogs({ hostId, containerId }: { hostId: string; containerId: string }) {
  const { data, error } = useSWR(
    `/api/docker/${hostId}/containers/${containerId}/logs?tail=150`,
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
    return <div style={{ fontSize: '0.7rem', color: 'var(--nd-red)', padding: 12 }}>Erreur de chargement des logs</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--nd-text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Terminal size={12} /> Logs
        </span>
        <label style={{ fontSize: '0.6rem', color: 'var(--nd-text-dimmed)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} style={{ width: 12, height: 12 }} />
          Auto-scroll
        </label>
      </div>
      <div ref={terminalRef} className="nd-terminal" onScroll={() => {
        if (!terminalRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = terminalRef.current;
        setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
      }}>
        {lines.length === 0 ? (
          <span style={{ color: 'var(--nd-text-dimmed)' }}>Aucun log disponible</span>
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
function ContainerDetailView({ hostId, detail, onAction, actionLoading, showSecret }: {
  hostId: string;
  detail: any;
  onAction: (id: string, action: 'start' | 'stop' | 'restart' | 'remove') => void;
  actionLoading: string | null;
  showSecret: boolean;
}) {
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
                <button className="nd-action-icon accent" onClick={() => onAction(detail.fullId, 'restart')} disabled={!!actionLoading} title="Redémarrer">
                  <RotateCcw size={14} />
                </button>
                <button className="nd-action-icon danger" onClick={() => onAction(detail.fullId, 'stop')} disabled={!!actionLoading} title="Arrêter">
                  <Square size={14} />
                </button>
                <button className="nd-action-icon danger" onClick={() => onAction(detail.fullId, 'remove')} disabled={!!actionLoading} title="Supprimer">
                  <Trash2 size={14} />
                </button>
              </>
            ) : (
              <>
                <button className="nd-action-icon success" onClick={() => onAction(detail.fullId, 'start')} disabled={!!actionLoading} title="Démarrer">
                  <Play size={14} />
                </button>
                <button className="nd-action-icon danger" onClick={() => onAction(detail.fullId, 'remove')} disabled={!!actionLoading} title="Supprimer">
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
              <div className="nd-docker-stat-label">RAM ({formatBytes(detail.stats.memUsage)} / {formatBytes(detail.stats.memLimit)})</div>
            </div>
            <div className="nd-docker-stat-card">
              <div className="nd-docker-stat-value">{formatBytes(detail.stats.netInput)}</div>
              <div className="nd-docker-stat-label">↓ Réseau (IN)</div>
            </div>
            <div className="nd-docker-stat-card">
              <div className="nd-docker-stat-value">{formatBytes(detail.stats.netOutput)}</div>
              <div className="nd-docker-stat-label">↑ Réseau (OUT)</div>
            </div>
          </div>
        )}

        {/* Ports */}
        {detail.ports && detail.ports.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--nd-text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Ports</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {detail.ports.map((p: any, i: number) => (
                <span key={i} className="nd-port-pill" style={{ fontSize: '0.62rem' }}>
                  {!showSecret ? '***' : (p.hostBindings?.join(', ') || '—')} → {!showSecret ? '***' : p.containerPort}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Mounts */}
        {detail.mounts && detail.mounts.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--nd-text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Volumes</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {detail.mounts.map((m: any, i: number) => (
                <div key={i} style={{ fontSize: '0.62rem', color: 'var(--nd-text-dimmed)', fontFamily: 'monospace', display: 'flex', gap: 6 }}>
                  <span style={{ color: 'var(--nd-text-muted)' }}>{!showSecret ? '***' : m.source?.substring(0, 40)}</span>
                  <span>→</span>
                  <span style={{ color: 'var(--nd-accent)' }}>{!showSecret ? '***' : m.destination}</span>
                  <span style={{ opacity: 0.5 }}>{m.rw ? 'rw' : 'ro'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Uptime */}
        {isRunning && detail.startedAt && (
          <div style={{ fontSize: '0.62rem', color: 'var(--nd-text-dimmed)', marginTop: 4 }}>
            Démarré il y a {formatUptime(detail.startedAt)}
          </div>
        )}
      </div>

      {/* Logs */}
      {isRunning && (
        <ContainerLogs hostId={hostId} containerId={detail.fullId} />
      )}
    </div>
  );
}

// ======================== IMAGES TAB ========================
function ImagesTab({ images, loading, containers, hostId, refreshImages, selectedContainer }: { images: any[]; loading: boolean; containers: any[]; hostId: string; refreshImages: () => void; selectedContainer?: any }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [deleteTargets, setDeleteTargets] = useState<string[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const availableImages = images.filter(img => !containers.some((c: any) => c.imageID === img.id || (img.repoTags && img.repoTags.includes(c.image))));

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
        <div style={{ padding: '8px 12px', background: 'var(--nd-card-bg)', border: '1px solid var(--nd-card-border)', borderRadius: 8, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--nd-text)' }}>{selected.length} image(s) sélectionnée(s)</span>
          <button 
            className="nd-btn" 
            style={{ background: 'rgba(248, 81, 73, 0.1)', color: 'var(--nd-red)', borderColor: 'rgba(248, 81, 73, 0.3)' }}
            onClick={() => setDeleteTargets(selected)}
          >
            <Trash2 size={12} /> Supprimer la sélection
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
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--nd-text-muted)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 1 }}>Image</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--nd-text-muted)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 1 }}>Statut</th>
              <th className="nd-desktop-only" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--nd-text-muted)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 1 }}>Taille</th>
              <th className="nd-desktop-only" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--nd-text-muted)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 1 }}>Créé</th>
              <th className="nd-desktop-only" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--nd-text-muted)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 1 }}>Actions</th>
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
                    <button className="nd-btn nd-mobile-only" style={{ padding: '4px', width: 28, height: 28, justifyContent: 'center' }} title="Supprimer" disabled={isUsed} onClick={() => setDeleteTargets([img.id])}>
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
                          <span className="nd-status-dot nd-status-dot--running" style={{ width: 6, height: 6 }} /> Utilisée
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--nd-text-dimmed)', borderRadius: 4, fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase' }}>
                          <span className="nd-status-dot nd-status-dot--exited" style={{ width: 6, height: 6 }} /> Inactive
                        </span>
                      )}
                      {/* Formatted for mobile only, groups with status */}
                      <span className="nd-mobile-only" style={{ fontSize: '0.65rem', color: 'var(--nd-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{formatBytes(img.size)}</span>
                      <span className="nd-mobile-only" style={{ fontSize: '0.65rem', color: 'var(--nd-text-dimmed)' }}>{formatTimestamp(img.created)}</span>
                    </div>
                  </td>
                  <td className="nd-desktop-only" style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--nd-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{formatBytes(img.size)}</td>
                  <td className="nd-desktop-only" style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--nd-text-dimmed)' }}>{formatTimestamp(img.created)}</td>
                  <td className="nd-desktop-only" style={{ padding: '8px 12px', textAlign: 'right' }}>
                    <button 
                      className="nd-btn" 
                      style={{ padding: '4px', width: 24, height: 24, justifyContent: 'center' }} 
                      title="Supprimer"
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
        {images.length === 0 && <div style={{ padding: 20, textAlign: 'center', fontSize: '0.72rem', color: 'var(--nd-text-dimmed)' }}>Aucune image</div>}
      </div>

      {deleteTargets && typeof document !== 'undefined' && require('react-dom').createPortal(
        <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !isDeleting) setDeleteTargets(null); }}>
          <div className="nd-modal">
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 16 }}>Supprimer {deleteTargets.length > 1 ? "les images" : "l'image"}</h3>
            <p style={{ fontSize: '0.72rem', color: 'var(--nd-text-muted)', lineHeight: 1.5, marginBottom: 16 }}>
              Êtes-vous sûr de vouloir supprimer {deleteTargets.length > 1 ? `${deleteTargets.length} images` : `cette image (${deleteTargets[0].substring(0, 12)})`} ?
              Cela libérera de l&apos;espace disque, mais vous devrez la retélécharger si un conteneur en a besoin.
            </p>
            {deleteError && (
              <div style={{ padding: 10, background: 'rgba(248, 81, 73, 0.1)', border: '1px solid rgba(248, 81, 73, 0.2)', borderRadius: 6, color: 'var(--nd-red)', fontSize: '0.65rem', marginBottom: 16, whiteSpace: 'pre-wrap' }}>
                {deleteError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="nd-btn" onClick={() => { setDeleteTargets(null); setDeleteError(''); }} disabled={isDeleting}>Annuler</button>
              <button className="nd-btn" style={{ background: 'rgba(248, 81, 73, 0.1)', color: 'var(--nd-red)', borderColor: 'rgba(248, 81, 73, 0.3)' }} onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? <Loader2 size={12} className="nd-spin" /> : <Trash2 size={12} />} Supprimer
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
function VolumesTab({ volumes, loading, containers, hostId, refreshVolumes, selectedContainer }: { volumes: any[]; loading: boolean; containers: any[]; hostId: string; refreshVolumes: () => void; selectedContainer?: any }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [deleteTargets, setDeleteTargets] = useState<string[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const availableVolumes = volumes.filter(vol => !containers.some((c: any) => c.mounts?.some((m: any) => m.name === vol.name)));

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
        <div style={{ padding: '8px 12px', background: 'var(--nd-card-bg)', border: '1px solid var(--nd-card-border)', borderRadius: 8, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--nd-text)' }}>{selected.length} volume(s) sélectionné(s)</span>
          <button 
            className="nd-btn" 
            style={{ background: 'rgba(248, 81, 73, 0.1)', color: 'var(--nd-red)', borderColor: 'rgba(248, 81, 73, 0.3)' }}
            onClick={() => setDeleteTargets(selected)}
          >
            <Trash2 size={12} /> Supprimer la sélection
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
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--nd-text-muted)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 1 }}>Volume</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--nd-text-muted)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 1 }}>Statut</th>
              <th className="nd-desktop-only" style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--nd-text-muted)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 1 }}>Driver</th>
              <th className="nd-desktop-only" style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--nd-text-muted)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 1 }}>Mountpoint</th>
              <th className="nd-desktop-only" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--nd-text-muted)', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: 1 }}>Actions</th>
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
                    <button className="nd-btn nd-mobile-only" style={{ padding: '4px', width: 28, height: 28, justifyContent: 'center' }} title="Supprimer" disabled={isUsed} onClick={() => setDeleteTargets([vol.name])}>
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
                          <span className="nd-status-dot nd-status-dot--running" style={{ width: 6, height: 6 }} /> Utilisé
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--nd-text-dimmed)', borderRadius: 4, fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase' }}>
                          <span className="nd-status-dot nd-status-dot--exited" style={{ width: 6, height: 6 }} /> Inactif
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
                      title="Supprimer"
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
        {volumes.length === 0 && <div style={{ padding: 20, textAlign: 'center', fontSize: '0.72rem', color: 'var(--nd-text-dimmed)' }}>Aucun volume</div>}
      </div>

      {deleteTargets && typeof document !== 'undefined' && require('react-dom').createPortal(
        <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !isDeleting) setDeleteTargets(null); }}>
          <div className="nd-modal">
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 16 }}>Supprimer {deleteTargets.length > 1 ? 'les volumes' : 'un volume'}</h3>
            <p style={{ fontSize: '0.72rem', color: 'var(--nd-text-muted)', lineHeight: 1.5, marginBottom: 16 }}>
              Êtes-vous sûr de vouloir supprimer {deleteTargets.length > 1 ? `${deleteTargets.length} volumes` : <strong style={{ color: 'var(--nd-text)' }}>{deleteTargets[0]?.length > 30 ? deleteTargets[0].substring(0, 30) + '...' : deleteTargets[0]}</strong>} ?
              Cette action est irréversible et effacera toutes les données stockées dessus.
            </p>
            {deleteError && (
              <div style={{ padding: 10, background: 'rgba(248, 81, 73, 0.1)', border: '1px solid rgba(248, 81, 73, 0.2)', borderRadius: 6, color: 'var(--nd-red)', fontSize: '0.65rem', marginBottom: 16, whiteSpace: 'pre-wrap' }}>
                {deleteError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="nd-btn" onClick={() => { setDeleteTargets(null); setDeleteError(''); }} disabled={isDeleting}>Annuler</button>
              <button className="nd-btn" style={{ background: 'rgba(248, 81, 73, 0.1)', color: 'var(--nd-red)', borderColor: 'rgba(248, 81, 73, 0.3)' }} onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? <Loader2 size={12} className="nd-spin" /> : <Trash2 size={12} />} Supprimer
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
export default function DockerTab({ editMode, searchQuery, isVisible, showSecret = false }: DockerTabProps) {
  const { config, refresh } = useConfig();
  const hosts = config?.dockerHosts || [];
  const [activeTab, setActiveTab] = useState<DockerTab>('containers');
  const [showHostForm, setShowHostForm] = useState(false);
  const [localSearch, setLocalSearch] = useState('');

  const {
    activeHostId, setActiveHostId, activeHost,
    containers, containersError, containersLoading, refreshContainers,
    selectedContainerId, setSelectedContainerId,
    containerDetail, detailError,
    images, imagesLoading, refreshImages,
    volumes, volumesLoading, refreshVolumes,
    containerAction, actionLoading,
  } = useDocker(hosts);

  const [pendingConfirm, setPendingConfirm] = useState<{ id: string; action: 'start' | 'stop' | 'restart' | 'remove'; name: string } | null>(null);
  const [pendingDeleteHost, setPendingDeleteHost] = useState<{ id: string; name: string } | null>(null);

  const handleActionRequest = (id: string, action: 'start' | 'stop' | 'restart' | 'remove', name: string) => {
    if (action === 'start') {
      containerAction(id, action);
    } else {
      setPendingConfirm({ id, action, name });
    }
  };

  const effectiveSearch = searchQuery || localSearch;

  // Auto-select first host if none active
  useEffect(() => {
    if (!activeHostId && hosts.length > 0) {
      setActiveHostId(hosts[0].id);
    }
  }, [hosts, activeHostId, setActiveHostId]);

  // Auto-select first container if none active and containers loaded
  useEffect(() => {
    if (activeTab === 'containers' && !selectedContainerId && containers.length > 0) {
      setSelectedContainerId(containers[0].fullId);
    }
  }, [activeTab, containers, selectedContainerId, setSelectedContainerId]);

  // Add docker host
  const handleAddHost = async (data: { name: string; icon: string; url: string }) => {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'dockerHost', ...data }),
    });
    await refresh();
    setShowHostForm(false);
  };

  // Delete docker host
  const handleDeleteHost = async (id: string) => {
    await fetch(`/api/config?type=dockerHost&id=${id}`, { method: 'DELETE' });
    await refresh();
    if (activeHostId === id) {
      setActiveHostId(hosts.find(h => h.id !== id)?.id || null);
    }
  };

  // No hosts configured — empty state
  if (hosts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 animate-in fade-in duration-500" style={{ minHeight: 'calc(100vh - 120px)' }}>
        <div className="nd-docker-empty nd-card p-12 max-w-xl shadow-2xl" style={{ borderStyle: 'dashed', borderWidth: 2 }}>
          <div className="nd-docker-empty-icon mb-6" style={{ fontSize: '4rem', opacity: 0.9 }}>🐳</div>
          <div className="nd-docker-empty-title" style={{ fontSize: '1.25rem', marginBottom: 12 }}>Docker Manager</div>
          <div className="nd-docker-empty-desc" style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: 32, lineHeight: 1.6 }}>
            Aucun hôte Docker configuré. Ajoutez un hôte pour commencer à gérer vos conteneurs, images et volumes depuis votre dashboard.
          </div>
          <button className="nd-btn nd-btn-accent px-10 py-3 h-auto text-sm shadow-lg shadow-blue-500/10" onClick={() => setShowHostForm(true)} style={{ marginTop: 8 }}>
            <Plus size={18} /> <span className="ml-1">Ajouter un hôte Docker</span>
          </button>
        </div>
        {showHostForm && <DockerHostFormModal onClose={() => setShowHostForm(false)} onSave={handleAddHost} />}
      </div>
    );
  }

  // Filter containers
  const filteredContainers = containers.filter((c: any) => {
    if (!effectiveSearch) return true;
    const q = effectiveSearch.toLowerCase();
    return c.names?.some((n: string) => n.toLowerCase().includes(q)) 
      || c.image?.toLowerCase().includes(q)
      || c.id?.toLowerCase().includes(q);
  });

  const runningCount = containers.filter((c: any) => c.state === 'running').length;
  const stoppedCount = containers.filter((c: any) => c.state === 'exited').length;

  return (
    <>
      <div className="nd-docker-layout nd-animate-in">
        {/* Sidebar — Host selector + Container list */}
        <aside className="nd-docker-sidebar" style={{ overflowY: 'hidden' }}>
          {/* Host Selector */}
          <div className="nd-sidebar-card">
            <div className="nd-section-title" style={{ marginBottom: 8 }}>
              <Box size={12} style={{ color: 'var(--nd-accent)' }} />
              Hôtes Docker
              {editMode && (
                <button className="nd-action-icon" onClick={() => setShowHostForm(true)} style={{ marginLeft: 'auto', color: 'var(--nd-green)' }}>
                  <Plus size={13} />
                </button>
              )}
            </div>
            <div className="nd-host-selector">
              {hosts.map((h) => (
                <button
                  key={h.id}
                  className={`nd-host-btn ${activeHostId === h.id ? 'nd-host-btn--active' : ''}`}
                  onClick={() => { setActiveHostId(h.id); setSelectedContainerId(null); }}
                >
                  <span>{h.icon}</span> {h.name}
                  {editMode && (
                    <span onClick={(e) => { e.stopPropagation(); setPendingDeleteHost({ id: h.id, name: h.name }); }} style={{ marginLeft: 4, cursor: 'pointer', opacity: 0.5 }}>
                      <X size={10} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Stats mini */}
          <div className="nd-sidebar-card">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div style={{ textAlign: 'center', padding: '6px 0' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--nd-green)' }}>{runningCount}</div>
                <div style={{ fontSize: '0.58rem', color: 'var(--nd-text-muted)', textTransform: 'uppercase' }}>Actifs</div>
              </div>
              <div style={{ textAlign: 'center', padding: '6px 0' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--nd-red)' }}>{stoppedCount}</div>
                <div style={{ fontSize: '0.58rem', color: 'var(--nd-text-muted)', textTransform: 'uppercase' }}>Stoppés</div>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className={activeTab !== 'containers' ? 'nd-mobile-hidden' : ''} style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--nd-text-dimmed)', pointerEvents: 'none' }} />
            <input
              className="nd-input"
              value={localSearch}
              onChange={e => setLocalSearch(e.target.value)}
              placeholder="Filtrer les conteneurs..."
              style={{ paddingLeft: 30, fontSize: '0.72rem' }}
            />
          </div>

          {/* Container List */}
          <div className={activeTab !== 'containers' ? 'nd-mobile-hidden' : ''} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 4, paddingBottom: 10 }}>
            {containersLoading && containers.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <Loader2 size={16} className="nd-spin" style={{ color: 'var(--nd-text-dimmed)' }} />
              </div>
            )}

            {containersError && (
              <div className="nd-sidebar-card" style={{ textAlign: 'center', padding: 16 }}>
                <AlertCircle size={16} style={{ color: 'var(--nd-red)', marginBottom: 6 }} />
                <div style={{ fontSize: '0.7rem', color: 'var(--nd-red)' }}>Hôte injoignable</div>
                <div style={{ fontSize: '0.6rem', color: 'var(--nd-text-dimmed)', marginTop: 4 }}>Vérifiez que l&apos;API Docker TCP est accessible</div>
              </div>
            )}

            {!containersError && filteredContainers.map((c: any) => (
              <div
                key={c.id}
                className={`nd-container-card nd-container-card--${c.state} ${selectedContainerId === c.fullId ? 'nd-container-card--selected' : ''}`}
                onClick={() => setSelectedContainerId(c.fullId)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className={`nd-status-dot nd-status-dot--${c.state}`} />
                      <span style={{ fontWeight: 700, fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.names[0] || c.id}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--nd-text-dimmed)', marginTop: 2, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.image}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {c.state === 'running' ? (
                      <>
                        <button className="nd-action-icon accent" onClick={e => { e.stopPropagation(); handleActionRequest(c.fullId, 'restart', c.names[0] || c.id); }} title="Redémarrer" disabled={!!actionLoading}>
                          <RotateCcw size={12} />
                        </button>
                        <button className="nd-action-icon danger" onClick={e => { e.stopPropagation(); handleActionRequest(c.fullId, 'stop', c.names[0] || c.id); }} title="Arrêter" disabled={!!actionLoading}>
                          <Square size={12} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="nd-action-icon success" onClick={e => { e.stopPropagation(); handleActionRequest(c.fullId, 'start', c.names[0] || c.id); }} title="Démarrer" disabled={!!actionLoading}>
                          <Play size={12} />
                        </button>
                        <button className="nd-action-icon danger" onClick={e => { e.stopPropagation(); handleActionRequest(c.fullId, 'remove', c.names[0] || c.id); }} title="Supprimer" disabled={!!actionLoading}>
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: '0.58rem', color: 'var(--nd-text-dimmed)', marginTop: 4 }}>{c.status}</div>
              </div>
            ))}

            {!containersError && !containersLoading && filteredContainers.length === 0 && (
              <div style={{ textAlign: 'center', padding: 16, fontSize: '0.7rem', color: 'var(--nd-text-dimmed)' }}>
                {effectiveSearch ? 'Aucun conteneur correspondant' : 'Aucun conteneur'}
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <div className="nd-docker-main">
          <div className="nd-docker-tabs" style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 12 }}>
              <button className={`nd-docker-tab ${activeTab === 'containers' ? 'nd-docker-tab--active' : ''}`} onClick={() => setActiveTab('containers')} style={{ flexShrink: 0 }}>
                <Container size={12} /> Conteneurs ({containers.length})
              </button>
              <button className={`nd-docker-tab ${activeTab === 'images' ? 'nd-docker-tab--active' : ''}`} onClick={() => setActiveTab('images')} style={{ flexShrink: 0 }}>
                <Layers size={12} /> Images ({images.length})
              </button>
              <button className={`nd-docker-tab ${activeTab === 'volumes' ? 'nd-docker-tab--active' : ''}`} onClick={() => setActiveTab('volumes')} style={{ flexShrink: 0 }}>
                <Database size={12} /> Volumes ({volumes.length})
              </button>
              <button 
                className="nd-action-icon" 
                onClick={() => refreshContainers()} 
                title="Rafraîchir" 
                style={{ background: 'transparent', border: 'none', padding: 4, flexShrink: 0, marginLeft: 'auto' }}
              >
                <RefreshCw size={14} style={{ color: 'var(--nd-text-muted)' }} />
              </button>
          </div>

          {/* Tab content */}
          {activeTab === 'containers' && (
            selectedContainerId && containerDetail ? (
              <ContainerDetailView
                hostId={activeHostId!}
                detail={containerDetail}
                onAction={(id, action) => handleActionRequest(id, action, containerDetail?.name || id)}
                actionLoading={actionLoading}
                showSecret={showSecret}
              />
            ) : (
              <div className="nd-docker-detail" style={{ minHeight: 300 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12 }}>
                  <Container size={32} style={{ color: 'var(--nd-text-dimmed)', opacity: 0.3 }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--nd-text-dimmed)' }}>
                    Sélectionnez un conteneur dans la liste pour voir ses détails
                  </span>
                </div>
              </div>
            )
          )}

          {activeTab === 'images' && (
            <ImagesTab images={images} loading={imagesLoading} containers={containers} hostId={activeHostId!} refreshImages={() => refreshImages()} selectedContainer={containers.find((c: any) => c.fullId === selectedContainerId)} />
          )}

          {activeTab === 'volumes' && (
            <VolumesTab volumes={volumes} loading={volumesLoading} containers={containers} hostId={activeHostId!} refreshVolumes={() => refreshVolumes()} selectedContainer={containers.find((c: any) => c.fullId === selectedContainerId)} />
          )}
        </div>
      </div>

      {showHostForm && <DockerHostFormModal onClose={() => setShowHostForm(false)} onSave={handleAddHost} />}

      {/* Confirm Action Modal */}
      <ConfirmModal
        isOpen={!!pendingConfirm}
        onClose={() => setPendingConfirm(null)}
        onConfirm={() => {
          if (pendingConfirm) {
            containerAction(pendingConfirm.id, pendingConfirm.action);
          }
        }}
        title={
          pendingConfirm?.action === 'stop' ? 'Arrêter le conteneur' :
          pendingConfirm?.action === 'restart' ? 'Redémarrer le conteneur' :
          'Supprimer le conteneur'
        }
        description={`Êtes-vous sûr de vouloir ${
          pendingConfirm?.action === 'stop' ? 'arrêter' :
          pendingConfirm?.action === 'restart' ? 'redémarrer' :
          'supprimer'
        } "${pendingConfirm?.name}" ?`}
        confirmLabel={
          pendingConfirm?.action === 'stop' ? 'Arrêter' :
          pendingConfirm?.action === 'restart' ? 'Redémarrer' :
          'Supprimer'
        }
        cancelLabel="Annuler"
      />

      {/* Confirm Delete Host Modal */}
      <ConfirmModal
        isOpen={!!pendingDeleteHost}
        onClose={() => setPendingDeleteHost(null)}
        onConfirm={() => {
          if (pendingDeleteHost) {
            handleDeleteHost(pendingDeleteHost.id);
          }
        }}
        title="Supprimer l'hôte Docker"
        description={`Êtes-vous sûr de vouloir supprimer l'hôte "${pendingDeleteHost?.name}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
      />
    </>
  );
}
