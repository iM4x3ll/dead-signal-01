// Kestrel-9's relay deck: the station floor plan, its walls, boarded
// windows, weapon lockers and the reactor. Owns the layout data and the
// collision tests; drawing lives in render.js.

import { VIEW_W, VIEW_H, WALL, BOARDS_PER_WINDOW } from './config.js';

// A wall is an axis-aligned rectangle {x, y, w, h}.
function wall(x, y, w, h) {
  return { x, y, w, h };
}

// Window gaps in the outer walls: 90 wide, centred where a window sits.
const GAP = 90;

function outerWalls() {
  const walls = [];
  // Top and bottom walls, with gaps at x=300 and x=980.
  for (const y of [0, VIEW_H - WALL]) {
    walls.push(wall(0, y, 300 - GAP / 2, WALL));
    walls.push(wall(300 + GAP / 2, y, 980 - GAP / 2 - (300 + GAP / 2), WALL));
    walls.push(wall(980 + GAP / 2, y, VIEW_W - (980 + GAP / 2), WALL));
  }
  // Left and right walls, with a gap at y=360.
  for (const x of [0, VIEW_W - WALL]) {
    walls.push(wall(x, 0, WALL, 360 - GAP / 2));
    walls.push(wall(x, 360 + GAP / 2, WALL, VIEW_H - (360 + GAP / 2)));
  }
  return walls;
}

function interiorWalls() {
  return [
    // East divider: splits off the reactor wing, door gap at y 300-380.
    wall(880, WALL, WALL, 300 - WALL),
    wall(880, 380, WALL, 420 - 380),
    // South-west divider: storage room, door gap at x 300-380.
    wall(WALL, 480, 300 - WALL, WALL),
    wall(380, 480, 420 - 380, WALL),
  ];
}

function makeWindow(x, y, side) {
  // breach: where an enemy stands while breaking the boards; entry: where
  // it steps in once the boards are gone.
  const inwards = { top: [0, 1], bottom: [0, -1], left: [1, 0], right: [-1, 0] }[side];
  return {
    x, y, side,
    boards: BOARDS_PER_WINDOW,
    maxBoards: BOARDS_PER_WINDOW,
    shake: 0,
    breach: { x: x + inwards[0] * 14, y: y + inwards[1] * 14 },
    entry: { x: x + inwards[0] * 52, y: y + inwards[1] * 52 },
  };
}

export function buildStation() {
  return {
    walls: [...outerWalls(), ...interiorWalls()],
    windows: [
      makeWindow(300, WALL / 2, 'top'),
      makeWindow(980, WALL / 2, 'top'),
      makeWindow(300, VIEW_H - WALL / 2, 'bottom'),
      makeWindow(980, VIEW_H - WALL / 2, 'bottom'),
      makeWindow(WALL / 2, 360, 'left'),
      makeWindow(VIEW_W - WALL / 2, 360, 'right'),
    ],
    lockers: [
      { x: 110, y: 600, weapon: 'scattergun', price: 1200, label: 'M87 SCATTERGUN' },
      { x: 1150, y: 580, weapon: 'rifle', price: 2000, label: 'VK PULSE RIFLE', needsPower: true },
    ],
    reactor: { x: 1150, y: 130, radius: 34, charging: 0, restored: false },
    playerSpawn: { x: 640, y: 400 },
    labels: [
      { x: 640, y: 120, text: 'RELAY DECK' },
      { x: 1085, y: 260, text: 'REACTOR' },
      { x: 200, y: 560, text: 'STORAGE' },
      { x: 640, y: 660, text: 'KESTREL-9' },
    ],
  };
}

export function pointInWalls(station, x, y) {
  for (const w of station.walls) {
    if (x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h) return true;
  }
  return false;
}

// Push a circle out of every wall it overlaps, then clamp it inside the
// station. Entities breaching a window skip this: they stand in the gap.
export function resolveCircle(station, pos, radius) {
  for (const w of station.walls) {
    const cx = Math.max(w.x, Math.min(pos.x, w.x + w.w));
    const cy = Math.max(w.y, Math.min(pos.y, w.y + w.h));
    const dx = pos.x - cx;
    const dy = pos.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      if (d2 === 0) {
        // Centre inside the wall: push out along the smallest overlap.
        const left = pos.x - w.x;
        const right = w.x + w.w - pos.x;
        const top = pos.y - w.y;
        const bottom = w.y + w.h - pos.y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) pos.x = w.x - radius;
        else if (m === right) pos.x = w.x + w.w + radius;
        else if (m === top) pos.y = w.y - radius;
        else pos.y = w.y + w.h + radius;
      } else {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.y = cy + (dy / d) * radius;
      }
    }
  }
  pos.x = Math.max(WALL + radius, Math.min(VIEW_W - WALL - radius, pos.x));
  pos.y = Math.max(WALL + radius, Math.min(VIEW_H - WALL - radius, pos.y));
}

// True when the straight line between two points crosses no wall.
export function hasLineOfSight(station, x0, y0, x1, y1) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.ceil(dist / 8);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (pointInWalls(station, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
  }
  return true;
}
