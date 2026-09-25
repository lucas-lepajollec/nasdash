'use client';

import { useState } from 'react';
import { Category, Service } from '@/lib/types';
import { Trash2, ChevronDown, ChevronRight, Upload, Ban } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import CustomSelect from '../shared/CustomSelect';
import { Emoji } from '../shared/Emoji';
import EmojiPickerModal from './EmojiPickerModal';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeDialog, CalmeField } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSwitch } from './settings/shared/CalmeControls';

interface CategoryFormModalProps {
  category?: Category;
  onClose: () => void;
  onSave: (data: { title: string; emoji: string; isSecret: boolean; services: Service[]; layout?: Category['layout'] }) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
  showSecretSections: boolean;
  showSensitive: boolean;
}


export default function CategoryFormModal({ category, onClose, onSave, onDelete, showSecretSections, showSensitive }: CategoryFormModalProps) {
  const { t } = useI18n();
  const dialogRef = useDialogAccessibility(onClose);
  const { config } = useConfig();
  const demoMode = config?.demoMode === true;
  const [title, setTitle] = useState(category?.title || '');
  const [emoji, setEmoji] = useState(category?.emoji || '📁');
  const [isSecret, setIsSecret] = useState(category?.isSecret || false);
  const [services, setServices] = useState<Service[]>(
    category?.services?.map(s => ({
      ...s,
      secondaryUrl: s.secondaryUrl || s.tailscaleUrl || '',
      tailscaleUrl: undefined // Force removal of legacy field so it doesn't persist
    })) || []
  );
  const [layout, setLayout] = useState<Category['layout']>(
    category?.layout === 'grid' ? 'bento' : (category?.layout || 'standard')
  );
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
  
  const [deleteCategoryConfirm, setDeleteCategoryConfirm] = useState(false);
  const [deleteServiceConfirm, setDeleteServiceConfirm] = useState<string | null>(null);
  const [deleteLogoConfirm, setDeleteLogoConfirm] = useState<string | null>(null);
  const [pendingLogoDeletions, setPendingLogoDeletions] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setIsSaving(true);
    setSaveError('');
    try {
      for (const url of pendingLogoDeletions) {
        await fetch(url, { method: 'DELETE' }).catch(console.error);
      }
      await onSave({ title, emoji, isSecret, services, layout });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Impossible d’enregistrer cette catégorie.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateServiceField = (id: string, field: keyof Service, value: string) => {
    setServices(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const removeService = (id: string) => {
    setServices(services.filter(s => s.id !== id));
  };

  const handleUploadLogo = async (serviceId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      
      const svc = services.find(s => s.id === serviceId);
      if (svc?.logo?.startsWith('/api/logos/')) {
        setPendingLogoDeletions(prev => [...prev, svc.logo]);
      }

      updateServiceField(serviceId, 'logo', data.url);
    } catch (err) {
      console.error('Error uploading logo:', err);
      alert(t("Failed to upload logo."));
    }
  };

  const handleRemoveLogo = (serviceId: string) => {
    const svc = services.find(s => s.id === serviceId);
    if (svc?.logo?.startsWith('/api/logos/')) {
      setPendingLogoDeletions(prev => [...prev, svc.logo]);
    }
    updateServiceField(serviceId, 'logo', '');
  };

  return (
    <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <CalmeDialog
        dialogRef={dialogRef}
        label={category ? t("Modifier une catégorie") : t("Ajouter une catégorie")}
        title={t(category ? "Modifier une catégorie" : "Ajouter une catégorie")}
        subtitle={demoMode ? t("Modification temporaire sur données fictives. Les imports sont désactivés ; utilisez uniquement des URL de démonstration et ne saisissez aucune adresse personnelle.") : undefined}
        width={500}
        onClose={onClose}
        danger={category && onDelete && (
          <button type="button" className="nd-btn ndc-danger-ghost" onClick={() => setDeleteCategoryConfirm(true)}><Trash2 size={12} /> {t("Supprimer")}</button>
        )}
        footer={<>
          <button type="button" className="nd-btn" onClick={onClose}>{t("Annuler")}</button>
          <button type="button" className="nd-btn nd-btn-accent" onClick={handleSubmit} disabled={isSaving || !title.trim()}>
            {isSaving ? t("Enregistrement…") : category ? t("Enregistrer") : t("Ajouter")}
          </button>
        </>}
      >
        <div className="ndc-field-inline">
          <button type="button" className="ndc-icon-pick" onClick={() => setIsPickerOpen(true)} title={t("Sélectionner l'icône de la catégorie")} aria-label={t("Sélectionner l'icône de la catégorie")}>
            {emoji ? <Emoji emoji={emoji} /> : <Ban size={16} />}
          </button>
          <CalmeField label={t("Nom de la catégorie")} htmlFor="category-name">
            <input id="category-name" className="nd-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("Ex: Médias")} />
          </CalmeField>
        </div>
        <CalmeField label={t('category.calme.layout')} info={t('category.calme.layoutInfo')}>
          <CustomSelect
            value={layout || 'standard'}
            onChange={(val) => setLayout(val as Category['layout'])}
            options={[
              { value: 'standard', label: t('category.calme.list') },
              { value: 'compact', label: t('category.calme.compact') },
              { value: 'bento', label: t('category.calme.grid') },
              { value: 'bento-logo-large', label: t('category.calme.logosLarge') },
              { value: 'bento-logo-medium', label: t('category.calme.logosMedium') },
              { value: 'bento-logo-small', label: t('category.calme.logosSmall') },
            ]}
          />
        </CalmeField>
        {showSecretSections && (
          <CalmeRow label={t('category.calme.secret')} info={t('category.calme.secretInfo')}>
            <CalmeSwitch label={t('category.calme.secret')} checked={isSecret} onChange={setIsSecret} />
          </CalmeRow>
        )}
        {category && services.length > 0 && (
          <CalmeField label={t("Services rattachés")}>
            <div className="ndc-sub-list">
              {services.map(svc => {
                const open = expandedServiceId === svc.id;
                const isImage = svc.logo.startsWith('http') || svc.logo.startsWith('/');
                return (
                  <div key={svc.id} className={`ndc-sub-item ${open ? 'is-open' : ''}`}>
                    <button type="button" className="ndc-sub-head" aria-expanded={open} onClick={() => setExpandedServiceId(prev => prev === svc.id ? null : svc.id)}>
                      <span className="ndc-sub-logo">{isImage ? <img src={svc.logo} alt="" /> : svc.logo}</span>
                      <span className="ndc-sub-name">{svc.name}</span>
                      {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>
                    {open && (
                      <div className="ndc-sub-body">
                        <CalmeField label={t("Nom du service")}>
                          <input className="nd-input" value={svc.name} onChange={(e) => updateServiceField(svc.id, 'name', e.target.value)} />
                        </CalmeField>
                        <div className="ndc-field-grid">
                          <CalmeField label={t("URL Locale")}>
                            <input className="nd-input" type={!showSensitive ? 'password' : 'text'} value={svc.localUrl} onChange={(e) => updateServiceField(svc.id, 'localUrl', e.target.value)} />
                          </CalmeField>
                          <CalmeField label={t('service.calme.secondaryUrl')}>
                            <input className="nd-input" type={!showSensitive ? 'password' : 'text'} value={svc.secondaryUrl || ''} onChange={(e) => updateServiceField(svc.id, 'secondaryUrl', e.target.value)} />
                          </CalmeField>
                        </div>
                        <CalmeField label={t("Logo")}>
                          <div className="ndc-logo-field">
                            <input className="nd-input" value={svc.logo} onChange={(e) => updateServiceField(svc.id, 'logo', e.target.value)} placeholder={t("https://... ou emoji")} />
                            {!demoMode && (
                              <label className="ndc-icon-button" title={t("Upload")} style={{ cursor: 'pointer' }}>
                                <Upload size={14} />
                                <input type="file" accept=".png,.svg,.jpg,.jpeg,.webp,.ico" hidden onChange={(e) => { if (e.target.files?.[0]) handleUploadLogo(svc.id, e.target.files[0]); }} />
                              </label>
                            )}
                            {svc.logo?.startsWith('/api/logos/') && (
                              <button type="button" className="ndc-icon-button ndc-icon-danger" onClick={() => setDeleteLogoConfirm(svc.id)} title={t("Supprimer le logo local")} aria-label={t("Supprimer le logo local")}><Trash2 size={13} /></button>
                            )}
                          </div>
                        </CalmeField>
                        <CalmeField label={t('service.calme.secondaryLogo')}>
                          <div className="ndc-logo-field">
                            <input className="nd-input" value={svc.secondaryLogo || ''} onChange={(e) => updateServiceField(svc.id, 'secondaryLogo', e.target.value)} placeholder={t("https://... ou fichier")} />
                            {!demoMode && (
                              <label className="ndc-icon-button" title={t("Upload")} style={{ cursor: 'pointer' }}>
                                <Upload size={14} />
                                <input type="file" accept=".png,.svg,.jpg,.jpeg,.webp,.ico" hidden onChange={async (e) => {
                                  if (!e.target.files?.[0]) return;
                                  const formData = new FormData();
                                  formData.append('file', e.target.files[0]);
                                  const res = await fetch('/api/upload', { method: 'POST', body: formData });
                                  const data = await res.json();
                                  updateServiceField(svc.id, 'secondaryLogo', data.url);
                                }} />
                              </label>
                            )}
                            {svc.secondaryLogo?.startsWith('/api/logos/') && (
                              <button type="button" className="ndc-icon-button ndc-icon-danger" onClick={() => updateServiceField(svc.id, 'secondaryLogo', '')} title={t("Supprimer le logo secondaire")} aria-label={t("Supprimer le logo secondaire")}><Trash2 size={13} /></button>
                            )}
                          </div>
                        </CalmeField>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button type="button" className="nd-btn ndc-danger-ghost" onClick={(e) => { e.stopPropagation(); setDeleteServiceConfirm(svc.id); }}>
                            <Trash2 size={12} /> {t("Supprimer le service")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CalmeField>
        )}
        {saveError && <p className="ndc-dialog-hint" style={{ color: 'var(--nd-red)' }}>{saveError}</p>}
      </CalmeDialog>

      <ConfirmModal
        isOpen={deleteCategoryConfirm}
        onClose={() => setDeleteCategoryConfirm(false)}
        onConfirm={() => category && onDelete && onDelete(category.id)}
        title={t("Supprimer la catégorie ?")}
        description={category ? t('confirm.categoryDelete', { name: category.title }) : ''}
      />

      <ConfirmModal
        isOpen={deleteServiceConfirm !== null}
        onClose={() => setDeleteServiceConfirm(null)}
        onConfirm={() => {
          if (deleteServiceConfirm) removeService(deleteServiceConfirm);
        }}
        title={t("Supprimer le service ?")}
        description={t('confirm.serviceDelete', { name: services.find(s => s.id === deleteServiceConfirm)?.name || '' })}
      />

      <ConfirmModal
        isOpen={deleteLogoConfirm !== null}
        onClose={() => setDeleteLogoConfirm(null)}
        onConfirm={() => {
          if (deleteLogoConfirm) handleRemoveLogo(deleteLogoConfirm);
        }}
        title={t("Supprimer le logo ?")}
        description={t("Voulez-vous vraiment retirer le logo de ce service ? L'image sera définitivement supprimée lors de la sauvegarde.")}
      />

      {isPickerOpen && (
        <EmojiPickerModal
          initialEmoji={emoji}
          onSelect={(newEmoji) => setEmoji(newEmoji)}
          onClose={() => setIsPickerOpen(false)}
          allowNone={false}
          title={t("Sélectionner l'icône de la catégorie")}
        />
      )}
    </div>
  );
}
