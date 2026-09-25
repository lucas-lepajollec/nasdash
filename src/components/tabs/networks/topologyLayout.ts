import type { NetworkConnection, NetworkGroup, NetworkNode, NetworkTopology } from '@/lib/types';

/**
 * Network map layout, in two steps.
 *
 * 1. Placement, by zones (the historical structure): infrastructure,
 *    machines and network services stacked in a left column; applications
 *    on the right, their groups laid out in columns. Groups show their nodes
 *    two per row. Everything is placed on a fixed grid, so the map is dense
 *    and always reads the same way.
 * 2. Routing: every link is searched on a fine grid (A*) that goes around all
 *    the cards and groups it does not connect, prefers few bends and keeps
 *    away from links already drawn. Links leave and enter perpendicular to a
 *    card side, so arrows always point into their target.
 */

export type TopologyCardSize = 'standard' | 'compact' | 'mini';
export type NodeType = NetworkNode['type'];
type Side = 'top' | 'right' | 'bottom' | 'left';

export const LAYER_ORDER: readonly NodeType[] = ['infra', 'device', 'netsvc', 'stdsvc'];

export const CARD_SIZES: Record<TopologyCardSize, { width: number; height: number }> = {
  standard: { width: 156, height: 48 },
  compact: { width: 136, height: 42 },
  mini: { width: 116, height: 32 },
};

const PAD = 24;
const HEADING = 48;
const SECTION_GAP = 44;
/** The corridor between the network column and the applications, where links run. */
const CORRIDOR_MIN = 120;
const CORRIDOR_MAX = 240;
const CARD_GAP = 12;
const GROUP_GAP = 40;
const GROUP_PAD = { top: 34, side: 12, bottom: 12 };
/** Cards may shrink this much below their size so the applications keep their columns. */
const CARD_SHRINK = 28;
const CELL = 8;

export interface Point { x: number; y: number }
type Rect = { x: number; y: number; width: number; height: number };
export interface PlacedBox { id: string; x: number; y: number; width: number; height: number }
export interface PlacedNode extends PlacedBox { node: NetworkNode }
export interface PlacedGroup extends PlacedBox { group: NetworkGroup }
export interface PlacedEdge {
  id: string;
  connection: NetworkConnection;
  points: Point[];
  /** A connector between close neighbours: too short for arrowheads. */
  short?: boolean;
  /** `crowded`: no free spot, shown only while the link is lit. */
  label?: { text: string; x: number; y: number; width: number; height: number; crowded?: boolean };
}
export interface PlacedLayer { type: NodeType; x: number; y: number; width: number }
export interface TopologyLayout {
  width: number;
  height: number;
  nodes: PlacedNode[];
  groups: PlacedGroup[];
  edges: PlacedEdge[];
  layers: PlacedLayer[];
}

/** Size used when the setting is "auto": smaller cards on bigger maps. */
export function autoCardSize(nodeCount: number): TopologyCardSize {
  if (nodeCount <= 28) return 'standard';
  if (nodeCount <= 56) return 'compact';
  return 'mini';
}

// ---------------------------------------------------------------- placement

interface Placement {
  nodes: PlacedNode[];
  groups: PlacedGroup[];
  layers: PlacedLayer[];
  width: number;
  height: number;
  /** The network column: links cross it to reach the corridor, they do not run along it. */
  column?: Rect;
}

/** Lays cards out in rows of `columns`, returns the height used. */
function gridOf(nodes: NetworkNode[], x: number, y: number, columns: number, card: { width: number; height: number }, out: PlacedNode[], gap = CARD_GAP): number {
  nodes.forEach((node, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    out.push({ id: node.id, node, x: x + column * (card.width + gap), y: y + row * (card.height + gap), width: card.width, height: card.height });
  });
  const rows = Math.ceil(nodes.length / columns);
  return rows ? rows * card.height + (rows - 1) * gap : 0;
}

