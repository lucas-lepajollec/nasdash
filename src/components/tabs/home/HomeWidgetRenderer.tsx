import React from 'react';
import { CustomTabWidgetInfo } from '@/lib/types';
import { useConfig } from '@/hooks/useConfig';

import { WidgetRenderer } from '../../widgets/WidgetRenderer';

interface HomeWidgetRendererProps {
  widget: CustomTabWidgetInfo & { id: string, order: number };
  editMode: boolean;
  showSensitive?: boolean;
  onDelete: (id: string) => void;
  onUpdateHeight?: (id: string, newHeight: number) => void;
}

export default function HomeWidgetRenderer({ widget, editMode, showSensitive = false, onDelete, onUpdateHeight }: HomeWidgetRendererProps) {
  const { config, updateHomeWidgetProps } = useConfig();
  
  // By default, widgets in Home BentoGrid slots occupy the medium slot size
  const size = 'medium';

  const renderWidgetContent = () => {
    if (widget.type === 'spacer') {
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
    }
    
    return <WidgetRenderer id={widget.type} layoutSize={size} editMode={editMode} showSensitive={showSensitive} widgetInstanceId={widget.id} widgetProps={widget.props} onUpdateProps={(newProps) => updateHomeWidgetProps && updateHomeWidgetProps(widget.id, newProps)} />;
  };

  return (
    <div className={`nd-widget-card ${widget.type === 'spacer' ? 'nd-spacer-widget' : ''}`} style={{ position: 'relative', width: '100%' }}>
      {renderWidgetContent()}
    </div>
  );
}
