import React, { useState, useEffect } from 'react';
import { Palette, Layout, Layers, Monitor, X, Trash2 } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { AppearanceProfile } from '@/lib/types';
import CustomSelect from '../../../shared/CustomSelect';
import ConfirmModal from '../../ConfirmModal';
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
  const [backgroundImage, setBackgroundImage] = useState('');
  
  const [uploadedBgs, setUploadedBgs] = useState<{ name: string; url: string }[]>([]);
  const [bgToDelete, setBgToDelete] = useState<string | null>(null);

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
                  <div key={profile.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', background: 'var(--nd-card-bg)', padding: '12px 16px', borderRadius: 'var(--nd-card-radius)', border: '1px solid var(--nd-card-border)' }}>
                    <div style={{ minWidth: '120px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--nd-text)', wordBreak: 'break-word' }}>{profile.name}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)', display: 'block', marginTop: 4, wordBreak: 'break-all' }}>{profile.settings.theme}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
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



      </div>

      <ConfirmModal
        isOpen={!!confirmDeleteProfile}
        onClose={() => setConfirmDeleteProfile(null)}
        onConfirm={() => {
          if (confirmDeleteProfile) handleDeleteProfile(confirmDeleteProfile);
        }}
        title="Supprimer le profil"
        description="Êtes-vous sûr de vouloir supprimer ce profil d'apparence ? Cette action est irréversible."
        confirmLabel="Supprimer"
      />

      <ConfirmModal
        isOpen={isConfirmBgDeleteOpen}
        onClose={() => setIsConfirmBgDeleteOpen(false)}
        onConfirm={handleConfirmBgDelete}
        title="Supprimer l'image de fond"
        description="Êtes-vous sûr de vouloir supprimer cette image ? Elle sera supprimée du serveur."
        confirmLabel="Supprimer"
      />
    </>
  );
}
