// Waypoint navigation for the husks: a small graph of the station's open
// points (room centres, door gaps, window entries), with an edge wherever
// two points can see each other. An enemy with no line of sight to the
// player walks the graph's shortest path instead of pushing at a wall
// forever — so a player hiding in the storage room is found, not safe.

import { hasLineOfSight } from './world.js';

// Open points of the relay deck, matched to the layout in world.js.
const NODE_POINTS = [
  [640, 360], // hub
  [300, 150], // north-west
  [640, 150], // north
  [300, 360], // west
  [640, 600], // south
  [200, 600], // storage room
  [340, 480], // storage door gap
  [892, 340], // east door gap
  [1080, 150], // reactor room
  [1080, 550], // east south
  [980, 360], // east mid
];

export function buildNavGraph(station) {
  const nodes = NODE_POINTS.map(([x, y]) => ({ x, y }));
  // Window entries are nodes too: husks start there.
  for (const w of station.windows) nodes.push({ x: w.entry.x, y: w.entry.y });
  const edges = nodes.map(() => []);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (hasLineOfSight(station, nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y)) {
        edges[i].push(j);
        edges[j].push(i);
      }
    }
  }
  return { nodes, edges };
}

function nearestNode(graph, x, y) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < graph.nodes.length; i++) {
    const dx = graph.nodes[i].x - x;
    const dy = graph.nodes[i].y - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

// Breadth-first shortest path from the node nearest `from` to the node
// nearest `to`. Returns the waypoints (node positions) to walk, or an
// empty list when both points already share a node.
export function findPath(graph, from, to) {
  const start = nearestNode(graph, from.x, from.y);
  const goal = nearestNode(graph, to.x, to.y);
  if (start === goal) return [];
  const prev = new Array(graph.nodes.length).fill(-1);
  const queue = [start];
  prev[start] = start;
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur === goal) break;
    for (const next of graph.edges[cur]) {
      if (prev[next] === -1) {
        prev[next] = cur;
        queue.push(next);
      }
    }
  }
  if (prev[goal] === -1) return [];
  const path = [];
  let cur = goal;
  while (cur !== start) {
    path.unshift(graph.nodes[cur]);
    cur = prev[cur];
  }
  return path;
}
