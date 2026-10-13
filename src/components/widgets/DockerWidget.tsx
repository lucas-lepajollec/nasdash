'use client';

import { demoFetch } from '@/lib/demoTransport';

import React, { useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { DockerActionConfig, DockerContainer } from '@/lib/types';
import { Plus, Pencil, GripVertical, Power, Play, RefreshCw, Layers, Loader2 } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useI18n } from '@/i18n/I18nProvider';
import { WidgetHeaderActions } from './WidgetHeaderActions';
import { dockerJsonFetcher, readDockerResponse, dockerActionError } from '@/lib/dockerErrorContract';
import { resolveDockerTarget } from '@/lib/dockerTargets';
import { CalmeWidget } from '@/widgets/calme';

const ICONS: Record<string, React.ReactNode> = {
  Power: <Power size={14} />,
  Play: <Play size={14} />,
  RefreshCw: <RefreshCw size={14} />,
  Layers: <Layers size={14} />,
};

function SortableActionItem({ action, editMode, onEdit, onExecute, isLoading }: { action: DockerActionConfig, editMode: boolean, onEdit: () => void, onExecute: () => void, isLoading: boolean }) {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: action.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : 1 };

  // Calme: a quiet row (icon, name, number of containers), styled in design-calme.css.
  return (
    <div
      ref={setNodeRef}
      style={{ ...style, opacity: isDragging ? 0.5 : 1 }}
      className={`ndc-action ${editMode ? 'ndc-action--editing' : ''}`}
      role={editMode ? undefined : 'button'}
      tabIndex={editMode ? undefined : 0}
      aria-busy={isLoading || undefined}
      onClick={() => { if (!editMode && !isLoading) onExecute(); }}
      onKeyDown={(e) => { if (!editMode && !isLoading && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onExecute(); } }}
    >
      {editMode ? (
        <span {...attributes} {...listeners} className="ndc-action-icon ndc-action-grip"><GripVertical size={14} /></span>
      ) : (
        <span className="ndc-action-icon">{isLoading ? <Loader2 size={14} className="nd-spin" /> : ICONS[action.icon] || <Play size={14} />}</span>
      )}
      <span className="ndc-action-text">
        <span className="ndc-action-name" title={t(action.name)}>{t(action.name)}</span>
        <span className="ndc-action-sub">{action.targets.length === 1 ? t('docker.calme.target') : t('docker.calme.targets', { count: action.targets.length })}</span>
      </span>
      {editMode && (
        <button type="button" className="ndc-icon-button" onClick={(e) => { e.stopPropagation(); onEdit(); }} aria-label={t('Modifier')}>
          <Pencil size={12} />
        </button>
      )}
    </div>
  );
}

export default function DockerWidget({ editMode }: { editMode?: boolean }) {
  const { t } = useI18n();
  const { config, setDockerActionModal, reorderDockerActions } = useConfig();
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});

  const [actionResults, setActionResults] = useState<Record<string, string>>({});
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (!config) return null;

  const actions = config.dockerActions || [];

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
    setActionResults(prev => ({ ...prev, [action.id]: '' }));
    try {
      const containerStates: { hostId: string, containerId: string, running: boolean, name: string }[] = [];
      
      // 1. Group targets by hostId to fetch container lists only once per host
      const uniqueHostIds = Array.from(new Set(action.targets.map(t => t.hostId)));
      const hostContainersMap: Record<string, DockerContainer[]> = {};

      await Promise.all(uniqueHostIds.map(async hostId => {
        hostContainersMap[hostId] = await dockerJsonFetcher(`/api/docker/${encodeURIComponent(hostId)}/containers?all=true`);
      }));
      // Validate every configured target before sending any operation.
      for (const target of action.targets) {
        const container = resolveDockerTarget(hostContainersMap[target.hostId], target.containerName);
        containerStates.push({ hostId: target.hostId, containerId: container.fullId || container.id, running: container.state === 'running', name: target.containerName });
      }
      if (!containerStates.length) throw new Error('docker.failure.missing_target');

      let targetOperation: 'start' | 'stop' = 'start';
      if (action.actionType === 'start') targetOperation = 'start';
      else if (action.actionType === 'stop') targetOperation = 'stop';
      else if (action.actionType === 'switch') {
        const runningCount = containerStates.filter(c => c.running).length;
        targetOperation = runningCount > (containerStates.length / 2) ? 'stop' : 'start';
      }

      const results: string[] = [];
      for (const container of containerStates) {
        const label = container.name;
        if (targetOperation === 'start' && container.running || targetOperation === 'stop' && !container.running) {
          results.push(`${label}: ${t('docker.action.unchanged')}`); continue;
        }
        try {
          await readDockerResponse(await demoFetch(`/api/docker/${encodeURIComponent(container.hostId)}/containers/${encodeURIComponent(container.containerId)}?action=${targetOperation}`, { method: 'POST', credentials: 'include' }));
          results.push(`${label}: ${t('docker.action.success')}`);
        } catch (error) { results.push(`${label}: ${dockerActionError(error, t)}`); }
      }
      setActionResults(prev => ({ ...prev, [action.id]: results.join(' · ') }));
    } catch (error) {
      const message = error instanceof Error && error.message.startsWith('docker.failure.') ? t(error.message) : dockerActionError(error, t);
      setActionResults(prev => ({ ...prev, [action.id]: message }));
    } finally {
      setLoadingActions(prev => ({ ...prev, [action.id]: false }));
    }
  };

  const addButton = editMode && (
    <WidgetHeaderActions>
      <button
        className="nd-action-icon success"
        onClick={() => setDockerActionModal({ open: true })}
        style={{ marginLeft: 'auto' }}
        title={t("Ajouter une action")}
      >
        <Plus size={13} />
      </button>
    </WidgetHeaderActions>
  );

  const list = (
    <>
      {actions.length === 0 && (
        <p className="ndc-empty">
          {t("Aucune action rapide configurée.")}{!editMode && t("Activez le mode édition pour en ajouter.")}
        </p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={actions.map(a => a.id)} strategy={rectSortingStrategy}>
          {actions.map((action) => (
            <React.Fragment key={action.id}>
            <SortableActionItem
              action={action}
              editMode={!!editMode}
              onEdit={() => setDockerActionModal({ open: true, action })}
              onExecute={() => executeAction(action)}
              isLoading={!!loadingActions[action.id]}
            />
            {actionResults[action.id] && <p role="status" className="ndc-dialog-hint">{actionResults[action.id]}</p>}
            </React.Fragment>
          ))}
        </SortableContext>
      </DndContext>
    </>
  );

  return (
    <CalmeWidget title={t("Actions Docker")} editMode={editMode}>
      {addButton}
      <div className="ndc-actions">{list}</div>
    </CalmeWidget>
  );
}
