import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import CustomSelect from '../../../shared/CustomSelect';
import { HeaderElementDesktop } from '@/lib/types';

import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeHeading, CalmeOrderList, CalmeRow, CalmeSegmented, CalmeSwitch } from '../shared/CalmeControls';

export function HeaderTab() {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();
  const demoMode = config?.demoMode === true;
  
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

  const hidden = { title: hideHeaderTitle, search: hideHeaderSearch, menu: hideHeaderMenu } as Record<string, boolean>;
  const toggles: Record<string, (value: boolean) => void> = {
    title: value => { setHideHeaderTitle(!value); updateConfig({ hideHeaderTitle: !value }); },
    search: value => { setHideHeaderSearch(!value); updateConfig({ hideHeaderSearch: !value }); },
    menu: value => { setHideHeaderMenu(!value); updateConfig({ hideHeaderMenu: !value }); },
  };
  const names: Record<string, string> = { title: t('Titre / Logo'), search: t('Barre de Recherche'), menu: t('Menu (Onglets)') };
  const zones = [t('Zone Gauche'), t('Zone Centrale'), t('Zone Droite')];
  const uploadLogo = async (file: File) => {
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
  };
  return (
    <div className="ndc-set-page">
      <section className="ndc-set-block">
        <CalmeHeading info={t("Activez/désactivez les éléments et utilisez les flèches pour définir leur ordre de gauche à droite.")}>{t('settings.calme.elements')}</CalmeHeading>
        <CalmeOrderList
          moveUpLabel={t("Monter")}
          moveDownLabel={t("Descendre")}
          onMove={(index, direction) => { void moveItem(index, direction); }}
          items={getOrder().map((item, index) => ({
            id: item,
            label: names[item],
            sub: hidden[item] ? t("Masqué") : zones[index],
            enabled: !hidden[item],
            onToggle: toggles[item],
          }))}
        />
        <CalmeRow label={t("Mode Split Menu")} info={t("Sépare le menu des onglets en deux moitiés pour encadrer l'élément sélectionné.")}>
          <CalmeSegmented
            label={t("Mode Split Menu")}
            value={splitMenuAround}
            options={[
              { value: 'none', label: t('settings.calme.off') },
              { value: 'title', label: t('settings.calme.aroundTitle') },
              { value: 'search', label: t('settings.calme.aroundSearch') },
            ]}
            onChange={value => { void updateSplitMenu(value); }}
          />
        </CalmeRow>
        <CalmeRow label={t('settings.calme.tabIcons')} info={t("Affichez les icônes des onglets à côté de leur nom dans l'en-tête. Les icônes affichées sont celles configurées dans les paramètres du dock.")}>
          <CalmeSwitch label={t('settings.calme.tabIcons')} checked={!!config?.settings?.showHeaderMenuIcons} onChange={() => updateConfig({ showHeaderMenuIcons: !config?.settings?.showHeaderMenuIcons })} />
        </CalmeRow>
      </section>

      <section className="ndc-set-block">
        <CalmeHeading>{t('settings.calme.title')}</CalmeHeading>
        <CalmeRow label={t('settings.calme.titleText')}>
          <input type="text" className="nd-input" style={{ width: 240 }} value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => updateConfig({ title })} placeholder={t("MON HOME LAB")} aria-label={t('settings.calme.titleText')} />
        </CalmeRow>
        <CalmeRow label={t('settings.calme.logo')} info={demoMode ? t("Import de logo désactivé dans la démo publique.") : t("Logo (Remplace le texte si défini)")}>
          <input type="text" className="nd-input" style={{ width: 240 }} placeholder="https://…/logo.svg" value={titleLogo} onChange={(e) => setTitleLogo(e.target.value)} onBlur={handleSaveLogo} aria-label={t('settings.calme.logo')} />
          {titleLogo && (
            <button type="button" className="ndc-icon-button" aria-label={t("Supprimer le logo")} title={t("Supprimer le logo")} onClick={() => { setLogoToDelete(titleLogo); setIsConfirmLogoDeleteOpen(true); }}><X size={14} /></button>
          )}
          {!demoMode && (
            <label className="nd-btn" style={{ cursor: 'pointer' }}>
              {t('settings.calme.import')}
              <input type="file" accept="image/png, image/svg+xml, image/webp" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadLogo(file); e.target.value = ''; }} />
            </label>
          )}
        </CalmeRow>
        <CalmeRow label={t("Police du titre")}>
          <div style={{ width: 240 }}>
            <CustomSelect
              value={titleFont}
              onChange={(val: string) => { setTitleFont(val); updateConfig({ titleFont: val as 'outfit' | 'space-grotesk' | 'syne' | 'righteous' | 'montserrat' }); }}
              options={[
                { value: 'outfit', label: t("Outfit (Défaut, Moderne)") },
                { value: 'space-grotesk', label: t("Space Grotesk (Tech & Brut)") },
                { value: 'syne', label: t("Syne (Design & Artistique)") },
                { value: 'righteous', label: t("Righteous (Logo & Courbe)") },
                { value: 'montserrat', label: t("Montserrat (Premium & Classic)") },
              ]}
            />
          </div>
        </CalmeRow>
        <CalmeRow label={t("Animation du titre")}>
          <CalmeSegmented
            label={t("Animation du titre")}
            value={titleAnimation}
            options={[{ value: 'none', label: t("Aucune") }, { value: 'spotlight-silver', label: t('settings.calme.sweep') }]}
            onChange={value => { setTitleAnimation(value); updateConfig({ titleAnimation: value as 'none' | 'spotlight-silver' }); }}
          />
        </CalmeRow>
      </section>
      {isConfirmLogoDeleteOpen && (
        <div className="nd-modal-overlay" style={{ zIndex: 1000002 }}>
          <div ref={logoDeleteDialogRef} role="dialog" aria-modal="true" aria-label={t("Supprimer le logo")} tabIndex={-1} className="nd-modal" style={{ maxWidth: 400 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: 'var(--nd-red)' }}>{t("Supprimer le logo ?")}</h3>
            <p style={{ margin: '0 0 24px 0', fontSize: '0.85rem', color: 'var(--nd-text-muted)', lineHeight: 1.5 }}>
              {t("Êtes-vous sûr de vouloir supprimer ce logo ? S&apos;il s&apos;agit d&apos;un fichier importé, il sera définitivement effacé.")}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="nd-btn" onClick={() => { setIsConfirmLogoDeleteOpen(false); setLogoToDelete(null); }}>{t("Annuler")}</button>
              <button className="nd-btn nd-btn-danger" onClick={handleConfirmLogoDelete}>{t("Oui, supprimer")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
