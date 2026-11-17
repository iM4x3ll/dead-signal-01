// The husks: spawning, the breach at boarded windows, seeking, spitting,
// contact damage, and death. Enemy behaviour is deliberately simple and
// readable: breach the boards, walk at the player, hit what is close.

import {
  ENEMIES, BOARD_BREAK_TIME, MAX_ALIVE, spawnInterval, waveComposition,
} from './config.js';
import { resolveCircle, hasLineOfSight } from './world.js';
import { findPath } from './nav.js';

let nextId = 1;

export function makeEnemy(type, window) {
  const def = ENEMIES[type];
  const e = {
    id: nextId++,
    type,
    def,
    x: window.breach.x,
    y: window.breach.y,
    hp: def.hp,
    maxHp: def.hp,
    state: window.boards > 0 ? 'breach' : 'seek',
    window,
    breakTimer: 0,
    attackCd: 0,
    spitCd: 1 + Math.random(),
    strafeDir: Math.random() < 0.5 ? -1 : 1,
    strafeTimer: 0,
    flash: 0,
    wobble: Math.random() * Math.PI * 2,
    angle: 0,
    path: null, // waypoints to the player, when the direct line is blocked
    pathTimer: 0,
  };
  if (e.state === 'seek') {
    e.x = window.entry.x;
    e.y = window.entry.y;
  }
  return e;
}

// Build the round's spawn queue: one entry per enemy, with the time (in
// round seconds) it arrives at a window.
export function buildWaveQueue(round) {
  const types = waveComposition(round);
  const interval = spawnInterval(round);
  return types.map((type, i) => ({ type, at: 0.5 + i * interval }));
}

function randomWindow(station) {
  return station.windows[Math.floor(Math.random() * station.windows.length)];
}

export function updateWave(game, dt) {
  const wave = game.wave;
  if (wave.intermission > 0) {
    wave.intermission -= dt;
    if (wave.intermission <= 0) startRound(game, game.round + 1);
    return;
  }
  if (!wave.active) return;
  wave.time += dt;
  // Spawn what is due, while there is room alive.
  while (
    wave.queue.length > 0
    && wave.queue[0].at <= wave.time
    && game.enemies.length < MAX_ALIVE
  ) {
    const spawn = wave.queue.shift();
    game.enemies.push(makeEnemy(spawn.type, randomWindow(game.station)));
  }
  // Round clears when the queue is empty and the last husk is down.
  if (wave.queue.length === 0 && game.enemies.length === 0) {
    endRound(game);
  }
}

export function startRound(game, round) {
  game.round = round;
  game.wave = {
    queue: buildWaveQueue(round),
    time: 0,
    active: true,
    intermission: 0,
  };
  game.pushBanner(`ROUND ${round}`, round === 1 ? 'HOLD THE RELAY' : `${game.wave.queue.length} HOSTILES INBOUND`);
  game.sounds.waveStart();
}

function endRound(game) {
  game.wave.active = false;
  game.wave.intermission = 3.0;
  const bonus = 100 + 25 * game.round;
  game.addPoints(bonus, game.player.x, game.player.y - 30, `ROUND BONUS +${bonus}`);
}

// Move toward a point at the enemy's speed, sliding along walls.
function moveToward(game, e, tx, ty, dt) {
  const dx = tx - e.x;
  const dy = ty - e.y;
  const d = Math.hypot(dx, dy) || 1;
  e.x += (dx / d) * e.def.speed * dt;
  e.y += (dy / d) * e.def.speed * dt;
  resolveCircle(game.station, e, e.def.radius);
}

// Hunt the player: straight at them when they can be seen, along the
// waypoint graph when a wall is in the way (re-pathed every second, since
// the player moves). `wobble` adds the husk's drunken weave.
function hunt(game, e, dt, wobble) {
  const player = game.player;
  if (hasLineOfSight(game.station, e.x, e.y, player.x, player.y)) {
    e.path = null;
    const ang = Math.atan2(player.y - e.y, player.x - e.x)
      + Math.sin(game.time * 1.7 + e.wobble) * wobble;
    e.x += Math.cos(ang) * e.def.speed * dt;
    e.y += Math.sin(ang) * e.def.speed * dt;
    resolveCircle(game.station, e, e.def.radius);
    return;
  }
  e.pathTimer -= dt;
  if (!e.path || e.path.length === 0 || e.pathTimer <= 0) {
    e.path = findPath(game.nav, e, player);
    e.pathTimer = 1.0;
  }
  const wp = e.path[0];
  if (wp) {
    moveToward(game, e, wp.x, wp.y, dt);
    if (Math.hypot(wp.x - e.x, wp.y - e.y) < 24) e.path.shift();
  } else {
    // No path (should not happen): fall back to pushing at the wall.
    moveToward(game, e, player.x, player.y, dt);
  }
}

