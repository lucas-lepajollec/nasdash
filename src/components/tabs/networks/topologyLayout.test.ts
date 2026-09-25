import { describe, expect, it } from 'vitest';
import type { NetworkTopology } from '@/lib/types';
import { layoutTopology, roundedPath, type PlacedBox } from './topologyLayout';

/** A homelab-like map: a box and a router, machines, DNS, and grouped apps. */
function homelab(): NetworkTopology {
  const nodes: NetworkTopology['nodes'] = [
    { id: 'box', name: 'Box', type: 'infra', icon: '🌐' },
    { id: 'router', name: 'Routeur', type: 'infra', icon: '📶' },
    { id: 'nas', name: 'NAS', type: 'device', icon: '🖥️' },
    { id: 'pc', name: 'Tour PC', type: 'device', icon: '🖥️' },
    { id: 'ha', name: 'Home Assistant', type: 'device', icon: '🏠' },
    { id: 'dns', name: 'Pi-hole', type: 'netsvc', icon: '🛡️', groupId: 'g-net' },
    { id: 'proxy', name: 'Reverse proxy', type: 'netsvc', icon: '🔀', groupId: 'g-net' },
  ];
  const groups: NetworkTopology['groups'] = [
    { id: 'g-net', name: 'Réseau', type: 'netsvc' },
    { id: 'g-media', name: 'Médias', type: 'stdsvc' },
    { id: 'g-ai', name: 'IA', type: 'stdsvc' },
  ];
  for (let i = 0; i < 8; i++) nodes.push({ id: `m${i}`, name: `Media ${i}`, type: 'stdsvc', icon: '🎬', groupId: 'g-media' });
  for (let i = 0; i < 4; i++) nodes.push({ id: `a${i}`, name: `AI ${i}`, type: 'stdsvc', icon: '🤖', groupId: 'g-ai' });
  const connections: NetworkTopology['connections'] = [
    { id: 'c1', fromId: 'box', toId: 'router', type: 'bidirectional' },
    { id: 'c2', fromId: 'router', toId: 'nas' },
    { id: 'c3', fromId: 'router', toId: 'pc' },
    { id: 'c4', fromId: 'router', toId: 'ha', label: 'Wi-Fi' },
    { id: 'c5', fromId: 'nas', toId: 'g-media', label: '443' },
    { id: 'c6', fromId: 'pc', toId: 'g-ai' },
    { id: 'c7', fromId: 'proxy', toId: 'g-media' },
    { id: 'c8', fromId: 'dns', toId: 'router', fromPort: 'left', toPort: 'bottom' },
    { id: 'c9', fromId: 'nas', toId: 'dns' },
  ];
  return { nodes, groups, connections };
}

const inside = (x: number, y: number, box: PlacedBox, margin = 1) =>
  x > box.x + margin && x < box.x + box.width - margin && y > box.y + margin && y < box.y + box.height - margin;

const onBorder = (x: number, y: number, box: PlacedBox, tolerance = 2) =>
  x >= box.x - tolerance && x <= box.x + box.width + tolerance && y >= box.y - tolerance && y <= box.y + box.height + tolerance && !inside(x, y, box, tolerance);

