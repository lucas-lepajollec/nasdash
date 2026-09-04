import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, PlusCircle, Trash2, ShieldAlert, ArrowRight, Sparkles, Network, Layers, Edit3, Check } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { NetworkNode, NetworkGroup, NetworkConnection, NetworkTopology } from '@/lib/types';
import ConfirmModal from '../../modals/ConfirmModal';
import EmojiPickerModal from '../../modals/EmojiPickerModal';
import CustomSelect from '../../shared/CustomSelect';
import { Emoji } from '../../shared/Emoji';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';
import { useI18n } from '@/i18n/I18nProvider';

interface TopologyMapProps {
  editMode: boolean;
  searchQuery: string;
  showSensitive: boolean;
}

function generateOrthogonalPath(
  x1: number,
  y1: number,
  fromPort: 'top' | 'right' | 'bottom' | 'left',
  x2: number,
  y2: number,
  toPort: 'top' | 'right' | 'bottom' | 'left',
  isBidirectional: boolean,
  trunkOffset: number,
  gapCenterX: number,
  isMobile: boolean,
  canvasWidth: number
): string {
  const marginX = 24;
  const marginY = 15;
  const r = 8;

  let x1_start = x1;
  let y1_start = y1;
  if (isBidirectional) {
    if (fromPort === 'top') y1_start = y1 - 7;
    else if (fromPort === 'bottom') y1_start = y1 + 7;
    else if (fromPort === 'left') x1_start = x1 - 7;
    else if (fromPort === 'right') x1_start = x1 + 7;
  }

  let x2_end = x2;
  let y2_end = y2;
  if (toPort === 'top') y2_end = y2 - 7;
  else if (toPort === 'bottom') y2_end = y2 + 7;
  else if (toPort === 'left') x2_end = x2 - 7;
  else if (toPort === 'right') x2_end = x2 + 7;

  let x1_ext = x1;
  let y1_ext = y1;
  if (fromPort === 'top') y1_ext = y1 - marginY;
  else if (fromPort === 'bottom') y1_ext = y1 + marginY;
  else if (fromPort === 'left') x1_ext = x1 - marginX;
  else if (fromPort === 'right') x1_ext = x1 + marginX;

  let x2_ext = x2;
  let y2_ext = y2;
  if (toPort === 'top') y2_ext = y2 - marginY;
  else if (toPort === 'bottom') y2_ext = y2 + marginY;
  else if (toPort === 'left') x2_ext = x2 - marginX;
  else if (toPort === 'right') x2_ext = x2 + marginX;

  const isFromPortVertical = fromPort === 'top' || fromPort === 'bottom';
  const isToPortVertical = toPort === 'top' || toPort === 'bottom';

  let points: { x: number; y: number }[] = [];

  if (isFromPortVertical && isToPortVertical) {
    let midY: number;
    const bothBottom = fromPort === 'bottom' && toPort === 'bottom';
    const bothTop = fromPort === 'top' && toPort === 'top';
    if (bothBottom) {
      midY = Math.max(y1_ext, y2_ext) + 6 + Math.abs(trunkOffset);
    } else if (bothTop) {
      midY = Math.min(y1_ext, y2_ext) - 6 - Math.abs(trunkOffset);
    } else {
      midY = (y1_ext + y2_ext) / 2 + trunkOffset;
    }

    let clampedY1Ext = y1_ext;
    let clampedY2Ext = y2_ext;
    if (!bothBottom && !bothTop) {
      if (fromPort === 'bottom' && toPort === 'top') {
        if (y1 < y2) {
          clampedY1Ext = Math.min(y1 + marginY, midY);
          clampedY2Ext = Math.max(y2 - marginY, midY);
        } else {
          clampedY1Ext = y1 + marginY;
          clampedY2Ext = y2 - marginY;
        }
      } else if (fromPort === 'top' && toPort === 'bottom') {
        if (y1 > y2) {
          clampedY1Ext = Math.max(y1 - marginY, midY);
          clampedY2Ext = Math.min(y2 + marginY, midY);
        } else {
          clampedY1Ext = y1 - marginY;
          clampedY2Ext = y2 + marginY;
        }
      }
    }

    const isOppositeSide = (x1 < gapCenterX) !== (x2 < gapCenterX);
    if (isOppositeSide) {
      let midX = gapCenterX + trunkOffset;
      points = [
        { x: x1_start, y: y1_start },
        { x: x1, y: clampedY1Ext },
        { x: midX, y: clampedY1Ext },
        { x: midX, y: clampedY2Ext },
        { x: x2, y: clampedY2Ext },
        { x: x2_end, y: y2_end }
      ];
    } else {
      points = [
        { x: x1_start, y: y1_start },
        { x: x1, y: clampedY1Ext },
        { x: x1, y: midY },
        { x: x2, y: midY },
        { x: x2, y: clampedY2Ext },
        { x: x2_end, y: y2_end }
      ];
    }
  } else if (!isFromPortVertical && !isToPortVertical) {
    const bothRight = fromPort === 'right' && toPort === 'right';
    const bothLeft = fromPort === 'left' && toPort === 'left';
    let midX: number;
    if (bothRight) {
      midX = Math.max(x1_ext, x2_ext) + 6 + Math.abs(trunkOffset);
    } else if (bothLeft) {
      midX = Math.min(x1_ext, x2_ext) - 6 - Math.abs(trunkOffset);
    } else {
      midX = (x1_ext + x2_ext) / 2 + trunkOffset;
    }

    if (isMobile) {
      if (fromPort === 'left' || toPort === 'left') {
        midX = 16 + trunkOffset;
      } else {
        midX = canvasWidth - 16 + trunkOffset;
      }
    } else if (!bothRight && !bothLeft && (x1 < gapCenterX) !== (x2 < gapCenterX)) {
      midX = gapCenterX + trunkOffset;
    }

    // Apply safety clearance to midX for horizontal ports to prevent sharp corners/bevels
    if (fromPort === 'right') {
      midX = Math.max(midX, x1_start + 24);
    } else if (fromPort === 'left') {
      midX = Math.min(midX, x1_start - 24);
    }
    if (toPort === 'right') {
      midX = Math.max(midX, x2_end + 24);
    } else if (toPort === 'left') {
      midX = Math.min(midX, x2_end - 24);
    }

    const isWrongWay = (fromPort === 'right' && toPort === 'left' && x2 < x1) ||
                       (fromPort === 'left' && toPort === 'right' && x2 > x1);

    const isWrongWayOrSameCol = !isMobile && (
      isWrongWay ||
      (Math.abs(x1 - x2) < 50 && (fromPort !== toPort)) ||
      ((bothRight || bothLeft) && Math.abs(y1 - y2) < 50)
    );

    if (isWrongWayOrSameCol) {
      let midY: number;
      if (Math.abs(y1 - y2) > 100) {
        midY = (y1 + y2) / 2;
      } else {
        if (Math.min(y1, y2) < 200) {
          midY = Math.max(y1, y2) + 68 + 24;
        } else {
          midY = Math.min(y1, y2) - 24;
        }
      }

      points = [
        { x: x1_start, y: y1_start },
        { x: x1_ext, y: y1 },
        { x: x1_ext, y: midY },
        { x: x2_ext, y: midY },
        { x: x2_ext, y: y2 },
        { x: x2_end, y: y2_end }
      ];
    } else {
      let clampedX1Ext = x1_ext;
      let clampedX2Ext = x2_ext;
      if (fromPort === 'right' && toPort === 'left') {
        if (x1 < x2) {
          clampedX1Ext = Math.min(x1 + marginX, midX);
          clampedX2Ext = Math.max(x2 - marginX, midX);
        } else {
          clampedX1Ext = x1 + marginX;
          clampedX2Ext = x2 - marginX;
        }
      } else if (fromPort === 'left' && toPort === 'right') {
        if (x1 > x2) {
          clampedX1Ext = Math.max(x1 - marginX, midX);
          clampedX2Ext = Math.min(x2 + marginX, midX);
        } else {
          clampedX1Ext = x1 - marginX;
          clampedX2Ext = x2 + marginX;
        }
      }

      if (fromPort === 'left') {
        clampedX1Ext = Math.max(clampedX1Ext, midX);
      } else if (fromPort === 'right') {
        clampedX1Ext = Math.min(clampedX1Ext, midX);
      }

      if (toPort === 'left') {
        clampedX2Ext = Math.max(clampedX2Ext, midX);
      } else if (toPort === 'right') {
        clampedX2Ext = Math.min(clampedX2Ext, midX);
      }

      points = [
        { x: x1_start, y: y1_start },
        { x: clampedX1Ext, y: y1 },
        { x: midX, y: y1 },
        { x: midX, y: y2 },
        { x: clampedX2Ext, y: y2 },
        { x: x2_end, y: y2_end }
      ];
    }
  } else if (isFromPortVertical && !isToPortVertical) {
    const isOppositeSide = (x1 < gapCenterX) !== (x2 < gapCenterX);
    if (isOppositeSide) {
      let midX = gapCenterX + trunkOffset;
      if (!isMobile) {
        const dy = Math.abs(y1 - y2);
        const factor = Math.min(1, dy / 600);
        const minX = gapCenterX - 35;
        const maxX = gapCenterX + 35;
        midX = minX + factor * (maxX - minX) + trunkOffset;
        midX = Math.max(minX, Math.min(midX, maxX));
      }

      // Safety clearance clamping for the target horizontal port
      if (toPort === 'right') {
        midX = Math.max(midX, x2_end + 24);
      } else if (toPort === 'left') {
        midX = Math.min(midX, x2_end - 24);
      }

      points = [
        { x: x1_start, y: y1_start },
        { x: x1, y: y1_ext },
        { x: midX, y: y1_ext },
        { x: midX, y: y2 },
        { x: x2_ext, y: y2 },
        { x: x2_end, y: y2_end }
      ];
    } else {
      points = [
        { x: x1_start, y: y1_start },
        { x: x1, y: y1_ext },
        { x: x2_ext, y: y1_ext },
        { x: x2_ext, y: y2 },
        { x: x2_end, y: y2_end }
      ];
    }
  } else {
    const isOppositeSide = (x1 < gapCenterX) !== (x2 < gapCenterX);
    if (isOppositeSide) {
      let midX = gapCenterX + trunkOffset;

      // Safety clearance clamping for the source horizontal port
      if (fromPort === 'right') {
        midX = Math.max(midX, x1_start + 24);
      } else if (fromPort === 'left') {
        midX = Math.min(midX, x1_start - 24);
      }

      points = [
        { x: x1_start, y: y1_start },
        { x: x1_ext, y: y1 },
        { x: midX, y: y1 },
        { x: midX, y: y2_ext },
        { x: x2, y: y2_ext },
        { x: x2_end, y: y2_end }
      ];
    } else {
      points = [
        { x: x1_start, y: y1_start },
        { x: x1_ext, y: y1 },
        { x: x1_ext, y: y2_ext },
        { x: x2, y: y2_ext },
        { x: x2_end, y: y2_end }
      ];
    }
  }

  // Clamp intermediate points (all except start and end) to canvas margins to prevent horizontal overflow
  for (let i = 1; i < points.length - 1; i++) {
    points[i].x = Math.max(12, Math.min(points[i].x, canvasWidth - 12));
  }

  // Remove consecutive duplicate points (which can happen due to clamping) to preserve rounded corner curves
  const uniquePoints: typeof points = [];
  for (const p of points) {
    if (uniquePoints.length === 0) {
      uniquePoints.push(p);
    } else {
      const last = uniquePoints[uniquePoints.length - 1];
      if (Math.abs(last.x - p.x) > 0.01 || Math.abs(last.y - p.y) > 0.01) {
        uniquePoints.push(p);
      }
    }
  }

  // Remove collinear intermediate points to ensure accurate corner radius calculations
  const filteredPoints: typeof points = [];
  if (uniquePoints.length > 0) filteredPoints.push(uniquePoints[0]);
  for (let i = 1; i < uniquePoints.length - 1; i++) {
    const prev = uniquePoints[i - 1];
    const curr = uniquePoints[i];
    const next = uniquePoints[i + 1];
    const isCollinear = (Math.abs(prev.x - curr.x) < 0.01 && Math.abs(curr.x - next.x) < 0.01) ||
                        (Math.abs(prev.y - curr.y) < 0.01 && Math.abs(curr.y - next.y) < 0.01);
    if (!isCollinear) {
      filteredPoints.push(curr);
    }
  }
  if (uniquePoints.length > 1) filteredPoints.push(uniquePoints[uniquePoints.length - 1]);
  points = filteredPoints;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const isCollinear = (prev.x === curr.x && curr.x === next.x) || (prev.y === curr.y && curr.y === next.y);
    if (isCollinear) {
      d += ` L ${curr.x} ${curr.y}`;
      continue;
    }

    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;

    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

    const actualR = Math.min(r, len1 / 2, len2 / 2);

    const startX = curr.x - (dx1 / len1) * actualR;
    const startY = curr.y - (dy1 / len1) * actualR;
    const endX = curr.x + (dx2 / len2) * actualR;
    const endY = curr.y + (dy2 / len2) * actualR;

    d += ` L ${startX} ${startY}`;
    d += ` Q ${curr.x} ${curr.y}, ${endX} ${endY}`;
  }

  d += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
  return d;
}

