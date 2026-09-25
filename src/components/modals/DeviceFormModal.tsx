import React, { useState, useEffect } from 'react';
import { Device, DeviceApiConfig } from '@/lib/types';
import { getDeviceIntegration, selectableDeviceIntegrations } from '@/integrations/registry';
import type { ConnectionField, ConnectionFieldId } from '@/integrations/types';
import { Loader2 } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import CustomSelect from '@/components/shared/CustomSelect';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeDialog, CalmeField } from '@/components/shared/CalmeDialog';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  label?: string;
  sublabel?: string;
}

function ToggleSwitch({ checked, onChange, label, sublabel }: ToggleSwitchProps) {
  return (
    <div 
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        userSelect: 'none'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginRight: 16 }}>
        {label && <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--nd-text)' }}>{label}</span>}
        {sublabel && <span style={{ fontSize: '0.66rem', color: 'var(--nd-text-muted)' }}>{sublabel}</span>}
      </div>
      <div 
        style={{
          width: '36px',
          height: '18px',
          borderRadius: '9px',
          background: checked ? 'var(--nd-green)' : 'rgba(255,255,255,0.08)',
          border: checked ? 'none' : '1px solid var(--nd-card-border)',
          position: 'relative',
          transition: 'all 0.2s ease',
          flexShrink: 0,
          boxShadow: checked ? '0 0 8px rgba(63, 185, 80, 0.3)' : 'none'
        }}
      >
        <div 
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: checked ? '#ffffff' : '#888888',
            position: 'absolute',
            top: checked ? '3px' : '2px',
            left: checked ? '21px' : '3px',
            transition: 'all 0.2s ease',
          }}
        />
      </div>
    </div>
  );
}

interface DeviceFormModalProps {
  device?: Device;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  showSensitive?: boolean;
}

export default function DeviceFormModal({ device, onClose, onSave, onDelete, showSensitive = false }: DeviceFormModalProps) {
  const { t } = useI18n();
  const dialogRef = useDialogAccessibility(onClose);
  const { config } = useConfig();
  const demoMode = config?.demoMode === true;
  const [name, setName] = useState(device?.name || '');
  const [host, setHost] = useState(device?.host || '');
  const [icon, setIcon] = useState(device?.icon || '🖥️');
  const [apiType, setApiType] = useState<DeviceApiConfig['type']>(device?.api?.type || 'glances');

  // Connection fields come from the integration's manifest; secrets always start empty.
  const [values, setValues] = useState<Partial<Record<ConnectionFieldId, string>>>({
    ip: device?.api?.ip || '',
    port: device?.api?.port || '',
    username: device?.api?.username || '',
    password: '',
    nodeName: device?.api?.nodeName || '',
    vmid: device?.api?.vmid || '',
    vmType: device?.api?.vmType || '',
    allowSelfSigned: device?.api?.allowSelfSigned ? 'true' : '',
    target: device?.api?.target || '',
  });
  const setValue = (id: ConnectionFieldId, value: string) => setValues(current => ({ ...current, [id]: value }));
  // Form values are text; switches are sent as booleans.
  const submitted = (field: ConnectionField) => field.kind === 'toggle' ? values[field.id] === 'true' : values[field.id] ?? '';
  const integration = getDeviceIntegration(apiType);
  const fields = integration?.fields ?? [];
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Empty fields take the integration's defaults (port, node name…).
  useEffect(() => {
    const defaults = (getDeviceIntegration(apiType)?.fields ?? []).filter(field => field.defaultValue);
    setValues(current => {
      const missing = defaults.filter(field => !current[field.id]);
      return missing.length ? { ...current, ...Object.fromEntries(missing.map(field => [field.id, field.defaultValue])) } : current;
    });
  }, [apiType, values.port]);

  const isShown = (field: ConnectionField) => !field.showWhen || Boolean(values[field.showWhen]);
  const isRequired = (field: ConnectionField) => field.required === true || (field.required === 'create' && !device);

  // Fields side by side per row; consecutive panel rows share one framed box.
  const connectionRows: { panel: boolean; rows: ConnectionField[][] }[] = [];
  for (const field of fields) {
    if (!isShown(field)) continue;
    const panel = Boolean(field.panel);
    let group = connectionRows[connectionRows.length - 1];
    if (!group || group.panel !== panel) connectionRows.push(group = { panel, rows: [] });
    const row = group.rows.find(candidate => candidate[0].row === field.row);
    if (row) row.push(field);
    else group.rows.push([field]);
  }

  const renderField = (field: ConnectionField) => {
    const value = values[field.id] ?? '';
    if (field.kind === 'toggle') {
      return (
        <ToggleSwitch
          checked={value === 'true'}
          onChange={checked => setValue(field.id, checked ? 'true' : '')}
          label={t(field.label)}
          sublabel={field.hint ? t(field.hint) : undefined}
        />
      );
    }
    if (field.kind === 'select') {
      return (
        <CustomSelect
          value={value || field.defaultValue || ''}
          onChange={next => setValue(field.id, next)}
          options={(field.options ?? []).map(option => ({ value: option.value, label: t(option.label) }))}
        />
      );
    }
    const secret = field.kind === 'secret';
    const placeholder = secret && device ? t("Laisser vide pour garder l'actuel") : field.placeholder ? t(field.placeholder) : undefined;
    return (
      <input
        type={secret || (field.kind === 'address' && !showSensitive) ? 'password' : 'text'}
        className="nd-input"
        value={value}
        onChange={e => setValue(field.id, e.target.value)}
        placeholder={placeholder}
        required={isRequired(field)}
      />
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError('');

    try {
      await onSave({
        id: device?.id,
        name,
        host,
        icon,
        api: {
          type: apiType,
          ...Object.fromEntries(fields.filter(field => isShown(field)).map(field => [field.id, submitted(field)])),
          // Always sent, as before: an empty password keeps the stored one.
          username: values.username ?? '',
          password: values.password ?? '',
        }
      });
    } catch (err) {
      console.error(err);
      setSaveError(err instanceof Error ? err.message : 'Impossible d’enregistrer cet appareil.');
    } finally {
      setIsSaving(false);
    }
  };

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
          <CalmeField label={t("API de surveillance")}>
            <CustomSelect
              value={apiType}
              onChange={val => {
                setApiType(val as DeviceApiConfig['type']);
                setValue('port', ''); // the new integration's default port is filled in
              }}
              options={selectableDeviceIntegrations().map(option => ({ value: option.id, label: t(option.name) }))}
            />
          </CalmeField>
          {connectionRows.map(({ panel, rows }, index) => (
            <div key={index} className={panel ? 'ndc-form-panel' : 'ndc-form'}>
              {rows.map(row => (
                <div key={row[0].id} className="ndc-form-row">
                  {row.map(field => (
                    <div key={field.id} style={{ flex: field.flex ?? 1, minWidth: 0 }}>
                      {field.kind === 'toggle' ? renderField(field) : <CalmeField label={t(field.label)}>{renderField(field)}</CalmeField>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
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
