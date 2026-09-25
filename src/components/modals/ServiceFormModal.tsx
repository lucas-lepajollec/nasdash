'use client';

import { useState } from 'react';
import { Service } from '@/lib/types';
import { X, Upload, Trash2 } from 'lucide-react';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeDialog, CalmeField } from '@/components/shared/CalmeDialog';

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

  const deleteLogoFile = async (url: string, clear: () => void) => {
    if (!confirm(t("Voulez-vous supprimer définitivement ce logo du serveur ? Cette action supprimera le fichier physique."))) return;
    try {
      await fetch(`/api/logos/${url.replace('/api/logos/', '')}`, { method: 'DELETE' });
    } catch (e) {
      console.error("Erreur de suppression du logo:", e);
    }
    clear();
  };

  /** A logo: its preview, an address or an uploaded file, detach and delete. */
  const logoField = (label: string, value: string, setValue: (v: string) => void, upload: (file: File) => Promise<void>, detachLabel: string) => (
    <CalmeField label={label}>
      <div className="ndc-logo-field">
        <span className="ndc-icon-pick ndc-logo-preview" aria-hidden="true">
          {value ? <img src={value} alt="" /> : <Upload size={14} />}
        </span>
        <input className="nd-input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="https://cdn.example/logo.svg" aria-label={label} />
        {!demoMode && (
          <label className="nd-btn" style={{ cursor: 'pointer' }}>
            <Upload size={12} /> {t("Upload")}
            <input type="file" accept="image/*" hidden onChange={async (e) => { const file = e.target.files?.[0]; if (file) await upload(file); e.target.value = ''; }} />
          </label>
        )}
        {value && <button type="button" className="ndc-icon-button" title={detachLabel} aria-label={detachLabel} onClick={() => setValue('')}><X size={14} /></button>}
        {value.startsWith('/api/logos/') && (
          <button type="button" className="ndc-icon-button ndc-icon-danger" title={t("Supprimer définitivement le fichier du serveur")} aria-label={t("Supprimer définitivement le fichier du serveur")} onClick={() => deleteLogoFile(value, () => setValue(''))}>
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </CalmeField>
  );

  return (
    <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <CalmeDialog
        dialogRef={dialogRef}
        label={service ? t("Modifier un service") : t("Ajouter un service")}
        title={t(service ? "Modifier un service" : "Ajouter un service")}
        subtitle={demoMode ? t("Ce formulaire modifie uniquement votre session de démo. Utilisez des URL fictives : NasDash ne doit recevoir ici aucune adresse privée ni information personnelle.") : undefined}
        onClose={onClose}
        danger={service && onDelete && (
          <button type="button" className="nd-btn ndc-danger-ghost" onClick={() => onDelete(service.id)}><Trash2 size={12} /> {t("Supprimer")}</button>
        )}
        footer={<>
          <button type="button" className="nd-btn" onClick={onClose}>{t("Annuler")}</button>
          <button type="button" className="nd-btn nd-btn-accent" onClick={handleSubmit} disabled={isSaving || !name.trim()}>
            {isSaving ? t("Enregistrement…") : service ? t("Enregistrer") : t("Ajouter")}
          </button>
        </>}
      >
        <CalmeField label={t("Nom")} htmlFor="service-name">
          <input id="service-name" className="nd-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jellyfin" autoFocus />
        </CalmeField>
        <CalmeField label={t("URL Locale")} htmlFor="service-url">
          <input id="service-url" type={!showSensitive ? "password" : "text"} className="nd-input" value={localUrl} onChange={(e) => setLocalUrl(e.target.value)} placeholder="http://192.168.1.100:8080" />
        </CalmeField>
        <CalmeField label={t('service.calme.secondaryUrl')} info={t('service.calme.secondaryUrlInfo')} htmlFor="service-url2">
          <input id="service-url2" type={!showSensitive ? "password" : "text"} className="nd-input" value={secondaryUrl} onChange={(e) => setSecondaryUrl(e.target.value)} placeholder="https://vpn.example.com" />
        </CalmeField>
        {logoField(t("Logo"), logo, setLogo, async file => setLogo(await onUploadLogo(file)), t("Détacher le logo du service"))}
        {logoField(t('service.calme.secondaryLogo'), secondaryLogo, setSecondaryLogo, async file => setSecondaryLogo(await onUploadLogo(file)), t("Détacher le logo secondaire"))}
        {saveError && <p className="ndc-dialog-hint" style={{ color: 'var(--nd-red)' }}>{saveError}</p>}
      </CalmeDialog>
    </div>
  );
}
