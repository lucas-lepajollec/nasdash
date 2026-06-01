'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, Palette, Layers, Sliders, Clipboard, Check, 
  Monitor, Activity, Shield, Cpu, Info, CheckCircle2, ChevronRight, Container, Calendar, Trash2,
  Home, Layout, ArrowUp, ArrowDown, Eye, EyeOff, Ban, Cloud, Code
} from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useTabs } from '@/hooks/useTabs';
import { AppearanceProfile } from '@/lib/types';
import CustomSelect from '../shared/CustomSelect';
import ConfirmModal from './ConfirmModal';
import EmojiPickerModal from './EmojiPickerModal';

interface SettingsModalProps {
  onClose: () => void;
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
    primaryColor: '#0a84ff',
    accentColor: '#0a84ff',
    cardBg: 'rgba(28, 28, 30, 0.35)',
    cardBorder: 'rgba(255, 255, 255, 0.08)',
    text: '#f5f5f7',
    textMuted: '#98989d',
    bgGradient: 'linear-gradient(135deg, #020204 0%, #0d0d12 40%, #171722 100%)',
    borderRadius: '14px',
  },
  'apple-light': {
    name: 'Apple Light',
    primaryColor: '#007aff',
    accentColor: '#007aff',
    cardBg: 'rgba(255, 255, 255, 0.5)',
    cardBorder: 'rgba(255, 255, 255, 0.8)',
    text: '#1d1d1f',
    textMuted: '#86868b',
    bgGradient: 'linear-gradient(135deg, #eef1f5 0%, #e2e8f0 100%)',
    borderRadius: '14px',
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

import { ToggleSwitch, ToggleSwitchProps } from './settings/shared/ToggleSwitch';
import { SettingsAccordion, SettingsAccordionProps } from './settings/shared/SettingsAccordion';
import { SettingsSidebar } from './settings/SettingsSidebar';
import { AppearanceTab } from './settings/tabs/AppearanceTab';
import { DeveloperTab } from './settings/tabs/DeveloperTab';
import { LibraryTab } from './settings/tabs/LibraryTab';
import { TabsHomeTab } from './settings/tabs/onglets/TabsHomeTab';
import { TabsWidgetsTab } from './settings/tabs/onglets/TabsWidgetsTab';
import { TabsGeneralTab } from './settings/tabs/onglets/TabsGeneralTab';
import { DevicesWidgetTab } from './settings/tabs/widgets/DevicesWidgetTab';
import { QuickStatsWidgetTab } from './settings/tabs/widgets/QuickStatsWidgetTab';
import { TailscaleWidgetTab } from './settings/tabs/widgets/TailscaleWidgetTab';
import { DockerActionsWidgetTab } from './settings/tabs/widgets/DockerActionsWidgetTab';
import { ClockWidgetTab } from './settings/tabs/widgets/ClockWidgetTab';
import { CalendarWidgetTab } from './settings/tabs/widgets/CalendarWidgetTab';
import { WeatherWidgetTab } from './settings/tabs/widgets/WeatherWidgetTab';
import { HomeAssistantTab } from './settings/tabs/onglets/HomeAssistantTab';

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { config, updateConfig } = useConfig();
  const { tabs } = useTabs();
  
  const tabOrder = (() => {
    const savedOrder = config?.settings?.tabOrder || [];
    const savedSet = new Set(savedOrder);
    const newTabs = tabs.map(t => t.id).filter(id => !savedSet.has(id));
    return savedOrder.length > 0 ? [...savedOrder, ...newTabs] : tabs.map(t => t.id);
  })();
  const hiddenTabs = config?.settings?.hiddenTabs || [];

  const handleToggleTabHidden = async (id: string) => {
    const newHidden = hiddenTabs.includes(id) 
      ? hiddenTabs.filter((h: string) => h !== id)
      : [...hiddenTabs, id];
    await updateConfig({ hiddenTabs: newHidden });
  };

  const handleMoveTab = async (id: string, direction: 'up' | 'down') => {
    const currentIndex = tabOrder.indexOf(id);
    if (currentIndex === -1) return;
    const newOrder = [...tabOrder];
    if (direction === 'up' && currentIndex > 0) {
      [newOrder[currentIndex - 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex - 1]];
    } else if (direction === 'down' && currentIndex < newOrder.length - 1) {
      [newOrder[currentIndex + 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex + 1]];
    }
    await updateConfig({ tabOrder: newOrder });
  };
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const currentTab = activeTab || 'apparence';
  const [mode, setMode] = useState<'light' | 'dark'>('dark');
  const [theme, setTheme] = useState(config?.settings?.theme || 'nasdash');

  // Accordions states
  const [openAccordions, setOpenAccordions] = useState<string[]>(['theme']);

  const toggleAccordion = (id: string) => {
    setOpenAccordions(prev => prev.includes(id) ? [] : [id]);
  };

  // Background states
  const [title, setTitle] = useState(config?.settings?.title || 'MON HOME LAB');
  const [titleMobile, setTitleMobile] = useState(config?.settings?.titleMobile || '');
  const [titleLogo, setTitleLogo] = useState(config?.settings?.titleLogo || '');
  const [titleFont, setTitleFont] = useState(config?.settings?.titleFont || 'outfit');
  const [titleAnimation, setTitleAnimation] = useState(config?.settings?.titleAnimation || 'none');
  const [backgroundImage, setBackgroundImage] = useState(config?.settings?.backgroundImage || '');
  const [mobileWallpaper, setMobileWallpaper] = useState(config?.settings?.mobileWallpaper || '');
  
  const [mobileTheme, setMobileTheme] = useState(config?.settings?.mobileTheme || '');
  const [mobileGlobalFont, setMobileGlobalFont] = useState(config?.settings?.mobileGlobalFont || '');
  const [mobileBorderRadius, setMobileBorderRadius] = useState<number | ''>(config?.settings?.mobileBorderRadius ?? '');
  const [mobileCardOpacity, setMobileCardOpacity] = useState<number | ''>(config?.settings?.mobileCardOpacity ?? '');
  const [mobileTitleAnimation, setMobileTitleAnimation] = useState(config?.settings?.mobileTitleAnimation || '');
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

  // Design system states
  const [globalFont, setGlobalFont] = useState(config?.settings?.globalFont || 'Outfit');
  const [borderRadius, setBorderRadius] = useState(config?.settings?.borderRadius ?? 12);
  const [cardOpacity, setCardOpacity] = useState(config?.settings?.cardOpacity ?? 0.8);

  // Emoji Picker state
  const [iconPickerTabId, setIconPickerTabId] = useState<string | null>(null);

  // Widget positioning & ordering states
  const [devicesSidebar, setDevicesSidebar] = useState(config?.settings?.devicesSidebar || 'left');
  const [devicesOrder, setDevicesOrder] = useState(config?.settings?.devicesOrder ?? 0);

  const [quickStatsSidebar, setQuickStatsSidebar] = useState(config?.settings?.quickStatsSidebar || 'right');
  const [quickStatsOrder, setQuickStatsOrder] = useState(config?.settings?.quickStatsOrder ?? 1);

  const [tailscaleSidebar, setTailscaleSidebar] = useState(config?.settings?.tailscaleSidebar || 'right');
  const [tailscaleOrder, setTailscaleOrder] = useState(config?.settings?.tailscaleOrder ?? 2);

  const [dockerActionsSidebar, setDockerActionsSidebar] = useState(config?.settings?.dockerActionsSidebar || 'right');
  const [dockerActionsOrder, setDockerActionsOrder] = useState(config?.settings?.dockerActionsOrder ?? 3);

  const [clockSidebar, setClockSidebar] = useState(config?.settings?.clockSidebar || 'left');
  const [clockOrder, setClockOrder] = useState(config?.settings?.clockOrder ?? -1);
  const [clockDesign, setClockDesign] = useState(config?.settings?.clockDesign || 'default');
  const [clockTimezone, setClockTimezone] = useState(config?.settings?.clockTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone);

  const [calendarSidebar, setCalendarSidebar] = useState(config?.settings?.calendarSidebar || 'left');
  const [calendarOrder, setCalendarOrder] = useState(config?.settings?.calendarOrder ?? -2);

  // Sidebar visibility states
  const hideDevices = !!config?.settings?.hideDevices;
  const hideQuickStats = !!config?.settings?.hideQuickStats;
  const hideTailscaleStatus = !!config?.settings?.hideTailscaleStatus;
  const hideDockerActions = config?.settings?.hideDockerActions ?? true;
  const hideClock = config?.settings?.hideClock ?? false;
  const hideCalendar = config?.settings?.hideCalendar ?? true;
  const hideWeather = config?.settings?.hideWeather ?? false;

  const [weatherWidgetStyle, setWeatherWidgetStyle] = useState<'default' | 'currentOnly' | 'minimal' | 'extended'>(config?.settings?.weatherWidgetStyle || 'default');
  const [weatherSearchQuery, setWeatherSearchQuery] = useState('');
  const [weatherSearchResults, setWeatherSearchResults] = useState<any[]>([]);
  const [isSearchingWeather, setIsSearchingWeather] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [cityToDelete, setCityToDelete] = useState<{id: string, name: string} | null>(null);
  const [hideWidgetTitles, setHideWidgetTitles] = useState(config?.settings?.hideWidgetTitles ?? false);
  const [calendarUrl, setCalendarUrl] = useState(config?.settings?.calendarUrl || '');

  const [tailscaleTailnet, setTailscaleTailnet] = useState(config?.settings?.tailscaleTailnet || '');
  const [tailscaleClientId, setTailscaleClientId] = useState(config?.settings?.tailscaleClientId || '');
  const [tailscaleClientSecret, setTailscaleClientSecret] = useState(config?.settings?.tailscaleClientSecret ? '********' : '');

  // Modal / status states
  const [copied, setCopied] = useState(false);
  const [isConfirmBgDeleteOpen, setIsConfirmBgDeleteOpen] = useState(false);
  const [isConfirmLogoDeleteOpen, setIsConfirmLogoDeleteOpen] = useState(false);
  const [logoToDelete, setLogoToDelete] = useState<string | null>(null);
  const [isWidgetsMenuOpen, setIsWidgetsMenuOpen] = useState(false);
  const [isTabsMenuOpen, setIsTabsMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (config) {
      setGlobalFont(config.settings?.globalFont || 'Outfit');
      setBorderRadius(config.settings?.borderRadius ?? 12);
      setCardOpacity(config.settings?.cardOpacity ?? 0.8);
      setDevicesSidebar(config.settings?.devicesSidebar || 'left');
      setDevicesOrder(config.settings?.devicesOrder ?? 0);
      setQuickStatsSidebar(config.settings?.quickStatsSidebar || 'right');
      setQuickStatsOrder(config.settings?.quickStatsOrder ?? 1);
      setTailscaleSidebar(config.settings?.tailscaleSidebar || 'right');
      setTailscaleOrder(config.settings?.tailscaleOrder ?? 2);
      setDockerActionsSidebar(config.settings?.dockerActionsSidebar || 'right');
      setDockerActionsOrder(config.settings?.dockerActionsOrder ?? 3);
      setClockSidebar(config.settings?.clockSidebar || 'left');
      setClockOrder(config.settings?.clockOrder ?? -1);
      setClockDesign(config.settings?.clockDesign || 'default');
      setClockTimezone(config.settings?.clockTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
      setWeatherWidgetStyle(config.settings?.weatherWidgetStyle || 'default');
      if (config.settings?.calendarSidebar !== undefined) setCalendarSidebar(config.settings.calendarSidebar);
      if (config.settings?.calendarOrder !== undefined) setCalendarOrder(config.settings.calendarOrder);
      if (config.settings?.calendarUrl !== undefined) setCalendarUrl(config.settings.calendarUrl);
      if (config.settings?.tailscaleTailnet !== undefined) setTailscaleTailnet(config.settings.tailscaleTailnet);
      if (config.settings?.tailscaleClientId !== undefined) setTailscaleClientId(config.settings.tailscaleClientId);
      if (config.settings?.tailscaleClientSecret !== undefined) setTailscaleClientSecret(config.settings.tailscaleClientSecret ? '********' : '');
      if (config.settings?.title !== undefined) setTitle(config.settings.title);
      if (config.settings?.titleMobile !== undefined) setTitleMobile(config.settings.titleMobile);
      if (config.settings?.titleLogo !== undefined) setTitleLogo(config.settings.titleLogo);
      if (config.settings?.titleFont !== undefined) setTitleFont(config.settings.titleFont);
      if (config.settings?.titleAnimation !== undefined) setTitleAnimation(config.settings.titleAnimation);
      if (config.settings?.backgroundImage !== undefined) {
        setBackgroundImage(config.settings.backgroundImage);
      }
      if (config.settings?.mobileWallpaper !== undefined) {
        setMobileWallpaper(config.settings.mobileWallpaper);
      }
      if (config.settings?.mobileTheme !== undefined) setMobileTheme(config.settings.mobileTheme);
      if (config.settings?.mobileGlobalFont !== undefined) setMobileGlobalFont(config.settings.mobileGlobalFont);
      if (config.settings?.mobileBorderRadius !== undefined) setMobileBorderRadius(config.settings.mobileBorderRadius);
      if (config.settings?.mobileCardOpacity !== undefined) setMobileCardOpacity(config.settings.mobileCardOpacity);
      if (config.settings?.mobileTitleAnimation !== undefined) setMobileTitleAnimation(config.settings.mobileTitleAnimation);
      if (config.appearanceProfiles) {
        setAppearanceProfiles(config.appearanceProfiles);
      }
      if (config.settings?.mobileAppearanceProfiles) {
        setMobileAppearanceProfiles(config.settings.mobileAppearanceProfiles);
      }
    }
  }, [config]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth > 580) {
      setActiveTab('apparence');
    }
  }, []);

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
    // Reconstruct --nd-card-bg directly so the change is immediate
    const rgb = getComputedStyle(document.body).getPropertyValue('--nd-card-bg-rgb').trim();
    if (rgb) {
      document.body.style.setProperty('--nd-card-bg', `rgba(${rgb}, ${val})`);
    }
  };

  const handleOpacitySave = async (val: number) => {
    await updateConfig({ cardOpacity: val });
  };

  const handleWidgetPosition = async (widgetKey: string, sidebar: 'left' | 'right') => {
    if (widgetKey === 'devices') {
      setDevicesSidebar(sidebar);
      await updateConfig({ devicesSidebar: sidebar });
    } else if (widgetKey === 'quickstats') {
      setQuickStatsSidebar(sidebar);
      await updateConfig({ quickStatsSidebar: sidebar });
    } else if (widgetKey === 'tailscale') {
      setTailscaleSidebar(sidebar);
      await updateConfig({ tailscaleSidebar: sidebar });
    } else if (widgetKey === 'dockeractions') {
      setDockerActionsSidebar(sidebar);
      await updateConfig({ dockerActionsSidebar: sidebar });
    } else if (widgetKey === 'clock') {
      setClockSidebar(sidebar);
      await updateConfig({ clockSidebar: sidebar });
    } else if (widgetKey === 'calendar') {
      setCalendarSidebar(sidebar);
      await updateConfig({ calendarSidebar: sidebar });
    }
  };

  const handleWidgetOrder = async (widgetKey: string, order: number) => {
    if (widgetKey === 'devices') {
      setDevicesOrder(order);
      await updateConfig({ devicesOrder: order });
    } else if (widgetKey === 'quickstats') {
      setQuickStatsOrder(order);
      await updateConfig({ quickStatsOrder: order });
    } else if (widgetKey === 'tailscale') {
      setTailscaleOrder(order);
      await updateConfig({ tailscaleOrder: order });
    } else if (widgetKey === 'dockeractions') {
      setDockerActionsOrder(order);
      await updateConfig({ dockerActionsOrder: order });
    } else if (widgetKey === 'clock') {
      setClockOrder(order);
      await updateConfig({ clockOrder: order });
    } else if (widgetKey === 'calendar') {
      setCalendarOrder(order);
      await updateConfig({ calendarOrder: order });
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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

  // Only fetch on mount or manual trigger (like upload) so gallery is stable
  useEffect(() => {
    fetchUploadedBgs();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        await fetch(`/api/logos/${filename}`, {
          method: 'DELETE',
        });
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
      settings: {
        theme,
        backgroundImage,
        globalFont,
        borderRadius,
        cardOpacity,
        title,
        titleLogo,
        titleFont,
        titleAnimation
      }
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
        mobileTheme,
        mobileWallpaper,
        mobileGlobalFont,
        mobileBorderRadius: typeof mobileBorderRadius === 'number' ? mobileBorderRadius : undefined,
        mobileCardOpacity: typeof mobileCardOpacity === 'number' ? mobileCardOpacity : undefined,
        titleMobile,
        mobileTitleAnimation,
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

  const handleToggleWidget = async (key: string, value: boolean) => {
    await updateConfig({ [key]: value });
  };


  // Generate Home Assistant Lovelace Exporter Theme
  const currentTheme = config?.settings?.theme || 'nasdash';
  const activePreset = THEME_PRESETS[currentTheme] || THEME_PRESETS.nasdash;
  const isLight = currentTheme === 'apple-light';
  const haYamlTheme = `nasdash_${currentTheme.replace('-', '_')}:
  # Base Backgrounds
  background-image: "${activePreset.bgGradient}"
  lovelace-background: "var(--background-image)"

  # Main Layout Colors
  primary-color: "${activePreset.primaryColor}"
  accent-color: "${activePreset.accentColor}"
  
  # Text Colors
  primary-text-color: "${activePreset.text}"
  secondary-text-color: "${activePreset.textMuted}"
  disabled-text-color: "${isLight ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.3)'}"
  
  # Lovelace Cards (Glassmorphism preset)
  ha-card-background: "${activePreset.cardBg}"
  ha-card-border-color: "${activePreset.cardBorder}"
  ha-card-border-width: "1px"
  ha-card-border-radius: "${activePreset.borderRadius}"
  
  # Sidebar Menu & Headers
  sidebar-background-color: "${activePreset.cardBg}"
  sidebar-icon-color: "${activePreset.textMuted}"
  sidebar-selected-icon-color: "${activePreset.primaryColor}"
  app-header-background-color: "${activePreset.cardBg}"
  app-header-text-color: "${activePreset.text}"`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(haYamlTheme);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const searchWeatherCity = async () => {
    if (!weatherSearchQuery.trim()) return;
    setIsSearchingWeather(true);
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(weatherSearchQuery)}&count=5&language=fr&format=json`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setWeatherSearchResults(data.results || []);
    } catch (e) {
      console.error(e);
      setWeatherSearchResults([]);
    } finally {
      setIsSearchingWeather(false);
    }
  };

  const selectWeatherCity = async (city: any) => {
    const newId = Math.random().toString(36).substring(2, 9);
    const loc = { id: newId, lat: city.latitude, lon: city.longitude, name: city.name };
    const currentLocations = config?.settings?.weatherLocations || [];
    
    // Migrate old single location if present and list is empty
    if (currentLocations.length === 0 && config?.settings?.weatherLocation) {
      currentLocations.push({ id: 'legacy-1', ...config.settings.weatherLocation });
    }

    const newLocations = [...currentLocations, loc];
    
    // Set as active if it's the first one
    const newActiveId = currentLocations.length === 0 ? newId : (config?.settings?.activeWeatherLocationId || currentLocations[0]?.id || newId);

    await updateConfig({ 
      weatherLocations: newLocations,
      activeWeatherLocationId: newActiveId
    });
    
    setWeatherSearchResults([]);
    setWeatherSearchQuery('');
  };

  const removeWeatherCity = async (idToRemove: string) => {
    const currentLocations = config?.settings?.weatherLocations || [];
    const newLocations = currentLocations.filter(loc => loc.id !== idToRemove);
    
    let newActiveId = config?.settings?.activeWeatherLocationId;
    if (newActiveId === idToRemove) {
      newActiveId = newLocations.length > 0 ? newLocations[0].id : undefined;
    }

    await updateConfig({ 
      weatherLocations: newLocations,
      activeWeatherLocationId: newActiveId
    });
  };

  const setActiveWeatherCity = async (id: string) => {
    await updateConfig({ activeWeatherLocationId: id });
  };

  return (
    <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div 
        className={`nd-modal nd-settings-modal nd-animate-in ${activeTab ? 'nd-settings-modal--detail' : 'nd-settings-modal--menu'}`}
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          background: 'var(--nd-card-bg)',
        }}
      >
        {/* ==========================================
           LEFT SIDEBAR
           ========================================== */}
        <SettingsSidebar 
          currentTab={currentTab}
          setActiveTab={setActiveTab}
          onClose={onClose}
        />

        {isConfirmLogoDeleteOpen && (
          <div className="nd-modal-overlay" style={{ zIndex: 1000002 }}>
            <div className="nd-modal" style={{ maxWidth: 400 }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: 'var(--nd-red)' }}>Supprimer le logo ?</h3>
              <p style={{ margin: '0 0 24px 0', fontSize: '0.85rem', color: 'var(--nd-text-muted)', lineHeight: 1.5 }}>
                Êtes-vous sûr de vouloir supprimer ce logo ? S'il s'agit d'un fichier importé, il sera définitivement effacé du serveur.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button className="nd-btn" onClick={() => { setIsConfirmLogoDeleteOpen(false); setLogoToDelete(null); }}>Annuler</button>
                <button className="nd-btn nd-btn-danger" onClick={handleConfirmLogoDelete}>Oui, supprimer</button>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
           RIGHT CONTENT WRAPPER
           ========================================== */}
        <div className="nd-settings-content">
          
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexShrink: 0, gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
              <button 
                className="nd-settings-back-btn" 
                onClick={() => setActiveTab(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--nd-card-border)',
                  borderRadius: 'var(--nd-card-radius)',
                  color: 'var(--nd-text)',
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                ← Retour
              </button>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentTab === 'apparence' && '🎨 Apparence, Fonds & CSS'}
                {currentTab === 'developer' && '⚙️ Menu Développeur'}
                {currentTab === 'library' && '🎛️ Bibliothèque Globale des Widgets'}
                {currentTab === 'tabs-general' && '🌐 Général (Dock & Onglets)'}
                {currentTab === 'tabs-home' && '🏠 Paramètres — Onglet Home'}
                {currentTab === 'tabs-widgets' && '🧩 Paramètres — Onglet Widgets'}
                {currentTab === 'widget-devices' && '🖥️ Configuration — Appareils'}
                {currentTab === 'widget-quickstats' && '📊 Configuration — Vue d\'ensemble'}
                {currentTab === 'widget-tailscale' && '🛡️ Configuration — VPN Tailscale'}
                {currentTab === 'widget-dockeractions' && '🐳 Configuration — Actions Docker'}
                {currentTab === 'widget-clock' && '🕒 Configuration — Horloge / Date'}
                {currentTab === 'widget-calendar' && '📅 Configuration — Calendrier'}
                {currentTab === 'widget-weather' && '☁️ Configuration — Météo'}
                {currentTab === 'homeassistant' && '🏠 Export Lovelace Home Assistant'}
              </h3>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nd-text-muted)', flexShrink: 0, padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>
              <X size={18} />
            </button>
          </div>

          {/* ==========================================
             TAB 1: APPARENCE
             ========================================== */}
          {currentTab === 'apparence' && <AppearanceTab />}

          
          {/* ==========================================
             TAB: DEVELOPER
             ========================================== */}
          {currentTab === 'developer' && <DeveloperTab />}

          {/* ==========================================
             TAB 2: LIBRARY OVERVIEW (WIDGET LIBRARY)
             ========================================== */}
          {currentTab === 'library' && <LibraryTab setActiveTab={setActiveTab} />}

          {/* ==========================================
             TAB 3: WIDGET-DEVICES PAGE
             ========================================== */}
          {(currentTab as string) === 'tabs-home' && <TabsHomeTab />}

          {(currentTab as string) === 'tabs-widgets' && <TabsWidgetsTab />}

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

          {/* ==========================================
             TAB 9: HOME ASSISTANT
             ========================================== */}
          {currentTab === 'homeassistant' && <HomeAssistantTab />}

        </div>
      </div>

      {iconPickerTabId && (
        <EmojiPickerModal
          title={`Icône de l'onglet ${tabs.find(t => t.id === iconPickerTabId)?.name || ''}`}
          initialEmoji={config?.settings?.tabIcons?.[iconPickerTabId] !== undefined ? config?.settings?.tabIcons?.[iconPickerTabId] : (tabs.find(t => t.id === iconPickerTabId)?.icon || '')}
          onSelect={(emoji) => {
            updateConfig({ tabIcons: { ...(config?.settings?.tabIcons || {}), [iconPickerTabId]: emoji } });
          }}
          onClose={() => setIconPickerTabId(null)}
        />
      )}

      {/* Background deletion Custom Confirmation Portal */}
      <ConfirmModal
        isOpen={isConfirmBgDeleteOpen}
        onClose={() => {
          setIsConfirmBgDeleteOpen(false);
          setBgToDelete(null);
        }}
        onConfirm={handleConfirmBgDelete}
        title="Supprimer le fond d'écran ?"
        description="Si ce fond d'écran est une image importée localement depuis votre appareil, le fichier image sera définitivement effacé de votre serveur de stockage. Souhaitez-vous continuer ?"
        confirmLabel="Oui, supprimer"
        cancelLabel="Annuler"
      />

      {/* Mobile Profile Delete Confirmation */}
      {confirmDeleteMobileProfile && (
        <ConfirmModal
          isOpen={true}
          title="Supprimer le profil mobile"
          description={`Êtes-vous sûr de vouloir supprimer le profil mobile "${mobileAppearanceProfiles.find(p => p.id === confirmDeleteMobileProfile)?.name}" ? Cette action est irréversible.`}
          onConfirm={() => handleDeleteMobileProfile(confirmDeleteMobileProfile)}
          onClose={() => setConfirmDeleteMobileProfile(null)}
        />
      )}

      {/* Profile Delete Confirmation */}
      {confirmDeleteProfile && (
        <ConfirmModal
          isOpen={true}
          title="Supprimer le profil"
          description={`Êtes-vous sûr de vouloir supprimer le profil "${appearanceProfiles.find(p => p.id === confirmDeleteProfile)?.name}" ? Cette action est irréversible.`}
          onConfirm={() => handleDeleteProfile(confirmDeleteProfile)}
          onClose={() => setConfirmDeleteProfile(null)}
        />
      )}
      {/* City Delete Confirmation */}
      {cityToDelete && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setCityToDelete(null)}
          onConfirm={() => {
            if (cityToDelete) {
              removeWeatherCity(cityToDelete.id);
              setCityToDelete(null);
            }
          }}
          title="Supprimer la ville ?"
          description={`Voulez-vous vraiment supprimer la ville de ${cityToDelete.name} ?`}
          confirmLabel="Supprimer"
          cancelLabel="Annuler"
        />
      )}
    </div>
  );
}
