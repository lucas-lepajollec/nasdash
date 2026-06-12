'use client';

import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { DndContext, closestCenter, pointerWithin, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay, useDraggable, useDroppable, defaultDropAnimationSideEffects } from '@dnd-kit/core';
import { Trash2, Plus } from 'lucide-react';

import { WidgetRenderer } from '../../widgets/WidgetRenderer';
import { WIDGET_REGISTRY, getWidgetConfigKeys } from '@/lib/widgetRegistry';

function DroppableSlot({ id, editMode, children }: { id: string, editMode: boolean, children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} style={{ position: 'relative', height: '100%', ...(isOver ? { outline: '2px dashed var(--nd-accent)', outlineOffset: 4, borderRadius: 'var(--nd-card-radius)' } : {}) }}>
      {children}
    </div>
  );
}

function DraggableWidget({ id, editMode, children }: { id: string, editMode: boolean, children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  
  if (!editMode) return <div style={{ height: '100%' }}>{children}</div>;
  
  return (
    <div ref={setNodeRef} style={{ height: '100%', opacity: isDragging ? 0 : 1, cursor: 'grab' }} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

export default function WidgetsTab({ editMode, isVisible, showSensitive, categories }: { editMode: boolean, isVisible: boolean, showSensitive: boolean, categories: any[] }) {
  const { 
    config, 
    updateConfig, 
    refresh,
    setDeviceModal,
    deleteDevice,
    reorderDevices
  } = useConfig();
  
  const [activeWidgetId, setActiveWidgetId] = React.useState<string | null>(null);
  const [colCount, setColCount] = React.useState(5);

  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) setColCount(1);
      else if (window.innerWidth <= 1100) setColCount(3);
      else if (window.innerWidth <= 1400) setColCount(4);
      else setColCount(5);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  if (!isVisible) return null;

  // Determine available widgets for this tab
  const tabConf = config?.settings?.tabs?.widgets || {};
  const globalConf = config?.settings || {};

  const widgetsList = WIDGET_REGISTRY.map(w => {
    const hideKey = getWidgetConfigKeys(w.id).hide;
    const isGloballyHidden = (config?.settings as any)?.[hideKey] ?? w.defaultHidden;
    const isTabHidden = (tabConf as any)?.[hideKey] ?? false;
    
    return {
      id: w.id,
      component: <WidgetRenderer id={w.id} editMode={editMode} showSensitive={showSensitive} categories={categories} widgetInstanceId={w.id} widgetProps={(config?.settings as any)?.[`${w.id}Props`]} onUpdateProps={(newProps) => updateConfig({ [`${w.id}Props`]: { ...((config?.settings as any)?.[`${w.id}Props`] || {}), ...newProps } })} />,
      hidden: isGloballyHidden || isTabHidden
    };
  });

  const visibleWidgets = widgetsList.filter(w => !w.hidden);
  
  // Implementation of Freeform Grid with dynamic slots
  const TOTAL_SLOTS = config?.settings?.widgetsTotalSlots || Math.max(5, visibleWidgets.length);
  const rawOrder = config?.settings?.widgetsOrder || [];
  
  // Create our grid array based on saved order
  let gridArray = [...rawOrder];
  
  // Fill missing slots
  while (gridArray.length < TOTAL_SLOTS) {
    gridArray.push(`empty-${Math.random().toString(36).substr(2, 9)}`);
  }
  
  // Trim excess empty slots if needed
  if (gridArray.length > TOTAL_SLOTS) {
    for (let i = gridArray.length - 1; i >= 0; i--) {
      if (gridArray.length <= TOTAL_SLOTS) break;
      if (gridArray[i].startsWith('empty-')) {
        gridArray.splice(i, 1);
      }
    }
    // Note: We don't call updateConfig here to avoid infinite loops, 
    // it will be saved naturally on next drag or save
  }

  // Ensure all visible widgets are placed
  const unplacedWidgets: typeof visibleWidgets = [];
  visibleWidgets.forEach(w => {
    if (!gridArray.includes(w.id)) {
      unplacedWidgets.push(w);
    }
  });

  unplacedWidgets.forEach(w => {
    const emptyIndex = gridArray.findIndex(id => id.startsWith('empty-'));
    if (emptyIndex !== -1) {
      gridArray[emptyIndex] = w.id;
    } else {
      gridArray.push(w.id); // Append if no room
    }
  });

  const handleAddSlot = async () => {
    const newGrid = [...gridArray, `empty-${Math.random().toString(36).substr(2, 9)}`];
    await updateConfig({ 
      widgetsTotalSlots: newGrid.length,
      widgetsOrder: newGrid
    });
    refresh();
  };

  const handleRemoveSlot = async (slotId: string) => {
    const newGrid = gridArray.filter(id => id !== slotId);
    await updateConfig({ 
      widgetsTotalSlots: newGrid.length,
      widgetsOrder: newGrid
    });
    refresh();
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveWidgetId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveWidgetId(null);
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = gridArray.indexOf(active.id as string);
      const newIndex = parseInt(over.id as string, 10);
      
      if (oldIndex !== -1 && !isNaN(newIndex) && oldIndex !== newIndex) {
        const newGrid = [...gridArray];
        // Swap them!
        newGrid[oldIndex] = gridArray[newIndex];
        newGrid[newIndex] = active.id as string;
        
        await updateConfig({ widgetsOrder: newGrid });
        refresh();
      }
    }
  };

  const columns: { itemId: string, originalIndex: number }[][] = Array.from({ length: colCount }, () => []);
  gridArray.forEach((itemId, i) => columns[i % colCount].push({ itemId, originalIndex: i }));

  return (
    <div className="nd-tab-content nd-animate-in" style={{ padding: '8px 20px 40px', maxWidth: '100%', margin: '0 auto', width: '100%' }}>
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
          {columns.map((col, ci) => (
            <div key={ci} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
              {col.map((item) => {
                const { itemId, originalIndex: index } = item;
                const isTargetEmpty = itemId.startsWith('empty-');
                
                if (!editMode && colCount === 1 && isTargetEmpty) return null;

                return (
                  <DroppableSlot key={`${index}-${itemId}`} id={index.toString()} editMode={editMode}>
                  <DraggableWidget id={itemId} editMode={editMode}>
                    {isTargetEmpty ? (
                      <div style={{ 
                        height: '100%', 
                        minHeight: '120px', 
                        borderRadius: 'var(--nd-card-radius)',
                        border: editMode ? '2px dashed var(--nd-card-border)' : 'none',
                        background: 'transparent',
                        transition: 'all 0.2s',
                        opacity: editMode ? 1 : 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--nd-text-dimmed)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        position: 'relative'
                      }}>
                        {editMode && (
                          <>
                            <span>Emplacement vide</span>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleRemoveSlot(itemId); }}
                              className="nd-action-icon danger"
                              style={{ position: 'absolute', right: 16 }}
                              title="Supprimer cet emplacement"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      visibleWidgets.find(w => w.id === itemId)?.component
                    )}
                  </DraggableWidget>
                </DroppableSlot>
              );
            })}
          </div>
        ))}
        </div>

        <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }) }}>
          {activeWidgetId ? (
            <div style={{ transform: 'scale(1.02)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', borderRadius: 'var(--nd-card-radius)', opacity: 0.9 }}>
              {activeWidgetId.startsWith('empty-') ? (
                <div style={{ 
                  height: '120px', 
                  borderRadius: 'var(--nd-card-radius)',
                  border: '2px dashed var(--nd-card-border)',
                  background: 'var(--nd-bg-dark)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--nd-text-dimmed)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}>
                  <span>Emplacement vide</span>
                </div>
              ) : (
                visibleWidgets.find(w => w.id === activeWidgetId)?.component
              )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