function place(topology: NetworkTopology, width: number, size: TopologyCardSize): Placement {
  const preset = CARD_SIZES[size];
  const nodes: PlacedNode[] = [];
  const groups: PlacedGroup[] = [];
  const layers: PlacedLayer[] = [];
  const groupIds = new Set(topology.groups.map(group => group.id));
  const membersOf = (group: NetworkGroup) => topology.nodes.filter(node => node.groupId === group.id);
  const looseOf = (type: NodeType) => topology.nodes.filter(node => node.type === type && (!node.groupId || !groupIds.has(node.groupId)));
  const inner = Math.max(0, width - 2 * PAD);
  const side = GROUP_PAD.side;

  // Widest cards that let the network column (one card per row), the
  // corridor and `columns` application columns (two cards per row) fit; the
  // most columns that stay readable win.
  const appGroups = topology.groups.filter(group => group.type === 'stdsvc').length;
  let columns = 0;
  let cardWidth = preset.width;
  for (let candidate = Math.min(4, Math.max(1, appGroups)); candidate >= 1; candidate--) {
    const fitted = Math.floor((inner - CORRIDOR_MIN - (candidate - 1) * GROUP_GAP - 2 * side - candidate * (CARD_GAP + 2 * side)) / (1 + 2 * candidate));
    if (fitted >= preset.width - CARD_SHRINK) {
      columns = candidate;
      cardWidth = Math.min(preset.width + 24, fitted);
      break;
    }
  }
  const card = { width: cardWidth, height: preset.height };
  const widthOf = (perRow: number) => perRow * card.width + (perRow - 1) * CARD_GAP + 2 * side;
  const membersOfRows = (group: NetworkGroup, perRow: number) => Math.max(1, Math.ceil(membersOf(group).length / perRow));
  const groupHeight = (group: NetworkGroup, perRow: number) => {
    const rows = membersOfRows(group, perRow);
    return GROUP_PAD.top + rows * card.height + (rows - 1) * CARD_GAP + GROUP_PAD.bottom;
  };
  const placeGroup = (group: NetworkGroup, x: number, y: number, perRow: number, height: number) => {
    groups.push({ id: group.id, group, x, y, width: widthOf(perRow), height });
    gridOf(membersOf(group), x + side, y + GROUP_PAD.top, perRow, card, nodes);
  };

  // A section = heading, loose nodes, then its groups on aligned rows (the
  // groups of a row share their height, so the gaps between them run straight).
  const section = (type: NodeType, x: number, y: number, sectionColumns: number, perRow: number) => {
    const loose = looseOf(type);
    const sectionGroups = topology.groups.filter(group => group.type === type);
    if (!loose.length && !sectionGroups.length) return 0;
    const groupWidth = widthOf(perRow);
    const sectionWidth = sectionColumns * groupWidth + (sectionColumns - 1) * GROUP_GAP;
    layers.push({ type, x, y, width: sectionWidth });
    let cursor = y + HEADING;
    if (loose.length) {
      // Loose cards line up with the cards of the groups below them.
      const looseGap = CARD_GAP + 2 * side;
      const across = perRow === 1 ? 1 : Math.max(1, Math.floor((sectionWidth - 2 * side + looseGap) / (card.width + looseGap)));
      cursor += gridOf(loose, x + side, cursor, across, card, nodes, perRow === 1 ? 20 : looseGap) + (sectionGroups.length ? GROUP_GAP : 0);
    }
    for (let row = 0; row < sectionGroups.length; row += sectionColumns) {
      const line = sectionGroups.slice(row, row + sectionColumns);
      const height = Math.max(...line.map(group => groupHeight(group, perRow)));
      line.forEach((group, index) => placeGroup(group, x + index * (groupWidth + GROUP_GAP), cursor, perRow, height));
      cursor += height + GROUP_GAP;
    }
    if (sectionGroups.length) cursor -= GROUP_GAP;
    return cursor - y;
  };

  let leftBottom = PAD;
  let rightBottom = PAD;
  const columnWidth = widthOf(1);
  if (columns) {
    // Left: the three network layers; then the corridor; right: the applications.
    for (const type of ['infra', 'device', 'netsvc'] as const) {
      const height = section(type, PAD, leftBottom, 1, 1);
      if (height) leftBottom += height + SECTION_GAP;
    }
    const appsWidth = columns * widthOf(2) + (columns - 1) * GROUP_GAP;
    const corridor = Math.min(CORRIDOR_MAX, inner - columnWidth - appsWidth);
    rightBottom += section('stdsvc', PAD + columnWidth + corridor, PAD, columns, 2) + SECTION_GAP;
  } else {
    // Too narrow for a corridor: every layer under the previous one.
    const stacked = Math.max(1, Math.floor((inner + GROUP_GAP) / (widthOf(2) + GROUP_GAP)));
    for (const type of LAYER_ORDER) {
      const height = section(type, PAD, leftBottom, stacked, 2);
      if (height) leftBottom += height + SECTION_GAP;
    }
  }
  const right = Math.max(...[...nodes, ...groups].map(box => box.x + box.width), PAD);
  const height = Math.max(leftBottom, rightBottom) - SECTION_GAP + PAD;
  const column = columns ? { x: PAD, y: 0, width: columnWidth, height } : undefined;
  return { nodes, groups, layers, width: Math.max(width, right + PAD), height, ...(column ? { column } : {}) };
}

// ------------------------------------------------------------------ routing

const DIRS: Point[] = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];
const SIDE_DIR: Record<Side, number> = { top: 0, right: 1, bottom: 2, left: 3 };

