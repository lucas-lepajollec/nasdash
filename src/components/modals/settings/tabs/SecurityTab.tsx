'use client';

import React, { useState, useEffect } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { User, Plus, Trash2, Key, Shield, Eye, EyeOff, Info } from 'lucide-react';
import { WIDGET_REGISTRY } from '@/lib/widgetRegistry';
import CustomSelect from '@/components/shared/CustomSelect';
import ConfirmModal from '@/components/modals/ConfirmModal';
import { SettingsAccordion } from '../shared/SettingsAccordion';
import { Emoji } from '../../../shared/Emoji';
import { useI18n } from '@/i18n/I18nProvider';

interface LocalUser {
  username: string;
  role: 'admin' | 'viewer';
  allowedTabs?: string[];
  allowedWidgets?: string[];
}

interface CustomTabOption {
  id: string;
  name: string;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

const DEFAULT_TABS = [
  { id: 'dashboard', name: 'Home' },
  { id: 'docker', name: 'Docker' },
  { id: 'networks', name: 'Réseaux' },
  { id: 'widgets', name: 'Widgets' },
];

export function SecurityTab() {
  const { t } = useI18n();
  const { config, updateConfig, user: currentUser, logout } = useConfig();
  const [users, setUsers] = useState<LocalUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [customTabs, setCustomTabs] = useState<CustomTabOption[]>([]);
  
  // Formulaire d'ajout / modification
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'viewer'>('viewer');
  const [selectedTabs, setSelectedTabs] = useState<string[]>([]);
  const [selectedWidgets, setSelectedWidgets] = useState<string[]>([]);
  
  const [showPassword, setShowPassword] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [addingUser, setAddingUser] = useState(false);

  // Hover states pour les tooltips d'info
  const [hoveredMode, setHoveredMode] = useState<'public' | 'private' | null>(null);
  
  // Modal de confirmation de suppression
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<string | null>(null);

  // Accordéons ouverts (seul le premier est ouvert par défaut)
  const [openAccordions, setOpenAccordions] = useState<string[]>(['mode']);

  const toggleAccordion = (key: string) => {
    setOpenAccordions(prev =>
      prev.includes(key) ? [] : [key]
    );
  };

  // Charger les utilisateurs et les onglets personnalisés au montage
  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await fetch('/api/auth/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      console.error('Erreur chargement utilisateurs:', e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchCustomTabs = async () => {
    try {
      const res = await fetch('/api/custom-tabs');
      if (res.ok) {
        const data = await res.json();
        setCustomTabs(data.tabs || []);
      }
    } catch (e) {
      console.error('Erreur chargement onglets personnalisés:', e);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchCustomTabs();
  }, []);

  const securityMode = config?.settings?.securityMode || 'public';
  const demoMode = config?.demoMode === true;

  const handleModeChange = async (mode: 'public' | 'private') => {
    try {
      setActionSuccess(null);
      setActionError(null);
      await updateConfig({ securityMode: mode });
      setActionSuccess(`Mode de sécurité mis à jour : ${mode === 'private' ? 'Privé strict' : 'Public'}`);
    } catch (error: unknown) {
      setActionError(getErrorMessage(error, 'Erreur lors du changement de mode.'));
    }
  };

  const handleSwitchToViewer = async () => {
    try {
      setActionError(null);
      setActionSuccess(null);
      const res = await fetch('/api/auth/switch-to-viewer', { method: 'POST' });
      if (res.ok) {
        // A full reload clears every admin-only client cache after the role switch.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign('/');
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Erreur lors du basculement');
      }
    } catch (error: unknown) {
      setActionError(getErrorMessage(error, 'Erreur de basculement.'));
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEdit = users.some(u => u.username.toLowerCase() === username.toLowerCase());
    const changesCurrentPassword = isEdit
      && password.length > 0
      && currentUser?.username.toLowerCase() === username.toLowerCase();
    
    if (!username || (!password && !isEdit)) {
      setActionError('Le nom d\'utilisateur et le mot de passe sont obligatoires.');
      return;
    }

    setActionError(null);
    setActionSuccess(null);
    setAddingUser(true);

    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username, 
          password: password || undefined, 
          role,
          allowedTabs: selectedTabs,
          allowedWidgets: selectedWidgets
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la configuration de l\'utilisateur');
      }

      if (changesCurrentPassword) {
        await logout({ reason: 'password-changed' });
        return;
      }

      setActionSuccess(`Utilisateur ${username} enregistré avec succès.`);
      setUsername('');
      setPassword('');
      setRole('viewer');
      setSelectedTabs([]);
      setSelectedWidgets([]);
      fetchUsers();
    } catch (error: unknown) {
      setActionError(getErrorMessage(error, 'Une erreur est survenue.'));
    } finally {
      setAddingUser(false);
    }
  };

  const handleDeleteUser = (userToDelete: string) => {
    setDeleteConfirmUser(userToDelete);
  };

  const confirmDeleteUser = async (userToDelete: string) => {
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/auth/users?username=${encodeURIComponent(userToDelete)}`, {
        method: 'DELETE'
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la suppression');
      }

      setActionSuccess(`Utilisateur ${userToDelete} supprimé.`);
      fetchUsers();
    } catch (error: unknown) {
      setActionError(getErrorMessage(error, 'Une erreur est survenue.'));
    }
  };

  const allSelectableTabs = [...DEFAULT_TABS, ...customTabs.map(t => ({ id: t.id, name: t.name }))];
  const isDefaultAccount = username.toLowerCase() === 'admin' || username.toLowerCase() === 'viewer';

  const toggleTabSelect = (tabId: string) => {
    if (selectedTabs.includes(tabId)) {
      setSelectedTabs(selectedTabs.filter(id => id !== tabId));
    } else {
      setSelectedTabs([...selectedTabs, tabId]);
    }
  };

  const toggleWidgetSelect = (widgetId: string) => {
    if (selectedWidgets.includes(widgetId)) {
      setSelectedWidgets(selectedWidgets.filter(id => id !== widgetId));
    } else {
      setSelectedWidgets([...selectedWidgets, widgetId]);
    }
  };

  const selectAllTabs = () => {
    setSelectedTabs(allSelectableTabs.map(t => t.id));
  };

  const clearAllTabs = () => {
    setSelectedTabs([]);
  };

  const selectAllWidgets = () => {
    setSelectedWidgets(WIDGET_REGISTRY.map(w => w.id));
  };

  const clearAllWidgets = () => {
    setSelectedWidgets([]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {demoMode && (
        <div style={{ padding: 14, background: 'color-mix(in srgb, var(--nd-accent) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--nd-accent) 32%, var(--nd-card-border))', borderRadius: 'var(--nd-card-radius, 8px)', fontSize: '0.72rem', lineHeight: 1.55 }}>
          <strong style={{ display: 'block', marginBottom: 4, color: 'var(--nd-text)' }}>{t("Aperçu de la sécurité en mode démo")}</strong>
          {t("Les changements de mode ci-dessous sont simulés dans votre session temporaire. Ils ne verrouillent pas cette démo publique et ne modifient aucun compte réel.")}
        </div>
      )}
      {/* Alertes d'action */}
      {actionError && (
        <div style={{ padding: 12, backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 6, color: 'var(--nd-red, #ef4444)', fontSize: '0.75rem' }}>
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div style={{ padding: 12, backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 6, color: 'var(--nd-green, #10b981)', fontSize: '0.75rem' }}>
          {actionSuccess}
        </div>
      )}

      {/* SECTION 1: MODE DE SECURITE */}
      <SettingsAccordion
        title={t("Mode de sécurité global")}
        description={t("Configurez l'accès public ou privé du tableau de bord")}
        icon={<Shield size={18} />}
        isOpen={openAccordions.includes('mode')}
        onToggle={() => toggleAccordion('mode')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div
              onClick={() => handleModeChange('public')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: 'var(--nd-card-radius, 8px)',
                background: securityMode === 'public' ? 'rgba(var(--nd-accent-rgb, 0,168,204), 0.12)' : 'rgba(255,255,255,0.02)',
                border: securityMode === 'public' ? '1px solid var(--nd-accent)' : '1px solid var(--nd-card-border)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1rem', display: 'flex', alignItems: 'center' }}><Emoji emoji="🌐" /></span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: securityMode === 'public' ? 'var(--nd-accent)' : 'var(--nd-text)' }}>{t("Public (Lecture seule)")}</span>
              </div>
              <div 
                onMouseEnter={() => setHoveredMode('public')}
                onMouseLeave={() => setHoveredMode(null)}
                style={{ position: 'relative', display: 'flex', alignItems: 'center', color: 'var(--nd-text-muted)', cursor: 'help', padding: 4 }}
              >
                <Info size={14} />
                {hoveredMode === 'public' && (
                  <div style={{
                    position: 'absolute',
                    bottom: '130%',
                    right: -10,
                    width: 240,
                    background: 'rgba(22, 27, 34, 0.95)',
                    border: '1px solid var(--nd-card-border)',
                    borderRadius: 6,
                    padding: 10,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    zIndex: 100,
                    fontSize: '0.7rem',
                    color: 'var(--nd-text)',
                    lineHeight: 1.4,
                    pointerEvents: 'none',
                    textAlign: 'left'
                  }}>
                    {t("Le tableau de bord est ouvert à tout le réseau en lecture seule. Les actions Docker et la modification de configuration nécessitent une session d’administration.")}
                  </div>
                )}
              </div>
            </div>

            <div
              onClick={() => handleModeChange('private')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: 'var(--nd-card-radius, 8px)',
                background: securityMode === 'private' ? 'rgba(var(--nd-accent-rgb, 0,168,204), 0.12)' : 'rgba(255,255,255,0.02)',
                border: securityMode === 'private' ? '1px solid var(--nd-accent)' : '1px solid var(--nd-card-border)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1rem', display: 'flex', alignItems: 'center' }}><Emoji emoji="🔒" /></span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: securityMode === 'private' ? 'var(--nd-accent)' : 'var(--nd-text)' }}>{t("Privé strict")}</span>
              </div>
              <div 
                onMouseEnter={() => setHoveredMode('private')}
                onMouseLeave={() => setHoveredMode(null)}
                style={{ position: 'relative', display: 'flex', alignItems: 'center', color: 'var(--nd-text-muted)', cursor: 'help', padding: 4 }}
              >
                <Info size={14} />
                {hoveredMode === 'private' && (
                  <div style={{
                    position: 'absolute',
                    bottom: '130%',
                    right: -10,
                    width: 240,
                    background: 'rgba(22, 27, 34, 0.95)',
                    border: '1px solid var(--nd-card-border)',
                    borderRadius: 6,
                    padding: 10,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    zIndex: 100,
                    fontSize: '0.7rem',
                    color: 'var(--nd-text)',
                    lineHeight: 1.4,
                    pointerEvents: 'none',
                    textAlign: 'left'
                  }}>
                    {t("Rien ne s’affiche sans connexion préalable. Tout visiteur non authentifié est immédiatement redirigé vers l’écran de connexion.")}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </SettingsAccordion>

      {/* SECTION 2: GESTION DES UTILISATEURS */}
      {demoMode ? (
        <div style={{ padding: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius, 8px)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <User size={18} style={{ color: 'var(--nd-accent)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong style={{ display: 'block', fontSize: '0.8rem', marginBottom: 5 }}>{t("Utilisateurs et permissions")}</strong>
            <p style={{ margin: 0, color: 'var(--nd-text-muted)', fontSize: '0.7rem', lineHeight: 1.55 }}>
              {t("Une installation NasDash complète permet de créer des administrateurs et observateurs, puis de limiter leurs onglets et widgets. La création de comptes, les mots de passe, la suppression et le test d&apos;une session viewer sont désactivés ici afin de ne jamais recueillir de véritables identifiants.")}
            </p>
          </div>
        </div>
      ) : (
      <SettingsAccordion
        title={t("Utilisateurs & Permissions")}
        description={t("Gérez les comptes d'accès, rôles et restrictions d'onglets/widgets")}
        icon={<User size={18} />}
        isOpen={openAccordions.includes('users')}
        onToggle={() => toggleAccordion('users')}
      >
        <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--nd-text-muted)', display: 'block', marginBottom: 12 }}>
          {t("👤 Utilisateurs enregistrés")}
        </span>
        {loadingUsers ? (
          <div style={{ color: 'var(--nd-text-muted)', fontSize: '0.75rem', padding: 8 }}>{t("Chargement...")}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
            {users.map(u => {
              const isCurrent = currentUser?.username.toLowerCase() === u.username.toLowerCase();
              const isSystemUser = u.username.toLowerCase() === 'admin' || u.username.toLowerCase() === 'viewer';
              return (
                <div
                  key={u.username}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 6,
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid var(--nd-card-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: u.role === 'admin' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${u.role === 'admin' ? '#10b981' : 'var(--nd-card-border)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: u.role === 'admin' ? '#10b981' : 'var(--nd-text-muted)'
                    }}>
                      <User size={14} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nd-text)' }}>
                        {u.username} {isCurrent && <span style={{ fontSize: '0.62rem', color: 'var(--nd-accent)', marginLeft: 4 }}>(vous)</span>}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--nd-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {u.role === 'admin' ? t("👑 Administrateur") : t("👁️ Observateur")}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {u.username.toLowerCase() === 'viewer' && currentUser?.role === 'admin' && (
                      <button
                        onClick={handleSwitchToViewer}
                        title={t("Se connecter en tant que spectateur")}
                        className="nd-btn"
                        style={{ padding: '4px 8px', fontSize: '0.65rem', height: 26, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--nd-card-border)', display: 'flex', alignItems: 'center' }}
                      >
                        Tester
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setUsername(u.username);
                        setRole(u.role);
                        setPassword('');
                        setSelectedTabs(u.allowedTabs || []);
                        setSelectedWidgets(u.allowedWidgets || []);
                        setActionError(null);
                        setActionSuccess(null);
                      }}
                      title={t('security.editUserPermissions', { name: u.username })}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--nd-accent)',
                        cursor: 'pointer',
                        padding: 6,
                        borderRadius: 4,
                      }}
                    >
                      <Key size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(u.username)}
                      disabled={isCurrent || isSystemUser}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--nd-red, #ef4444)',
                        cursor: 'pointer',
                        padding: 6,
                        borderRadius: 4,
                        opacity: (isCurrent || isSystemUser) ? 0.3 : 0.8,
                        pointerEvents: (isCurrent || isSystemUser) ? 'none' : 'auto',
                        transition: 'opacity 0.2s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* AJOUT / EDITION UTILISATEUR */}
        <div style={{ borderTop: '1px solid var(--nd-card-border)', paddingTop: 18, marginTop: 18 }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--nd-text-muted)', display: 'block', marginBottom: 12 }}>
            {username && users.some(u => u.username.toLowerCase() === username.toLowerCase()) ? t('security.editAccess', { name: username }) : t("➕ Ajouter un nouvel utilisateur")}
          </span>

          <form onSubmit={handleAddUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, alignItems: 'end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="security-username" style={{ fontSize: '0.62rem', color: 'var(--nd-text-muted)', textTransform: 'uppercase' }}>{t("Nom d'utilisateur")}</label>
              <input
                id="security-username"
                type="text"
                className="nd-input"
                value={username}
                disabled={isDefaultAccount}
                onChange={e => setUsername(e.target.value)}
                placeholder={t("Ex: lucas")}
                style={{ width: '100%', padding: '8px 10px', fontSize: '0.75rem', borderRadius: 4, background: isDefaultAccount ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', color: 'var(--nd-text)', cursor: isDefaultAccount ? 'not-allowed' : 'text' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="security-password" style={{ fontSize: '0.62rem', color: 'var(--nd-text-muted)', textTransform: 'uppercase' }}>{t("Mot de passe")}</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="security-password"
                  type={showPassword ? 'text' : 'password'}
                  className="nd-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={isDefaultAccount ? t("Laisser vide si inchangé") : "••••••••"}
                  style={{ width: '100%', padding: '8px 30px 8px 10px', fontSize: '0.75rem', borderRadius: 4, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--nd-card-border)', color: 'var(--nd-text)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--nd-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '0.62rem', color: 'var(--nd-text-muted)', textTransform: 'uppercase' }}>{t("Rôle")}</label>
              <CustomSelect
                value={role}
                disabled={isDefaultAccount}
                onChange={(value) => setRole(value as 'admin' | 'viewer')}
                options={[
                  { value: 'viewer', label: t("👁️ Observateur (Lecture)") },
                  { value: 'admin', label: t("👑 Administrateur (Total)") }
                ]}
              />
            </div>

            {/* Permissions Onglets */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--nd-text-muted)' }}>
                  {t("Onglets autorisés")}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={selectAllTabs} style={{ background: 'none', border: 'none', color: 'var(--nd-accent)', fontSize: '0.65rem', cursor: 'pointer', padding: 0 }}>{t("Tout cocher")}</button>
                  <span style={{ color: 'var(--nd-text-muted)', fontSize: '0.65rem' }}>|</span>
                  <button type="button" onClick={clearAllTabs} style={{ background: 'none', border: 'none', color: 'var(--nd-text-muted)', fontSize: '0.65rem', cursor: 'pointer', padding: 0 }}>{t("Tout décocher")}</button>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                {allSelectableTabs.map(tab => {
                  const isSelected = selectedTabs.includes(tab.id);
                  const isHome = tab.id === 'dashboard';
                  const isDocker = tab.id === 'docker';
                  const isNetworks = tab.id === 'networks';
                  const isWidgets = tab.id === 'widgets';
                  const emoji = isHome ? '🏠' : isDocker ? '🐳' : isNetworks ? '📶' : isWidgets ? '🧩' : (config?.settings?.tabIcons?.[tab.id] || '🎨');
                  return (
                    <div
                      key={tab.id}
                      onClick={() => toggleTabSelect(tab.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 12px',
                        borderRadius: 'var(--nd-card-radius, 8px)',
                        background: isSelected ? 'rgba(var(--nd-accent-rgb, 0,168,204), 0.12)' : 'rgba(255,255,255,0.02)',
                        border: isSelected ? '1px solid var(--nd-accent)' : '1px solid var(--nd-card-border)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        userSelect: 'none'
                      }}
                      onMouseEnter={e => {
                        if (!isSelected) {
                          e.currentTarget.style.border = '1px solid rgba(255,255,255,0.15)';
                          e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) {
                          e.currentTarget.style.border = '1px solid var(--nd-card-border)';
                          e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                        }
                      }}
                    >
                      <span style={{ fontSize: '1rem', display: 'flex', alignItems: 'center' }}><Emoji emoji={emoji} /></span>
                      <span style={{ fontSize: '0.75rem', fontWeight: isSelected ? 600 : 500, color: isSelected ? 'var(--nd-accent)' : 'var(--nd-text)' }}>
                        {tab.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Permissions Widgets */}
            <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--nd-text-muted)' }}>
                  {t("Widgets autorisés")}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={selectAllWidgets} style={{ background: 'none', border: 'none', color: 'var(--nd-accent)', fontSize: '0.65rem', cursor: 'pointer', padding: 0 }}>{t("Tout cocher")}</button>
                  <span style={{ color: 'var(--nd-text-muted)', fontSize: '0.65rem' }}>|</span>
                  <button type="button" onClick={clearAllWidgets} style={{ background: 'none', border: 'none', color: 'var(--nd-text-muted)', fontSize: '0.65rem', cursor: 'pointer', padding: 0 }}>{t("Tout décocher")}</button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                {WIDGET_REGISTRY.map(w => {
                  const isSelected = selectedWidgets.includes(w.id);
                  return (
                    <div
                      key={w.id}
                      onClick={() => toggleWidgetSelect(w.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 12px',
                        borderRadius: 'var(--nd-card-radius, 8px)',
                        background: isSelected ? 'rgba(var(--nd-accent-rgb, 0,168,204), 0.12)' : 'rgba(255,255,255,0.02)',
                        border: isSelected ? '1px solid var(--nd-accent)' : '1px solid var(--nd-card-border)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        userSelect: 'none'
                      }}
                      onMouseEnter={e => {
                        if (!isSelected) {
                          e.currentTarget.style.border = '1px solid rgba(255,255,255,0.15)';
                          e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) {
                          e.currentTarget.style.border = '1px solid var(--nd-card-border)';
                          e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                        }
                      }}
                    >
                      <span style={{ fontSize: '1rem' }}>{w.icon}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: isSelected ? 600 : 500, color: isSelected ? 'var(--nd-accent)' : 'var(--nd-text)' }}>
                        {t(w.name)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
              {username && (
                <button
                  type="button"
                  onClick={() => {
                    setUsername('');
                    setPassword('');
                    setRole('viewer');
                    setSelectedTabs([]);
                    setSelectedWidgets([]);
                    setActionError(null);
                    setActionSuccess(null);
                  }}
                  className="nd-btn"
                  style={{
                    height: 33,
                    padding: '0 14px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    borderRadius: 4,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--nd-card-border)',
                    color: 'var(--nd-text)',
                    cursor: 'pointer'
                  }}
                >
                  {t("Annuler la sélection")}
                </button>
              )}
              <div style={{ flex: 1, minWidth: 10 }} />
              <button
                type="submit"
                className="nd-btn accent"
                disabled={addingUser}
                style={{
                  height: 33,
                  padding: '0 14px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--nd-accent)',
                  color: '#000000',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {addingUser ? '...' : <Plus size={14} />}
                Sauvegarder
              </button>
            </div>
          </form>
        </div>
      </SettingsAccordion>
      )}
      <ConfirmModal
        isOpen={deleteConfirmUser !== null}
        onClose={() => setDeleteConfirmUser(null)}
        onConfirm={() => {
          if (deleteConfirmUser) {
            confirmDeleteUser(deleteConfirmUser);
          }
        }}
        title={t("Supprimer l'utilisateur")}
        description={t('confirm.userDelete', { name: deleteConfirmUser || '' })}
      />
    </div>
  );
}
