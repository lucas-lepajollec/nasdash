'use client';

import React, { useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { DockerActionConfig, DockerContainer } from '@/lib/types';
import { Plus, Pencil, GripVertical, Power, Play, RefreshCw, Layers, Loader2 } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const ICONS: Record<string, React.ReactNode> = {
  Power: <Power size={14} />,
  Play: <Play size={14} />,
  RefreshCw: <RefreshCw size={14} />,
  Layers: <Layers size={14} />,
};

function SortableActionItem({ action, editMode, onEdit, onExecute, isLoading }: { action: DockerActionConfig, editMode: boolean, onEdit: () => void, onExecute: () => void, isLoading: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: action.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : 1 };

  return (
    <div 
      ref={setNodeRef} 
      style={{
        ...style,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 12px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--nd-border)',
        borderRadius: 8,
        cursor: editMode ? 'default' : 'pointer',
        opacity: isDragging ? 0.5 : 1,
      }}
      onClick={() => { if (!editMode && !isLoading) onExecute(); }}
    >
      {editMode ? (
        <div {...attributes} {...listeners} style={{ cursor: 'grab', display: 'flex', color: 'var(--nd-text-muted)' }}>
          <GripVertical size={14} />
        </div>
      ) : (
        <div style={{ color: 'var(--nd-accent)' }}>
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : ICONS[action.icon] || <Play size={14} />}
        </div>
      )}
      
      <div style={{ flex: 1, fontSize: '0.75rem', fontWeight: 600 }}>{action.name}</div>
      
      {editMode && (
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} style={{ background: 'none', border: 'none', color: 'var(--nd-text-muted)', cursor: 'pointer' }}>
          <Pencil size={12} />
        </button>
      )}
    </div>
  );
}

export default function DockerActions({ editMode }: { editMode?: boolean }) {
  const { config, setDockerActionModal, reorderDockerActions } = useConfig();
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (!config) return null;

  const actions = config.dockerActions || [];

  if (!editMode && actions.length === 0) return null;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = actions.findIndex((a) => a.id === active.id);
      const newIndex = actions.findIndex((a) => a.id === over.id);
      const newActions = [...actions];
      const [moved] = newActions.splice(oldIndex, 1);
      newActions.splice(newIndex, 0, moved);
      reorderDockerActions(newActions);
    }
  };

  const executeAction = async (action: DockerActionConfig) => {
    setLoadingActions(prev => ({ ...prev, [action.id]: true }));
    try {
      // 1. Fetch current status of all target containers
      const containerStates: { hostId: string, containerId: string, running: boolean }[] = [];
      
      await Promise.all(action.targets.map(async (target) => {
        try {
          const res = await fetch(`/api/docker/${target.hostId}/containers?all=true`);
          if (res.ok) {
            const containers = await res.json() as DockerContainer[];
            const c = containers.find(c => c.names.some(n => n.replace(/^\//, '') === target.containerName));
            if (c) {
              containerStates.push({ hostId: target.hostId, containerId: c.id, running: c.state === 'running' });
            }
          }
        } catch (e) {
          console.error(`Error fetching container ${target.containerName}`, e);
        }
      }));

      // 2. Determine target state (start or stop)
      let targetOperation: 'start' | 'stop' = 'start';
      if (action.actionType === 'start') targetOperation = 'start';
      else if (action.actionType === 'stop') targetOperation = 'stop';
      else if (action.actionType === 'switch') {
        const runningCount = containerStates.filter(c => c.running).length;
        // Majority rule: if more than half are running, stop them all. Otherwise, start them all.
        targetOperation = runningCount > (containerStates.length / 2) ? 'stop' : 'start';
      }

      // 3. Execute action
      await Promise.all(containerStates.map(async (c) => {
        // Skip if already in desired state
        if (targetOperation === 'start' && c.running) return;
        if (targetOperation === 'stop' && !c.running) return;

        try {
          await fetch(`/api/docker/${c.hostId}/containers/${c.containerId}?action=${targetOperation}`, { method: 'POST' });
        } catch (e) {
          console.error(`Failed to ${targetOperation} container ${c.containerId}`, e);
        }
      }));

    } finally {
      setLoadingActions(prev => ({ ...prev, [action.id]: false }));
    }
  };

  return (
    <div className="nd-sidebar-card nd-animate-in nd-stagger-2">
      <div className="nd-section-title">
        <Layers size={12} style={{ color: 'var(--nd-blue)' }} /> Actions Docker
        {editMode && (
          <button 
            className="nd-action-icon success" 
            onClick={() => setDockerActionModal({ open: true })} 
            style={{ marginLeft: 'auto' }} 
            title="Ajouter une action"
          >
            <Plus size={13} />
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
        {actions.length === 0 && editMode && (
          <p style={{ fontSize: '0.65rem', color: 'var(--nd-text-muted)', textAlign: 'center', padding: '12px 0' }}>
            Aucune action rapide configurée.
          </p>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={actions.map(a => a.id)} strategy={verticalListSortingStrategy}>
            {actions.map((action) => (
              <SortableActionItem 
                key={action.id} 
                action={action} 
                editMode={!!editMode} 
                onEdit={() => setDockerActionModal({ open: true, action })}
                onExecute={() => executeAction(action)}
                isLoading={!!loadingActions[action.id]}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
