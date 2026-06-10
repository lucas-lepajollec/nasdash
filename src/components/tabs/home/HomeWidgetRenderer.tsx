import React from 'react';
import { CustomTabWidgetInfo } from '@/lib/types';
import { useConfig } from '@/hooks/useConfig';

import ClockWidget from '../../widgets/ClockWidget';
import WeatherWidget from '../../widgets/WeatherWidget';
import QuickStatsWidget from '../../widgets/QuickStatsWidget';
import DevicesWidget from '../../widgets/DevicesWidget';
import TailscaleWidget from '../../widgets/TailscaleWidget';
import DockerWidget from '../../widgets/DockerWidget';
import CalendarWidget from '../../widgets/CalendarWidget';

interface HomeWidgetRendererProps {
  widget: CustomTabWidgetInfo & { id: string, order: number };
  editMode: boolean;
  showSensitive?: boolean;
  onDelete: (id: string) => void;
  onUpdateHeight?: (id: string, newHeight: number) => void;
}

export default function HomeWidgetRenderer({ widget, editMode, showSensitive = false, onDelete, onUpdateHeight }: HomeWidgetRendererProps) {
  const { config } = useConfig();
  
  // By default, widgets in Home occupy the full slot size
  const size = 'full';

  const renderWidgetContent = () => {
    switch (widget.type) {
      case 'clock':
        return <ClockWidget layoutSize={size} editMode={editMode} />;
      case 'weather':
        return <WeatherWidget layoutSize={size} editMode={editMode} />;
      case 'quickstats':
        return <QuickStatsWidget categories={config?.categories || []} layoutSize={size} editMode={editMode} />;
      case 'devices':
        return <DevicesWidget devices={config?.devices || []} editMode={editMode} />;
      case 'tailscale':
        return <TailscaleWidget editMode={editMode} showSensitive={showSensitive} />;
      case 'dockeractions':
        return <DockerWidget editMode={editMode} />;
      case 'calendar':
        return <CalendarWidget editMode={editMode} />;
      case 'spacer':
        return (
          <div style={{
            height: widget.height || 120,
            minHeight: editMode ? 60 : undefined,
            width: '100%',
            background: editMode ? 'rgba(255,255,255,0.02)' : 'transparent',
            border: editMode ? '1px dashed var(--nd-card-border)' : 'none',
            borderRadius: 'var(--nd-card-radius)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: editMode ? 'none' : 'all 0.2s',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {editMode && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '80%' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--nd-text-muted)', fontWeight: 600 }}>
                  Espace ({widget.height || 120}px)
                </span>
                <input 
                  type="range" 
                  min="20" 
                  max="1000" 
                  step="10" 
                  value={widget.height || 120}
                  onChange={(e) => onUpdateHeight && onUpdateHeight(widget.id, parseInt(e.target.value))}
                  style={{ width: '100%', cursor: 'ew-resize', accentColor: 'var(--nd-accent)' }}
                  onClick={(e) => e.stopPropagation()} // Prevent drag start when adjusting slider
                  onPointerDown={(e) => e.stopPropagation()}
                />
              </div>
            )}
          </div>
        );
      default:
        return (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--nd-text-muted)', background: 'var(--nd-bg)', border: '1px dashed var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
            Widget inconnu ({widget.type})
          </div>
        );
    }
  };

  return (
    <div className="nd-widget-card" style={{ position: 'relative', width: '100%' }}>
      {renderWidgetContent()}
    </div>
  );
}
