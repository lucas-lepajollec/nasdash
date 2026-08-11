import { useState, useEffect } from 'react';
import { Device, DeviceApiConfig } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import CustomSelect from '@/components/shared/CustomSelect';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';
import { useConfig } from '@/hooks/useConfig';

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
  const dialogRef = useDialogAccessibility(onClose);
  const { config } = useConfig();
  const demoMode = config?.demoMode === true;
  const [name, setName] = useState(device?.name || '');
  const [host, setHost] = useState(device?.host || '');
  const [icon, setIcon] = useState(device?.icon || '🖥️');
  const [apiType, setApiType] = useState<DeviceApiConfig['type']>(device?.api?.type || 'glances');

  const [ip, setIp] = useState(device?.api?.ip || '');
  const [port, setPort] = useState(device?.api?.port || '');
  const [username, setUsername] = useState(device?.api?.username || '');
  const [password, setPassword] = useState(''); // Always keep secret empty 

  const [nodeName, setNodeName] = useState(device?.api?.nodeName || 'pve');
  const [vmid, setVmid] = useState(device?.api?.vmid || '');
  const [vmType, setVmType] = useState(device?.api?.vmType || 'qemu');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Auto-fill default port based on API type if empty
  useEffect(() => {
    if (!port) {
      if (apiType === 'glances') setPort('61208');
      if (apiType === 'proxmox') setPort('8006');
      if (apiType === 'lhm') setPort('9001');
    }
  }, [apiType, port]);

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
          ip,
          port,
          username,
          password,
          nodeName: apiType === 'proxmox' ? nodeName : undefined,
          vmid: apiType === 'proxmox' ? vmid : undefined,
          vmType: apiType === 'proxmox' && vmid ? vmType : undefined,
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
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={device ? "Modifier l'appareil" : 'Ajouter un appareil'} tabIndex={-1} className="nd-modal" style={{ maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <h2 className="nd-section-title" style={{ marginBottom: 20 }}>
          {device ? 'Éditer l\'appareil' : 'Ajouter un appareil'}
        </h2>

        {demoMode && (
          <div style={{ padding: '10px 12px', marginBottom: 16, border: '1px solid color-mix(in srgb, var(--nd-accent) 28%, var(--nd-card-border))', borderRadius: 'var(--nd-card-radius)', color: 'var(--nd-text-muted)', fontSize: '0.68rem', lineHeight: 1.5 }}>
            Appareil entièrement simulé : les statistiques ne proviendront jamais de cette adresse. Utilisez une IP de documentation comme 192.0.2.60 et ne saisissez aucun identifiant réel.
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ width: 60 }}>
              <label className="nd-label">Icône</label>
              <input
                type="text"
                className="nd-input"
                style={{ textAlign: 'center' }}
                value={icon}
                onChange={e => setIcon(e.target.value)}
                maxLength={2}
                required
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="nd-label">Nom de l'appareil</label>
              <input
                type="text"
                className="nd-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: PC Fixe"
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
              <label className="nd-label" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Label OS/Description <span style={{ opacity: 0.5, fontSize: '0.8em', fontWeight: 'normal' }}>(Optionnel)</span></label>
              <input
                type="text"
                className="nd-input"
                value={host}
                onChange={e => setHost(e.target.value)}
                placeholder="Ex: Windows 11"
              />
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--nd-card-border)', paddingTop: 16, marginTop: 4 }}>
            <label className="nd-label">API de surveillance</label>
            <CustomSelect
              value={apiType}
              onChange={val => {
                setApiType(val as any);
                setPort(''); // reset port to trigger auto-fill
              }}
              options={[
                { value: 'glances', label: 'Glances' },
                { value: 'proxmox', label: 'Proxmox VE' },
                { value: 'lhm', label: 'Libre Hardware Monitor' }
              ]}
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 3 }}>
              <label className="nd-label">IP (Hôte)</label>
              <input
                type={!showSensitive ? "password" : "text"}
                className="nd-input"
                value={ip}
                onChange={e => setIp(e.target.value)}
                placeholder="ex: 192.168.1.10"
                required
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="nd-label">Port</label>
              <input
                type="text"
                className="nd-input"
                value={port}
                onChange={e => setPort(e.target.value)}
                placeholder="ex: 61208"
                required
              />
            </div>
          </div>

          {apiType === 'proxmox' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, background: 'rgba(0,0,0,0.1)', padding: 12, borderRadius: 'var(--nd-card-radius)', border: '1px solid var(--nd-card-border)' }}>
              <div>
                <label className="nd-label">Nom du Nœud (Datacenter)</label>
                <input
                  type="text"
                  className="nd-input"
                  value={nodeName}
                  onChange={e => setNodeName(e.target.value)}
                  placeholder="ex: pve"
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label className="nd-label">ID VM/LXC (Optionnel)</label>
                  <input
                    type="text"
                    className="nd-input"
                    value={vmid}
                    onChange={e => setVmid(e.target.value)}
                    placeholder="ex: 104"
                  />
                </div>
                {vmid && (
                  <div style={{ flex: 1 }}>
                    <label className="nd-label">Type</label>
                    <CustomSelect
                      value={vmType}
                      onChange={val => setVmType(val as any)}
                      options={[
                        { value: 'qemu', label: 'VM (QEMU)' },
                        { value: 'lxc', label: 'Conteneur (LXC)' }
                      ]}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="nd-label">
                {apiType === 'proxmox' ? "Token ID (ex: root@pam!token_name)" : "Utilisateur (Si requis)"}
              </label>
              <input
                type="text"
                className="nd-input"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder={apiType === 'proxmox' ? "root@pam!token" : apiType === 'lhm' ? "Non requis" : "Optionnel"}
                required={apiType === 'proxmox'}
                disabled={apiType === 'lhm'}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="nd-label">
                {apiType === 'proxmox' ? "Token Secret (UUID)" : "Mot de passe / Jeton"}
              </label>
              <input
                type="password"
                className="nd-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={device ? "Laisser vide pour garder l'actuel" : apiType === 'lhm' ? "Non requis" : "Optionnel (Masqué)"}
                required={!device && apiType === 'proxmox'}
                disabled={apiType === 'lhm'}
              />
            </div>
          </div>

          {saveError && <div style={{ color: 'var(--nd-red)', fontSize: '0.7rem' }}>{saveError}</div>}
          <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
            {device && onDelete && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="nd-btn nd-btn-danger"
                style={{ flex: 1, borderColor: 'var(--nd-red)', color: 'var(--nd-red)' }}
              >
                Supprimer
              </button>
            )}
            <div style={{ flex: device ? 1 : 2, display: 'flex', gap: 12 }}>
              <button type="button" onClick={onClose} className="nd-btn" style={{ flex: 1 }}>Annuler</button>
              <button type="submit" className="nd-btn nd-btn-accent" style={{ flex: 1 }} disabled={isSaving}>
                {isSaving ? <Loader2 size={14} className="nd-spin" /> : 'Enregistrer'}
              </button>
            </div>
          </div>
        </form>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => onDelete && device && onDelete(device.id)}
        title="Supprimer l'appareil ?"
        description={device ? `Voulez-vous vraiment supprimer "${device.name}" de votre tableau de bord ? Cette action est irréversible.` : ''}
      />
    </div>
  );
}