/** Binary heap on (cost) for A*. */
class Heap {
  private keys: number[] = [];
  private values: number[] = [];
  get size() { return this.keys.length; }
  push(key: number, value: number) {
    this.keys.push(key); this.values.push(value);
    let i = this.keys.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.keys[parent] <= this.keys[i]) break;
      [this.keys[parent], this.keys[i]] = [this.keys[i], this.keys[parent]];
      [this.values[parent], this.values[i]] = [this.values[i], this.values[parent]];
      i = parent;
    }
  }
  pop(): number {
    const top = this.values[0];
    const lastKey = this.keys.pop()!;
    const lastValue = this.values.pop()!;
    if (this.keys.length) {
      this.keys[0] = lastKey; this.values[0] = lastValue;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < this.keys.length && this.keys[l] < this.keys[m]) m = l;
        if (r < this.keys.length && this.keys[r] < this.keys[m]) m = r;
        if (m === i) break;
        [this.keys[m], this.keys[i]] = [this.keys[i], this.keys[m]];
        [this.values[m], this.values[i]] = [this.values[i], this.values[m]];
        i = m;
      }
    }
    return top;
  }
}

interface Grid {
  cols: number;
  rows: number;
  /** Index + 1 of the card covering a cell (0 = none). */
  card: Int32Array;
  /** Index + 1 of the group covering a cell (0 = none). */
  group: Int32Array;
  /** Group title strips: no link runs over a title. */
  title: Uint8Array;
  /**
   * Links are bundled by source: the links of one source share their trunk
   * and branch off it, other sources keep to their own lanes. `owner` is the
   * bundle using a cell (-1: several), `near` the bundle running next to it.
   */
  owner: Int32Array;
  near: Int32Array;
  /** Extra cost of a cell (the network column). */
  slow: Uint8Array;
  search?: { cost: Float32Array; previous: Int32Array; stamp: Uint32Array; run: number };
}

function buildGrid(width: number, height: number, cards: PlacedBox[], groups: PlacedBox[], headings: PlacedBox[], column?: Rect): Grid {
  const cols = Math.ceil(width / CELL) + 1;
  const rows = Math.ceil(height / CELL) + 1;
  const grid: Grid = { cols, rows, card: new Int32Array(cols * rows), group: new Int32Array(cols * rows), title: new Uint8Array(cols * rows), owner: new Int32Array(cols * rows), near: new Int32Array(cols * rows), slow: new Uint8Array(cols * rows) };
  const mark = (target: Int32Array | Uint8Array, box: PlacedBox, value: number, inflate: number) => {
    const x0 = Math.max(0, Math.floor((box.x - inflate) / CELL));
    const y0 = Math.max(0, Math.floor((box.y - inflate) / CELL));
    const x1 = Math.min(cols - 1, Math.ceil((box.x + box.width + inflate) / CELL));
    const y1 = Math.min(rows - 1, Math.ceil((box.y + box.height + inflate) / CELL));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) target[y * cols + x] = value;
  };
  groups.forEach((box, index) => mark(grid.group, box, index + 1, 2));
  cards.forEach((box, index) => mark(grid.card, box, index + 1, 3));
  groups.forEach(box => mark(grid.title, { ...box, x: box.x + 4, width: box.width - 8, y: box.y + 4, height: GROUP_PAD.top - 8 }, 1, 0));
  headings.forEach(box => mark(grid.title, box, 1, 2));
  if (column) mark(grid.slow, { id: '', ...column }, 3, -4);
  // Trunks keep off the side of groups, so the last stretch into a group is a
  // clear horizontal arrow.
  for (const box of groups) for (const x of [box.x - 28, box.x + box.width + 4]) {
    const strip = { id: '', x, y: box.y, width: 24, height: box.height };
    const x0 = Math.max(0, Math.floor(strip.x / CELL)), x1 = Math.min(cols - 1, Math.ceil((strip.x + strip.width) / CELL));
    const y0 = Math.max(0, Math.floor(strip.y / CELL)), y1 = Math.min(rows - 1, Math.ceil((strip.y + strip.height) / CELL));
    for (let y = y0; y <= y1; y++) for (let cx = x0; cx <= x1; cx++) grid.slow[y * cols + cx] = Math.max(grid.slow[y * cols + cx], 2);
  }
  return grid;
}

/** Sides a box can be left or entered from (cards in a group: its outer sides only). */
function allowedSides(box: PlacedBox, group: PlacedBox | undefined): Side[] {
  if (!group) return ['top', 'right', 'bottom', 'left'];
  const sides: Side[] = [];
  if (box.x - group.x < GROUP_PAD.side + 4) sides.push('left');
  if (group.x + group.width - (box.x + box.width) < GROUP_PAD.side + 4) sides.push('right');
  if (group.y + group.height - (box.y + box.height) < GROUP_PAD.bottom + 4) sides.push('bottom');
  return sides.length ? sides : ['left', 'right'];
}

