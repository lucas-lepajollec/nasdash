import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { WIDGET_REGISTRY, getWidgetConfigKeys } from '@/lib/widgetRegistry';
import { WidgetRenderer } from '../../widgets/WidgetRenderer';
import { NetworkSidebar } from './NetworkSidebar';
import { TopologyMap } from './TopologyMap';

interface NetworksTabProps {
  editMode: boolean;
  searchQuery: string;
  isVisible: boolean;
  showSensitive?: boolean;
}

export default function NetworksTab({ editMode, searchQuery, isVisible, showSensitive = true }: NetworksTabProps) {
  const { config, updateConfig } = useConfig();

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

  // Active widgets list for Networks tab
  const activeWidgets = WIDGET_REGISTRY.map(w => {
    const hideKey = getWidgetConfigKeys(w.id).hide;
    const orderKey = getWidgetConfigKeys(w.id).order;

    const isGloballyHidden = (config?.settings as any)?.[hideKey] ?? w.defaultHidden;
    const isTabHidden = (tabConf as any)?.[hideKey] ?? false;

    const instanceId = `networks-${w.id}`;
    const instanceProps = (config?.settings as any)?.[`${instanceId}Props`] || (config?.settings as any)?.[`${w.id}Props`];

    return {
      id: w.id,
      visible: !isGloballyHidden && !isTabHidden,
      order: (tabConf as any)?.[orderKey] ?? ((config?.settings as any)?.[orderKey] ?? w.defaultOrder),
      render: () => (
        <WidgetRenderer 
          id={w.id} 
          editMode={editMode} 
          showSensitive={showSensitive} 
          categories={config?.categories || []} 
          widgetInstanceId={instanceId} 
          widgetProps={instanceProps} 
          onUpdateProps={(newProps) => updateConfig({ 
            [`${instanceId}Props`]: { 
              ...(instanceProps || {}), 
              ...newProps 
            } 
          })} 
        />
      )
    };
  }).filter(w => w.visible).sort((a, b) => a.order - b.order);

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
      {showWidgets && activeWidgets.length > 0 && (
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
          {activeWidgets.map(w => (
            <React.Fragment key={w.id}>{w.render()}</React.Fragment>
          ))}
        </aside>
      )}

    </div>
  );
}
