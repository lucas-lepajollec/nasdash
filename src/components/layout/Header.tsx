'use client';

import { useState } from 'react';
import { Search, Pencil, Settings, Plus, X, Shield, Eye, EyeOff, Menu, LogIn, LogOut, User, ChevronDown } from 'lucide-react';
import { TabId, TabDef } from '@/hooks/useTabs';
import { useConfig } from '@/hooks/useConfig';
import { HeaderElementDesktop, HeaderElementMobile } from '@/lib/types';
import { Emoji } from '../shared/Emoji';

interface HeaderProps {
  title: string;
  titleLogo?: string;
  titleMobile?: string;
  titleFont?: 'outfit' | 'space-grotesk' | 'syne' | 'righteous' | 'montserrat';
  titleAnimation?: 'none' | 'spotlight-silver';
  searchQuery: string;
  onSearchChange: (q: string) => void;
  editMode: boolean;
  onToggleEdit: () => void;
  onOpenSettings: () => void;
  onAddCategory: () => void;
  onAddSlot?: () => Promise<void> | void;
  secretMode: boolean;
  onToggleSecret?: () => void;
  activeTab?: TabId;
  tabs?: TabDef[];
  onSwitchTab?: (id: TabId) => void;
  onOpenTabManager?: () => void;
  onAddWidget?: () => void;
}