describe.each([1400, 700] as const)('network map layout (%s px)', width => {
  it('places every node without overlaps', () => {
    const topology = homelab();
    const layout = layoutTopology(topology, width, 'standard');
    expect(layout.nodes).toHaveLength(topology.nodes.length);
    for (let a = 0; a < layout.nodes.length; a++) {
      for (let b = a + 1; b < layout.nodes.length; b++) {
        const p = layout.nodes[a], q = layout.nodes[b];
        const overlap = p.x < q.x + q.width && q.x < p.x + p.width && p.y < q.y + q.height && q.y < p.y + p.height;
        expect(overlap, `${p.id} / ${q.id}`).toBe(false);
      }
    }
    // Nodes stay inside their group box.
    for (const placed of layout.nodes.filter(item => item.node.groupId)) {
      const group = layout.groups.find(item => item.id === placed.node.groupId)!;
      expect(placed.x >= group.x && placed.x + placed.width <= group.x + group.width, placed.id).toBe(true);
    }
    // Groups do not overlap either, and the map fits its width when it can.
    for (let a = 0; a < layout.groups.length; a++) {
      for (let b = a + 1; b < layout.groups.length; b++) {
        const p = layout.groups[a], q = layout.groups[b];
        expect(p.x < q.x + q.width && q.x < p.x + p.width && p.y < q.y + q.height && q.y < p.y + p.height, `${p.id} / ${q.id}`).toBe(false);
      }
    }
    expect(layout.width).toBe(width);
  });

  it('keeps infrastructure, machines and network services left of the apps on wide maps', () => {
    if (width < 1000) return;
    const layout = layoutTopology(homelab(), width, 'standard');
    const appsLeft = Math.min(...layout.nodes.filter(item => item.node.type === 'stdsvc').map(item => item.x));
    for (const item of layout.nodes.filter(node => node.node.type !== 'stdsvc')) expect(item.x + item.width < appsLeft, item.id).toBe(true);
  });

  it('routes every link from its source to its target, orthogonally', () => {
    const topology = homelab();
    const layout = layoutTopology(topology, width, 'standard');
    const boxes = new Map<string, PlacedBox>([...layout.nodes, ...layout.groups].map(item => [item.id, item]));
    expect(layout.edges).toHaveLength(topology.connections.length);
    for (const edge of layout.edges) {
      const start = edge.points[0];
      const end = edge.points[edge.points.length - 1];
      expect(onBorder(start.x, start.y, boxes.get(edge.connection.fromId)!), `${edge.id} start`).toBe(true);
      expect(onBorder(end.x, end.y, boxes.get(edge.connection.toId)!), `${edge.id} end`).toBe(true);
      for (let i = 1; i < edge.points.length; i++) {
        const a = edge.points[i - 1], b = edge.points[i];
        expect(Math.abs(a.x - b.x) < 0.5 || Math.abs(a.y - b.y) < 0.5, `${edge.id} segment ${i}`).toBe(true);
      }
    }
  });

  it('never runs a link through a card it does not connect', () => {
    const topology = homelab();
    const layout = layoutTopology(topology, width, 'standard');
    for (const edge of layout.edges) {
      const ends = new Set([edge.connection.fromId, edge.connection.toId]);
      for (const node of layout.nodes) {
        if (ends.has(node.id) || (node.node.groupId && ends.has(node.node.groupId))) continue;
        for (let i = 1; i < edge.points.length; i++) {
          const a = edge.points[i - 1], b = edge.points[i];
          for (let t = 0.1; t < 1; t += 0.1) {
            expect(inside(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, node, 2), `${edge.id} crosses ${node.id}`).toBe(false);
          }
        }
      }
    }
  });
});

