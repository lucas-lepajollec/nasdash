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

import { ToggleSwitch, ToggleSwitchProps } from './settings/shared/ToggleSwitch';
import { SettingsAccordion, SettingsAccordionProps } from './settings/shared/SettingsAccordion';
import { SettingsSidebar } from './settings/SettingsSidebar';
import { AppearanceTab } from './settings/tabs/AppearanceTab';
import { HeaderTab } from './settings/tabs/HeaderTab';
import { MobileTab } from './settings/tabs/MobileTab';
import { DeveloperTab } from './settings/tabs/DeveloperTab';
import { SecurityTab } from './settings/tabs/SecurityTab';
import { LibraryTab } from './settings/tabs/LibraryTab';
import { TabsHomeTab } from './settings/tabs/onglets/TabsHomeTab';
import { TabsWidgetsTab } from './settings/tabs/onglets/TabsWidgetsTab';
import { TabsGeneralTab } from './settings/tabs/onglets/TabsGeneralTab';
import { TabsDockerTab } from './settings/tabs/onglets/TabsDockerTab';
import { TabsNetworksTab } from './settings/tabs/onglets/TabsNetworksTab';
import { DevicesWidgetTab } from './settings/tabs/widgets/DevicesWidgetTab';
import { QuickStatsWidgetTab } from './settings/tabs/widgets/QuickStatsWidgetTab';
import { TailscaleWidgetTab } from './settings/tabs/widgets/TailscaleWidgetTab';
import { DockerActionsWidgetTab } from './settings/tabs/widgets/DockerActionsWidgetTab';
import { ClockWidgetTab } from './settings/tabs/widgets/ClockWidgetTab';
import { CalendarWidgetTab } from './settings/tabs/widgets/CalendarWidgetTab';
import { WeatherWidgetTab } from './settings/tabs/widgets/WeatherWidgetTab';
import { NetworkGraphWidgetTab } from './settings/tabs/widgets/NetworkGraphWidgetTab';
import { DockerContainersWidgetTab } from './settings/tabs/widgets/DockerContainersWidgetTab';
import { CustomTabsListTab } from './settings/tabs/custom/CustomTabsListTab';
import { CustomTabBuilderTab } from './settings/tabs/custom/CustomTabBuilderTab';

