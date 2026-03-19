'use client';

import { useState, useEffect } from 'react';
import { Service } from '@/lib/types';
import { X, Upload, Trash2 } from 'lucide-react';

interface ServiceFormModalProps {
  service?: Service;
  categoryId?: string;
  onClose: () => void;
  onSave: (data: { name: string; localUrl: string; tailscaleUrl: string; logo: string; categoryId?: string }) => void;
  onDelete?: (id: string) => void;
  onUploadLogo: (file: File) => Promise<string>;
}

export default function ServiceFormModal({ service, categoryId, onClose, onSave, onDelete, onUploadLogo }: ServiceFormModalProps) {
  const [name, setName] = useState(service?.name || '');
  const [localUrl, setLocalUrl] = useState(service?.localUrl || '');
  const [tailscaleUrl, setTailscaleUrl] = useState(service?.tailscaleUrl || '');
  const [logo, setLogo] = useState(service?.logo || '');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await onUploadLogo(file);
    setLogo(url);
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSave({ name, localUrl, tailscaleUrl, logo, categoryId });
  };

  return (
    <div className="nd-modal-overlay" onClick={onClose}>
      <div className="nd-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700 }}>{service ? 'Modifier' : 'Ajouter'} un service</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nd-text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="nd-label">Nom</label>
            <input className="nd-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jellyfin" />
          </div>
          <div>
            <label className="nd-label">URL Locale</label>
            <input className="nd-input" value={localUrl} onChange={(e) => setLocalUrl(e.target.value)} placeholder="http://192.168.1.100:8080" />
          </div>
          <div>
            <label className="nd-label">URL Tailscale</label>
            <input className="nd-input" value={tailscaleUrl} onChange={(e) => setTailscaleUrl(e.target.value)} placeholder="http://100.100.100.100:8080" />
          </div>
          <div>
            <label className="nd-label">Logo</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {logo && (
                <img src={logo} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'contain', background: 'var(--nd-icon-bg)' }} />
              )}
              <label className="nd-btn" style={{ cursor: 'pointer' }}>
                <Upload size={12} /> Upload
                <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
              </label>
              {logo && (
                <button className="nd-btn" onClick={() => setLogo('')}><X size={12} /></button>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
          {service && onDelete ? (
            <button className="nd-btn" onClick={() => onDelete(service.id)} style={{ color: 'var(--nd-red)' }}>
              <Trash2 size={12} /> Supprimer
            </button>
          ) : <div />}
          <button className="nd-btn nd-btn-accent" onClick={handleSubmit}>
            {service ? 'Enregistrer' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}
