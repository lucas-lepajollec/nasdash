'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';

interface SettingsModalProps {
  onClose: () => void;
  restoreFocus?: () => HTMLElement | null;
  /** Privacy mode off: addresses are shown in the integration forms. */
  showSensitive?: boolean;
}

export const THEME_PRESETS: Record<string, {
  name: string;
  primaryColor: string;
  accentColor: string;
  cardBg: string;
  cardBorder: string;
  text: string;
  textMuted: string;
  bgGradient: string;
  borderRadius: string;
}> = {
  nasdash: {
    name: 'NasDash (Défaut)',
    primaryColor: '#00e5ff',
    accentColor: '#00e5ff',
    cardBg: 'rgba(22, 27, 34, 0.8)',
    cardBorder: 'rgba(255, 255, 255, 0.06)',
    text: '#e6edf3',
    textMuted: '#7d8590',
    bgGradient: 'radial-gradient(ellipse at top center, #161b22 0%, #0d1117 70%)',
    borderRadius: '12px',
  },
  'apple-dark': {
    name: 'Apple Dark',
    primaryColor: '#2997ff',
    accentColor: '#2997ff',
    cardBg: 'rgba(28, 28, 30, 0.95)',
    cardBorder: 'rgba(255, 255, 255, 0.08)',
    text: '#f5f5f7',
    textMuted: '#86868b',
    bgGradient: 'linear-gradient(135deg, #000000 0%, #0c0c0e 50%, #161618 100%)',
    borderRadius: '20px',
  },
  'apple-light': {
    name: 'Apple Light',
    primaryColor: '#0071e3',
    accentColor: '#0071e3',
    cardBg: '#ffffff',
    cardBorder: 'rgba(0, 0, 0, 0.05)',
    text: '#1d1d1f',
    textMuted: '#6e6e73',
    bgGradient: 'linear-gradient(135deg, #f5f5f7 0%, #ebebeb 100%)',
    borderRadius: '20px',
  },
  'rose-pine-dawn': {
    name: 'Rosé Pine Dawn',
    primaryColor: '#d7827e',
    accentColor: '#d7827e',
    cardBg: '#fffaf3',
    cardBorder: '#e8dfd5',
    text: '#464261',
    textMuted: '#6e6a86',
    bgGradient: 'linear-gradient(135deg, #faf4ed 0%, #f4ece1 100%)',
    borderRadius: '14px',
  },
  'solarized-light': {
    name: 'Solarized Light',
    primaryColor: '#268bd2',
    accentColor: '#268bd2',
    cardBg: '#eee8d5',
    cardBorder: '#d3c7a6',
    text: '#002b36',
    textMuted: '#586e75',
    bgGradient: 'linear-gradient(135deg, #fdf6e3 0%, #f4ebd0 100%)',
    borderRadius: '12px',
  },
  'catppuccin-latte': {
    name: 'Catppuccin Latte',
    primaryColor: '#8839ef',
    accentColor: '#8839ef',
    cardBg: '#e6e9ef',
    cardBorder: '#ccd0da',
    text: '#4c4f69',
    textMuted: '#6c6f85',
    bgGradient: 'linear-gradient(135deg, #eff1f5 0%, #e6e9ef 100%)',
    borderRadius: '12px',
  },
  'github-light': {
    name: 'GitHub Light',
    primaryColor: '#0969da',
    accentColor: '#0969da',
    cardBg: '#ffffff',
    cardBorder: '#d0d7de',
    text: '#1f2328',
    textMuted: '#57606a',
    bgGradient: 'linear-gradient(135deg, #f6f8fa 0%, #eaeef2 100%)',
    borderRadius: '10px',
  },
  'github-dark': {
    name: 'GitHub Dark',
    primaryColor: '#58a6ff',
    accentColor: '#58a6ff',
    cardBg: '#161b22',
    cardBorder: '#30363d',
    text: '#c9d1d9',
    textMuted: '#8b949e',
    bgGradient: 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)',
    borderRadius: '10px',
  },
  'everforest-dark': {
    name: 'Everforest Dark',
    primaryColor: '#a7c080',
    accentColor: '#a7c080',
    cardBg: '#323c41',
    cardBorder: '#414b50',
    text: '#d3c6aa',
    textMuted: '#859289',
    bgGradient: 'linear-gradient(135deg, #2b3339 0%, #323c41 100%)',
    borderRadius: '12px',
  },
  'matrix-cyber': {
    name: 'Matrix Cyber',
    primaryColor: '#00ff88',
    accentColor: '#00ff88',
    cardBg: '#0f1a14',
    cardBorder: '#1b3325',
    text: '#e0f8eb',
    textMuted: '#5ca37a',
    bgGradient: 'linear-gradient(135deg, #070c0a 0%, #0f1a14 50%, #15261d 100%)',
    borderRadius: '10px',
  },
  'everforest-light': {
    name: 'Everforest Light',
    primaryColor: '#8da101',
    accentColor: '#8da101',
    cardBg: '#fffbef',
    cardBorder: '#e0dcc9',
    text: '#5c6a72',
    textMuted: '#7f8c8d',
    bgGradient: 'linear-gradient(135deg, #f2efdf 0%, #e6e3d1 100%)',
    borderRadius: '12px',
  },
  'tokyo-night-day': {
    name: 'Tokyo Night Day',
    primaryColor: '#2e7de9',
    accentColor: '#2e7de9',
    cardBg: '#e9e9ed',
    cardBorder: '#c4c8d4',
    text: '#3760bf',
    textMuted: '#6172b0',
    bgGradient: 'linear-gradient(135deg, #e1e2e7 0%, #d5d6db 100%)',
    borderRadius: '12px',
  },
  'gruvbox-light': {
    name: 'Gruvbox Light',
    primaryColor: '#af3a03',
    accentColor: '#af3a03',
    cardBg: '#f2e5bc',
    cardBorder: '#d5c4a1',
    text: '#3c3836',
    textMuted: '#665c54',
    bgGradient: 'linear-gradient(135deg, #fbf1c7 0%, #ebdbb2 100%)',
    borderRadius: '12px',
  },
  'nord-light': {
    name: 'Nord Light',
    primaryColor: '#5e81ac',
    accentColor: '#5e81ac',
    cardBg: '#eceff4',
    cardBorder: '#c8d0e0',
    text: '#2e3440',
    textMuted: '#4c566a',
    bgGradient: 'linear-gradient(135deg, #e5e9f0 0%, #d8dee9 100%)',
    borderRadius: '12px',
  },
  'one-dark-pro': {
    name: 'One Dark Pro',
    primaryColor: '#61afef',
    accentColor: '#61afef',
    cardBg: '#282c34',
    cardBorder: '#3e4451',
    text: '#abb2bf',
    textMuted: '#828997',
    bgGradient: 'linear-gradient(135deg, #21252b 0%, #282c34 100%)',
    borderRadius: '12px',
  },
  'tokyo-night': {
    name: 'Tokyo Night',
    primaryColor: '#7aa2f7',
    accentColor: '#7aa2f7',
    cardBg: '#24283b',
    cardBorder: '#292e42',
    text: '#a9b1d6',
    textMuted: '#787c99',
    bgGradient: 'linear-gradient(135deg, #1a1b26 0%, #24283b 100%)',
    borderRadius: '12px',
  },
  'kanagawa-wave': {
    name: 'Kanagawa Wave',
    primaryColor: '#7e9cd8',
    accentColor: '#7e9cd8',
    cardBg: '#2a2a37',
    cardBorder: '#363646',
    text: '#dcd7ba',
    textMuted: '#9a9682',
    bgGradient: 'linear-gradient(135deg, #1f1f28 0%, #2a2a37 100%)',
    borderRadius: '12px',
  },
  'swiss-paper': {
    name: 'Swiss Paper Minimal',
    primaryColor: '#2563eb',
    accentColor: '#2563eb',
    cardBg: '#ffffff',
    cardBorder: '#e4e4e7',
    text: '#09090b',
    textMuted: '#27272a',
    bgGradient: 'none',
    borderRadius: '10px',
  },
  'tokyo-day': {
    name: 'Tokyo Night Day',
    primaryColor: '#34548a',
    accentColor: '#7aa2f7',
    cardBg: 'rgba(255, 255, 255, 0.92)',
    cardBorder: 'rgba(203, 213, 225, 0.8)',
    text: '#343b58',
    textMuted: '#565f89',
    bgGradient: 'linear-gradient(135deg, #e1e9e3 0%, #f5f6f8 100%)',
    borderRadius: '12px',
  },
  'catppuccin-macchiato': {
    name: 'Catppuccin Macchiato',
    primaryColor: '#8aadf4',
    accentColor: '#8aadf4',
    cardBg: 'rgba(54, 58, 79, 0.7)',
    cardBorder: 'rgba(183, 189, 248, 0.1)',
    text: '#cad3f5',
    textMuted: '#8087a2',
    bgGradient: 'linear-gradient(135deg, #181926 0%, #24273a 50%, #363a4f 100%)',
    borderRadius: '12px',
  },
  nord: {
    name: 'Nord',
    primaryColor: '#88c0d0',
    accentColor: '#88c0d0',
    cardBg: 'rgba(59, 66, 82, 0.75)',
    cardBorder: 'rgba(216, 222, 233, 0.06)',
    text: '#eceff4',
    textMuted: '#8fbcbb',
    bgGradient: 'linear-gradient(135deg, #1a1c23 0%, #2e3440 60%, #3b4252 100%)',
    borderRadius: '12px',
  },
  dracula: {
    name: 'Dracula',
    primaryColor: '#ff79c6',
    accentColor: '#ff79c6',
    cardBg: 'rgba(40, 42, 54, 0.75)',
    cardBorder: 'rgba(248, 248, 242, 0.08)',
    text: '#f8f8f2',
    textMuted: '#bd93f9',
    bgGradient: 'linear-gradient(135deg, #15161c 0%, #282a36 60%, #373948 100%)',
    borderRadius: '12px',
  },
  ocean: {
    name: 'Ocean',
    primaryColor: '#38bdf8',
    accentColor: '#38bdf8',
    cardBg: 'rgba(15, 23, 42, 0.75)',
    cardBorder: 'rgba(56, 189, 248, 0.1)',
    text: '#f8fafc',
    textMuted: '#38bdf8',
    bgGradient: 'linear-gradient(135deg, #03060a 0%, #0f172a 50%, #1e293b 100%)',
    borderRadius: '12px',
  },
  midnight: {
    name: 'Midnight',
    primaryColor: '#ffffff',
    accentColor: '#ffffff',
    cardBg: 'rgba(10, 10, 12, 0.85)',
    cardBorder: 'rgba(255, 255, 255, 0.08)',
    text: '#ffffff',
    textMuted: '#e5e7eb',
    bgGradient: 'linear-gradient(130deg, #000000 0%, #050505 50%, #0d0d0f 100%)',
    borderRadius: '12px',
  },
  cyberpunk: {
    name: 'Cyberpunk',
    primaryColor: '#ff007f',
    accentColor: '#00e5ff',
    cardBg: 'rgba(23, 0, 38, 0.65)',
    cardBorder: 'rgba(0, 229, 255, 0.2)',
    text: '#f0e6ff',
    textMuted: '#00e5ff',
    bgGradient: 'linear-gradient(135deg, #030008 0%, #090112 40%, #1b002c 100%)',
    borderRadius: 'var(--nd-card-radius)',
  }
};