export function updateEnemies(game, dt) {
  const { player, station } = game;
  for (const e of game.enemies) {
    e.flash = Math.max(0, e.flash - dt);
    e.attackCd = Math.max(0, e.attackCd - dt);
    e.spitCd = Math.max(0, e.spitCd - dt);
    e.wobble += dt * 6;

    if (e.state === 'breach') {
      const w = e.window;
      w.shake = Math.max(w.shake, 0.15);
      e.breakTimer += dt;
      e.angle = Math.atan2(player.y - e.y, player.x - e.x);
      if (e.breakTimer >= BOARD_BREAK_TIME) {
        e.breakTimer = 0;
        w.boards = Math.max(0, w.boards - 1);
        game.sounds.boardBreak();
        game.spawnParticles(w.breach.x, w.breach.y, 6, '#8a6a35');
        if (w.boards === 0) {
          e.state = 'seek';
          e.x = w.entry.x;
          e.y = w.entry.y;
        }
      }
      continue;
    }

    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    e.angle = Math.atan2(dy, dx);

    if (e.type === 'spitter') {
      // Keep its distance: approach past range, back off too close, strafe
      // in between, and spit when it can see the player.
      const range = e.def.spitRange;
      if (dist > range) {
        // Approach: straight in when the player is visible, along the
        // waypoint graph when a wall is in the way.
        hunt(game, e, dt, 0);
      } else {
        let mx = 0;
        let my = 0;
        if (dist < range * 0.7) {
          mx = -dx / dist;
          my = -dy / dist;
        } else {
          e.strafeTimer -= dt;
          if (e.strafeTimer <= 0) {
            e.strafeTimer = 1.2 + Math.random();
            e.strafeDir *= -1;
          }
          mx = (-dy / dist) * e.strafeDir;
          my = (dx / dist) * e.strafeDir;
        }
        e.x += mx * e.def.speed * dt;
        e.y += my * e.def.speed * dt;
        resolveCircle(station, e, e.def.radius);
      }
      if (e.spitCd <= 0 && dist < range + 40 && hasLineOfSight(station, e.x, e.y, player.x, player.y)) {
        e.spitCd = e.def.spitCooldown;
        const speed = e.def.globSpeed;
        game.globs.push({
          x: e.x, y: e.y,
          vx: (dx / dist) * speed, vy: (dy / dist) * speed,
          life: 4, radius: 6,
        });
        game.sounds.spit();
      }
    } else {
      // Walk at the player, with a slight wobble so the horde looks alive.
      // Routes around walls through the door gaps when it cannot see them.
      hunt(game, e, dt, 0.25);
    }

    // Contact damage, once per enemy cooldown.
    if (dist < e.def.radius + player.radius + 2 && e.attackCd <= 0) {
      e.attackCd = e.def.attackCooldown;
      game.hurtPlayer(e.def.damage, e.angle);
    }
  }

  // Separation: seekers push each other apart so the horde rings the
  // player instead of stacking on one spot. Breachers stay at their window.
  const seekers = game.enemies.filter((e) => e.state !== 'breach');
  for (let i = 0; i < seekers.length; i++) {
    for (let j = i + 1; j < seekers.length; j++) {
      const a = seekers[i];
      const b = seekers[j];
      const sx = b.x - a.x;
      const sy = b.y - a.y;
      const min = a.def.radius + b.def.radius;
      const d2 = sx * sx + sy * sy;
      if (d2 > 0.01 && d2 < min * min) {
        const d = Math.sqrt(d2);
        const push = (min - d) / 2;
        const nx = sx / d;
        const ny = sy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }
  for (const e of seekers) resolveCircle(station, e, e.def.radius);
}

export function updateGlobs(game, dt) {
  const { player, station } = game;
  for (const g of game.globs) {
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    g.life -= dt;
    if (g.life <= 0) {
      g.dead = true;
      continue;
    }
    // Walls stop a glob.
    const r = station.walls;
    for (const w of r) {
      if (g.x >= w.x && g.x < w.x + w.w && g.y >= w.y && g.y < w.y + w.h) {
        g.dead = true;
        game.spawnParticles(g.x, g.y, 4, '#7ec850');
        break;
      }
    }
    if (g.dead) continue;
    const d = Math.hypot(player.x - g.x, player.y - g.y);
    if (d < player.radius + g.radius) {
      g.dead = true;
      game.hurtPlayer(12, Math.atan2(g.vy, g.vx));
    }
  }
  game.globs = game.globs.filter((g) => !g.dead);
}

export function damageEnemy(game, enemy, dmg, angle) {
  enemy.hp -= dmg;
  enemy.flash = 0.09;
  // A hit knocks a light husk back a step; brutes barely notice.
  const push = enemy.type === 'brute' ? 1 : 6;
  enemy.x += Math.cos(angle) * push;
  enemy.y += Math.sin(angle) * push;
  game.addFloater(enemy.x, enemy.y - enemy.def.radius - 6, `${Math.round(dmg)}`, '#ffd27a');
  if (enemy.hp <= 0) {
    enemy.dead = true;
    game.kills += 1;
    game.addPoints(enemy.def.points, enemy.x, enemy.y - enemy.def.radius - 18, `+${enemy.def.points}`);
    game.sounds.kill();
    game.spawnParticles(enemy.x, enemy.y, 14, enemy.def.color);
    game.shake = Math.min(6, game.shake + (enemy.type === 'brute' ? 5 : 1.5));
  } else {
    game.sounds.hit();
  }
}

export function drawEnemies(ctx, game, time) {
  for (const e of game.enemies) {
    const { def } = e;
    const bob = Math.sin(e.wobble) * 1.5;
    ctx.save();
    ctx.translate(e.x, e.y + bob * 0.4);
    // Shadow.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(0, def.radius * 0.7, def.radius * 0.9, def.radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body.
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : def.color;
    ctx.beginPath();
    ctx.arc(0, 0, def.radius, 0, Math.PI * 2);
    ctx.fill();
    // Darker rim and a facing wedge so the eye reads direction.
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, def.radius * 0.95, e.angle - 0.5, e.angle + 0.5);
    ctx.closePath();
    ctx.fill();
    // Eyes.
    const ex = Math.cos(e.angle) * def.radius * 0.45;
    const ey = Math.sin(e.angle) * def.radius * 0.45;
    const px = -Math.sin(e.angle) * def.radius * 0.32;
    const py = Math.cos(e.angle) * def.radius * 0.32;
    ctx.fillStyle = '#ffdd55';
    ctx.beginPath();
    ctx.arc(ex + px, ey + py, 2.4, 0, Math.PI * 2);
    ctx.arc(ex - px, ey - py, 2.4, 0, Math.PI * 2);
    ctx.fill();
    // Type marks: spitter's sac, brute's plates, sprinter's streaks.
    if (e.type === 'spitter') {
      ctx.fillStyle = '#a8e063';
      ctx.beginPath();
      ctx.arc(-Math.cos(e.angle) * def.radius * 0.4, -Math.sin(e.angle) * def.radius * 0.4, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'brute') {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, def.radius * 0.6, e.angle + 2.2, e.angle + 4.1);
      ctx.stroke();
    } else if (e.type === 'sprinter') {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-def.radius * 0.7, -4);
      ctx.lineTo(-def.radius * 0.2, -4);
      ctx.moveTo(-def.radius * 0.7, 4);
      ctx.lineTo(-def.radius * 0.2, 4);
      ctx.stroke();
    }
    ctx.restore();
    // Health bar, only while hurt.
    if (e.hp < e.maxHp) {
      const w = def.radius * 2;
      const pct = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(e.x - w / 2, e.y - def.radius - 12, w, 4);
      ctx.fillStyle = pct > 0.4 ? '#7ec850' : '#e5484d';
      ctx.fillRect(e.x - w / 2, e.y - def.radius - 12, w * pct, 4);
    }
    void time;
  }
}