describe('rounded path', () => {
  it('draws straight segments and rounded corners', () => {
    expect(roundedPath([{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBe('M 0 0 L 10 0');
    expect(roundedPath([{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }])).toContain('Q 40 0');
  });
});

/** Small deterministic random generator, so a failing map can be replayed. */
function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function randomTopology(seed: number): NetworkTopology {
  const random = rng(seed);
  const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)];
  const types = ['infra', 'device', 'netsvc', 'stdsvc'] as const;
  const groups: NetworkTopology['groups'] = [];
  const nodes: NetworkTopology['nodes'] = [];
  const groupCount = Math.floor(random() * 9);
  for (let g = 0; g < groupCount; g++) groups.push({ id: `g${g}`, name: `Group ${g}`, type: random() < 0.7 ? 'stdsvc' : pick(types) });
  const nodeCount = 2 + Math.floor(random() * 45);
  for (let n = 0; n < nodeCount; n++) {
    const inGroup = groups.length && random() < 0.6 ? pick(groups) : undefined;
    nodes.push({ id: `n${n}`, name: `Node ${n}`, type: inGroup ? inGroup.type : pick(types), icon: '📦', ...(inGroup ? { groupId: inGroup.id } : {}) });
  }
  const ends = [...nodes.map(node => node.id), ...groups.map(group => group.id)];
  const sides = ['auto', 'top', 'right', 'bottom', 'left'] as const;
  const connections: NetworkTopology['connections'] = [];
  const linkCount = Math.floor(random() * (nodeCount * 1.2));
  for (let c = 0; c < linkCount; c++) {
    const fromId = pick(ends), toId = pick(ends);
    if (fromId === toId) continue;
    connections.push({
      id: `c${c}`, fromId, toId,
      type: random() < 0.2 ? 'bidirectional' : 'directional',
      ...(random() < 0.25 ? { fromPort: pick(sides), toPort: pick(sides) } : {}),
      ...(random() < 0.3 ? { label: random() < 0.5 ? '8080, 8081' : 'LAN' } : {}),
    });
  }
  return { nodes, groups, connections };
}

/** Which side of `box` a border point lies on, if any. */
function sideOf(point: { x: number; y: number }, box: PlacedBox): 'top' | 'right' | 'bottom' | 'left' | null {
  const near = (a: number, b: number) => Math.abs(a - b) <= 2;
  const withinX = point.x >= box.x - 2 && point.x <= box.x + box.width + 2;
  const withinY = point.y >= box.y - 2 && point.y <= box.y + box.height + 2;
  if (withinX && near(point.y, box.y)) return 'top';
  if (withinX && near(point.y, box.y + box.height)) return 'bottom';
  if (withinY && near(point.x, box.x)) return 'left';
  if (withinY && near(point.x, box.x + box.width)) return 'right';
  return null;
}

describe('network map layout on random maps', () => {
  const cases: Array<[number, number, 'standard' | 'compact' | 'mini']> = [];
  for (let seed = 1; seed <= 240; seed++) cases.push([seed, [420, 760, 1120, 1500, 1900][seed % 5], (['standard', 'compact', 'mini'] as const)[seed % 3]]);

  it.each(cases)('map %i at %i px (%s) is clean', (seed, width, size) => {
    const topology = randomTopology(seed);
    const layout = layoutTopology(topology, width, size);
    const boxes = new Map<string, PlacedBox>([...layout.nodes, ...layout.groups].map(item => [item.id, item]));
    const problems: string[] = [];
    const check = (ok: boolean, message: string) => { if (!ok) problems.push(message); };
    for (let a = 0; a < layout.nodes.length; a++) for (let b = a + 1; b < layout.nodes.length; b++) {
      const p = layout.nodes[a], q = layout.nodes[b];
      check(!(p.x < q.x + q.width && q.x < p.x + p.width && p.y < q.y + q.height && q.y < p.y + p.height), `${p.id} overlaps ${q.id}`);
    }
    const out = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] } as const;
    for (const edge of layout.edges) {
      const from = boxes.get(edge.connection.fromId)!, to = boxes.get(edge.connection.toId)!;
      const points = edge.points;
      const first = points[0], last = points[points.length - 1];
      const startSide = sideOf(first, from), endSide = sideOf(last, to);
      if (!startSide || !endSide) { problems.push(`${edge.id} does not end on its boxes`); continue; }
      // Leaves and enters straight: the first segment goes out of the source, the last one into the target.
      const [ox, oy] = out[startSide];
      check(Math.sign(points[1].x - first.x) === ox && Math.sign(points[1].y - first.y) === oy, `${edge.id} does not leave outwards`);
      const [ix, iy] = out[endSide];
      const before = points[points.length - 2];
      check(Math.sign(before.x - last.x) === ix && Math.sign(before.y - last.y) === iy, `${edge.id} does not enter from outside`);
      check(Math.abs(before.x - last.x) + Math.abs(before.y - last.y) >= 6, `${edge.id} arrow hidden`);
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i];
        check(Math.abs(a.x - b.x) < 0.5 || Math.abs(a.y - b.y) < 0.5, `${edge.id} diagonal`);
        // No U-turn: a segment never goes back along the previous one.
        if (i >= 2) {
          const p = points[i - 2];
          check((a.x - p.x) * (b.x - a.x) + (a.y - p.y) * (b.y - a.y) >= 0, `${edge.id} U-turn`);
        }
      }
      // Never through a card other than its ends.
      for (const node of layout.nodes) {
        if (node.id === edge.connection.fromId || node.id === edge.connection.toId) continue;
        for (let i = 1; i < points.length; i++) {
          const a = points[i - 1], b = points[i];
          const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
          if (x0 < node.x + node.width - 1 && x1 > node.x + 1 && y0 < node.y + node.height - 1 && y1 > node.y + 1) problems.push(`${edge.id} crosses ${node.id}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