import { CalmeSettingsSidebar, useCalmeSettingsSections } from './settings/CalmeSettingsSidebar';
import { AppearanceTab } from './settings/tabs/AppearanceTab';
import { HeaderTab } from './settings/tabs/HeaderTab';
import { MobileTab } from './settings/tabs/MobileTab';
import { DeveloperTab } from './settings/tabs/DeveloperTab';
import { SecurityTab } from './settings/tabs/SecurityTab';
import { LibraryTab } from './settings/tabs/LibraryTab';
import { TabsGeneralTab } from './settings/tabs/onglets/TabsGeneralTab';
import { DevicesWidgetTab } from './settings/tabs/widgets/DevicesWidgetTab';
import { QuickStatsWidgetTab } from './settings/tabs/widgets/QuickStatsWidgetTab';
import { TailscaleWidgetTab } from './settings/tabs/widgets/TailscaleWidgetTab';
import { DockerActionsWidgetTab } from './settings/tabs/widgets/DockerActionsWidgetTab';
import { ClockWidgetTab } from './settings/tabs/widgets/ClockWidgetTab';
import { CalendarWidgetTab } from './settings/tabs/widgets/CalendarWidgetTab';
import { WeatherWidgetTab } from './settings/tabs/widgets/WeatherWidgetTab';
import { NetworkGraphWidgetTab } from './settings/tabs/widgets/NetworkGraphWidgetTab';
import { DockerContainersWidgetTab } from './settings/tabs/widgets/DockerContainersWidgetTab';
import { ServicesWidgetTab } from './settings/tabs/widgets/ServicesWidgetTab';
import { TopologyWidgetTab } from './settings/tabs/widgets/TopologyWidgetTab';
import { PagesSettingsTab } from './settings/tabs/PagesSettingsTab';
import { usePages } from '@/providers/PagesProvider';

