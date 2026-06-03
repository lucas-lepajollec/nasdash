import React, { useState } from 'react';
import { Palette, Cpu, Sliders, ChevronRight, Monitor, Activity, Shield, Container, Clipboard, Calendar, Cloud, Home, Layout, Layers, X, Smartphone, PanelTop } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';

interface SettingsSidebarProps {
  currentTab: string;
  setActiveTab: (tab: string | null) => void;
  onClose: () => void;
}

export function SettingsSidebar({ currentTab, setActiveTab, onClose }: SettingsSidebarProps) {
  const { config } = useConfig();
  const [isWidgetsMenuOpen, setIsWidgetsMenuOpen] = useState(false);
  const [isTabsMenuOpen, setIsTabsMenuOpen] = useState(false);

  // Read widget visibility states
  const hideDevices = config?.settings?.hideDevices ?? false;
  const hideQuickStats = config?.settings?.hideQuickStats ?? false;
  const hideTailscaleStatus = config?.settings?.hideTailscaleStatus ?? false;
  const hideDockerActions = config?.settings?.hideDockerActions ?? false;
  const hideClock = config?.settings?.hideClock ?? false;
  const hideCalendar = config?.settings?.hideCalendar ?? false;
  const hideWeather = config?.settings?.hideWeather ?? false;

  return (
    <div className="nd-settings-sidebar">
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
            <button
              onClick={() => setActiveTab('apparence')}
              className={`nd-settings-nav-item ${currentTab === 'apparence' ? 'nd-settings-nav-item--active' : ''}`}
            >
              <div style={{ background: 'var(--nd-accent-glow)', padding: 8, borderRadius: 'var(--nd-card-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--nd-accent)', flexShrink: 0 }}>
                <Palette size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)' }}>Apparence & Thèmes</span>
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
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)' }}>En-tête</span>
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
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)' }}>Mobile</span>
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
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)' }}>Développeur</span>
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
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)' }}>Bibliothèque Globale</span>
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
                Configuration Widgets
              </span>
              <ChevronRight size={14} style={{ transform: isWidgetsMenuOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
            {isWidgetsMenuOpen && (
              <div className="nd-settings-sidebar-group-items" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { id: 'widget-devices', icon: <Monitor size={18} />, color: '#3fb950', bg: 'rgba(63, 185, 80, 0.08)', label: 'Appareils', desc: 'CPU, RAM, Proxmox, Glances et serveurs.', active: !hideDevices },
                  { id: 'widget-quickstats', icon: <Activity size={18} />, color: '#3fb950', bg: 'rgba(63, 185, 80, 0.08)', label: "Vue d'ensemble", desc: 'Résumé des services, catégories et ports ouverts.', active: !hideQuickStats },
                  { id: 'widget-tailscale', icon: <Shield size={18} />, color: 'var(--nd-purple)', bg: 'rgba(168, 85, 247, 0.08)', label: 'VPN Tailscale', desc: 'État de connexion et liste des machines actives.', active: !hideTailscaleStatus },
                  { id: 'widget-dockeractions', icon: <Container size={18} />, color: 'var(--nd-orange)', bg: 'rgba(240, 136, 62, 0.08)', label: 'Actions Docker', desc: "Contrôles d'alimentation rapides pour vos conteneurs.", active: !hideDockerActions },
                  { id: 'widget-clock', icon: <Clipboard size={18} />, color: 'var(--nd-accent)', bg: 'rgba(56, 189, 248, 0.08)', label: 'Horloge / Date', desc: "Affichage de l'heure et de la date.", active: !hideClock },
                  { id: 'widget-calendar', icon: <Calendar size={18} />, color: '#fb923c', bg: 'rgba(251, 146, 60, 0.08)', label: 'Calendrier', desc: 'Affichage des jours et des événements.', active: !hideCalendar },
                  { id: 'widget-weather', icon: <Cloud size={18} />, color: 'var(--nd-accent)', bg: 'rgba(56, 189, 248, 0.08)', label: 'Météo', desc: "Prévisions et température locale.", active: !hideWeather },
                ].sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1)).map((w, index, array) => {
                  const isFirstInactive = !w.active && (index === 0 || array[index - 1].active);
                  return (
                    <React.Fragment key={w.id}>
                      {isFirstInactive && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
                          <div style={{ flex: 1, height: 1, background: 'var(--nd-card-border)' }} />
                          <span style={{ fontSize: '0.6rem', color: 'var(--nd-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Désactivés</span>
                          <div style={{ flex: 1, height: 1, background: 'var(--nd-card-border)' }} />
                        </div>
                      )}
                      <button
                        onClick={() => setActiveTab(w.id)}
                        className={`nd-settings-nav-item ${currentTab === w.id ? 'nd-settings-nav-item--active' : ''}`}
                      >
                        <div style={{ background: w.bg, padding: 8, borderRadius: 'var(--nd-card-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: w.color, flexShrink: 0 }}>
                          {w.icon}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            Widget {w.label}
                            <span style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: w.active ? 'var(--nd-green)' : 'rgba(255,255,255,0.2)',
                              boxShadow: w.active ? '0 0 6px var(--nd-green)' : 'none'
                            }} />
                          </span>
                        </div>
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Category: Gestion des Onglets */}
        <div className="nd-settings-sidebar-group">
          <span className="nd-settings-sidebar-group-title" style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--nd-text-muted)', letterSpacing: '0.5px', marginLeft: 4, display: 'block', marginBottom: 8 }}>Onglets</span>
          <div className="nd-settings-sidebar-group-items" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => setActiveTab('tabs-general')}
              className={`nd-settings-nav-item ${currentTab === 'tabs-general' ? 'nd-settings-nav-item--active' : ''}`}
            >
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: 8, borderRadius: 'var(--nd-card-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--nd-text)', flexShrink: 0 }}>
                <Layers size={18} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)' }}>Général</span>
              </div>
            </button>
          </div>
        </div>

        {/* Category: Paramètres Spécifiques */}
        <div className="nd-settings-sidebar-group">
          <button 
            onClick={() => setIsTabsMenuOpen(!isTabsMenuOpen)}
            style={{ 
              width: '100%',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              background: 'none',
              border: 'none',
              padding: '4px 4px',
              cursor: 'pointer',
              color: 'var(--nd-text-muted)',
              transition: 'color 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--nd-text)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--nd-text-muted)'}
          >
            <span className="nd-settings-sidebar-group-title" style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>Paramètres Spécifiques</span>
            <ChevronRight size={14} style={{ transform: isTabsMenuOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
          </button>
          
          {isTabsMenuOpen && (
            <div className="nd-settings-sidebar-group-items" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              <button
                onClick={() => setActiveTab('tabs-home')}
                className={`nd-settings-nav-item ${currentTab === 'tabs-home' ? 'nd-settings-nav-item--active' : ''}`}
              >
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: 8, borderRadius: 'var(--nd-card-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--nd-text)', flexShrink: 0 }}>
                  <Home size={18} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)' }}>Home</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('tabs-widgets')}
                className={`nd-settings-nav-item ${currentTab === 'tabs-widgets' ? 'nd-settings-nav-item--active' : ''}`}
              >
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: 8, borderRadius: 'var(--nd-card-radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--nd-text)', flexShrink: 0 }}>
                  <Layout size={18} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)' }}>Widgets</span>
                </div>
              </button>
            </div>
          )}
        </div>



      </div>
    </div>
  );
}
