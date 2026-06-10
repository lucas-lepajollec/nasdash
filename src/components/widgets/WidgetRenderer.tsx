import React from 'react';
import { useConfig } from '@/hooks/useConfig';

// Import all widgets
import ClockWidget from './ClockWidget';
import WeatherWidget from './WeatherWidget';
import QuickStatsWidget from './QuickStatsWidget';
import DevicesWidget from './DevicesWidget';
import TailscaleWidget from './TailscaleWidget';
import DockerWidget from './DockerWidget';
import CalendarWidget from './CalendarWidget';
import NetworkGraphWidget from './NetworkGraphWidget';

interface WidgetRendererProps {
  id: string;
  layoutSize?: 'small' | 'medium' | 'full';
  editMode?: boolean;
  showSensitive?: boolean;
  categories?: any[]; // Passed down to QuickStats if needed
}

export function WidgetRenderer({ 
  id, 
  layoutSize = 'medium', 
  editMode = false, 
  showSensitive = false,
  categories = []
}: WidgetRendererProps) {
  const { config, setDeviceModal, deleteDevice, reorderDevices } = useConfig();

  // Handle widget routing based on ID
  switch (id) {
    case 'clock':
      return <ClockWidget layoutSize={layoutSize} editMode={editMode} />;
    case 'weather':
      return <WeatherWidget layoutSize={layoutSize} editMode={editMode} />;
    case 'quickstats':
      // Fallback to config categories if not provided
      const finalCategories = categories.length > 0 ? categories : (config?.categories || []);
      return <QuickStatsWidget categories={finalCategories} layoutSize={layoutSize} editMode={editMode} />;
    case 'devices':
      return (
        <DevicesWidget 
          devices={config?.devices || []} 
          editMode={editMode} 
          onAddDevice={() => setDeviceModal({ open: true })}
          onEditDevice={(dev) => setDeviceModal({ open: true, device: dev })}
          onDeleteDevice={async (deviceId) => { await deleteDevice(deviceId); setDeviceModal({ open: false }); }}
          onReorderDevices={reorderDevices}
        />
      );
    case 'tailscale':
      return <TailscaleWidget editMode={editMode} showSensitive={showSensitive} />;
    case 'dockeractions':
      return <DockerWidget editMode={editMode} />;
    case 'calendar':
      return <CalendarWidget editMode={editMode} />;
    case 'networkgraph':
      return <NetworkGraphWidget editMode={editMode} />;
    default:
      return (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--nd-text-muted)', background: 'var(--nd-bg)', border: '1px dashed var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
          Widget inconnu ({id})
        </div>
      );
  }
}
