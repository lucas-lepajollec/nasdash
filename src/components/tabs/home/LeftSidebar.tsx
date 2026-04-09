'use client';

import useSWR from 'swr';
import { HardDrive, Plus, Pencil, Trash2, Loader2, AlertCircle, GripVertical } from 'lucide-react';
import { Device, DeviceStat } from '@/lib/types';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, useRef, useEffect } from 'react';
import ConfirmModal from '../../shared/ConfirmModal';

interface LeftSidebarProps {
  devices: Device[];
  editMode: boolean;
  onAddDevice?: () => void;
  onEditDevice?: (device: Device) => void;
  onDeleteDevice?: (id: string) => void;
  onReorderDevices?: (devices: Device[]) => void;
}

// Composant pour chaque carte d'appareil avec drag & drop
function SortableDeviceCard({
  device,
  editMode,
  onEdit,
  onDelete,
}: {
  device: Device;
  editMode: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `drag-device-${device.id}`,
    disabled: !editMode,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: editMode ? 'grab' : 'default',
    position: 'relative',
    zIndex: isDragging ? 1 : 0,
    touchAction: 'pan-y',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <DeviceMonitorCardContent
        device={device}
        editMode={editMode}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}j ${h}h`;
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function progressColor(percent: number): string {
  if (percent >= 90) return 'nd-progress-danger';
  if (percent >= 70) return 'nd-progress-warn';
  return '';
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

function DeviceMonitorCardContent({
  device,
  editMode,
  onEdit,
  onDelete,
}: {
  device: Device;
  editMode: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const isApiDevice = !!device.api;
  const { data: stats, error, isLoading } = useSWR<DeviceStat[] | { error: string, isOffline?: boolean }>(
    isApiDevice ? `/api/devices/${device.id}` : null,
    fetcher,
    { refreshInterval: 5000 } // Poll every 5s
  );

  const displayStats = isApiDevice ? (Array.isArray(stats) ? stats : device.stats || []) : (device.stats || []);
  const isOffline = error || (stats && 'error' in stats && stats.isOffline);
  const errorMessage = stats && 'error' in stats ? stats.error : 'Impossible de joindre l\'appareil';

  return (
    <div className="nd-sidebar-card" style={{ marginTop: 8, padding: 10, opacity: isOffline ? 0.6 : 1, filter: isOffline ? 'grayscale(0.8)' : 'none', transition: 'all 0.3s', userSelect: editMode ? 'none' : 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1 }}>
          {editMode && (
            <div style={{ cursor: 'grab', display: 'flex', alignItems: 'center', padding: 4, marginRight: -4 }}>
              <GripVertical size={12} style={{ color: 'var(--nd-text-dimmed)' }} />
            </div>
          )}
          <span style={{ fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span>{device.icon}</span>
            {device.name}
            {isLoading && isApiDevice && !stats && <Loader2 size={10} className="nd-spin" style={{ color: 'var(--nd-text-dimmed)' }} />}
            {isOffline && <span title={errorMessage} style={{ display: 'flex' }}><AlertCircle size={10} style={{ color: 'var(--nd-red)' }} /></span>}
          </span>
        </div>
        {editMode && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="nd-action-icon accent" onClick={(e) => { e.stopPropagation(); onEdit?.(); }} title="Modifier l'appareil">
              <Pencil size={13} />
            </button>
            <button className="nd-action-icon danger" onClick={(e) => { e.stopPropagation(); onDelete?.(); }} title="Supprimer l'appareil">
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
      <div style={{ fontSize: '0.62rem', color: 'var(--nd-text-dimmed)', marginBottom: 6 }}>{device.host}</div>

      {isOffline && (
        <div style={{ fontSize: '0.65rem', color: 'var(--nd-red)', marginTop: 4 }}>Hors ligne</div>
      )}

      {!isOffline && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {displayStats.map((stat, i) => (
            <div key={i}>
              <div className="nd-stat-row" style={{ fontSize: '0.7rem', flexWrap: 'wrap', gap: '2px 8px' }}>
                <span className="nd-stat-label" style={{ fontWeight: 600, flex: '1 1 auto', minWidth: 0, wordBreak: 'break-word', color: 'var(--nd-text-muted)' }} title={stat.label}>{stat.label}</span>
                <span className="nd-stat-value" style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>{stat.value}</span>
              </div>
              {stat.percent !== undefined && (
                <div className="nd-progress" style={{ height: 4 }}>
                  <div
                    className={`nd-progress-fill ${stat.color?.startsWith('var') ? '' : (stat.color || progressColor(stat.percent))}`}
                    style={{
                      width: `${stat.percent}%`,
                      backgroundColor: stat.color?.startsWith('var') ? stat.color : undefined
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LeftSidebar({ devices, editMode, onAddDevice, onEditDevice, onDeleteDevice, onReorderDevices }: LeftSidebarProps) {
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const [isSticky, setIsSticky] = useState(true);

  useEffect(() => {
    if (!sidebarRef.current) return;
    const checkHeight = () => {
      if (!sidebarRef.current) return;
      // 120px is roughly top offset + bottom gaps
      setIsSticky(sidebarRef.current.scrollHeight + 120 <= window.innerHeight);
    };
    
    checkHeight();
    const observer = new ResizeObserver(() => checkHeight());
    if (sidebarRef.current) observer.observe(sidebarRef.current);
    window.addEventListener('resize', checkHeight);
    
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', checkHeight);
    };
  }, [devices]);

  return (
    <aside 
      ref={sidebarRef} 
      className="nd-sidebar-left"
      style={!isSticky ? { position: 'static', maxHeight: 'none', overflowY: 'visible' } : {}}
    >
      {/* DEVICES - Always visible */}
      <div className="nd-sidebar-card nd-animate-in nd-stagger-1">
        <div className="nd-section-title">
          <HardDrive size={12} style={{ color: 'var(--nd-orange)' }} />
          Appareils
          {editMode && onAddDevice && (
            <button
              className="nd-action-icon"
              onClick={onAddDevice}
              style={{ marginLeft: 'auto', color: 'var(--nd-green)' }}
            >
              <Plus size={13} />
            </button>
          )}
        </div>

        {devices.length === 0 && (
          <p style={{ fontSize: '0.7rem', color: 'var(--nd-text-dimmed)', textAlign: 'center', padding: '12px 8px' }}>
            {editMode
              ? 'Aucun appareil configuré. Cliquez sur le bouton + pour en ajouter un.'
              : 'Aucun appareil configuré. Passez en mode édition pour en ajouter un.'}
          </p>
        )}

        <SortableContext items={devices.map(d => `drag-device-${d.id}`)} strategy={verticalListSortingStrategy}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {devices.map((device) => (
              <SortableDeviceCard
                key={device.id}
                device={device}
                editMode={editMode}
                onEdit={() => onEditDevice?.(device)}
                onDelete={() => setDeviceToDelete(device)}
              />
            ))}
          </div>
        </SortableContext>
      </div>

      {editMode && <ConfirmModal
        isOpen={!!deviceToDelete}
        onClose={() => setDeviceToDelete(null)}
        onConfirm={() => {
          if (deviceToDelete) {
             onDeleteDevice?.(deviceToDelete.id);
             setDeviceToDelete(null);
          }
        }}
        title="Dételer l'appareil ?"
        description={`Êtes-vous sûr de vouloir supprimer "${deviceToDelete?.name}" ? Cette action est définitive.`}
      />}
    </aside>
  );
}
