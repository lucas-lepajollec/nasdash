import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { WidgetContainer } from './WidgetContainer';

// Import all widgets
import ClockWidget from './ClockWidget';
import WeatherWidget from './WeatherWidget';
import QuickStatsWidget from './QuickStatsWidget';
import DevicesWidget from './DevicesWidget';
import TailscaleWidget from './TailscaleWidget';
import DockerWidget from './DockerWidget';
import CalendarWidget from './CalendarWidget';
import NetworkGraphWidget from './NetworkGraphWidget';
import DockerContainersWidget from './DockerContainersWidget';

interface WidgetRendererProps {
  id: string;
  layoutSize?: 'small' | 'medium' | 'full';
  editMode?: boolean;
  showSensitive?: boolean;
  categories?: any[]; // Passed down to QuickStats if needed
  widgetInstanceId?: string;
  widgetProps?: any;
  onUpdateProps?: (newProps: any) => void;
  isVisible?: boolean;
}

export function WidgetRenderer({ 
  id, 
  layoutSize = 'medium', 
  editMode = false, 
  showSensitive = false,
  categories = [],
  widgetInstanceId,
  widgetProps,
  onUpdateProps,
  isVisible = true,
}: WidgetRendererProps) {
  const { config, setDeviceModal, deleteDevice, reorderDevices } = useConfig();

  // Handle widget routing based on ID
  const renderWidget = () => {
    switch (id) {
      case 'clock':
        return <ClockWidget editMode={editMode} />;
      case 'weather':
        return <WeatherWidget editMode={editMode} isVisible={isVisible} />;
      case 'quickstats':
        // Fallback to config categories if not provided
        const finalCategories = categories.length > 0 ? categories : (config?.categories || []);
        return <QuickStatsWidget categories={finalCategories} editMode={editMode} />;
      case 'devices':
        return (
          <DevicesWidget 
            devices={config?.devices || []} 
            editMode={editMode} 
            widgetInstanceId={widgetInstanceId}
            widgetProps={widgetProps}
            onUpdateProps={onUpdateProps}
            onAddDevice={() => setDeviceModal({ open: true })}
            onEditDevice={(dev) => setDeviceModal({ open: true, device: dev })}
            onDeleteDevice={async (deviceId) => { await deleteDevice(deviceId); setDeviceModal({ open: false }); }}
            onReorderDevices={reorderDevices}
            isVisible={isVisible}
          />
        );
      case 'tailscale':
        return <TailscaleWidget editMode={editMode} showSensitive={showSensitive} isVisible={isVisible} />;
      case 'dockeractions':
        return <DockerWidget editMode={editMode} />;
      case 'calendar':
        return <CalendarWidget editMode={editMode} isVisible={isVisible} />;
      case 'networkgraph':
        return <NetworkGraphWidget editMode={editMode} />;
      case 'dockercontainers':
        return <DockerContainersWidget editMode={editMode} widgetInstanceId={widgetInstanceId} widgetProps={widgetProps} onUpdateProps={onUpdateProps} isVisible={isVisible} />;
      default:
        return (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--nd-text-muted)', background: 'var(--nd-bg)', border: '1px dashed var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
            Widget inconnu ({id})
          </div>
        );
    }
  };

  return <WidgetContainer>{renderWidget()}</WidgetContainer>;
}
