'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, Check, Trash2, Server, Power, Play, RefreshCw, Layers } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { DockerActionConfig, DockerContainer } from '@/lib/types';
import CustomSelect from '@/components/shared/CustomSelect';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';
import { useI18n } from '@/i18n/I18nProvider';

interface DockerActionFormModalProps {
  action?: DockerActionConfig;
  onClose: () => void;
  onSave: (data: any) => void;
  onDelete?: (id: string) => void;
}

const ACTION_ICONS = [
  { name: 'Power', icon: <Power size={14} /> },
  { name: 'Play', icon: <Play size={14} /> },
  { name: 'RefreshCw', icon: <RefreshCw size={14} /> },
  { name: 'Layers', icon: <Layers size={14} /> },
];

export default function DockerActionFormModal({ action, onClose, onSave, onDelete }: DockerActionFormModalProps) {
  const { t } = useI18n();
  const dialogRef = useDialogAccessibility(onClose);
  const { config } = useConfig();
  const [name, setName] = useState(action?.name || '');
  const [icon, setIcon] = useState(action?.icon || 'Play');
  const [actionType, setActionType] = useState(action?.actionType || 'switch');
  const [targets, setTargets] = useState<{ hostId: string; containerName: string }[]>(action?.targets || []);

  const [searchQuery, setSearchQuery] = useState('');
  const [availableContainers, setAvailableContainers] = useState<{ hostId: string; hostName: string; container: DockerContainer }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch all containers from all hosts
    const fetchContainers = async () => {
      if (!config?.dockerHosts) return;
      setLoading(true);

      try {
        const allContainers: { hostId: string; hostName: string; container: DockerContainer }[] = [];

        await Promise.all(config.dockerHosts.map(async (host) => {
          try {
            const res = await fetch(`/api/docker/${host.id}/containers?all=true`);
            if (res.ok) {
              const data = await res.json();
              data.forEach((c: DockerContainer) => {
                allContainers.push({ hostId: host.id, hostName: host.name, container: c });
              });
            }
          } catch (e) {
            console.error(`Failed to fetch containers for host ${host.name}`, e);
          }
        }));

        setAvailableContainers(allContainers);
      } finally {
        setLoading(false);
      }
    };

    fetchContainers();
  }, [config?.dockerHosts]);

  const handleSubmit = () => {
    if (!name.trim() || targets.length === 0) return;
    onSave({ name, icon, actionType, targets });
  };

  const toggleTarget = (hostId: string, containerName: string) => {
    setTargets(prev => {
      const exists = prev.some(t => t.hostId === hostId && t.containerName === containerName);
      if (exists) {
        return prev.filter(t => !(t.hostId === hostId && t.containerName === containerName));
      } else {
        return [...prev, { hostId, containerName }];
      }
    });
  };

  const isSelected = (hostId: string, containerName: string) => {
    return targets.some(t => t.hostId === hostId && t.containerName === containerName);
  };

  const filteredContainers = availableContainers.filter(c => {
    if (!searchQuery) return true;
    const nameStr = c.container.names[0].replace(/^\//, '').toLowerCase();
    return nameStr.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={action ? t("Modifier une action Docker") : t("Ajouter une action Docker")} tabIndex={-1} className="nd-modal" onClick={(e) => e.stopPropagation()} style={{ width: 450, maxWidth: '90vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700 }}>{action ? 'Modifier' : 'Ajouter'} {t("une action Docker")}</h3>
          <button aria-label="Fermer" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nd-text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="nd-label">{t("Nom du bouton")}</label>
            <input className="nd-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("ex: Redémarrer Supabase")} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="nd-label">{t("Icône")}</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {ACTION_ICONS.map(i => (
                  <button
                    key={i.name}
                    onClick={() => setIcon(i.name)}
                    style={{
                      padding: 8,
                      borderRadius: 'var(--nd-card-radius)',
                      background: icon === i.name ? 'var(--nd-accent)' : 'var(--nd-icon-bg)',
                      border: 'none',
                      color: icon === i.name ? 'white' : 'var(--nd-text)',
                      cursor: 'pointer'
                    }}
                  >
                    {i.icon}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="nd-label">{t("Action (au clic)")}</label>
              <CustomSelect
                value={actionType}
                onChange={(val) => setActionType(val as any)}
                options={[
                  { value: 'switch', label: t("Basculer (Stop/Start)") },
                  { value: 'start', label: t("Démarrer (Start)") },
                  { value: 'stop', label: t("Arrêter (Stop)") }
                ]}
              />
            </div>
          </div>

          <div>
            <label className="nd-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{t("Conteneurs cibles (")}{targets.length} {t("sélectionnés)")}</span>
              {loading && <span style={{ fontSize: '0.65rem', color: 'var(--nd-accent)' }}>{t("Chargement...")}</span>}
            </label>
            <div className="nd-search" style={{ marginBottom: 12, maxWidth: 'none' }}>
              <Search size={14} className="nd-search-icon" />
              <input
                placeholder={t("Rechercher un conteneur...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div style={{
              maxHeight: 200,
              overflowY: 'auto',
              background: 'var(--nd-icon-bg)',
              borderRadius: 'var(--nd-card-radius)',
              border: '1px solid var(--nd-border)',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {filteredContainers.length === 0 && !loading && (
                <div style={{ padding: 16, textAlign: 'center', fontSize: '0.75rem', color: 'var(--nd-text-muted)' }}>
                  {t("Aucun conteneur trouvé")}
                </div>
              )}
              {filteredContainers.map(({ hostId, hostName, container }) => {
                const cname = container.names[0].replace(/^\//, '');
                const selected = isSelected(hostId, cname);

                return (
                  <div
                    key={`${hostId}-${container.id}`}
                    onClick={() => toggleTarget(hostId, cname)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(255,255,255,0.02)',
                      background: selected ? 'rgba(var(--nd-accent-rgb), 0.1)' : 'transparent',
                      gap: 12
                    }}
                  >
                    <div style={{
                      width: 16, height: 16, borderRadius: 'calc(var(--nd-card-radius) * 0.4)',
                      border: `1px solid ${selected ? 'var(--nd-accent)' : 'var(--nd-border)'}`,
                      background: selected ? 'var(--nd-accent)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {selected && <Check size={12} color="white" />}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cname}</span>
                      <span style={{ fontSize: '0.6rem', color: 'var(--nd-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Server size={8} /> {hostName}
                      </span>
                    </div>

                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: container.state === 'running' ? 'var(--nd-green)' : 'var(--nd-text-muted)' }} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
          {action && onDelete ? (
            <button className="nd-btn" onClick={() => onDelete(action.id)} style={{ color: 'var(--nd-red)' }}>
              <Trash2 size={12} /> Supprimer
            </button>
          ) : <div />}
          <button className="nd-btn nd-btn-accent" onClick={handleSubmit} disabled={!name.trim() || targets.length === 0}>
            {action ? 'Enregistrer' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}