/** Side of `box` facing `toward` best, among `allowed`. */
function facingSide(box: PlacedBox, toward: PlacedBox, allowed: Side[]): Side {
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const tx = toward.x + toward.width / 2, ty = toward.y + toward.height / 2;
  const score = (side: Side) => {
    const d = DIRS[SIDE_DIR[side]];
    return d.x * (tx - cx) + d.y * (ty - cy) * 1.4;
  };
  return [...allowed].sort((a, b) => score(b) - score(a))[0];
}

function portPoint(box: PlacedBox, side: Side, slot: number, slots: number, at?: number): Point {
  const t = at ?? (slot + 1) / (slots + 1);
  if (side === 'top') return { x: box.x + box.width * t, y: box.y };
  if (side === 'bottom') return { x: box.x + box.width * t, y: box.y + box.height };
  if (side === 'left') return { x: box.x, y: box.y + box.height * t };
  return { x: box.x + box.width, y: box.y + box.height * t };
}

/** First free cell straight out of a port, and the steps to it. */
function outside(point: Point, side: Side): Point {
  const d = DIRS[SIDE_DIR[side]];
  return { x: point.x + d.x * 10, y: point.y + d.y * 10 };
}

interface End { point: Point; dir: number }
interface Found { points: Point[]; cells: number[]; cost: number; start: number; goal: number }

/**
 * Cheapest path on the grid (A*) from any of `starts` to any of `goals`: one
 * search tries every pair of sides at once. A goal is reached moving in its
 * direction (into the target side).
 */
function route(grid: Grid, starts: End[], goals: End[], passable: (cell: number) => boolean, bundle: number): Found | null {
  const { cols, rows } = grid;
  const toCell = (p: Point) => Math.min(rows - 1, Math.max(0, Math.round(p.y / CELL))) * cols + Math.min(cols - 1, Math.max(0, Math.round(p.x / CELL)));
  const size = cols * rows * 4;
  // Buffers shared by every search on this grid, reset by a stamp.
  if (!grid.search || grid.search.cost.length !== size) grid.search = { cost: new Float32Array(size), previous: new Int32Array(size), stamp: new Uint32Array(size), run: 0 };
  const search = grid.search;
  const run = ++search.run;
  const { cost, previous, stamp } = search;
  const known = (state: number) => stamp[state] === run;
  const BEND = 6;
  const goalStates = new Map<number, number>();
  const goalCells = new Set<number>();
  const targets = goals.map((goal, index) => {
    const cell = toCell(goal.point);
    goalStates.set(cell * 4 + goal.dir, index);
    goalCells.add(cell);
    return { x: cell % cols, y: Math.floor(cell / cols) };
  });
  const estimate = (x: number, y: number) => {
    let best = Infinity;
    for (const target of targets) {
      const dx = Math.abs(x - target.x), dy = Math.abs(y - target.y);
      best = Math.min(best, dx + dy + (dx && dy ? BEND : 0));
    }
    return best;
  };
  const heap = new Heap();
  const startStates = new Map<number, number>();
  starts.forEach((begin, index) => {
    const state = toCell(begin.point) * 4 + begin.dir;
    stamp[state] = run;
    cost[state] = 0;
    previous[state] = -1;
    startStates.set(state, index);
    const cell = state >> 2;
    heap.push(1.2 * estimate(cell % cols, Math.floor(cell / cols)), state);
  });
  let found = -1;
  let guard = 0;
  while (heap.size && guard++ < 150000) {
    const state = heap.pop();
    // Arriving in the direction that enters the target side.
    if (goalStates.has(state)) { found = state; break; }
    const cell = state >> 2, dir = state & 3;
    const x = cell % cols, y = Math.floor(cell / cols);
    const base = cost[state];
    for (let nd = 0; nd < 4; nd++) {
      if (nd === ((dir + 2) & 3)) continue; // no U-turn
      const nx = x + DIRS[nd].x, ny = y + DIRS[nd].y;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const next = ny * cols + nx;
      if (!goalCells.has(next) && !passable(next)) continue;
      // Own trunk: cheap. Another bundle's lane: costly; next to it: a little.
      const owner = grid.owner[next], near = grid.near[next];
      const lane = owner === bundle ? 0.3 : 1 + (owner ? 5 : 0) + (near && near !== bundle ? 2 : 0);
      const step = lane + grid.slow[next] + (nd !== dir ? BEND : 0);
      const nextState = next * 4 + nd;
      const total = base + step;
      if (!known(nextState) || total < cost[nextState]) {
        stamp[nextState] = run;
        cost[nextState] = total;
        previous[nextState] = state;
        // Distance, plus a bend when not lined up with the goal (slightly greedy).
        heap.push(total + 1.2 * estimate(nx, ny), nextState);
      }
    }
  }
  if (found < 0) return null;
  const states: number[] = [];
  for (let state = found; state >= 0; state = previous[state]) states.push(state);
  states.reverse();
  const cells = states.map(state => state >> 2);
  // Keep the corners only.
  const points = cells.map(cell => ({ x: (cell % cols) * CELL, y: Math.floor(cell / cols) * CELL }));
  const corners: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = corners[corners.length - 1], b = points[i], c = points[i + 1];
    const straight = (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y);
    if (!straight) corners.push(b);
  }
  corners.push(points[points.length - 1]);
  return { points: corners, cells, cost: cost[found], start: startStates.get(states[0])!, goal: goalStates.get(found)! };
}