interface TopologyAnchorProps {
  nodeId: string;
  corner: 'top' | 'right' | 'bottom' | 'left';
  isParentHovered: boolean;
  onDragStart: (
    e: React.MouseEvent | React.TouchEvent,
    id: string,
    corner: 'top' | 'right' | 'bottom' | 'left'
  ) => void;
}

function TopologyAnchor({ nodeId, corner, isParentHovered, onDragStart }: TopologyAnchorProps) {
  const [isHovered, setIsHovered] = useState(false);

  const anchorPositions: Record<string, React.CSSProperties> = {
    'top': { top: -10, left: '50%' },
    'right': { right: -10, top: '50%' },
    'bottom': { bottom: -10, left: '50%' },
    'left': { left: -10, top: '50%' },
  };

  const scale = isHovered ? 1.2 : (isParentHovered ? 1 : 0.6);
  const translate = (corner === 'top' || corner === 'bottom') ? 'translateX(-50%)' : 'translateY(-50%)';

  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: isHovered ? 'var(--nd-accent)' : 'var(--nd-bg-surface)',
    border: `1px solid ${isHovered ? 'var(--nd-accent)' : 'color-mix(in srgb, var(--nd-accent) 40%, transparent)'}`,
    color: isHovered ? '#0d1117' : 'var(--nd-accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'crosshair',
    zIndex: 50,
    boxShadow: 'none',
    userSelect: 'none',
    opacity: isHovered ? 1 : (isParentHovered ? 0.85 : 0),
    transform: `${translate} scale(${scale})`,
    transition: 'opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s, border-color 0.15s, color 0.15s',
    ...anchorPositions[corner]
  };

  return (
    <div
      className={`nd-anchor-plus ${corner}`}
      style={baseStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={(e) => onDragStart(e, nodeId, corner)}
      onTouchStart={(e) => onDragStart(e, nodeId, corner)}
    >
      +
    </div>
  );
}

