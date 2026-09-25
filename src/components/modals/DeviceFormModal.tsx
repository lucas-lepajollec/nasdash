import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import type { Device } from '@/lib/types';
import type { SourceTarget } from '@/integrations/types';
import { getDeviceIntegration } from '@/integrations/registry';
import { machineFields, monitoringInstances, SERVER_SOURCES } from '@/integrations/sources';
import ConfirmModal from './ConfirmModal';
import CustomSelect from '@/components/shared/CustomSelect';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeDialog, CalmeField } from '@/components/shared/CalmeDialog';
import { ConnectionFields, fieldDefaults, type FieldValues } from '@/components/integrations/ConnectionFields';
import { testConnection } from '@/components/integrations/MonitoringConnectionDialog';
import { useOpenSettings } from '@/components/integrations/useOpenSettings';

interface DeviceFormModalProps {
  device?: Device;
  onClose: () => void;
  onSave: (data: Omit<Partial<Device>, 'source'> & { source?: Device['source'] | null }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  showSensitive?: boolean;
}

const NONE = 'none';

/**
 * A machine: its name, icon and description, and where its measures come
 * from: a source saved on the Integrations page (Glances, Beszel…). On a
 * server that watches several machines (Beszel, Prometheus, Proxmox) the
 * machine is picked from the list the server gives. With no source yet, the
 * dialog explains the first step and links to the Integrations page.
 */
export default function DeviceFormModal({ device, onClose, onSave, onDelete, showSensitive = false }: DeviceFormModalProps) {
  const { t } = useI18n();
  const dialogRef = useDialogAccessibility(onClose);
  const { config } = useConfig();
  const { openIntegrations } = useOpenSettings();
  const demoMode = config?.demoMode === true;
  const sources = monitoringInstances(config);
  const [name, setName] = useState(device?.name || '');
  const [host, setHost] = useState(device?.host || '');
  const [icon, setIcon] = useState(device?.icon || '🖥️');
  const [sourceId, setSourceId] = useState<string>(device?.source?.integrationId ?? (device ? (device.api ? '' : NONE) : sources[0]?.id ?? NONE));
  const source = sources.find(instance => instance.id === sourceId);
  const manifest = getDeviceIntegration(source?.type);
  const fields = manifest ? machineFields(manifest) : [];
  const [values, setValues] = useState<FieldValues>(() => (device?.source ? { ...(device.source.values ?? {}) } : fieldDefaults(fields)));
  const [targets, setTargets] = useState<SourceTarget[] | null>(null);
  const [targetsError, setTargetsError] = useState('');
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const server = !!source && SERVER_SOURCES.includes(source.type);

  // A server lists its machines: offered as a picker.
  const loadTargets = async () => {
    if (!source) return;
    setLoadingTargets(true);
    setTargetsError('');
    const result = await testConnection({ type: source.type, id: source.id });
    setLoadingTargets(false);
    if (result.ok && result.targets) setTargets(result.targets);
    else { setTargets(null); setTargetsError(t(result.message, { count: 0 })); }
  };
  useEffect(() => {
    setTargets(null);
    setTargetsError('');
    if (server) void loadTargets();
  }, [sourceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickSource = (id: string) => {
    setSourceId(id);
    const next = getDeviceIntegration(sources.find(instance => instance.id === id)?.type);
    setValues(fieldDefaults(next ? machineFields(next) : []));
  };

  // A machine is its values; a VM type only counts with a VM id.
  const keyOf = (entries: Record<string, string | undefined>) => JSON.stringify(Object.fromEntries(
    Object.entries(entries).filter(([key, value]) => value && fields.some(field => field.id === key) && (key !== 'vmType' || entries.vmid)).sort(([a], [b]) => a.localeCompare(b)),
  ));
  const targetKey = (target: SourceTarget) => keyOf(target.values);
  const currentKey = keyOf(values);
  const pickedTarget = targets?.find(target => targetKey(target) === currentKey);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setSaveError('');
    try {
      const machineValues = Object.fromEntries(fields.map(field => [field.id, values[field.id] ?? '']).filter(([, value]) => value));
      await onSave({
        ...(device?.id ? { id: device.id } : {}),
        name,
        host,
        icon,
        // '' keeps a legacy connection untouched; none removes the source.
        ...(sourceId === '' ? {} : { source: source ? { integrationId: source.id, ...(Object.keys(machineValues).length ? { values: machineValues } : {}) } : null }),
      });
    } catch (error) {
      console.error(error);
      setSaveError(error instanceof Error ? error.message : t('integrations.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const sourceOptions = [
    ...(device?.api && !device.source ? [{ value: '', label: t('integrations.legacySource', { name: getDeviceIntegration(device.api.type)?.name ?? device.api.type }) }] : []),
    ...sources.map(instance => ({ value: instance.id, label: instance.name })),
    { value: NONE, label: t('integrations.noSource') },
  ];

  return (
    <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <CalmeDialog
        dialogRef={dialogRef}
        label={device ? t("Modifier l'appareil") : t("Ajouter un appareil")}
        title={device ? t("Éditer l'appareil") : t("Ajouter un appareil")}
        subtitle={demoMode ? t("Appareil entièrement simulé : les statistiques ne proviendront jamais de cette adresse. Utilisez une IP de documentation comme 192.0.2.60 et ne saisissez aucun identifiant réel.") : undefined}
        width={500}
        onClose={onClose}
        danger={device && onDelete && (
          <button type="button" className="nd-btn ndc-danger-ghost" onClick={() => setShowDeleteConfirm(true)}>{t("Supprimer")}</button>
        )}
        footer={<>
          <button type="button" onClick={onClose} className="nd-btn">{t("Annuler")}</button>
          <button type="submit" form="nd-device-form" className="nd-btn nd-btn-accent" disabled={isSaving}>
            {isSaving ? <Loader2 size={14} className="nd-spin" /> : t("Enregistrer")}
          </button>
        </>}
      >
        <form id="nd-device-form" onSubmit={handleSubmit} className="ndc-form">
          <div className="ndc-field-inline">
            <CalmeField label={t("Icône")}>
              <input type="text" className="nd-input ndc-emoji-input" value={icon} onChange={e => setIcon(e.target.value)} maxLength={2} required aria-label={t("Icône")} />
            </CalmeField>
            <CalmeField label={t("Nom de l'appareil")} htmlFor="device-name">
              <input id="device-name" type="text" className="nd-input" value={name} onChange={e => setName(e.target.value)} placeholder={t("Ex: PC Fixe")} required />
            </CalmeField>
          </div>
          <CalmeField label={t('device.calme.description')} info={t("(Optionnel)")} htmlFor="device-host">
            <input id="device-host" type="text" className="nd-input" value={host} onChange={e => setHost(e.target.value)} placeholder={t("Ex: Windows 11")} />
          </CalmeField>

          {sources.length === 0 && !device?.api ? (
            <div className="ndc-callout">
              <span className="ndc-callout-title">{t('integrations.noSourceTitle')}</span>
              <span className="ndc-callout-text">{t('integrations.noSourceText')}</span>
              <button type="button" className="nd-btn nd-btn-accent" onClick={() => openIntegrations('monitoring')}>{t('integrations.openPage')}</button>
            </div>
          ) : (
            <CalmeField label={t('integrations.source')} info={t('integrations.sourceHint')}>
              <div className="ndc-dlg-inline ndc-source-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <CustomSelect value={sourceId} onChange={pickSource} options={sourceOptions} ariaLabel={t('integrations.source')} />
                </div>
                <button type="button" className="ndc-text-button" onClick={() => openIntegrations('monitoring')}>{t('integrations.manageSources')}</button>
              </div>
            </CalmeField>
          )}

          {source && server && (
            <CalmeField label={t('integrations.machineOnServer', { name: manifest?.name ?? '' })} info={t('integrations.machineOnServerHint')}>
              <div className="ndc-dlg-inline ndc-source-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  {targets && targets.length > 0 ? (
                    <CustomSelect
                      value={pickedTarget ? targetKey(pickedTarget) : ''}
                      onChange={key => { const target = targets.find(item => targetKey(item) === key); if (target) setValues({ ...fieldDefaults(fields), ...target.values }); if (target && !name) setName(target.label); }}
                      options={[...(pickedTarget ? [] : [{ value: '', label: t('integrations.pickMachine') }]), ...targets.map(target => ({ value: targetKey(target), label: target.detail ? `${target.label} — ${target.detail}` : target.label }))]}
                      ariaLabel={t('integrations.machineOnServer', { name: manifest?.name ?? '' })}
                    />
                  ) : (
                    <span className="ndc-set-list-sub">{loadingTargets ? t('integrations.loadingMachines') : targetsError || t('integrations.typeMachine')}</span>
                  )}
                </div>
                <button type="button" className="ndc-icon-button" onClick={() => void loadTargets()} disabled={loadingTargets} title={t('integrations.refreshMachines')} aria-label={t('integrations.refreshMachines')}>
                  {loadingTargets ? <Loader2 size={13} className="nd-spin" /> : <RefreshCw size={13} />}
                </button>
              </div>
            </CalmeField>
          )}
          {source && fields.length > 0 && (!server || !targets?.length) && (
            <ConnectionFields fields={fields} values={values} onChange={(id, value) => setValues(current => ({ ...current, [id]: value }))} editing={!!device} showSensitive={showSensitive} />
          )}
          {saveError && <p className="ndc-dialog-hint" style={{ color: 'var(--nd-red)' }}>{saveError}</p>}
        </form>
      </CalmeDialog>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => onDelete && device && onDelete(device.id)}
        title={t("Supprimer l'appareil ?")}
        description={device ? t('confirm.deviceRemove', { name: device.name }) : ''}
      />
    </div>
  );
}
