'use client';

import useSWR from 'swr';
import { HardDrive, Plus, Pencil, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { Device, DeviceStat } from '@/lib/types';

interface LeftSidebarProps {
  devices: Device[];
  editMode: boolean;
  onAddDevice?: () => void;
  onEditDevice?: (device: Device) => void;
  onDeleteDevice?: (id: string) => void;
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

function DeviceMonitorCard({ device, editMode, onEdit, onDelete }: { device: Device; editMode: boolean; onEdit?: () => void; onDelete?: () => void }) {
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
    <div className="nd-sidebar-card" style={{ marginTop: 8, padding: 10, opacity: isOffline ? 0.6 : 1, filter: isOffline ? 'grayscale(0.8)' : 'none', transition: 'all 0.3s' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span>{device.icon}</span>
          {device.name}
          {isLoading && isApiDevice && !stats && <Loader2 size={10} className="nd-spin" style={{ color: 'var(--nd-text-dimmed)' }} />}
          {isOffline && <span title={errorMessage} style={{ display: 'flex' }}><AlertCircle size={10} style={{ color: 'var(--nd-red)' }} /></span>}
        </span>
        {editMode && (
          <div style={{ display: 'flex', gap: 2 }}>
            <button className="nd-edit-btn" onClick={onEdit} style={{ color: 'var(--nd-accent)' }}>
              <Pencil size={11} />
            </button>
            <button className="nd-edit-btn nd-edit-btn-danger" onClick={onDelete} style={{ color: 'var(--nd-red)' }}>
              <Trash2 size={11} />
            </button>
          </div>
        )}
      </div>
      <div style={{ fontSize: '0.62rem', color: 'var(--nd-text-dimmed)', marginBottom: 6 }}>{device.host}</div>

      {isOffline && (
        <div style={{ fontSize: '0.65rem', color: 'var(--nd-red)', marginTop: 4 }}>Hors ligne</div>
      )}

      {!isOffline && displayStats.map((stat, i) => (
        <div key={i} style={{ marginBottom: 4 }}>
          <div className="nd-stat-row" style={{ fontSize: '0.7rem' }}>
            <span className="nd-stat-label">{stat.label}</span>
            <span className="nd-stat-value" style={{ fontSize: '0.7rem' }}>{stat.value}</span>
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
  );
}

export default function LeftSidebar({ devices, editMode, onAddDevice, onEditDevice, onDeleteDevice }: LeftSidebarProps) {
  return (
    <aside className="nd-sidebar-left">



      {/* DEVICES */}
      {(devices.length > 0 || editMode) && (
        <div className="nd-sidebar-card nd-animate-in nd-stagger-1">
          <div className="nd-section-title">
            <HardDrive size={12} style={{ color: 'var(--nd-orange)' }} />
            Appareils
            {editMode && onAddDevice && (
              <button
                className="nd-edit-btn"
                onClick={onAddDevice}
                style={{ marginLeft: 'auto', color: 'var(--nd-green)' }}
              >
                <Plus size={13} />
              </button>
            )}
          </div>

          {devices.length === 0 && editMode && (
            <p style={{ fontSize: '0.7rem', color: 'var(--nd-text-dimmed)', textAlign: 'center', padding: '8px 0' }}>
              Ajouter un appareil
            </p>
          )}

          {devices.map((device) => (
            <DeviceMonitorCard 
              key={device.id} 
              device={device} 
              editMode={editMode} 
              onEdit={() => onEditDevice?.(device)} 
              onDelete={() => onDeleteDevice?.(device.id)} 
            />
          ))}
        </div>
      )}
    </aside>
  );
}