export function TopologyMap({ editMode, searchQuery, showSensitive }: TopologyMapProps) {
  const { t } = useI18n();
  const { config, updateConfig, showSecretSections } = useConfig();
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 800, height: 600 });
  const [draggingConn, setDraggingConn] = useState<{
    fromId: string;
    fromCorner: 'top' | 'right' | 'bottom' | 'left';
    currentX: number;
    currentY: number;
  } | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      setIsMobileLayout(window.innerWidth <= 960);
    }
  }, []);

  // Modals / forms state
  const [showAddNode, setShowAddNode] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showAddLink, setShowAddLink] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);

  // Element selections for editing/deletions
  const [editingNode, setEditingNode] = useState<NetworkNode | null>(null);
  const [editingGroup, setEditingGroup] = useState<NetworkGroup | null>(null);
  const [editingConnection, setEditingConnection] = useState<NetworkConnection | null>(null);
  const [pendingDeleteNode, setPendingDeleteNode] = useState<NetworkNode | null>(null);
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<NetworkGroup | null>(null);

  // New Node Form fields
  const [nodeName, setNodeName] = useState('');
  const [nodeType, setNodeType] = useState<NetworkNode['type']>('stdsvc');
  const [nodeIcon, setNodeIcon] = useState('📦');
  const [nodeIp, setNodeIp] = useState('');
  const [nodePorts, setNodePorts] = useState('');
  const [nodeGroupId, setNodeGroupId] = useState('');
  const [linkedServiceId, setLinkedServiceId] = useState('');
  const [linkedDeviceId, setLinkedDeviceId] = useState('');

  // New Group Form fields
  const [groupName, setGroupName] = useState('');
  const [groupType, setGroupType] = useState<NetworkGroup['type']>('device');
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [mergeIncomingLinks, setMergeIncomingLinks] = useState(false);

  // Auto-import options
  const [showAutoImportModal, setShowAutoImportModal] = useState(false);
  const [autoImportGroupCategories, setAutoImportGroupCategories] = useState(true);
  const nodeDialogRef = useDialogAccessibility(
    () => editingNode ? setEditingNode(null) : setShowAddNode(false),
    Boolean(showAddNode || editingNode),
  );
  const groupDialogRef = useDialogAccessibility(
    () => editingGroup ? setEditingGroup(null) : setShowAddGroup(false),
    Boolean(showAddGroup || editingGroup),
  );
  const connectionDialogRef = useDialogAccessibility(
    () => editingConnection ? setEditingConnection(null) : setShowAddLink(false),
    Boolean(showAddLink || editingConnection),
  );
  const autoImportDialogRef = useDialogAccessibility(
    () => setShowAutoImportModal(false),
    showAutoImportModal,
  );

  // New Connection Form fields
  const [linkFrom, setLinkFrom] = useState('');
  const [linkTo, setLinkTo] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkDir, setLinkDir] = useState<'directional' | 'bidirectional'>('directional');
  const [linkFromPort, setLinkFromPort] = useState<'auto' | 'top' | 'bottom' | 'left' | 'right'>('auto');
  const [linkToPort, setLinkToPort] = useState<'auto' | 'top' | 'bottom' | 'left' | 'right'>('auto');

  // Listen for edit action toolbar events dispatched from the Header. Keep
  // this effect below every state declaration it references so React's static
  // analysis and future compiler passes can reason about it safely.
  useEffect(() => {
    const onAddGroup = () => {
      setGroupName('');
      setGroupType('infra');
      setSelectedNodeIds([]);
      setMergeIncomingLinks(false);
      setShowAddGroup(true);
    };
    const onAddLink = () => {
      setLinkFrom('');
      setLinkTo('');
      setLinkLabel('');
      setLinkDir('directional');
      setLinkFromPort('auto');
      setLinkToPort('auto');
      setShowAddLink(true);
    };
    const onAddNode = () => {
      setNodeName('');
      setNodeType('stdsvc');
      setNodeIcon('📦');
      setNodeIp('');
      setNodePorts('');
      setNodeGroupId('');
      setLinkedServiceId('');
      setLinkedDeviceId('');
      setShowAddNode(true);
    };

    window.addEventListener('networkActionAddGroup', onAddGroup);
    window.addEventListener('networkActionAddLink', onAddLink);
    window.addEventListener('networkActionAddNode', onAddNode);

    return () => {
      window.removeEventListener('networkActionAddGroup', onAddGroup);
      window.removeEventListener('networkActionAddLink', onAddLink);
      window.removeEventListener('networkActionAddNode', onAddNode);
    };
  }, []);

  // DOM measurements state for rendering connection lines
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<Record<string, { x: number; y: number; width: number; height: number }>>({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Retrieve current topology data from settings (with defaults if empty)
  const rawTopology: NetworkTopology = useMemo(() => {
    return config?.settings?.networkTopology || { nodes: [], groups: [], connections: [] };
  }, [config?.settings?.networkTopology]);

  // Compute secret categories and services maps
  const secretData = useMemo(() => {
    if (!config?.categories) {
      return { serviceIds: new Set<string>(), serviceNames: new Set<string>(), categoryTitles: new Set<string>() };
    }
    const serviceIds = new Set<string>();
    const serviceNames = new Set<string>();
    const categoryTitles = new Set<string>();

    config.categories.forEach(c => {
      if (c.isSecret) {
        categoryTitles.add(c.title.toLowerCase().trim());
        c.services.forEach(s => {
          serviceIds.add(s.id);
          serviceNames.add(s.name.toLowerCase().trim());
        });
      }
    });

    return { serviceIds, serviceNames, categoryTitles };
  }, [config?.categories]);

  // Apply filtering based on showSecretSections state
  const topology = useMemo(() => {
    if (showSecretSections) return rawTopology;

    const { serviceIds, serviceNames, categoryTitles } = secretData;

    // Filter nodes
    const filteredNodes = rawTopology.nodes.filter(node => {
      if (node.linkedServiceId && serviceIds.has(node.linkedServiceId)) {
        return false;
      }
      if (node.name && serviceNames.has(node.name.toLowerCase().trim())) {
        return false;
      }
      return true;
    });

    const visibleNodeIds = new Set(filteredNodes.map(n => n.id));

    // Filter groups
    const filteredGroups = rawTopology.groups.filter(group => {
      if (group.name && categoryTitles.has(group.name.toLowerCase().trim())) {
        return false;
      }
      return true;
    });

    const visibleGroupIds = new Set(filteredGroups.map(g => g.id));

    // Filter connections: only keep connections where both endpoints are visible
    const filteredConnections = rawTopology.connections.filter(conn => {
      const fromVisible = visibleNodeIds.has(conn.fromId) || visibleGroupIds.has(conn.fromId);
      const toVisible = visibleNodeIds.has(conn.toId) || visibleGroupIds.has(conn.toId);
      return fromVisible && toVisible;
    });

    return {
      nodes: filteredNodes,
      groups: filteredGroups,
      connections: filteredConnections
    };
  }, [rawTopology, showSecretSections, secretData]);

  // Resolve card size based on configuration or auto-detection
  const cardSizeSetting = config?.settings?.tabs?.networks?.cardSize || 'auto';

  const resolvedCardSize = useMemo(() => {
    if (cardSizeSetting !== 'auto') return cardSizeSetting as 'standard' | 'compact' | 'mini';

    // Auto-detection based on the number of services
    const serviceCount = topology.nodes.filter(n => n.type === 'stdsvc').length;
    if (serviceCount <= 8) return 'standard';
    if (serviceCount <= 24) return 'compact';
    return 'mini';
  }, [cardSizeSetting, topology.nodes]);

  // Compute horizontal gap center dynamically to route crossing vertical lines
  const gapCenterX = useMemo(() => {
    const leftRange = (() => {
      const sameSideCoords = Object.entries(coords)
        .filter(([id]) => {
          const node = topology.nodes.find(n => n.id === id);
          const group = topology.groups.find(g => g.id === id);
          const nodeType = node?.type || group?.type;
          return nodeType === 'infra' || nodeType === 'netsvc' || nodeType === 'device';
        })
        .map(([_, coord]) => coord);

      if (sameSideCoords.length === 0) return { minX: 0, maxX: 400 };
      const minX = Math.min(...sameSideCoords.map(c => c.x));
      const maxX = Math.max(...sameSideCoords.map(c => c.x + c.width));
      return { minX, maxX };
    })();

    const rightRange = (() => {
      const sameSideCoords = Object.entries(coords)
        .filter(([id]) => {
          const node = topology.nodes.find(n => n.id === id);
          const group = topology.groups.find(g => g.id === id);
          const nodeType = node?.type || group?.type;
          return nodeType === 'stdsvc';
        })
        .map(([_, coord]) => coord);

      if (sameSideCoords.length === 0) return { minX: 600, maxX: 1000 };
      const minX = Math.min(...sameSideCoords.map(c => c.x));
      const maxX = Math.max(...sameSideCoords.map(c => c.x + c.width));
      return { minX, maxX };
    })();

    return (leftRange.maxX + rightRange.minX) / 2;
  }, [coords, topology]);

  const getTargetClosestPort = (targetId: string, currentX: number, currentY: number): 'top' | 'right' | 'bottom' | 'left' => {
    const coord = coords[targetId];
    if (!coord) return 'top';
    const ports = [
      { name: 'top' as const, x: coord.x + coord.width / 2, y: coord.y },
      { name: 'right' as const, x: coord.x + coord.width, y: coord.y + coord.height / 2 },
      { name: 'bottom' as const, x: coord.x + coord.width / 2, y: coord.y + coord.height },
      { name: 'left' as const, x: coord.x, y: coord.y + coord.height / 2 }
    ];
    let closestPort = ports[0].name;
    let minDist = Infinity;
    ports.forEach(p => {
      const dist = Math.hypot(p.x - currentX, p.y - currentY);
      if (dist < minDist) {
        minDist = dist;
        closestPort = p.name;
      }
    });
    return closestPort;
  };

  const getClosestPort = (fromX: number, fromY: number, toX: number, toY: number): 'top' | 'right' | 'bottom' | 'left' => {
    if (Math.abs(toX - fromX) > Math.abs(toY - fromY)) {
      return toX > fromX ? 'left' : 'right';
    } else {
      return toY > fromY ? 'top' : 'bottom';
    }
  };

  // Recalculate coordinates of all nodes relative to the map canvas
  const updateCoordinates = () => {
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth <= 960;
      setIsMobileLayout(prev => prev !== isMobile ? isMobile : prev);
    }
    if (!containerRef.current || !innerRef.current) return;
    const parentRect = innerRef.current.getBoundingClientRect();
    const newWidth = parentRect.width;
    const newHeight = parentRect.height;

    setCanvasSize(prev => {
      if (prev.width === newWidth && prev.height === newHeight) return prev;
      return { width: newWidth, height: newHeight };
    });

    const newCoords: typeof coords = {};

    // Get position of all nodes
    topology.nodes.forEach((n) => {
      const el = document.getElementById(`node-card-${n.id}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        newCoords[n.id] = {
          x: rect.left - parentRect.left,
          y: rect.top - parentRect.top,
          width: rect.width,
          height: rect.height
        };
      }
    });

    // Get position of all groups
    topology.groups.forEach((g) => {
      const el = document.getElementById(`group-box-${g.id}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        newCoords[g.id] = {
          x: rect.left - parentRect.left,
          y: rect.top - parentRect.top,
          width: rect.width,
          height: rect.height
        };
      }
    });

    setCoords(prev => {
      const prevKeys = Object.keys(prev);
      const newKeys = Object.keys(newCoords);
      if (prevKeys.length !== newKeys.length) return newCoords;

      const hasChanged = newKeys.some(key => {
        const p = prev[key];
        const n = newCoords[key];
        if (!p) return true;
        return (
          Math.abs(p.x - n.x) > 0.5 ||
          Math.abs(p.y - n.y) > 0.5 ||
          Math.abs(p.width - n.width) > 0.5 ||
          Math.abs(p.height - n.height) > 0.5
        );
      });
      return hasChanged ? newCoords : prev;
    });
  };

  // Trigger recalculation on state changes, layout changes, or resizing
  useEffect(() => {
    updateCoordinates();
    const t = setTimeout(updateCoordinates, 100);

    const handleWindowResize = () => {
      updateCoordinates();
    };
    window.addEventListener('resize', handleWindowResize);

    if (!containerRef.current) {
      return () => {
        clearTimeout(t);
        window.removeEventListener('resize', handleWindowResize);
      };
    }

    const observer = new ResizeObserver(() => {
      updateCoordinates();
    });

    observer.observe(containerRef.current);
    const cols = containerRef.current.querySelectorAll('.nd-topology-col');
    cols.forEach(col => observer.observe(col));

    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', handleWindowResize);
      observer.disconnect();
    };
  }, [topology, refreshTrigger, editMode, searchQuery, showSensitive]);

  // Handle connection dragging events (mouse and touch)
  useEffect(() => {
    if (!draggingConn) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      let clientX = 0;
      let clientY = 0;
      if ('touches' in e) {
        if (e.touches.length === 0) return;
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
        // Prevent scrolling while dragging on touch devices
        e.preventDefault();
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      if (!innerRef.current) return;
      const parentRect = innerRef.current.getBoundingClientRect();
      const currentX = clientX - parentRect.left;
      const currentY = clientY - parentRect.top;

      setDraggingConn(prev => prev ? { ...prev, currentX, currentY } : null);

      // Collision detection for target cards/groups
      const el = document.elementFromPoint(clientX, clientY);
      const cardEl = el?.closest('[data-node-id], [data-group-id]');
      if (cardEl) {
        const targetNodeId = cardEl.getAttribute('data-node-id');
        const targetGroupId = cardEl.getAttribute('data-group-id');
        const targetId = targetNodeId || targetGroupId;
        if (targetId && targetId !== draggingConn.fromId) {
          setDragOverId(targetId);
        } else {
          setDragOverId(null);
        }
      } else {
        setDragOverId(null);
      }
    };

    const handleUp = (e: MouseEvent | TouchEvent) => {
      let clientX = 0;
      let clientY = 0;
      if ('changedTouches' in e) {
        if (e.changedTouches.length > 0) {
          clientX = e.changedTouches[0].clientX;
          clientY = e.changedTouches[0].clientY;
        }
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      let finalTargetId: string | null = null;
      if (clientX && clientY) {
        const el = document.elementFromPoint(clientX, clientY);
        const cardEl = el?.closest('[data-node-id], [data-group-id]');
        if (cardEl) {
          const targetNodeId = cardEl.getAttribute('data-node-id');
          const targetGroupId = cardEl.getAttribute('data-group-id');
          finalTargetId = targetNodeId || targetGroupId;
        }
      }

      if (finalTargetId && finalTargetId !== draggingConn.fromId) {
        // Successfully dragged and connected
        const targetPort = getTargetClosestPort(finalTargetId, draggingConn.currentX, draggingConn.currentY);
        setLinkFrom(draggingConn.fromId);
        setLinkTo(finalTargetId);
        setLinkLabel('');
        setLinkDir('directional');
        setLinkFromPort(draggingConn.fromCorner);
        setLinkToPort(targetPort);
        setShowAddLink(true);
      }

      setDraggingConn(null);
      setDragOverId(null);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [draggingConn]);

  const handleDragStart = (
    e: React.MouseEvent | React.TouchEvent,
    fromId: string,
    fromCorner: 'top' | 'right' | 'bottom' | 'left'
  ) => {
    e.stopPropagation();
    let clientX = 0;
    let clientY = 0;
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    if (!innerRef.current) return;
    const parentRect = innerRef.current.getBoundingClientRect();
    const currentX = clientX - parentRect.left;
    const currentY = clientY - parentRect.top;

    setDraggingConn({
      fromId,
      fromCorner,
      currentX,
      currentY
    });
    setDragOverId(null);
  };

  // Auto-import generator: creates nodes based on NasDash config
  const handleAutoImport = async (useHomeCategories: boolean) => {
    if (!config) return;

    const nodes: NetworkNode[] = [];
    const groups: NetworkGroup[] = [];
    const connections: NetworkConnection[] = [];

    // Helper to generate a random ID
    const genId = () => Math.random().toString(36).substring(2, 9);

    // 1. Create a default Switch / Box in Infra Column
    const infraSwitchId = `auto-sw-${genId()}`;
    nodes.push({
      id: infraSwitchId,
      name: 'Switch Principal / Box',
      type: 'infra',
      icon: '🌐',
      ip: '192.168.1.1',
      ports: [80, 443]
    });

    // 2. Import Devices as hosts
    const deviceMap = new Map<string, string>(); // NasDash deviceId -> Node Id
    const deviceIpMap = new Map<string, string>(); // Hostname/IP -> Node Id

    (config.devices || []).forEach(d => {
      const nodeId = `auto-dev-${genId()}`;
      deviceMap.set(d.id, nodeId);

      const ip = d.api?.ip || d.host || '';
      if (ip) {
        deviceIpMap.set(ip.trim(), nodeId);
      }

      nodes.push({
        id: nodeId,
        name: d.name,
        type: 'device',
        icon: d.icon || '🖥️',
        ip: ip,
        linkedDeviceId: d.id
      });

      // Connect each device to the main Switch/Box
      connections.push({
        id: `auto-conn-${genId()}`,
        fromId: infraSwitchId,
        toId: nodeId,
        type: 'bidirectional'
      });
    });

    // 3. Scan services to distinguish between Network Services and Standard Apps
    const netKeywords = ['pihole', 'pi-hole', 'adguard', 'tailscale', 'wireguard', 'vpn', 'dns', 'tunnel', 'cloudflare', 'traefik', 'proxy', 'nginx', 'npm'];

    (config.categories || []).forEach(cat => {
      let groupStdId = '';
      let groupNetId = '';

      if (useHomeCategories && cat.services.length > 0) {
        // Find if there are standard or network services inside this category
        const hasStd = cat.services.some(svc => {
          const nameLower = svc.name.toLowerCase();
          const catLower = cat.title.toLowerCase();
          return !netKeywords.some(kw => nameLower.includes(kw) || catLower.includes(kw));
        });
        const hasNet = cat.services.some(svc => {
          const nameLower = svc.name.toLowerCase();
          const catLower = cat.title.toLowerCase();
          return netKeywords.some(kw => nameLower.includes(kw) || catLower.includes(kw));
        });

        if (hasStd) {
          groupStdId = `auto-grp-std-${genId()}`;
          groups.push({
            id: groupStdId,
            name: cat.title,
            type: 'stdsvc',
            mergeIncomingLinks: true
          });
        }
        if (hasNet) {
          groupNetId = `auto-grp-net-${genId()}`;
          groups.push({
            id: groupNetId,
            name: cat.title,
            type: 'netsvc',
            mergeIncomingLinks: true
          });
        }
      }

      cat.services.forEach(svc => {
        const nameLower = svc.name.toLowerCase();
        const catLower = cat.title.toLowerCase();
        const isNet = netKeywords.some(kw => nameLower.includes(kw) || catLower.includes(kw));
        const nodeId = `auto-svc-${genId()}`;

        // Parse IP/Host if available
        let hostIp = '';
        let portNum: number | undefined;

        if (svc.localUrl) {
          try {
            const urlObj = new URL(svc.localUrl.match(/^https?:\/\//i) ? svc.localUrl : `http://${svc.localUrl}`);
            hostIp = urlObj.hostname;
            if (urlObj.port) portNum = parseInt(urlObj.port, 10);
          } catch(e) {}
        }

        const assignedGroupId = isNet ? groupNetId : groupStdId;

        nodes.push({
          id: nodeId,
          name: svc.name,
          type: isNet ? 'netsvc' : 'stdsvc',
          icon: isNet ? '🛡️' : '📦',
          ip: hostIp,
          ports: portNum ? [portNum] : [],
          linkedServiceId: svc.id,
          groupId: assignedGroupId || undefined
        });

        // Smart-link service to its Device host if IPs match
        let linkedToHost = false;
        if (hostIp) {
          const deviceNodeId = deviceIpMap.get(hostIp.trim());
          if (deviceNodeId) {
            connections.push({
              id: `auto-conn-${genId()}`,
              fromId: deviceNodeId,
              toId: nodeId,
              label: portNum ? `${portNum}` : undefined,
              type: 'directional'
            });
            linkedToHost = true;
          }
        }

        // Otherwise connect it to the main router/switch
        if (!linkedToHost) {
          connections.push({
            id: `auto-conn-${genId()}`,
            fromId: infraSwitchId,
            toId: nodeId,
            label: portNum ? `${portNum}` : undefined,
            type: 'directional'
          });
        }
      });
    });

    // 4. Merge connections pointing to nodes in the same category group
    groups.forEach(g => {
      // Find nodes belonging to this group
      const groupNodeIds = nodes.filter(n => n.groupId === g.id).map(n => n.id);
      if (groupNodeIds.length === 0) return;

      // Find all incoming connections from outside the group targeting nodes inside the group
      const incoming = connections.filter(c =>
        groupNodeIds.includes(c.toId) && !groupNodeIds.includes(c.fromId)
      );

      if (incoming.length > 0) {
        // Group incoming by fromId
        const groupedByFrom: Record<string, typeof incoming> = {};
        incoming.forEach(c => {
          if (!groupedByFrom[c.fromId]) groupedByFrom[c.fromId] = [];
          groupedByFrom[c.fromId].push(c);
        });

        // Remove these incoming connections from the connections list
        const incomingIds = new Set(incoming.map(c => c.id));
        for (let i = connections.length - 1; i >= 0; i--) {
          if (incomingIds.has(connections[i].id)) {
            connections.splice(i, 1);
          }
        }

        // Add a single consolidated connection for each fromId to the groupId
        Object.entries(groupedByFrom).forEach(([fromId, conns]) => {
          const labels = conns.map(c => c.label?.trim()).filter(Boolean) as string[];
          const uniqueLabels = Array.from(new Set(labels));
          const mergedLabel = uniqueLabels.length > 0 ? uniqueLabels.join(', ') : undefined;
          const hasBidirectional = conns.some(c => c.type === 'bidirectional');

          connections.push({
            id: `auto-conn-${genId()}`,
            fromId,
            toId: g.id,
            type: hasBidirectional ? 'bidirectional' : 'directional',
            label: mergedLabel
          });
        });
      }
    });

    // Update settings
    await updateConfig({
      networkTopology: {
        nodes,
        groups,
        connections
      }
    });

    setRefreshTrigger(p => p + 1);
  };

  // Save updated topology back to settings
  const saveTopology = async (updated: NetworkTopology) => {
    await updateConfig({
      networkTopology: updated
    });
    setRefreshTrigger(p => p + 1);
  };

  // Node creation
  const handleCreateNode = () => {
    if (!nodeName.trim()) return;

    const parsedPorts = nodePorts
      .split(',')
      .map(p => parseInt(p.trim(), 10))
      .filter(p => !isNaN(p));

    let updatedNodes = [...topology.nodes];

    if (editingNode) {
      updatedNodes = updatedNodes.map(n => n.id === editingNode.id ? {
        ...n,
        name: nodeName,
        type: nodeType,
        icon: nodeIcon,
        ip: nodeIp || undefined,
        ports: parsedPorts.length > 0 ? parsedPorts : undefined,
        groupId: nodeGroupId || undefined,
        linkedServiceId: linkedServiceId || undefined,
        linkedDeviceId: linkedDeviceId || undefined
      } : n);
    } else {
      const newNode: NetworkNode = {
        id: `node-${Math.random().toString(36).substring(2, 9)}`,
        name: nodeName,
        type: nodeType,
        icon: nodeIcon,
        ip: nodeIp || undefined,
        ports: parsedPorts.length > 0 ? parsedPorts : undefined,
        groupId: nodeGroupId || undefined,
        linkedServiceId: linkedServiceId || undefined,
        linkedDeviceId: linkedDeviceId || undefined
      };
      updatedNodes.push(newNode);
    }

    const updated = {
      ...topology,
      nodes: updatedNodes
    };

    saveTopology(updated);
    setShowAddNode(false);
    setEditingNode(null);

    // Reset form
    setNodeName('');
    setNodeType('stdsvc');
    setNodeIcon('📦');
    setNodeIp('');
    setNodePorts('');
    setNodeGroupId('');
    setLinkedServiceId('');
    setLinkedDeviceId('');
  };

  // Group creation
  const handleCreateGroup = () => {
    if (!groupName.trim()) return;

    let groupId = editingGroup?.id;
    let updatedGroups = [...topology.groups];

    if (editingGroup) {
      updatedGroups = updatedGroups.map(g => g.id === editingGroup.id ? {
        ...g,
        name: groupName,
        type: groupType
      } : g);
    } else {
      groupId = `group-${Math.random().toString(36).substring(2, 9)}`;
      const newGroup: NetworkGroup = {
        id: groupId,
        name: groupName,
        type: groupType
      };
      updatedGroups.push(newGroup);
    }

    // Associate checked nodes to this group, and disassociate nodes that were in this group but are unchecked
    const updatedNodes = topology.nodes.map(n => {
      if (selectedNodeIds.includes(n.id)) {
        return { ...n, groupId };
      } else if (n.groupId === groupId) {
        return { ...n, groupId: undefined };
      }
      return n;
    });

    // Handle merging of incoming connections
    let updatedConnections = [...topology.connections];
    if (mergeIncomingLinks) {
      // Find all incoming connections from outside the group targeting nodes inside the group
      const incoming = topology.connections.filter(c =>
        selectedNodeIds.includes(c.toId) && !selectedNodeIds.includes(c.fromId)
      );

      // Group incoming by fromId
      const groupedByFrom: Record<string, NetworkConnection[]> = {};
      incoming.forEach(c => {
        if (!groupedByFrom[c.fromId]) groupedByFrom[c.fromId] = [];
        groupedByFrom[c.fromId].push(c);
      });

      // Remove all these incoming connections
      const incomingIds = new Set(incoming.map(c => c.id));
      updatedConnections = updatedConnections.filter(c => !incomingIds.has(c.id));

      // Add a single consolidated connection for each fromId
      Object.entries(groupedByFrom).forEach(([fromId, conns]) => {
        const labels = conns.map(c => c.label?.trim()).filter(Boolean) as string[];
        const uniqueLabels = Array.from(new Set(labels));
        const mergedLabel = uniqueLabels.length > 0 ? uniqueLabels.join(', ') : undefined;
        const hasBidirectional = conns.some(c => c.type === 'bidirectional');

        updatedConnections.push({
          id: `conn-${Math.random().toString(36).substring(2, 9)}`,
          fromId,
          toId: groupId!,
          type: hasBidirectional ? 'bidirectional' : 'directional',
          label: mergedLabel
        });
      });
    }

    const updated = {
      nodes: updatedNodes,
      groups: updatedGroups,
      connections: updatedConnections
    };

    saveTopology(updated);
    setShowAddGroup(false);
    setEditingGroup(null);
    setGroupName('');
    setSelectedNodeIds([]);
    setMergeIncomingLinks(false);
  };

  // Link creation
  const handleCreateLink = () => {
    if (!linkFrom || !linkTo || linkFrom === linkTo) return;

    let updatedConnections = [...topology.connections];

    if (editingConnection) {
      updatedConnections = updatedConnections.map(c => c.id === editingConnection.id ? {
        ...c,
        fromId: linkFrom,
        toId: linkTo,
        label: linkLabel || undefined,
        type: linkDir,
        fromPort: linkFromPort,
        toPort: linkToPort
      } : c);
    } else {
      const newConn: NetworkConnection = {
        id: `conn-${Math.random().toString(36).substring(2, 9)}`,
        fromId: linkFrom,
        toId: linkTo,
        label: linkLabel || undefined,
        type: linkDir,
        fromPort: linkFromPort,
        toPort: linkToPort
      };
      updatedConnections.push(newConn);
    }

    const updated = {
      ...topology,
      connections: updatedConnections
    };

    saveTopology(updated);
    setShowAddLink(false);
    setEditingConnection(null);
    setLinkFrom('');
    setLinkTo('');
    setLinkLabel('');
    setLinkDir('directional');
    setLinkFromPort('auto');
    setLinkToPort('auto');
  };

  // Deletion helper
  const handleDeleteNode = (id: string) => {
    const updated = {
      nodes: topology.nodes.filter(n => n.id !== id),
      groups: topology.groups,
      connections: topology.connections.filter(c => c.fromId !== id && c.toId !== id)
    };
    saveTopology(updated);
    setPendingDeleteNode(null);
  };

  const handleDeleteGroup = (id: string) => {
    const updated = {
      nodes: topology.nodes.map(n => n.groupId === id ? { ...n, groupId: undefined } : n),
      groups: topology.groups.filter(g => g.id !== id),
      connections: topology.connections.filter(c => c.fromId !== id && c.toId !== id)
    };
    saveTopology(updated);
    setPendingDeleteGroup(null);
  };

  const handleDeleteConnection = (id: string) => {
    const updated = {
      ...topology,
      connections: topology.connections.filter(c => c.id !== id)
    };
    saveTopology(updated);
  };

  // Interactive highlighting checks
  const highlightedConnectionIds = useMemo(() => {
    if (draggingConn || !hoveredNodeId) return new Set<string>();
    const ids = new Set<string>();
    const hoveredNode = topology.nodes.find(n => n.id === hoveredNodeId);
    const gId = hoveredNode?.groupId;

    topology.connections.forEach((conn) => {
      if (
        conn.fromId === hoveredNodeId ||
        conn.toId === hoveredNodeId ||
        (gId && (conn.fromId === gId || conn.toId === gId))
      ) {
        ids.add(conn.id);
      }
    });
    return ids;
  }, [hoveredNodeId, topology.connections, topology.nodes, draggingConn]);

  const highlightedNodeIds = useMemo(() => {
    if (draggingConn || !hoveredNodeId) return new Set<string>();
    const ids = new Set<string>([hoveredNodeId]);
    const hoveredNode = topology.nodes.find(n => n.id === hoveredNodeId);
    const gId = hoveredNode?.groupId;

    // If the node itself is in a group, we also highlight other nodes in that group
    if (gId) {
      topology.nodes.forEach(n => {
        if (n.groupId === gId) ids.add(n.id);
      });
    }

    topology.connections.forEach((conn) => {
      const isFromHovered = conn.fromId === hoveredNodeId || (gId && conn.fromId === gId);
      const isToHovered = conn.toId === hoveredNodeId || (gId && conn.toId === gId);

      if (isFromHovered) {
        ids.add(conn.toId);
        // If target is a group, add all nodes inside that group
        topology.nodes.forEach(n => {
          if (n.groupId === conn.toId) ids.add(n.id);
        });
      }
      if (isToHovered) {
        ids.add(conn.fromId);
        // If source is a group, add all nodes inside that group
        topology.nodes.forEach(n => {
          if (n.groupId === conn.fromId) ids.add(n.id);
        });
      }
    });
    return ids;
  }, [hoveredNodeId, topology.connections, topology.nodes, draggingConn]);

  // Search filter
  const isNodeMatchSearch = (n: NetworkNode) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      n.name.toLowerCase().includes(q) ||
      (n.ip && n.ip.toLowerCase().includes(q)) ||
      (n.ports && n.ports.some(p => p.toString().includes(q)))
    );
  };

  // Group items by category and optional group
  const getCategorized = (type: NetworkNode['type']) => {
    const columnNodes = topology.nodes.filter(n => n.type === type && isNodeMatchSearch(n));
    const columnGroups = topology.groups.filter(g => g.type === type);

    const grouped: Record<string, NetworkNode[]> = {};
    const ungrouped: NetworkNode[] = [];

    columnNodes.forEach(n => {
      if (n.groupId && columnGroups.some(g => g.id === n.groupId)) {
        if (!grouped[n.groupId]) grouped[n.groupId] = [];
        grouped[n.groupId].push(n);
      } else {
        ungrouped.push(n);
      }
    });

    return {
      groups: editMode ? columnGroups : columnGroups.filter(g => grouped[g.id] && grouped[g.id].length > 0),
      groupedNodes: grouped,
      ungroupedNodes: ungrouped
    };
  };

  // Helper to determine index of a column
  const getColumnIndex = (type: NetworkNode['type'] | undefined) => {
    switch (type) {
      case 'infra': return 0;
      case 'device': return 1;
      case 'netsvc': return 2;
      case 'stdsvc': return 3;
      default: return -1;
    }
  };

  const calculatePreviewD = () => {
    if (!draggingConn) return '';
    const fromCoord = coords[draggingConn.fromId];
    if (!fromCoord) return '';

    let x1 = fromCoord.x;
    let y1 = fromCoord.y;

    if (draggingConn.fromCorner === 'top') {
      x1 += fromCoord.width / 2;
    } else if (draggingConn.fromCorner === 'bottom') {
      x1 += fromCoord.width / 2;
      y1 += fromCoord.height;
    } else if (draggingConn.fromCorner === 'left') {
      y1 += fromCoord.height / 2;
    } else if (draggingConn.fromCorner === 'right') {
      x1 += fromCoord.width;
      y1 += fromCoord.height / 2;
    }

    let x2 = draggingConn.currentX;
    let y2 = draggingConn.currentY;
    let toPort = getClosestPort(x1, y1, x2, y2);

    if (dragOverId && coords[dragOverId]) {
      const toCoord = coords[dragOverId];
      toPort = getTargetClosestPort(dragOverId, x2, y2);
      if (toPort === 'top') {
        x2 = toCoord.x + toCoord.width / 2;
        y2 = toCoord.y;
      } else if (toPort === 'bottom') {
        x2 = toCoord.x + toCoord.width / 2;
        y2 = toCoord.y + toCoord.height;
      } else if (toPort === 'left') {
        x2 = toCoord.x;
        y2 = toCoord.y + toCoord.height / 2;
      } else if (toPort === 'right') {
        x2 = toCoord.x + toCoord.width;
        y2 = toCoord.y + toCoord.height / 2;
      }
    }

    return generateOrthogonalPath(
      x1,
      y1,
      draggingConn.fromCorner,
      x2,
      y2,
      toPort,
      false,
      0,
      gapCenterX,
      isMobileLayout,
      canvasSize.width
    );
  };

  // SVG lines renderer
  // SVG lines renderer
  const renderConnectionLines = (visualOnly: boolean) => {
    // Resolve ports for all connections first to count them per-port
    const resolvedConns = topology.connections.map(conn => {
      const fromNode = topology.nodes.find(n => n.id === conn.fromId);
      const fromGroup = topology.groups.find(g => g.id === conn.fromId);
      const fromType = fromNode?.type || fromGroup?.type;

      const toNode = topology.nodes.find(n => n.id === conn.toId);
      const toGroup = topology.groups.find(g => g.id === conn.toId);
      const toType = toNode?.type || toGroup?.type;

      const sameColumn = (
        ((fromType === 'infra' || fromType === 'netsvc' || fromType === 'device') && (toType === 'infra' || toType === 'netsvc' || toType === 'device')) ||
        (fromType === 'stdsvc' && toType === 'stdsvc')
      );

      const fromCoord = coords[conn.fromId];
      const toCoord = coords[conn.toId];

      let isVertical = false;
      if (isMobileLayout) {
        if (fromType !== toType) {
          const fromIdx = getColumnIndex(fromType);
          const toIdx = getColumnIndex(toType);
          const colDiff = Math.abs(fromIdx - toIdx);
          isVertical = colDiff === 1;
        } else if (fromCoord && toCoord) {
          isVertical = Math.abs(fromCoord.y - toCoord.y) > Math.abs(fromCoord.x - toCoord.x);
        }
      } else {
        if (fromCoord && toCoord) {
          isVertical = Math.abs(fromCoord.y - toCoord.y) > Math.abs(fromCoord.x - toCoord.x);
        } else {
          const isFromLeft = fromType === 'infra' || fromType === 'netsvc' || fromType === 'device';
          const isToLeft = toType === 'infra' || toType === 'netsvc' || toType === 'device';
          isVertical = isFromLeft === isToLeft;
        }
      }

      let fromPort = isMobileLayout ? 'auto' : (conn.fromPort || 'auto');
      let toPort = isMobileLayout ? 'auto' : (conn.toPort || 'auto');

      if (fromPort === 'auto' || toPort === 'auto') {
        // If one port is explicitly set and the other is auto, adapt the auto port
        const fromIsExplicit = fromPort !== 'auto';
        const toIsExplicit = toPort !== 'auto';

        if (fromIsExplicit && !toIsExplicit) {
          // Adapt toPort based on fromPort direction and relative position
          const fromIsVert = fromPort === 'top' || fromPort === 'bottom';
          if (fromIsVert) {
            // Source uses vertical port → target should also use vertical
            const goingDown = fromCoord && toCoord ? fromCoord.y < toCoord.y : (fromPort === 'bottom');
            toPort = goingDown ? 'top' : 'bottom';
          } else {
            // Source uses horizontal port → target should also use horizontal
            const goingRight = fromCoord && toCoord ? fromCoord.x < toCoord.x : (fromPort === 'right');
            toPort = goingRight ? 'left' : 'right';
          }
        } else if (toIsExplicit && !fromIsExplicit) {
          // Adapt fromPort based on toPort direction and relative position
          const toIsVert = toPort === 'top' || toPort === 'bottom';
          if (toIsVert) {
            const goingDown = fromCoord && toCoord ? fromCoord.y < toCoord.y : (toPort === 'top');
            fromPort = goingDown ? 'bottom' : 'top';
          } else {
            const goingRight = fromCoord && toCoord ? fromCoord.x < toCoord.x : (toPort === 'left');
            fromPort = goingRight ? 'right' : 'left';
          }
        } else {
          // Both are auto — use smart detection
          if (isMobileLayout && fromType !== toType) {
            const fromIdx = getColumnIndex(fromType);
            const toIdx = getColumnIndex(toType);
            const colDiff = Math.abs(fromIdx - toIdx);
            if (colDiff > 1) {
              // Non-adjacent on mobile: route through left/right margins deterministically
              let hash = 0;
              for (let i = 0; i < conn.id.length; i++) {
                hash = conn.id.charCodeAt(i) + ((hash << 5) - hash);
              }
              const useLeft = Math.abs(hash) % 2 === 0;
              fromPort = useLeft ? 'left' : 'right';
              toPort = useLeft ? 'left' : 'right';
            } else {
              // Adjacent columns: direct vertical
              const goingDown = fromIdx < toIdx;
              fromPort = goingDown ? 'bottom' : 'top';
              toPort = goingDown ? 'top' : 'bottom';
            }
          } else if (isVertical) {
            const goingDown = fromCoord && toCoord ? fromCoord.y < toCoord.y : true;
            fromPort = goingDown ? 'bottom' : 'top';
            toPort = goingDown ? 'top' : 'bottom';
          } else {
            // Horizontal routing
            let routeToRight = false;
            if (sameColumn && fromCoord && toCoord) {
              const isTargetLeftCol = toType === 'infra' || toType === 'netsvc';
              const sameColCoords = Object.entries(coords)
                .filter(([id]) => {
                  const node = topology.nodes.find(n => n.id === id);
                  const group = topology.groups.find(g => g.id === id);
                  const type = node?.type || group?.type;
                  const isNodeLeftCol = type === 'infra' || type === 'netsvc';
                  return isNodeLeftCol === isTargetLeftCol;
                })
                .map(([_, coord]) => coord);

              const colMinX = sameColCoords.length > 0 ? Math.min(...sameColCoords.map(c => c.x)) : 0;
              const colMaxX = sameColCoords.length > 0 ? Math.max(...sameColCoords.map(c => c.x + c.width)) : 1000;
              const colCenterX = (colMinX + colMaxX) / 2;

              const targetCenter = toCoord.x + toCoord.width / 2;
              if (isTargetLeftCol) {
                routeToRight = !(targetCenter < colCenterX);
              } else {
                routeToRight = targetCenter > colCenterX;
              }
            }

            let fromLeftToRight = true;
            if (fromCoord && toCoord) {
              fromLeftToRight = fromCoord.x < toCoord.x;
            }
            let leavesToRight = sameColumn ? routeToRight : fromLeftToRight;
            let entersFromLeft = sameColumn ? !routeToRight : fromLeftToRight;

            fromPort = leavesToRight ? 'right' : 'left';
            toPort = entersFromLeft ? 'left' : 'right';
          }
        }
      }

      return {
        conn,
        fromType,
        toType,
        sameColumn,
        isVertical,
        fromPort: fromPort as 'top' | 'bottom' | 'left' | 'right',
        toPort: toPort as 'top' | 'bottom' | 'left' | 'right',
        isFromGroup: !!fromGroup,
        isToGroup: !!toGroup,
        fromCoord,
        toCoord
      };
    }).filter(rc => rc.fromCoord && rc.toCoord);

    // gapCenterX is now computed at the component level to be shared with preview calculations



    // Group trunks to assign offsets dynamically
    const crossingConns: typeof resolvedConns = [];
    const leftVerticalConns: typeof resolvedConns = [];
    const rightVerticalConns: typeof resolvedConns = [];
    const mobileMarginConns: typeof resolvedConns = [];

    resolvedConns.forEach(rc => {
      if (isMobileLayout) {
        const fromIdx = getColumnIndex(rc.fromType);
        const toIdx = getColumnIndex(rc.toType);
        const colDiff = Math.abs(fromIdx - toIdx);
        if (colDiff > 1) {
          mobileMarginConns.push(rc);
        }
      } else {
        const isFromLeft = rc.fromType === 'infra' || rc.fromType === 'netsvc' || rc.fromType === 'device';
        const isToLeft = rc.toType === 'infra' || rc.toType === 'netsvc' || rc.toType === 'device';
        if (isFromLeft !== isToLeft) {
          crossingConns.push(rc);
        } else if (isFromLeft) {
          leftVerticalConns.push(rc);
        } else {
          rightVerticalConns.push(rc);
        }
      }
    });

    crossingConns.sort((a, b) => {
      const ay = (a.fromCoord!.y + a.fromCoord!.height / 2 + a.toCoord!.y + a.toCoord!.height / 2) / 2;
      const by = (b.fromCoord!.y + b.fromCoord!.height / 2 + b.toCoord!.y + b.toCoord!.height / 2) / 2;
      return ay - by;
    });

    leftVerticalConns.sort((a, b) => {
      const ax = (a.fromCoord!.x + a.fromCoord!.width / 2 + a.toCoord!.x + a.toCoord!.width / 2) / 2;
      const bx = (b.fromCoord!.x + b.fromCoord!.width / 2 + b.toCoord!.x + b.toCoord!.width / 2) / 2;
      return ax - bx;
    });

    rightVerticalConns.sort((a, b) => {
      const ax = (a.fromCoord!.x + a.fromCoord!.width / 2 + a.toCoord!.x + a.toCoord!.width / 2) / 2;
      const bx = (b.fromCoord!.x + b.fromCoord!.width / 2 + b.toCoord!.x + b.toCoord!.width / 2) / 2;
      return ax - bx;
    });

    mobileMarginConns.sort((a, b) => {
      const ay = (a.fromCoord!.y + a.fromCoord!.height / 2 + a.toCoord!.y + a.toCoord!.height / 2) / 2;
      const by = (b.fromCoord!.y + b.fromCoord!.height / 2 + b.toCoord!.y + b.toCoord!.height / 2) / 2;
      return ay - by;
    });

    const assignCrossingLanes = (conns: typeof resolvedConns) => {
      const offsets: Record<string, number> = {};
      if (conns.length === 0) return offsets;

      const sorted = [...conns].sort((a, b) => {
        const ay = Math.min(a.fromCoord!.y, a.toCoord!.y);
        const by = Math.min(b.fromCoord!.y, b.toCoord!.y);
        return ay - by;
      });

      const assignedLanes: Record<string, number> = {};

      sorted.forEach(c => {
        const dy = Math.abs(c.fromCoord!.y - c.toCoord!.y);
        const factor = Math.min(1, dy / 600);

        let preferredLane = 3;
        if (c.fromCoord!.x < gapCenterX) {
          preferredLane = Math.round(factor * 6);
        } else {
          preferredLane = Math.round((1 - factor) * 6);
        }

        const colliders = sorted.filter(other => {
          if (other.conn.id === c.conn.id) return false;
          if (assignedLanes[other.conn.id] === undefined) return false;

          const v_A = [Math.min(c.fromCoord!.y, c.toCoord!.y), Math.max(c.fromCoord!.y, c.toCoord!.y)];
          const v_B = [Math.min(other.fromCoord!.y, other.toCoord!.y), Math.max(other.fromCoord!.y, other.toCoord!.y)];

          return Math.max(v_A[0], v_B[0]) <= Math.min(v_A[1], v_B[1]) + 15;
        });

        const usedLanes = new Set(colliders.map(other => assignedLanes[other.conn.id]));

        let bestLane = -1;
        const searchOrder = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6];
        for (let offset of searchOrder) {
          const l = preferredLane + offset;
          if (l >= 0 && l <= 6 && !usedLanes.has(l)) {
            bestLane = l;
            break;
          }
        }

        if (bestLane === -1) {
          const laneCounts = [0, 0, 0, 0, 0, 0, 0];
          colliders.forEach(other => {
            const l = assignedLanes[other.conn.id];
            if (l >= 0 && l <= 6) {
              laneCounts[l]++;
            }
          });
          let minCount = Infinity;
          for (let i = 0; i < 7; i++) {
            if (laneCounts[i] < minCount) {
              minCount = laneCounts[i];
              bestLane = i;
            }
          }
        }

        assignedLanes[c.conn.id] = bestLane;
      });

      sorted.forEach(c => {
        const lane = assignedLanes[c.conn.id] ?? 3;
        offsets[c.conn.id] = -30 + lane * 10;
      });

      return offsets;
    };

    const assignOffsets = (conns: typeof resolvedConns, step: number) => {
      const offsets: Record<string, number> = {};
      if (conns.length === 0) return offsets;

      const sorted = [...conns].sort((a, b) => {
        const ay = Math.min(a.fromCoord!.y, a.toCoord!.y);
        const by = Math.min(b.fromCoord!.y, b.toCoord!.y);
        return ay - by;
      });

      const assignedColors: Record<string, number> = {};

      sorted.forEach(c => {
        const colliders = sorted.filter(other => {
          if (other.conn.id === c.conn.id) return false;
          if (assignedColors[other.conn.id] === undefined) return false;

          const v_A = [Math.min(c.fromCoord!.y, c.toCoord!.y), Math.max(c.fromCoord!.y, c.toCoord!.y)];
          const v_B = [Math.min(other.fromCoord!.y, other.toCoord!.y), Math.max(other.fromCoord!.y, other.toCoord!.y)];
          const h_A = [Math.min(c.fromCoord!.x, c.toCoord!.x), Math.max(c.fromCoord!.x, c.toCoord!.x)];
          const h_B = [Math.min(other.fromCoord!.x, other.toCoord!.x), Math.max(other.fromCoord!.x, other.toCoord!.x)];

          const v_overlap = Math.max(v_A[0], v_B[0]) <= Math.min(v_A[1], v_B[1]) + 15;
          const h_overlap = Math.max(h_A[0], h_B[0]) <= Math.min(h_A[1], h_B[1]) + 15;

          return v_overlap && h_overlap;
        });

        const colorCounts = [0, 0, 0];
        colliders.forEach(other => {
          const color = assignedColors[other.conn.id];
          if (color >= 0 && color < 3) {
            colorCounts[color]++;
          }
        });

        let bestColor = 1;
        if (colorCounts[1] === 0) {
          bestColor = 1;
        } else if (colorCounts[0] === 0) {
          bestColor = 0;
        } else if (colorCounts[2] === 0) {
          bestColor = 2;
        } else {
          let minCount = Infinity;
          const order = [1, 0, 2];
          order.forEach(col => {
            if (colorCounts[col] < minCount) {
              minCount = colorCounts[col];
              bestColor = col;
            }
          });
        }

        assignedColors[c.conn.id] = bestColor;
      });

      sorted.forEach(c => {
        const color = assignedColors[c.conn.id] ?? 1;
        offsets[c.conn.id] = (color - 1) * step;
      });

      return offsets;
    };

    const crossingOffsets = assignCrossingLanes(crossingConns);
    const leftVerticalOffsets = assignOffsets(leftVerticalConns, 12);
    const rightVerticalOffsets = assignOffsets(rightVerticalConns, 12);
    const mobileMarginOffsets = assignOffsets(mobileMarginConns, 8);

    const trunkOffsets: Record<string, number> = {
      ...crossingOffsets,
      ...leftVerticalOffsets,
      ...rightVerticalOffsets,
      ...mobileMarginOffsets
    };

    return resolvedConns.map((rc) => {
      const { conn, fromType, toType, sameColumn, isVertical, fromPort, toPort, isFromGroup, isToGroup, fromCoord, toCoord } = rc;

      let x1 = fromCoord.x + fromCoord.width / 2;
      let y1 = fromCoord.y + fromCoord.height / 2;
      let x2 = toCoord.x + toCoord.width / 2;
      let y2 = toCoord.y + toCoord.height / 2;

      // Apply anchors (centered on the port edges to merge paths into a single trunk bus)
      if (fromPort === 'top') {
        x1 = fromCoord.x + fromCoord.width / 2;
        y1 = fromCoord.y;
      } else if (fromPort === 'bottom') {
        x1 = fromCoord.x + fromCoord.width / 2;
        y1 = fromCoord.y + fromCoord.height;
      } else if (fromPort === 'left') {
        x1 = fromCoord.x;
        y1 = fromCoord.y + fromCoord.height / 2;
      } else if (fromPort === 'right') {
        x1 = fromCoord.x + fromCoord.width;
        y1 = fromCoord.y + fromCoord.height / 2;
      }

      if (toPort === 'top') {
        x2 = toCoord.x + toCoord.width / 2;
        y2 = toCoord.y;
      } else if (toPort === 'bottom') {
        x2 = toCoord.x + toCoord.width / 2;
        y2 = toCoord.y + toCoord.height;
      } else if (toPort === 'left') {
        x2 = toCoord.x;
        y2 = toCoord.y + toCoord.height / 2;
      } else if (toPort === 'right') {
        x2 = toCoord.x + toCoord.width;
        y2 = toCoord.y + toCoord.height / 2;
      }

      const trunkOffset = trunkOffsets[conn.id] || 0;
      const isBidirectional = conn.type === 'bidirectional';
      const pathData = generateOrthogonalPath(x1, y1, fromPort, x2, y2, toPort, isBidirectional, trunkOffset, gapCenterX, isMobileLayout, canvasSize.width);

      const isHighlighted = (hoveredNodeId ? highlightedConnectionIds.has(conn.id) : false) || (hoveredConnectionId === conn.id);
      const isDimmed = (hoveredNodeId || hoveredConnectionId) ? !isHighlighted : false;

      if (visualOnly) {
        const strokeStyle = isHighlighted
          ? { stroke: 'var(--nd-accent)', strokeWidth: '2.2' }
          : isDimmed
          ? { stroke: 'color-mix(in srgb, var(--nd-accent) 5%, transparent)', strokeWidth: '1' }
          : { stroke: 'color-mix(in srgb, var(--nd-text-muted) 45%, transparent)', strokeWidth: '1.5' };

        // Arrowhead calculations based on toPort
        let arrowD = '';
        if (toPort === 'top') {
          arrowD = `M ${x2} ${y2 - 2} L ${x2 - 4} ${y2 - 10} L ${x2 + 4} ${y2 - 10} Z`;
        } else if (toPort === 'bottom') {
          arrowD = `M ${x2} ${y2 + 2} L ${x2 - 4} ${y2 + 10} L ${x2 + 4} ${y2 + 10} Z`;
        } else if (toPort === 'left') {
          arrowD = `M ${x2 - 2} ${y2} L ${x2 - 10} ${y2 - 4} L ${x2 - 10} ${y2 + 4} Z`;
        } else if (toPort === 'right') {
          arrowD = `M ${x2 + 2} ${y2} L ${x2 + 10} ${y2 - 4} L ${x2 + 10} ${y2 + 4} Z`;
        }

        // Bidirectional source arrowhead
        let sourceArrowD = '';
        if (isBidirectional) {
          if (fromPort === 'top') {
            sourceArrowD = `M ${x1} ${y1 - 2} L ${x1 - 4} ${y1 - 10} L ${x1 + 4} ${y1 - 10} Z`;
          } else if (fromPort === 'bottom') {
            sourceArrowD = `M ${x1} ${y1 + 2} L ${x1 - 4} ${y1 + 10} L ${x1 + 4} ${y1 + 10} Z`;
          } else if (fromPort === 'left') {
            sourceArrowD = `M ${x1 - 2} ${y1} L ${x1 - 10} ${y1 - 4} L ${x1 - 10} ${y1 + 4} Z`;
          } else if (fromPort === 'right') {
            sourceArrowD = `M ${x1 + 2} ${y1} L ${x1 + 10} ${y1 - 4} L ${x1 + 10} ${y1 + 4} Z`;
          }
        }

        return (
          <g key={`visual-${conn.id}`}>
            {isHighlighted && (
              <path
                d={pathData}
                fill="none"
                stroke="var(--nd-accent-glow)"
                strokeWidth="4"
                style={{ opacity: 0.8, pointerEvents: 'none' }}
              />
            )}

            <path
              d={pathData}
              fill="none"
              style={{
                transition: 'stroke 0.2s, stroke-width 0.2s',
                pointerEvents: 'none',
                ...strokeStyle
              }}
              className={isHighlighted ? 'nd-topology-conn-flow' : ''}
            />

            {!isDimmed && (
              <path
                d={arrowD}
                fill={isHighlighted ? 'var(--nd-accent)' : 'color-mix(in srgb, var(--nd-text-muted) 35%, transparent)'}
                style={{
                  transition: 'fill 0.2s',
                  pointerEvents: 'none'
                }}
              />
            )}

            {!isDimmed && sourceArrowD && (
              <path
                d={sourceArrowD}
                fill={isHighlighted ? 'var(--nd-accent)' : 'color-mix(in srgb, var(--nd-text-muted) 35%, transparent)'}
                style={{
                  transition: 'fill 0.2s',
                  pointerEvents: 'none'
                }}
              />
            )}
          </g>
        );
      } else {
        // Interaction only (Invisible, thick path on top)
        return (
          <path
            key={`interact-${conn.id}`}
            d={pathData}
            fill="none"
            stroke="transparent"
            strokeWidth="12"
            style={{
              cursor: 'pointer',
              pointerEvents: 'stroke'
            }}
            onMouseEnter={() => setHoveredConnectionId(conn.id)}
            onMouseLeave={() => setHoveredConnectionId(null)}
            onClick={(e) => {
              e.stopPropagation();
              setEditingConnection(conn);
              setLinkFrom(conn.fromId);
              setLinkTo(conn.toId);
              setLinkLabel(conn.label || '');
              setLinkDir(conn.type || 'directional');
              setLinkFromPort(conn.fromPort || 'auto');
              setLinkToPort(conn.toPort || 'auto');
            }}
          />
        );
      }
    });
  };

  // Node Component Renderer
  const renderNodeCard = (n: NetworkNode) => {
    const isHighlighted = (hoveredNodeId ? highlightedNodeIds.has(n.id) : false) ||
      (dragOverId === n.id) ||
      (hoveredConnectionId ? (() => {
        const conn = topology.connections.find(c => c.id === hoveredConnectionId);
        if (!conn) return false;
        return conn.fromId === n.id || conn.toId === n.id ||
               (n.groupId && (conn.fromId === n.groupId || conn.toId === n.groupId));
      })() : false);
    const isDimmed = (hoveredNodeId || hoveredConnectionId) ? !isHighlighted : false;

    // Resolve sizing and aesthetics
    const size = (() => {
      if (cardSizeSetting !== 'auto') return cardSizeSetting as 'standard' | 'compact' | 'mini';
      const count = topology.nodes.filter(node => node.type === n.type).length;
      if (count <= 4) return 'standard';
      if (count <= 12) return 'compact';
      return 'mini';
    })();

    const typeColors = {
      infra: 'var(--nd-accent)',
      device: '#9b5de5', // Professional violet
      netsvc: '#f15bb5', // Professional magenta/orange
      stdsvc: 'rgba(255, 255, 255, 0.15)' // Semi-transparent clean gray
    };

    const borderColor = isHighlighted
      ? 'var(--nd-accent)'
      : 'var(--nd-card-border)';

    const borderLeftColor = isHighlighted
      ? 'var(--nd-accent)'
      : typeColors[n.type];

    const baseStyles: React.CSSProperties = {
      background: isHighlighted
        ? 'color-mix(in srgb, var(--nd-bg-surface) 75%, transparent)'
        : 'color-mix(in srgb, var(--nd-bg-surface) 40%, transparent)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      border: `1px solid ${borderColor}`,
      borderLeft: `3px solid ${borderLeftColor}`,
      borderRadius: 'calc(var(--nd-card-radius) * 0.4)',
      boxShadow: 'none',
      display: 'flex',
      alignItems: 'center',
      position: 'relative',
      zIndex: 3,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      width: '100%',
      boxSizing: 'border-box',
      pointerEvents: 'auto',
      flexDirection: 'row'
    };

    let height = 60;
    let padding = '8px 14px';
    let gap = 10;
    let iconSize = '1.15rem';
    let nameFontSize = '0.68rem';
    let ipFontSize = '0.54rem';

    if (size === 'mini') {
      height = 36;
      padding = '4px 10px';
      gap = 6;
      iconSize = '0.85rem';
      nameFontSize = '0.62rem';
    } else if (size === 'compact') {
      height = 48;
      padding = '6px 12px';
      gap = 8;
      iconSize = '1.02rem';
      nameFontSize = '0.65rem';
      ipFontSize = '0.5rem';
    }

    const cardStyles = {
      ...baseStyles,
      height,
      padding,
      gap
    };

    return (
      <div
        key={n.id}
        id={`node-card-${n.id}`}
        data-node-id={n.id}
        className={`nd-topology-node ${isDimmed ? 'nd-topology-node--dimmed' : ''} ${isHighlighted ? 'nd-topology-node--highlighted' : ''}`}
        onMouseEnter={() => setHoveredNodeId(n.id)}
        onMouseLeave={() => setHoveredNodeId(null)}
        onClick={(e) => {
          if (editMode) {
            e.stopPropagation();
            setEditingNode(n);
            setNodeName(n.name);
            setNodeType(n.type);
            setNodeIcon(n.icon);
            setNodeIp(n.ip || '');
            setNodePorts(n.ports ? n.ports.join(', ') : '');
            setNodeGroupId(n.groupId || '');
            setLinkedDeviceId(n.linkedDeviceId || '');
            setLinkedServiceId(n.linkedServiceId || '');
          }
        }}
        style={cardStyles}
      >
        <span style={{ fontSize: iconSize, flexShrink: 0, lineHeight: 1, display: 'flex', alignItems: 'center' }}><Emoji emoji={n.icon} /></span>
        <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', justifyContent: 'center' }}>
          <div
            style={{
              fontSize: nameFontSize,
              fontWeight: 700,
              color: 'var(--nd-text)',
              width: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: 1.2
            }}
            title={n.name}
          >
            {n.name}
          </div>
          {size !== 'mini' && showSensitive && n.ip ? (
            <div
              style={{
                fontSize: ipFontSize,
                color: 'var(--nd-text-muted)',
                fontFamily: 'monospace',
                width: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginTop: 1,
                lineHeight: 1
              }}
              title={`${n.ip}${n.ports && n.ports.length > 0 ? `:${n.ports[0]}` : ''}`}
            >
              {n.ip}
            </div>
          ) : null}
        </div>

        {editMode && (
          <>
            <TopologyAnchor nodeId={n.id} corner="top" isParentHovered={hoveredNodeId === n.id} onDragStart={handleDragStart} />
            <TopologyAnchor nodeId={n.id} corner="right" isParentHovered={hoveredNodeId === n.id} onDragStart={handleDragStart} />
            <TopologyAnchor nodeId={n.id} corner="bottom" isParentHovered={hoveredNodeId === n.id} onDragStart={handleDragStart} />
            <TopologyAnchor nodeId={n.id} corner="left" isParentHovered={hoveredNodeId === n.id} onDragStart={handleDragStart} />
          </>
        )}
      </div>
    );
  };

  const renderGroup = (g: NetworkGroup, groupedNodes: Record<string, NetworkNode[]>) => {
    const isGroupHighlighted = (hoveredNodeId ? (
      topology.nodes.find(n => n.id === hoveredNodeId)?.groupId === g.id ||
      highlightedNodeIds.has(g.id)
    ) : false) || (dragOverId === g.id) || (hoveredConnectionId ? (
      topology.connections.find(c => c.id === hoveredConnectionId)?.fromId === g.id ||
      topology.connections.find(c => c.id === hoveredConnectionId)?.toId === g.id
    ) : false);
    const isGroupDimmed = (hoveredNodeId || hoveredConnectionId) ? !isGroupHighlighted : false;

    return (
      <div
        key={g.id}
        id={`group-box-${g.id}`}
        data-group-id={g.id}
        onMouseEnter={() => setHoveredGroupId(g.id)}
        onMouseLeave={() => setHoveredGroupId(null)}
        onClick={(e) => {
          if (editMode) {
            setEditingGroup(g);
            setGroupName(g.name);
            setGroupType(g.type);
            setSelectedNodeIds(topology.nodes.filter(n => n.groupId === g.id).map(n => n.id));
            setMergeIncomingLinks(false);
          }
        }}
        style={{
          border: isGroupHighlighted
            ? '1px solid var(--nd-accent)'
            : '1px dashed rgba(255,255,255,0.15)',
          borderRadius: 'var(--nd-card-radius)',
          background: isGroupHighlighted
            ? 'var(--nd-accent-glow)'
            : 'rgba(0,0,0,0.1)',
          padding: '14px 12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          position: 'relative',
          transition: 'all 0.25s ease',
          opacity: isGroupDimmed ? 0.15 : 1,
          pointerEvents: isGroupDimmed ? 'none' : 'auto',
          boxShadow: 'none',
          cursor: editMode ? 'pointer' : 'default'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: 16
          }}
        >
          <span
            style={{
              fontSize: '0.62rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: isGroupHighlighted ? 'var(--nd-accent)' : 'var(--nd-text-muted)',
              borderBottom: editMode ? '1px dashed rgba(255, 255, 255, 0.25)' : 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              transition: 'color 0.25s ease'
            }}
            title={editMode ? t("Cliquer pour modifier/supprimer le groupe") : undefined}
          >
            {g.name}
            {editMode && <Edit3 size={8} style={{ opacity: 0.6 }} />}
          </span>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(125px, 1fr))',
          gap: 10,
          width: '100%',
          minHeight: (groupedNodes[g.id] && groupedNodes[g.id].length > 0) ? 0 : 36,
          pointerEvents: 'auto'
        }}>
          {groupedNodes[g.id]?.map(n => renderNodeCard(n))}
          {(!groupedNodes[g.id] || groupedNodes[g.id].length === 0) && (
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <span style={{ fontSize: '0.58rem', color: 'var(--nd-text-dimmed)', fontStyle: 'italic' }}>
                {t("Groupe vide")}
              </span>
            </div>
          )}
        </div>

        {editMode && (
          <>
            <TopologyAnchor nodeId={g.id} corner="top" isParentHovered={hoveredGroupId === g.id} onDragStart={handleDragStart} />
            <TopologyAnchor nodeId={g.id} corner="right" isParentHovered={hoveredGroupId === g.id} onDragStart={handleDragStart} />
            <TopologyAnchor nodeId={g.id} corner="bottom" isParentHovered={hoveredGroupId === g.id} onDragStart={handleDragStart} />
            <TopologyAnchor nodeId={g.id} corner="left" isParentHovered={hoveredGroupId === g.id} onDragStart={handleDragStart} />
          </>
        )}
      </div>
    );
  };

  const renderColumn = (colType: 'infra' | 'device' | 'netsvc' | 'stdsvc') => {
    const colInfo = {
      infra: { title: t('Infrastructure'), desc: t('Box, switchs, routeurs') },
      device: { title: t("Machines / Hôtes"), desc: t('Serveurs, NAS, hyperviseurs') },
      netsvc: { title: t("Services Réseau"), desc: t('DNS, AdBlock, VPN, tunnels') },
      stdsvc: { title: t('Applications'), desc: t('Jellyfin, Nextcloud, etc.') }
    }[colType];

    const categorized = getCategorized(colType);

    return (
      <div
        key={colType}
        className="nd-topology-col"
        style={{
          flex: 1,
          minWidth: 200,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          pointerEvents: 'none'
        }}
      >
        {/* Column Header */}
        <div style={{
          borderBottom: '1px solid var(--nd-card-border)',
          paddingBottom: 6,
          marginBottom: 4,
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'baseline',
          gap: 6
        }}>
          <h4 style={{ margin: 0, fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--nd-text)', flexShrink: 0 }}>
            {colInfo.title}
          </h4>
          <span style={{ fontSize: '0.58rem', color: 'var(--nd-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            ({colInfo.desc})
          </span>
        </div>

        {/* Grouped items */}
        {categorized.groups.length > 0 && (
          colType === 'stdsvc' ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobileLayout ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
              width: '100%',
              pointerEvents: 'none'
            }}>
              {categorized.groups.map(g => renderGroup(g, categorized.groupedNodes))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', pointerEvents: 'none' }}>
              {categorized.groups.map(g => renderGroup(g, categorized.groupedNodes))}
            </div>
          )
        )}

        {/* Ungrouped items */}
        {categorized.ungroupedNodes.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(125px, 1fr))',
            gap: 12,
            width: '100%',
            pointerEvents: 'auto'
          }}>
            {categorized.ungroupedNodes.map(n => renderNodeCard(n))}
          </div>
        )}

        {/* Column Empty State */}
        {categorized.groups.length === 0 && categorized.ungroupedNodes.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80, border: '1px dashed var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', background: 'rgba(255,255,255,0.01)', pointerEvents: 'auto', position: 'relative' }}>
            <span style={{ fontSize: '0.62rem', color: 'var(--nd-text-dimmed)' }}>Vide</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>

      {/* Empty state importer trigger */}
      {topology.nodes.length === 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0 4px', marginBottom: 12 }}>
          <button
            className="nd-btn"
            onClick={() => {
              setAutoImportGroupCategories(true);
              setShowAutoImportModal(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              fontSize: '0.72rem',
              borderColor: 'var(--nd-accent)',
              background: 'var(--nd-accent-glow)',
              color: 'var(--nd-accent)',
              fontWeight: 700
            }}
          >
            <Sparkles size={13} />
            <span>{t("Générer la carte automatiquement")}</span>
          </button>
        </div>
      )}

      {/* Main Map Canvas */}
      <div
        ref={containerRef}
        className="nd-topology-canvas"
        style={{
          position: 'relative',
          flex: 1,
          minHeight: config?.demoMode === true ? 'clamp(560px, 72vh, 760px)' : 400,
          overflowY: 'auto'
        }}
      >
        <div
          ref={innerRef}
          className={`nd-topology-canvas-inner ${editMode ? 'nd-topology-canvas--editing' : ''}`}
          style={{
            position: 'relative',
            width: '100%',
            minHeight: '100%',
            padding: isMobileLayout ? '24px 36px' : '24px 20px',
            paddingBottom: isMobileLayout ? 60 : 48,
            display: 'grid',
            gridTemplateColumns: isMobileLayout ? '1fr' : '1.2fr 2.8fr',
            gap: isMobileLayout ? '36px' : '24px 110px',
            boxSizing: 'border-box',
            zIndex: 1
          }}
        >
          {/* Dynamic connection lines overlay */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: -1
            }}
          >
            <defs>
              <linearGradient id="conn-grad-default" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--nd-accent)" stopOpacity="0.45" />
                <stop offset="100%" stopColor="var(--nd-purple)" stopOpacity="0.35" />
              </linearGradient>
              <linearGradient id="conn-grad-highlight" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--nd-accent)" stopOpacity="0.95" />
                <stop offset="100%" stopColor="var(--nd-purple)" stopOpacity="0.85" />
              </linearGradient>
            </defs>

            {renderConnectionLines(true)}

            {/* Connection drag preview line */}
            {draggingConn && (
              <path
                d={calculatePreviewD()}
                fill="none"
                stroke="var(--nd-accent)"
                strokeWidth="2"
                className="nd-connection-preview"
              />
            )}
          </svg>

          {/* Left Main Column: Infrastructure, Machines, and Network Services */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 48, pointerEvents: 'none' }}>
            {renderColumn('infra')}
            {renderColumn('device')}
            {renderColumn('netsvc')}
          </div>

          {/* Right Main Column: Applications */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 48, pointerEvents: 'none' }}>
            {renderColumn('stdsvc')}
          </div>

          {/* Interaction/Click targets (On top) */}
          {editMode && (
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 2
              }}
            >
              {renderConnectionLines(false)}
            </svg>
          )}
        </div>
      </div>

      {/* ======================================================================
          FORM MODAL: ADD / EDIT NODE
         ====================================================================== */}
      {(showAddNode || editingNode) && mounted && typeof document !== 'undefined' && createPortal(
        <div className="nd-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && (editingNode ? setEditingNode(null) : setShowAddNode(false))}>
          <div ref={nodeDialogRef} role="dialog" aria-modal="true" aria-label={editingNode ? t("Modifier le nœud") : t("Ajouter un nœud topologique")} tabIndex={-1} className="nd-modal" style={{ maxWidth: 420, overflow: 'visible' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              {editingNode ? <Edit3 size={16} /> : <Plus size={16} />}
              <span>{editingNode ? t("Modifier le nœud") : t("Ajouter un nœud topologique")}</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label className="nd-label">{t("Nom du Nœud")}</label>
                  <input
                    className="nd-input"
                    style={{ width: '100%', height: 38, boxSizing: 'border-box' }}
                    value={nodeName}
                    onChange={e => setNodeName(e.target.value)}
                    placeholder={t("Ex: Proxmox Hypervisor, DNS local...")}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <label className="nd-label" style={{ whiteSpace: 'nowrap', margin: 0, marginBottom: 6 }}>{t("Icône")}</label>
                  <button
                    onClick={() => setShowIconPicker(true)}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: '10px',
                      border: '1px solid var(--nd-card-border)',
                      background: 'var(--nd-subcard-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '1.2rem',
                      color: 'var(--nd-text)',
                      transition: 'all 0.2s',
                      outline: 'none',
                      padding: 0,
                      boxSizing: 'border-box'
                    }}
                    className="nd-btn-hover-glow"
                    type="button"
                    title={t("Choisir une icône")}
                  >
                    <Emoji emoji={nodeIcon || '📦'} />
                  </button>
                </div>
              </div>

              <div>
                <label className="nd-label">{t("Type / Catégorie")}</label>
                <CustomSelect
                  value={nodeType}
                  onChange={(val) => setNodeType(val as any)}
                  options={[
                    { value: 'infra', label: t('Infrastructure') },
                    { value: 'device', label: t("Machines / Hôtes") },
                    { value: 'netsvc', label: t("Services Réseau") },
                    { value: 'stdsvc', label: t('Applications') }
                  ]}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 8 }}>
                <div>
                  <label className="nd-label">{t("Adresse IP")}</label>
                  <input className="nd-input" value={nodeIp} onChange={e => setNodeIp(e.target.value)} placeholder={t("Ex: 192.168.1.100")} />
                </div>
                <div>
                  <label className="nd-label">{t("Port(s) (sép. virgule)")}</label>
                  <input className="nd-input" value={nodePorts} onChange={e => setNodePorts(e.target.value)} placeholder={t("Ex: 80, 443")} />
                </div>
              </div>

              <div>
                <label className="nd-label">{t("Associer à un groupe (sous-catégorie)")}</label>
                <CustomSelect
                  value={nodeGroupId}
                  onChange={setNodeGroupId}
                  options={[
                    { value: '', label: t("-- Aucun groupe --") },
                    ...topology.groups.filter(g => g.type === nodeType).map(g => ({ value: g.id, label: g.name }))
                  ]}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, borderTop: '1px solid var(--nd-card-border)', paddingTop: 10 }}>
                <div>
                  <label className="nd-label">{t("Lier Appareil NasDash")}</label>
                  <CustomSelect
                    value={linkedDeviceId}
                    onChange={(val) => {
                      setLinkedDeviceId(val);
                      const dev = config?.devices?.find(d => d.id === val);
                      if (dev) {
                        setNodeName(dev.name);
                        setNodeIcon(dev.icon || '🖥️');
                        setNodeIp(dev.api?.ip || dev.host || '');
                        setNodeType('device');
                      }
                    }}
                    options={[
                      { value: '', label: t("-- Aucun --") },
                      ...(config?.devices || []).map(d => ({ value: d.id, label: d.name }))
                    ]}
                  />
                </div>
                <div>
                  <label className="nd-label">{t("Lier Service NasDash")}</label>
                  <CustomSelect
                    value={linkedServiceId}
                    onChange={(val) => {
                      setLinkedServiceId(val);
                      const svc = config?.categories.flatMap(c => c.services).find(s => s.id === val);
                      if (svc) {
                        setNodeName(svc.name);
                        setNodeIcon('📦');
                        setNodeType('stdsvc');
                        if (svc.localUrl) {
                          try {
                            const u = new URL(svc.localUrl.startsWith('http') ? svc.localUrl : `http://${svc.localUrl}`);
                            setNodeIp(u.hostname);
                            if (u.port) setNodePorts(u.port);
                          } catch(err) {}
                        }
                      }
                    }}
                    options={[
                      { value: '', label: t("-- Aucun --") },
                      ...config?.categories.flatMap(c => c.services).map(s => ({ value: s.id, label: s.name })) || []
                    ]}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                {editingNode && (
                  <button
                    className="nd-btn"
                    style={{ background: 'var(--nd-red)', color: '#fff', borderColor: 'var(--nd-red)', marginRight: 'auto' }}
                    onClick={() => {
                      setPendingDeleteNode(editingNode);
                      setEditingNode(null);
                    }}
                  >
                    Supprimer
                  </button>
                )}
                <button className="nd-btn" onClick={() => editingNode ? setEditingNode(null) : setShowAddNode(false)}>Annuler</button>
                <button className="nd-btn nd-btn-accent" onClick={handleCreateNode}>{editingNode ? 'Enregistrer' : 'Ajouter'}</button>
              </div>

            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ======================================================================
          FORM MODAL: ADD / EDIT GROUP
         ====================================================================== */}
      {(showAddGroup || editingGroup) && mounted && typeof document !== 'undefined' && createPortal(
        <div className="nd-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && (editingGroup ? setEditingGroup(null) : setShowAddGroup(false))}>
          <div ref={groupDialogRef} role="dialog" aria-modal="true" aria-label={editingGroup ? t("Modifier le groupe") : t("Créer un groupe de nœuds")} tabIndex={-1} className="nd-modal" style={{ maxWidth: 360, overflow: 'visible' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 16 }}>
              {editingGroup ? t("Modifier le groupe") : t("Créer un groupe de nœuds")}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="nd-label">{t("Nom du groupe")}</label>
                <input className="nd-input" value={groupName} onChange={e => setGroupName(e.target.value)} placeholder={t("Ex: Grappe PVE, Cluster Docker...")} />
              </div>
              <div>
                <label className="nd-label">{t("Colonne / Catégorie cible")}</label>
                <CustomSelect
                  value={groupType}
                  onChange={(val) => {
                    setGroupType(val as any);
                    setSelectedNodeIds([]); // Reset selections if group category changes
                  }}
                  options={[
                    { value: 'infra', label: t('Infrastructure') },
                    { value: 'device', label: t("Machines / Hôtes") },
                    { value: 'netsvc', label: t("Services Réseau") },
                    { value: 'stdsvc', label: t('Applications') }
                  ]}
                />
              </div>

              <div>
                <label className="nd-label">{t("Nœuds à inclure dans ce groupe")}</label>
                <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)', padding: 6, display: 'flex', flexDirection: 'column', gap: 4, background: 'rgba(0,0,0,0.15)' }}>
                  {topology.nodes.filter(n => n.type === groupType).length === 0 ? (
                    <div style={{ fontSize: '0.65rem', color: 'var(--nd-text-dimmed)', padding: '8px 4px', textAlign: 'center' }}>
                      {t("Aucun nœud dans cette catégorie")}
                    </div>
                  ) : (
                    topology.nodes.filter(n => n.type === groupType).map(n => {
                      const isSelected = selectedNodeIds.includes(n.id);
                      return (
                        <div
                          key={n.id}
                          onClick={() => {
                            setSelectedNodeIds(prev =>
                              prev.includes(n.id) ? prev.filter(id => id !== n.id) : [...prev, n.id]
                            );
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 8px',
                            borderRadius: 'calc(var(--nd-card-radius) * 0.3)',
                            background: isSelected ? 'var(--nd-accent-glow)' : 'transparent',
                            border: `1px solid ${isSelected ? 'var(--nd-accent)' : 'transparent'}`,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{
                            width: 14,
                            height: 14,
                            borderRadius: 3,
                            border: '1px solid var(--nd-text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: isSelected ? 'var(--nd-accent)' : 'transparent',
                            borderColor: isSelected ? 'var(--nd-accent)' : 'var(--nd-card-border)',
                            color: '#fff',
                            fontSize: '8px'
                          }}>
                            {isSelected && <Check size={10} strokeWidth={3} />}
                          </div>
                          <span style={{ fontSize: '1rem', lineHeight: 1, display: 'flex', alignItems: 'center' }}><Emoji emoji={n.icon} /></span>
                          <span style={{ fontSize: '0.68rem', color: isSelected ? 'var(--nd-text)' : 'var(--nd-text-dimmed)', fontWeight: isSelected ? 600 : 400 }}>
                            {n.name}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {selectedNodeIds.length > 0 && (
                <div
                  onClick={() => setMergeIncomingLinks(!mergeIncomingLinks)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    padding: '8px 10px',
                    borderRadius: 'var(--nd-card-radius)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--nd-card-border)',
                    transition: 'all 0.2s ease',
                    marginTop: 4
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--nd-accent)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--nd-card-border)'}
                >
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 3,
                      border: '1px solid var(--nd-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: mergeIncomingLinks ? 'var(--nd-accent)' : 'transparent',
                      borderColor: mergeIncomingLinks ? 'var(--nd-accent)' : 'var(--nd-card-border)',
                      color: '#fff',
                      fontSize: '8px',
                      flexShrink: 0
                    }}
                  >
                    {mergeIncomingLinks && <Check size={10} strokeWidth={3} />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--nd-text)' }}>
                      {t("Consolider les liaisons entrantes vers le groupe")}
                    </span>
                    <span style={{ fontSize: '0.58rem', color: 'var(--nd-text-muted)', lineHeight: 1.2 }}>
                      {t("Redirige les connexions arrivant sur les éléments de ce groupe vers le groupe lui-même en les fusionnant (ex: ports multiples).")}
                    </span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                {editingGroup && (
                  <button
                    className="nd-btn"
                    style={{ background: 'var(--nd-red)', color: '#fff', borderColor: 'var(--nd-red)', marginRight: 'auto' }}
                    onClick={() => {
                      setPendingDeleteGroup(editingGroup);
                      setEditingGroup(null);
                    }}
                  >
                    Supprimer
                  </button>
                )}
                <button className="nd-btn" onClick={() => editingGroup ? setEditingGroup(null) : setShowAddGroup(false)}>Annuler</button>
                <button className="nd-btn nd-btn-accent" onClick={handleCreateGroup}>{editingGroup ? 'Enregistrer' : t("Créer")}</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ======================================================================
          FORM MODAL: ADD / EDIT CONNECTION (LIAISON)
         ====================================================================== */}
      {(showAddLink || editingConnection) && mounted && typeof document !== 'undefined' && createPortal(
        <div className="nd-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && (editingConnection ? setEditingConnection(null) : setShowAddLink(false))}>
          <div ref={connectionDialogRef} role="dialog" aria-modal="true" aria-label={editingConnection ? t("Modifier la liaison") : t("Nouvelle liaison réseau")} tabIndex={-1} className="nd-modal" style={{ maxWidth: 460, overflow: 'visible' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ArrowRight size={16} style={{ color: 'var(--nd-accent)' }} />
              <span>{editingConnection ? t("Modifier la liaison") : t("Nouvelle liaison réseau")}</span>
            </h3>

            {/* Visual flow indicator */}
            {(linkFrom || linkTo) && (() => {
              const fromNode = topology.nodes.find(n => n.id === linkFrom);
              const fromGroup = topology.groups.find(g => g.id === linkFrom);
              const toNode = topology.nodes.find(n => n.id === linkTo);
              const toGroup = topology.groups.find(g => g.id === linkTo);
              const fromLabel = fromNode?.name || fromGroup?.name;
              const fromIcon = fromNode?.icon || '📦';
              const toLabel = toNode?.name || toGroup?.name;
              const toIcon = toNode?.icon || '📦';

              return (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  padding: '10px 14px',
                  marginBottom: 16,
                  borderRadius: 'calc(var(--nd-card-radius) * 0.5)',
                  background: 'rgba(255, 255, 255, 0.025)',
                  border: '1px solid var(--nd-card-border)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
                    {fromLabel ? (
                      <>
                        <span style={{ fontSize: '1rem', flexShrink: 0, display: 'flex', alignItems: 'center' }}><Emoji emoji={fromIcon} /></span>
                        <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--nd-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fromLabel}</span>
                      </>
                    ) : (
                      <span style={{ fontSize: '0.6', color: 'var(--nd-text-dimmed)', fontStyle: 'italic' }}>{t("Source ?")}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, color: 'var(--nd-accent)' }}>
                    <div style={{ width: 18, height: 1, background: 'var(--nd-accent)', opacity: 0.6 }} />
                    {linkDir === 'bidirectional' ? (
                      <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>↔</span>
                    ) : (
                      <ArrowRight size={13} strokeWidth={2.5} />
                    )}
                    <div style={{ width: 18, height: 1, background: 'var(--nd-accent)', opacity: 0.6 }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                    {toLabel ? (
                      <>
                        <span style={{ fontSize: '1rem', flexShrink: 0, display: 'flex', alignItems: 'center' }}><Emoji emoji={toIcon} /></span>
                        <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--nd-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{toLabel}</span>
                      </>
                    ) : (
                      <span style={{ fontSize: '0.6rem', color: 'var(--nd-text-dimmed)', fontStyle: 'italic' }}>{t("Cible ?")}</span>
                    )}
                  </div>
                </div>
              );
            })()}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Source & Target */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="nd-label">{t("Source (Départ)")}</label>
                  <CustomSelect
                    value={linkFrom}
                    onChange={setLinkFrom}
                    disabled={!!editingConnection}
                    options={[
                      { value: '', label: t("-- Sélectionner --") },
                      ...topology.nodes.map(n => ({ value: n.id, label: `${n.icon} ${n.name}` })),
                      ...topology.groups.map(g => ({ value: g.id, label: `📦 ${g.name}` }))
                    ]}
                  />
                </div>
                <div>
                  <label className="nd-label">{t("Cible (Arrivée)")}</label>
                  <CustomSelect
                    value={linkTo}
                    onChange={setLinkTo}
                    disabled={!!editingConnection}
                    options={[
                      { value: '', label: t("-- Sélectionner --") },
                      ...topology.nodes.filter(n => n.id !== linkFrom).map(n => ({ value: n.id, label: `${n.icon} ${n.name}` })),
                      ...topology.groups.filter(g => g.id !== linkFrom).map(g => ({ value: g.id, label: `📦 ${g.name}` }))
                    ]}
                  />
                </div>
              </div>

              {/* Label & Direction */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="nd-label">{t("Libellé (optionnel)")}</label>
                  <input
                    className="nd-input"
                    style={{ height: 38, boxSizing: 'border-box' }}
                    value={linkLabel}
                    onChange={e => setLinkLabel(e.target.value)}
                    placeholder={t("Ex: 443, HTTP, Tunnel...")}
                  />
                </div>
                <div>
                  <label className="nd-label">{t("Type de flux")}</label>
                  <CustomSelect
                    value={linkDir}
                    onChange={(val) => setLinkDir(val as any)}
                    options={[
                      { value: 'directional', label: t("Directionnel →") },
                      { value: 'bidirectional', label: t("Bidirectionnel ↔") }
                    ]}
                  />
                </div>
              </div>

              {/* Port attachment points */}
              <div style={{
                borderTop: '1px solid var(--nd-card-border)',
                paddingTop: 12,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12
              }}>
                <div>
                  <label className="nd-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {t("Point d'attache source")}
                  </label>
                  <CustomSelect
                    value={linkFromPort}
                    onChange={(val) => setLinkFromPort(val as any)}
                    options={[
                      { value: 'auto', label: 'Auto' },
                      { value: 'top', label: t("↑ Haut") },
                      { value: 'right', label: t("→ Droite") },
                      { value: 'bottom', label: t("↓ Bas") },
                      { value: 'left', label: t("← Gauche") }
                    ]}
                  />
                </div>
                <div>
                  <label className="nd-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {t("Point d'attache cible")}
                  </label>
                  <CustomSelect
                    value={linkToPort}
                    onChange={(val) => setLinkToPort(val as any)}
                    options={[
                      { value: 'auto', label: 'Auto' },
                      { value: 'top', label: t("↑ Haut") },
                      { value: 'right', label: t("→ Droite") },
                      { value: 'bottom', label: t("↓ Bas") },
                      { value: 'left', label: t("← Gauche") }
                    ]}
                  />
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4, borderTop: '1px solid var(--nd-card-border)', paddingTop: 14 }}>
                {editingConnection && (
                  <button
                    className="nd-btn"
                    style={{ background: 'var(--nd-red)', color: '#fff', borderColor: 'var(--nd-red)', marginRight: 'auto' }}
                    onClick={() => {
                      handleDeleteConnection(editingConnection.id);
                      setEditingConnection(null);
                    }}
                  >
                    Supprimer
                  </button>
                )}
                <button
                  className="nd-btn"
                  onClick={() => {
                    if (editingConnection) setEditingConnection(null);
                    else setShowAddLink(false);
                    setLinkFrom('');
                    setLinkTo('');
                    setLinkLabel('');
                    setLinkDir('directional');
                    setLinkFromPort('auto');
                    setLinkToPort('auto');
                  }}
                >
                  Annuler
                </button>
                <button
                  className="nd-btn nd-btn-accent"
                  onClick={handleCreateLink}
                  disabled={!linkFrom || !linkTo}
                >
                  {editingConnection ? 'Enregistrer' : t("Créer la liaison")}
                </button>
              </div>

            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ======================================================================
          CONFIRM MODALS: DELETIONS
         ====================================================================== */}
      {pendingDeleteNode && (
        <ConfirmModal
          isOpen={!!pendingDeleteNode}
          onClose={() => setPendingDeleteNode(null)}
          onConfirm={() => handleDeleteNode(pendingDeleteNode.id)}
          title={t("Supprimer le nœud ?")}
          description={t('confirm.nodeDelete', { name: pendingDeleteNode.name })}
          confirmLabel={t("Supprimer")}
          cancelLabel={t("Annuler")}
        />
      )}

      {pendingDeleteGroup && (
        <ConfirmModal
          isOpen={!!pendingDeleteGroup}
          onClose={() => setPendingDeleteGroup(null)}
          onConfirm={() => handleDeleteGroup(pendingDeleteGroup.id)}
          title={t("Supprimer le groupe ?")}
          description={t('confirm.groupDelete', { name: pendingDeleteGroup.name })}
          confirmLabel={t("Supprimer le groupe")}
          cancelLabel={t("Annuler")}
        />
      )}

      {showIconPicker && (
        <EmojiPickerModal
          initialEmoji={nodeIcon}
          onSelect={(emoji) => {
            setNodeIcon(emoji);
            setShowIconPicker(false);
          }}
          onClose={() => setShowIconPicker(false)}
          allowNone={false}
        />
      )}

      {/* ======================================================================
          FORM MODAL: AUTO-IMPORT CONFIGURATION OPTIONS
         ====================================================================== */}
      {showAutoImportModal && mounted && typeof document !== 'undefined' && createPortal(
        <div className="nd-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setShowAutoImportModal(false)}>
          <div ref={autoImportDialogRef} role="dialog" aria-modal="true" aria-label={t("Générer la carte réseau automatiquement")} tabIndex={-1} className="nd-modal" style={{ maxWidth: 380 }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={16} style={{ color: 'var(--nd-accent)' }} />
              <span>{t("Générer la carte réseau automatiquement ?")}</span>
            </h3>
            <p style={{ fontSize: '0.68rem', color: 'var(--nd-text-muted)', marginBottom: 16, lineHeight: 1.4 }}>
              {t("NasDash va analyser vos appareils et services configurés pour créer automatiquement votre cartographie topologique de départ.")}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
              <div
                onClick={() => setAutoImportGroupCategories(!autoImportGroupCategories)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  padding: '8px 10px',
                  borderRadius: 'var(--nd-card-radius)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--nd-card-border)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--nd-accent)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--nd-card-border)'}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    border: '1px solid var(--nd-text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: autoImportGroupCategories ? 'var(--nd-accent)' : 'transparent',
                    borderColor: autoImportGroupCategories ? 'var(--nd-accent)' : 'var(--nd-card-border)',
                    color: '#fff',
                    fontSize: '8px',
                    flexShrink: 0
                  }}
                >
                  {autoImportGroupCategories && <Check size={10} strokeWidth={3} />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--nd-text)' }}>
                    {t("Regrouper par catégories du Dashboard")}
                  </span>
                  <span style={{ fontSize: '0.58rem', color: 'var(--nd-text-muted)' }}>
                    {t("Crée automatiquement des groupes basés sur vos catégories d'applications de l'onglet Accueil.")}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="nd-btn" onClick={() => setShowAutoImportModal(false)}>Annuler</button>
              <button
                className="nd-btn nd-btn-accent"
                onClick={async () => {
                  setShowAutoImportModal(false);
                  await handleAutoImport(autoImportGroupCategories);
                }}
              >
                {t("Générer")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
