// Dead Signal: Kestrel-9 — every number the game balances on.
// Palette, tuning, weapons, enemies, ranks, and the wave table.

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const WALL = 24; // outer wall thickness, in world units

export const PALETTE = {
  floor: '#141a20',
  floorTile: '#171e26',
  floorDark: '#0f1419',
  wall: '#2b3542',
  wallTop: '#3a4656',
  wallEdge: '#4d5c70',
  accent: '#ffb454', // amber: lockers, prompts, reactor
  accentDim: '#8a6a35',
  power: '#54e0c0', // teal: restored power, HUD good
  danger: '#e5484d',
  husk: '#9db08a',
  sprinter: '#e0884d',
  spitter: '#7ec850',
  brute: '#b0486a',
  player: '#e8ecf1',
  text: '#dfe6ee',
  textDim: '#8b98a9',
  hudBg: 'rgba(8, 12, 16, 0.72)',
};

export const PLAYER = {
  hp: 100,
  speed: 215,
  sprint: 290,
  radius: 14,
  interactRange: 70,
  hurtCooldown: 0.35, // seconds of invulnerability after a hit
};

// Weapons: id, display name, damage per pellet, pellets per shot, spread
// (radians of random cone), shots per second, magazine, reserve, reload
// seconds, price in points, and whether it needs reactor power to buy.
export const WEAPONS = {
  sidearm: {
    id: 'sidearm', name: 'P9 SIDEARM', damage: 12, pellets: 1, spread: 0.02,
    rate: 4.5, mag: 12, reserve: Infinity, reload: 1.05, price: 0,
    range: 560, kick: 2, auto: false, ammoPrice: 0,
  },
  scattergun: {
    id: 'scattergun', name: 'M87 SCATTERGUN', damage: 9, pellets: 6, spread: 0.17,
    rate: 1.3, mag: 6, reserve: 48, reload: 1.7, price: 1200,
    range: 400, kick: 6, auto: false, ammoPrice: 300,
  },
  rifle: {
    id: 'rifle', name: 'VK PULSE RIFLE', damage: 13, pellets: 1, spread: 0.035,
    rate: 9, mag: 30, reserve: 180, reload: 1.4, price: 2000,
    range: 640, kick: 1.5, auto: true, ammoPrice: 300, needsPower: true,
  },
};

export const WEAPON_ORDER = ['sidearm', 'scattergun', 'rifle'];

// Enemies: health, speed, body radius, contact damage, points for a kill.
export const ENEMIES = {
  husk: {
    id: 'husk', name: 'HUSK', hp: 30, speed: 56, radius: 15, damage: 10,
    points: 60, color: PALETTE.husk, attackCooldown: 0.85,
  },
  sprinter: {
    id: 'sprinter', name: 'SPRINTER', hp: 20, speed: 118, radius: 13, damage: 8,
    points: 80, color: PALETTE.sprinter, attackCooldown: 0.7,
  },
  spitter: {
    id: 'spitter', name: 'SPITTER', hp: 26, speed: 46, radius: 14, damage: 12,
    points: 100, color: PALETTE.spitter, attackCooldown: 0.9,
    spitRange: 320, spitCooldown: 2.3, globSpeed: 230,
  },
  brute: {
    id: 'brute', name: 'BRUTE', hp: 230, speed: 33, radius: 24, damage: 25,
    points: 250, color: PALETTE.brute, attackCooldown: 1.1,
  },
};

// Service ranks, by points earned in the run.
export const RANKS = [
  { at: 0, name: 'LISTENER' },
  { at: 1500, name: 'RUNNER' },
  { at: 4000, name: 'OPERATOR' },
  { at: 8000, name: 'WARDEN' },
  { at: 14000, name: 'SENTINEL' },
  { at: 22000, name: 'LEGEND' },
];

export function rankFor(points) {
  let rank = RANKS[0];
  for (const r of RANKS) if (points >= r.at) rank = r;
  return rank;
}

export function nextRank(points) {
  for (const r of RANKS) if (points < r.at) return r;
  return null;
}

// Windows: boards per window, seconds an enemy needs to break one board,
// points the player earns repairing one.
export const BOARDS_PER_WINDOW = 3;
export const BOARD_BREAK_TIME = 1.8;
export const REPAIR_POINTS = 10;
export const REPAIR_COOLDOWN = 0.35;

// The reactor: seconds of charging after the player starts it, and the
// one-time bonus for restoring power.
export const REACTOR_CHARGE_TIME = 2.0;
export const POWER_BONUS = 500;

export function roundBonus(round) {
  return 100 + 25 * round;
}

// Wave composition for a round: a shuffled list of enemy types.
// Round 1 is husks only; sprinters join at 2, spitters at 3, brutes at 5.
export function waveComposition(round) {
  const count = 6 + round * 4;
  const types = [];
  const brutes = round >= 5 ? Math.min(4, 1 + Math.floor((round - 5) / 2)) : 0;
  const spitters = round >= 3 ? Math.floor(count * 0.15) : 0;
  const sprinters = round >= 2 ? Math.floor(count * 0.25) : 0;
  for (let i = 0; i < brutes; i++) types.push('brute');
  for (let i = 0; i < spitters; i++) types.push('spitter');
  for (let i = 0; i < sprinters; i++) types.push('sprinter');
  while (types.length < count) types.push('husk');
  // Fisher-Yates shuffle so the mix arrives in a random order.
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }
  return types;
}

// Seconds between spawns in a round: faster as rounds climb, floored.
export function spawnInterval(round) {
  return Math.max(0.35, 1.15 - round * 0.07);
}

export const MAX_ALIVE = 36; // enemies alive at once; the queue waits past it
export const BETWEEN_ROUNDS = 3.0; // breather seconds after a round clears
