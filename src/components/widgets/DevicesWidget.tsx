'use client';

import useSWR from 'swr';
import { HardDrive, Plus, Pencil, Trash2, Loader2, AlertCircle, GripVertical, Settings, X } from 'lucide-react';
import { Device, DeviceStat } from '@/lib/types';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, useRef, useEffect, useId } from 'react';
import ConfirmModal from '../modals/ConfirmModal';
import { useConfig } from '@/hooks/useConfig';
import CustomSelect from '@/components/shared/CustomSelect';
import { createPortal } from 'react-dom';
import { useWidgetSize } from './WidgetContainer';
import { Emoji } from '../shared/Emoji';

interface DevicesWidgetProps {
  devices: Device[];
  editMode: boolean;
  widgetInstanceId?: string;
  widgetProps?: any;
  onUpdateProps?: (newProps: any) => void;
  onAddDevice?: () => void;
  onEditDevice?: (device: Device) => void;
  onDeleteDevice?: (id: string) => void;
  onReorderDevices?: (devices: Device[]) => void;
}

// Composant pour chaque carte d'appareil avec drag & drop
function SortableDeviceCard({
  device,
  editMode,
  widgetInstanceId,
  widgetProps,
  onEdit,
  onDelete,
  isFirst,
  isLast,
}: {
  device: Device;
  editMode: boolean;
  widgetInstanceId?: string;
  widgetProps?: any;
  onEdit?: () => void;
  onDelete?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
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
        widgetInstanceId={widgetInstanceId}
        widgetProps={widgetProps}
        onEdit={onEdit}
        onDelete={onDelete}
        isFirst={isFirst}
        isLast={isLast}
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

function getTemperatureColor(tempStr: string, enableAlerts?: boolean): string {
  if (!tempStr) return 'var(--nd-text-muted)';
  if (!enableAlerts) return 'var(--nd-text-muted)';
  const num = parseInt(tempStr.replace(/[^0-9]/g, ''), 10);
  if (isNaN(num)) return 'var(--nd-text-muted)';
  if (num >= 70) return 'var(--nd-red)';
  if (num >= 50) return 'var(--nd-orange)';
  return 'var(--nd-green)';
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

function parseTelemetry(value: string, percent?: number) {
  if (!value) {
    return {
      percentStr: percent !== undefined ? `${Math.round(percent)}%` : '',
      tempStr: '',
      capacityStr: ''
    };
  }

  // Extract percentage (e.g. 12.4% or 70.1%)
  const pctMatch = value.match(/(\d+(?:[.,]\d+)?\s*%)/);
  let percentStr = pctMatch ? pctMatch[1].trim() : (percent !== undefined ? `${Math.round(percent)}%` : '');
  percentStr = percentStr.replace(/[.,]\d+/, '');

  // Extract temperature (e.g. 34°C)
  const tempMatch = value.match(/(\d+\s*°[Cc])/);
  const tempStr = tempMatch ? tempMatch[1].trim() : '';

  // Extract capacity/space in parentheses
  const parenMatch = value.match(/\(([^)]+)\)/);
  let capacityStr = parenMatch ? `(${parenMatch[1].trim()})` : '';

  if (!capacityStr) {
    // Check if there is capacity outside parentheses
    const sizeMatch = value.match(/(\d+(?:[.,]\d+)?\s*(?:Go|To|GB|TB|Mo|MB|octets|Bytes))/i);
    if (sizeMatch) {
      capacityStr = `(${sizeMatch[1].trim()})`;
    }
  }

  return {
    percentStr,
    tempStr,
    capacityStr
  };
}

// Hardcoded distinct colors for each metric type.
// We do NOT use CSS variables here because in some themes
// (e.g. orange/amber themes) --nd-accent and --nd-orange
// resolve to the same color, making CPU and Temp identical.
// The originalColor from the backend is used as a category hint
// when the label doesn't match known patterns.
function getMetricDistinctColor(label: string, originalColor?: string): string {
  const l = label.toLowerCase();
  // 1. Try label matching first (most reliable) using CSS variables with fallback colors
  if (l.includes('cpu') || l.includes('processeur') || l.includes('processor')) return 'var(--nd-blue, #38bdf8)'; // CPU → Blue
  if (l.includes('ram') || l.includes('mem') || l.includes('mémoire') || l.includes('memory')) return 'var(--nd-green, #4ade80)'; // RAM → Green
  if (l.includes('disque') || l.includes('disk') || l.includes('storage') || l.includes('ceph') || l.includes('root') || l.includes('(/)') || l.includes('stockage') || l.includes('swap') || l.includes('ssd') || l.includes('hdd') || l.includes('nvme') || l.includes('/dev/') || l.includes('zfs') || l.includes('volume') || l.includes('partition') || l.includes('montage') || l.includes('nas')) return 'var(--nd-orange, #fb923c)'; // Disk → Orange
  if (l.includes('gpu') || l.includes('carte graphique') || l.includes('vram') || l.includes('nvidia') || l.includes('geforce') || l.includes('rtx') || l.includes('gtx') || l.includes('radeon') || l.includes('intel gpu') || l.includes('graphics')) return 'var(--nd-purple, #c084fc)'; // GPU → Purple
  if (l.includes('temp') || l.includes('°c') || l.includes('température') || l.includes('chaleur') || l.includes('temperature')) return 'var(--nd-red, #f87171)'; // Temp → Red
  if (l.includes('réseau') || l.includes('network') || l.includes('rx') || l.includes('tx') || l.includes('upload') || l.includes('download') || l.includes('ping') || l.includes('lan') || l.includes('wan')) return 'var(--nd-accent, #22d3ee)'; // Accent

  // 2. Fallback: use the backend-assigned CSS variable as a category hint
  if (originalColor) {
    if (originalColor.includes('accent') || originalColor.includes('blue')) return 'var(--nd-blue, #38bdf8)';   // CPU → Blue
    if (originalColor.includes('purple') || originalColor.includes('violet')) return 'var(--nd-purple, #c084fc)';  // GPU → Purple
    if (originalColor.includes('green') || originalColor.includes('emerald')) return 'var(--nd-green, #4ade80)';   // RAM → Green
    if (originalColor.includes('orange') || originalColor.includes('amber')) return 'var(--nd-orange, #fb923c)';   // Disk → Orange
    if (originalColor.includes('red') || originalColor.includes('danger')) return 'var(--nd-red, #f87171)';        // Temp → Red
  }
  
  return 'var(--nd-yellow, #fbbf24)'; // Yellow fallback
}

// Sparkline component with local history
function DeviceStatGraph({
  label,
  value,
  percent,
  color,
  hideValues,
  enableAlerts,
  colored,
}: {
  label: string;
  value: string;
  percent?: number;
  color?: string;
  hideValues?: boolean;
  enableAlerts?: boolean;
  colored?: boolean;
}) {
  const componentId = useId().replace(/:/g, '');
  const [history, setHistory] = useState<number[]>(() => {
    return percent !== undefined ? Array(15).fill(percent) : [];
  });

  useEffect(() => {
    if (percent !== undefined) {
      setHistory(prev => {
        const next = [...prev, percent];
        if (next.length > 15) next.shift();
        return next;
      });
    }
  }, [percent]);

  let strokeColor = colored ? getMetricDistinctColor(label, color) : 'var(--nd-accent, #00e5ff)';

  const { size: widgetSize } = useWidgetSize();
  let height = 36;
  if (widgetSize === 'medium') {
    height = 46;
  } else if (widgetSize === 'wide') {
    height = 56;
  }
  const width = 100;
  const paddingY = 4;

  const maxVal = history.length > 0 ? Math.max(...history) : 0;
  const minVal = history.length > 0 ? Math.min(...history) : 0;
  const isFlat = history.length === 0 || (maxVal - minVal) < 2.0;

  const points = history.map((val, index) => {
    const x = (index / Math.max(1, history.length - 1)) * width;
    const numVal = typeof val === 'number' ? val : parseFloat(val as any);
    if (isNaN(numVal)) {
      return { x, y: height / 2 };
    }
    let adjustedVal = numVal;
    if (isFlat) {
      // Add a clearly visible breathing wave fluctuation (sine wave) when there is no significant change
      adjustedVal = Math.max(2, Math.min(98, numVal + Math.sin(index * 0.6) * 5.0));
    }
    const y = paddingY + (height - 2 * paddingY) * (1 - adjustedVal / 100);
    return { x, y };
  });

  let linePath = '';
  let areaPath = '';
  if (points.length > 0) {
    // Build a smooth cubic Bezier curve path
    linePath = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX = p0.x + (p1.x - p0.x) / 2;
      linePath += ` C ${cpX.toFixed(1)} ${p0.y.toFixed(1)}, ${cpX.toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }
    areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${height} L ${points[0].x.toFixed(1)} ${height} Z`;
  }

  const gridLines = [];
  const gridLineCount = 3;
  for (let i = 1; i <= gridLineCount; i++) {
    const y = (i / (gridLineCount + 1)) * height;
    gridLines.push(
      <line
        key={i}
        x1="0"
        y1={y}
        x2={width}
        y2={y}
        stroke="var(--nd-card-border)"
        strokeWidth="0.8"
        strokeDasharray="2 2"
        opacity="0.3"
      />
    );
  }

  const { percentStr, tempStr, capacityStr } = parseTelemetry(value, percent);

  const gradId = `gradient-${componentId}`;
  const glowId = `glow-${componentId}`;

  return (
    <div
      className="nd-stat-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '4px 0',
        position: 'relative',
        overflow: 'hidden',
        minWidth: 0,
        width: '100%'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, zIndex: 1, minWidth: 0, gap: 4 }}>
        <span
          style={{
            fontSize: 'var(--stat-label-size, 0.64rem)',
            fontWeight: 700,
            color: 'var(--nd-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            borderBottom: 'none',
            paddingBottom: '2px',
            transition: 'border-color 0.3s ease'
          }}
          title={label}
        >
          {label}
        </span>
        {!hideValues && (
          <span style={{ fontSize: 'var(--stat-value-size, 0.74rem)', fontWeight: 800, color: strokeColor, whiteSpace: 'nowrap' }}>
            {percentStr || '-'}
          </span>
        )}
      </div>

      {percent !== undefined ? (
        <div style={{ width: '100%', height: `${height}px`, position: 'relative', marginTop: 2, overflow: 'hidden', borderRadius: '4px' }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity="0.35" />
                <stop offset="100%" stopColor={strokeColor} stopOpacity="0.01" />
              </linearGradient>
            </defs>
            {gridLines}
            <path d={areaPath} fill={`url(#${gradId})`} />
            <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="2.2" strokeLinecap="butt" strokeLinejoin="round" />
          </svg>
        </div>
      ) : (
        <div style={{ fontSize: '0.6rem', color: 'var(--nd-text-dimmed)', textAlign: 'center', height: `${height}px`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Graphique indisponible
        </div>
      )}

      {!hideValues && (tempStr || capacityStr) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 4, zIndex: 1, width: '100%' }}>
          {tempStr && (
            <span style={{ fontSize: 'var(--stat-detail-size, 0.58rem)', fontWeight: 600, color: getTemperatureColor(tempStr, enableAlerts), whiteSpace: 'nowrap' }}>
              {tempStr}
            </span>
          )}
          {capacityStr && (
            <span style={{ fontSize: 'var(--stat-detail-size, 0.56rem)', color: 'var(--nd-text-dimmed)', whiteSpace: 'nowrap' }}>
              {capacityStr}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Vertical historical bar-graph component (equalizer style)
function DeviceStatVerticalBars({
  label,
  value,
  percent,
  color,
  hideValues,
  enableAlerts,
  colored,
}: {
  label: string;
  value: string;
  percent?: number;
  color?: string;
  hideValues?: boolean;
  enableAlerts?: boolean;
  colored?: boolean;
}) {
  const { size: widgetSize } = useWidgetSize();
  let barCount = 15;
  if (widgetSize === 'medium') {
    barCount = 35;
  } else if (widgetSize === 'wide') {
    barCount = 60;
  }
  const gap = barCount > 30 ? '1px' : '2px';

  const [history, setHistory] = useState<number[]>([]);

  useEffect(() => {
    if (percent !== undefined) {
      setHistory(prev => {
        let next = [...prev];
        if (next.length === 0) {
          next = Array(barCount).fill(percent);
        }
        next.push(percent);
        while (next.length > barCount) {
          next.shift();
        }
        if (next.length > barCount) {
          next = next.slice(next.length - barCount);
        } else if (next.length < barCount) {
          const padding = Array(barCount - next.length).fill(percent);
          next = [...padding, ...next];
        }
        return next;
      });
    }
  }, [percent, barCount]);

  let strokeColor = getMetricDistinctColor(label, color);
  if (!colored) strokeColor = 'var(--nd-accent)';

  const { percentStr, tempStr, capacityStr } = parseTelemetry(value, percent);

  return (
    <div
      className="nd-stat-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '4px 0',
        position: 'relative',
        overflow: 'hidden',
        minWidth: 0,
        width: '100%'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, zIndex: 1, minWidth: 0, gap: 4 }}>
        <span
          style={{
            fontSize: 'var(--stat-label-size, 0.64rem)',
            fontWeight: 700,
            color: 'var(--nd-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            borderBottom: 'none',
            paddingBottom: '2px',
            transition: 'border-color 0.3s ease',
            display: 'inline-block'
          }}
          title={label}
        >
          {label}
        </span>
        {!hideValues && (
          <span style={{ fontSize: 'var(--stat-value-size, 0.74rem)', fontWeight: 800, color: strokeColor, whiteSpace: 'nowrap' }}>
            {percentStr || '-'}
          </span>
        )}
      </div>

      {percent !== undefined ? (
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: gap,
          height: 'var(--bar-height, 36px)',
          width: '100%',
          backgroundColor: 'rgba(255, 255, 255, 0.01)',
          borderRadius: '4px',
          padding: '2px',
          border: '1px solid rgba(255, 255, 255, 0.02)',
          marginTop: 2,
          boxSizing: 'border-box'
        }}>
          {history.map((val, idx) => {
            const isLatest = idx === history.length - 1;
            let segmentColor = strokeColor;
            // Non-linear scale to expand lower range (5% vs 10%) so fluctuations are highly visible
            const barHeight = val === 0 ? '3px' : `calc(${Math.round(Math.pow(val / 100, 0.65) * 100)}% + 2px)`;
            return (
              <div
                key={idx}
                style={{
                  height: barHeight,
                  flex: 1,
                  borderRadius: '1px',
                  backgroundColor: segmentColor,
                  opacity: isLatest ? 1 : 0.35,
                  boxShadow: isLatest ? `0 0 6px ${segmentColor}` : 'none',
                  transition: 'all 0.3s ease',
                }}
              />
            );
          })}
        </div>
      ) : (
        <div style={{ fontSize: 'var(--stat-detail-size, 0.6rem)', color: 'var(--nd-text-dimmed)', textAlign: 'center', height: 'var(--bar-height, 36px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Données indisponibles
        </div>
      )}

      {!hideValues && (tempStr || capacityStr) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 4, zIndex: 1, width: '100%' }}>
          {tempStr && (
            <span style={{ fontSize: 'var(--stat-detail-size, 0.58rem)', fontWeight: 600, color: getTemperatureColor(tempStr, enableAlerts), whiteSpace: 'nowrap' }}>
              {tempStr}
            </span>
          )}
          {capacityStr && (
            <span style={{ fontSize: 'var(--stat-detail-size, 0.56rem)', color: 'var(--nd-text-dimmed)', whiteSpace: 'nowrap' }}>
              {capacityStr}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function DeviceMonitorCardContent({
  device,
  editMode,
  widgetInstanceId,
  widgetProps,
  onEdit,
  onDelete,
  isFirst,
  isLast,
}: {
  device: Device;
  editMode: boolean;
  widgetInstanceId?: string;
  widgetProps?: any;
  onEdit?: () => void;
  onDelete?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const { config } = useConfig();
  const { size: widgetSize, width: containerWidth } = useWidgetSize();
  const hideTitles = (config?.settings?.hideWidgetTitles ?? false) && !editMode;
  const isApiDevice = !!device.api;
  const { data: stats, error, isLoading } = useSWR<DeviceStat[] | { error: string, isOffline?: boolean }>(
    isApiDevice ? `/api/devices/${device.id}` : null,
    fetcher,
    { refreshInterval: 5000 } // Poll every 5s
  );

  const displayStats = isApiDevice ? (Array.isArray(stats) ? stats : device.stats || []) : (device.stats || []);
  const isOffline = error || (stats && 'error' in stats && stats.isOffline);
  const errorMessage = stats && 'error' in stats ? stats.error : 'Impossible de joindre l\'appareil';

  // Read instance-specific configurations if available
  const devConfig = widgetProps?.deviceConfigs?.[device.id] || {};
  let currentStyle = devConfig.statStyle || device.statStyle || 'horizontal';
  if (currentStyle === 'circle') {
    currentStyle = 'horizontal';
  }
  // Determine style-based defaults depending on widget container width
  let defaultCols = 3;
  if (containerWidth < 340) {
    defaultCols = currentStyle === 'horizontal' ? 1 : 2;
  } else if (containerWidth < 680) {
    defaultCols = 2;
  }

  const currentColsDesktop = devConfig.colsDesktop !== undefined
    ? devConfig.colsDesktop
    : (device.colsDesktop !== undefined && device.colsDesktop !== 3 ? device.colsDesktop : defaultCols);

  const currentColsMobile = devConfig.colsMobile !== undefined
    ? devConfig.colsMobile
    : (device.colsMobile !== undefined && device.colsMobile !== 3 ? device.colsMobile : defaultCols);
  const currentHideValues = devConfig.hideValues !== undefined ? devConfig.hideValues : (device.hideValues || false);
  const currentVisibleStats = devConfig.visibleStats;
  const currentEnableAlerts = devConfig.enableAlerts !== undefined ? devConfig.enableAlerts : (device.enableAlerts !== undefined ? device.enableAlerts : false);
  const currentColoredGraphs = devConfig.coloredGraphs !== undefined ? devConfig.coloredGraphs : true;

  // Filter stats based on visible selection if configured
  const filteredStats = displayStats.filter(stat => {
    if (!currentVisibleStats || currentVisibleStats.length === 0) return true;
    return currentVisibleStats.includes(stat.label);
  });

  // Clamping grid cols to prevent empty holes and adjust layout based on container width
  let actualColsDesktop = Math.min(currentColsDesktop, filteredStats.length || 1);
  let actualColsMobile = Math.min(currentColsMobile, filteredStats.length || 1);

  let maxCols = 6;
  if (containerWidth < 340) {
    maxCols = 3;
  } else if (containerWidth < 680) {
    maxCols = 4;
  }

  actualColsDesktop = Math.min(actualColsDesktop, maxCols);
  // On mobile (narrow screen), clamp to maximum 3 columns
  actualColsMobile = Math.min(actualColsMobile, 3);

  // Border bottom separator for clean full-width look between devices
  const borderBottomStyle = isLast ? 'none' : '1px solid var(--nd-card-border)';

  return (
    <div
      style={{
        marginTop: (hideTitles && !editMode) ? 0 : 4,
        paddingTop: isFirst ? 6 : 12,
        paddingBottom: isLast ? 2 : 12,
        borderBottom: borderBottomStyle,
        opacity: isOffline ? 0.6 : 1,
        filter: isOffline ? 'grayscale(0.8)' : 'none',
        transition: 'all 0.3s',
        userSelect: editMode ? 'none' : 'auto'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, flex: 1, minWidth: 0 }}>
          {editMode && (
            <div style={{ cursor: 'grab', display: 'flex', alignItems: 'center', padding: 4, marginRight: -4, flexShrink: 0, marginTop: -2 }}>
              <GripVertical size={12} style={{ color: 'var(--nd-text-dimmed)' }} />
            </div>
          )}
          <span style={{ flexShrink: 0, fontSize: '0.75rem', marginTop: 1, display: 'flex', alignItems: 'center' }}><Emoji emoji={device.icon} /></span>
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
            <button className="nd-action-icon accent" onClick={(e) => { e.stopPropagation(); onEdit?.(); }} title="Configurer l'affichage">
              <Pencil size={13} />
            </button>
            <button className="nd-action-icon danger" onClick={(e) => { e.stopPropagation(); onDelete?.(); }} title={widgetInstanceId ? "Retirer du widget" : "Supprimer"}>
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
          {currentStyle === 'horizontal' && (
            <div
              className={actualColsDesktop > 1 ? `nd-device-stats-grid horizontal cols-desktop-${actualColsDesktop} cols-mobile-${actualColsMobile}` : ''}
              style={actualColsDesktop > 1 ? {
                display: 'grid',
                width: '100%',
                gap: '16px 24px',
                marginTop: 10,
                justifyItems: 'stretch',
                '--cols-desktop': actualColsDesktop,
                '--cols-mobile': actualColsMobile,
              } as React.CSSProperties : {
                display: 'flex',
                flexDirection: 'column',
                gap: 16
              }}
            >
              {filteredStats.map((stat, i) => {
                const isDisk = stat.label.toLowerCase().startsWith('disque') || stat.label.toLowerCase().startsWith('disk');
                let shortLabel = stat.label;
                if (isDisk) {
                  const match = shortLabel.match(/\(([^)]+)\)/);
                  if (match) shortLabel = match[1];
                  else shortLabel = shortLabel.replace(/disque|disk/i, '').trim();
                }

                const barColor = currentColoredGraphs ? getMetricDistinctColor(stat.label, stat.color) : 'var(--nd-accent)';
                // Derive glow using color-mix dynamically
                const glowColor = `color-mix(in srgb, ${barColor} 15%, transparent)`;

                const { percentStr, tempStr, capacityStr } = parseTelemetry(stat.value, stat.percent);

                return (
                  <div key={i} className="nd-stat-card" style={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
                    <div className="nd-stat-row" style={{ fontSize: 'var(--stat-label-size, 0.68rem)', flexWrap: 'wrap', gap: '2px 8px', marginBottom: 2, alignItems: 'baseline' }}>
                      <span
                        className="nd-stat-label"
                        style={{
                          fontWeight: 600,
                          flex: '0 1 auto',
                          minWidth: 0,
                          wordBreak: 'break-word',
                          color: 'var(--nd-text-muted)',
                          borderBottom: 'none',
                          paddingBottom: '1px',
                          transition: 'border-color 0.3s ease',
                          display: 'inline-block'
                        }}
                        title={stat.label}
                      >
                        {shortLabel}
                      </span>
                      {!currentHideValues && (
                        <div style={{ marginLeft: 'auto', flexShrink: 0, whiteSpace: 'nowrap' }}>
                          {capacityStr && (
                            <span style={{ fontSize: 'var(--stat-detail-size, 0.62rem)', color: 'var(--nd-text-dimmed)', marginRight: 6 }}>
                              {capacityStr.replace(/[()]/g, '')}
                            </span>
                          )}
                          {tempStr && (
                            <span style={{ fontSize: 'var(--stat-detail-size, 0.62rem)', fontWeight: 600, color: getTemperatureColor(tempStr, currentEnableAlerts), marginRight: 6 }}>
                              {tempStr}
                            </span>
                          )}
                          <span className="nd-stat-value" style={{ fontSize: 'var(--stat-value-size, 0.7rem)', fontWeight: 700, color: barColor }}>
                            {percentStr}
                          </span>
                        </div>
                      )}
                    </div>
                    {stat.percent !== undefined && (
                      <div className="nd-progress" style={{ height: 'var(--progress-bar-height, 5px)', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--nd-card-border)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div
                          className="nd-progress-fill"
                          style={{
                            width: `${stat.percent}%`,
                            backgroundColor: barColor,
                            boxShadow: `0 0 4px ${glowColor}`,
                            borderRadius: '3px',
                            height: '100%',
                            transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {currentStyle === 'vertical' && (
            <div
              className={`nd-device-stats-grid cols-desktop-${actualColsDesktop} cols-mobile-${actualColsMobile}`}
              style={{
                width: '100%',
                '--cols-desktop': actualColsDesktop,
                '--cols-mobile': actualColsMobile,
              } as React.CSSProperties}
            >
              {filteredStats.map((stat, i) => {
                const isDisk = stat.label.toLowerCase().startsWith('disque') || stat.label.toLowerCase().startsWith('disk');
                const shortLabel = isDisk
                  ? (stat.label.match(/\(([^)]+)\)/)?.[1] || stat.label.replace(/disque|disk/i, '').trim())
                  : stat.label;

                return (
                  <DeviceStatVerticalBars
                    key={i}
                    label={shortLabel}
                    value={stat.value}
                    percent={stat.percent}
                    color={stat.color}
                    hideValues={currentHideValues}
                    enableAlerts={currentEnableAlerts}
                    colored={currentColoredGraphs}
                  />
                );
              })}
            </div>
          )}



          {currentStyle === 'graph' && (
            <div
              className={`nd-device-stats-grid cols-desktop-${actualColsDesktop} cols-mobile-${actualColsMobile}`}
              style={{
                width: '100%',
                '--cols-desktop': actualColsDesktop,
                '--cols-mobile': actualColsMobile,
              } as React.CSSProperties}
            >
              {filteredStats.map((stat, i) => {
                const isDisk = stat.label.toLowerCase().startsWith('disque') || stat.label.toLowerCase().startsWith('disk');
                const shortLabel = isDisk
                  ? (stat.label.match(/\(([^)]+)\)/)?.[1] || stat.label.replace(/disque|disk/i, '').trim())
                  : stat.label;

                return (
                  <DeviceStatGraph
                    key={i}
                    label={shortLabel}
                    value={stat.value}
                    percent={stat.percent}
                    color={stat.color}
                    hideValues={currentHideValues}
                    enableAlerts={currentEnableAlerts}
                    colored={currentColoredGraphs}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function DevicesWidget({
  devices,
  editMode,
  widgetInstanceId,
  widgetProps,
  onUpdateProps,
  onAddDevice,
  onEditDevice,
  onDeleteDevice,
  onReorderDevices,
}: DevicesWidgetProps) {
  const { config, setDeviceModal, updateConfig } = useConfig();
  const { size: widgetSize, width: containerWidth } = useWidgetSize();
  const hideTitles = (config?.settings?.hideWidgetTitles ?? false) && !editMode;
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null);

  // Client-side mount flag for React Portals
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Widget instance config state (modal)
  const [isWidgetConfigOpen, setIsWidgetConfigOpen] = useState(false);

  // Local device configuration states
  const [configuringDevice, setConfiguringDevice] = useState<Device | null>(null);
  const [localStyle, setLocalStyle] = useState<'horizontal' | 'vertical' | 'graph'>('horizontal');
  const [localColsDesktop, setLocalColsDesktop] = useState(3);
  const [localColsMobile, setLocalColsMobile] = useState(3);
  const [localHideValues, setLocalHideValues] = useState(false);
  const [localVisibleStats, setLocalVisibleStats] = useState<string[]>([]);
  const [localEnableAlerts, setLocalEnableAlerts] = useState(true);
  const [localColoredGraphs, setLocalColoredGraphs] = useState(false);

  // Fetch metrics list for the configuring device
  const { data: configStats } = useSWR(
    configuringDevice ? `/api/devices/${configuringDevice.id}` : null,
    fetcher
  );

  const availableStats = Array.isArray(configStats)
    ? configStats.map(s => s.label)
    : (configuringDevice?.stats || []).map(s => s.label);

  useEffect(() => {
    if (configuringDevice) {
      const devConfig = widgetProps?.deviceConfigs?.[configuringDevice.id] || {};
      const style = devConfig.statStyle || configuringDevice.statStyle || 'horizontal';
      const resolvedStyle = style === 'circle' ? 'horizontal' : style;
      setLocalStyle(resolvedStyle);
      
      let defaultCols = 3;
      if (containerWidth < 340) {
        defaultCols = resolvedStyle === 'horizontal' ? 1 : 2;
      } else if (containerWidth < 680) {
        defaultCols = 2;
      }

      setLocalColsDesktop(devConfig.colsDesktop !== undefined
        ? devConfig.colsDesktop
        : (configuringDevice.colsDesktop !== undefined && configuringDevice.colsDesktop !== 3 ? configuringDevice.colsDesktop : defaultCols));
      
      setLocalColsMobile(devConfig.colsMobile !== undefined
        ? devConfig.colsMobile
        : (configuringDevice.colsMobile !== undefined && configuringDevice.colsMobile !== 3 ? configuringDevice.colsMobile : defaultCols));

      setLocalHideValues(devConfig.hideValues !== undefined ? devConfig.hideValues : (configuringDevice.hideValues || false));
      setLocalVisibleStats(devConfig.visibleStats || []);
      setLocalEnableAlerts(devConfig.enableAlerts !== undefined ? devConfig.enableAlerts : (configuringDevice.enableAlerts !== undefined ? configuringDevice.enableAlerts : false));
      setLocalColoredGraphs(devConfig.coloredGraphs !== undefined ? devConfig.coloredGraphs : true);
    }
  }, [configuringDevice, widgetProps, containerWidth]);

  const handleAdd = onAddDevice || (() => setDeviceModal({ open: true }));
  const handleDelete = onDeleteDevice || ((id: string) => updateConfig({ devices: devices.filter(d => d.id !== id) }));

  const selectedIds = widgetProps?.selectedDeviceIds;
  let filteredDevices = devices;

  // Filter and sort by index in selectedDeviceIds
  if (Array.isArray(selectedIds)) {
    filteredDevices = devices
      .filter(d => selectedIds.includes(d.id))
      .sort((a, b) => selectedIds.indexOf(a.id) - selectedIds.indexOf(b.id));
  }

  const handleToggleDeviceSelection = (deviceId: string) => {
    const currentIds = selectedIds || devices.map(d => d.id);
    let newIds;
    if (currentIds.includes(deviceId)) {
      newIds = currentIds.filter((id: string) => id !== deviceId);
    } else {
      newIds = [...currentIds, deviceId];
    }
    onUpdateProps && onUpdateProps({ selectedDeviceIds: newIds });
  };

  const handleRemoveFromInstance = (deviceId: string) => {
    const currentIds = selectedIds || devices.map(d => d.id);
    const newIds = currentIds.filter((id: string) => id !== deviceId);
    onUpdateProps && onUpdateProps({ selectedDeviceIds: newIds });
  };

  const handleCardEdit = (device: Device) => {
    if (widgetInstanceId && onUpdateProps) {
      setConfiguringDevice(device);
    } else {
      onEditDevice && onEditDevice(device);
    }
  };

  const handleCardDelete = (device: Device) => {
    if (widgetInstanceId && onUpdateProps) {
      handleRemoveFromInstance(device.id);
    } else {
      setDeviceToDelete(device);
    }
  };

  const handleSaveLocalConfig = () => {
    if (!configuringDevice || !onUpdateProps) return;

    const currentConfigs = widgetProps?.deviceConfigs || {};
    onUpdateProps({
      ...widgetProps,
      deviceConfigs: {
        ...currentConfigs,
        [configuringDevice.id]: {
          statStyle: localStyle,
          colsDesktop: localColsDesktop,
          colsMobile: localColsMobile,
          hideValues: localHideValues,
          visibleStats: localVisibleStats,
          enableAlerts: localEnableAlerts,
          coloredGraphs: localColoredGraphs
        }
      }
    });

    setConfiguringDevice(null);
  };

  // Helper function to render a portal directly to document.body
  const renderPortal = (content: React.ReactNode) => {
    if (!isMounted || typeof window === 'undefined') return null;
    return createPortal(content, document.body);
  };

  // Small helper component for Toggle Switch inside list rows
  const ListRowToggle = ({ checked, onChange }: { checked: boolean, onChange: () => void }) => (
    <div
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      style={{
        width: '32px',
        height: '16px',
        borderRadius: '8px',
        background: checked ? 'var(--nd-green)' : 'rgba(255,255,255,0.08)',
        position: 'relative',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        flexShrink: 0
      }}
    >
      <div style={{
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        background: '#fff',
        position: 'absolute',
        top: '3px',
        left: checked ? '19px' : '3px',
        transition: 'all 0.2s ease',
      }} />
    </div>
  );

  return (
    <div className="nd-sidebar-card nd-animate-in nd-stagger-1" style={{ position: 'relative' }}>
      <style dangerouslySetInnerHTML={{
        __html: `
        .nd-sidebar-card {
          --stat-label-size: 0.64rem;
          --stat-value-size: 0.74rem;
          --stat-detail-size: 0.58rem;
          --progress-bar-height: 5px;
        }

        .nd-device-stats-grid {
          display: grid !important;
          width: 100% !important;
          gap: 16px 12px !important;
          margin-top: 8px !important;
          justify-items: center !important;
          align-items: start !important;
          
          --circle-size: 100px;
          --bar-height: 36px;
        }

        .nd-device-stats-grid.horizontal {
          justify-items: stretch !important;
        }

        .nd-device-stats-grid .nd-stat-card {
          background: rgba(255, 255, 255, 0.015) !important;
          border: 1px solid rgba(255, 255, 255, 0.04) !important;
          border-radius: 6px !important;
          padding: 10px 12px !important;
          box-sizing: border-box !important;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
          width: 100% !important;
        }
        .nd-device-stats-grid .nd-stat-card:hover {
          background: rgba(255, 255, 255, 0.035) !important;
          border-color: rgba(255, 255, 255, 0.08) !important;
          transform: translateY(-1.5px) !important;
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.2) !important;
        }

        /* Disable encapsulation in narrow widget layouts (e.g. side panels) */
        .nd-widget-size-narrow .nd-device-stats-grid .nd-stat-card {
          background: transparent !important;
          border: none !important;
          padding: 4px 0 !important;
          box-shadow: none !important;
          transform: none !important;
        }
        .nd-widget-size-narrow .nd-device-stats-grid .nd-stat-card:hover {
          background: transparent !important;
          border-color: transparent !important;
          transform: none !important;
          box-shadow: none !important;
        }

        /* ---------------- NARROW WIDGET ---------------- */
        .nd-widget-size-narrow .nd-device-stats-grid.cols-desktop-1,
        .nd-widget-size-narrow .nd-device-stats-grid.cols-mobile-1 {
          --circle-size: 64px;
          --bar-height: 44px;
        }
        .nd-widget-size-narrow .nd-device-stats-grid.cols-desktop-2,
        .nd-widget-size-narrow .nd-device-stats-grid.cols-mobile-2 {
          --circle-size: 50px;
          --bar-height: 36px;
        }
        .nd-widget-size-narrow .nd-device-stats-grid.cols-desktop-3,
        .nd-widget-size-narrow .nd-device-stats-grid.cols-mobile-3 {
          --circle-size: 44px;
          --bar-height: 32px;
        }

        /* ---------------- MEDIUM WIDGET ---------------- */
        .nd-widget-size-medium .nd-sidebar-card {
          --stat-label-size: 0.74rem;
          --stat-value-size: 0.84rem;
          --stat-detail-size: 0.64rem;
          --progress-bar-height: 7px;
        }
        .nd-widget-size-medium .nd-device-stats-grid.cols-desktop-1 {
          --circle-size: 90px;
          --bar-height: 52px;
        }
        .nd-widget-size-medium .nd-device-stats-grid.cols-desktop-2 {
          --circle-size: 72px;
          --bar-height: 44px;
        }
        .nd-widget-size-medium .nd-device-stats-grid.cols-desktop-3 {
          --circle-size: 60px;
          --bar-height: 38px;
        }

        /* ---------------- WIDE WIDGET ---------------- */
        .nd-widget-size-wide .nd-sidebar-card {
          --stat-label-size: 0.84rem;
          --stat-value-size: 0.96rem;
          --stat-detail-size: 0.72rem;
          --progress-bar-height: 9px;
        }
        .nd-widget-size-wide .nd-device-stats-grid {
          gap: 20px 16px !important;
        }
        .nd-widget-size-wide .nd-device-stats-grid.cols-desktop-1 {
          --circle-size: 120px;
          --bar-height: 60px;
        }
        .nd-widget-size-wide .nd-device-stats-grid.cols-desktop-2 {
          --circle-size: 96px;
          --bar-height: 52px;
        }
        .nd-widget-size-wide .nd-device-stats-grid.cols-desktop-3 {
          --circle-size: 80px;
          --bar-height: 46px;
        }
        .nd-widget-size-wide .nd-device-stats-grid.cols-desktop-4 {
          --circle-size: 72px;
          --bar-height: 40px;
        }
        .nd-widget-size-wide .nd-device-stats-grid.cols-desktop-5,
        .nd-widget-size-wide .nd-device-stats-grid.cols-desktop-6 {
          --circle-size: 60px;
          --bar-height: 34px;
        }

        /* Mobile columns and sizes */
        .nd-device-stats-grid.cols-mobile-1 { grid-template-columns: repeat(1, minmax(0, 1fr)) !important; }
        .nd-device-stats-grid.cols-mobile-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        .nd-device-stats-grid.cols-mobile-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        .nd-device-stats-grid.cols-mobile-4 { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
        .nd-device-stats-grid.cols-mobile-5 { grid-template-columns: repeat(5, minmax(0, 1fr)) !important; }
        .nd-device-stats-grid.cols-mobile-6 { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; }

        /* Desktop columns and sizes (from 1024px) */
        @media (min-width: 1024px) {
          .nd-device-stats-grid.cols-desktop-1 { grid-template-columns: repeat(1, minmax(0, 1fr)) !important; }
          .nd-device-stats-grid.cols-desktop-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .nd-device-stats-grid.cols-desktop-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
          .nd-device-stats-grid.cols-desktop-4 { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
          .nd-device-stats-grid.cols-desktop-5 { grid-template-columns: repeat(5, minmax(0, 1fr)) !important; }
          .nd-device-stats-grid.cols-desktop-6 { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; }
        }
      `}} />

      {(!hideTitles || editMode) && (
        <div className="nd-section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <HardDrive size={12} style={{ color: 'var(--nd-orange)' }} />
            <span>Appareils</span>
          </div>
          {editMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
              {widgetInstanceId && onUpdateProps ? (
                <button
                  className="nd-action-icon accent"
                  onClick={(e) => { e.stopPropagation(); setIsWidgetConfigOpen(true); }}
                  title="Configurer le widget"
                >
                  <Pencil size={13} />
                </button>
              ) : (
                <button
                  className="nd-action-icon success"
                  onClick={handleAdd}
                  title="Créer un nouvel appareil global"
                >
                  <Plus size={13} />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {filteredDevices.length === 0 && (
        <p style={{ fontSize: '0.7rem', color: 'var(--nd-text-dimmed)', textAlign: 'center', padding: '12px 8px' }}>
          {editMode
            ? 'Aucun appareil configuré ou sélectionné pour ce widget. Cliquez sur le crayon pour en configurer la liste.'
            : 'Aucun appareil configuré ou sélectionné.'}
        </p>
      )}

      <SortableContext items={filteredDevices.map(d => `drag-device-${d.id}`)} strategy={verticalListSortingStrategy}>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: (hideTitles && !editMode) ? 0 : 6 }}>
          {filteredDevices.map((device, idx) => (
            <SortableDeviceCard
              key={device.id}
              device={device}
              editMode={editMode}
              widgetInstanceId={widgetInstanceId}
              widgetProps={widgetProps}
              onEdit={() => handleCardEdit(device)}
              onDelete={() => handleCardDelete(device)}
              isFirst={idx === 0}
              isLast={idx === filteredDevices.length - 1}
            />
          ))}
        </div>
      </SortableContext>

      {/* Global Delete Modal */}
      {editMode && deviceToDelete && <ConfirmModal
        isOpen={!!deviceToDelete}
        onClose={() => setDeviceToDelete(null)}
        onConfirm={() => {
          if (deviceToDelete) {
            handleDelete(deviceToDelete.id);
            setDeviceToDelete(null);
          }
        }}
        title="Supprimer définitivement l'appareil ?"
        description={`Êtes-vous sûr de vouloir supprimer définitivement "${deviceToDelete?.name}" de NasDash ? Cette action est définitive.`}
      />}

      {/* Widget Instance Config Modal (Portal centered modal with blur) */}
      {isWidgetConfigOpen && renderPortal(
        <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setIsWidgetConfigOpen(false); }}>
          <div className="nd-modal" style={{ maxWidth: '420px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 className="nd-section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'flex', alignItems: 'center' }}><Emoji emoji="⚙️" /></span> Configurer le widget Appareils
              </h2>
              <button className="nd-action-icon" onClick={() => setIsWidgetConfigOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <span className="nd-label">Sélectionner les serveurs à afficher dans ce widget :</span>

              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                padding: '10px',
                background: 'rgba(0,0,0,0.15)',
                border: '1px solid var(--nd-card-border)',
                borderRadius: 'var(--nd-card-radius)',
                maxHeight: '220px',
                overflowY: 'auto'
              }}>
                {devices.length === 0 ? (
                  <span style={{ fontSize: '0.68rem', color: 'var(--nd-text-muted)', padding: 2 }}>Aucun appareil configuré dans les paramètres.</span>
                ) : (
                  devices.map(d => {
                    const isChecked = selectedIds ? selectedIds.includes(d.id) : true;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => handleToggleDeviceSelection(d.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 12px',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          borderRadius: '16px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          border: isChecked ? '1px solid var(--nd-accent)' : '1px solid var(--nd-card-border)',
                          background: isChecked ? 'rgba(0, 229, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                          color: isChecked ? 'var(--nd-accent)' : 'var(--nd-text-muted)',
                          boxShadow: isChecked ? '0 0 8px rgba(0, 229, 255, 0.1)' : 'none',
                          userSelect: 'none'
                        }}
                        className="nd-btn-hover-glow"
                      >
                        {isChecked && <span style={{ fontWeight: 'bold', fontSize: '0.75rem' }}>✓</span>}
                        <span style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center' }}><Emoji emoji={d.icon} /></span>
                        <span>{d.name}</span>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Centralized addition shortcut */}
              <button
                type="button"
                className="nd-btn nd-btn-outline"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontSize: '0.68rem',
                  padding: '8px 12px',
                  color: 'var(--nd-text-muted)',
                  borderColor: 'var(--nd-card-border)',
                  marginTop: 4,
                  cursor: 'pointer'
                }}
                onClick={() => {
                  handleAdd();
                  setIsWidgetConfigOpen(false);
                }}
              >
                <Plus size={14} />
                Créer un nouvel appareil global
              </button>

              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <button type="button" onClick={() => setIsWidgetConfigOpen(false)} className="nd-btn nd-btn-accent" style={{ flex: 1, fontSize: '0.75rem' }}>Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Local Device Config Modal (Portal centered modal with blur) */}
      {configuringDevice && renderPortal(
        <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfiguringDevice(null); }}>
          <div className="nd-modal" style={{ maxWidth: '420px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 className="nd-section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'flex', alignItems: 'center' }}><Emoji emoji="🖥️" /></span> Configuration d'affichage - {configuringDevice.name}
              </h2>
              <button className="nd-action-icon" onClick={() => setConfiguringDevice(null)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="nd-label">Style d&apos;affichage dans ce widget</label>
                <CustomSelect
                  value={localStyle}
                  onChange={val => {
                    setLocalStyle(val as any);
                  }}
                  options={[
                    { value: 'horizontal', label: 'Barres classiques' },
                    { value: 'vertical', label: 'Barres verticales' },
                    { value: 'graph', label: 'Graphique (Sparkline)' }
                  ]}
                />
              </div>

              <div style={{ display: 'flex', gap: 12, padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--nd-card-border)' }}>
                <div style={{ flex: 1 }}>
                  <label className="nd-label" style={{ fontSize: '0.65rem' }}>Cols (Desktop)</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    className="nd-input"
                    value={localColsDesktop}
                    onChange={e => setLocalColsDesktop(Math.max(1, Math.min(6, parseInt(e.target.value) || 3)))}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="nd-label" style={{ fontSize: '0.65rem' }}>Cols (Mobile)</label>
                  <input
                    type="number"
                    min={1}
                    max={4}
                    className="nd-input"
                    value={localColsMobile}
                    onChange={e => setLocalColsMobile(Math.max(1, Math.min(4, parseInt(e.target.value) || 3)))}
                  />
                </div>
              </div>

              <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--nd-card-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div
                  onClick={() => setLocalHideValues(!localHideValues)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--nd-text)' }}>Mode minimaliste</span>
                    <span style={{ fontSize: '0.62rem', color: 'var(--nd-text-muted)' }}>Masquer les valeurs chiffrées</span>
                  </div>
                  <div style={{
                    width: '32px',
                    height: '16px',
                    borderRadius: '8px',
                    background: localHideValues ? 'var(--nd-green)' : 'rgba(255,255,255,0.08)',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    flexShrink: 0
                  }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: '#fff',
                      position: 'absolute',
                      top: '3px',
                      left: localHideValues ? '19px' : '3px',
                      transition: 'all 0.2s ease',
                    }} />
                  </div>
                </div>

                <div style={{ height: '1px', background: 'var(--nd-card-border)' }} />

                <div
                  onClick={() => setLocalEnableAlerts(!localEnableAlerts)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--nd-text)' }}>Alertes visuelles</span>
                    <span style={{ fontSize: '0.62rem', color: 'var(--nd-text-muted)' }}>Ajuster la couleur de la température selon sa valeur pour alerter</span>
                  </div>
                  <div style={{
                    width: '32px',
                    height: '16px',
                    borderRadius: '8px',
                    background: localEnableAlerts ? 'var(--nd-green)' : 'rgba(255,255,255,0.08)',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    flexShrink: 0
                  }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: '#fff',
                      position: 'absolute',
                      top: '3px',
                      left: localEnableAlerts ? '19px' : '3px',
                      transition: 'all 0.2s ease',
                    }} />
                  </div>
                </div>

                <div style={{ height: '1px', background: 'var(--nd-card-border)', margin: '4px 0' }} />
                <div
                  onClick={() => setLocalColoredGraphs(!localColoredGraphs)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--nd-text)' }}>Mode coloré</span>
                    <span style={{ fontSize: '0.62rem', color: 'var(--nd-text-muted)' }}>Utiliser les couleurs thématiques des métriques</span>
                  </div>
                  <div style={{
                    width: '32px',
                    height: '16px',
                    borderRadius: '8px',
                    background: localColoredGraphs ? 'var(--nd-green)' : 'rgba(255,255,255,0.08)',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    flexShrink: 0
                  }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: '#fff',
                      position: 'absolute',
                      top: '3px',
                      left: localColoredGraphs ? '19px' : '3px',
                      transition: 'all 0.2s ease',
                    }} />
                  </div>
                </div>
              </div>

              <div>
                <label className="nd-label" style={{ marginBottom: 8 }}>Métriques à afficher</label>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  maxHeight: '180px',
                  overflowY: 'auto',
                  padding: '10px',
                  background: 'rgba(0,0,0,0.15)',
                  border: '1px solid var(--nd-card-border)',
                  borderRadius: 'var(--nd-card-radius)'
                }}>
                  {availableStats.length === 0 ? (
                    <span style={{ fontSize: '0.68rem', color: 'var(--nd-text-muted)', padding: 2 }}>Aucune métrique détectée</span>
                  ) : (
                    availableStats.map((statName) => {
                      const isChecked = localVisibleStats.includes(statName);
                      return (
                        <button
                          key={statName}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              setLocalVisibleStats(localVisibleStats.filter(s => s !== statName));
                            } else {
                              setLocalVisibleStats([...localVisibleStats, statName]);
                            }
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 12px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            borderRadius: '16px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            border: isChecked ? '1px solid var(--nd-accent)' : '1px solid var(--nd-card-border)',
                            background: isChecked ? 'rgba(0, 229, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                            color: isChecked ? 'var(--nd-accent)' : 'var(--nd-text-muted)',
                            boxShadow: isChecked ? '0 0 8px rgba(0, 229, 255, 0.1)' : 'none',
                            userSelect: 'none'
                          }}
                        >
                          {isChecked && <span style={{ fontWeight: 'bold', fontSize: '0.75rem' }}>✓</span>}
                          <span>{statName}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <button
                type="button"
                className="nd-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  fontSize: '0.68rem',
                  padding: '8px 12px',
                  color: 'var(--nd-accent)',
                  borderColor: 'var(--nd-card-border)',
                  marginTop: 4,
                  cursor: 'pointer'
                }}
                onClick={() => {
                  onEditDevice && onEditDevice(configuringDevice);
                  setConfiguringDevice(null);
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Emoji emoji="⚙️" /> Modifier les paramètres de connexion globale</span>
              </button>

              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <button type="button" onClick={() => setConfiguringDevice(null)} className="nd-btn" style={{ flex: 1, fontSize: '0.75rem' }}>Annuler</button>
                <button
                  type="button"
                  onClick={handleSaveLocalConfig}
                  className="nd-btn nd-btn-accent"
                  style={{ flex: 1, fontSize: '0.75rem' }}
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