/** Marks a chosen path: its own bundle may reuse it, the others keep apart. */
function claimPath(grid: Grid, cells: number[], bundle: number) {
  const claim = (target: Int32Array, cell: number) => { target[cell] = target[cell] === 0 || target[cell] === bundle ? bundle : -1; };
  for (const cell of cells) {
    claim(grid.owner, cell);
    for (const near of [cell - 1, cell + 1, cell - grid.cols, cell + grid.cols]) if (near >= 0 && near < grid.near.length) claim(grid.near, near);
  }
}

const PORTS_ONLY = /^[\d\s,;/·-]+$/;

function labelSize(text: string) {
  return { width: Math.ceil(text.length * 6.4) + 14, height: 18 };
}

function routeAll(topology: NetworkTopology, placement: Placement): PlacedEdge[] {
  const boxes = new Map<string, PlacedBox>([...placement.nodes, ...placement.groups].map(box => [box.id, box]));
  const groupOfNode = new Map(topology.nodes.map(node => [node.id, node.groupId]));
  const groupBox = (id: string | undefined) => (id ? placement.groups.find(group => group.id === id) : undefined);
  // Layer headings: a dot and a short uppercase word, kept clear of links.
  const headings: PlacedBox[] = placement.layers.map(layer => ({ id: layer.type, x: layer.x, y: layer.y, width: 150, height: 18 }));
  const grid = buildGrid(placement.width, placement.height, placement.nodes, placement.groups, headings, placement.column);
  const groupIndex = new Map(placement.groups.map((box, index) => [box.id, index + 1]));

  // Sides first, so links sharing a side are spread along it.
  const valid = topology.connections.filter(connection => boxes.has(connection.fromId) && boxes.has(connection.toId) && connection.fromId !== connection.toId);
  // A side is usable when there is room in front of it for a link to leave.
  const everything = [...placement.nodes, ...placement.groups];
  const roomy = (box: PlacedBox, side: Side) => {
    const own = groupOfNode.get(box.id);
    const depth = 24, span = Math.min(40, (side === 'top' || side === 'bottom' ? box.width : box.height) / 2);
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    const probe = side === 'top' ? { x: cx - span / 2, y: box.y - depth, width: span, height: depth - 1 }
      : side === 'bottom' ? { x: cx - span / 2, y: box.y + box.height + 1, width: span, height: depth - 1 }
      : side === 'left' ? { x: box.x - depth, y: cy - span / 2, width: depth - 1, height: span }
      : { x: box.x + box.width + 1, y: cy - span / 2, width: depth - 1, height: span };
    return !everything.some(other => other.id !== box.id && other.id !== own && groupOfNode.get(other.id) !== box.id
      && probe.x < other.x + other.width && other.x < probe.x + probe.width && probe.y < other.y + other.height && other.y < probe.y + probe.height);
  };
  // A side chosen in the link dialog is tried first, but it is a preference:
  // when the map leaves no room there (it may come from an older layout),
  // the other sides are used rather than a line through the cards.
  const fixedSide = (port: NetworkConnection['fromPort']): Side | undefined => (port && port !== 'auto' ? port : undefined);
  const usable = (box: PlacedBox, port: NetworkConnection['fromPort']): Side[] => {
    const fixed = fixedSide(port);
    // Groups are entered from the side, like rows of a table.
    const sides = placement.groups.some(group => group.id === box.id) ? (['left', 'right'] as Side[]) : allowedSides(box, groupBox(groupOfNode.get(box.id)));
    const free = sides.filter(side => roomy(box, side));
    const auto = free.length ? free : sides;
    return fixed ? [fixed, ...auto.filter(side => side !== fixed)] : auto;
  };
  const items = valid.map(connection => {
    const from = boxes.get(connection.fromId)!;
    const to = boxes.get(connection.toId)!;
    return {
      connection, from, to,
      fromAllowed: usable(from, connection.fromPort), toAllowed: usable(to, connection.toPort),
      fromFixed: fixedSide(connection.fromPort), toFixed: fixedSide(connection.toPort),
    };
  });

  // One bundle per source: its links share a trunk (cheap to reuse), other
  // sources keep to their own lanes.
  const bundles = new Map<string, number>();
  const bundleOf = (id: string) => {
    if (!bundles.has(id)) bundles.set(id, bundles.size + 1);
    return bundles.get(id)!;
  };
  // A trunk leaves a side from one point; arrivals on a side spread out from its middle.
  const arrivals = new Map<string, number>();
  const arrivalPoint = (box: PlacedBox, side: Side, reserve: boolean) => {
    const key = [box.id, side].join('|');
    const index = arrivals.get(key) ?? 0;
    if (reserve) arrivals.set(key, index + 1);
    const length = side === 'top' || side === 'bottom' ? box.width : box.height;
    const step = Math.min(14, length / 6);
    const offset = index === 0 ? 0 : Math.ceil(index / 2) * step * (index % 2 ? -1 : 1);
    const t = Math.min(0.9, Math.max(0.1, 0.5 + offset / length));
    return portPoint(box, side, 0, 1, t);
  };

  // Sources with the most links first, the longest link of a source first:
  // it lays the trunk the shorter ones branch off.
  const distance = (item: typeof items[number]) => Math.abs(item.from.x - item.to.x) + Math.abs(item.from.y - item.to.y);
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.connection.fromId, (counts.get(item.connection.fromId) ?? 0) + 1);
  const ordered = [...items].sort((a, b) =>
    counts.get(b.connection.fromId)! - counts.get(a.connection.fromId)!
    || bundleOf(a.connection.fromId) - bundleOf(b.connection.fromId)
    || distance(b) - distance(a));

  // Labels avoid the cards, the group titles and each other.
  const obstacles: Rect[] = [
    ...placement.nodes,
    ...headings,
    ...placement.groups.map(box => ({ id: box.id, x: box.x, y: box.y, width: box.width, height: GROUP_PAD.top - 4 })),
  ].map(box => ({ id: box.id, x: box.x, y: box.y, width: box.width, height: box.height }));
  // What a straight line may not cross: cards, group titles, layer headings,
  // and groups other than those holding an end.
  const blockers = (connection: NetworkConnection) => {
    const own = new Set([connection.fromId, connection.toId, groupOfNode.get(connection.fromId), groupOfNode.get(connection.toId)].filter(Boolean) as string[]);
    return [
      ...placement.nodes.filter(box => !own.has(box.id)),
      ...placement.groups.filter(box => !own.has(box.id)),
      ...placement.groups.filter(box => own.has(box.id) && box.id !== connection.fromId && box.id !== connection.toId)
        .map(box => ({ ...box, height: GROUP_PAD.top - 4 })),
      ...headings,
    ];
  };
  const reserveLine = (points: Point[]) => {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const length = Math.max(CELL, Math.abs(b.x - a.x) + Math.abs(b.y - a.y));
      for (let t = 0; t <= 1; t += CELL / length) {
        const cell = Math.round((a.y + (b.y - a.y) * t) / CELL) * grid.cols + Math.round((a.x + (b.x - a.x) * t) / CELL);
        if (cell >= 0 && cell < grid.owner.length) grid.owner[cell] = -1;
      }
    }
  };
  const place = (connection: NetworkConnection, points: Point[], short = false) => {
    // Port lists ("8096, 4533") are shown on the cards, not along the links.
    const text = connection.label?.trim();
    const label = text && !PORTS_ONLY.test(text) ? labelOn(points, text, obstacles, placement) : undefined;
    if (label && !label.crowded) obstacles.push(label);
    edges.push({ id: connection.id, connection, points, ...(short ? { short } : {}), ...(label ? { label } : {}) });
  };

  const edges: PlacedEdge[] = [];
  for (const item of ordered) {
    const { connection, from, to } = item;
    // Facing each other with nothing in between: a straight line.
    const direct = straightLine(from, to, connection, blockers);
    if (direct) {
      reserveLine(direct);
      const length = Math.abs(direct[1].x - direct[0].x) + Math.abs(direct[1].y - direct[0].y);
      place(connection, direct, length < (connection.type === 'bidirectional' ? 28 : 18));
      continue;
    }
    const bundle = bundleOf(connection.fromId);
    // Passable: free cells and the groups holding either end, never a card
    // (links leave and enter a card straight from its side). A link to a
    // group stops at its border; one to a card crosses the card's group.
    const openGroups = new Set([
      groupIndex.get(groupOfNode.get(connection.fromId) ?? ''), groupIndex.get(groupOfNode.get(connection.toId) ?? ''),
    ].filter(Boolean) as number[]);
    const strict = (cell: number) => {
      if (grid.card[cell] || grid.title[cell]) return false;
      const g = grid.group[cell];
      return !g || openGroups.has(g);
    };
    const loose = (cell: number) => !grid.card[cell];

    // Every sensible pair of sides is tried and the cheapest path wins
    // (length, bends, crossing other lanes; reusing the own trunk is cheap).
    // Sides turned away from the other end are skipped unless nothing else works.
    const toward = (box: PlacedBox, other: PlacedBox, side: Side) => {
      const d = DIRS[SIDE_DIR[side]];
      return d.x * (other.x + other.width / 2 - (box.x + box.width / 2)) + d.y * (other.y + other.height / 2 - (box.y + box.height / 2));
    };
    const facing = (box: PlacedBox, other: PlacedBox, allowed: Side[]) => {
      const good = allowed.filter(side => toward(box, other, side) > -box.width / 2);
      return good.length ? good : allowed;
    };
    const search = (fromSides: Side[], toSides: Side[], passable: (cell: number) => boolean) => {
      const starts = fromSides.map(side => ({ point: outside(portPoint(from, side, 0, 1), side), dir: SIDE_DIR[side] }));
      const goals = toSides.map(side => ({ point: outside(arrivalPoint(to, side, false), side), dir: (SIDE_DIR[side] + 2) & 3 }));
      const found = route(grid, starts, goals, passable, bundle);
      return found ? { found, fs: fromSides[found.start], ts: toSides[found.goal] } : null;
    };
    let best = search(facing(from, to, item.fromAllowed), facing(to, from, item.toAllowed), strict)
      ?? search(item.fromAllowed, item.toAllowed, strict)
      ?? search(item.fromAllowed, item.toAllowed, loose);
    // A side chosen in the link dialog is kept when it costs about the same.
    if (item.fromFixed || item.toFixed) {
      const chosen = search(item.fromFixed ? [item.fromFixed] : facing(from, to, item.fromAllowed), item.toFixed ? [item.toFixed] : facing(to, from, item.toAllowed), strict);
      if (chosen && (!best || chosen.found.cost <= best.found.cost * 1.5 + 40)) best = chosen;
    }
    if (!best) {
      // No way around at all (a card walled in): the shortest elbow, drawn anyway.
      const fs = facingSide(from, to, item.fromAllowed), ts = facingSide(to, from, item.toAllowed);
      const s = portPoint(from, fs, 0, 1), e = arrivalPoint(to, ts, true);
      const a = outside(s, fs), b = outside(e, ts);
      place(connection, alignOrthogonal([s, a, { x: b.x, y: a.y }, b, e], fs, ts));
      continue;
    }
    claimPath(grid, best.found.cells, bundle);
    const start = portPoint(from, best.fs, 0, 1);
    const end = arrivalPoint(to, best.ts, true);
    place(connection, alignOrthogonal([start, ...best.found.points, end], best.fs, best.ts));
  }
  // Back in the order of the topology (stable drawing order).
  const order = new Map(topology.connections.map((connection, index) => [connection.id, index]));
  return edges.sort((x, y) => (order.get(x.id) ?? 0) - (order.get(y.id) ?? 0));
}

