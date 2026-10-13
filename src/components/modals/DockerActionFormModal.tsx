'use client';

import { dockerJsonFetcher, dockerActionError } from '@/lib/dockerErrorContract';

import React, { useState, useEffect } from 'react';
import { Search, Trash2, Power, Play, RefreshCw, Layers } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { DockerActionConfig, DockerContainer } from '@/lib/types';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeCheckRow, CalmeDialog, CalmeField } from '@/components/shared/CalmeDialog';
import { CalmeSegmented } from './settings/shared/CalmeControls';

interface DockerActionFormModalProps {
  action?: DockerActionConfig;
  onClose: () => void;
  onSave: (data: any) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    // Fetch all containers from all hosts
    const fetchContainers = async () => {
      if (!config?.dockerHosts) return;
      setLoading(true);

      try {
        const failures: string[] = [];
        const allContainers: { hostId: string; hostName: string; container: DockerContainer }[] = [];

        await Promise.all(config.dockerHosts.map(async (host) => {
          try {
            const data = await dockerJsonFetcher(`/api/docker/${host.id}/containers?all=true`) as DockerContainer[];
            data.forEach(container => { allContainers.push({ hostId: host.id, hostName: host.name, container }); });
          } catch (e) {
            failures.push(`${host.name}: ${dockerActionError(e, t)}`);
          }
        }));

        setAvailableContainers(allContainers);
        setLoadError(failures.join(' · '));
      } finally {
        setLoading(false);
      }
    };

    fetchContainers();
  }, [config?.dockerHosts, t]);

  const handleSubmit = async () => {
    if (!name.trim() || targets.length === 0) return;
    setSaving(true); setSaveError('');
    try { await onSave({ name, icon, actionType, targets }); onClose(); }
    catch { setSaveError(t('docker.failure.save_action')); }
    finally { setSaving(false); }
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
    const nameStr = (c.container.names?.[0] || c.container.id).replace(/^\//, '').toLowerCase();
    return nameStr.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <CalmeDialog
        dialogRef={dialogRef}
        label={action ? t("Modifier une action Docker") : t("Ajouter une action Docker")}
        title={t(action ? "Modifier une action Docker" : "Ajouter une action Docker")}
        width={480}
        onClose={onClose}
        danger={action && onDelete && (
          <button type="button" className="nd-btn ndc-danger-ghost" disabled={saving} onClick={async () => { setSaving(true); setSaveError(''); try { await onDelete(action.id); onClose(); } catch { setSaveError(t('docker.failure.save_action')); } finally { setSaving(false); } }}><Trash2 size={12} /> {t("Supprimer")}</button>
        )}
        footer={<>
          <button type="button" className="nd-btn" disabled={saving} onClick={onClose}>{t("Annuler")}</button>
          <button type="button" className="nd-btn nd-btn-accent" onClick={handleSubmit} disabled={saving || !name.trim() || targets.length === 0}>{action ? t("Enregistrer") : t("Ajouter")}</button>
        </>}
      >
        {loadError && <p role="alert" className="ndc-dialog-hint" style={{ color: 'var(--nd-red)' }}>{loadError}</p>}
        {saveError && <p role="alert" className="ndc-dialog-hint" style={{ color: 'var(--nd-red)' }}>{saveError}</p>}
        <div className="ndc-field-inline">
          <CalmeField label={t("Nom du bouton")} htmlFor="docker-action-name">
            <input id="docker-action-name" className="nd-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("ex: Redémarrer Supabase")} />
          </CalmeField>
        </div>
        <CalmeField label={t("Icône")}>
          <div className="ndc-icon-choices" role="radiogroup" aria-label={t("Icône")}>
            {ACTION_ICONS.map(i => (
              <button key={i.name} type="button" role="radio" aria-checked={icon === i.name} className="ndc-icon-pick" onClick={() => setIcon(i.name)}>{i.icon}</button>
            ))}
          </div>
        </CalmeField>
        <CalmeField label={t("Action (au clic)")} info={t('docker.calme.switchInfo')}>
          <CalmeSegmented
            label={t("Action (au clic)")}
            value={actionType}
            onChange={(val) => setActionType(val)}
            options={[
              { value: 'switch', label: t('docker.calme.switch') },
              { value: 'start', label: t('Start') },
              { value: 'stop', label: t('Stop') },
            ]}
          />
        </CalmeField>
        <CalmeField label={<>{t('docker.calme.targetsLabel')}<span className="ndc-field-count">{targets.length}</span>{loading && <span className="nd-spinner" style={{ width: 10, height: 10, marginLeft: 8 }} />}</>}>
          <label className="ndc-settings-search">
            <Search size={14} aria-hidden="true" />
            <input type="search" placeholder={t("Rechercher un conteneur...")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} aria-label={t("Rechercher un conteneur...")} />
          </label>
          <div className="ndc-check-list">
            {filteredContainers.length === 0 && !loading && <div className="ndc-set-empty">{t("Aucun conteneur trouvé")}</div>}
            {filteredContainers.map(({ hostId, hostName, container }) => {
              const cname = (container.names?.[0] || container.id).replace(/^\//, '');
              return (
                <CalmeCheckRow key={`${hostId}-${container.id}`} checked={isSelected(hostId, cname)} onChange={() => toggleTarget(hostId, cname)}>
                  <span className="ndc-check-text">
                    <span>{cname}</span>
                    <span className="ndc-set-list-sub">{hostName}</span>
                  </span>
                  <span className={`ndc-dot ${container.state === 'running' ? 'ndc-dot--running' : ''}`} />
                </CalmeCheckRow>
              );
            })}
          </div>
        </CalmeField>
      </CalmeDialog>
    </div>
  );
}
