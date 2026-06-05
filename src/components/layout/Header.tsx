'use client';

import { useState } from 'react';
import { Search, Pencil, Settings, Plus, X, Shield, Eye, EyeOff, Menu } from 'lucide-react';
import { TabId, TabDef } from '@/hooks/useTabs';
import { useConfig } from '@/hooks/useConfig';
import { HeaderElementDesktop, HeaderElementMobile } from '@/lib/types';

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
}

export default function Header(props: HeaderProps) {
  const { config, setSettingsModal } = useConfig();
  const isHome = !props.activeTab || props.activeTab === 'dashboard';
  const currentTabDef = props.tabs?.find(t => t.id === props.activeTab);
  const isCustomTab = currentTabDef?.isCustom === true;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        {tabsToRender.map(tab => {
          const isActive = tab.id === props.activeTab;
          const showIcons = config?.settings?.showHeaderMenuIcons;
          const iconVal = showIcons ? (config?.settings?.tabIcons?.[tab.id] || tab.icon) : null;
          return (
            <button
              key={tab.id}
              onClick={() => props.onSwitchTab?.(tab.id)}
              className="nd-btn-menu-link"
              style={{
                padding: '6px 12px',
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
              {iconVal && <span>{iconVal}</span>}
              <span style={{ fontSize: '0.8rem', fontWeight: isActive ? 600 : 500 }}>{tab.name}</span>
            </button>
          )
        })}
      </nav>
    );
  };

  const renderElement = (type: HeaderElementDesktop | HeaderElementMobile, isMobile: boolean) => {
    switch(type) {
      case 'title': return <BrandElement isMobile={isMobile} />;
      case 'search': return <SearchElement isMobile={isMobile} />;
      case 'menu': return (!isMobile && layoutDesktop?.splitMenuAround === 'none') || isMobile ? <MenuElement isMobile={isMobile} /> : null;
      default: return null;
    }
  };

  const renderSplitMenuCenter = () => {
    if (layoutDesktop.splitMenuAround === 'none') return null;
    
    const tabsCount = props.tabs?.length || 0;
    const mid = Math.ceil(tabsCount / 2);
    
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <MenuElement startIndex={0} endIndex={mid} />
        {layoutDesktop.splitMenuAround === 'title' ? <BrandElement isMobile={false} /> : <SearchElement />}
        <MenuElement startIndex={mid} endIndex={tabsCount} />
      </div>
    );
  };

  const ActionsDesktop = () => (
    <div className="nd-header-actions nd-desktop-actions pr-2 md:pr-0" style={{ display: 'flex', gap: 8 }}>
      {props.editMode && (isHome || props.activeTab === 'widgets' || isCustomTab) && (
        <div style={{ display: 'flex', gap: 8 }}>
          {(isHome || props.activeTab === 'widgets') && (
            <button className="nd-btn" onClick={props.onAddSlot} title="Ajouter un emplacement">
              <Plus size={12} />
              Emplacement
            </button>
          )}
          {isHome && (
            <button className="nd-btn" onClick={props.onAddCategory}>
              <Plus size={12} />
              Catégorie
            </button>
          )}
          {isCustomTab && (
            <button className="nd-btn" onClick={() => setSettingsModal({ open: true, targetTab: 'custom-tab-builder', targetCustomTabId: props.activeTab })}>
              <Pencil size={12} />
              Structure
            </button>
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
    </div>
  );

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
        <div className="nd-header-mobile" style={{ width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '12px' }}>
            {renderElement(layoutMobile.left || 'title', true)}
            {renderElement(layoutMobile.center || 'search', true)}
          </div>

          <div className="nd-header-actions nd-mobile-actions pr-2">
            <button className={`nd-btn ${mobileMenuOpen ? 'nd-btn-active' : ''}`} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              <Menu size={16} />
            </button>
          </div>
        </div>

      </header>

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
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Menu</h3>
              <button className="nd-btn" onClick={() => setMobileMenuOpen(false)} style={{ padding: 8 }}>
                <X size={16} />
              </button>
            </div>

            {/* Tabs List */}
            {props.tabs && props.tabs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                      style={{ justifyContent: 'flex-start', padding: '12px 16px', width: '100%', border: isActive ? '1px solid var(--nd-accent)' : '1px solid transparent' }}
                    >
                      <span className="nd-dock-item-icon" style={{ marginRight: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: isActive ? 'var(--nd-accent)' : 'inherit', fontSize: '18px' }}>{tab.icon}</span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 500 }}>{tab.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div style={{ height: 1, background: 'var(--nd-border)', margin: '4px 0' }} />

            {/* Global Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 10 }}>
              <button className={`nd-btn ${!props.secretMode ? 'nd-btn-active' : ''}`} onClick={props.onToggleSecret} style={{ flexDirection: 'column', height: 'auto', padding: '16px 8px', gap: 8 }}>
                {props.secretMode ? <Eye size={20} /> : <EyeOff size={20} />}
                <span style={{ fontSize: '0.8rem' }}>{props.secretMode ? 'Cacher' : 'Visible'}</span>
              </button>
              <button className={`nd-btn ${props.editMode ? 'nd-btn-active' : ''}`} onClick={props.onToggleEdit} style={{ flexDirection: 'column', height: 'auto', padding: '16px 8px', gap: 8 }}>
                <Pencil size={20} />
                <span style={{ fontSize: '0.8rem' }}>Éditer</span>
              </button>
              <button className="nd-btn" onClick={() => { props.onOpenSettings(); setMobileMenuOpen(false); }} style={{ flexDirection: 'column', height: 'auto', padding: '16px 8px', gap: 8 }}>
                <Settings size={20} />
                <span style={{ fontSize: '0.8rem' }}>Paramètres</span>
              </button>
            </div>

            {props.editMode && (
              <>
                <div style={{ height: 1, background: 'var(--nd-border)', margin: '4px 0' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(isHome || props.activeTab === 'widgets') && (
                    <div style={{ display: 'grid', gridTemplateColumns: isHome ? '1fr 1fr' : '1fr', gap: 8 }}>
                      <button className="nd-btn" onClick={() => { props.onAddSlot?.(); setMobileMenuOpen(false); }} style={{ justifyContent: 'center' }}>
                        <Plus size={14} style={{ marginRight: 6 }} /> Emplacement
                      </button>
                      {isHome && (
                        <button className="nd-btn" onClick={() => { props.onAddCategory(); setMobileMenuOpen(false); }} style={{ justifyContent: 'center' }}>
                          <Plus size={14} style={{ marginRight: 6 }} /> Catégorie
                        </button>
                      )}
                    </div>
                  )}
                  {isCustomTab && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                      <button className="nd-btn" onClick={() => { setSettingsModal({ open: true, targetTab: 'custom-tab-builder', targetCustomTabId: props.activeTab }); setMobileMenuOpen(false); }} style={{ justifyContent: 'center' }}>
                        <Pencil size={14} style={{ marginRight: 6 }} /> Modifier la structure
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </>
  );
}
