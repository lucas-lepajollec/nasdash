import React, { useState, useEffect } from 'react';
import { Monitor, Layers, Trash2 } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { AppearanceProfile } from '@/lib/types';
import CustomSelect from '../../../shared/CustomSelect';
import { THEME_PRESETS } from '../../SettingsModal';
import { SettingsAccordion } from '../shared/SettingsAccordion';

import { ToggleSwitch } from '../shared/ToggleSwitch';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';
import { useI18n } from '@/i18n/I18nProvider';

export function MobileTab() {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();
  const demoMode = config?.demoMode === true;
  
  // Accordions states
  const [openAccordions, setOpenAccordions] = useState<string[]>(['mobile-layout']);

  const toggleAccordion = (id: string) => {
    setOpenAccordions(prev => prev.includes(id) ? [] : [id]);
  };

  // Local States initialized from Config
  const [titleMobile, setTitleMobile] = useState('');
  const [mobileWallpaper, setMobileWallpaper] = useState('');
  
  const [mobileTheme, setMobileTheme] = useState('');
  const [mobileGlobalFont, setMobileGlobalFont] = useState('');
  const [mobileBorderRadius, setMobileBorderRadius] = useState<number | ''>('');
  const [mobileCardOpacity, setMobileCardOpacity] = useState<number | ''>('');
  const [mobileTitleAnimation, setMobileTitleAnimation] = useState('');
  
  // Header Layout Mobile
  const [leftElement, setLeftElement] = useState<'title' | 'search' | 'none'>('title');
  const [centerElement, setCenterElement] = useState<'title' | 'search' | 'none'>('search');
  const [itemsOrder, setItemsOrder] = useState<('title' | 'search')[]>([]);

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
      if (config.settings?.titleMobile !== undefined) setTitleMobile(config.settings.titleMobile);
      if (config.settings?.mobileWallpaper !== undefined) setMobileWallpaper(config.settings.mobileWallpaper);
      if (config.settings?.mobileTheme !== undefined) setMobileTheme(config.settings.mobileTheme);
      if (config.settings?.mobileGlobalFont !== undefined) setMobileGlobalFont(config.settings.mobileGlobalFont);
      if (config.settings?.mobileBorderRadius !== undefined) setMobileBorderRadius(config.settings.mobileBorderRadius);
      if (config.settings?.mobileCardOpacity !== undefined) setMobileCardOpacity(config.settings.mobileCardOpacity);
      if (config.settings?.mobileTitleAnimation !== undefined) setMobileTitleAnimation(config.settings.mobileTitleAnimation);
      if (config.settings?.mobileAppearanceProfiles) setMobileAppearanceProfiles(config.settings.mobileAppearanceProfiles);

      const ml = config.settings?.headerLayoutMobile || { left: 'title', center: 'search' };
      setLeftElement(ml.left || 'title');
      setCenterElement(ml.center || 'search');

      if (itemsOrder.length === 0) {
        const active = [ml.left, ml.center].filter(x => x && x !== 'none') as ('title' | 'search')[];
        const inactive = ['title', 'search'].filter(x => !active.includes(x as any)) as ('title' | 'search')[];
        setItemsOrder([...active, ...inactive]);
      }
    }
  }, [config, itemsOrder]);

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

  const toggleMobileVisibility = async (item: 'title' | 'search', visible: boolean) => {
    const activeItems = itemsOrder.filter(x => {
      if (x === item) return visible;
      const currentActive = [leftElement, centerElement].filter(y => y !== 'none');
      return currentActive.includes(x);
    });
    
    const newLeft = activeItems[0] || 'none';
    const newCenter = activeItems[1] || 'none';
    
    setLeftElement(newLeft);
    setCenterElement(newCenter);
    await updateConfig({
      headerLayoutMobile: { left: newLeft, center: newCenter }
    });
  };

  const moveItem = async (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= itemsOrder.length) return;
    
    const newOrder = [...itemsOrder];
    const temp = newOrder[index];
    newOrder[index] = newOrder[newIndex];
    newOrder[newIndex] = temp;

    setItemsOrder(newOrder);

    const activeItems = newOrder.filter(x => {
      const currentActive = [leftElement, centerElement].filter(y => y !== 'none');
      return currentActive.includes(x);
    });

    const newLeft = activeItems[0] || 'none';
    const newCenter = activeItems[1] || 'none';

    setLeftElement(newLeft);
    setCenterElement(newCenter);
    await updateConfig({
      headerLayoutMobile: { left: newLeft, center: newCenter }
    });
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        
        {/* En-tête Mobile */}
        <SettingsAccordion
          title={t("Disposition de l'En-tête Mobile")}
          description={t("Gérez la position des éléments en haut de l'écran")}
          icon={<Layers size={18} />}
          isOpen={openAccordions.includes('mobile-layout')}
          onToggle={() => toggleAccordion('mobile-layout')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
              <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>{t("Titre de l'application (Mobile)")}</h4>
              <input type="text" className="nd-input" value={titleMobile} onChange={(e) => setTitleMobile(e.target.value)} onBlur={() => updateConfig({ titleMobile })} placeholder={t("Laissez vide pour utiliser le titre principal")} style={{ fontSize: '0.75rem', padding: '6px 10px', width: '100%', marginTop: '8px' }} />
            </div>

            <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
              <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>{t("Gestion des Éléments")}</h4>
              <p style={{ margin: '4px 0 16px 0', fontSize: '0.7rem', color: 'var(--nd-text-muted)' }}>
                {t("Activez/désactivez les éléments et utilisez les flèches pour définir leur ordre de gauche à droite. L'élément Menu est toujours épinglé à droite.")}
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {itemsOrder.map((item, i) => {
                  const currentLayout = [leftElement, centerElement].filter(x => x !== 'none');
                  const isHidden = !currentLayout.includes(item);
                  const toggleAction = (val: boolean) => toggleMobileVisibility(item, val);

                  const label = item === 'title' ? t('Titre / Logo') : t('Barre de Recherche');
                  const zoneLabel = i === 0 ? t('Zone Gauche') : t('Zone Centrale');

                  return (
                    <div key={item} style={{ display: 'flex', flexDirection: 'column', padding: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                        <ToggleSwitch 
                          checked={!isHidden}
                          onChange={toggleAction}
                          label={label}
                          sublabel={!isHidden ? t('header.displayedIn', { zone: zoneLabel }) : t("Masqué")}
                        />
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', opacity: !isHidden ? 1 : 0.5, transition: 'opacity 0.2s', flexWrap: 'wrap' }}>
                          <button onClick={() => moveItem(i, -1)} disabled={i === 0} style={{ padding: '6px 10px', background: 'var(--nd-bg-alt)', border: '1px solid var(--nd-card-border)', borderRadius: '6px', cursor: i === 0 ? 'not-allowed' : 'pointer', color: i === 0 ? 'var(--nd-text-muted)' : 'var(--nd-text)', opacity: i === 0 ? 0.3 : 1, display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }} title={t("Monter")}>
                            {t("↑ Monter")}
                          </button>
                          <button onClick={() => moveItem(i, 1)} disabled={i === 1} style={{ padding: '6px 10px', background: 'var(--nd-bg-alt)', border: '1px solid var(--nd-card-border)', borderRadius: '6px', cursor: i === 1 ? 'not-allowed' : 'pointer', color: i === 1 ? 'var(--nd-text-muted)' : 'var(--nd-text)', opacity: i === 1 ? 0.3 : 1, display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }} title={t("Descendre")}>
                            {t("Descendre ↓")}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <p style={{ margin: '0', fontSize: '0.7rem', color: 'var(--nd-text-muted)' }}>
              {t("Le bouton du menu principal reste toujours accessible à droite de l'écran.")}
            </p>
          </div>
        </SettingsAccordion>

        {/* Configuration Mobile */}
        <SettingsAccordion
          title={t("Apparence Spéciale Mobile")}
          description={t("Surchargez les paramètres globaux (thème, fond, géométrie)")}
          icon={<Monitor size={18} />}
          isOpen={openAccordions.includes('mobile')}
          onToggle={() => toggleAccordion('mobile')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
              <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, marginBottom: '8px' }}>{t("Thème (Mobile)")}</h4>
              <CustomSelect
                value={mobileTheme}
                onChange={(val: string) => { setMobileTheme(val); updateConfig({ mobileTheme: val }); }}
                options={[
                  { value: '', label: t("Hériter du thème Desktop") },
                  ...Object.keys(THEME_PRESETS).map(themeKey => ({ value: themeKey, label: t(THEME_PRESETS[themeKey].name) }))
                ]}
              />
            </div>

            <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
              <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, marginBottom: '8px' }}>{t("Fonds d'écran personnalisés (Mobile)")}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    className="nd-input"
                    placeholder={t("https://example.com/mobile-bg.jpg ou fichier importé")}
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
                
                {demoMode ? (
                  <div style={{ fontSize: '0.68rem', color: 'var(--nd-text-muted)' }}>{t("Import de fond mobile désactivé dans la démo publique.")}</div>
                ) : (
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
                    {t("📁 Importer une image mobile")}
                  </label>
                </div>
                )}

                {uploadedBgs.length > 0 && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed var(--nd-card-border)' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--nd-text-muted)', display: 'block', marginBottom: '8px' }}>
                      {t("Galerie des fonds importés")}
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
              <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, marginBottom: '8px' }}>{t("Personnalisation Visuelle (Mobile)")}</h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)', marginBottom: 4, display: 'block' }}>{t("Typographie globale (Mobile)")}</label>
                  <CustomSelect
                    value={mobileGlobalFont}
                    onChange={(val: string) => { setMobileGlobalFont(val); updateConfig({ mobileGlobalFont: val }); }}
                    options={[
                      { value: '', label: t("Hériter de Desktop") },
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
                  <label style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)', marginBottom: 4, display: 'block' }}>{t("Animation du titre (Mobile)")}</label>
                  <CustomSelect
                    value={mobileTitleAnimation}
                    onChange={(val: string) => { setMobileTitleAnimation(val); updateConfig({ mobileTitleAnimation: val }); }}
                    options={[
                      { value: '', label: t("Hériter de Desktop") },
                      { value: 'none', label: 'Aucune' },
                      { value: 'spotlight-silver', label: t("Balayage Argenté (Silver)") },
                    ]}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label className="nd-label" style={{ fontSize: '0.72rem', color: 'var(--nd-text)', margin: 0 }}>
                      {t("Arrondi des cartes (Mobile)")}
                    </label>
                    <span style={{ fontSize: '0.7rem', color: 'var(--nd-accent)', fontWeight: 600 }}>
                      {mobileBorderRadius === '' ? t("Hérité") : `${mobileBorderRadius}px`}
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
                      {t("Opacité du fond des cartes (Mobile)")}
                    </label>
                    <span style={{ fontSize: '0.7rem', color: 'var(--nd-accent)', fontWeight: 600 }}>
                      {mobileCardOpacity === '' ? t("Hérité") : `${Math.round((mobileCardOpacity as number) * 100)}%`}
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
              <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>{t("Profils d'Apparence Mobile")}</h4>
              <p style={{ margin: '4px 0 12px 0', fontSize: '0.7rem', color: 'var(--nd-text-muted)' }}>
                {t("Sauvegardez votre configuration mobile.")}
              </p>
              
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input
                  type="text"
                  className="nd-input"
                  placeholder={t("Nom du profil mobile...")}
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
                          {profile.settings.mobileTheme || t("Hérité")} • {profile.settings.mobileGlobalFont || t("Hérité")}
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

        {confirmDeleteMobileProfile && (
          <div className="nd-modal-overlay" style={{ zIndex: 1000002 }}>
            <div ref={profileDeleteDialogRef} role="dialog" aria-modal="true" aria-label={t("Supprimer le profil mobile")} tabIndex={-1} className="nd-modal" style={{ maxWidth: 400 }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: 'var(--nd-red)' }}>{t("Supprimer le profil mobile ?")}</h3>
              <p style={{ margin: '0 0 24px 0', fontSize: '0.85rem', color: 'var(--nd-text-muted)' }}>{t("Êtes-vous sûr de vouloir supprimer ce profil d&apos;apparence mobile ?")}</p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button className="nd-btn" onClick={() => setConfirmDeleteMobileProfile(null)}>Annuler</button>
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
                <button className="nd-btn" onClick={() => { setIsConfirmBgDeleteOpen(false); setBgToDelete(null); }}>Annuler</button>
                <button className="nd-btn nd-btn-danger" onClick={handleConfirmBgDelete}>{t("Oui, supprimer")}</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