export default function Header(props: HeaderProps) {
  const { config, setSettingsModal, user } = useConfig();
  const isHome = !props.activeTab || props.activeTab === 'dashboard';
  const currentTabDef = props.tabs?.find(t => t.id === props.activeTab);
  const isCustomTab = currentTabDef?.isCustom === true;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopDropdownOpen, setDesktopDropdownOpen] = useState(false);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);

  interface EditAction {
    label: string;
    onClick: () => void;
  }

  const getEditActions = (): EditAction[] => {
    if (!props.editMode) return [];

    if (props.activeTab === 'dashboard' || !props.activeTab) {
      return [
        {
          label: 'Créer un emplacement',
          onClick: () => props.onAddSlot?.(),
        },
        {
          label: 'Ajouter un widget',
          onClick: () => props.onAddWidget?.(),
        },
        {
          label: 'Créer une catégorie',
          onClick: () => props.onAddCategory?.(),
        }
      ];
    }

    if (props.activeTab === 'networks') {
      return [
        {
          label: 'Créer un groupe',
          onClick: () => window.dispatchEvent(new Event('networkActionAddGroup')),
        },
        {
          label: 'Lier des nœuds',
          onClick: () => window.dispatchEvent(new Event('networkActionAddLink')),
        },
        {
          label: 'Créer un nœud',
          onClick: () => window.dispatchEvent(new Event('networkActionAddNode')),
        }
      ];
    }

    if (isCustomTab) {
      return [
        {
          label: 'Structure',
          onClick: () => setSettingsModal({ open: true, targetTab: 'custom-tab-builder', targetCustomTabId: props.activeTab }),
        }
      ];
    }

    return [];
  };

  // Settings
  const hideHeaderTitle = config?.settings?.hideHeaderTitle;
  const hideHeaderSearch = config?.settings?.hideHeaderSearch;
  const hideHeaderMenu = config?.settings?.hideHeaderMenu;
  
  const layoutDesktop = config?.settings?.headerLayoutDesktop || { left: 'title', center: 'search', right: 'menu', splitMenuAround: 'none' };
  const layoutMobile = config?.settings?.headerLayoutMobile || { left: 'title', center: 'search' };
  
  const titleFont = config?.settings?.titleFont || props.titleFont || 'outfit';
  const titleAnimation = config?.settings?.titleAnimation || props.titleAnimation || 'none';
  const title = config?.settings?.title || props.title || 'MON HOME LAB';
  const titleMobile = config?.settings?.titleMobile || props.titleMobile;
  const titleLogo = config?.settings?.titleLogo || props.titleLogo;

  const renderAnimatedTitleText = (txt: string) => txt;

  const BrandElement = ({ isMobile }: { isMobile: boolean }) => {
    if (!isMobile && hideHeaderTitle) return null;
    return (
      <div className={`nd-brand pl-2 md:pl-0 ${titleAnimation && titleAnimation !== 'none' ? `nd-title-anim-${titleAnimation}` : ''}`} style={{ minWidth: 0, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
        <span className="nd-brand-dot" style={{ flexShrink: 0 }} />
        {titleLogo ? (
          <img 
            src={titleLogo} 
            alt="Logo" 
            className="nd-title-logo" 
            style={{ maxHeight: '20px', width: 'auto', objectFit: 'contain' }} 
          />
        ) : (
          <strong style={{ 
            fontFamily: `var(--font-${titleFont === 'space-grotesk' ? 'space' : titleFont}), sans-serif`,
            display: 'block',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0
          }}>
            {isMobile && titleMobile ? renderAnimatedTitleText(titleMobile) : renderAnimatedTitleText(title)}
          </strong>
        )}
      </div>
    );
  };

  const SearchElement = ({ isMobile }: { isMobile?: boolean }) => {
    if (!isMobile && hideHeaderSearch) return null;
    return (
      <div className="nd-search">
        <Search size={13} className="nd-search-icon" />
        <input
          type="text"
          value={props.searchQuery}
          onChange={(e) => props.onSearchChange(e.target.value)}
          placeholder="Rechercher..."
        />
        {props.searchQuery && (
          <button
            onClick={() => props.onSearchChange('')}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nd-text-dimmed)',
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>
    );
  };

  const MenuElement = ({ startIndex = 0, endIndex = props.tabs?.length || 0, isMobile }: { startIndex?: number, endIndex?: number, isMobile?: boolean }) => {
    const { config } = useConfig();
    if ((!isMobile && hideHeaderMenu) || !props.tabs) return null;
    const tabsToRender = props.tabs.slice(startIndex, endIndex);
    
    return (
      <nav className="nd-header-menu" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {tabsToRender.map((tab, index) => {
          const isActive = tab.id === props.activeTab;
          const showIcons = config?.settings?.showHeaderMenuIcons;
          const iconVal = showIcons ? (config?.settings?.tabIcons?.[tab.id] || tab.icon) : null;
          const isFirstInHeader = index === 0 && startIndex === 0 && layoutDesktop?.left === 'menu' && layoutDesktop?.splitMenuAround === 'none';
          return (
            <button
              key={tab.id}
              onClick={() => props.onSwitchTab?.(tab.id)}
              className="nd-btn-menu-link"
              style={{
                padding: isFirstInHeader ? '6px 12px 6px 0' : '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--nd-accent)' : '2px solid transparent',
                borderRadius: 0,
                cursor: 'pointer',
                transition: 'border-color 0.2s, color 0.2s',
                color: isActive ? 'var(--nd-text)' : 'var(--nd-text-muted)',
                marginBottom: '-2px' // Compense la bordure du bas pour ne pas décaler le layout
              }}
            >
              {iconVal && <span style={{ display: 'flex', alignItems: 'center' }}><Emoji emoji={iconVal} /></span>}
              <span style={{ fontSize: '0.8rem', fontWeight: isActive ? 600 : 500 }}>{tab.name}</span>
            </button>
          )
        })}
      </nav>
    );
  };

  const renderElement = (type: HeaderElementDesktop | HeaderElementMobile, isMobile: boolean) => {
    switch(type) {
      case 'title': return BrandElement({ isMobile });
      case 'search': return SearchElement({ isMobile });
      case 'menu': return (!isMobile && layoutDesktop?.splitMenuAround === 'none') || isMobile ? MenuElement({ isMobile }) : null;
      default: return null;
    }
  };

  const renderSplitMenuCenter = () => {
    if (layoutDesktop.splitMenuAround === 'none') return null;
    
    const tabsCount = props.tabs?.length || 0;
    const mid = Math.ceil(tabsCount / 2);
    
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {MenuElement({ startIndex: 0, endIndex: mid })}
        {layoutDesktop.splitMenuAround === 'title' ? BrandElement({ isMobile: false }) : SearchElement({})}
        {MenuElement({ startIndex: mid, endIndex: tabsCount })}
      </div>
    );
  };

  const ActionsDesktop = () => {
    const { user, logout } = useConfig();
    const actions = getEditActions();

    return (
      <div className="nd-header-actions nd-desktop-actions pr-2 md:pr-0" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {props.editMode && actions.length > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            {actions.length === 1 ? (
              <button className="nd-btn" onClick={actions[0].onClick}>
                <Plus size={12} />
                {actions[0].label}
              </button>
            ) : (
              <div style={{ position: 'relative' }}>
                <button 
                  className="nd-btn" 
                  onClick={() => setDesktopDropdownOpen(!desktopDropdownOpen)}
                >
                  <Plus size={12} />
                  Actions
                  <ChevronDown size={12} style={{ transform: desktopDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                {desktopDropdownOpen && (
                  <>
                    <div 
                      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} 
                      onClick={() => setDesktopDropdownOpen(false)} 
                    />
                    <div 
                      style={{ 
                        position: 'absolute', 
                        top: 'calc(100% + 6px)', 
                        right: 0, 
                        background: 'var(--nd-card-bg)', 
                        border: '1px solid var(--nd-card-border)', 
                        borderRadius: 'var(--nd-card-radius)', 
                        boxShadow: '0 10px 25px rgba(0,0,0,0.3)', 
                        zIndex: 1000, 
                        display: 'flex', 
                        flexDirection: 'column', 
                        padding: '4px',
                        minWidth: '160px',
                        animation: 'nd-fade-in 0.15s ease-out'
                      }}
                    >
                      {actions.map((act, idx) => (
                        <button
                          key={idx}
                          className="nd-dropdown-item"
                          onClick={() => {
                            act.onClick();
                            setDesktopDropdownOpen(false);
                          }}
                          style={{
                            padding: '8px 12px',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--nd-text-muted)',
                            fontSize: '0.72rem',
                            fontWeight: 500,
                            textAlign: 'left',
                            cursor: 'pointer',
                            borderRadius: 'calc(var(--nd-card-radius) * 0.8)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            width: '100%',
                            transition: 'background 0.15s, color 0.15s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.color = 'var(--nd-text)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--nd-text-muted)';
                          }}
                        >
                          {act.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <div style={{ width: 1, height: 16, background: 'var(--nd-border)', margin: '0 4px', alignSelf: 'center' }} />
          </div>
        )}
        <button
          className={`nd-btn ${!props.secretMode ? 'nd-btn-active' : ''}`}
          onClick={props.onToggleSecret}
          title={props.secretMode ? 'Masquer les infos' : 'Afficher les infos'}
        >
          {props.secretMode ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        {user?.role === 'admin' && (
          <>
            <button
              className={`nd-btn ${props.editMode ? 'nd-btn-active' : ''}`}
              onClick={props.onToggleEdit}
              title="Mode édition"
            >
              <Pencil size={14} />
            </button>
            <button className="nd-btn" onClick={props.onOpenSettings} title="Paramètres globaux">
              <Settings size={14} />
            </button>
          </>
        )}
        
        <div style={{ width: 1, height: 16, background: 'var(--nd-border)', margin: '0 4px' }} />

        {user && !user.isAnonymous ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 'var(--nd-card-radius)',
              background: 'var(--nd-card-bg)', border: '1px solid var(--nd-card-border)',
              color: 'var(--nd-text)', fontSize: '0.72rem', fontWeight: 600, height: 36,
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              boxShadow: 'none'
            }}>
              <User size={13} style={{ color: 'var(--nd-accent)' }} />
              <span style={{ maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.username}</span>
            </div>
            <button className="nd-btn" onClick={logout} title="Se déconnecter" style={{ padding: 6, minWidth: 0, justifyContent: 'center' }}>
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <a href="/login" className="nd-btn" title="Se connecter" style={{ textDecoration: 'none', minWidth: 0, justifyContent: 'center' }}>
            <LogIn size={14} />
          </a>
        )}
      </div>
    );
  };

  return (
    <>
      <header className="nd-header">
        
        {/* Desktop Layout */}
        <div className="nd-header-desktop" style={{ width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
          
          <div className="nd-header-left" style={{ display: 'flex', flex: 1, justifyContent: 'flex-start' }}>
            {layoutDesktop.splitMenuAround !== 'none' && (layoutDesktop.left === layoutDesktop.splitMenuAround) ? null : renderElement(layoutDesktop.left || 'title', false)}
          </div>
          
          <div className="nd-header-center" style={{ display: 'flex', flex: 1, justifyContent: 'center', padding: '0 16px' }}>
            {layoutDesktop.splitMenuAround !== 'none' ? renderSplitMenuCenter() : renderElement(layoutDesktop.center || 'search', false)}
          </div>
          
          <div className="nd-header-right" style={{ display: 'flex', flex: 1, justifyContent: 'flex-end', gap: '16px', alignItems: 'center' }}>
            {layoutDesktop.splitMenuAround !== 'none' && (layoutDesktop.right === layoutDesktop.splitMenuAround) ? null : renderElement(layoutDesktop.right || 'none', false)}
            <ActionsDesktop />
          </div>

        </div>

        {/* Mobile Layout */}
        {(() => {
          const leftType = layoutMobile.left || 'title';
          const centerType = layoutMobile.center || 'search';
          const hasLeft = leftType !== 'none';
          const hasCenter = centerType !== 'none';
          return (
            <div className="nd-header-mobile" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              {/* Left Element */}
              {hasLeft && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  flex: leftType === 'search' ? '1 1 340px' : '1 1 0%', 
                  maxWidth: leftType === 'search' ? '340px' : 'none', 
                  minWidth: leftType === 'search' ? '100px' : 'max-content', 
                  justifyContent: 'flex-start' 
                }}>
                  {renderElement(leftType, true)}
                </div>
              )}

              {/* Center Element */}
              {hasCenter && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  flex: centerType === 'search' ? '1 1 340px' : '0 0 auto', 
                  maxWidth: centerType === 'search' ? '340px' : 'none', 
                  minWidth: 0, 
                  justifyContent: 'center' 
                }}>
                  {renderElement(centerType, true)}
                </div>
              )}

              {/* Right Element (Burger menu) */}
              <div className="nd-header-actions nd-mobile-actions pr-2" style={{ 
                display: 'flex', 
                alignItems: 'center', 
                flex: '1 1 0%', 
                minWidth: 'max-content', 
                justifyContent: 'flex-end' 
              }}>
                <button className={`nd-btn ${mobileMenuOpen ? 'nd-btn-active' : ''}`} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                  <Menu size={16} />
                </button>
              </div>
            </div>
          );
        })()}

      </header>

      {/* Mobile Edit Actions Toolbar (rendered below header in editMode for dashboard, networks, custom tabs) */}
      {props.editMode && (() => {
        const actions = getEditActions();
        if (actions.length === 0) return null;
        return (
          <div className="flex md:hidden nd-mobile-edit-toolbar" style={{ width: '100%', boxSizing: 'border-box' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              {actions.length === 1 ? (
                <button 
                  className="nd-btn" 
                  onClick={actions[0].onClick}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <Plus size={12} />
                  {actions[0].label}
                </button>
              ) : (
                <>
                  <button 
                    className="nd-btn" 
                    onClick={() => setMobileDropdownOpen(!mobileDropdownOpen)}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <Plus size={12} />
                    Actions
                    <ChevronDown size={12} style={{ transform: mobileDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', marginLeft: 'auto' }} />
                  </button>
                  {mobileDropdownOpen && (
                    <>
                      <div 
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} 
                        onClick={() => setMobileDropdownOpen(false)} 
                      />
                      <div 
                        style={{ 
                          position: 'absolute', 
                          top: 'calc(100% + 6px)', 
                          left: 0, 
                          right: 0, 
                          background: 'var(--nd-card-bg)', 
                          border: '1px solid var(--nd-card-border)', 
                          borderRadius: 'var(--nd-card-radius)', 
                          boxShadow: '0 10px 25px rgba(0,0,0,0.3)', 
                          zIndex: 1000, 
                          display: 'flex', 
                          flexDirection: 'column', 
                          padding: '4px',
                          animation: 'nd-fade-in 0.15s ease-out'
                        }}
                      >
                        {actions.map((act, idx) => (
                          <button
                            key={idx}
                            className="nd-dropdown-item"
                            onClick={() => {
                              act.onClick();
                              setMobileDropdownOpen(false);
                            }}
                            style={{
                              padding: '10px 14px',
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--nd-text-muted)',
                              fontSize: '0.8rem',
                              fontWeight: 500,
                              textAlign: 'left',
                              cursor: 'pointer',
                              borderRadius: 'calc(var(--nd-card-radius) * 0.8)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              width: '100%'
                            }}
                          >
                            {act.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="nd-mobile-menu-overlay"
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 100,
            animation: 'nd-fade-in 0.2s',
          }}
        >
          <div
            className="nd-mobile-menu-content"
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: 16, right: 16, left: 16,
              background: 'var(--nd-card-bg)',
              border: '1px solid var(--nd-card-border)',
              borderRadius: 'var(--nd-card-radius)',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Menu</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {(() => {
                  const { user, logout } = useConfig();
                  return user && !user.isAnonymous ? (
                    <button className="nd-btn" onClick={logout} style={{ fontSize: '0.75rem', gap: 6, padding: '4px 8px' }}>
                      <LogOut size={12} /> {user.username}
                    </button>
                  ) : (
                    <a href="/login" className="nd-btn" style={{ fontSize: '0.75rem', gap: 6, padding: '4px 8px', textDecoration: 'none', display: 'inline-flex' }}>
                      <LogIn size={12} style={{ color: 'var(--nd-accent)' }} /> Connexion
                    </a>
                  );
                })()}
                <button className="nd-btn" onClick={() => setMobileMenuOpen(false)} style={{ padding: 6 }}>
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Tabs List */}
            {props.tabs && props.tabs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--nd-text-muted)', textTransform: 'uppercase', letterSpacing: 1, paddingLeft: 4, marginBottom: 2, fontWeight: 600 }}>Navigation</span>
                {props.tabs.map(tab => {
                  const isActive = tab.id === props.activeTab;
                  return (
                    <button
                      key={tab.id}
                      className={`nd-btn ${isActive ? 'nd-btn-active' : ''}`}
                      onClick={() => {
                        props.onSwitchTab?.(tab.id);
                        setMobileMenuOpen(false);
                      }}
                      style={{ justifyContent: 'flex-start', padding: '10px 12px', width: '100%', border: isActive ? '1px solid var(--nd-accent)' : '1px solid transparent' }}
                    >
                      <span className="nd-dock-item-icon" style={{ marginRight: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: isActive ? 'var(--nd-accent)' : 'inherit', fontSize: '16px' }}><Emoji emoji={config?.settings?.tabIcons?.[tab.id] || tab.icon} /></span>
                      <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>{tab.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div style={{ height: 1, background: 'var(--nd-border)', margin: '0' }} />

            {/* Global Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: user?.role === 'admin' ? 'repeat(3, 1fr)' : '1fr', gap: 8 }}>
              <button className={`nd-btn ${!props.secretMode ? 'nd-btn-active' : ''}`} onClick={props.onToggleSecret} style={{ flexDirection: 'column', height: 'auto', padding: '12px 4px', gap: 6 }}>
                {props.secretMode ? <Eye size={18} /> : <EyeOff size={18} />}
                <span style={{ fontSize: '0.75rem' }}>{props.secretMode ? 'Cacher' : 'Visible'}</span>
              </button>
              {user?.role === 'admin' && (
                <>
                  <button className={`nd-btn ${props.editMode ? 'nd-btn-active' : ''}`} onClick={props.onToggleEdit} style={{ flexDirection: 'column', height: 'auto', padding: '12px 4px', gap: 6 }}>
                    <Pencil size={18} />
                    <span style={{ fontSize: '0.75rem' }}>Éditer</span>
                  </button>
                  <button className="nd-btn" onClick={() => { props.onOpenSettings(); setMobileMenuOpen(false); }} style={{ flexDirection: 'column', height: 'auto', padding: '12px 4px', gap: 6 }}>
                    <Settings size={18} />
                    <span style={{ fontSize: '0.75rem' }}>Paramètres</span>
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}

    </>
  );
}
