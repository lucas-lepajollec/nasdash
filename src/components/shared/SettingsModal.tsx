'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, Palette, Layers, Sliders, Clipboard, Check, 
  Monitor, Activity, Shield, Cpu, Info, CheckCircle2, ChevronRight, Container, Calendar 
} from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { AppearanceProfile } from '@/lib/types';
import CustomSelect from './CustomSelect';
import ConfirmModal from './ConfirmModal';

interface SettingsModalProps {
  onClose: () => void;
}

const THEME_PRESETS: Record<string, {
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

/* ==========================================
   PREMIUM CUSTOM TOGGLE COMPONENT
   ========================================== */
interface ToggleSwitchProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  label?: string;
  sublabel?: string;
}

function ToggleSwitch({ checked, onChange, label, sublabel }: ToggleSwitchProps) {
  return (
    <div 
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        userSelect: 'none'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginRight: 16 }}>
        {label && <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--nd-text)' }}>{label}</span>}
        {sublabel && <span style={{ fontSize: '0.66rem', color: 'var(--nd-text-muted)' }}>{sublabel}</span>}
      </div>
      <div 
        style={{
          width: '36px',
          height: '18px',
          borderRadius: '9px',
          background: checked ? 'var(--nd-green)' : 'rgba(255,255,255,0.08)',
          border: checked ? 'none' : '1px solid var(--nd-card-border)',
          position: 'relative',
          transition: 'all 0.2s ease',
          flexShrink: 0,
          boxShadow: checked ? '0 0 8px rgba(63, 185, 80, 0.3)' : 'none'
        }}
      >
        <div 
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: checked ? '#ffffff' : '#888888',
            position: 'absolute',
            top: checked ? '3px' : '2px',
            left: checked ? '21px' : '3px',
            transition: 'all 0.2s ease',
          }}
        />
      </div>
    </div>
  );
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { config, updateConfig } = useConfig();
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const currentTab = activeTab || 'apparence';
  const [mode, setMode] = useState<'light' | 'dark'>('dark');
  const [theme, setTheme] = useState(config?.settings?.theme || 'nasdash');

  // Background states
  const [title, setTitle] = useState(config?.settings?.title || 'MON HOME LAB');
  const [titleTablet, setTitleTablet] = useState(config?.settings?.titleTablet || '');
  const [titleMobile, setTitleMobile] = useState(config?.settings?.titleMobile || '');
  const [titleLogo, setTitleLogo] = useState(config?.settings?.titleLogo || '');
  const [titleFont, setTitleFont] = useState(config?.settings?.titleFont || 'outfit');
  const [titleAnimation, setTitleAnimation] = useState(config?.settings?.titleAnimation || 'none');
  const [backgroundImage, setBackgroundImage] = useState(config?.settings?.backgroundImage || '');
  const [customCss, setCustomCss] = useState(config?.settings?.customCss || '');
  const [uploadedBgs, setUploadedBgs] = useState<{ name: string; url: string }[]>([]);
  const [bgToDelete, setBgToDelete] = useState<string | null>(null);

  // Appearance Profiles
  const [appearanceProfiles, setAppearanceProfiles] = useState<AppearanceProfile[]>([]);
  const [newProfileName, setNewProfileName] = useState('');

  // Design system states
  const [globalFont, setGlobalFont] = useState(config?.settings?.globalFont || 'Outfit');
  const [borderRadius, setBorderRadius] = useState(config?.settings?.borderRadius ?? 12);
  const [cardOpacity, setCardOpacity] = useState(config?.settings?.cardOpacity ?? 0.8);

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
  const [hideDevices, setHideDevices] = useState(!!config?.settings?.hideDevices);
  const [hideQuickStats, setHideQuickStats] = useState(!!config?.settings?.hideQuickStats);
  const [hideTailscaleStatus, setHideTailscaleStatus] = useState(!!config?.settings?.hideTailscaleStatus);
  const [hideDockerActions, setHideDockerActions] = useState(config?.settings?.hideDockerActions ?? true);
  const [hideClock, setHideClock] = useState(!!config?.settings?.hideClock);
  const [hideCalendar, setHideCalendar] = useState(config?.settings?.hideCalendar ?? true);
  const [calendarUrl, setCalendarUrl] = useState(config?.settings?.calendarUrl || '');

  const [tailscaleTailnet, setTailscaleTailnet] = useState(config?.settings?.tailscaleTailnet || '');
  const [tailscaleClientId, setTailscaleClientId] = useState(config?.settings?.tailscaleClientId || '');
  const [tailscaleClientSecret, setTailscaleClientSecret] = useState(config?.settings?.tailscaleClientSecret ? '********' : '');

  // Modal / status states
  const [copied, setCopied] = useState(false);
  const [isConfirmBgDeleteOpen, setIsConfirmBgDeleteOpen] = useState(false);
  const [isConfirmLogoDeleteOpen, setIsConfirmLogoDeleteOpen] = useState(false);
  const [logoToDelete, setLogoToDelete] = useState<string | null>(null);

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
      setHideDevices(!!config.settings?.hideDevices);
      setHideQuickStats(!!config.settings?.hideQuickStats);
      setHideTailscaleStatus(!!config.settings?.hideTailscaleStatus);
      setHideDockerActions(config.settings?.hideDockerActions ?? true);
      setHideClock(!!config.settings?.hideClock);
      setHideCalendar(config.settings?.hideCalendar ?? true);
      if (config.settings?.calendarSidebar !== undefined) setCalendarSidebar(config.settings.calendarSidebar);
      if (config.settings?.calendarOrder !== undefined) setCalendarOrder(config.settings.calendarOrder);
      if (config.settings?.calendarUrl !== undefined) setCalendarUrl(config.settings.calendarUrl);
      if (config.settings?.tailscaleTailnet !== undefined) setTailscaleTailnet(config.settings.tailscaleTailnet);
      if (config.settings?.tailscaleClientId !== undefined) setTailscaleClientId(config.settings.tailscaleClientId);
      if (config.settings?.tailscaleClientSecret !== undefined) setTailscaleClientSecret(config.settings.tailscaleClientSecret ? '********' : '');
      if (config.settings?.title !== undefined) setTitle(config.settings.title);
      if (config.settings?.titleTablet !== undefined) setTitleTablet(config.settings.titleTablet);
      if (config.settings?.titleMobile !== undefined) setTitleMobile(config.settings.titleMobile);
      if (config.settings?.titleLogo !== undefined) setTitleLogo(config.settings.titleLogo);
      if (config.settings?.titleFont !== undefined) setTitleFont(config.settings.titleFont);
      if (config.settings?.titleAnimation !== undefined) setTitleAnimation(config.settings.titleAnimation);
      if (config.settings?.backgroundImage !== undefined) {
        setBackgroundImage(config.settings.backgroundImage);
      }
      if (config.appearanceProfiles) {
        setAppearanceProfiles(config.appearanceProfiles);
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
      const res = await fetch(`/api/logos?type=background&current=${encodeURIComponent(backgroundImage)}`);
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
  }, [backgroundImage]);

  const handleSaveBackground = async () => {
    await updateConfig({ backgroundImage });
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
  };

  const handleSaveCss = async () => {
    await updateConfig({ customCss });
  };

  const handleToggleWidget = async (key: string, value: boolean) => {
    if (key === 'hideDevices') {
      setHideDevices(value);
      await updateConfig({ hideDevices: value });
    } else if (key === 'hideQuickStats') {
      setHideQuickStats(value);
      await updateConfig({ hideQuickStats: value });
    } else if (key === 'hideTailscaleStatus') {
      setHideTailscaleStatus(value);
      await updateConfig({ hideTailscaleStatus: value });
    } else if (key === 'hideDockerActions') {
      setHideDockerActions(value);
      await updateConfig({ hideDockerActions: value });
    } else if (key === 'hideClock') {
      setHideClock(value);
      await updateConfig({ hideClock: value });
    } else if (key === 'hideCalendar') {
      setHideCalendar(value);
      await updateConfig({ hideCalendar: value });
    }
  };

  // Generate Home Assistant Lovelace Exporter Theme
  const activePreset = THEME_PRESETS[theme] || THEME_PRESETS.nasdash;
  const isLight = theme === 'apple-light';
  const haYamlTheme = `nasdash_${theme.replace('-', '_')}:
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
           LEFT SIDEBAR (OBSIDIAN-STYLE)
           ========================================== */}
        <div 
          className="nd-settings-sidebar" 
        >
          <div className="nd-settings-sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 12px 4px' }}>
            <h2 className="nd-settings-sidebar-title" style={{ fontSize: '0.78rem', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--nd-text-muted)' }}>NasDash Config</h2>
            <button 
              className="nd-settings-sidebar-close-btn" 
              onClick={onClose} 
              style={{ 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer', 
                color: 'var(--nd-text-muted)', 
                padding: 4, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                borderRadius: 'var(--nd-card-radius)'
              }}
            >
              <X size={16} />
            </button>
          </div>
          
          <div className="nd-settings-sidebar-groups">
            
            {/* Category: Général */}
            <div className="nd-settings-sidebar-group">
              <span className="nd-settings-sidebar-group-title" style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--nd-text-muted)', letterSpacing: '0.5px', marginLeft: 4, display: 'block', marginBottom: 8 }}>Général</span>
              <div className="nd-settings-sidebar-group-items" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Apparence Card */}
                <button
                  onClick={() => setActiveTab('apparence')}
                  className={`nd-settings-nav-item ${currentTab === 'apparence' ? 'nd-settings-nav-item--active' : ''}`}
                >
                  <div style={{ background: 'var(--nd-accent-glow)', padding: 8, borderRadius: 'var(--nd-card-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--nd-accent)', flexShrink: 0 }}>
                    <Palette size={18} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)' }}>Apparence & Thèmes</span>
                    <span style={{ fontSize: '0.66rem', color: 'var(--nd-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Thèmes, polices, arrondis, opacité et CSS.</span>
                  </div>
                  <span className="nd-settings-chevron">
                    <ChevronRight size={14} style={{ color: 'var(--nd-text-muted)', flexShrink: 0 }} />
                  </span>
                </button>

                {/* Développeur Card */}
                <button
                  onClick={() => setActiveTab('developer')}
                  className={`nd-settings-nav-item ${currentTab === 'developer' ? 'nd-settings-nav-item--active' : ''}`}
                >
                  <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: 8, borderRadius: 'var(--nd-card-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', flexShrink: 0 }}>
                    <Cpu size={18} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)' }}>Développeur</span>
                    <span style={{ fontSize: '0.66rem', color: 'var(--nd-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>CSS, Perf Monitor, Debug.</span>
                  </div>
                  <span className="nd-settings-chevron">
                    <ChevronRight size={14} style={{ color: 'var(--nd-text-muted)', flexShrink: 0 }} />
                  </span>
                </button>

                {/* Library Card */}
                <button
                  onClick={() => setActiveTab('library')}
                  className={`nd-settings-nav-item ${currentTab === 'library' ? 'nd-settings-nav-item--active' : ''}`}
                >
                  <div style={{ background: 'rgba(88, 166, 255, 0.08)', padding: 8, borderRadius: 'var(--nd-card-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#58a6ff', flexShrink: 0 }}>
                    <Sliders size={18} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)' }}>Bibliothèque Globale</span>
                    <span style={{ fontSize: '0.66rem', color: 'var(--nd-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Activez et gérez toutes les extensions NasDash.</span>
                  </div>
                  <span className="nd-settings-chevron">
                    <ChevronRight size={14} style={{ color: 'var(--nd-text-muted)', flexShrink: 0 }} />
                  </span>
                </button>
              </div>
            </div>

            {/* Category: Configuration Widgets */}
            <div className="nd-settings-sidebar-group">
              <span className="nd-settings-sidebar-group-title" style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--nd-text-muted)', letterSpacing: '0.5px', marginLeft: 4, display: 'block', marginBottom: 8 }}>Configuration Widgets</span>
              <div className="nd-settings-sidebar-group-items" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Devices Widget */}
                <button
                  onClick={() => setActiveTab('widget-devices')}
                  className={`nd-settings-nav-item ${currentTab === 'widget-devices' ? 'nd-settings-nav-item--active' : ''}`}
                >
                  <div style={{ background: 'rgba(63, 185, 80, 0.08)', padding: 8, borderRadius: 'var(--nd-card-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3fb950', flexShrink: 0 }}>
                    <Monitor size={18} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      Widget Appareils
                      <span style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: !hideDevices ? 'var(--nd-green)' : 'rgba(255,255,255,0.2)',
                        boxShadow: !hideDevices ? '0 0 6px var(--nd-green)' : 'none'
                      }} />
                    </span>
                    <span style={{ fontSize: '0.66rem', color: 'var(--nd-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>CPU, RAM, Proxmox, Glances et serveurs.</span>
                  </div>
                  <span className="nd-settings-chevron">
                    <ChevronRight size={14} style={{ color: 'var(--nd-text-muted)', flexShrink: 0 }} />
                  </span>
                </button>

                {/* QuickStats Widget */}
                <button
                  onClick={() => setActiveTab('widget-quickstats')}
                  className={`nd-settings-nav-item ${currentTab === 'widget-quickstats' ? 'nd-settings-nav-item--active' : ''}`}
                >
                  <div style={{ background: 'rgba(63, 185, 80, 0.08)', padding: 8, borderRadius: 'var(--nd-card-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3fb950', flexShrink: 0 }}>
                    <Activity size={18} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      Widget Vue d'ensemble
                      <span style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: !hideQuickStats ? 'var(--nd-green)' : 'rgba(255,255,255,0.2)',
                        boxShadow: !hideQuickStats ? '0 0 6px var(--nd-green)' : 'none'
                      }} />
                    </span>
                    <span style={{ fontSize: '0.66rem', color: 'var(--nd-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Résumé des services, catégories et ports ouverts.</span>
                  </div>
                  <span className="nd-settings-chevron">
                    <ChevronRight size={14} style={{ color: 'var(--nd-text-muted)', flexShrink: 0 }} />
                  </span>
                </button>

                {/* Tailscale Widget */}
                <button
                  onClick={() => setActiveTab('widget-tailscale')}
                  className={`nd-settings-nav-item ${currentTab === 'widget-tailscale' ? 'nd-settings-nav-item--active' : ''}`}
                >
                  <div style={{ background: 'rgba(168, 85, 247, 0.08)', padding: 8, borderRadius: 'var(--nd-card-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--nd-purple)', flexShrink: 0 }}>
                    <Shield size={18} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      Widget VPN Tailscale
                      <span style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: !hideTailscaleStatus ? 'var(--nd-green)' : 'rgba(255,255,255,0.2)',
                        boxShadow: !hideTailscaleStatus ? '0 0 6px var(--nd-green)' : 'none'
                      }} />
                    </span>
                    <span style={{ fontSize: '0.66rem', color: 'var(--nd-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>État de connexion et liste des machines actives.</span>
                  </div>
                  <span className="nd-settings-chevron">
                    <ChevronRight size={14} style={{ color: 'var(--nd-text-muted)', flexShrink: 0 }} />
                  </span>
                </button>

                {/* Docker Actions Widget */}
                <button
                  onClick={() => setActiveTab('widget-dockeractions')}
                  className={`nd-settings-nav-item ${currentTab === 'widget-dockeractions' ? 'nd-settings-nav-item--active' : ''}`}
                >
                  <div style={{ background: 'rgba(240, 136, 62, 0.08)', padding: 8, borderRadius: 'var(--nd-card-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--nd-orange)', flexShrink: 0 }}>
                    <Container size={18} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      Widget Actions Docker
                      <span style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: !hideDockerActions ? 'var(--nd-green)' : 'rgba(255,255,255,0.2)',
                        boxShadow: !hideDockerActions ? '0 0 6px var(--nd-green)' : 'none'
                      }} />
                    </span>
                    <span style={{ fontSize: '0.66rem', color: 'var(--nd-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Contrôles d'alimentation rapides pour vos conteneurs.</span>
                  </div>
                  <span className="nd-settings-chevron">
                    <ChevronRight size={14} style={{ color: 'var(--nd-text-muted)', flexShrink: 0 }} />
                  </span>
                </button>

                {/* Clock Widget */}
                <button
                  onClick={() => setActiveTab('widget-clock')}
                  className={`nd-settings-nav-item ${currentTab === 'widget-clock' ? 'nd-settings-nav-item--active' : ''}`}
                >
                  <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: 8, borderRadius: 'var(--nd-card-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--nd-accent)', flexShrink: 0 }}>
                    <Clipboard size={18} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      Widget Horloge / Date
                      <span style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: !hideClock ? 'var(--nd-green)' : 'rgba(255,255,255,0.2)',
                        boxShadow: !hideClock ? '0 0 6px var(--nd-green)' : 'none'
                      }} />
                    </span>
                    <span style={{ fontSize: '0.66rem', color: 'var(--nd-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Affichage de l'heure et de la date.</span>
                  </div>
                  <span className="nd-settings-chevron">
                    <ChevronRight size={14} style={{ color: 'var(--nd-text-muted)', flexShrink: 0 }} />
                  </span>
                </button>

                {/* Calendar Widget */}
                <button
                  onClick={() => setActiveTab('widget-calendar')}
                  className={`nd-settings-nav-item ${currentTab === 'widget-calendar' ? 'nd-settings-nav-item--active' : ''}`}
                >
                  <div style={{ background: 'rgba(251, 146, 60, 0.08)', padding: 8, borderRadius: 'var(--nd-card-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fb923c', flexShrink: 0 }}>
                    <Calendar size={18} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      Widget Calendrier
                      <span style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: !hideCalendar ? 'var(--nd-green)' : 'rgba(255,255,255,0.2)',
                        boxShadow: !hideCalendar ? '0 0 6px var(--nd-green)' : 'none'
                      }} />
                    </span>
                    <span style={{ fontSize: '0.66rem', color: 'var(--nd-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Affichage des jours et des événements.</span>
                  </div>
                  <span className="nd-settings-chevron">
                    <ChevronRight size={14} style={{ color: 'var(--nd-text-muted)', flexShrink: 0 }} />
                  </span>
                </button>
              </div>
            </div>

            {/* Category: Intégrations */}
            <div className="nd-settings-sidebar-group">
              <span className="nd-settings-sidebar-group-title" style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--nd-text-muted)', letterSpacing: '0.5px', marginLeft: 4, display: 'block', marginBottom: 8 }}>Intégrations</span>
              <div className="nd-settings-sidebar-group-items" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Home Assistant Card */}
                <button
                  onClick={() => setActiveTab('homeassistant')}
                  className={`nd-settings-nav-item ${currentTab === 'homeassistant' ? 'nd-settings-nav-item--active' : ''}`}
                >
                  <div style={{ background: 'var(--nd-accent-glow)', padding: 8, borderRadius: 'var(--nd-card-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--nd-accent)', flexShrink: 0 }}>
                    <Layers size={18} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)' }}>Home Assistant</span>
                    <span style={{ fontSize: '0.66rem', color: 'var(--nd-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Export Lovelace coordonné au tableau de bord.</span>
                  </div>
                  <span className="nd-settings-chevron">
                    <ChevronRight size={14} style={{ color: 'var(--nd-text-muted)', flexShrink: 0 }} />
                  </span>
                </button>
              </div>
            </div>

          </div>
        </div>

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                  transition: 'all 0.15s ease'
                }}
              >
                ← Retour
              </button>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                {currentTab === 'apparence' && '🎨 Apparence, Fonds & CSS'}
                {currentTab === 'library' && '🎛️ Bibliothèque Globale des Widgets'}
                {currentTab === 'widget-devices' && '🖥️ Configuration — Appareils'}
                {currentTab === 'widget-quickstats' && '📊 Configuration — Vue d\'ensemble'}
                {currentTab === 'widget-tailscale' && '🛡️ Configuration — VPN Tailscale'}
                {currentTab === 'widget-dockeractions' && '🐳 Configuration — Actions Docker'}
                {currentTab === 'widget-clock' && '🕒 Configuration — Horloge / Date'}
                {currentTab === 'widget-calendar' && '📅 Configuration — Calendrier'}
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
          {currentTab === 'apparence' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              
              {/* Appearance Profiles */}
              <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>Profils d'Apparence</h4>
                <p style={{ margin: '4px 0 12px 0', fontSize: '0.7rem', color: 'var(--nd-text-muted)' }}>
                  Sauvegardez votre configuration esthétique actuelle (thème, fond, police, opacité, logo) pour basculer facilement entre différents profils.
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
                      <div key={profile.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div>
                          <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--nd-text)' }}>{profile.name}</span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--nd-text-muted)', display: 'block', marginTop: 2 }}>{profile.settings.theme}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="nd-btn" onClick={() => handleApplyProfile(profile)} style={{ padding: '4px 10px', fontSize: '0.7rem' }}>
                            Appliquer
                          </button>
                          <button className="nd-btn nd-btn-danger" onClick={() => handleDeleteProfile(profile.id)} style={{ padding: '4px 8px' }} title="Supprimer le profil">
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Theme Selector */}
              <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>Thème (Couleurs globales)</h4>
                <p style={{ margin: '4px 0 12px 0', fontSize: '0.7rem', color: 'var(--nd-text-muted)' }}>
                  Sélectionnez la palette de couleurs esthétiques du tableau de bord.
                </p>
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

              {/* Titre & Animations */}
              <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>Titre de l'application</h4>
                <p style={{ margin: '4px 0 12px 0', fontSize: '0.7rem', color: 'var(--nd-text-muted)' }}>
                  Personnalisez le titre en haut à gauche pour chaque taille d'écran.
                </p>
                
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)', marginBottom: 4, display: 'block' }}>Titre principal (Desktop)</label>
                    <input type="text" className="nd-input" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => updateConfig({ title })} placeholder="MON HOME LAB" style={{ fontSize: '0.75rem', padding: '6px 10px' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)', marginBottom: 4, display: 'block' }}>Titre (Tablette - Optionnel)</label>
                    <input type="text" className="nd-input" value={titleTablet} onChange={(e) => setTitleTablet(e.target.value)} onBlur={() => updateConfig({ titleTablet })} placeholder="Laisser vide pour utiliser le principal" style={{ fontSize: '0.75rem', padding: '6px 10px' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--nd-text-muted)', marginBottom: 4, display: 'block' }}>Titre (Mobile - Optionnel)</label>
                    <input type="text" className="nd-input" value={titleMobile} onChange={(e) => setTitleMobile(e.target.value)} onBlur={() => updateConfig({ titleMobile })} placeholder="Laisser vide pour utiliser le principal" style={{ fontSize: '0.75rem', padding: '6px 10px' }} />
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
                        title="Supprimer le logo"
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
                    onChange={(val) => { setTitleFont(val as any); updateConfig({ titleFont: val as any }); }}
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
                    onChange={(val) => { setTitleAnimation(val as any); updateConfig({ titleAnimation: val as any }); }}
                    options={[
                      { value: 'none', label: 'Aucune' },
                      { value: 'spotlight-silver', label: 'Balayage Argenté (Silver)' },
                    ]}
                  />
                </div>
              </div>

              {/* Mode Sombre / Clair (Default Theme Only) */}
              {theme === 'nasdash' && (
                <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>Mode d'affichage</h4>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.7rem', color: 'var(--nd-text-muted)' }}>
                        Basculez entre le mode clair et sombre de base.
                      </p>
                    </div>
                    <button className="nd-btn" onClick={toggleMode} style={{ flexShrink: 0, whiteSpace: 'nowrap', padding: '6px 12px', fontSize: '0.75rem' }}>
                      {mode === 'light' ? '☀️ Mode Clair' : '🌙 Mode Sombre'}
                    </button>
                  </div>
                </div>
              )}

              {/* Custom Fixed Background Upload */}
              <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>Fond d'écran personnalisé (Fixe)</h4>
                <p style={{ margin: '4px 0 10px 0', fontSize: '0.7rem', color: 'var(--nd-text-muted)' }}>
                  Définissez une image de fond fixe pour écraser le dégradé de couleur du thème.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                          const res = await fetch('/api/upload', {
                            method: 'POST',
                            body: formData,
                          });
                          const data = await res.json();
                          if (data.url) {
                            setBackgroundImage(data.url);
                            await updateConfig({ backgroundImage: data.url });
                            fetchUploadedBgs();
                          }
                        } catch (err) {
                          console.error('Failed to upload background:', err);
                        }
                      }}
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="bg-upload-input" className="nd-btn" style={{ padding: '6px 12px', fontSize: '0.72rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--nd-card-border)' }}>
                      📁 Importer une image
                    </label>
                    {backgroundImage && (
                      <button 
                        className="nd-btn" 
                        onClick={() => {
                          setBgToDelete(backgroundImage);
                          setIsConfirmBgDeleteOpen(true);
                        }} 
                        style={{ padding: '6px 12px', fontSize: '0.72rem', color: 'var(--nd-red)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                      >
                        ❌ Supprimer le fond
                      </button>
                    )}
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
                              onClick={async () => {
                                setBackgroundImage(bg.url);
                                await updateConfig({ backgroundImage: bg.url });
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
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.03)';
                                if (!isActive) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                                if (!isActive) e.currentTarget.style.borderColor = 'var(--nd-card-border)';
                              }}
                              title={bg.name}
                            >
                              {/* Corner delete button */}
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
                                  transition: 'all 0.15s ease',
                                  zIndex: 2
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'var(--nd-red)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)';
                                }}
                                title="Supprimer définitivement"
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

              {/* Design System Customization (Typography, Opacity, Radius) */}
              <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>Personnalisation Visuelle</h4>
                <p style={{ margin: '4px 0 12px 0', fontSize: '0.7rem', color: 'var(--nd-text-muted)' }}>
                  Ajustez en temps réel les polices de caractères et la géométrie des cartes.
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Google Font Selector */}
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

                  {/* Border Radius Slider */}
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

                  {/* Card Opacity Slider */}
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
              </div>

              

            </div>
          )}

          
          {/* ==========================================
             TAB: DEVELOPER
             ========================================== */}
          {currentTab === 'developer' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              
              <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  Performance Monitor
                  <span style={{ fontSize: '0.6rem', padding: '2px 6px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Beta</span>
                </h4>
                <p style={{ margin: '4px 0 12px 0', fontSize: '0.7rem', color: 'var(--nd-text-muted)' }}>
                  Affiche une bulle flottante contenant des statistiques en temps réel sur les performances du navigateur (FPS, RAM, Latence).
                </p>
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 12px', borderRadius: 'var(--nd-card-radius)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <ToggleSwitch 
                    checked={!!config?.settings?.enablePerfMonitor}
                    onChange={async (val) => await updateConfig({ enablePerfMonitor: val })}
                    label="Activer le Performance Monitor"
                    sublabel="Désactivé par défaut pour économiser les ressources client."
                  />
                </div>
              </div>

{/* Custom CSS overrides */}
              <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>Overide CSS personnalisé</h4>
                <p style={{ margin: '4px 0 10px 0', fontSize: '0.7rem', color: 'var(--nd-text-muted)' }}>
                  Injectez des styles CSS surcharges réactivement sur votre dashboard.
                </p>
                <textarea
                  className="nd-input"
                  rows={3}
                  placeholder="/* Exemple: .nd-brand { color: red !important; } */"
                  value={customCss}
                  onChange={(e) => setCustomCss(e.target.value)}
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.7rem', resize: 'vertical', minHeight: '60px', marginBottom: '8px' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="nd-btn" onClick={handleSaveCss} style={{ padding: '6px 14px', fontSize: '0.75rem' }}>
                    Appliquer le CSS
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ==========================================
             TAB 2: LIBRARY OVERVIEW (WIDGET LIBRARY)
             ========================================== */}
          {currentTab === 'library' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--nd-text-muted)', lineHeight: 1.4 }}>
                  Activez ou désactivez les extensions de NasDash. Les widgets activés apparaissent dans vos barres latérales selon leur ordre de priorité.
                </p>
              </div>

              {/* Section 1: Active Widgets */}
              <div>
                <h5 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--nd-green)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--nd-green)', boxShadow: '0 0 8px var(--nd-green)' }} />
                  Widgets Activés ({ [hideDevices, hideQuickStats, hideTailscaleStatus, hideDockerActions, hideClock, hideCalendar].filter(h => !h).length })
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {!hideDevices && (
                    <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>🖥️ Appareils</span>
                          <span style={{ fontSize: '0.6rem', background: 'var(--nd-accent-glow)', color: 'var(--nd-accent)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>Système</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--nd-text-muted)', lineHeight: 1.3 }}>
                          Vitalités en temps réel des serveurs connectés (Glances, Proxmox, LHM).
                        </p>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <button onClick={() => setActiveTab('widget-devices')} style={{ background: 'none', border: 'none', color: 'var(--nd-accent)', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                          Configurer →
                        </button>
                        <div 
                          onClick={() => handleToggleWidget('hideDevices', true)}
                          style={{
                            width: '36px', height: '18px', borderRadius: '9px', background: 'var(--nd-green)', position: 'relative', cursor: 'pointer',
                            boxShadow: '0 0 8px rgba(63, 185, 80, 0.3)', transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: '21px', transition: 'all 0.2s' }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {!hideQuickStats && (
                    <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>📊 Vue d'ensemble</span>
                          <span style={{ fontSize: '0.6rem', background: 'var(--nd-accent-glow)', color: 'var(--nd-accent)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>Raccourci</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--nd-text-muted)', lineHeight: 1.3 }}>
                          Résumé rapide (services, catégories, ports ouverts et statuts).
                        </p>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <button onClick={() => setActiveTab('widget-quickstats')} style={{ background: 'none', border: 'none', color: 'var(--nd-accent)', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                          Configurer →
                        </button>
                        <div 
                          onClick={() => handleToggleWidget('hideQuickStats', true)}
                          style={{
                            width: '36px', height: '18px', borderRadius: '9px', background: 'var(--nd-green)', position: 'relative', cursor: 'pointer',
                            boxShadow: '0 0 8px rgba(63, 185, 80, 0.3)', transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: '21px', transition: 'all 0.2s' }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {!hideTailscaleStatus && (
                    <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>🛡️ VPN Tailscale</span>
                          <span style={{ fontSize: '0.6rem', background: 'rgba(168,85,247,0.15)', color: 'var(--nd-purple)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>Réseau</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--nd-text-muted)', lineHeight: 1.3 }}>
                          Statut de connexion de votre réseau Tailscale et vos machines.
                        </p>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <button onClick={() => setActiveTab('widget-tailscale')} style={{ background: 'none', border: 'none', color: 'var(--nd-accent)', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                          Configurer →
                        </button>
                        <div 
                          onClick={() => handleToggleWidget('hideTailscaleStatus', true)}
                          style={{
                            width: '36px', height: '18px', borderRadius: '9px', background: 'var(--nd-green)', position: 'relative', cursor: 'pointer',
                            boxShadow: '0 0 8px rgba(63, 185, 80, 0.3)', transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: '21px', transition: 'all 0.2s' }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {!hideDockerActions && (
                    <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>🐳 Actions Docker</span>
                          <span style={{ fontSize: '0.6rem', background: 'rgba(240,136,62,0.15)', color: 'var(--nd-orange)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>Docker</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--nd-text-muted)', lineHeight: 1.3 }}>
                          Boutons d'allumage/extinction globaux de vos conteneurs.
                        </p>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <button onClick={() => setActiveTab('widget-dockeractions')} style={{ background: 'none', border: 'none', color: 'var(--nd-accent)', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                          Configurer →
                        </button>
                        <div 
                          onClick={() => handleToggleWidget('hideDockerActions', true)}
                          style={{
                            width: '36px', height: '18px', borderRadius: '9px', background: 'var(--nd-green)', position: 'relative', cursor: 'pointer',
                            boxShadow: '0 0 8px rgba(63, 185, 80, 0.3)', transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: '21px', transition: 'all 0.2s' }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {!hideClock && (
                    <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>🕒 Horloge / Date</span>
                          <span style={{ fontSize: '0.6rem', background: 'var(--nd-accent-glow)', color: 'var(--nd-accent)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>Affichage</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--nd-text-muted)', lineHeight: 1.3 }}>
                          Affichage de l'heure et de la date avec un beau design.
                        </p>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <button onClick={() => setActiveTab('widget-clock')} style={{ background: 'none', border: 'none', color: 'var(--nd-accent)', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                          Configurer →
                        </button>
                        <div 
                          onClick={() => handleToggleWidget('hideClock', true)}
                          style={{
                            width: '36px', height: '18px', borderRadius: '9px', background: 'var(--nd-green)', position: 'relative', cursor: 'pointer',
                            boxShadow: '0 0 8px rgba(63, 185, 80, 0.3)', transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: '21px', transition: 'all 0.2s' }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {!hideCalendar && (
                    <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>📅 Calendrier</span>
                          <span style={{ fontSize: '0.6rem', background: 'rgba(251, 146, 60, 0.15)', color: '#fb923c', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>Organisation</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--nd-text-muted)', lineHeight: 1.3 }}>
                          Affichage des jours et des événements.
                        </p>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <button onClick={() => setActiveTab('widget-calendar')} style={{ background: 'none', border: 'none', color: 'var(--nd-accent)', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                          Configurer →
                        </button>
                        <div 
                          onClick={() => handleToggleWidget('hideCalendar', true)}
                          style={{
                            width: '36px', height: '18px', borderRadius: '9px', background: 'var(--nd-green)', position: 'relative', cursor: 'pointer',
                            boxShadow: '0 0 8px rgba(63, 185, 80, 0.3)', transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: '21px', transition: 'all 0.2s' }} />
                        </div>
                      </div>
                    </div>
                  )}

                  { [hideDevices, hideQuickStats, hideTailscaleStatus, hideDockerActions, hideClock, hideCalendar].filter(h => !h).length === 0 && (
                    <div style={{ gridColumn: 'span 2', padding: '20px', textAlign: 'center', color: 'var(--nd-text-muted)', fontSize: '0.74rem', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                      Aucun widget n'est actif. Activez-en ci-dessous !
                    </div>
                  )}
                </div>
              </div>

              {/* Section 2: Inactive Widgets */}
              <div>
                <h5 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--nd-text-dimmed)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--nd-text-dimmed)' }} />
                  Widgets Désactivés ({ [hideDevices, hideQuickStats, hideTailscaleStatus, hideDockerActions, hideClock, hideCalendar].filter(h => h).length })
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {hideDevices && (
                    <div style={{ padding: '14px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', opacity: 0.6, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>🖥️ Appareils</span>
                        <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--nd-text-muted)', lineHeight: 1.3 }}>
                          Statistiques matérielles des serveurs (CPU, disques, Proxmox, Glances).
                        </p>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                        <div 
                          onClick={() => handleToggleWidget('hideDevices', false)}
                          style={{
                            width: '36px', height: '18px', borderRadius: '9px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--nd-card-border)', position: 'relative', cursor: 'pointer', transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#888', position: 'absolute', top: '2px', left: '3px', transition: 'all 0.2s' }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {hideQuickStats && (
                    <div style={{ padding: '14px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', opacity: 0.6, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>📊 Vue d'ensemble</span>
                        <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--nd-text-muted)', lineHeight: 1.3 }}>
                          Résumé rapide du dashboard (catégories, services et ports ouverts).
                        </p>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                        <div 
                          onClick={() => handleToggleWidget('hideQuickStats', false)}
                          style={{
                            width: '36px', height: '18px', borderRadius: '9px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--nd-card-border)', position: 'relative', cursor: 'pointer', transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#888', position: 'absolute', top: '2px', left: '3px', transition: 'all 0.2s' }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {hideTailscaleStatus && (
                    <div style={{ padding: '14px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', opacity: 0.6, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>🛡️ VPN Tailscale</span>
                        <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--nd-text-muted)', lineHeight: 1.3 }}>
                          Affiche l'état du pont Tailscale et de vos machines connectées.
                        </p>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                        <div 
                          onClick={() => handleToggleWidget('hideTailscaleStatus', false)}
                          style={{
                            width: '36px', height: '18px', borderRadius: '9px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--nd-card-border)', position: 'relative', cursor: 'pointer', transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#888', position: 'absolute', top: '2px', left: '3px', transition: 'all 0.2s' }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {hideDockerActions && (
                    <div style={{ padding: '14px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', opacity: 0.6, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>🐳 Actions Docker</span>
                        <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--nd-text-muted)', lineHeight: 1.3 }}>
                          Boutons interactifs d'actions rapides sur vos conteneurs Docker.
                        </p>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                        <div 
                          onClick={() => handleToggleWidget('hideDockerActions', false)}
                          style={{
                            width: '36px', height: '18px', borderRadius: '9px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--nd-card-border)', position: 'relative', cursor: 'pointer', transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#888', position: 'absolute', top: '2px', left: '3px', transition: 'all 0.2s' }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {hideClock && (
                    <div style={{ padding: '14px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', opacity: 0.6, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>🕒 Horloge / Date</span>
                        <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--nd-text-muted)', lineHeight: 1.3 }}>
                          Affichage de l'heure et de la date avec un beau design.
                        </p>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                        <div 
                          onClick={() => handleToggleWidget('hideClock', false)}
                          style={{
                            width: '36px', height: '18px', borderRadius: '9px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--nd-card-border)', position: 'relative', cursor: 'pointer', transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#888', position: 'absolute', top: '2px', left: '3px', transition: 'all 0.2s' }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {hideCalendar && (
                    <div style={{ padding: '14px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', opacity: 0.6, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>📅 Calendrier</span>
                        <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--nd-text-muted)', lineHeight: 1.3 }}>
                          Affichage des jours et des événements.
                        </p>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                        <div 
                          onClick={() => handleToggleWidget('hideCalendar', false)}
                          style={{
                            width: '36px', height: '18px', borderRadius: '9px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--nd-card-border)', position: 'relative', cursor: 'pointer', transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#888', position: 'absolute', top: '2px', left: '3px', transition: 'all 0.2s' }} />
                        </div>
                      </div>
                    </div>
                  )}

                  { [hideDevices, hideQuickStats, hideTailscaleStatus, hideDockerActions, hideClock, hideCalendar].filter(h => h).length === 0 && (
                    <div style={{ gridColumn: 'span 2', padding: '20px', textAlign: 'center', color: 'var(--nd-text-muted)', fontSize: '0.74rem', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                      Tous les widgets sont actifs ! 🎉
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==========================================
             TAB 3: WIDGET-DEVICES PAGE
             ========================================== */}
          {currentTab === 'widget-devices' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                <ToggleSwitch
                  checked={!hideDevices}
                  onChange={(val) => handleToggleWidget('hideDevices', !val)}
                  label="Activer le widget Appareils"
                  sublabel="Choisissez si ce module de monitoring matériel doit s'afficher sur votre tableau de bord."
                />
              </div>

              {!hideDevices && (
                <>
                  {/* Column Segment Selector */}
                  <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>Panneau d'affichage</h4>
                    <p style={{ margin: '0 0 12px 0', fontSize: '0.68rem', color: 'var(--nd-text-muted)' }}>
                      Choisissez dans quelle barre latérale injecter ce widget.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleWidgetPosition('devices', 'left')}
                        style={{
                          flex: 1, padding: '10px 14px', border: '1px solid',
                          borderColor: devicesSidebar === 'left' ? 'var(--nd-accent)' : 'var(--nd-card-border)',
                          background: devicesSidebar === 'left' ? 'var(--nd-accent-glow)' : 'rgba(255,255,255,0.01)',
                          color: devicesSidebar === 'left' ? 'var(--nd-accent)' : 'var(--nd-text)',
                          borderRadius: 'var(--nd-card-radius)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                          boxShadow: devicesSidebar === 'left' ? '0 0 8px var(--nd-accent-glow)' : 'none'
                        }}
                      >
                        👈 Barre Gauche
                      </button>
                      <button
                        onClick={() => handleWidgetPosition('devices', 'right')}
                        style={{
                          flex: 1, padding: '10px 14px', border: '1px solid',
                          borderColor: devicesSidebar === 'right' ? 'var(--nd-accent)' : 'var(--nd-card-border)',
                          background: devicesSidebar === 'right' ? 'var(--nd-accent-glow)' : 'rgba(255,255,255,0.01)',
                          color: devicesSidebar === 'right' ? 'var(--nd-accent)' : 'var(--nd-text)',
                          borderRadius: 'var(--nd-card-radius)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                          boxShadow: devicesSidebar === 'right' ? '0 0 8px var(--nd-accent-glow)' : 'none'
                        }}
                      >
                        Barre Droite 👉
                      </button>
                    </div>
                  </div>

                  {/* Priority / Sorting Order */}
                  <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>Ordre de priorité verticale</h4>
                    <p style={{ margin: '0 0 12px 0', fontSize: '0.68rem', color: 'var(--nd-text-muted)' }}>
                      Ajustez la position relative de ce widget (les valeurs les plus petites s'affichent en haut).
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button 
                        onClick={() => handleWidgetOrder('devices', Math.max(0, devicesOrder - 1))}
                        style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', color: 'var(--nd-text)', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        className="nd-input"
                        min="0"
                        max="20"
                        value={devicesOrder}
                        onChange={(e) => handleWidgetOrder('devices', Number(e.target.value))}
                        style={{ flex: 1, height: '32px', fontSize: '0.8rem', textAlign: 'center', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', color: 'var(--nd-text)', borderRadius: 'var(--nd-card-radius)' }}
                      />
                      <button 
                        onClick={() => handleWidgetOrder('devices', devicesOrder + 1)}
                        style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', color: 'var(--nd-text)', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Future Options Note */}
                  <div style={{ padding: '14px', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: '0.74rem', color: 'var(--nd-accent)', fontWeight: 600 }}>⚡ Évolutivité & Extensions</span>
                    <p style={{ margin: 0, fontSize: '0.66rem', color: 'var(--nd-text-muted)', lineHeight: 1.4 }}>
                      Ce sous-menu est conçu pour être extensible. Dans de futures versions, vous pourrez y configurer des capteurs matériels additionnels, lier des connexions API Proxmox multiples, ou masquer certains serveurs hors-ligne.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ==========================================
             TAB 4: WIDGET-QUICKSTATS PAGE
             ========================================== */}
          {currentTab === 'widget-quickstats' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                <ToggleSwitch
                  checked={!hideQuickStats}
                  onChange={(val) => handleToggleWidget('hideQuickStats', !val)}
                  label="Activer le widget Vue d'ensemble"
                  sublabel="Choisissez si le résumé des statistiques du dashboard doit s'afficher dans une barre latérale."
                />
              </div>

              {!hideQuickStats && (
                <>
                  {/* Column Segment Selector */}
                  <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>Panneau d'affichage</h4>
                    <p style={{ margin: '0 0 12px 0', fontSize: '0.68rem', color: 'var(--nd-text-muted)' }}>
                      Choisissez dans quelle barre latérale injecter ce widget.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleWidgetPosition('quickstats', 'left')}
                        style={{
                          flex: 1, padding: '10px 14px', border: '1px solid',
                          borderColor: quickStatsSidebar === 'left' ? 'var(--nd-accent)' : 'var(--nd-card-border)',
                          background: quickStatsSidebar === 'left' ? 'var(--nd-accent-glow)' : 'rgba(255,255,255,0.01)',
                          color: quickStatsSidebar === 'left' ? 'var(--nd-accent)' : 'var(--nd-text)',
                          borderRadius: 'var(--nd-card-radius)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                          boxShadow: quickStatsSidebar === 'left' ? '0 0 8px var(--nd-accent-glow)' : 'none'
                        }}
                      >
                        👈 Barre Gauche
                      </button>
                      <button
                        onClick={() => handleWidgetPosition('quickstats', 'right')}
                        style={{
                          flex: 1, padding: '10px 14px', border: '1px solid',
                          borderColor: quickStatsSidebar === 'right' ? 'var(--nd-accent)' : 'var(--nd-card-border)',
                          background: quickStatsSidebar === 'right' ? 'var(--nd-accent-glow)' : 'rgba(255,255,255,0.01)',
                          color: quickStatsSidebar === 'right' ? 'var(--nd-accent)' : 'var(--nd-text)',
                          borderRadius: 'var(--nd-card-radius)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                          boxShadow: quickStatsSidebar === 'right' ? '0 0 8px var(--nd-accent-glow)' : 'none'
                        }}
                      >
                        Barre Droite 👉
                      </button>
                    </div>
                  </div>

                  {/* Priority / Sorting Order */}
                  <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>Ordre de priorité verticale</h4>
                    <p style={{ margin: '0 0 12px 0', fontSize: '0.68rem', color: 'var(--nd-text-muted)' }}>
                      Ajustez la position relative de ce widget (les valeurs les plus petites s'affichent en haut).
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button 
                        onClick={() => handleWidgetOrder('quickstats', Math.max(0, quickStatsOrder - 1))}
                        style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', color: 'var(--nd-text)', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        className="nd-input"
                        min="0"
                        max="20"
                        value={quickStatsOrder}
                        onChange={(e) => handleWidgetOrder('quickstats', Number(e.target.value))}
                        style={{ flex: 1, height: '32px', fontSize: '0.8rem', textAlign: 'center', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', color: 'var(--nd-text)', borderRadius: 'var(--nd-card-radius)' }}
                      />
                      <button 
                        onClick={() => handleWidgetOrder('quickstats', quickStatsOrder + 1)}
                        style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', color: 'var(--nd-text)', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Future Options Note */}
                  <div style={{ padding: '14px', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: '0.74rem', color: 'var(--nd-accent)', fontWeight: 600 }}>⚡ Personnalisations à venir</span>
                    <p style={{ margin: 0, fontSize: '0.66rem', color: 'var(--nd-text-muted)', lineHeight: 1.4 }}>
                      Vous pourrez bientôt choisir les statistiques exactes à faire figurer dans ce résumé (ex: masquer le total des ports ouverts, inclure des informations réseau local, ou configurer des alertes d'inaccessibilité).
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ==========================================
             TAB 5: WIDGET-TAILSCALE PAGE
             ========================================== */}
          {currentTab === 'widget-tailscale' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                <ToggleSwitch
                  checked={!hideTailscaleStatus}
                  onChange={(val) => handleToggleWidget('hideTailscaleStatus', !val)}
                  label="Activer le widget VPN Tailscale"
                  sublabel="Choisissez si l'état général et la liste des machines Tailscale doivent s'afficher."
                />
              </div>

              {!hideTailscaleStatus && (
                <>
                  {/* Column Segment Selector */}
                  <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>Panneau d'affichage</h4>
                    <p style={{ margin: '0 0 12px 0', fontSize: '0.68rem', color: 'var(--nd-text-muted)' }}>
                      Choisissez dans quelle barre latérale injecter ce widget.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleWidgetPosition('tailscale', 'left')}
                        style={{
                          flex: 1, padding: '10px 14px', border: '1px solid',
                          borderColor: tailscaleSidebar === 'left' ? 'var(--nd-accent)' : 'var(--nd-card-border)',
                          background: tailscaleSidebar === 'left' ? 'var(--nd-accent-glow)' : 'rgba(255,255,255,0.01)',
                          color: tailscaleSidebar === 'left' ? 'var(--nd-accent)' : 'var(--nd-text)',
                          borderRadius: 'var(--nd-card-radius)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                          boxShadow: tailscaleSidebar === 'left' ? '0 0 8px var(--nd-accent-glow)' : 'none'
                        }}
                      >
                        👈 Barre Gauche
                      </button>
                      <button
                        onClick={() => handleWidgetPosition('tailscale', 'right')}
                        style={{
                          flex: 1, padding: '10px 14px', border: '1px solid',
                          borderColor: tailscaleSidebar === 'right' ? 'var(--nd-accent)' : 'var(--nd-card-border)',
                          background: tailscaleSidebar === 'right' ? 'var(--nd-accent-glow)' : 'rgba(255,255,255,0.01)',
                          color: tailscaleSidebar === 'right' ? 'var(--nd-accent)' : 'var(--nd-text)',
                          borderRadius: 'var(--nd-card-radius)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                          boxShadow: tailscaleSidebar === 'right' ? '0 0 8px var(--nd-accent-glow)' : 'none'
                        }}
                      >
                        Barre Droite 👉
                      </button>
                    </div>
                  </div>

                  {/* Priority / Sorting Order */}
                  <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>Ordre de priorité verticale</h4>
                    <p style={{ margin: '0 0 12px 0', fontSize: '0.68rem', color: 'var(--nd-text-muted)' }}>
                      Ajustez la position relative de ce widget (les valeurs les plus petites s'affichent en haut).
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button 
                        onClick={() => handleWidgetOrder('tailscale', Math.max(0, tailscaleOrder - 1))}
                        style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', color: 'var(--nd-text)', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        className="nd-input"
                        min="0"
                        max="20"
                        value={tailscaleOrder}
                        onChange={(e) => handleWidgetOrder('tailscale', Number(e.target.value))}
                        style={{ flex: 1, height: '32px', fontSize: '0.8rem', textAlign: 'center', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', color: 'var(--nd-text)', borderRadius: 'var(--nd-card-radius)' }}
                      />
                      <button 
                        onClick={() => handleWidgetOrder('tailscale', tailscaleOrder + 1)}
                        style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', color: 'var(--nd-text)', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Future Options Note */}
                  <div style={{ padding: '14px', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: '0.74rem', color: 'var(--nd-accent)', fontWeight: 600 }}>⚡ Évolutivité du pont VPN</span>
                    <p style={{ margin: 0, fontSize: '0.66rem', color: 'var(--nd-text-muted)', lineHeight: 1.4 }}>
                      De nouveaux réglages permettront bientôt de masquer les machines hors-ligne, de trier la liste par ping ou d'attribuer des alias personnalisés à vos adresses Tailscale IP de manière simple et intuitive.
                    </p>
                  </div>

                  {/* Tailscale API Configuration */}
                  <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>Authentification API Tailscale</h4>
                    <p style={{ margin: '0 0 12px 0', fontSize: '0.68rem', color: 'var(--nd-text-muted)' }}>
                      Connectez votre compte Tailscale pour visualiser l'état de vos appareils directement sur le Dashboard.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input
                        type="text"
                        className="nd-input"
                        placeholder="Nom du Tailnet (ex: email@domaine.com)"
                        value={tailscaleTailnet}
                        onChange={(e) => {
                          setTailscaleTailnet(e.target.value);
                          updateConfig({ tailscaleTailnet: e.target.value });
                        }}
                        style={{ fontSize: '0.75rem', padding: '10px 14px' }}
                      />
                      <input
                        type="password"
                        className="nd-input"
                        placeholder="OAuth Client ID (kxxxx...)"
                        value={tailscaleClientId}
                        onChange={(e) => {
                          setTailscaleClientId(e.target.value);
                          updateConfig({ tailscaleClientId: e.target.value });
                        }}
                        style={{ fontSize: '0.75rem', padding: '10px 14px' }}
                      />
                      <input
                        type="password"
                        className="nd-input"
                        placeholder="OAuth Client Secret (tskey-client-...)"
                        value={tailscaleClientSecret}
                        onChange={(e) => {
                          setTailscaleClientSecret(e.target.value);
                          updateConfig({ tailscaleClientSecret: e.target.value });
                        }}
                        style={{ fontSize: '0.75rem', padding: '10px 14px' }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ==========================================
             TAB 6: WIDGET-DOCKERACTIONS PAGE
             ========================================== */}
          {currentTab === 'widget-dockeractions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                <ToggleSwitch
                  checked={!hideDockerActions}
                  onChange={(val) => handleToggleWidget('hideDockerActions', !val)}
                  label="Activer le widget Actions Docker"
                  sublabel="Choisissez si la section d'alimentation des conteneurs doit s'afficher sur votre dashboard."
                />
              </div>

              {!hideDockerActions && (
                <>
                  {/* Column Segment Selector */}
                  <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>Panneau d'affichage</h4>
                    <p style={{ margin: '0 0 12px 0', fontSize: '0.68rem', color: 'var(--nd-text-muted)' }}>
                      Choisissez dans quelle barre latérale injecter ce widget.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleWidgetPosition('dockeractions', 'left')}
                        style={{
                          flex: 1, padding: '10px 14px', border: '1px solid',
                          borderColor: dockerActionsSidebar === 'left' ? 'var(--nd-accent)' : 'var(--nd-card-border)',
                          background: dockerActionsSidebar === 'left' ? 'var(--nd-accent-glow)' : 'rgba(255,255,255,0.01)',
                          color: dockerActionsSidebar === 'left' ? 'var(--nd-accent)' : 'var(--nd-text)',
                          borderRadius: 'var(--nd-card-radius)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                          boxShadow: dockerActionsSidebar === 'left' ? '0 0 8px var(--nd-accent-glow)' : 'none'
                        }}
                      >
                        👈 Barre Gauche
                      </button>
                      <button
                        onClick={() => handleWidgetPosition('dockeractions', 'right')}
                        style={{
                          flex: 1, padding: '10px 14px', border: '1px solid',
                          borderColor: dockerActionsSidebar === 'right' ? 'var(--nd-accent)' : 'var(--nd-card-border)',
                          background: dockerActionsSidebar === 'right' ? 'var(--nd-accent-glow)' : 'rgba(255,255,255,0.01)',
                          color: dockerActionsSidebar === 'right' ? 'var(--nd-accent)' : 'var(--nd-text)',
                          borderRadius: 'var(--nd-card-radius)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                          boxShadow: dockerActionsSidebar === 'right' ? '0 0 8px var(--nd-accent-glow)' : 'none'
                        }}
                      >
                        Barre Droite 👉
                      </button>
                    </div>
                  </div>

                  {/* Priority / Sorting Order */}
                  <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>Ordre de priorité verticale</h4>
                    <p style={{ margin: '0 0 12px 0', fontSize: '0.68rem', color: 'var(--nd-text-muted)' }}>
                      Ajustez la position relative de ce widget (les valeurs les plus petites s'affichent en haut).
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button 
                        onClick={() => handleWidgetOrder('dockeractions', Math.max(0, dockerActionsOrder - 1))}
                        style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', color: 'var(--nd-text)', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        className="nd-input"
                        min="0"
                        max="20"
                        value={dockerActionsOrder}
                        onChange={(e) => handleWidgetOrder('dockeractions', Number(e.target.value))}
                        style={{ flex: 1, height: '32px', fontSize: '0.8rem', textAlign: 'center', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', color: 'var(--nd-text)', borderRadius: 'var(--nd-card-radius)' }}
                      />
                      <button 
                        onClick={() => handleWidgetOrder('dockeractions', dockerActionsOrder + 1)}
                        style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', color: 'var(--nd-text)', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Future Options Note */}
                  <div style={{ padding: '14px', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: '0.74rem', color: 'var(--nd-accent)', fontWeight: 600 }}>⚡ Contrôles conteneurs sécurisés</span>
                    <p style={{ margin: 0, fontSize: '0.66rem', color: 'var(--nd-text-muted)', lineHeight: 1.4 }}>
                      De futures options permettront d'ajouter des confirmations d'arrêt pour éviter les fausses manipulations, de lister les logs succincts, ou de grouper vos conteneurs par piles (stacks/compose) pour un allumage synchronisé.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ==========================================
             TAB 7: WIDGET-CLOCK PAGE
             ========================================== */}
          {currentTab === 'widget-clock' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                <ToggleSwitch
                  checked={!hideClock}
                  onChange={(val) => handleToggleWidget('hideClock', !val)}
                  label="Activer le widget Horloge / Date"
                  sublabel="Choisissez si l'horloge doit s'afficher sur votre tableau de bord."
                />
              </div>

              {!hideClock && (
                <>
                  {/* Column Segment Selector */}
                  <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>Panneau d'affichage</h4>
                    <p style={{ margin: '0 0 12px 0', fontSize: '0.68rem', color: 'var(--nd-text-muted)' }}>
                      Choisissez dans quelle barre latérale injecter ce widget.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleWidgetPosition('clock', 'left')}
                        style={{
                          flex: 1, padding: '10px 14px', border: '1px solid',
                          borderColor: clockSidebar === 'left' ? 'var(--nd-accent)' : 'var(--nd-card-border)',
                          background: clockSidebar === 'left' ? 'var(--nd-accent-glow)' : 'rgba(255,255,255,0.01)',
                          color: clockSidebar === 'left' ? 'var(--nd-accent)' : 'var(--nd-text)',
                          borderRadius: 'var(--nd-card-radius)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                          boxShadow: clockSidebar === 'left' ? '0 0 8px var(--nd-accent-glow)' : 'none'
                        }}
                      >
                        👈 Barre Gauche
                      </button>
                      <button
                        onClick={() => handleWidgetPosition('clock', 'right')}
                        style={{
                          flex: 1, padding: '10px 14px', border: '1px solid',
                          borderColor: clockSidebar === 'right' ? 'var(--nd-accent)' : 'var(--nd-card-border)',
                          background: clockSidebar === 'right' ? 'var(--nd-accent-glow)' : 'rgba(255,255,255,0.01)',
                          color: clockSidebar === 'right' ? 'var(--nd-accent)' : 'var(--nd-text)',
                          borderRadius: 'var(--nd-card-radius)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                          boxShadow: clockSidebar === 'right' ? '0 0 8px var(--nd-accent-glow)' : 'none'
                        }}
                      >
                        Barre Droite 👉
                      </button>
                    </div>
                  </div>

                  {/* Priority / Sorting Order */}
                  <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>Ordre de priorité verticale</h4>
                    <p style={{ margin: '0 0 12px 0', fontSize: '0.68rem', color: 'var(--nd-text-muted)' }}>
                      Ajustez la position relative de ce widget (les valeurs les plus petites s'affichent en haut).
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button 
                        onClick={() => handleWidgetOrder('clock', Math.max(-5, clockOrder - 1))}
                        style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', color: 'var(--nd-text)', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        className="nd-input"
                        min="-5"
                        max="20"
                        value={clockOrder}
                        onChange={(e) => handleWidgetOrder('clock', Number(e.target.value))}
                        style={{ flex: 1, height: '32px', fontSize: '0.8rem', textAlign: 'center', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', color: 'var(--nd-text)', borderRadius: 'var(--nd-card-radius)' }}
                      />
                      <button 
                        onClick={() => handleWidgetOrder('clock', clockOrder + 1)}
                        style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', color: 'var(--nd-text)', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Timezone Configuration */}
                  <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>Fuseau Horaire</h4>
                    <p style={{ margin: '0 0 12px 0', fontSize: '0.68rem', color: 'var(--nd-text-muted)' }}>
                      Spécifiez le fuseau horaire de l'horloge. Laissez vide pour utiliser l'heure locale.
                    </p>
                    <CustomSelect
                      value={clockTimezone || ''}
                      onChange={async (val) => {
                        setClockTimezone(val);
                        await updateConfig({ clockTimezone: val });
                      }}
                      options={[
                        { value: '', label: '🏠 Heure locale (Défaut)' },
                        ...(Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone').map(tz => ({
                          value: tz,
                          label: tz.replace('_', ' ')
                        })) : [])
                      ]}
                    />
                  </div>

                  {/* Design Configuration */}
                  <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>Design & Style</h4>
                    <p style={{ margin: '0 0 12px 0', fontSize: '0.68rem', color: 'var(--nd-text-muted)' }}>
                      Sélectionnez l'apparence visuelle de l'horloge.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      {[
                        { id: 'default', name: 'Défaut', desc: 'Design classique et propre' },
                        { id: 'minimal', name: 'Minimaliste', desc: 'Discret, texte seul' },
                        { id: 'glow', name: 'Terminal', desc: 'Style ligne de commande minimaliste' },
                        { id: 'split', name: 'Split Cards', desc: 'Boîtes séparées (style Flip)' }
                      ].map(design => (
                        <button
                          key={design.id}
                          onClick={async () => {
                            setClockDesign(design.id as any);
                            await updateConfig({ clockDesign: design.id });
                          }}
                          style={{
                            padding: '12px', border: '1px solid',
                            borderColor: clockDesign === design.id ? 'var(--nd-accent)' : 'var(--nd-card-border)',
                            background: clockDesign === design.id ? 'var(--nd-accent-glow)' : 'rgba(0,0,0,0.2)',
                            color: clockDesign === design.id ? 'var(--nd-accent)' : 'var(--nd-text)',
                            borderRadius: 'var(--nd-card-radius)', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s',
                            boxShadow: clockDesign === design.id ? '0 0 8px var(--nd-accent-glow)' : 'none'
                          }}
                        >
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: 4 }}>{design.name}</div>
                          <div style={{ fontSize: '0.62rem', color: clockDesign === design.id ? 'inherit' : 'var(--nd-text-muted)', opacity: 0.8 }}>{design.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ==========================================
             TAB 8: WIDGET-CALENDAR PAGE
             ========================================== */}
          {currentTab === 'widget-calendar' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                <ToggleSwitch
                  checked={!hideCalendar}
                  onChange={(val) => handleToggleWidget('hideCalendar', !val)}
                  label="Activer le widget Calendrier"
                  sublabel="Affiche un calendrier simple sur votre tableau de bord."
                />
              </div>

              {!hideCalendar && (
                <>
                  {/* Column Segment Selector */}
                  <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>Panneau d'affichage</h4>
                    <p style={{ margin: '0 0 12px 0', fontSize: '0.68rem', color: 'var(--nd-text-muted)' }}>
                      Choisissez dans quelle barre latérale injecter ce widget.
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleWidgetPosition('calendar', 'left')}
                        style={{
                          flex: 1, padding: '10px 14px', border: '1px solid',
                          borderColor: calendarSidebar === 'left' ? 'var(--nd-accent)' : 'var(--nd-card-border)',
                          background: calendarSidebar === 'left' ? 'var(--nd-accent-glow)' : 'rgba(255,255,255,0.01)',
                          color: calendarSidebar === 'left' ? 'var(--nd-accent)' : 'var(--nd-text)',
                          borderRadius: 'var(--nd-card-radius)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                          boxShadow: calendarSidebar === 'left' ? '0 0 8px var(--nd-accent-glow)' : 'none'
                        }}
                      >
                        👈 Barre Gauche
                      </button>
                      <button
                        onClick={() => handleWidgetPosition('calendar', 'right')}
                        style={{
                          flex: 1, padding: '10px 14px', border: '1px solid',
                          borderColor: calendarSidebar === 'right' ? 'var(--nd-accent)' : 'var(--nd-card-border)',
                          background: calendarSidebar === 'right' ? 'var(--nd-accent-glow)' : 'rgba(255,255,255,0.01)',
                          color: calendarSidebar === 'right' ? 'var(--nd-accent)' : 'var(--nd-text)',
                          borderRadius: 'var(--nd-card-radius)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                          boxShadow: calendarSidebar === 'right' ? '0 0 8px var(--nd-accent-glow)' : 'none'
                        }}
                      >
                        Barre Droite 👉
                      </button>
                    </div>
                  </div>

                  {/* Priority / Sorting Order */}
                  <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>Ordre de priorité verticale</h4>
                    <p style={{ margin: '0 0 12px 0', fontSize: '0.68rem', color: 'var(--nd-text-muted)' }}>
                      Ajustez la position relative de ce widget (les valeurs les plus petites s'affichent en haut).
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button 
                        onClick={() => handleWidgetOrder('calendar', Math.max(-5, calendarOrder - 1))}
                        style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', color: 'var(--nd-text)', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        className="nd-input"
                        min="-5"
                        max="20"
                        value={calendarOrder}
                        onChange={(e) => handleWidgetOrder('calendar', Number(e.target.value))}
                        style={{ flex: 1, height: '32px', fontSize: '0.8rem', textAlign: 'center', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', color: 'var(--nd-text)', borderRadius: 'var(--nd-card-radius)' }}
                      />
                      <button 
                        onClick={() => handleWidgetOrder('calendar', calendarOrder + 1)}
                        style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', color: 'var(--nd-text)', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Calendar Sync URL */}
                  <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.8rem', fontWeight: 600 }}>Synchronisation iCal</h4>
                    <p style={{ margin: '0 0 12px 0', fontSize: '0.68rem', color: 'var(--nd-text-muted)' }}>
                      Collez l'URL d'un calendrier au format .ics (Google Agenda, Apple, etc.) pour afficher vos événements.
                    </p>
                    <input
                      type="url"
                      className="nd-input"
                      placeholder="https://..."
                      value={calendarUrl}
                      onChange={(e) => {
                        setCalendarUrl(e.target.value);
                      }}
                      onBlur={() => {
                        updateConfig({ calendarUrl });
                      }}
                      style={{ width: '100%', fontSize: '0.75rem', padding: '10px 14px' }}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* ==========================================
             TAB 9: HOME ASSISTANT
             ========================================== */}
          {currentTab === 'homeassistant' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              
              <div style={{ padding: '10px 12px', background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.15)', borderRadius: 'var(--nd-card-radius)' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--nd-accent)', display: 'block', fontWeight: 600 }}>💡 Synchronisation visuelle Lovelace</span>
                <span style={{ fontSize: '0.68rem', color: 'var(--nd-text-muted)', marginTop: 4, display: 'block', lineHeight: 1.4 }}>
                  Copiez le code YAML ci-dessous dans votre fichier <code style={{ color: 'var(--nd-text)', fontFamily: 'monospace' }}>themes.yaml</code> de Home Assistant. Vos cartes Lovelace et fonds s'adapteront harmonieusement au style graphique choisi ici !
                </span>
              </div>

              <div style={{ position: 'relative' }}>
                <pre style={{
                  background: 'rgba(0,0,0,0.35)', padding: '12px', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)',
                  fontFamily: 'monospace', fontSize: '0.65rem', color: 'var(--nd-text)', overflowX: 'auto', maxHeight: '280px', margin: 0
                }}>
                  {haYamlTheme}
                </pre>
                <button
                  onClick={copyToClipboard}
                  style={{
                    position: 'absolute', top: 8, right: 8, padding: '4px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.08)',
                    border: '1px solid var(--nd-card-border)', color: 'var(--nd-text)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.62rem'
                  }}
                >
                  {copied ? <Check size={10} style={{ color: 'var(--nd-green)' }} /> : <Clipboard size={10} />}
                  {copied ? 'Copié !' : 'Copier'}
                </button>
              </div>

              <div className="nd-settings-card" style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
                <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: 'var(--nd-accent)' }}>🧹 Note de compatibilité</h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.68rem', color: 'var(--nd-text-muted)', lineHeight: 1.4 }}>
                  Si vous avez des styles statiques forcés comme <code style={{ color: 'var(--nd-orange)' }}>background: #161b22 !important;</code> dans vos cartes HA via card-mod, remplacez-les par <code style={{ color: 'var(--nd-green)' }}>background: var(--ha-card-background) !important;</code> pour qu'elles héritent automatiquement des thèmes dynamiques !
                </p>
              </div>

            </div>
          )}

        </div>
      </div>

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
    </div>
  );
}
