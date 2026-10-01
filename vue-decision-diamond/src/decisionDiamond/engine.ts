import type { BuilderEdge, BuilderNode, DecisionDiamondConfig, DDGroup } from './types';
import { uid } from './types';
import { entitiesForNodeName, type EntityId } from './entities';

const NODE_W = 130;
const PH_GAP = 80;

export function makeBlankGroup(targetFlowId: string, targetName: string): DDGroup {
  return {
    id: uid('g'),
    targetFlowId,
    targetName,
    blocks: [],
  };
}

/** Walk upstream from a diamond and return the slug of the closest
 *  trigger node, or `null` if no trigger is reachable. Used by the
 *  decision-diamond editor to scope the field dropdown to the
 *  attributes that this specific trigger actually exposes (per the
 *  Confluence "Complete Trigger Entity Attribute Reference"). */
export function upstreamTriggerSlug(
  diamondId: string,
  nodes: BuilderNode[],
  edges: BuilderEdge[],
): string | null {
  const queue: string[] = [diamondId];
  const visited = new Set<string>([diamondId]);
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const e of edges) {
      if (e.to !== id) continue;
      if (visited.has(e.from)) continue;
      visited.add(e.from);
      const node = nodes.find((n) => n.id === e.from);
      if (node?.type === 'trigger' && node.name) {
        return node.name;
      }
      queue.push(e.from);
    }
  }
  return null;
}

/** BFS both directions from `diamondId`, return entity union of all reachable nodes. */
export function relevantEntitiesFor(
  diamondId: string,
  nodes: BuilderNode[],
  edges: BuilderEdge[],
  boundEntity?: EntityId,
): Set<EntityId> {
  const adjOut = new Map<string, string[]>();
  const adjIn = new Map<string, string[]>();
  for (const e of edges) {
    if (!adjOut.has(e.from)) adjOut.set(e.from, []);
    adjOut.get(e.from)!.push(e.to);
    if (!adjIn.has(e.to)) adjIn.set(e.to, []);
    adjIn.get(e.to)!.push(e.from);
  }
  const visited = new Set<string>();
  const queue: string[] = [diamondId];
  visited.add(diamondId);
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const nb of adjOut.get(id) ?? []) {
      if (!visited.has(nb)) {
        visited.add(nb);
        queue.push(nb);
      }
    }
    for (const nb of adjIn.get(id) ?? []) {
      if (!visited.has(nb)) {
        visited.add(nb);
        queue.push(nb);
      }
    }
  }
  const entities = new Set<EntityId>();
  for (const nid of visited) {
    const node = nodes.find((n) => n.id === nid);
    if (!node) continue;
    for (const eid of entitiesForNodeName(node.name)) {
      entities.add(eid);
    }
  }
  if (boundEntity) entities.add(boundEntity);
  return entities;
}

/** Sync a diamond's groups with its outgoing edges (1:1 invariant). */
export function syncGroupsToEdges(
  config: DecisionDiamondConfig,
  diamondId: string,
  nodes: BuilderNode[],
  edges: BuilderEdge[],
): DecisionDiamondConfig {
  const outgoing = edges.filter((e) => e.from === diamondId);
  const byTarget = new Map(config.groups.map((g) => [g.targetFlowId, g]));
  const nextGroups: DDGroup[] = outgoing.map((e) => {
    const existing = byTarget.get(e.to);
    const target = nodes.find((n) => n.id === e.to);
    const name = target?.title ?? 'Sequence';
    if (existing) {
      return { ...existing, targetName: name };
    }
    return makeBlankGroup(e.to, name);
  });
  return { ...config, groups: nextGroups };
}

/** Insert a fresh decision diamond after originId. */
export function insertDecisionDiamondAfter(
  originId: string,
  nodes: BuilderNode[],
  edges: BuilderEdge[],
): { nodes: BuilderNode[]; edges: BuilderEdge[]; diamondId: string } {
  const origin = nodes.find((n) => n.id === originId);
  if (!origin) {
    return { nodes, edges, diamondId: '' };
  }
  const diamondId = uid('d');
  const diamond: BuilderNode = {
    id: diamondId,
    type: 'decision',
    title: 'Decision',
    x: origin.x + NODE_W + PH_GAP,
    y: origin.y,
  };
  return {
    nodes: [...nodes, diamond],
    edges: [
      ...edges,
      { id: uid('e'), from: originId, to: diamondId },
    ],
    diamondId,
  };
}

/** Run the dissolve pass: any diamond with exactly 1 outgoing edge is removed
 *  and its incoming sources connected directly to the remaining target. */
export function dissolveCollapsedDiamonds(
  nodesIn: BuilderNode[],
  edgesIn: BuilderEdge[],
): { nodes: BuilderNode[]; edges: BuilderEdge[]; changed: boolean } {
  let nodes = nodesIn;
  let edges = edgesIn;
  let changed = false;
  const diamonds = nodes.filter((n) => n.type === 'decision');
  for (const d of diamonds) {
    const outgoing = edges.filter((e) => e.from === d.id);
    if (outgoing.length !== 1) continue;
    const incoming = edges.filter((e) => e.to === d.id);
    edges = edges.filter((e) => e.from !== d.id && e.to !== d.id);
    nodes = nodes.filter((n) => n.id !== d.id);
    for (const inc of incoming) {
      for (const out of outgoing) {
        edges = [
          ...edges,
          { id: uid('e-diss'), from: inc.from, to: out.to },
        ];
      }
    }
    changed = true;
  }
  return { nodes, edges, changed };
}
