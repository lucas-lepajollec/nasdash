import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { WIDGET_REGISTRY, getWidgetConfigKeys } from '@/lib/widgetRegistry';
import { NetworkSidebar } from './NetworkSidebar';
import { TopologyMap } from './TopologyMap';
import { WidgetPanel } from '../../shared/WidgetPanel';

interface NetworksTabProps {
  editMode: boolean;
  searchQuery: string;
  isVisible: boolean;
  showSensitive?: boolean;
}

export default function NetworksTab({ editMode, searchQuery, isVisible, showSensitive = true }: NetworksTabProps) {
  const { config, user } = useConfig();

  const sidebarRef = React.useRef<HTMLElement>(null);
  const widgetsSidebarRef = React.useRef<HTMLElement>(null);
  const [sidebarSticky, setSidebarSticky] = React.useState(true);
  const [widgetsSticky, setWidgetsSticky] = React.useState(true);

  React.useEffect(() => {
    if (!isVisible) return;
    const checkSticky = () => {
      if (sidebarRef.current) {
        setSidebarSticky(sidebarRef.current.scrollHeight + 40 < window.innerHeight);
      }
      if (widgetsSidebarRef.current) {
        setWidgetsSticky(widgetsSidebarRef.current.scrollHeight + 40 < window.innerHeight);
      }
    };

    checkSticky();
    window.addEventListener('resize', checkSticky);
    
    const observer = new ResizeObserver(checkSticky);
    if (sidebarRef.current) observer.observe(sidebarRef.current);
    if (widgetsSidebarRef.current) observer.observe(widgetsSidebarRef.current);

    return () => {
      window.removeEventListener('resize', checkSticky);
      observer.disconnect();
    };
  }, [config, editMode, isVisible]);

  if (!isVisible) return null;

  const tabConf = config?.settings?.tabs?.networks || {};
  const networksPanelPos = tabConf.networksPanelPosition || 'left';
  const showWidgets = !(tabConf.hideWidgetsSidebar ?? true);
  const widgetsPos = tabConf.widgetsSidebarPosition || 'right';

  // Determine flex orders for columns
  let networksSidebarOrder = 1; // Left sidebar (NetworkSidebar)
  let networksMainOrder = 2;    // Central main content (TopologyMap)
  let widgetsSidebarOrder = 3;  // Right sidebar (Widgets)

  if (networksPanelPos === 'left' && widgetsPos === 'right') {
    networksSidebarOrder = 1;
    networksMainOrder = 2;
    widgetsSidebarOrder = 3;
  } else if (networksPanelPos === 'right' && widgetsPos === 'left') {
    widgetsSidebarOrder = 1;
    networksMainOrder = 2;
    networksSidebarOrder = 3;
  } else if (networksPanelPos === 'left' && widgetsPos === 'left') {
    widgetsSidebarOrder = 1;
    networksSidebarOrder = 2;
    networksMainOrder = 3;
  } else if (networksPanelPos === 'right' && widgetsPos === 'right') {
    networksMainOrder = 1;
    widgetsSidebarOrder = 2;
    networksSidebarOrder = 3;
  }

  const hasWidgets = (panelId: string) => {
    const p = config?.settings?.panels?.[panelId];
    if (!p || !p.widgets || p.widgets.length === 0) return false;
    return p.widgets.some((w: any) => {
      if (user && user.role !== 'admin' && user.allowedWidgets && user.allowedWidgets.length > 0) {
        if (!user.allowedWidgets.includes(w.type)) return false;
      }
      const def = WIDGET_REGISTRY.find(x => x.id === w.type);
      if (!def) return false;
      const hideKey = getWidgetConfigKeys(w.type).hide;
      const isGloballyHidden = (config.settings as any)?.[hideKey] ?? def.defaultHidden;
      return !isGloballyHidden;
    });
  };

  return (
    <div className="nd-networks-layout nd-animate-in">
      
      {/* 1. Left Sidebar: Ports & tools */}
      <aside 
        ref={sidebarRef}
        className="nd-networks-sidebar" 
        style={{ 
          order: networksSidebarOrder,
          position: sidebarSticky ? 'sticky' : 'static',
          maxHeight: 'none',
          overflowY: 'visible'
        }}
      >
        <NetworkSidebar />
      </aside>

      {/* 2. Main Content: Topology Map */}
      <div className="nd-networks-main" style={{ order: networksMainOrder }}>
        <TopologyMap editMode={editMode} searchQuery={searchQuery} showSensitive={showSensitive} />
      </div>

      {/* 3. Optional Sidebar: Active Widgets */}
      {showWidgets && hasWidgets('networks-widgets') && (
        <aside 
          ref={widgetsSidebarRef}
          className="nd-networks-widgets-sidebar" 
          style={{ 
            order: widgetsSidebarOrder,
            position: widgetsSticky ? 'sticky' : 'static',
            maxHeight: 'none',
            overflowY: 'visible'
          }}
        >
          <WidgetPanel panelId="networks-widgets" editMode={editMode} showSensitive={showSensitive} />
        </aside>
      )}

    </div>
  );
}
