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
    <div style={{ marginTop: 8, padding: 10, opacity: isOffline ? 0.6 : 1, filter: isOffline ? 'grayscale(0.8)' : 'none', transition: 'all 0.3s', userSelect: editMode ? 'none' : 'auto', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--nd-card-radius)', border: '1px solid var(--nd-card-border)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, flex: 1, minWidth: 0 }}>
          {editMode && (
            <div style={{ cursor: 'grab', display: 'flex', alignItems: 'center', padding: 4, marginRight: -4, flexShrink: 0, marginTop: -2 }}>
              <GripVertical size={12} style={{ color: 'var(--nd-text-dimmed)' }} />
            </div>
          )}
          <span style={{ flexShrink: 0, fontSize: '0.75rem', marginTop: 1 }}>{device.icon}</span>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px 6px', flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 700, fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
              {device.name}
            </span>
            {device.host && (
              <span style={{ fontSize: '0.62rem', color: 'var(--nd-text-dimmed)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                {device.host}
              </span>
            )}
            {isLoading && isApiDevice && !stats && <Loader2 size={10} className="nd-spin" style={{ color: 'var(--nd-text-dimmed)', flexShrink: 0 }} />}
            {isOffline && <span title={errorMessage} style={{ display: 'flex', flexShrink: 0 }}><AlertCircle size={10} style={{ color: 'var(--nd-red)' }} /></span>}
          </div>
        </div>
        {editMode && (
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <button className="nd-action-icon accent" onClick={(e) => { e.stopPropagation(); onEdit?.(); }} title="Modifier l'appareil">
              <Pencil size={13} />
            </button>
            <button className="nd-action-icon danger" onClick={(e) => { e.stopPropagation(); onDelete?.(); }} title="Supprimer l'appareil">
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {isOffline && (
        <div style={{ fontSize: '0.65rem', color: 'var(--nd-red)', marginTop: 4 }}>Hors ligne</div>
      )}

      {!isOffline && (
        <>
          {(!device.statStyle || device.statStyle === 'horizontal') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {displayStats.map((stat, i) => {
                const isDisk = stat.label.toLowerCase().startsWith('disque') || stat.label.toLowerCase().startsWith('disk');
                let shortLabel = stat.label;
                if (isDisk) {
                  const match = shortLabel.match(/\(([^)]+)\)/);
                  if (match) shortLabel = match[1];
                  else shortLabel = shortLabel.replace(/disque|disk/i, '').trim();
                }

                let cleanValue = stat.value.replace(/\d+(?:[.,]\d+)?\s*%/, '').trim();
                cleanValue = cleanValue.replace(/^[-|/]\s*/, '').trim();
                const shouldHideValue = device.hideValues;

                return (
                  <div key={i}>
                    <div className="nd-stat-row" style={{ fontSize: '0.7rem', flexWrap: 'wrap', gap: '2px 8px' }}>
                      <span className="nd-stat-label" style={{ fontWeight: 600, flex: '1 1 auto', minWidth: 0, wordBreak: 'break-word', color: 'var(--nd-text-muted)' }} title={stat.label}>{shortLabel}</span>
                      {!shouldHideValue && (
                        <span className="nd-stat-value" style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>{device.hideValues && isDisk ? cleanValue : stat.value}</span>
                      )}
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
                );
              })}
            </div>
          )}

          {device.statStyle === 'vertical' && (
            <div
              className={`nd-device-stats-grid cols-desktop-${device.colsDesktop || 3} cols-tablet-${device.colsTablet || 3} cols-mobile-${device.colsMobile || 3}`}
              style={{
                width: '100%',
                '--cols-desktop': device.colsDesktop || 3,
                '--cols-tablet': device.colsTablet || 3,
                '--cols-mobile': device.colsMobile || 3,
              } as React.CSSProperties}
            >
              {displayStats.map((stat, i) => {
                const pcolor = stat.color?.startsWith('var') ? stat.color : (stat.color || progressColor(stat.percent || 0));
                const barColor = pcolor.includes('danger') ? 'var(--nd-red)' : pcolor.includes('warn') ? 'var(--nd-orange)' : pcolor.includes('success') ? 'var(--nd-green)' : pcolor || 'var(--nd-accent)';

                const isDisk = stat.label.toLowerCase().startsWith('disque') || stat.label.toLowerCase().startsWith('disk');
                let shortLabel = stat.label;
                if (isDisk) {
                  const match = shortLabel.match(/\(([^)]+)\)/);
                  if (match) shortLabel = match[1];
                  else shortLabel = shortLabel.replace(/disque|disk/i, '').trim();
                }

                let cleanValue = stat.value.replace(/\d+(?:[.,]\d+)?\s*%/, '').trim();
                cleanValue = cleanValue.replace(/^[-|/]\s*/, '').trim();

                const shouldHideInsideText = device.hideValues;
                const shouldHideBottomText = device.hideValues;

                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%', maxWidth: '100%', minWidth: 0 }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--nd-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }} title={stat.label}>{shortLabel}</span>
                    <div style={{ position: 'relative', width: 'var(--bar-width, 34px)', height: 'var(--bar-height, 70px)', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, display: 'flex', alignItems: 'flex-end', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)' }}>
                      {stat.percent !== undefined && (
                        <div style={{ width: '100%', height: `${stat.percent}%`, backgroundColor: barColor, borderRadius: 8, transition: 'height 0.5s ease-in-out' }} />
                      )}
                      {!shouldHideInsideText && (
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'calc(var(--bar-width, 34px) * 0.16 + 1px)', fontWeight: 700, pointerEvents: 'none', color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.6)' }}>
                          {stat.percent !== undefined ? `${Math.round(stat.percent)}%` : '-'}
                        </div>
                      )}
                    </div>
                    {cleanValue && !shouldHideBottomText && (
                      <span style={{ fontSize: '0.6rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }} title={cleanValue}>{cleanValue}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {device.statStyle === 'circle' && (
            <div
              className={`nd-device-stats-grid cols-desktop-${device.colsDesktop || 3} cols-tablet-${device.colsTablet || 3} cols-mobile-${device.colsMobile || 3}`}
              style={{
                width: '100%',
                '--cols-desktop': device.colsDesktop || 3,
                '--cols-tablet': device.colsTablet || 3,
                '--cols-mobile': device.colsMobile || 3,
              } as React.CSSProperties}
            >
              {displayStats.map((stat, i) => {
                const pcolor = stat.color?.startsWith('var') ? stat.color : (stat.color || progressColor(stat.percent || 0));
                const strokeColor = pcolor.includes('danger') ? 'var(--nd-red)' : pcolor.includes('warn') ? 'var(--nd-orange)' : pcolor.includes('success') ? 'var(--nd-green)' : pcolor || 'var(--nd-accent)';

                const isDisk = stat.label.toLowerCase().startsWith('disque') || stat.label.toLowerCase().startsWith('disk');
                let shortLabel = stat.label;
                if (isDisk) {
                  const match = shortLabel.match(/\(([^)]+)\)/);
                  if (match) shortLabel = match[1];
                  else shortLabel = shortLabel.replace(/disque|disk/i, '').trim();
                }

                let cleanValue = stat.value.replace(/\d+(?:[.,]\d+)?\s*%/, '').trim();
                cleanValue = cleanValue.replace(/^[-|/]\s*/, '').trim();

                const shouldHideInsideText = device.hideValues;
                const shouldHideBottomText = device.hideValues;

                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%', maxWidth: '100%', minWidth: 0 }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--nd-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }} title={stat.label}>{shortLabel}</span>
                    <div style={{ position: 'relative', width: 'var(--circle-size, 44px)', height: 'var(--circle-size, 44px)' }}>
                      <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="rgba(255,255,255,0.05)"
                          strokeWidth="3"
                        />
                        {stat.percent !== undefined && (
                          <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke={strokeColor}
                            strokeWidth="3.5"
                            strokeDasharray={`${stat.percent}, 100`}
                            strokeLinecap="round"
                            style={{ transition: 'stroke-dasharray 0.5s ease-in-out' }}
                          />
                        )}
                      </svg>
                      {!shouldHideInsideText && (
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'calc(var(--circle-size, 44px) * 0.16 + 1px)', fontWeight: 700, pointerEvents: 'none' }}>
                          {stat.percent !== undefined ? `${Math.round(stat.percent)}%` : '-'}
                        </div>
                      )}
                    </div>
                    {cleanValue && !shouldHideBottomText && (
                      <span style={{ fontSize: '0.6rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }} title={cleanValue}>{cleanValue}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function LeftSidebar({ devices, editMode, onAddDevice, onEditDevice, onDeleteDevice, onReorderDevices }: LeftSidebarProps) {
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null);

  return (
    <div className="nd-sidebar-card nd-animate-in nd-stagger-1">
      <style dangerouslySetInnerHTML={{
        __html: `
        .nd-device-stats-grid {
          display: grid !important;
          width: 100% !important;
          gap: 12px 8px !important;
          margin-top: 10px !important;
          justify-items: center !important;
          align-items: start !important;
          
          /* Defaults */
          --circle-size: 44px !important;
          --bar-width: 34px !important;
          --bar-height: 70px !important;
        }

        /* Mobile columns and sizes */
        .nd-device-stats-grid.cols-mobile-1 { grid-template-columns: repeat(1, minmax(0, 1fr)) !important; --circle-size: 64px !important; --bar-width: 44px !important; --bar-height: 84px !important; }
        .nd-device-stats-grid.cols-mobile-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; --circle-size: 52px !important; --bar-width: 38px !important; --bar-height: 76px !important; }
        .nd-device-stats-grid.cols-mobile-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; --circle-size: 44px !important; --bar-width: 34px !important; --bar-height: 70px !important; }
        .nd-device-stats-grid.cols-mobile-4 { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; --circle-size: 38px !important; --bar-width: 30px !important; --bar-height: 64px !important; }
        .nd-device-stats-grid.cols-mobile-5 { grid-template-columns: repeat(5, minmax(0, 1fr)) !important; --circle-size: 34px !important; --bar-width: 26px !important; --bar-height: 58px !important; }
        .nd-device-stats-grid.cols-mobile-6 { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; --circle-size: 30px !important; --bar-width: 22px !important; --bar-height: 52px !important; }

        /* Tablet columns and sizes (from 768px to 1023px) */
        @media (min-width: 768px) {
          .nd-device-stats-grid.cols-tablet-1 { grid-template-columns: repeat(1, minmax(0, 1fr)) !important; --circle-size: 64px !important; --bar-width: 44px !important; --bar-height: 84px !important; }
          .nd-device-stats-grid.cols-tablet-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; --circle-size: 52px !important; --bar-width: 38px !important; --bar-height: 76px !important; }
          .nd-device-stats-grid.cols-tablet-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; --circle-size: 44px !important; --bar-width: 34px !important; --bar-height: 70px !important; }
          .nd-device-stats-grid.cols-tablet-4 { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; --circle-size: 38px !important; --bar-width: 30px !important; --bar-height: 64px !important; }
          .nd-device-stats-grid.cols-tablet-5 { grid-template-columns: repeat(5, minmax(0, 1fr)) !important; --circle-size: 34px !important; --bar-width: 26px !important; --bar-height: 58px !important; }
          .nd-device-stats-grid.cols-tablet-6 { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; --circle-size: 30px !important; --bar-width: 22px !important; --bar-height: 52px !important; }
        }

        /* Desktop columns and sizes (from 1024px) */
        @media (min-width: 1024px) {
          .nd-device-stats-grid.cols-desktop-1 { grid-template-columns: repeat(1, minmax(0, 1fr)) !important; --circle-size: 64px !important; --bar-width: 46px !important; --bar-height: 86px !important; }
          .nd-device-stats-grid.cols-desktop-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; --circle-size: 52px !important; --bar-width: 38px !important; --bar-height: 76px !important; }
          .nd-device-stats-grid.cols-desktop-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; --circle-size: 44px !important; --bar-width: 34px !important; --bar-height: 70px !important; }
          .nd-device-stats-grid.cols-desktop-4 { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; --circle-size: 38px !important; --bar-width: 30px !important; --bar-height: 64px !important; }
          .nd-device-stats-grid.cols-desktop-5 { grid-template-columns: repeat(5, minmax(0, 1fr)) !important; --circle-size: 34px !important; --bar-width: 26px !important; --bar-height: 58px !important; }
          .nd-device-stats-grid.cols-desktop-6 { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; --circle-size: 30px !important; --bar-width: 22px !important; --bar-height: 52px !important; }
        }
      `}} />
      <div className="nd-section-title">
        <HardDrive size={12} style={{ color: 'var(--nd-orange)' }} />
        Appareils
        {editMode && onAddDevice && (
          <button
            className="nd-action-icon success"
            onClick={onAddDevice}
            style={{ marginLeft: 'auto' }}
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
    </div>
  );
}
