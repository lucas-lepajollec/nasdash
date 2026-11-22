import React, { useState, useEffect } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { AppearanceProfile } from '@/lib/types';
import CustomSelect from '../../../shared/CustomSelect';
import { THEME_PRESETS } from '../../SettingsModal';

import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';
import { useI18n } from '@/i18n/I18nProvider';
import { Plus, X } from 'lucide-react';
import { CalmeHeading, CalmeRow, CalmeSlider } from '../shared/CalmeControls';

export function MobileTab() {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();
  const demoMode = config?.demoMode === true;
  
  // Local States initialized from Config
  const [mobileWallpaper, setMobileWallpaper] = useState('');
  
  const [mobileTheme, setMobileTheme] = useState('');
  const [mobileGlobalFont, setMobileGlobalFont] = useState('');
  const [mobileBorderRadius, setMobileBorderRadius] = useState<number | ''>('');
  const [mobileCardOpacity, setMobileCardOpacity] = useState<number | ''>('');
  

  const [uploadedBgs, setUploadedBgs] = useState<{ name: string; url: string }[]>([]);
  const [bgToDelete, setBgToDelete] = useState<string | null>(null);

  // Appearance Profiles
  const [mobileAppearanceProfiles, setMobileAppearanceProfiles] = useState<AppearanceProfile[]>([]);
  const [newMobileProfileName, setNewMobileProfileName] = useState('');

  // Delete Confirmations
  const [confirmDeleteMobileProfile, setConfirmDeleteMobileProfile] = useState<string | null>(null);
  const [isConfirmBgDeleteOpen, setIsConfirmBgDeleteOpen] = useState(false);
  const profileDeleteDialogRef = useDialogAccessibility(
    () => setConfirmDeleteMobileProfile(null),
    Boolean(confirmDeleteMobileProfile),
  );
  const backgroundDeleteDialogRef = useDialogAccessibility(
    () => { setIsConfirmBgDeleteOpen(false); setBgToDelete(null); },
    isConfirmBgDeleteOpen,
  );

  useEffect(() => {
    if (config) {
      if (config.settings?.mobileWallpaper !== undefined) setMobileWallpaper(config.settings.mobileWallpaper);
      if (config.settings?.mobileTheme !== undefined) setMobileTheme(config.settings.mobileTheme);
      if (config.settings?.mobileGlobalFont !== undefined) setMobileGlobalFont(config.settings.mobileGlobalFont);
      if (config.settings?.mobileBorderRadius !== undefined) setMobileBorderRadius(config.settings.mobileBorderRadius);
      if (config.settings?.mobileCardOpacity !== undefined) setMobileCardOpacity(config.settings.mobileCardOpacity);
      if (config.settings?.mobileAppearanceProfiles) setMobileAppearanceProfiles(config.settings.mobileAppearanceProfiles);
    }
  }, [config]);

  const fetchUploadedBgs = async () => {
    try {
      const params = new URLSearchParams();
      params.append('type', 'background');
      if (mobileWallpaper) params.append('currentMobile', mobileWallpaper);

      const res = await fetch(`/api/logos?${params.toString()}`);
      const data = await res.json();
      if (data && data.files) {
        setUploadedBgs(data.files);
      }
    } catch (err) {
      console.error('Failed to fetch background images:', err);
    }
  };

  useEffect(() => {
    fetchUploadedBgs();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveMobileWallpaper = async () => {
    await updateConfig({ mobileWallpaper });
  };

  const handleConfirmBgDelete = async () => {
    const targetUrl = bgToDelete || mobileWallpaper;
    if (targetUrl && targetUrl.startsWith('/api/logos/')) {
      const filename = targetUrl.replace('/api/logos/', '');
      try {
        await fetch(`/api/logos/${filename}`, { method: 'DELETE' });
      } catch (err) {
        console.error('Failed to delete background file:', err);
      }
    }
    
    if (targetUrl === mobileWallpaper) {
      setMobileWallpaper('');
      await updateConfig({ mobileWallpaper: '' });
    }

    fetchUploadedBgs();
    setBgToDelete(null);
    setIsConfirmBgDeleteOpen(false);
  };

  const handleSaveMobileProfile = async () => {
    if (!newMobileProfileName.trim()) return;
    const newProfile: AppearanceProfile = {
      id: Date.now().toString(),
      name: newMobileProfileName,
      settings: {
        mobileTheme, mobileWallpaper, mobileGlobalFont,
        mobileBorderRadius: typeof mobileBorderRadius === 'number' ? mobileBorderRadius : undefined,
        mobileCardOpacity: typeof mobileCardOpacity === 'number' ? mobileCardOpacity : undefined,
      }
    };
    const updatedProfiles = [...mobileAppearanceProfiles, newProfile];
    setMobileAppearanceProfiles(updatedProfiles);
    setNewMobileProfileName('');
    await updateConfig({ mobileAppearanceProfiles: updatedProfiles });
  };

  const handleApplyMobileProfile = async (profile: AppearanceProfile) => {
    const { settings } = profile;
    if (settings.mobileTheme !== undefined) setMobileTheme(settings.mobileTheme);
    if (settings.mobileWallpaper !== undefined) setMobileWallpaper(settings.mobileWallpaper);
    if (settings.mobileGlobalFont !== undefined) setMobileGlobalFont(settings.mobileGlobalFont);
    if (settings.mobileBorderRadius !== undefined) setMobileBorderRadius(settings.mobileBorderRadius);
    if (settings.mobileCardOpacity !== undefined) setMobileCardOpacity(settings.mobileCardOpacity);
    
    await updateConfig(settings);
  };

  const handleDeleteMobileProfile = async (id: string) => {
    const updatedProfiles = mobileAppearanceProfiles.filter(p => p.id !== id);
    setMobileAppearanceProfiles(updatedProfiles);
    await updateConfig({ mobileAppearanceProfiles: updatedProfiles });
    setConfirmDeleteMobileProfile(null);
  };

  const [addingProfile, setAddingProfile] = useState(false);
  const inherit = t("Hériter de Desktop");
  const uploadMobileWallpaper = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'background');
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        setMobileWallpaper(data.url);
        await updateConfig({ mobileWallpaper: data.url });
        fetchUploadedBgs();
      }
    } catch (err) {
      console.error('Failed to upload background:', err);
    }
  };
  return (
    <div className="ndc-set-page">

      <section className="ndc-set-block">
        <CalmeHeading info={t("Surchargez les paramètres globaux (thème, fond, géométrie)")}>{t('settings.calme.mobileLook')}</CalmeHeading>
        <CalmeRow label={t('settings.calme.theme')}>
          <div style={{ width: 220 }}>
            <CustomSelect
              ariaLabel={t('settings.calme.theme')}
              value={mobileTheme}
              onChange={(val: string) => { setMobileTheme(val); updateConfig({ mobileTheme: val }); }}
              options={[{ value: '', label: inherit }, ...Object.keys(THEME_PRESETS).map(themeKey => ({ value: themeKey, label: t(THEME_PRESETS[themeKey].name) }))]}
            />
          </div>
        </CalmeRow>
        <CalmeRow label={t('settings.calme.font')}>
          <div style={{ width: 220 }}>
            <CustomSelect
              ariaLabel={t('settings.calme.font')}
              value={mobileGlobalFont}
              onChange={(val: string) => { setMobileGlobalFont(val); updateConfig({ mobileGlobalFont: val }); }}
              options={[{ value: '', label: inherit }, ...['Outfit', 'Inter', 'Poppins', 'Rubik', 'Ubuntu', 'Lexend', 'JetBrains Mono', 'Fira Code', 'Source Code Pro', 'Montserrat', 'Roboto'].map(font => ({ value: font, label: font }))]}
            />
          </div>
        </CalmeRow>
        <CalmeRow label={t('settings.calme.radius')} info={t('settings.calme.inheritHint')}>
          <CalmeSlider
            label={t('settings.calme.radius')}
            value={mobileBorderRadius === '' ? -1 : mobileBorderRadius}
            min={-1} max={24} step={1}
            onChange={value => setMobileBorderRadius(value < 0 ? '' : value)}
            onCommit={value => updateConfig({ mobileBorderRadius: value < 0 ? null : value })}
            format={value => value < 0 ? t("Hérité") : `${value} px`}
          />
        </CalmeRow>
        <CalmeRow label={t('settings.calme.opacity')} info={t('settings.calme.inheritHint')}>
          <CalmeSlider
            label={t('settings.calme.opacity')}
            value={mobileCardOpacity === '' ? -0.05 : mobileCardOpacity}
            min={-0.05} max={1} step={0.05}
            onChange={value => setMobileCardOpacity(value < 0 ? '' : value)}
            onCommit={value => updateConfig({ mobileCardOpacity: value < 0 ? null : value })}
            format={value => value < 0 ? t("Hérité") : `${Math.round(value * 100)} %`}
          />
        </CalmeRow>
      </section>

      <section className="ndc-set-block">
        <CalmeHeading
          info={demoMode ? t("Import de fond mobile désactivé dans la démo publique.") : undefined}
          action={!demoMode && (
            <label className="ndc-text-button" style={{ cursor: 'pointer' }}>
              <Plus size={12} style={{ verticalAlign: -2 }} /> {t('settings.calme.importImage')}
              <input type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadMobileWallpaper(file); e.target.value = ''; }} />
            </label>
          )}
        >{t('settings.calme.mobileWallpaper')}</CalmeHeading>
        <div className="ndc-field">
          <input type="text" className="nd-input" placeholder="https://…" value={mobileWallpaper} onChange={(e) => setMobileWallpaper(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveMobileWallpaper(); }} aria-label={t('settings.calme.mobileWallpaper')} />
          <button type="button" className="nd-btn" onClick={handleSaveMobileWallpaper}>{t("Enregistrer")}</button>
          {mobileWallpaper && <button type="button" className="ndc-icon-button" aria-label={t("Effacer")} title={t("Effacer")} onClick={async () => { setMobileWallpaper(''); await updateConfig({ mobileWallpaper: '' }); }}><X size={14} /></button>}
        </div>
        {uploadedBgs.length > 0 && (
          <div className="ndc-wallpapers" style={{ marginTop: 12 }}>
            {uploadedBgs.map(bg => (
              <div
                key={bg.name}
                role="button"
                tabIndex={0}
                aria-pressed={mobileWallpaper === bg.url}
                className="ndc-wallpaper"
                style={{ backgroundImage: `url("${bg.url}")` }}
                title={bg.name}
                onClick={async () => { setMobileWallpaper(bg.url); await updateConfig({ mobileWallpaper: bg.url }); }}
                onKeyDown={async (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMobileWallpaper(bg.url); await updateConfig({ mobileWallpaper: bg.url }); } }}
              >
                <button type="button" className="ndc-wallpaper-remove" aria-label={t("Supprimer l’image")} onClick={(e) => { e.stopPropagation(); setBgToDelete(bg.url); setIsConfirmBgDeleteOpen(true); }}><X size={11} /></button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="ndc-set-block">
        <CalmeHeading
          info={t("Sauvegardez votre configuration mobile.")}
          action={!addingProfile && <button type="button" className="ndc-text-button" onClick={() => setAddingProfile(true)}><Plus size={12} style={{ verticalAlign: -2 }} /> {t('settings.calme.saveCurrent')}</button>}
        >{t('settings.calme.profiles')}</CalmeHeading>
        {addingProfile && (
          <div className="ndc-field" style={{ marginBottom: 6 }}>
            <input autoFocus type="text" className="nd-input" placeholder={t('settings.calme.profileName')} aria-label={t('settings.calme.profileName')} value={newMobileProfileName} onChange={(e) => setNewMobileProfileName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newMobileProfileName.trim()) { void handleSaveMobileProfile(); setAddingProfile(false); } if (e.key === 'Escape') setAddingProfile(false); }} />
            <button type="button" className="nd-btn nd-btn-accent" disabled={!newMobileProfileName.trim()} onClick={() => { void handleSaveMobileProfile(); setAddingProfile(false); }}>{t("Sauvegarder")}</button>
            <button type="button" className="ndc-icon-button" aria-label={t("Annuler")} onClick={() => setAddingProfile(false)}><X size={14} /></button>
          </div>
        )}
        {mobileAppearanceProfiles.length === 0 && !addingProfile && <div className="ndc-set-empty">{t('settings.calme.noProfile')}</div>}
        {mobileAppearanceProfiles.map(profile => (
          <CalmeRow key={profile.id} label={profile.name} value={[profile.settings.mobileTheme || t("Hérité"), profile.settings.mobileGlobalFont || t("Hérité")].join(' · ')}>
            <button type="button" className="nd-btn" onClick={() => handleApplyMobileProfile(profile)}>{t("Appliquer")}</button>
            <button type="button" className="ndc-icon-button" aria-label={t("Supprimer le profil mobile")} title={t("Supprimer le profil mobile")} onClick={() => setConfirmDeleteMobileProfile(profile.id)}><X size={14} /></button>
          </CalmeRow>
        ))}
      </section>
      {confirmDeleteMobileProfile && (
        <div className="nd-modal-overlay" style={{ zIndex: 1000002 }}>
          <div ref={profileDeleteDialogRef} role="dialog" aria-modal="true" aria-label={t("Supprimer le profil mobile")} tabIndex={-1} className="nd-modal" style={{ maxWidth: 400 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: 'var(--nd-red)' }}>{t("Supprimer le profil mobile ?")}</h3>
            <p style={{ margin: '0 0 24px 0', fontSize: '0.85rem', color: 'var(--nd-text-muted)' }}>{t("Êtes-vous sûr de vouloir supprimer ce profil d&apos;apparence mobile ?")}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="nd-btn" onClick={() => setConfirmDeleteMobileProfile(null)}>{t("Annuler")}</button>
              <button className="nd-btn nd-btn-danger" onClick={() => handleDeleteMobileProfile(confirmDeleteMobileProfile)}>{t("Oui, supprimer")}</button>
            </div>
          </div>
        </div>
      )}

      {isConfirmBgDeleteOpen && (
        <div className="nd-modal-overlay" style={{ zIndex: 1000002 }}>
          <div ref={backgroundDeleteDialogRef} role="dialog" aria-modal="true" aria-label={t("Supprimer l’image")} tabIndex={-1} className="nd-modal" style={{ maxWidth: 400 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: 'var(--nd-red)' }}>{t("Supprimer l&apos;image ?")}</h3>
            <p style={{ margin: '0 0 24px 0', fontSize: '0.85rem', color: 'var(--nd-text-muted)', lineHeight: 1.5 }}>
              {t("Êtes-vous sûr de vouloir supprimer cette image ? Si elle est utilisée, elle disparaîtra.")}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="nd-btn" onClick={() => { setIsConfirmBgDeleteOpen(false); setBgToDelete(null); }}>{t("Annuler")}</button>
              <button className="nd-btn nd-btn-danger" onClick={handleConfirmBgDelete}>{t("Oui, supprimer")}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
