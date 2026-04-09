import { useState, useEffect } from 'react';
import { Device, DeviceApiConfig } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import ConfirmModal from '../../../shared/ConfirmModal';

interface DeviceFormModalProps {
  device?: Device;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export default function DeviceFormModal({ device, onClose, onSave, onDelete }: DeviceFormModalProps) {
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
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="nd-modal" style={{ maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <h2 className="nd-section-title" style={{ marginBottom: 20 }}>
          {device ? 'Éditer l\'appareil' : 'Ajouter un appareil'}
        </h2>

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

          <div>
            <label className="nd-label">Label OS/Description</label>
            <input
              type="text"
              className="nd-input"
              value={host}
              onChange={e => setHost(e.target.value)}
              placeholder="Ex: Windows 11"
              required
            />
          </div>

          <div style={{ borderTop: '1px solid var(--nd-card-border)', paddingTop: 16, marginTop: 4 }}>
            <label className="nd-label">API de surveillance</label>
            <select
              className="nd-input"
              value={apiType}
              onChange={e => {
                setApiType(e.target.value as any);
                setPort(''); // reset port to trigger auto-fill
              }}
            >
              <option value="glances">Glances</option>
              <option value="proxmox">Proxmox VE</option>
              <option value="lhm">Libre Hardware Monitor</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 3 }}>
              <label className="nd-label">IP (Hôte)</label>
              <input
                type="text"
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, background: 'rgba(0,0,0,0.1)', padding: 12, borderRadius: 8, border: '1px solid var(--nd-card-border)' }}>
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
                    <select className="nd-input" value={vmType} onChange={e => setVmType(e.target.value as any)}>
                      <option value="qemu">VM (QEMU)</option>
                      <option value="lxc">Conteneur (LXC)</option>
                    </select>
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
