import React, { useState, useEffect } from 'react';
import { Palette, Layout, Layers, Monitor, X, Trash2, Type, Languages } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { AppearanceProfile } from '@/lib/types';
import CustomSelect from '../../../shared/CustomSelect';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import ConfirmModal from '../../ConfirmModal';
import { THEME_PRESETS } from '../../SettingsModal';
import ThemeGalleryView, { THEME_GALLERY } from '../../ThemeGalleryView';
import { SettingsAccordion } from '../shared/SettingsAccordion';
import { Emoji } from '../../../shared/Emoji';
import { useI18n } from '@/i18n/I18nProvider';
import { LanguageTab } from './LanguageTab';

interface AppearanceTabProps {
  onOpenThemeGallery?: (tab: 'themes' | 'emojis') => void;
}

export function AppearanceTab({ onOpenThemeGallery }: AppearanceTabProps = {}) {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();
  const demoMode = config?.demoMode === true;
  
  // Accordions states
  const [openAccordions, setOpenAccordions] = useState<string[]>(['language']);

  const toggleAccordion = (id: string) => {
    setOpenAccordions(prev => prev.includes(id) ? [] : [id]);
  };

  // Local States initialized from Config
  const [mode, setMode] = useState<'light' | 'dark'>('dark');
  const [theme, setTheme] = useState('nasdash');
  const [backgroundImage, setBackgroundImage] = useState('');
  
  const [uploadedBgs, setUploadedBgs] = useState<{ name: string; url: string }[]>([]);
  const [bgToDelete, setBgToDelete] = useState<string | null>(null);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  // Appearance Profiles
  const [appearanceProfiles, setAppearanceProfiles] = useState<AppearanceProfile[]>([]);
  const [newProfileName, setNewProfileName] = useState('');

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

  const currentThemeObj = THEME_GALLERY.find(t => t.key === theme) || THEME_GALLERY[0];

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

  const handleSaveProfile = async () => {
    if (!newProfileName.trim()) return;
    const newProfile: AppearanceProfile = {
      id: Date.now().toString(),
      name: newProfileName,
      settings: { theme, backgroundImage, globalFont, borderRadius, cardOpacity }
    };
    const updatedProfiles = [...appearanceProfiles, newProfile];
    setAppearanceProfiles(updatedProfiles);
    setNewProfileName('');
    await updateConfig({ appearanceProfiles: updatedProfiles });
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

  const handleDeleteProfile = async (id: string) => {
    const updatedProfiles = appearanceProfiles.filter(p => p.id !== id);
    setAppearanceProfiles(updatedProfiles);
    await updateConfig({ appearanceProfiles: updatedProfiles });
    setConfirmDeleteProfile(null);
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SettingsAccordion
          title={t('settings.languageTitle')}
          description={t('settings.languageDescription')}
          icon={<Languages size={18} />}
          isOpen={openAccordions.includes('language')}
          onToggle={() => toggleAccordion('language')}
        >
          <LanguageTab embedded />
        </SettingsAccordion>

        {/* Appearance Profiles */}
        <SettingsAccordion
          title={t("Profils, Thèmes & Emojis")}
          description={t("Thèmes visuels, style d'émojis globaux et profils d'apparence")}
          icon={<Palette size={18} />}
          isOpen={openAccordions.includes('theme')}
          onToggle={() => toggleAccordion('theme')}
        >
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 10 }}>
              <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700 }}>{t("Thème Actif")}</h4>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--nd-text-muted)' }}>
                {t(currentThemeObj.name)} — {t(currentThemeObj.description)}
              </p>
            </div>

            <div 
              onClick={() => {
                if (onOpenThemeGallery) {
                  onOpenThemeGallery('themes');
                } else {
                  setIsThemeModalOpen(true);
                }
              }}
              style={{
                padding: '12px 14px',
                borderRadius: 14,
                border: '1px solid var(--nd-card-border)',
                background: 'var(--nd-subcard-bg)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--nd-accent)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--nd-card-border)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  display: 'flex',
                  gap: 4,
                  padding: 4,
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.2)'
                }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: currentThemeObj.bg, border: '1px solid #fff' }} />
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: currentThemeObj.cardBg, border: '1px solid #fff' }} />
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: currentThemeObj.text, border: '1px solid #fff' }} />
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: currentThemeObj.accent, border: '1px solid #fff' }} />
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--nd-text)' }}>
                  {currentThemeObj.name}
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--nd-accent)', fontWeight: 600 }}>
                {t("Ouvrir la galerie →")}
              </span>
            </div>
          </div>

          {theme === 'nasdash' && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>{t("Mode d'affichage")}</h4>
                </div>
                <button className="nd-btn" onClick={toggleMode} style={{ flexShrink: 0, whiteSpace: 'nowrap', padding: '6px 12px', fontSize: '0.75rem' }}>
                  {mode === 'light' ? t("☀️ Mode Clair") : t("🌙 Mode Sombre")}
                </button>
              </div>
            </div>
          )}

          {/* Style des Emojis / Icônes */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>
              <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>{t("Style des Emojis & Icônes")}</h4>
              <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--nd-text-muted)' }}>
                {t("Dans la galerie interactive, vous pouvez choisir entre plusieurs styles d'émojis ou les icônes Lucide.")}
              </p>
            </div>
            
            <div 
              onClick={() => {
                if (onOpenThemeGallery) {
                  onOpenThemeGallery('emojis');
                }
              }}
              style={{
                padding: '10px 14px',
                borderRadius: 14,
                border: '1px solid var(--nd-card-border)',
                background: 'var(--nd-subcard-bg)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--nd-accent)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--nd-card-border)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  display: 'flex',
                  gap: 6,
                  padding: '2px 8px',
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.2)',
                  alignItems: 'center'
                }}>
                  <Emoji emoji="🏠" />
                  <Emoji emoji="🐳" />
                  <Emoji emoji="🖥️" />
                  <Emoji emoji="🚀" />
                </div>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--nd-text)' }}>
                  {(() => {
                    const theme = config?.settings?.emojiTheme || 'native';
                    if (theme === 'twemoji') return 'Twemoji (Twitter)';
                    if (theme === 'blobmoji') return 'Blobmoji (Google)';
                    if (theme === 'openmoji') return 'OpenMoji (Dessiné)';
                    if (theme === 'lucide') return 'Icônes Vectorielles (Lucide)';
                    return 'Native (Système)';
                  })()}
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--nd-accent)', fontWeight: 600 }}>
                {t("Ouvrir la galerie →")}
              </span>
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 16 }}>
            <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>{t("Profils d'Apparence")}</h4>
            <p style={{ margin: '4px 0 12px 0', fontSize: '0.7rem', color: 'var(--nd-text-muted)' }}>
              {t("Sauvegardez votre configuration esthétique actuelle.")}
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                type="text"
                className="nd-input"
                placeholder={t("Nom du nouveau profil...")}
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                style={{ flex: 1, fontSize: '0.75rem', padding: '6px 10px' }}
              />
              <button className="nd-btn" onClick={handleSaveProfile} disabled={!newProfileName.trim()} style={{ padding: '6px 10px', fontSize: '0.75rem' }}>
                {t("Sauvegarder")}
              </button>
            </div>

            {appearanceProfiles.length > 0 && (
              <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr' }}>
                {appearanceProfiles.map(profile => (
                  <div key={profile.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', background: 'var(--nd-card-bg)', padding: '12px 16px', borderRadius: 'var(--nd-card-radius)', border: '1px solid var(--nd-card-border)' }}>
                    <div style={{ minWidth: '120px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--nd-text)', wordBreak: 'break-word' }}>{profile.name}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)', display: 'block', marginTop: 4, wordBreak: 'break-all' }}>{profile.settings.theme}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button className="nd-btn" onClick={() => handleApplyProfile(profile)} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                        {t("Appliquer")}
                      </button>
                      <button 
                        type="button"
                        className="nd-btn nd-btn-danger"
                        onClick={() => setConfirmDeleteProfile(profile.id)} 
                        style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                        title={t("Supprimer le profil")}
                      >
                        <Trash2 size={13} /> {t("Supprimer")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SettingsAccordion>

        {/* Custom Fixed Background Upload */}
        <SettingsAccordion
          title={t("Fonds d'écran")}
          description={t("Images de fond et galerie personnalisée")}
          icon={<Palette size={18} />}
          isOpen={openAccordions.includes('backgrounds')}
          onToggle={() => toggleAccordion('backgrounds')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)', marginLeft: 2 }}>{t("Image de fond (Desktop & Tablette Paysage)")}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="nd-input"
                  placeholder={t("https://example.com/background.jpg ou fichier importé")}
                  value={backgroundImage}
                  onChange={(e) => setBackgroundImage(e.target.value)}
                  style={{ flex: 1, fontSize: '0.78rem' }}
                />
                <button className="nd-btn" onClick={handleSaveBackground} style={{ padding: '6px 14px', fontSize: '0.75rem' }}>
                  {t("Enregistrer")}
                </button>
                {backgroundImage && (
                  <button className="nd-btn" onClick={async () => { setBackgroundImage(''); await updateConfig({ backgroundImage: '' }); }} style={{ padding: '6px 10px', fontSize: '0.75rem', color: 'var(--nd-red)', background: 'rgba(239, 68, 68, 0.1)' }}>
                    {t("Effacer")}
                  </button>
                )}
              </div>
            </div>
            
            {demoMode ? (
              <div style={{ fontSize: '0.68rem', color: 'var(--nd-text-muted)' }}>{t("L&apos;import de fichiers est désactivé dans la démo publique. Vous pouvez tester une URL d&apos;image fictive ; elle ne sera conservée que dans cette session.")}</div>
            ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="file"
                accept="image/*"
                id="bg-upload-input"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  const formData = new FormData();
                  formData.append('file', file);
                  formData.append('type', 'background');

                  try {
                    const res = await fetch('/api/upload', { method: 'POST', body: formData });
                    const data = await res.json();
                    if (data.url) {
                      const img = new Image();
                      img.src = data.url;
                      img.onload = async () => {
                        setBackgroundImage(data.url);
                        await updateConfig({ backgroundImage: data.url });
                        fetchUploadedBgs();
                      };
                    }
                  } catch (err) {
                    console.error('Failed to upload background:', err);
                  }
                }}
                style={{ display: 'none' }}
              />
              <label htmlFor="bg-upload-input" className="nd-btn" style={{ padding: '6px 12px', fontSize: '0.72rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--nd-card-border)' }}>
                {t("📁 Importer une image (Auto-Détection)")}
              </label>
            </div>
            )}

            {uploadedBgs.length > 0 && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed var(--nd-card-border)' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--nd-text-muted)', display: 'block', marginBottom: '8px' }}>
                  {t('appearance.importedBackgrounds', { count: uploadedBgs.length })}
                </span>
                <div 
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', 
                    gap: '8px',
                    maxHeight: '180px',
                    overflowY: 'auto',
                    paddingRight: '4px'
                  }}
                >
                  {uploadedBgs.map((bg) => {
                    const isActive = backgroundImage === bg.url;
                    return (
                      <div
                        key={bg.name}
                        onClick={() => {
                          const img = new Image();
                          img.src = bg.url;
                          img.onload = async () => {
                            setBackgroundImage(bg.url);
                            await updateConfig({ backgroundImage: bg.url });
                          };
                        }}
                        style={{
                          position: 'relative',
                          height: '50px',
                          borderRadius: 'var(--nd-card-radius)',
                          overflow: 'hidden',
                          border: isActive ? '2px solid var(--nd-accent)' : '1px solid var(--nd-card-border)',
                          boxShadow: isActive ? '0 0 8px var(--nd-accent)' : 'none',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          backgroundImage: `url("${bg.url}")`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'
                        }}
                        title={bg.name}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setBgToDelete(bg.url);
                            setIsConfirmBgDeleteOpen(true);
                          }}
                          style={{
                            position: 'absolute',
                            top: '2px',
                            right: '2px',
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            background: 'rgba(0, 0, 0, 0.6)',
                            border: 'none',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '9px',
                            cursor: 'pointer',
                            zIndex: 2
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </SettingsAccordion>

        {/* Design System Customization (Typography, Opacity, Radius) */}
        <SettingsAccordion
          title={t("Personnalisation Visuelle")}
          description={t("Ajustez en temps réel les polices et géométries")}
          icon={<Layout size={18} />}
          isOpen={openAccordions.includes('visual')}
          onToggle={() => toggleAccordion('visual')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="nd-label" style={{ display: 'block', fontSize: '0.72rem', color: 'var(--nd-text)', marginBottom: 4 }}>
                {t("Typographie globale (Google Fonts)")}
              </label>
              <CustomSelect
                value={globalFont}
                onChange={handleFontChange}
                options={[
                  { value: 'Outfit', label: t("Outfit (Défaut)") },
                  { value: 'Inter', label: t("Inter (Pure & Moderne)") },
                  { value: 'Poppins', label: t("Poppins (Rond & Épuré)") },
                  { value: 'Rubik', label: t("Rubik (Arrondi Confort)") },
                  { value: 'Ubuntu', label: t("Ubuntu (Style Linux)") },
                  { value: 'Lexend', label: t("Lexend (Haute Lisibilité)") },
                  { value: 'JetBrains Mono', label: t("JetBrains Mono (Console Tech)") },
                  { value: 'Fira Code', label: t("Fira Code (Developer)") },
                  { value: 'Source Code Pro', label: t("Source Code Pro (Terminal)") },
                  { value: 'Montserrat', label: t("Montserrat (Géométrique)") },
                  { value: 'Roboto', label: t("Roboto (Neutre/Standard)") }
                ]}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label className="nd-label" style={{ fontSize: '0.72rem', color: 'var(--nd-text)', margin: 0 }}>
                  {t("Arrondi des cartes")}
                </label>
                <span style={{ fontSize: '0.7rem', color: 'var(--nd-accent)', fontWeight: 600 }}>
                  {borderRadius}px
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="24"
                step="1"
                value={borderRadius}
                onChange={(e) => handleRadiusChange(Number(e.target.value))}
                onMouseUp={() => handleRadiusSave(borderRadius)}
                onTouchEnd={() => handleRadiusSave(borderRadius)}
                style={{ width: '100%', accentColor: 'var(--nd-accent)', cursor: 'pointer' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label className="nd-label" style={{ fontSize: '0.72rem', color: 'var(--nd-text)', margin: 0 }}>
                  {t("Opacité du fond des cartes (Transparence)")}
                </label>
                <span style={{ fontSize: '0.7rem', color: 'var(--nd-accent)', fontWeight: 600 }}>
                  {Math.round(cardOpacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={cardOpacity}
                onChange={(e) => handleOpacityChange(Number(e.target.value))}
                onMouseUp={() => handleOpacitySave(cardOpacity)}
                onTouchEnd={() => handleOpacitySave(cardOpacity)}
                style={{ width: '100%', accentColor: 'var(--nd-accent)', cursor: 'pointer' }}
              />
            </div>
          </div>
        </SettingsAccordion>

        {/* Accordion 4: Titles */}
        <SettingsAccordion
          title={t("Titres")}
          description={t("Affichage, masquage et position des titres de widgets et catégories")}
          icon={<Type size={18} />}
          isOpen={openAccordions.includes('titles')}
          onToggle={() => toggleAccordion('titles')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <ToggleSwitch
              checked={!(config?.settings?.hideWidgetTitles ?? false)}
              onChange={(val) => updateConfig({ hideWidgetTitles: !val })}
              label={t("Afficher les titres des widgets")}
              sublabel={t("Affiche ou masque les titres au-dessus de tous vos widgets (ex: APPAREILS, CALENDRIER).")}
            />

            <ToggleSwitch
              checked={!(config?.settings?.hideCategoryTitles ?? false)}
              onChange={(val) => updateConfig({ hideCategoryTitles: !val })}
              label={t("Afficher les titres des catégories")}
              sublabel={t("Affiche ou masque le nom des catégories de services dans la section principale.")}
            />

            {/* Position Select Card */}
            <div className="nd-settings-card">
              <div className="nd-settings-card-row">
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', color: 'var(--nd-text)' }}>
                    {t("Position du titre des catégories")}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--nd-text-muted)', display: 'block', marginTop: 2 }}>
                    {t("Afficher le titre à l'intérieur de sa carte ou séparé au-dessus.")}
                  </span>
                </div>
                <div className="nd-settings-select-wrap" style={{ flexShrink: 0, width: 180 }}>
                  <CustomSelect
                    value={config?.settings?.categoryTitlePosition || 'inside'}
                    onChange={(val) => updateConfig({ categoryTitlePosition: val })}
                    options={[
                      { value: 'inside', label: t("Dans la carte (Défaut)") },
                      { value: 'above', label: t("Au-dessus de la carte") }
                    ]}
                  />
                </div>
              </div>
            </div>
          </div>
        </SettingsAccordion>



      </div>

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
}