/** A straight vertical or horizontal link when the two boxes face each other over a free gap. */
function straightLine(from: PlacedBox, to: PlacedBox, connection: NetworkConnection, blockers: (connection: NetworkConnection) => Rect[]): Point[] | null {
  const clear = (rect: Rect) => !blockers(connection).some(other =>
    rect.x < other.x + other.width && other.x < rect.x + rect.width && rect.y < other.y + other.height && other.y < rect.y + rect.height);
  // Across the facing stretch: its middle first, then other positions, so a
  // heading or a card in the way does not force a detour.
  const positions = (low: number, high: number) => {
    const middle = Math.round((low + high) / 2);
    const others: number[] = [];
    for (let at = Math.round(high); at >= low; at -= CELL) if (Math.abs(at - middle) >= CELL / 2) others.push(at);
    return [middle, ...others];
  };
  const left = Math.max(from.x, to.x) + 12, right = Math.min(from.x + from.width, to.x + to.width) - 12;
  if (right - left >= 0) {
    const [upper, lower] = from.y < to.y ? [from, to] : [to, from];
    const top = upper.y + upper.height, bottom = lower.y;
    if (bottom - top >= 8) for (const x of positions(left, right)) {
      if (clear({ x: x - 3, y: top, width: 6, height: bottom - top })) return from === upper ? [{ x, y: top }, { x, y: bottom }] : [{ x, y: bottom }, { x, y: top }];
    }
  }
  const high = Math.max(from.y, to.y) + 10, low = Math.min(from.y + from.height, to.y + to.height) - 10;
  if (low - high >= 0) {
    const [first, second] = from.x < to.x ? [from, to] : [to, from];
    const start = first.x + first.width, end = second.x;
    if (end - start >= 8) for (const y of positions(high, low)) {
      if (clear({ x: start, y: y - 3, width: end - start, height: 6 })) return from === first ? [{ x: start, y }, { x: end, y }] : [{ x: end, y }, { x: start, y }];
    }
  }
  return null;
}

