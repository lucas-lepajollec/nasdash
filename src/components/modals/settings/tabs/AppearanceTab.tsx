import React, { useState, useEffect } from 'react';
import { Palette, Layout, Layers, Monitor, X, Trash2 } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { AppearanceProfile } from '@/lib/types';
import CustomSelect from '../../../shared/CustomSelect';
import { THEME_PRESETS } from '../../SettingsModal';
import { SettingsAccordion } from '../shared/SettingsAccordion';

export function AppearanceTab() {
  const { config, updateConfig } = useConfig();
  
  // Accordions states
  const [openAccordions, setOpenAccordions] = useState<string[]>(['theme']);

  const toggleAccordion = (id: string) => {
    setOpenAccordions(prev => prev.includes(id) ? [] : [id]);
  };

  // Local States initialized from Config
  const [mode, setMode] = useState<'light' | 'dark'>('dark');
  const [theme, setTheme] = useState('nasdash');
  const [title, setTitle] = useState('MON HOME LAB');
  const [titleMobile, setTitleMobile] = useState('');
  const [titleLogo, setTitleLogo] = useState('');
  const [titleFont, setTitleFont] = useState<"outfit" | "space-grotesk" | "syne" | "righteous" | "montserrat">('outfit');
  const [titleAnimation, setTitleAnimation] = useState<"none" | "spotlight-silver">('none');
  const [backgroundImage, setBackgroundImage] = useState('');
  const [mobileWallpaper, setMobileWallpaper] = useState('');
  
  const [mobileTheme, setMobileTheme] = useState('');
  const [mobileGlobalFont, setMobileGlobalFont] = useState('');
  const [mobileBorderRadius, setMobileBorderRadius] = useState<number | ''>('');
  const [mobileCardOpacity, setMobileCardOpacity] = useState<number | ''>('');
  const [mobileTitleAnimation, setMobileTitleAnimation] = useState('');
  
  const [uploadedBgs, setUploadedBgs] = useState<{ name: string; url: string }[]>([]);
  const [bgToDelete, setBgToDelete] = useState<string | null>(null);

  // Appearance Profiles
  const [appearanceProfiles, setAppearanceProfiles] = useState<AppearanceProfile[]>([]);
  const [newProfileName, setNewProfileName] = useState('');
  const [mobileAppearanceProfiles, setMobileAppearanceProfiles] = useState<AppearanceProfile[]>([]);
  const [newMobileProfileName, setNewMobileProfileName] = useState('');

  // Delete Confirmations
  const [confirmDeleteProfile, setConfirmDeleteProfile] = useState<string | null>(null);
  const [confirmDeleteMobileProfile, setConfirmDeleteMobileProfile] = useState<string | null>(null);
  const [isConfirmBgDeleteOpen, setIsConfirmBgDeleteOpen] = useState(false);
  const [isConfirmLogoDeleteOpen, setIsConfirmLogoDeleteOpen] = useState(false);
  const [logoToDelete, setLogoToDelete] = useState<string | null>(null);

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
      
      if (config.settings?.title !== undefined) setTitle(config.settings.title);
      if (config.settings?.titleMobile !== undefined) setTitleMobile(config.settings.titleMobile);
      if (config.settings?.titleLogo !== undefined) setTitleLogo(config.settings.titleLogo);
      if (config.settings?.titleFont !== undefined) setTitleFont(config.settings.titleFont);
      if (config.settings?.titleAnimation !== undefined) setTitleAnimation(config.settings.titleAnimation);
      if (config.settings?.backgroundImage !== undefined) setBackgroundImage(config.settings.backgroundImage);
      if (config.settings?.mobileWallpaper !== undefined) setMobileWallpaper(config.settings.mobileWallpaper);
      if (config.settings?.mobileTheme !== undefined) setMobileTheme(config.settings.mobileTheme);
      if (config.settings?.mobileGlobalFont !== undefined) setMobileGlobalFont(config.settings.mobileGlobalFont);
      if (config.settings?.mobileBorderRadius !== undefined) setMobileBorderRadius(config.settings.mobileBorderRadius);
      if (config.settings?.mobileCardOpacity !== undefined) setMobileCardOpacity(config.settings.mobileCardOpacity);
      if (config.settings?.mobileTitleAnimation !== undefined) setMobileTitleAnimation(config.settings.mobileTitleAnimation);
      if (config.appearanceProfiles) setAppearanceProfiles(config.appearanceProfiles);
      if (config.settings?.mobileAppearanceProfiles) setMobileAppearanceProfiles(config.settings.mobileAppearanceProfiles);
    }
  }, [config]);

  useEffect(() => {
    if (document.body.classList.contains('light')) {
      setMode('light');
    } else {
      setMode('dark');
    }
  }, []);

  const toggleMode = () => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    setMode(newMode);
    if (newMode === 'light') {
      document.body.classList.add('light');
      localStorage.setItem('nd-theme', 'light');
    } else {
      document.body.classList.remove('light');
      localStorage.setItem('nd-theme', 'dark');
    }
  };

  const handleThemeChange = async (newTheme: string) => {
    setTheme(newTheme);
    const classesToRemove = Array.from(document.body.classList).filter(cls => cls.startsWith('theme-'));
    classesToRemove.forEach(cls => document.body.classList.remove(cls));
    if (newTheme !== 'nasdash') {
      document.body.classList.add(`theme-${newTheme}`);
      if (document.body.classList.contains('light')) {
        document.body.classList.remove('light');
        setMode('dark');
        localStorage.setItem('nd-theme', 'dark');
      }
    }
    await updateConfig({ theme: newTheme });
  };

  const fetchUploadedBgs = async () => {
    try {
      const params = new URLSearchParams();
      params.append('type', 'background');
      if (backgroundImage) params.append('current', backgroundImage);
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

  const handleSaveMobileWallpaper = async () => {
    await updateConfig({ mobileWallpaper });
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

  const handleSaveLogo = async () => {
    await updateConfig({ titleLogo });
  };

  const handleConfirmLogoDelete = async () => {
    const targetUrl = logoToDelete || titleLogo;
    if (targetUrl && targetUrl.startsWith('/api/logos/')) {
      const filename = targetUrl.replace('/api/logos/', '');
      try {
        await fetch(`/api/logos/${filename}`, { method: 'DELETE' });
      } catch (err) {
        console.error('Failed to delete logo file:', err);
      }
    }
    
    if (targetUrl === titleLogo) {
      setTitleLogo('');
      await updateConfig({ titleLogo: '' });
    }

    setLogoToDelete(null);
    setIsConfirmLogoDeleteOpen(false);
  };

  const handleSaveProfile = async () => {
    if (!newProfileName.trim()) return;
    const newProfile: AppearanceProfile = {
      id: Date.now().toString(),
      name: newProfileName,
      settings: { theme, backgroundImage, globalFont, borderRadius, cardOpacity, title, titleLogo, titleFont, titleAnimation }
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
    if (settings.title !== undefined) setTitle(settings.title);
    if (settings.titleLogo !== undefined) setTitleLogo(settings.titleLogo);
    if (settings.titleFont !== undefined) setTitleFont(settings.titleFont);
    if (settings.titleAnimation !== undefined) setTitleAnimation(settings.titleAnimation);
    
    await updateConfig(settings);
  };

  const handleDeleteProfile = async (id: string) => {
    const updatedProfiles = appearanceProfiles.filter(p => p.id !== id);
    setAppearanceProfiles(updatedProfiles);
    await updateConfig({ appearanceProfiles: updatedProfiles });
    setConfirmDeleteProfile(null);
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
        titleMobile, mobileTitleAnimation,
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
    if (settings.titleMobile !== undefined) setTitleMobile(settings.titleMobile);
    if (settings.mobileTitleAnimation !== undefined) setMobileTitleAnimation(settings.mobileTitleAnimation);
    
    await updateConfig(settings);
  };

  const handleDeleteMobileProfile = async (id: string) => {
    const updatedProfiles = mobileAppearanceProfiles.filter(p => p.id !== id);
    setMobileAppearanceProfiles(updatedProfiles);
    await updateConfig({ mobileAppearanceProfiles: updatedProfiles });
    setConfirmDeleteMobileProfile(null);
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Appearance Profiles */}
        <SettingsAccordion
          title="Profils & Thème Global"
          description="Couleurs globales et gestion des profils"
          icon={<Palette size={18} />}
          isOpen={openAccordions.includes('theme')}
          onToggle={() => toggleAccordion('theme')}
        >
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>Thème (Couleurs globales)</h4>
            <CustomSelect
              value={theme}
              onChange={handleThemeChange}
              options={[
                { value: 'nasdash', label: 'NasDash (Défaut)' },
                { value: 'apple-dark', label: 'Apple Dark (Frosted)' },
                { value: 'apple-light', label: 'Apple Light (Premium)' },
                { value: 'catppuccin-macchiato', label: 'Catppuccin Macchiato' },
                { value: 'nord', label: 'Nord Ice' },
                { value: 'dracula', label: 'Dracula Gothic' },
                { value: 'ocean', label: 'Ocean deep glow' },
                { value: 'midnight', label: 'Midnight OLED' },
                { value: 'cyberpunk', label: 'Retro Cyberpunk 🤖' }
              ]}
            />
          </div>

          {theme === 'nasdash' && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>Mode d'affichage</h4>
                </div>
                <button className="nd-btn" onClick={toggleMode} style={{ flexShrink: 0, whiteSpace: 'nowrap', padding: '6px 12px', fontSize: '0.75rem' }}>
                  {mode === 'light' ? '☀️ Mode Clair' : '🌙 Mode Sombre'}
                </button>
              </div>
            </div>
          )}

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 16 }}>
            <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>Profils d'Apparence</h4>
            <p style={{ margin: '4px 0 12px 0', fontSize: '0.7rem', color: 'var(--nd-text-muted)' }}>
              Sauvegardez votre configuration esthétique actuelle.
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                type="text"
                className="nd-input"
                placeholder="Nom du nouveau profil..."
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                style={{ flex: 1, fontSize: '0.75rem', padding: '6px 10px' }}
              />
              <button className="nd-btn" onClick={handleSaveProfile} disabled={!newProfileName.trim()} style={{ padding: '6px 10px', fontSize: '0.75rem' }}>
                Sauvegarder
              </button>
            </div>

            {appearanceProfiles.length > 0 && (
              <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr' }}>
                {appearanceProfiles.map(profile => (
                  <div key={profile.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--nd-card-bg)', padding: '12px 16px', borderRadius: 'var(--nd-card-radius)', border: '1px solid var(--nd-card-border)' }}>
                    <div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--nd-text)' }}>{profile.name}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)', display: 'block', marginTop: 4 }}>{profile.settings.theme}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button className="nd-btn" onClick={() => handleApplyProfile(profile)} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                        Appliquer
                      </button>
                      <button 
                        type="button"
                        className="nd-btn nd-btn-danger"
                        onClick={() => setConfirmDeleteProfile(profile.id)} 
                        style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                        title="Supprimer le profil"
                      >
                        <Trash2 size={13} /> Supprimer
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
          title="Fonds d'écran"
          description="Images de fond et galerie personnalisée"
          icon={<Palette size={18} />}
          isOpen={openAccordions.includes('backgrounds')}
          onToggle={() => toggleAccordion('backgrounds')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)', marginLeft: 2 }}>Image de fond (Desktop & Tablette Paysage)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="nd-input"
                  placeholder="https://example.com/background.jpg ou fichier importé"
                  value={backgroundImage}
                  onChange={(e) => setBackgroundImage(e.target.value)}
                  style={{ flex: 1, fontSize: '0.78rem' }}
                />
                <button className="nd-btn" onClick={handleSaveBackground} style={{ padding: '6px 14px', fontSize: '0.75rem' }}>
                  Enregistrer
                </button>
                {backgroundImage && (
                  <button className="nd-btn" onClick={async () => { setBackgroundImage(''); await updateConfig({ backgroundImage: '' }); }} style={{ padding: '6px 10px', fontSize: '0.75rem', color: 'var(--nd-red)', background: 'rgba(239, 68, 68, 0.1)' }}>
                    Effacer
                  </button>
                )}
              </div>
            </div>
            
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
                        const ratio = img.width / img.height;
                        if (ratio < 1.0) {
                          setMobileWallpaper(data.url);
                          await updateConfig({ mobileWallpaper: data.url });
                        } else {
                          setBackgroundImage(data.url);
                          await updateConfig({ backgroundImage: data.url });
                        }
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
                📁 Importer une image (Auto-Détection)
              </label>
            </div>

            {uploadedBgs.length > 0 && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed var(--nd-card-border)' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--nd-text-muted)', display: 'block', marginBottom: '8px' }}>
                  Galerie des fonds importés ({uploadedBgs.length})
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
                            const ratio = img.width / img.height;
                            if (ratio < 1.0) {
                              setMobileWallpaper(bg.url);
                              await updateConfig({ mobileWallpaper: bg.url });
                            } else {
                              setBackgroundImage(bg.url);
                              await updateConfig({ backgroundImage: bg.url });
                            }
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
          title="Personnalisation Visuelle"
          description="Ajustez en temps réel les polices et géométries"
          icon={<Layout size={18} />}
          isOpen={openAccordions.includes('visual')}
          onToggle={() => toggleAccordion('visual')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="nd-label" style={{ display: 'block', fontSize: '0.72rem', color: 'var(--nd-text)', marginBottom: 4 }}>
                Typographie globale (Google Fonts)
              </label>
              <CustomSelect
                value={globalFont}
                onChange={handleFontChange}
                options={[
                  { value: 'Outfit', label: 'Outfit (Défaut)' },
                  { value: 'Inter', label: 'Inter (Pure & Moderne)' },
                  { value: 'Poppins', label: 'Poppins (Rond & Épuré)' },
                  { value: 'Rubik', label: 'Rubik (Arrondi Confort)' },
                  { value: 'Ubuntu', label: 'Ubuntu (Style Linux)' },
                  { value: 'Lexend', label: 'Lexend (Haute Lisibilité)' },
                  { value: 'JetBrains Mono', label: 'JetBrains Mono (Console Tech)' },
                  { value: 'Fira Code', label: 'Fira Code (Developer)' },
                  { value: 'Source Code Pro', label: 'Source Code Pro (Terminal)' },
                  { value: 'Montserrat', label: 'Montserrat (Géométrique)' },
                  { value: 'Roboto', label: 'Roboto (Neutre/Standard)' }
                ]}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label className="nd-label" style={{ fontSize: '0.72rem', color: 'var(--nd-text)', margin: 0 }}>
                  Arrondi des cartes
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
                  Opacité du fond des cartes (Transparence)
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

        {/* Titre & Animations */}
        <SettingsAccordion
          title="Titre, Logo & Animations"
          description="En-tête et logo de l'application"
          icon={<Layers size={18} />}
          isOpen={openAccordions.includes('title')}
          onToggle={() => toggleAccordion('title')}
        >
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr' }}>
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)', marginBottom: 4, display: 'block' }}>Titre principal (Desktop)</label>
              <input type="text" className="nd-input" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => updateConfig({ title })} placeholder="MON HOME LAB" style={{ fontSize: '0.75rem', padding: '6px 10px' }} />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)', marginBottom: 4, display: 'block' }}>Logo (Remplace le texte si défini)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                className="nd-input"
                placeholder="URL ou base64 du logo (SVG, PNG)"
                value={titleLogo}
                onChange={(e) => setTitleLogo(e.target.value)}
                style={{ flex: 1, fontSize: '0.75rem', padding: '6px 10px' }}
              />
              <button className="nd-btn" onClick={handleSaveLogo} style={{ padding: '6px 10px', fontSize: '0.75rem' }}>
                Enregistrer
              </button>
              {titleLogo && (
                <button 
                  className="nd-btn nd-btn-danger" 
                  onClick={() => {
                    setLogoToDelete(titleLogo);
                    setIsConfirmLogoDeleteOpen(true);
                  }} 
                  style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <label className="nd-btn" style={{ padding: '6px 10px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                Importer un fichier
                <input 
                  type="file" 
                  accept="image/png, image/svg+xml, image/webp" 
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('type', 'logo');
                    try {
                      const res = await fetch('/api/upload', { method: 'POST', body: formData });
                      if (res.ok) {
                        const data = await res.json();
                        setTitleLogo(data.url);
                        await updateConfig({ titleLogo: data.url });
                      }
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                />
              </label>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)', marginBottom: 4, display: 'block' }}>Police du titre (Design)</label>
            <CustomSelect
              value={titleFont}
              onChange={(val: string) => { setTitleFont(val as any); updateConfig({ titleFont: val as any }); }}
              options={[
                { value: 'outfit', label: 'Outfit (Défaut, Moderne)' },
                { value: 'space-grotesk', label: 'Space Grotesk (Tech & Brut)' },
                { value: 'syne', label: 'Syne (Design & Artistique)' },
                { value: 'righteous', label: 'Righteous (Logo & Courbe)' },
                { value: 'montserrat', label: 'Montserrat (Premium & Classic)' },
              ]}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)', marginBottom: 4, display: 'block' }}>Animation du titre</label>
            <CustomSelect
              value={titleAnimation}
              onChange={(val: string) => { setTitleAnimation(val as any); updateConfig({ titleAnimation: val as any }); }}
              options={[
                { value: 'none', label: 'Aucune' },
                { value: 'spotlight-silver', label: 'Balayage Argenté (Silver)' },
              ]}
            />
          </div>
        </SettingsAccordion>

        {/* Configuration Mobile */}
        <SettingsAccordion
          title="Configuration Spéciale Mobile"
          description="Surchargez les paramètres globaux (titre, fond, thème)"
          icon={<Monitor size={18} />}
          isOpen={openAccordions.includes('mobile')}
          onToggle={() => toggleAccordion('mobile')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
              <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>Titre de l'application (Mobile)</h4>
              <input type="text" className="nd-input" value={titleMobile} onChange={(e) => setTitleMobile(e.target.value)} onBlur={() => updateConfig({ titleMobile })} placeholder="Laissez vide pour utiliser le titre principal" style={{ fontSize: '0.75rem', padding: '6px 10px', width: '100%', marginTop: '8px' }} />
            </div>

            <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
              <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, marginBottom: '8px' }}>Thème (Mobile)</h4>
              <CustomSelect
                value={mobileTheme}
                onChange={(val: string) => { setMobileTheme(val); updateConfig({ mobileTheme: val }); }}
                options={[
                  { value: '', label: 'Hériter du thème Desktop' },
                  ...Object.keys(THEME_PRESETS).map(t => ({ value: t, label: THEME_PRESETS[t].name }))
                ]}
              />
            </div>

            <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
              <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, marginBottom: '8px' }}>Fonds d'écran personnalisés (Mobile)</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    className="nd-input"
                    placeholder="https://example.com/mobile-bg.jpg ou fichier importé"
                    value={mobileWallpaper}
                    onChange={(e) => setMobileWallpaper(e.target.value)}
                    style={{ flex: 1, fontSize: '0.78rem' }}
                  />
                  <button className="nd-btn" onClick={handleSaveMobileWallpaper} style={{ padding: '6px 14px', fontSize: '0.75rem' }}>
                    Enregistrer
                  </button>
                  {mobileWallpaper && (
                    <button className="nd-btn" onClick={async () => { setMobileWallpaper(''); await updateConfig({ mobileWallpaper: '' }); }} style={{ padding: '6px 10px', fontSize: '0.75rem', color: 'var(--nd-red)', background: 'rgba(239, 68, 68, 0.1)' }}>
                      Effacer
                    </button>
                  )}
                </div>
                
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="file"
                    accept="image/*"
                    id="mobile-bg-upload-input"
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
                          setMobileWallpaper(data.url);
                          await updateConfig({ mobileWallpaper: data.url });
                          fetchUploadedBgs();
                        }
                      } catch (err) {
                        console.error('Failed to upload background:', err);
                      }
                    }}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="mobile-bg-upload-input" className="nd-btn" style={{ padding: '6px 12px', fontSize: '0.72rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--nd-card-border)' }}>
                    📁 Importer une image mobile
                  </label>
                </div>

                {uploadedBgs.length > 0 && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed var(--nd-card-border)' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--nd-text-muted)', display: 'block', marginBottom: '8px' }}>
                      Galerie des fonds importés
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
                        const isActive = mobileWallpaper === bg.url;
                        return (
                          <div
                            key={bg.name}
                            onClick={async () => {
                              setMobileWallpaper(bg.url);
                              await updateConfig({ mobileWallpaper: bg.url });
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
            </div>

            <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
              <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, marginBottom: '8px' }}>Personnalisation Visuelle (Mobile)</h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)', marginBottom: 4, display: 'block' }}>Typographie globale (Mobile)</label>
                  <CustomSelect
                    value={mobileGlobalFont}
                    onChange={(val: string) => { setMobileGlobalFont(val); updateConfig({ mobileGlobalFont: val }); }}
                    options={[
                      { value: '', label: 'Hériter de Desktop' },
                      { value: 'Outfit', label: 'Outfit (Défaut)' },
                      { value: 'Inter', label: 'Inter (Pure & Moderne)' },
                      { value: 'Poppins', label: 'Poppins (Rond & Épuré)' },
                      { value: 'Rubik', label: 'Rubik (Arrondi Confort)' },
                      { value: 'Ubuntu', label: 'Ubuntu (Style Linux)' },
                      { value: 'Lexend', label: 'Lexend (Haute Lisibilité)' },
                      { value: 'JetBrains Mono', label: 'JetBrains Mono (Console Tech)' },
                      { value: 'Fira Code', label: 'Fira Code (Developer)' },
                      { value: 'Source Code Pro', label: 'Source Code Pro (Terminal)' },
                      { value: 'Montserrat', label: 'Montserrat (Géométrique)' },
                      { value: 'Roboto', label: 'Roboto (Neutre/Standard)' }
                    ]}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)', marginBottom: 4, display: 'block' }}>Animation du titre (Mobile)</label>
                  <CustomSelect
                    value={mobileTitleAnimation}
                    onChange={(val: string) => { setMobileTitleAnimation(val); updateConfig({ mobileTitleAnimation: val }); }}
                    options={[
                      { value: '', label: 'Hériter de Desktop' },
                      { value: 'none', label: 'Aucune' },
                      { value: 'spotlight-silver', label: 'Balayage Argenté (Silver)' },
                    ]}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label className="nd-label" style={{ fontSize: '0.72rem', color: 'var(--nd-text)', margin: 0 }}>
                      Arrondi des cartes (Mobile)
                    </label>
                    <span style={{ fontSize: '0.7rem', color: 'var(--nd-accent)', fontWeight: 600 }}>
                      {mobileBorderRadius === '' ? 'Hérité' : `${mobileBorderRadius}px`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-1"
                    max="24"
                    step="1"
                    value={mobileBorderRadius === '' ? -1 : mobileBorderRadius}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val === -1) {
                        setMobileBorderRadius('');
                      } else {
                        setMobileBorderRadius(val);
                      }
                    }}
                    onMouseUp={() => updateConfig({ mobileBorderRadius: mobileBorderRadius === '' ? null : mobileBorderRadius })}
                    onTouchEnd={() => updateConfig({ mobileBorderRadius: mobileBorderRadius === '' ? null : mobileBorderRadius })}
                    style={{ width: '100%', accentColor: 'var(--nd-accent)', cursor: 'pointer' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label className="nd-label" style={{ fontSize: '0.72rem', color: 'var(--nd-text)', margin: 0 }}>
                      Opacité du fond des cartes (Mobile)
                    </label>
                    <span style={{ fontSize: '0.7rem', color: 'var(--nd-accent)', fontWeight: 600 }}>
                      {mobileCardOpacity === '' ? 'Hérité' : `${Math.round((mobileCardOpacity as number) * 100)}%`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-0.05"
                    max="1"
                    step="0.05"
                    value={mobileCardOpacity === '' ? -0.05 : mobileCardOpacity}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val < 0) {
                        setMobileCardOpacity('');
                      } else {
                        setMobileCardOpacity(val);
                      }
                    }}
                    onMouseUp={() => updateConfig({ mobileCardOpacity: mobileCardOpacity === '' ? null : mobileCardOpacity })}
                    onTouchEnd={() => updateConfig({ mobileCardOpacity: mobileCardOpacity === '' ? null : mobileCardOpacity })}
                    style={{ width: '100%', accentColor: 'var(--nd-accent)', cursor: 'pointer' }}
                  />
                </div>
              </div>
            </div>

            <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
              <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>Profils d'Apparence Mobile</h4>
              <p style={{ margin: '4px 0 12px 0', fontSize: '0.7rem', color: 'var(--nd-text-muted)' }}>
                Sauvegardez votre configuration mobile.
              </p>
              
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input
                  type="text"
                  className="nd-input"
                  placeholder="Nom du profil mobile..."
                  value={newMobileProfileName}
                  onChange={(e) => setNewMobileProfileName(e.target.value)}
                  style={{ flex: 1, fontSize: '0.75rem', padding: '6px 10px' }}
                />
                <button className="nd-btn" onClick={handleSaveMobileProfile} disabled={!newMobileProfileName.trim()} style={{ padding: '6px 10px', fontSize: '0.75rem' }}>
                  Sauvegarder
                </button>
              </div>

              {mobileAppearanceProfiles.length > 0 && (
                <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr' }}>
                  {mobileAppearanceProfiles.map(profile => (
                    <div key={profile.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--nd-card-bg)', padding: '12px 16px', borderRadius: 'var(--nd-card-radius)', border: '1px solid var(--nd-card-border)' }}>
                      <div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--nd-text)' }}>{profile.name}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)', display: 'block', marginTop: 4 }}>
                          {profile.settings.mobileTheme || 'Hérité'} • {profile.settings.mobileGlobalFont || 'Hérité'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button className="nd-btn" onClick={() => handleApplyMobileProfile(profile)} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                          Appliquer
                        </button>
                        <button 
                          type="button"
                          className="nd-btn nd-btn-danger"
                          onClick={() => setConfirmDeleteMobileProfile(profile.id)} 
                          style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SettingsAccordion>

        {/* Delete Confirmations Modal for Profiles */}
        {confirmDeleteProfile && (
          <div className="nd-modal-overlay" style={{ zIndex: 1000002 }}>
            <div className="nd-modal" style={{ maxWidth: 400 }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: 'var(--nd-red)' }}>Supprimer le profil ?</h3>
              <p style={{ margin: '0 0 24px 0', fontSize: '0.85rem', color: 'var(--nd-text-muted)' }}>Êtes-vous sûr de vouloir supprimer ce profil d'apparence ?</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button className="nd-btn" onClick={() => setConfirmDeleteProfile(null)}>Annuler</button>
                <button className="nd-btn nd-btn-danger" onClick={() => handleDeleteProfile(confirmDeleteProfile)}>Oui, supprimer</button>
              </div>
            </div>
          </div>
        )}

        {confirmDeleteMobileProfile && (
          <div className="nd-modal-overlay" style={{ zIndex: 1000002 }}>
            <div className="nd-modal" style={{ maxWidth: 400 }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: 'var(--nd-red)' }}>Supprimer le profil mobile ?</h3>
              <p style={{ margin: '0 0 24px 0', fontSize: '0.85rem', color: 'var(--nd-text-muted)' }}>Êtes-vous sûr de vouloir supprimer ce profil d'apparence mobile ?</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button className="nd-btn" onClick={() => setConfirmDeleteMobileProfile(null)}>Annuler</button>
                <button className="nd-btn nd-btn-danger" onClick={() => handleDeleteMobileProfile(confirmDeleteMobileProfile)}>Oui, supprimer</button>
              </div>
            </div>
          </div>
        )}

        {/* Modals for Logo & Bg Delete */}
        {isConfirmBgDeleteOpen && (
          <div className="nd-modal-overlay" style={{ zIndex: 1000002 }}>
            <div className="nd-modal" style={{ maxWidth: 400 }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: 'var(--nd-red)' }}>Supprimer l'image ?</h3>
              <p style={{ margin: '0 0 24px 0', fontSize: '0.85rem', color: 'var(--nd-text-muted)', lineHeight: 1.5 }}>
                Êtes-vous sûr de vouloir supprimer cette image ? Si elle est utilisée, elle disparaîtra.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button className="nd-btn" onClick={() => { setIsConfirmBgDeleteOpen(false); setBgToDelete(null); }}>Annuler</button>
                <button className="nd-btn nd-btn-danger" onClick={handleConfirmBgDelete}>Oui, supprimer</button>
              </div>
            </div>
          </div>
        )}

        {isConfirmLogoDeleteOpen && (
          <div className="nd-modal-overlay" style={{ zIndex: 1000002 }}>
            <div className="nd-modal" style={{ maxWidth: 400 }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: 'var(--nd-red)' }}>Supprimer le logo ?</h3>
              <p style={{ margin: '0 0 24px 0', fontSize: '0.85rem', color: 'var(--nd-text-muted)', lineHeight: 1.5 }}>
                Êtes-vous sûr de vouloir supprimer ce logo ? S'il s'agit d'un fichier importé, il sera définitivement effacé.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button className="nd-btn" onClick={() => { setIsConfirmLogoDeleteOpen(false); setLogoToDelete(null); }}>Annuler</button>
                <button className="nd-btn nd-btn-danger" onClick={handleConfirmLogoDelete}>Oui, supprimer</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