import ThemeGalleryView from './ThemeGalleryView';

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { config, updateConfig, settingsModal } = useConfig();
  const { tabs } = useTabs();
  const [isThemeGalleryOpen, setIsThemeGalleryOpen] = useState(false);

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
  const [editingTabId, setEditingTabId] = useState<string | undefined>(settingsModal.targetCustomTabId || undefined);
  const [activeTab, setActiveTab] = useState<string | null>(() => {
    if (settingsModal.targetTab) return settingsModal.targetTab;
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('nd_settings_last_tab');
      if (saved) return saved;
      if (window.innerWidth > 580) return 'apparence';
    }
    return null;
  });
  const currentTab = activeTab || (typeof window !== 'undefined' && window.innerWidth > 580 ? 'apparence' : '');

  useEffect(() => {
    if (activeTab && typeof window !== 'undefined') {
      localStorage.setItem('nd_settings_last_tab', activeTab);
    }
  }, [activeTab]);

  const [mode, setMode] = useState<'light' | 'dark'>('dark');
  const [theme, setTheme] = useState(config?.settings?.theme || 'nasdash');

  // Accordions states
  const [openAccordions, setOpenAccordions] = useState<string[]>(['theme']);

  const toggleAccordion = (id: string) => {
    setOpenAccordions(prev => prev.includes(id) ? [] : [id]);
  };

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

  const [dockerContainersSidebar, setDockerContainersSidebar] = useState(config?.settings?.dockerContainersSidebar || 'right');
  const [dockerContainersOrder, setDockerContainersOrder] = useState(config?.settings?.dockerContainersOrder ?? 4);

  const [clockSidebar, setClockSidebar] = useState(config?.settings?.clockSidebar || 'left');
  const [clockOrder, setClockOrder] = useState(config?.settings?.clockOrder ?? -1);
  const [clockDesign, setClockDesign] = useState(config?.settings?.clockDesign || 'default');
  const [clockTimezone, setClockTimezone] = useState(config?.settings?.clockTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone);

  const [calendarSidebar, setCalendarSidebar] = useState(config?.settings?.calendarSidebar || 'left');
  const [calendarOrder, setCalendarOrder] = useState(config?.settings?.calendarOrder ?? -2);

  // Sidebar visibility states
  const hideDevices = !!config?.settings?.hideDevices;
  const hideDockerContainers = config?.settings?.hideDockerContainers ?? true;
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
  const [customTabToEdit, setCustomTabToEdit] = useState<string | null>(settingsModal.targetCustomTabId || null);

  const [tailscaleTailnet, setTailscaleTailnet] = useState(config?.settings?.tailscaleTailnet || '');
  const [tailscaleClientId, setTailscaleClientId] = useState(config?.settings?.tailscaleClientId || '');
  const [tailscaleClientSecret, setTailscaleClientSecret] = useState(config?.settings?.tailscaleClientSecret ? '********' : '');

  // Modal / status states
  const [copied, setCopied] = useState(false);

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
      setDockerContainersSidebar(config.settings?.dockerContainersSidebar || 'right');
      setDockerContainersOrder(config.settings?.dockerContainersOrder ?? 4);
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
    }
  }, [config]);

  // Removed hardcoded setActiveTab('apparence') here so we don't overwrite localStorage



  const handleToggleWidget = async (key: string, value: boolean) => {
    await updateConfig({ [key]: value });
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
           LEFT SIDEBAR (Hidden when gallery is open)
           ========================================== */}
        {!isThemeGalleryOpen && (
          <SettingsSidebar 
            currentTab={currentTab}
            setActiveTab={(tab) => {
              setIsThemeGalleryOpen(false);
              setActiveTab(tab);
            }}
            onClose={onClose}
          />
        )}

        {/* ==========================================
           RIGHT CONTENT WRAPPER
           ========================================== */}
        <div className="nd-settings-content" style={isThemeGalleryOpen ? { width: '100%', flex: 1, padding: '24px 28px' } : undefined}>
          
          {/* Header */}
          <div className="nd-settings-header" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexShrink: 0, gap: '12px 16px' }}>
            <button 
              className="nd-settings-back-btn" 
              onClick={() => {
                if (isThemeGalleryOpen) {
                  setIsThemeGalleryOpen(false);
                } else {
                  setActiveTab(null);
                }
              }}
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
              ← {isThemeGalleryOpen ? 'Apparence' : 'Retour'}
            </button>
            
            <h3 className="nd-settings-title" style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, wordBreak: 'break-word', lineHeight: 1.3 }}>
              {isThemeGalleryOpen ? '🎨 Galerie de Thèmes Visuels (26 Thèmes)' : (
                <>
                  {currentTab === 'apparence' && '🎨 Apparence, Fonds & CSS'}
                  {currentTab === 'header' && '📋 En-tête'}
                  {currentTab === 'mobile' && '📱 Mobile'}
                  {currentTab === 'developer' && '⚙️ Menu Développeur'}
                  {currentTab === 'security' && '🔑 Sécurité & Utilisateurs'}
                  {currentTab === 'library' && '🎛️ Bibliothèque Globale des Widgets'}
                  {currentTab === 'tabs-general' && '🌐 Général (Dock & Onglets)'}
                  {currentTab === 'tabs-home' && '🏠 Paramètres — Onglet Home'}
                  {currentTab === 'tabs-widgets' && '🧩 Paramètres — Onglet Widgets'}
                  {currentTab === 'tabs-docker' && '🐳 Paramètres — Onglet Docker'}
                  {currentTab === 'tabs-networks' && '📶 Paramètres — Onglet Réseaux'}
                  {currentTab === 'widget-devices' && '🖥️ Configuration — Appareils'}
                  {currentTab === 'widget-quickstats' && '📊 Configuration — Vue d\'ensemble'}
                  {currentTab === 'widget-tailscale' && '🛡️ Configuration — VPN Tailscale'}
                  {currentTab === 'widget-dockeractions' && '🐳 Configuration — Actions Docker'}
                  {currentTab === 'widget-clock' && '🕒 Configuration — Horloge / Date'}
                  {currentTab === 'widget-calendar' && '📅 Configuration — Calendrier'}
                  {currentTab === 'widget-weather' && '☁️ Configuration — Météo'}
                  {currentTab === 'widget-networkgraph' && '📶 Configuration — Graphe Réseau'}
                  {currentTab === 'widget-dockercontainers' && '🐳 Configuration — Conteneurs Docker'}
                  {currentTab === 'custom-tabs' && '🎨 Onglets Personnalisés'}
                  {currentTab === 'custom-tab-builder' && '🛠️ Éditeur d\'Onglet'}
                </>
              )}
            </h3>

            <button className="nd-settings-close-btn" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nd-text-muted)', flexShrink: 0, padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>
              <X size={18} />
            </button>
          </div>

          {/* ==========================================
             THEME GALLERY FULL-WIDTH EMBEDDED VIEW
             ========================================== */}
          {isThemeGalleryOpen ? (
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <ThemeGalleryView 
                currentTheme={activeTheme}
                onSelectTheme={handleGalleryThemeChange}
                onClose={() => setIsThemeGalleryOpen(false)}
              />
            </div>
          ) : (
            <>
              {currentTab === 'apparence' && <AppearanceTab onOpenThemeGallery={() => setIsThemeGalleryOpen(true)} />}
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
          {currentTab === 'security' && <SecurityTab />}

          {/* ==========================================
             TAB 2: LIBRARY OVERVIEW (WIDGET LIBRARY)
             ========================================== */}
          {currentTab === 'library' && <LibraryTab setActiveTab={setActiveTab} />}

          {/* ==========================================
             TAB 3: WIDGET-DEVICES PAGE
             ========================================== */}
          {(currentTab as string) === 'tabs-home' && <TabsHomeTab />}

          {(currentTab as string) === 'tabs-widgets' && <TabsWidgetsTab />}

          {(currentTab as string) === 'tabs-docker' && <TabsDockerTab />}

          {(currentTab as string) === 'tabs-networks' && <TabsNetworksTab />}

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
             CUSTOM TABS
             ========================================== */}
          {currentTab === 'custom-tabs' && <CustomTabsListTab onEditTab={(id) => { setEditingTabId(id); setActiveTab('custom-tab-builder'); }} />}
          {currentTab === 'custom-tab-builder' && <CustomTabBuilderTab tabId={editingTabId} onBack={() => { setEditingTabId(undefined); setActiveTab('custom-tabs'); }} onSuccess={() => { setEditingTabId(undefined); setActiveTab('custom-tabs'); }} />}
            </>
          )}
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