/** Makes the first and last segments perpendicular to their sides and every segment orthogonal. */
function alignOrthogonal(points: Point[], fromSide: Side, toSide: Side): Point[] {
  const out = points.map(point => ({ ...point }));
  const vertical = (side: Side) => side === 'top' || side === 'bottom';
  // The first run leaves straight out of the source port, the last one
  // enters the target port: the grid lanes they follow are moved onto them.
  const snapRun = (from: number, step: number, side: Side) => {
    const axis = vertical(side) ? 'x' : 'y';
    const lane = out[from + step]?.[axis];
    const value = out[from][axis];
    for (let i = from + step; i >= 0 && i < out.length && Math.abs(out[i][axis] - lane) < 0.5; i += step) out[i][axis] = value;
  };
  if (out.length > 2) {
    snapRun(0, 1, fromSide);
    snapRun(out.length - 1, -1, toSide);
  }
  // Repair any diagonal left by the snapping with an elbow.
  const result: Point[] = [out[0]];
  for (let i = 1; i < out.length; i++) {
    const a = result[result.length - 1], b = out[i];
    if (Math.abs(a.x - b.x) > 0.5 && Math.abs(a.y - b.y) > 0.5) {
      const nextIsVertical = i + 1 < out.length && Math.abs(out[i + 1].x - b.x) < 0.5;
      result.push(nextIsVertical ? { x: a.x, y: b.y } : { x: b.x, y: a.y });
    }
    result.push(b);
  }
  // Drop repeated and collinear points.
  const clean: Point[] = [];
  for (const point of result) {
    const last = clean[clean.length - 1];
    if (last && Math.abs(last.x - point.x) < 0.5 && Math.abs(last.y - point.y) < 0.5) continue;
    if (clean.length >= 2) {
      const p = clean[clean.length - 2];
      const q = clean[clean.length - 1];
      if ((Math.abs(p.x - q.x) < 0.5 && Math.abs(q.x - point.x) < 0.5) || (Math.abs(p.y - q.y) < 0.5 && Math.abs(q.y - point.y) < 0.5)) clean.pop();
    }
    clean.push(point);
  }
  return clean;
}

