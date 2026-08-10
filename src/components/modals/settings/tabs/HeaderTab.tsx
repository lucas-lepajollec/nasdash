import React, { useState, useEffect } from 'react';
import { Layers, Image as ImageIcon, Eye, SplitSquareHorizontal, X, Ban } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useTabs } from '@/hooks/useTabs';
import CustomSelect from '../../../shared/CustomSelect';
import { SettingsAccordion } from '../shared/SettingsAccordion';
import { HeaderElementDesktop } from '@/lib/types';

import { ToggleSwitch } from '../shared/ToggleSwitch';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';

export function HeaderTab() {
  const { config, updateConfig } = useConfig();
  
  const [openAccordions, setOpenAccordions] = useState<string[]>(['header-layout']);

  const toggleAccordion = (id: string) => {
    setOpenAccordions(prev => prev.includes(id) ? [] : [id]);
  };

  // Visibility states
  const [hideHeaderTitle, setHideHeaderTitle] = useState(false);
  const [hideHeaderSearch, setHideHeaderSearch] = useState(false);
  const [hideHeaderMenu, setHideHeaderMenu] = useState(false);

  // Layout Desktop
  const [leftElement, setLeftElement] = useState<HeaderElementDesktop>('title');
  const [centerElement, setCenterElement] = useState<HeaderElementDesktop>('search');
  const [rightElement, setRightElement] = useState<HeaderElementDesktop>('menu');
  const [splitMenuAround, setSplitMenuAround] = useState<'title' | 'search' | 'none'>('none');

  // Title & Logo
  const [title, setTitle] = useState('MON HOME LAB');
  const [titleLogo, setTitleLogo] = useState('');
  const [titleFont, setTitleFont] = useState<string>('outfit');
  const [titleAnimation, setTitleAnimation] = useState<string>('none');

  const [isConfirmLogoDeleteOpen, setIsConfirmLogoDeleteOpen] = useState(false);
  const [logoToDelete, setLogoToDelete] = useState<string | null>(null);
  const logoDeleteDialogRef = useDialogAccessibility(
    () => { setIsConfirmLogoDeleteOpen(false); setLogoToDelete(null); },
    isConfirmLogoDeleteOpen,
  );

  useEffect(() => {
    if (config) {
      setHideHeaderTitle(!!config.settings?.hideHeaderTitle);
      setHideHeaderSearch(!!config.settings?.hideHeaderSearch);
      setHideHeaderMenu(!!config.settings?.hideHeaderMenu);

      const hl = config.settings?.headerLayoutDesktop || { left: 'title', center: 'search', right: 'menu', splitMenuAround: 'none' };
      setLeftElement(hl.left || 'title');
      setCenterElement(hl.center || 'search');
      setRightElement(hl.right || 'menu');
      setSplitMenuAround(hl.splitMenuAround || 'none');

      if (config.settings?.title !== undefined) setTitle(config.settings.title);
      if (config.settings?.titleLogo !== undefined) setTitleLogo(config.settings.titleLogo);
      if (config.settings?.titleFont !== undefined) setTitleFont(config.settings.titleFont);
      if (config.settings?.titleAnimation !== undefined) setTitleAnimation(config.settings.titleAnimation);
    }
  }, [config]);

  const getOrder = () => {
    const defaultItems = ['title', 'search', 'menu'];
    const current = [leftElement, centerElement, rightElement].filter(x => x !== 'none');
    defaultItems.forEach(item => { if (!current.includes(item as any)) current.push(item as any); });
    return current as HeaderElementDesktop[];
  };

  const moveItem = async (index: number, direction: -1 | 1) => {
    const currentOrder = getOrder();
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= currentOrder.length) return;
    
    const temp = currentOrder[index];
    currentOrder[index] = currentOrder[newIndex];
    currentOrder[newIndex] = temp;

    setLeftElement(currentOrder[0]);
    setCenterElement(currentOrder[1]);
    setRightElement(currentOrder[2]);

    await updateConfig({
      headerLayoutDesktop: {
        left: currentOrder[0],
        center: currentOrder[1],
        right: currentOrder[2],
        splitMenuAround
      }
    });
  };

  const updateSplitMenu = async (val: 'title' | 'search' | 'none') => {
    setSplitMenuAround(val);
    await updateConfig({
      headerLayoutDesktop: {
        left: leftElement,
        center: centerElement,
        right: rightElement,
        splitMenuAround: val
      }
    });
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

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        
        {/* Layout & Visibility */}
        <SettingsAccordion
          title="Disposition et Visibilité (Desktop)"
          description="Organisez l'en-tête de votre Dashboard"
          icon={<SplitSquareHorizontal size={18} />}
          isOpen={openAccordions.includes('header-layout')}
          onToggle={() => toggleAccordion('header-layout')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
              <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>Gestion des Éléments</h4>
              <p style={{ margin: '4px 0 16px 0', fontSize: '0.7rem', color: 'var(--nd-text-muted)' }}>
                Activez/désactivez les éléments et utilisez les flèches pour définir leur ordre de gauche à droite.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {getOrder().map((item, i) => {
                  const isHidden = item === 'title' ? hideHeaderTitle : item === 'search' ? hideHeaderSearch : hideHeaderMenu;
                  const toggleAction = item === 'title' 
                    ? (val: boolean) => { setHideHeaderTitle(!val); updateConfig({ hideHeaderTitle: !val }); }
                    : item === 'search'
                    ? (val: boolean) => { setHideHeaderSearch(!val); updateConfig({ hideHeaderSearch: !val }); }
                    : (val: boolean) => { setHideHeaderMenu(!val); updateConfig({ hideHeaderMenu: !val }); };

                  const label = item === 'title' ? 'Titre / Logo' : item === 'search' ? 'Barre de Recherche' : 'Menu (Onglets)';
                  const zoneLabel = i === 0 ? 'Zone Gauche' : i === 1 ? 'Zone Centrale' : 'Zone Droite';

                  return (
                    <div key={item} style={{ display: 'flex', flexDirection: 'column', padding: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                        <ToggleSwitch 
                          checked={!isHidden}
                          onChange={toggleAction}
                          label={label}
                          sublabel={!isHidden ? `Affiché dans la ${zoneLabel}` : 'Masqué'}
                        />
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', opacity: !isHidden ? 1 : 0.5, transition: 'opacity 0.2s', flexWrap: 'wrap' }}>
                          <button onClick={() => moveItem(i, -1)} disabled={i === 0} style={{ padding: '6px 10px', background: 'var(--nd-bg-alt)', border: '1px solid var(--nd-card-border)', borderRadius: '6px', cursor: i === 0 ? 'not-allowed' : 'pointer', color: i === 0 ? 'var(--nd-text-muted)' : 'var(--nd-text)', opacity: i === 0 ? 0.3 : 1, display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }} title="Monter">
                            ↑ Monter
                          </button>
                          <button onClick={() => moveItem(i, 1)} disabled={i === 2} style={{ padding: '6px 10px', background: 'var(--nd-bg-alt)', border: '1px solid var(--nd-card-border)', borderRadius: '6px', cursor: i === 2 ? 'not-allowed' : 'pointer', color: i === 2 ? 'var(--nd-text-muted)' : 'var(--nd-text)', opacity: i === 2 ? 0.3 : 1, display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }} title="Descendre">
                            Descendre ↓
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 16 }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)', marginBottom: 4, display: 'block' }}>Mode Split Menu</label>
                <p style={{ margin: '0 0 8px 0', fontSize: '0.7rem', color: 'var(--nd-text-dimmed)' }}>
                  Sépare le menu des onglets en deux moitiés pour encadrer l'élément sélectionné.
                </p>
                <CustomSelect
                  value={splitMenuAround}
                  onChange={(val: any) => updateSplitMenu(val)}
                  options={[
                    { value: 'none', label: 'Désactivé' },
                    { value: 'title', label: 'Séparer autour du Titre' },
                    { value: 'search', label: 'Séparer autour de la Recherche' },
                  ]}
                />
              </div>

              <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--nd-card-border)' }}>
                <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, marginBottom: 8 }}>Apparence du Menu</h4>
                <p style={{ margin: '0 0 12px 0', fontSize: '0.7rem', color: 'var(--nd-text-dimmed)' }}>
                  Affichez les icônes des onglets à côté de leur nom dans l'en-tête. Les icônes affichées sont celles configurées dans les paramètres du dock.
                </p>
                <div style={{ padding: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                  <ToggleSwitch
                    checked={!!config?.settings?.showHeaderMenuIcons}
                    onChange={(val) => updateConfig({ showHeaderMenuIcons: !config?.settings?.showHeaderMenuIcons })}
                    label="Afficher les icônes"
                    sublabel={config?.settings?.showHeaderMenuIcons ? 'Icônes visibles' : 'Masquées (recommandé)'}
                  />
                </div>
              </div>

            </div>
          </div>
        </SettingsAccordion>

        {/* Titre & Logo (Migrated from Apparence) */}
        <SettingsAccordion
          title="Titre, Logo & Animations"
          description="Personnalisez le contenu de l'en-tête"
          icon={<Layers size={18} />}
          isOpen={openAccordions.includes('title')}
          onToggle={() => toggleAccordion('title')}
        >
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr' }}>
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)', marginBottom: 4, display: 'block' }}>Titre principal</label>
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
            <label style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)', marginBottom: 4, display: 'block' }}>Police du titre</label>
            <CustomSelect
              value={titleFont}
              onChange={(val: string) => { setTitleFont(val); updateConfig({ titleFont: val as any }); }}
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
              onChange={(val: string) => { setTitleAnimation(val); updateConfig({ titleAnimation: val as any }); }}
              options={[
                { value: 'none', label: 'Aucune' },
                { value: 'spotlight-silver', label: 'Balayage Argenté (Silver)' },
              ]}
            />
          </div>
        </SettingsAccordion>

        {/* Delete Modal */}
        {isConfirmLogoDeleteOpen && (
          <div className="nd-modal-overlay" style={{ zIndex: 1000002 }}>
            <div ref={logoDeleteDialogRef} role="dialog" aria-modal="true" aria-label="Supprimer le logo" tabIndex={-1} className="nd-modal" style={{ maxWidth: 400 }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: 'var(--nd-red)' }}>Supprimer le logo ?</h3>
              <p style={{ margin: '0 0 24px 0', fontSize: '0.85rem', color: 'var(--nd-text-muted)', lineHeight: 1.5 }}>
                Êtes-vous sûr de vouloir supprimer ce logo ? S&apos;il s&apos;agit d&apos;un fichier importé, il sera définitivement effacé.
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
