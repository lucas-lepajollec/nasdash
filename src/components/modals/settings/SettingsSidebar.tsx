import React, { useState } from 'react';
import { Palette, Cpu, Sliders, ChevronRight, Shield, Layout, Layers, X, Smartphone, PanelTop, Plug } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { WIDGET_CATALOG } from '@/lib/widgets/catalog';
import { Emoji } from '../../shared/Emoji';

interface SettingsSidebarProps {
  currentTab: string;
  setActiveTab: (tab: string | null) => void;
  onClose: () => void;
}

export function SettingsSidebar({ currentTab, setActiveTab, onClose }: SettingsSidebarProps) {
  const { t } = useI18n();
  const [isWidgetsMenuOpen, setIsWidgetsMenuOpen] = useState(() => currentTab?.startsWith('widget-'));

  return (
    <div className="nd-settings-sidebar">
      <div className="nd-settings-sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 12px 4px' }}>
        <h2 className="nd-settings-sidebar-title" style={{ fontSize: '0.78rem', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--nd-text-muted)' }}>{t("NasDash Config")}</h2>
        <button 
          aria-label={t("Fermer les paramètres")}
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
          <span className="nd-settings-sidebar-group-title" style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--nd-text-muted)', letterSpacing: '0.5px', marginLeft: 4, display: 'block', marginBottom: 8 }}>{t("Général")}</span>
          <div className="nd-settings-sidebar-group-items" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => setActiveTab('apparence')}
              className={`nd-settings-nav-item ${currentTab === 'apparence' ? 'nd-settings-nav-item--active' : ''}`}
            >
              <div style={{ background: 'var(--nd-accent-glow)', padding: 8, borderRadius: 'var(--nd-card-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--nd-accent)', flexShrink: 0 }}>
                <Palette size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)' }}>{t("Apparence & Thèmes")}</span>
              </div>
              <span className="nd-settings-chevron">
                <ChevronRight size={14} style={{ color: 'var(--nd-text-muted)', flexShrink: 0 }} />
              </span>
            </button>

            <button
              onClick={() => setActiveTab('header')}
              className={`nd-settings-nav-item ${currentTab === 'header' ? 'nd-settings-nav-item--active' : ''}`}
            >
              <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: 8, borderRadius: 'var(--nd-card-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', flexShrink: 0 }}>
                <PanelTop size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)' }}>{t("En-tête")}</span>
              </div>
              <span className="nd-settings-chevron">
                <ChevronRight size={14} style={{ color: 'var(--nd-text-muted)', flexShrink: 0 }} />
              </span>
            </button>

            <button
              onClick={() => setActiveTab('mobile')}
              className={`nd-settings-nav-item ${currentTab === 'mobile' ? 'nd-settings-nav-item--active' : ''}`}
            >
              <div style={{ background: 'rgba(251, 146, 60, 0.08)', padding: 8, borderRadius: 'var(--nd-card-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fb923c', flexShrink: 0 }}>
                <Smartphone size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)' }}>{t("Mobile")}</span>
              </div>
              <span className="nd-settings-chevron">
                <ChevronRight size={14} style={{ color: 'var(--nd-text-muted)', flexShrink: 0 }} />
              </span>
            </button>

            <button
              onClick={() => setActiveTab('developer')}
              className={`nd-settings-nav-item ${currentTab === 'developer' ? 'nd-settings-nav-item--active' : ''}`}
            >
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: 8, borderRadius: 'var(--nd-card-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', flexShrink: 0 }}>
                <Cpu size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)' }}>{t("Développeur")}</span>
              </div>
              <span className="nd-settings-chevron">
                <ChevronRight size={14} style={{ color: 'var(--nd-text-muted)', flexShrink: 0 }} />
              </span>
            </button>

            <button
              onClick={() => setActiveTab('integrations')}
              className={`nd-settings-nav-item ${currentTab === 'integrations' ? 'nd-settings-nav-item--active' : ''}`}
            >
              <div style={{ background: 'rgba(56, 189, 248, 0.08)', padding: 8, borderRadius: 'var(--nd-card-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', flexShrink: 0 }}>
                <Plug size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)' }}>{t('integrations.title')}</span>
              </div>
              <span className="nd-settings-chevron">
                <ChevronRight size={14} style={{ color: 'var(--nd-text-muted)', flexShrink: 0 }} />
              </span>
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className={`nd-settings-nav-item ${currentTab === 'security' ? 'nd-settings-nav-item--active' : ''}`}
            >
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: 8, borderRadius: 'var(--nd-card-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', flexShrink: 0 }}>
                <Shield size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)' }}>{t("Sécurité")}</span>
              </div>
              <span className="nd-settings-chevron">
                <ChevronRight size={14} style={{ color: 'var(--nd-text-muted)', flexShrink: 0 }} />
              </span>
            </button>

            <button
              onClick={() => setActiveTab('library')}
              className={`nd-settings-nav-item ${currentTab === 'library' ? 'nd-settings-nav-item--active' : ''}`}
            >
              <div style={{ background: 'rgba(88, 166, 255, 0.08)', padding: 8, borderRadius: 'var(--nd-card-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#58a6ff', flexShrink: 0 }}>
                <Sliders size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)' }}>{t('settings.library.nav')}</span>
              </div>
              <span className="nd-settings-chevron">
                <ChevronRight size={14} style={{ color: 'var(--nd-text-muted)', flexShrink: 0 }} />
              </span>
            </button>

            {/* Configuration Widgets */}
            <button 
              onClick={() => setIsWidgetsMenuOpen(!isWidgetsMenuOpen)}
              style={{ 
                width: '100%',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                background: 'none',
                border: 'none',
                padding: '4px 4px',
                marginTop: 8,
                marginBottom: 4,
                cursor: 'pointer',
                color: 'var(--nd-text-muted)',
                transition: 'color 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--nd-text)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--nd-text-muted)'}
            >
              <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {t("Configuration Widgets")}
              </span>
              <ChevronRight size={14} style={{ transform: isWidgetsMenuOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
            {isWidgetsMenuOpen && (
              <div className="nd-settings-sidebar-group-items" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* One entry per shared configuration; placement is done on the pages. */}
                {WIDGET_CATALOG.filter((entry, index, all) => entry.settingsTab && all.findIndex(other => other.settingsTab === entry.settingsTab) === index).map(entry => (
                  <button
                    key={entry.settingsTab}
                    onClick={() => setActiveTab(entry.settingsTab!)}
                    className={`nd-settings-nav-item ${currentTab === entry.settingsTab ? 'nd-settings-nav-item--active' : ''}`}
                  >
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: 8, borderRadius: 'var(--nd-card-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Emoji emoji={entry.icon} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)' }}>
                        {entry.settingsTab === 'widget-services' ? t('settings.services.nav') : t(entry.nameKey)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Category: Gestion des Onglets */}
        <div className="nd-settings-sidebar-group">
          <span className="nd-settings-sidebar-group-title" style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--nd-text-muted)', letterSpacing: '0.5px', marginLeft: 4, display: 'block', marginBottom: 8 }}>{t("Onglets")}</span>
          <div className="nd-settings-sidebar-group-items" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => setActiveTab('tabs-general')}
              className={`nd-settings-nav-item ${currentTab === 'tabs-general' ? 'nd-settings-nav-item--active' : ''}`}
            >
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: 8, borderRadius: 'var(--nd-card-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--nd-text)', flexShrink: 0 }}>
                <Layers size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)' }}>{t("Général")}</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('pages')}
              className={`nd-settings-nav-item ${currentTab === 'pages' ? 'nd-settings-nav-item--active' : ''}`}
            >
              <div style={{ background: 'rgba(168, 85, 247, 0.08)', padding: 8, borderRadius: 'var(--nd-card-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--nd-purple)', flexShrink: 0 }}>
                <Layout size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)' }}>{t('pages.settings.nav')}</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--nd-text-muted)' }}>{t('pages.settings.navHint')}</span>
              </div>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