/** Label on the longest segment where it hides no card, title or other label. */
function labelOn(points: Point[], text: string, obstacles: Rect[], bounds: { width: number; height: number }): NonNullable<PlacedEdge['label']> {
  const size = labelSize(text);
  const clear = (box: { x: number; y: number; width: number; height: number }) =>
    box.x >= 2 && box.y >= 2 && box.x + box.width <= bounds.width - 2 && box.y + box.height <= bounds.height - 2 &&
    !obstacles.some(other => box.x < other.x + other.width + 2 && other.x < box.x + box.width + 2 && box.y < other.y + other.height + 2 && other.y < box.y + box.height + 2);
  const candidates: Array<{ x: number; y: number; length: number }> = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const length = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    // Along the segment: its middle first, then towards both ends.
    for (const t of [0.5, 0.35, 0.65, 0.2, 0.8]) candidates.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, length });
  }
  candidates.sort((p, q) => q.length - p.length);
  const boxAt = (point: { x: number; y: number }) => ({ text, ...size, x: point.x - size.width / 2, y: point.y - size.height / 2 });
  for (const candidate of candidates) {
    const box = boxAt(candidate);
    if (clear(box)) return box;
  }
  const fallback = boxAt(candidates[0]);
  fallback.x = Math.min(Math.max(2, fallback.x), bounds.width - size.width - 2);
  return { ...fallback, crowded: true };
}

/** SVG path through orthogonal points, with rounded corners. */
export function roundedPath(points: Point[], radius = 8): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const previous = points[i - 1];
    const current = points[i];
    const next = points[i + 1];
    const inLength = Math.hypot(current.x - previous.x, current.y - previous.y);
    const outLength = Math.hypot(next.x - current.x, next.y - current.y);
    const r = Math.min(radius, inLength / 2, outLength / 2);
    if (r < 0.5) { d += ` L ${current.x} ${current.y}`; continue; }
    const before = { x: current.x - ((current.x - previous.x) / inLength) * r, y: current.y - ((current.y - previous.y) / inLength) * r };
    const after = { x: current.x + ((next.x - current.x) / outLength) * r, y: current.y + ((next.y - current.y) / outLength) * r };
    d += ` L ${before.x} ${before.y} Q ${current.x} ${current.y} ${after.x} ${after.y}`;
  }
  const last = points[points.length - 1];
  return `${d} L ${last.x} ${last.y}`;
}

/** Places and routes a topology for a block `width` pixels wide. */
export function layoutTopology(topology: NetworkTopology, width: number, size: TopologyCardSize): TopologyLayout {
  const placement = place(topology, width, size);
  return { ...placement, edges: routeAll(topology, placement) };
}
