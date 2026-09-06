'use client';

import { useState } from 'react';
import { Service } from '@/lib/types';
import { X, Upload, Trash2 } from 'lucide-react';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { safeImageSource } from '@/lib/imageSource';

interface ServiceFormModalProps {
  service?: Service;
  categoryId?: string;
  onClose: () => void;
  onSave: (data: { name: string; localUrl: string; secondaryUrl: string; logo: string; secondaryLogo: string; categoryId?: string }) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
  onUploadLogo: (file: File) => Promise<string>;
  showSensitive?: boolean;
}

export default function ServiceFormModal({ service, categoryId, onClose, onSave, onDelete, onUploadLogo, showSensitive = false }: ServiceFormModalProps) {
  const { t } = useI18n();
  const dialogRef = useDialogAccessibility(onClose);
  const { config } = useConfig();
  const demoMode = config?.demoMode === true;
  const [name, setName] = useState(service?.name || '');
  const [localUrl, setLocalUrl] = useState(service?.localUrl || '');
  const [secondaryUrl, setSecondaryUrl] = useState(service?.secondaryUrl || service?.tailscaleUrl || '');
  const [logo, setLogo] = useState(service?.logo || '');
  const [secondaryLogo, setSecondaryLogo] = useState(service?.secondaryLogo || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const logoPreview = safeImageSource(logo);
  const secondaryLogoPreview = safeImageSource(secondaryLogo);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await onUploadLogo(file);
    setLogo(url);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    setSaveError('');
    try {
      await onSave({ name, localUrl, secondaryUrl, logo, secondaryLogo, categoryId });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Impossible d’enregistrer ce service.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={service ? t("Modifier un service") : t("Ajouter un service")} tabIndex={-1} className="nd-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700 }}>{t(service ? "Modifier un service" : "Ajouter un service")}</h3>
          <button aria-label={t("Fermer")} onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nd-text-muted)' }}>
            <X size={16} />
          </button>
        </div>
        {demoMode && (
          <div style={{ padding: '10px 12px', marginBottom: 14, border: '1px solid color-mix(in srgb, var(--nd-accent) 28%, var(--nd-card-border))', borderRadius: 'var(--nd-card-radius)', color: 'var(--nd-text-muted)', fontSize: '0.68rem', lineHeight: 1.5 }}>
            {t("Ce formulaire modifie uniquement votre session de démo. Utilisez des URL fictives : NasDash ne doit recevoir ici aucune adresse privée ni information personnelle.")}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="nd-label">{t("Nom")}</label>
            <input className="nd-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jellyfin" />
          </div>
          <div>
            <label className="nd-label">{t("URL Locale")}</label>
            <input type={!showSensitive ? "password" : "text"} className="nd-input" value={localUrl} onChange={(e) => setLocalUrl(e.target.value)} placeholder="http://192.168.1.100:8080" />
          </div>
          <div>
            <label className="nd-label">{t("URL Secondaire (Optionnel)")}</label>
            <input type={!showSensitive ? "password" : "text"} className="nd-input" value={secondaryUrl} onChange={(e) => setSecondaryUrl(e.target.value)} placeholder="https://vpn.example.com" />
          </div>
          <div>
            <label className="nd-label">{t("Logo")}</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {logoPreview && (
                <img src={logoPreview} alt="" style={{ width: 28, height: 28, borderRadius: 'var(--nd-card-radius)', objectFit: 'contain', background: 'var(--nd-icon-bg)' }} />
              )}
              {demoMode ? (
                <input className="nd-input" value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://cdn.example/logo.svg" />
              ) : <label className="nd-btn" style={{ cursor: 'pointer' }}>
                <Upload size={12} /> {t("Upload")}
                <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
              </label>}
              {logo && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="nd-btn" title={t("Détacher le logo du service")} onClick={() => setLogo('')}>
                    <X size={12} />
                  </button>
                  {logo.startsWith('/api/logos/') && (
                    <button
                      className="nd-btn"
                      title={t("Supprimer définitivement le fichier du serveur")}
                      onClick={async () => {
                        if (confirm(t("Voulez-vous supprimer définitivement ce logo du serveur ? Cette action supprimera le fichier physique."))) {
                          const filename = logo.replace('/api/logos/', '');
                          try {
                            await fetch(`/api/logos/${filename}`, { method: 'DELETE' });
                          } catch (e) {
                            console.error("Erreur de suppression du logo:", e);
                          }
                          setLogo('');
                        }
                      }}
                      style={{ color: 'var(--nd-red)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="nd-label">{t("Logo Secondaire (Optionnel)")}</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {secondaryLogoPreview && (
                <img src={secondaryLogoPreview} alt="" style={{ width: 28, height: 28, borderRadius: 'var(--nd-card-radius)', objectFit: 'contain', background: 'var(--nd-icon-bg)' }} />
              )}
              {demoMode ? (
                <input className="nd-input" value={secondaryLogo} onChange={(e) => setSecondaryLogo(e.target.value)} placeholder="https://cdn.example/logo-alt.svg" />
              ) : <label className="nd-btn" style={{ cursor: 'pointer' }}>
                <Upload size={12} /> {t("Upload")}
                <input type="file" accept="image/*" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const url = await onUploadLogo(file);
                  setSecondaryLogo(url);
                }} style={{ display: 'none' }} />
              </label>}
              {secondaryLogo && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="nd-btn" title={t("Détacher le logo secondaire")} onClick={() => setSecondaryLogo('')}>
                    <X size={12} />
                  </button>
                  {secondaryLogo.startsWith('/api/logos/') && (
                    <button
                      className="nd-btn"
                      title={t("Supprimer définitivement le fichier du serveur")}
                      onClick={async () => {
                        if (confirm(t("Voulez-vous supprimer définitivement ce logo du serveur ? Cette action supprimera le fichier physique."))) {
                          const filename = secondaryLogo.replace('/api/logos/', '');
                          try {
                            await fetch(`/api/logos/${filename}`, { method: 'DELETE' });
                          } catch (e) {
                            console.error("Erreur de suppression du logo:", e);
                          }
                          setSecondaryLogo('');
                        }
                      }}
                      style={{ color: 'var(--nd-red)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {saveError && <div style={{ marginTop: 14, color: 'var(--nd-red)', fontSize: '0.7rem' }}>{saveError}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
          {service && onDelete ? (
            <button className="nd-btn" onClick={() => onDelete(service.id)} style={{ color: 'var(--nd-red)' }}>
              <Trash2 size={12} /> {t("Supprimer")}
            </button>
          ) : <div />}
          <button className="nd-btn nd-btn-accent" onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? t("Enregistrement…") : service ? t("Enregistrer") : t("Ajouter")}
          </button>
        </div>
      </div>
    </div>
  );
}