/** Former settings sections now live elsewhere; old links keep working. */
const SETTINGS_TAB_ALIASES: Record<string, string> = {
  language: 'apparence',
  'tabs-home': 'widget-services',
  'tabs-networks': 'widget-topology',
  'tabs-docker': 'pages',
  'tabs-widgets': 'pages',
  'custom-tabs': 'pages',
  'custom-tab-builder': 'pages',
  // The wallpaper section became part of Media.
  wallpaper: 'media',
};
const resolveSettingsTab = (tab: string) => SETTINGS_TAB_ALIASES[tab] ?? tab;

import ThemeGalleryView from './ThemeGalleryView';
import { IntegrationsTab } from './settings/tabs/IntegrationsTab';
import { MediaTab } from './settings/tabs/MediaTab';
import { TasksTab } from './settings/tabs/TasksTab';
import { HelpTab } from './settings/tabs/HelpTab';
import { useI18n } from '@/i18n/I18nProvider';

export default function SettingsModal({ onClose, restoreFocus, showSensitive = false }: SettingsModalProps) {
  const dialogRef = useDialogAccessibility(onClose, true, restoreFocus);
  const { config, updateConfig, settingsModal } = useConfig();
  const { t } = useI18n();
  const calmeSections = useCalmeSettingsSections();
  const [isThemeGalleryOpen, setIsThemeGalleryOpen] = useState(false);
  const [galleryInitialTab, setGalleryInitialTab] = useState<'themes' | 'emojis'>('themes');

  const activeTheme = config?.settings?.theme || 'nasdash';
  const activeMode = config?.settings?.mode || 'dark';

  const handleGalleryThemeChange = async (newTheme: string) => {
    const LIGHT_THEMES = ['apple-light', 'github-light', 'rose-pine-dawn', 'solarized-light', 'catppuccin-latte', 'everforest-light', 'tokyo-night-day', 'gruvbox-light', 'nord-light', 'light'];
    const isLight = LIGHT_THEMES.includes(newTheme) || (newTheme === 'nasdash' && activeMode === 'light');

    const classesToRemove = Array.from(document.body.classList).filter(cls => cls.startsWith('theme-'));
    classesToRemove.forEach(cls => document.body.classList.remove(cls));
    if (newTheme !== 'nasdash') {
      document.body.classList.add(`theme-${newTheme}`);
    }

    if (isLight) {
      document.body.classList.add('light');
      localStorage.setItem('nd-theme', 'light');
    } else {
      document.body.classList.remove('light');
      localStorage.setItem('nd-theme', 'dark');
    }
    await updateConfig({ theme: newTheme, mode: isLight ? 'light' : 'dark' });
  };
  
  const { setActivePageId, startEditing, editing } = usePages();
  const [activeTab, setActiveTab] = useState<string | null>(() => {
    if (settingsModal.targetTab) return resolveSettingsTab(settingsModal.targetTab);
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('nd_settings_last_tab');
      if (saved) return resolveSettingsTab(saved);
      if (window.innerWidth > 580) return 'apparence';
    }
    return null;
  });
  const currentTab = activeTab || (typeof window !== 'undefined' && window.innerWidth > 580 ? 'apparence' : '');

  // Already open and asked for another tab (a link from a tab or a dialog).
  useEffect(() => {
    if (settingsModal.targetTab) setActiveTab(resolveSettingsTab(settingsModal.targetTab));
  }, [settingsModal.targetTab, settingsModal.targetSection]); // eslint-disable-line react-hooks/set-state-in-effect

  useEffect(() => {
    if (activeTab && typeof window !== 'undefined') {
      localStorage.setItem('nd_settings_last_tab', activeTab);
    }
  }, [activeTab]);

  return (
    <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div 
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("Paramètres NasDash")}
        tabIndex={-1}
        className={`nd-modal nd-settings-modal nd-animate-in ${activeTab ? 'nd-settings-modal--detail' : 'nd-settings-modal--menu'} ndc-settings`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ==========================================
           LEFT SIDEBAR (Hidden when gallery is open)
           ========================================== */}
        <CalmeSettingsSidebar
          sections={calmeSections}
          currentTab={currentTab}
          setActiveTab={tab => { setIsThemeGalleryOpen(false); setActiveTab(tab); }}
          onClose={onClose}
        />

        {/* ==========================================
           RIGHT CONTENT WRAPPER
           ========================================== */}
        <div className="nd-settings-content">
          
          {/* Calme header: where you are, a large title and what the section is for. */}
          {(() => {
            const section = calmeSections.find(item => item.id === currentTab);
            if (isThemeGalleryOpen) {
              const appearance = calmeSections.find(item => item.id === 'apparence');
              return (
                <div className="ndc-settings-head">
                  <button type="button" className="nd-settings-back-btn ndc-settings-back" onClick={() => setIsThemeGalleryOpen(false)}>← {t('settings.calme.back')}</button>
                  <div className="ndc-settings-crumb">{appearance?.group} / <button type="button" className="ndc-crumb-link" onClick={() => setIsThemeGalleryOpen(false)}>{appearance?.label}</button></div>
                  <h2 className="ndc-settings-title">{t('settings.calme.galleryTitle')}</h2>
                  <button type="button" className="ndc-icon-button ndc-settings-close" onClick={onClose} aria-label={t('settings.calme.close')}><X size={16} /></button>
                </div>
              );
            }
            return (
              <div className="ndc-settings-head">
                <button type="button" className="nd-settings-back-btn ndc-settings-back" onClick={() => setActiveTab(null)}>
                  ← {t('settings.calme.back')}
                </button>
                {section && (
                  <div className="ndc-settings-crumb">
                    {section.group} /{' '}
                    {section.parent && (() => {
                      const parent = calmeSections.find(item => item.id === section.parent);
                      return parent ? <><button type="button" className="ndc-crumb-link" onClick={() => setActiveTab(parent.id)}>{parent.label}</button> / </> : null;
                    })()}
                    {section.label}
                    {config?.demoMode === true && (
                      <span className="ndc-tag ndc-demo-tag" tabIndex={0} title={t("Vos modifications restent isolées à cette session de démonstration et expirent automatiquement. Les comptes, fichiers et connexions à des services réels sont désactivés : ne saisissez aucun secret personnel.")}>
                        {t('settings.calme.demoTag')}
                      </span>
                    )}
                  </div>
                )}
                <h2 className="ndc-settings-title">{section?.label}</h2>
                {section?.description && <p className="ndc-settings-desc">{section.description}</p>}
                <button type="button" className="ndc-icon-button ndc-settings-close" onClick={onClose} aria-label={t('settings.calme.close')}>
                  <X size={16} />
                </button>
              </div>
            );
          })()}


          {/* ==========================================
             THEME GALLERY FULL-WIDTH EMBEDDED VIEW
             ========================================== */}
          {isThemeGalleryOpen ? (
            <div>
              <ThemeGalleryView 
                currentTheme={activeTheme}
                onSelectTheme={handleGalleryThemeChange}
                onClose={() => setIsThemeGalleryOpen(false)}
                initialTab={galleryInitialTab}
              />
            </div>
          ) : (
            <>
              {currentTab === 'apparence' && (
                <AppearanceTab 
                  onOpenThemeGallery={(tab) => {
                    setGalleryInitialTab(tab);
                    setIsThemeGalleryOpen(true);
                  }} 
                />
              )}
              {currentTab === 'media' && (
                <MediaTab onOpenThemeGallery={(tab) => { setGalleryInitialTab(tab); setIsThemeGalleryOpen(true); }} />
              )}
              {currentTab === 'tasks' && <TasksTab />}
              {currentTab === 'help' && <HelpTab />}
              {currentTab === 'header' && <HeaderTab />}
              {currentTab === 'mobile' && <MobileTab />}

          {currentTab === 'widget-networkgraph' && <NetworkGraphWidgetTab />}
          {currentTab === 'widget-dockercontainers' && <DockerContainersWidgetTab />}

          
          {/* ==========================================
             TAB: DEVELOPER
             ========================================== */}
          {currentTab === 'developer' && <DeveloperTab />}

          {/* ==========================================
             TAB: SECURITY
             ========================================== */}
          {currentTab === 'integrations' && <IntegrationsTab targetSection={settingsModal.targetSection} onOpenTab={setActiveTab} showSensitive={showSensitive} />}
          {currentTab === 'security' && <SecurityTab />}

          {/* ==========================================
             TAB 2: LIBRARY OVERVIEW (WIDGET LIBRARY)
             ========================================== */}
          {currentTab === 'library' && <LibraryTab setActiveTab={setActiveTab} />}

          {/* ==========================================
             TAB 3: WIDGET-DEVICES PAGE
             ========================================== */}
          {currentTab === 'pages' && (
            <PagesSettingsTab
              onEditPage={pageId => {
                setActivePageId(pageId);
                if (!editing) startEditing();
                onClose();
              }}
            />
          )}

          {currentTab === 'widget-services' && <ServicesWidgetTab />}

          {currentTab === 'widget-topology' && <TopologyWidgetTab />}

          {(currentTab as string) === 'tabs-general' && <TabsGeneralTab />}

          {currentTab === 'widget-devices' && <DevicesWidgetTab />}

          {/* ==========================================
             TAB 4: WIDGET-QUICKSTATS PAGE
             ========================================== */}
          {currentTab === 'widget-quickstats' && <QuickStatsWidgetTab />}

          {/* ==========================================
             TAB 5: WIDGET-TAILSCALE PAGE
             ========================================== */}
          {currentTab === 'widget-tailscale' && <TailscaleWidgetTab />}

          {/* ==========================================
             TAB 6: WIDGET-DOCKERACTIONS PAGE
             ========================================== */}
          {currentTab === 'widget-dockeractions' && <DockerActionsWidgetTab />}

          {/* ==========================================
             TAB 7: WIDGET-CLOCK PAGE
             ========================================== */}
          {currentTab === 'widget-clock' && <ClockWidgetTab />}

          {/* ==========================================
             TAB 8: WIDGET-CALENDAR PAGE
             ========================================== */}
          {currentTab === 'widget-calendar' && <CalendarWidgetTab />}

          {/* ==========================================
             TAB WEATHER
             ========================================== */}
          {currentTab === 'widget-weather' && <WeatherWidgetTab />}

            </>
          )}
        </div>
      </div>

    </div>
  );
}
