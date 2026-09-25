import React, { useState, useEffect } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { AppearanceProfile } from '@/lib/types';
import ConfirmModal from '../../ConfirmModal';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeAppearance } from './CalmeAppearance';

interface AppearanceTabProps {
  onOpenThemeGallery?: (tab: 'themes' | 'emojis') => void;
  /** The wallpaper has its own section. */
  part?: 'appearance' | 'wallpaper';
}

export function AppearanceTab({ onOpenThemeGallery, part = 'appearance' }: AppearanceTabProps = {}) {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();
  // Local States initialized from Config
  const [mode, setMode] = useState<'light' | 'dark'>('dark');
  const [theme, setTheme] = useState('nasdash');
  const [backgroundImage, setBackgroundImage] = useState('');
  
  const [uploadedBgs, setUploadedBgs] = useState<{ name: string; url: string }[]>([]);
  const [bgToDelete, setBgToDelete] = useState<string | null>(null);

  // Appearance Profiles
  const [appearanceProfiles, setAppearanceProfiles] = useState<AppearanceProfile[]>([]);

  // Delete Confirmations
  const [confirmDeleteProfile, setConfirmDeleteProfile] = useState<string | null>(null);
  const [isConfirmBgDeleteOpen, setIsConfirmBgDeleteOpen] = useState(false);

  // Design system states
  const [globalFont, setGlobalFont] = useState('Outfit');
  const [borderRadius, setBorderRadius] = useState(12);
  const [cardOpacity, setCardOpacity] = useState(0.8);

  useEffect(() => {
    if (config) {
      setTheme(config.settings?.theme || 'nasdash');
      setGlobalFont(config.settings?.globalFont || 'Outfit');
      setBorderRadius(config.settings?.borderRadius ?? 12);
      setCardOpacity(config.settings?.cardOpacity ?? 0.8);
      
      if (config.settings?.backgroundImage !== undefined) setBackgroundImage(config.settings.backgroundImage);
      if (config.appearanceProfiles) setAppearanceProfiles(config.appearanceProfiles);
    }
  }, [config]);

  useEffect(() => {
    if (document.body.classList.contains('light')) {
      setMode('light');
    } else {
      setMode('dark');
    }
  }, []);

  const toggleMode = async () => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    setMode(newMode);
    if (newMode === 'light') {
      document.body.classList.add('light');
      localStorage.setItem('nd-theme', 'light');
    } else {
      document.body.classList.remove('light');
      localStorage.setItem('nd-theme', 'dark');
    }
    await updateConfig({ mode: newMode });
  };

  const handleThemeChange = async (newTheme: string) => {
    setTheme(newTheme);
    const LIGHT_THEMES = ['apple-light', 'github-light', 'rose-pine-dawn', 'solarized-light', 'catppuccin-latte', 'everforest-light', 'tokyo-night-day', 'gruvbox-light', 'nord-light', 'light'];
    const isLight = LIGHT_THEMES.includes(newTheme) || (newTheme === 'nasdash' && mode === 'light');

    const classesToRemove = Array.from(document.body.classList).filter(cls => cls.startsWith('theme-'));
    classesToRemove.forEach(cls => document.body.classList.remove(cls));
    if (newTheme !== 'nasdash') {
      document.body.classList.add(`theme-${newTheme}`);
    }

    if (isLight) {
      document.body.classList.add('light');
      setMode('light');
      localStorage.setItem('nd-theme', 'light');
    } else {
      document.body.classList.remove('light');
      setMode('dark');
      localStorage.setItem('nd-theme', 'dark');
    }
    await updateConfig({ theme: newTheme });
  };

  const fetchUploadedBgs = async () => {
    try {
      const params = new URLSearchParams();
      params.append('type', 'background');
      if (backgroundImage) params.append('current', backgroundImage);

      const res = await fetch(`/api/logos?${params.toString()}`);
      const data = await res.json();
      if (data && data.files) {
        setUploadedBgs(data.files);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUploadedBgs();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFontChange = async (font: string) => {
    setGlobalFont(font);
    await updateConfig({ globalFont: font });
  };

  const handleRadiusChange = (val: number) => {
    setBorderRadius(val);
    document.body.style.setProperty('--nd-card-radius', `${val}px`);
  };

  const handleRadiusSave = async (val: number) => {
    await updateConfig({ borderRadius: val });
  };

  const handleOpacityChange = (val: number) => {
    setCardOpacity(val);
    document.body.style.setProperty('--nd-card-bg-opacity', String(val));
    const rgb = getComputedStyle(document.body).getPropertyValue('--nd-card-bg-rgb').trim();
    if (rgb) {
      document.body.style.setProperty('--nd-card-bg', `rgba(${rgb}, ${val})`);
    }
  };

  const handleOpacitySave = async (val: number) => {
    await updateConfig({ cardOpacity: val });
  };

  const handleSaveBackground = async () => {
    await updateConfig({ backgroundImage });
  };

  const handleConfirmBgDelete = async () => {
    const targetUrl = bgToDelete || backgroundImage;
    if (targetUrl && targetUrl.startsWith('/api/logos/')) {
      const filename = targetUrl.replace('/api/logos/', '');
      try {
        await fetch(`/api/logos/${filename}`, { method: 'DELETE' });
      } catch (err) {
        console.error('Failed to delete background file:', err);
      }
    }
    
    if (targetUrl === backgroundImage) {
      setBackgroundImage('');
      await updateConfig({ backgroundImage: '' });
    }

    fetchUploadedBgs();
    setBgToDelete(null);
    setIsConfirmBgDeleteOpen(false);
  };

  const handleApplyProfile = async (profile: AppearanceProfile) => {
    const { settings } = profile;
    if (settings.theme !== undefined) setTheme(settings.theme);
    if (settings.backgroundImage !== undefined) setBackgroundImage(settings.backgroundImage);
    if (settings.globalFont !== undefined) setGlobalFont(settings.globalFont);
    if (settings.borderRadius !== undefined) setBorderRadius(settings.borderRadius);
    if (settings.cardOpacity !== undefined) setCardOpacity(settings.cardOpacity);

    
    await updateConfig(settings);
  };

  const uploadBackground = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'background');
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        setBackgroundImage(data.url);
        await updateConfig({ backgroundImage: data.url });
        fetchUploadedBgs();
      }
    } catch (err) {
      console.error('Failed to upload background:', err);
    }
  };

  const pickBackground = (url: string) => {
    const img = new Image();
    img.src = url;
    img.onload = async () => {
      setBackgroundImage(url);
      await updateConfig({ backgroundImage: url });
    };
  };

  const handleDeleteProfile = async (id: string) => {
    const updatedProfiles = appearanceProfiles.filter(p => p.id !== id);
    setAppearanceProfiles(updatedProfiles);
    await updateConfig({ appearanceProfiles: updatedProfiles });
    setConfirmDeleteProfile(null);
  };

  const confirmDialogs = (
    <>
      <ConfirmModal
        isOpen={!!confirmDeleteProfile}
        onClose={() => setConfirmDeleteProfile(null)}
        onConfirm={() => {
          if (confirmDeleteProfile) handleDeleteProfile(confirmDeleteProfile);
        }}
        title={t("Supprimer le profil")}
        description={t("Êtes-vous sûr de vouloir supprimer ce profil d'apparence ? Cette action est irréversible.")}
        confirmLabel="Supprimer"
      />

      <ConfirmModal
        isOpen={isConfirmBgDeleteOpen}
        onClose={() => setIsConfirmBgDeleteOpen(false)}
        onConfirm={handleConfirmBgDelete}
        title={t("Supprimer l'image de fond")}
        description={t("Êtes-vous sûr de vouloir supprimer cette image ? Elle sera supprimée du serveur.")}
        confirmLabel="Supprimer"
      />
    </>
  );

  return (
    <>
      <CalmeAppearance
        part={part}
        theme={theme}
        mode={mode}
        onThemeChange={handleThemeChange}
        onToggleMode={toggleMode}
        onOpenThemeGallery={onOpenThemeGallery}
        globalFont={globalFont}
        onFontChange={handleFontChange}
        borderRadius={borderRadius}
        onRadiusChange={handleRadiusChange}
        onRadiusSave={handleRadiusSave}
        cardOpacity={cardOpacity}
        onOpacityChange={handleOpacityChange}
        onOpacitySave={handleOpacitySave}
        backgroundImage={backgroundImage}
        setBackgroundImage={setBackgroundImage}
        onSaveBackground={handleSaveBackground}
        onClearBackground={async () => { setBackgroundImage(''); await updateConfig({ backgroundImage: '' }); }}
        uploadedBgs={uploadedBgs}
        onPickBackground={pickBackground}
        onRequestBackgroundDelete={url => { setBgToDelete(url); setIsConfirmBgDeleteOpen(true); }}
        onUploadBackground={uploadBackground}
        profiles={appearanceProfiles}
        onSaveProfile={async name => {
          if (!name.trim()) return;
          const updated = [...appearanceProfiles, { id: Date.now().toString(), name, settings: { theme, backgroundImage, globalFont, borderRadius, cardOpacity } }];
          setAppearanceProfiles(updated);
          await updateConfig({ appearanceProfiles: updated });
        }}
        onApplyProfile={handleApplyProfile}
        onRequestProfileDelete={setConfirmDeleteProfile}
      />
      {confirmDialogs}
    </>
  );
}
