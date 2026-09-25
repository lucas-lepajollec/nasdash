'use client';

import React, { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { List, Map as MapIcon, Maximize2, Minus, Plus } from 'lucide-react';
import type { NetworkConnection, NetworkGroup, NetworkNode, NetworkTopology } from '@/lib/types';
import { useI18n } from '@/i18n/I18nProvider';
import { Emoji } from '../../shared/Emoji';
import {
  autoCardSize, layoutTopology, roundedPath,
  type TopologyCardSize,
} from './topologyLayout';

const LAYER_LABEL: Record<NetworkNode['type'], string> = {
  infra: 'topology.calme.layerInfra',
  device: 'topology.calme.layerMachines',
  netsvc: 'topology.calme.layerNetwork',
  stdsvc: 'topology.calme.layerApps',
};

/** Below this width the list view is shown first (phones, narrow widgets). */
const LIST_BELOW_PX = 760;
/** The map is never shrunk below this: past it, it is panned instead. */
const MIN_FIT_SCALE = 0.85;
/** Narrowest block the map is laid out for (a phone then pans it). */
const MIN_LAYOUT_PX = 420;

export interface TopologyCanvasProps {
  topology: NetworkTopology;
  /** Local address of each service, by service id (nodes linked to a service open it). */
  serviceUrls?: Map<string, string>;
  editMode: boolean;
  searchQuery?: string;
  showSensitive: boolean;
  cardSize: 'auto' | TopologyCardSize;
  onEditNode: (node: NetworkNode) => void;
  onEditGroup: (group: NetworkGroup) => void;
  onEditConnection: (connection: NetworkConnection) => void;
  /** A link drawn by dragging from a node's handle onto another node or group. */
  onConnect: (fromId: string, toId: string) => void;
}

/**
 * The network map: placed by zones and routed around the cards (see
 * topologyLayout.ts), drawn as SVG links under HTML cards, zoomable. Hovering
 * a node lights its links; in edit mode a node, a group or a link opens its
 * dialog and the small handle of a node draws a new link.
 */
export function TopologyCanvas({ topology, serviceUrls, editMode, searchQuery = '', showSensitive, cardSize, onEditNode, onEditGroup, onEditConnection, onConnect }: TopologyCanvasProps) {
  const { t } = useI18n();
  const markerId = `ndc-arrow-${useId().replace(/:/g, '')}`;
  const root = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ fromId: string; x1: number; y1: number; x2: number; y2: number; over: string | null } | null>(null);

  // The map follows the width of its block.
  // Measured on the whole map block: the viewport itself is hidden in list view.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => setWidth(Math.round(entries[0]?.contentRect.width ?? 0)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Narrow blocks show a list first instead.
  const narrow = width > 0 && width < LIST_BELOW_PX;
  const [view, setView] = useState<'map' | 'list' | null>(null);
  const shownView = view ?? (narrow ? 'list' : 'map');
  const size = cardSize === 'auto' ? autoCardSize(topology.nodes.length) : cardSize;

  // Laid out for the block width (the application groups fill it), by 20 px
  // steps so a resize does not re-route on every pixel.
  const layoutWidth = width ? Math.max(MIN_LAYOUT_PX, Math.floor(width / 20) * 20) : 0;
  const layout = useMemo(() => (layoutWidth ? layoutTopology(topology, layoutWidth, size) : null), [topology, layoutWidth, size]);

  // Fitted to the width unless the user zoomed, but never below a readable
  // size: a wider map is panned (drag the background).
  const fit = layout && width ? Math.min(1, (width - 2) / Math.max(1, layout.width)) : 1;
  const scale = zoom ?? Math.max(fit, Math.min(1, MIN_FIT_SCALE));

  const pan = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = viewport.current;
    if (!el || event.button !== 0 || (event.target as HTMLElement).closest('.ndc-map-node, .ndc-map-group-title, .ndc-map-link-hit, button')) return;
    const start = { x: event.clientX, y: event.clientY, left: el.scrollLeft, top: el.scrollTop };
    el.setPointerCapture(event.pointerId);
    el.classList.add('is-panning');
    const move = (moveEvent: PointerEvent) => {
      el.scrollLeft = start.left - (moveEvent.clientX - start.x);
      el.scrollTop = start.top - (moveEvent.clientY - start.y);
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.classList.remove('is-panning');
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  // What lights up when a node (or group) is hovered: the links it sends
  // (and two-way links), not the ones it receives, unless it only receives.
  // Linked groups light up with their cards.
  const lit = useMemo(() => {
    if (!hovered) return null;
    const groupOf = new Map(topology.nodes.map(node => [node.id, node.groupId]));
    const selfAndGroup = new Set([hovered, groupOf.get(hovered)].filter(Boolean) as string[]);
    const touches = topology.connections.filter(connection => selfAndGroup.has(connection.fromId) || selfAndGroup.has(connection.toId));
    const sent = touches.filter(connection => selfAndGroup.has(connection.fromId) || connection.type === 'bidirectional');
    const shown = sent.length ? sent : touches;
    const edges = new Set(shown.map(connection => connection.id));
    const ends = new Set<string>(selfAndGroup);
    for (const connection of shown) { ends.add(connection.fromId); ends.add(connection.toId); }
    for (const node of topology.nodes) if (node.groupId && ends.has(node.groupId)) ends.add(node.id);
    return { edges, ends };
  }, [hovered, topology]);

  const query = searchQuery.trim().toLowerCase();
  const matches = (node: NetworkNode) => !query || node.name.toLowerCase().includes(query) || (node.ip ?? '').toLowerCase().includes(query);

  // Drawing a new link: from a node's handle to wherever the pointer is released.
  const startLink = (event: React.PointerEvent, fromId: string) => {
    if (!layout || !stage.current) return;
    event.preventDefault();
    event.stopPropagation();
    const from = layout.nodes.find(node => node.id === fromId);
    if (!from) return;
    const origin = stage.current.getBoundingClientRect();
    const toStage = (x: number, y: number) => ({ x: (x - origin.left) / scale, y: (y - origin.top) / scale });
    const x1 = from.x + from.width;
    const y1 = from.y + from.height / 2;
    const targetAt = (x: number, y: number) => {
      const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-map-target]');
      const id = hit?.dataset.mapTarget ?? null;
      return id && id !== fromId ? id : null;
    };
    const move = (moveEvent: PointerEvent) => {
      const point = toStage(moveEvent.clientX, moveEvent.clientY);
      setDraft({ fromId, x1, y1, x2: point.x, y2: point.y, over: targetAt(moveEvent.clientX, moveEvent.clientY) });
    };
    const up = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const target = targetAt(upEvent.clientX, upEvent.clientY);
      setDraft(null);
      if (target) onConnect(fromId, target);
    };
    const point = toStage(event.clientX, event.clientY);
    setDraft({ fromId, x1, y1, x2: point.x, y2: point.y, over: null });
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const zoomBy = (factor: number) => setZoom(current => Math.min(2, Math.max(0.3, (current ?? fit) * factor)));

  return (
    <div ref={root} className={`ndc-map ${editMode ? 'is-editing' : ''} ndc-map--${size}`}>
      <div className="ndc-map-tools" aria-label={t('topology.calme.zoom')}>
        <button type="button" className={`ndc-icon-button ${shownView === 'list' ? 'is-on' : ''}`} onClick={() => setView('list')} aria-pressed={shownView === 'list'} aria-label={t('topology.calme.listView')} title={t('topology.calme.listView')}><List size={14} /></button>
        <button type="button" className={`ndc-icon-button ${shownView === 'map' ? 'is-on' : ''}`} onClick={() => setView('map')} aria-pressed={shownView === 'map'} aria-label={t('topology.calme.mapView')} title={t('topology.calme.mapView')}><MapIcon size={14} /></button>
        {shownView === 'map' && <>
        <span className="ndc-map-tools-sep" aria-hidden="true" />
        <button type="button" className="ndc-icon-button" onClick={() => zoomBy(1 / 1.2)} aria-label={t('topology.calme.zoomOut')} title={t('topology.calme.zoomOut')}><Minus size={14} /></button>
        <button type="button" className="ndc-icon-button" onClick={() => setZoom(null)} aria-label={t('topology.calme.fit')} title={t('topology.calme.fit')}><Maximize2 size={13} /></button>
        <button type="button" className="ndc-icon-button" onClick={() => zoomBy(1.2)} aria-label={t('topology.calme.zoomIn')} title={t('topology.calme.zoomIn')}><Plus size={14} /></button>
        </>}
      </div>

      {shownView === 'list' && (
        <TopologyList topology={topology} editMode={editMode} matches={matches} showSensitive={showSensitive} onEditNode={onEditNode} onEditGroup={onEditGroup} onEditConnection={onEditConnection} />
      )}

      <div ref={viewport} className="ndc-map-viewport" hidden={shownView !== 'map'} onPointerDown={pan}>
        {!layout ? <div className="ndc-empty" style={{ minHeight: 240 }}><span className="nd-spinner" style={{ width: 18, height: 18 }} /></div> : (
          <div className="ndc-map-sizer" style={{ width: layout.width * scale, height: layout.height * scale }}>
            <div ref={stage} className="ndc-map-stage" style={{ width: layout.width, height: layout.height, transform: `scale(${scale})` }}>
              {/* Layer headings */}
              {layout.layers.map(layer => (
                <div
                  key={layer.type}
                  className={`ndc-map-layer ndc-map-type--${layer.type}`}
                  style={{ left: layer.x, top: layer.y, width: layer.width }}
                >
                  <span className="ndc-map-layer-dot" aria-hidden="true" />
                  {t(LAYER_LABEL[layer.type])}
                </div>
              ))}

              {/* Groups */}
              {layout.groups.map(placed => {
                const dim = (lit && !lit.ends.has(placed.id)) || (query && !topology.nodes.some(node => node.groupId === placed.id && matches(node)));
                return (
                  <div
                    key={placed.id}
                    data-map-target={placed.id}
                    className={`ndc-map-group ndc-map-type--${placed.group.type} ${dim ? 'is-dim' : ''} ${lit?.ends.has(placed.id) ? 'is-lit' : ''} ${draft?.over === placed.id ? 'is-drop' : ''}`}
                    style={{ left: placed.x, top: placed.y, width: placed.width, height: placed.height }}
                    onMouseEnter={() => !draft && setHovered(placed.id)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <button type="button" className="ndc-map-group-title" disabled={!editMode} onClick={() => editMode && onEditGroup(placed.group)} title={editMode ? t("Modifier le groupe") : undefined}>
                      {placed.group.name}
                    </button>
                  </div>
                );
              })}

              {/* Links */}
              <svg className="ndc-map-links" width={layout.width} height={layout.height} aria-hidden="true">
                <defs>
                  <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="context-stroke" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </marker>
                </defs>
                {layout.edges.map(edge => {
                  const d = roundedPath(edge.points);
                  const state = lit ? (lit.edges.has(edge.id) ? 'is-lit' : 'is-dim') : '';
                  return (
                    <g key={edge.id} className={`ndc-map-link ${state}`}>
                      <path
                        d={d}
                        className="ndc-map-link-line"
                        markerEnd={edge.short ? undefined : `url(#${markerId})`}
                        markerStart={!edge.short && edge.connection.type === 'bidirectional' ? `url(#${markerId})` : undefined}
                      />
                      {editMode && (
                        <path d={d} className="ndc-map-link-hit" onClick={() => onEditConnection(edge.connection)}>
                          <title>{t("Modifier la liaison")}</title>
                        </path>
                      )}
                    </g>
                  );
                })}
                {draft && <path className="ndc-map-draft" d={`M ${draft.x1} ${draft.y1} L ${draft.x2} ${draft.y2}`} />}
              </svg>

              {/* Link labels */}
              {layout.edges.filter(edge => edge.label).map(edge => (
                <span
                  key={`label-${edge.id}`}
                  className={`ndc-map-label ${lit && !lit.edges.has(edge.id) ? 'is-dim' : ''} ${edge.label!.crowded ? (lit?.edges.has(edge.id) ? 'is-raised' : 'is-crowded') : ''}`}
                  style={{ left: edge.label!.x, top: edge.label!.y, width: edge.label!.width, height: edge.label!.height }}
                >
                  {edge.label!.text}
                </span>
              ))}

              {/* Nodes */}
              {layout.nodes.map(placed => {
                const node = placed.node;
                const dim = (lit && !lit.ends.has(node.id)) || (query && !matches(node));
                const { href, address } = nodeAddress(node, serviceUrls, showSensitive);
                return (
                  <div
                    key={placed.id}
                    data-map-target={node.id}
                    data-node-id={node.id}
                    role={editMode ? 'button' : href ? 'link' : undefined}
                    tabIndex={editMode || href ? 0 : undefined}
                    className={`ndc-map-node ndc-map-type--${node.type} ${href && !editMode ? 'is-link' : ''} ${dim ? 'is-dim' : ''} ${lit?.ends.has(node.id) ? 'is-lit' : ''} ${draft?.over === node.id ? 'is-drop' : ''}`}
                    style={{ left: placed.x, top: placed.y, width: placed.width, height: placed.height }}
                    onMouseEnter={() => !draft && setHovered(node.id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => { if (editMode) onEditNode(node); else if (href) window.open(href, '_blank', 'noopener,noreferrer'); }}
                    onKeyDown={event => { if ((editMode || href) && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); if (editMode) onEditNode(node); else if (href) window.open(href, '_blank', 'noopener,noreferrer'); } }}
                    title={[node.name, address, node.ports && node.ports.length > 1 ? node.ports.join(', ') : ''].filter(Boolean).join(' · ')}
                  >
                    <span className="ndc-map-node-icon"><Emoji emoji={node.icon} /></span>
                    <span className="ndc-map-node-text">
                      <span className="ndc-map-node-name">{node.name}</span>
                      {size !== 'mini' && address && <span className="ndc-map-node-sub">{address}</span>}
                    </span>
                    {editMode && (
                      <span
                        className="ndc-map-handle ndc-map-handle--right"
                        onPointerDown={event => startLink(event, node.id)}
                        onClick={event => event.stopPropagation()}
                        title={t('topology.calme.dragToLink')}
                        aria-label={t('topology.calme.dragToLink')}
                        role="button"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * What a node card shows and opens: the linked service's local address, or
 * the node's IP with its first port. The host is masked in privacy mode.
 */
function nodeAddress(node: NetworkNode, serviceUrls: Map<string, string> | undefined, showSensitive: boolean): { href?: string; address: string } {
  const linked = node.linkedServiceId ? serviceUrls?.get(node.linkedServiceId) : undefined;
  let host = node.ip ?? '';
  let port = node.ports?.[0] ? String(node.ports[0]) : '';
  let href: string | undefined;
  if (linked) {
    try {
      const url = new URL(/^https?:\/\//i.test(linked) ? linked : ['http://', linked].join(''));
      host = url.hostname;
      port = url.port || port;
      href = url.href;
    } catch { /* not a URL: keep the node's own address */ }
  }
  if (!href && host && port) href = ['http://', host, ':', port].join('');
  if (!host) return { href, address: '' };
  const shown = showSensitive ? host : '•••';
  return { href, address: port ? [shown, port].join(':') : shown };
}

/**
 * The same map as a list, for phones: one section per layer, each node with
 * its links ("→ target", "← source"). Groups stay together under their name.
 */
function TopologyList({ topology, editMode, matches, showSensitive, onEditNode, onEditGroup, onEditConnection }: {
  topology: NetworkTopology;
  editMode: boolean;
  matches: (node: NetworkNode) => boolean;
  showSensitive: boolean;
  onEditNode: (node: NetworkNode) => void;
  onEditGroup: (group: NetworkGroup) => void;
  onEditConnection: (connection: NetworkConnection) => void;
}) {
  const { t } = useI18n();
  const names = new Map<string, string>([
    ...topology.nodes.map(node => [node.id, node.name] as const),
    ...topology.groups.map(group => [group.id, group.name] as const),
  ]);
  const linksOf = (id: string, groupId?: string) => topology.connections.filter(connection =>
    connection.fromId === id || connection.toId === id || (!!groupId && (connection.fromId === groupId || connection.toId === groupId)));

  const nodeRow = (node: NetworkNode) => {
    const links = linksOf(node.id);
    return (
      <li key={node.id} className={`ndc-maplist-node ndc-map-type--${node.type} ${matches(node) ? '' : 'is-dim'}`}>
        <button type="button" className="ndc-maplist-head" disabled={!editMode} onClick={() => editMode && onEditNode(node)}>
          <span className="ndc-map-node-icon"><Emoji emoji={node.icon} /></span>
          <span className="ndc-map-node-text">
            <span className="ndc-map-node-name">{node.name}</span>
            {nodeAddress(node, undefined, showSensitive).address && <span className="ndc-map-node-sub">{nodeAddress(node, undefined, showSensitive).address}</span>}
          </span>
        </button>
        {links.length > 0 && (
          <span className="ndc-maplist-links">
            {links.map(connection => {
              const outgoing = connection.fromId === node.id;
              const other = names.get(outgoing ? connection.toId : connection.fromId) ?? '?';
              const arrow = connection.type === 'bidirectional' ? '↔' : outgoing ? '→' : '←';
              return (
                <button key={connection.id} type="button" className="ndc-maplist-link" disabled={!editMode} onClick={() => editMode && onEditConnection(connection)}>
                  {[arrow, other].join(' ')}{connection.label && <span className="ndc-maplist-link-label">{connection.label}</span>}
                </button>
              );
            })}
          </span>
        )}
      </li>
    );
  };

  return (
    <div className="ndc-maplist">
      {(['infra', 'device', 'netsvc', 'stdsvc'] as const).map(type => {
        const groups = topology.groups.filter(group => group.type === type);
        const loose = topology.nodes.filter(node => node.type === type && (!node.groupId || !groups.some(group => group.id === node.groupId)));
        if (!groups.length && !loose.length) return null;
        return (
          <section key={type} className={`ndc-maplist-layer ndc-map-type--${type}`}>
            <h4><span className="ndc-map-layer-dot" aria-hidden="true" />{t(LAYER_LABEL[type])}</h4>
            {loose.length > 0 && <ul>{loose.map(nodeRow)}</ul>}
            {groups.map(group => {
              const members = topology.nodes.filter(node => node.groupId === group.id);
              const groupLinks = topology.connections.filter(connection => connection.fromId === group.id || connection.toId === group.id);
              return (
                <div key={group.id} className="ndc-maplist-group">
                  <button type="button" className="ndc-maplist-group-title" disabled={!editMode} onClick={() => editMode && onEditGroup(group)}>
                    {group.name}
                    {groupLinks.length > 0 && <span className="ndc-maplist-group-links">{groupLinks.map(connection => [connection.type === 'bidirectional' ? '↔' : connection.fromId === group.id ? '→' : '←', names.get(connection.fromId === group.id ? connection.toId : connection.fromId) ?? '?'].join(' ')).join(' · ')}</span>}
                  </button>
                  <ul>{members.map(nodeRow)}</ul>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
