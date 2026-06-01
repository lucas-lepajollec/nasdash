import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { ToggleSwitch } from '../shared/ToggleSwitch';

interface LibraryTabProps {
  setActiveTab: (tabId: string) => void;
}

export function LibraryTab({ setActiveTab }: LibraryTabProps) {
  const { config, updateConfig } = useConfig();

  const hideDevices = !!config?.settings?.hideDevices;
  const hideQuickStats = !!config?.settings?.hideQuickStats;
  const hideTailscaleStatus = !!config?.settings?.hideTailscaleStatus;
  const hideDockerActions = config?.settings?.hideDockerActions ?? true;
  const hideClock = config?.settings?.hideClock ?? false;
  const hideCalendar = config?.settings?.hideCalendar ?? true;
  const hideWeather = config?.settings?.hideWeather ?? false;
  const hideWidgetTitles = config?.settings?.hideWidgetTitles ?? false;

  const handleToggleWidget = async (key: string, value: boolean) => {
    await updateConfig({ [key]: value });
  };

  const activeCount = [hideDevices, hideQuickStats, hideTailscaleStatus, hideDockerActions, hideClock, hideCalendar, hideWeather].filter(h => !h).length;
  const inactiveCount = [hideDevices, hideQuickStats, hideTailscaleStatus, hideDockerActions, hideClock, hideCalendar, hideWeather].filter(h => h).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--nd-text-muted)', lineHeight: 1.4 }}>
          Activez ou désactivez les extensions de NasDash. Les widgets activés apparaissent dans vos barres latérales selon leur ordre de priorité.
        </p>
      </div>

      {/* Options globales de la bibliothèque */}
      <div className="nd-settings-card" style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
        <ToggleSwitch
          checked={!hideWidgetTitles}
          onChange={(val) => handleToggleWidget('hideWidgetTitles', !val)}
          label="Afficher les titres des widgets"
          sublabel="Masque ou affiche les titres (ex: APPAREILS, CALENDRIER, HORLOGE) au-dessus de tous vos widgets."
        />
      </div>

      {/* Section 1: Active Widgets */}
      <div>
        <h5 style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--nd-green)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--nd-green)', boxShadow: '0 0 8px var(--nd-green)' }} />
          Widgets Activés ({activeCount})
        </h5>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
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
                  style={{ width: '36px', height: '18px', borderRadius: '9px', background: 'var(--nd-green)', position: 'relative', cursor: 'pointer', boxShadow: '0 0 8px rgba(63, 185, 80, 0.3)', transition: 'all 0.2s' }}
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
                  style={{ width: '36px', height: '18px', borderRadius: '9px', background: 'var(--nd-green)', position: 'relative', cursor: 'pointer', boxShadow: '0 0 8px rgba(63, 185, 80, 0.3)', transition: 'all 0.2s' }}
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
                  style={{ width: '36px', height: '18px', borderRadius: '9px', background: 'var(--nd-green)', position: 'relative', cursor: 'pointer', boxShadow: '0 0 8px rgba(63, 185, 80, 0.3)', transition: 'all 0.2s' }}
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
                  style={{ width: '36px', height: '18px', borderRadius: '9px', background: 'var(--nd-green)', position: 'relative', cursor: 'pointer', boxShadow: '0 0 8px rgba(63, 185, 80, 0.3)', transition: 'all 0.2s' }}
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
                  style={{ width: '36px', height: '18px', borderRadius: '9px', background: 'var(--nd-green)', position: 'relative', cursor: 'pointer', boxShadow: '0 0 8px rgba(63, 185, 80, 0.3)', transition: 'all 0.2s' }}
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
                  style={{ width: '36px', height: '18px', borderRadius: '9px', background: 'var(--nd-green)', position: 'relative', cursor: 'pointer', boxShadow: '0 0 8px rgba(63, 185, 80, 0.3)', transition: 'all 0.2s' }}
                >
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: '21px', transition: 'all 0.2s' }} />
                </div>
              </div>
            </div>
          )}

          {!hideWeather && (
            <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>☁️ Météo</span>
                  <span style={{ fontSize: '0.6rem', background: 'rgba(56, 189, 248, 0.15)', color: 'var(--nd-accent)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>Affichage</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--nd-text-muted)', lineHeight: 1.3 }}>
                  Prévisions et température locale avec un design élégant.
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <button onClick={() => setActiveTab('widget-weather')} style={{ background: 'none', border: 'none', color: 'var(--nd-accent)', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                  Configurer →
                </button>
                <div 
                  onClick={() => handleToggleWidget('hideWeather', true)}
                  style={{ width: '36px', height: '18px', borderRadius: '9px', background: 'var(--nd-green)', position: 'relative', cursor: 'pointer', boxShadow: '0 0 8px rgba(63, 185, 80, 0.3)', transition: 'all 0.2s' }}
                >
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '3px', left: '21px', transition: 'all 0.2s' }} />
                </div>
              </div>
            </div>
          )}

          {activeCount === 0 && (
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
          Widgets Désactivés ({inactiveCount})
        </h5>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
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
                  style={{ width: '36px', height: '18px', borderRadius: '9px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--nd-card-border)', position: 'relative', cursor: 'pointer', transition: 'all 0.2s' }}
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
                  style={{ width: '36px', height: '18px', borderRadius: '9px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--nd-card-border)', position: 'relative', cursor: 'pointer', transition: 'all 0.2s' }}
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
                  Statut de connexion de votre réseau Tailscale et vos machines.
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <div 
                  onClick={() => handleToggleWidget('hideTailscaleStatus', false)}
                  style={{ width: '36px', height: '18px', borderRadius: '9px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--nd-card-border)', position: 'relative', cursor: 'pointer', transition: 'all 0.2s' }}
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
                  Boutons d'allumage/extinction globaux de vos conteneurs.
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <div 
                  onClick={() => handleToggleWidget('hideDockerActions', false)}
                  style={{ width: '36px', height: '18px', borderRadius: '9px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--nd-card-border)', position: 'relative', cursor: 'pointer', transition: 'all 0.2s' }}
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
                  style={{ width: '36px', height: '18px', borderRadius: '9px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--nd-card-border)', position: 'relative', cursor: 'pointer', transition: 'all 0.2s' }}
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
                  style={{ width: '36px', height: '18px', borderRadius: '9px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--nd-card-border)', position: 'relative', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#888', position: 'absolute', top: '2px', left: '3px', transition: 'all 0.2s' }} />
                </div>
              </div>
            </div>
          )}

          {hideWeather && (
            <div style={{ padding: '14px', background: 'rgba(0,0,0,0.1)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', opacity: 0.6, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>☁️ Météo</span>
                <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--nd-text-muted)', lineHeight: 1.3 }}>
                  Prévisions et température locale avec un design élégant.
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <div 
                  onClick={() => handleToggleWidget('hideWeather', false)}
                  style={{ width: '36px', height: '18px', borderRadius: '9px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--nd-card-border)', position: 'relative', cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#888', position: 'absolute', top: '2px', left: '3px', transition: 'all 0.2s' }} />
                </div>
              </div>
            </div>
          )}
          
          {inactiveCount === 0 && (
            <div style={{ gridColumn: 'span 2', padding: '20px', textAlign: 'center', color: 'var(--nd-text-muted)', fontSize: '0.74rem', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
              Tous les widgets sont activés !
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
