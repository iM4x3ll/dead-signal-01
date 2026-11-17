// Drawing: the station floor (pre-rendered once per power state, so the
// frame stays cheap), the world, the entities, and the HUD. Screens live
// in ui.js. Everything is flat vector shapes on one canvas — no images.

import { VIEW_W, VIEW_H, WALL, PALETTE, WEAPONS, nextRank } from './config.js';
import { drawEnemies } from './enemies.js';

const SANS = "'Segoe UI', system-ui, -apple-system, sans-serif";
const MONO = "'Consolas', 'SF Mono', Menlo, monospace";

function fmt(n) {
  return n.toLocaleString('en-US');
}

// The static floor, drawn once to an offscreen canvas and blitted each
// frame. Rebuilt when the power state changes (the east wing lights up).
export function ensureFloor(game) {
  if (game.floorCache && game.floorCache.powered === game.power) return;
  const c = document.createElement('canvas');
  c.width = VIEW_W;
  c.height = VIEW_H;
  const g = c.getContext('2d');
  const { station } = game;

  // Floor base and a subtle tile grid.
  g.fillStyle = PALETTE.floor;
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  g.fillStyle = PALETTE.floorTile;
  for (let y = 0; y < VIEW_H; y += 64) {
    for (let x = 0; x < VIEW_W; x += 64) {
      if (((x + y) / 64) % 2 === 0) g.fillRect(x, y, 64, 64);
    }
  }
  g.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  g.lineWidth = 1;
  for (let x = 0; x <= VIEW_W; x += 64) {
    g.beginPath();
    g.moveTo(x + 0.5, 0);
    g.lineTo(x + 0.5, VIEW_H);
    g.stroke();
  }
  for (let y = 0; y <= VIEW_H; y += 64) {
    g.beginPath();
    g.moveTo(0, y + 0.5);
    g.lineTo(VIEW_W, y + 0.5);
    g.stroke();
  }

  // Room labels, stencilled on the floor.
  g.fillStyle = 'rgba(255, 255, 255, 0.07)';
  g.font = `700 26px ${MONO}`;
  g.textAlign = 'center';
  for (const l of station.labels) g.fillText(l.text, l.x, l.y);

  // Hazard stripes just inside each window gap.
  for (const w of station.windows) {
    g.save();
    g.translate(w.x, w.y);
    if (w.side === 'left' || w.side === 'right') g.rotate(Math.PI / 2);
    g.fillStyle = 'rgba(255, 180, 84, 0.16)';
    g.fillRect(-45, w.side === 'top' ? WALL : -WALL - 14, 90, 14);
    g.restore();
  }

  // Locker pads and the reactor pad.
  for (const l of station.lockers) {
    g.strokeStyle = PALETTE.accentDim;
    g.lineWidth = 2;
    g.strokeRect(l.x - 34, l.y - 34, 68, 68);
  }
  g.strokeStyle = game.power ? PALETTE.power : PALETTE.accentDim;
  g.lineWidth = 2;
  g.beginPath();
  g.arc(station.reactor.x, station.reactor.y, station.reactor.radius + 10, 0, Math.PI * 2);
  g.stroke();

  // Walls: body, light top edge, dark bottom edge.
  for (const w of station.walls) {
    g.fillStyle = PALETTE.wall;
    g.fillRect(w.x, w.y, w.w, w.h);
    g.fillStyle = PALETTE.wallTop;
    if (w.w >= w.h) g.fillRect(w.x, w.y, w.w, 3);
    else g.fillRect(w.x, w.y, 3, w.h);
    g.fillStyle = 'rgba(0, 0, 0, 0.35)';
    if (w.w >= w.h) g.fillRect(w.x, w.y + w.h - 3, w.w, 3);
    else g.fillRect(w.x + w.w - 3, w.y, 3, w.h);
  }

  // Unpowered: the reactor wing sits in the dark.
  if (!game.power) {
    g.fillStyle = 'rgba(0, 0, 0, 0.42)';
    g.fillRect(880, 0, VIEW_W - 880, 420);
  }

  game.floorCache = { canvas: c, powered: game.power };
}

function drawWindows(ctx, game) {
  for (const w of game.station.windows) {
    const shakeX = w.shake > 0 ? (Math.random() - 0.5) * 3 : 0;
    const shakeY = w.shake > 0 ? (Math.random() - 0.5) * 3 : 0;
    ctx.save();
    ctx.translate(w.x + shakeX, w.y + shakeY);
    const horizontal = w.side === 'top' || w.side === 'bottom';
    // Frame.
    ctx.fillStyle = '#0a0d11';
    if (horizontal) ctx.fillRect(-45, -12, 90, 24);
    else ctx.fillRect(-12, -45, 24, 90);
    ctx.strokeStyle = PALETTE.wallEdge;
    ctx.lineWidth = 2;
    if (horizontal) ctx.strokeRect(-45, -12, 90, 24);
    else ctx.strokeRect(-12, -45, 24, 90);
    // Boards: one plank per board left, diagonal, nailed.
    ctx.fillStyle = '#8a6a35';
    ctx.strokeStyle = '#5d4522';
    for (let i = 0; i < w.boards; i++) {
      const off = (i - (w.boards - 1) / 2) * 26;
      ctx.save();
      if (horizontal) {
        ctx.translate(off, 0);
        ctx.rotate(0.5);
        ctx.fillRect(-6, -16, 12, 32);
        ctx.strokeRect(-6, -16, 12, 32);
      } else {
        ctx.translate(0, off);
        ctx.rotate(0.5);
        ctx.fillRect(-16, -6, 32, 12);
        ctx.strokeRect(-16, -6, 32, 12);
      }
      ctx.restore();
    }
    ctx.restore();
  }
}

function drawLockers(ctx, game) {
  for (const l of game.station.lockers) {
    const locked = l.needsPower && !game.power;
    ctx.fillStyle = locked ? '#232a33' : '#2b3542';
    ctx.fillRect(l.x - 26, l.y - 26, 52, 52);
    ctx.strokeStyle = locked ? '#4d5c70' : PALETTE.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(l.x - 26, l.y - 26, 52, 52);
    // A simple gun glyph: barrel and grip.
    ctx.fillStyle = locked ? '#5d6b7d' : PALETTE.accent;
    ctx.fillRect(l.x - 14, l.y - 3, 28, 6);
    ctx.fillRect(l.x - 4, l.y + 3, 7, 10);
    ctx.fillStyle = locked ? '#5d6b7d' : PALETTE.text;
    ctx.font = `700 11px ${MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText(l.label, l.x, l.y + 42);
    ctx.fillStyle = locked ? PALETTE.danger : PALETTE.accent;
    ctx.fillText(locked ? 'NO POWER' : `${l.price} PTS`, l.x, l.y + 56);
  }
}

function drawReactor(ctx, game, time) {
  const r = game.station.reactor;
  const pulse = 0.5 + Math.sin(time * 3) * 0.2;
  if (r.restored) {
    const glow = ctx.createRadialGradient(r.x, r.y, 4, r.x, r.y, 70);
    glow.addColorStop(0, `rgba(84, 224, 192, ${0.5 * pulse + 0.2})`);
    glow.addColorStop(1, 'rgba(84, 224, 192, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(r.x, r.y, 70, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = r.restored ? '#1d3a33' : '#2b3542';
  ctx.beginPath();
  ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = r.restored ? PALETTE.power : PALETTE.wallEdge;
  ctx.lineWidth = 3;
  ctx.stroke();
  // Core.
  ctx.fillStyle = r.restored ? PALETTE.power : '#4d5c70';
  ctx.beginPath();
  ctx.arc(r.x, r.y, 12, 0, Math.PI * 2);
  ctx.fill();
  // Charging ring.
  if (r.charging > 0) {
    const pct = 1 - r.charging / 2.0;
    ctx.strokeStyle = PALETTE.power;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius + 6, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = r.restored ? PALETTE.power : PALETTE.textDim;
  ctx.font = `700 11px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.fillText(r.restored ? 'REACTOR ONLINE' : 'REACTOR', r.x, r.y + r.radius + 22);
}

function drawPlayer(ctx, game) {
  const p = game.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  // Shadow.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 10, 13, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Gun, pointing at the aim.
  ctx.rotate(p.angle);
  ctx.fillStyle = '#39434f';
  ctx.fillRect(6, -4, 22, 8);
  ctx.fillStyle = '#4d5c70';
  ctx.fillRect(24, -2, 8, 4);
  // Muzzle flash.
  if (p.muzzle > 0) {
    ctx.fillStyle = 'rgba(255, 210, 120, 0.95)';
    ctx.beginPath();
    ctx.moveTo(32, -6);
    ctx.lineTo(46, 0);
    ctx.lineTo(32, 6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.rotate(-p.angle);
  // Body.
  ctx.fillStyle = p.hurtTimer > 0 ? '#ff9a9a' : PALETTE.player;
  ctx.beginPath();
  ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2b3542';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Visor, facing the aim.
  ctx.fillStyle = '#1d2a38';
  ctx.beginPath();
  ctx.arc(Math.cos(p.angle) * 5, Math.sin(p.angle) * 5, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGlobs(ctx, game) {
  for (const g of game.globs) {
    ctx.fillStyle = '#7ec850';
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(168, 224, 99, 0.7)';
    ctx.beginPath();
    ctx.arc(g.x - 2, g.y - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTracers(ctx, game) {
  for (const t of game.tracers) {
    const a = t.life / t.maxLife;
    ctx.strokeStyle = `rgba(255, 210, 120, ${0.85 * a})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(t.x0, t.y0);
    ctx.lineTo(t.x1, t.y1);
    ctx.stroke();
  }
}

function drawParticles(ctx, game) {
  for (const p of game.particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = a;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawFloaters(ctx, game) {
  ctx.textAlign = 'center';
  ctx.font = `700 14px ${MONO}`;
  for (const f of game.floaters) {
    const a = Math.max(0, f.life / f.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

export function drawWorld(ctx, game, time) {
  ensureFloor(game);
  ctx.drawImage(game.floorCache.canvas, 0, 0);
  drawWindows(ctx, game);
  drawLockers(ctx, game);
  drawReactor(ctx, game, time);
  drawGlobs(ctx, game);
  drawEnemies(ctx, game, time);
  drawPlayer(ctx, game);
  drawTracers(ctx, game);
  drawParticles(ctx, game);
  drawFloaters(ctx, game);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

export function drawHUD(ctx, game) {
  const p = game.player;
  const weapon = WEAPONS[p.loadout.current];
  const ammo = p.loadout.ammo[weapon.id];
  const hostiles = game.wave.queue.length + game.enemies.length;

  // Top-left: round, points, rank.
  panel(ctx, 14, 12, 250, 86);
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 26px ${SANS}`;
  ctx.fillText(`ROUND ${game.round}`, 26, 42);
  ctx.font = `700 20px ${MONO}`;
  ctx.fillStyle = PALETTE.accent;
  ctx.fillText(`${fmt(game.points)} PTS`, 26, 68);
  ctx.font = `700 12px ${MONO}`;
  ctx.fillStyle = PALETTE.textDim;
  const nxt = nextRank(game.pointsEarned);
  ctx.fillText(
    nxt ? `${game.rank}  ·  NEXT ${nxt.name} AT ${fmt(nxt.at)}` : `${game.rank}  ·  MAX RANK`,
    26, 88,
  );

  // Top-centre: objective.
  ctx.textAlign = 'center';
  ctx.font = `700 14px ${MONO}`;
  ctx.fillStyle = game.power ? PALETTE.power : PALETTE.accent;
  const objective = game.wave.intermission > 0
    ? `NEXT ROUND IN ${Math.ceil(game.wave.intermission)}`
    : game.power ? 'OBJECTIVE COMPLETE — SURVIVE' : 'OBJECTIVE: RESTORE REACTOR POWER';
  ctx.fillText(objective, VIEW_W / 2, 32);

  // Top-right: power and hostiles.
  panel(ctx, VIEW_W - 264, 12, 250, 86);
  ctx.textAlign = 'right';
  ctx.font = `700 16px ${MONO}`;
  ctx.fillStyle = game.power ? PALETTE.power : PALETTE.danger;
  ctx.fillText(game.power ? 'POWER: ONLINE' : 'POWER: OFFLINE', VIEW_W - 26, 40);
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(`HOSTILES: ${hostiles}`, VIEW_W - 26, 66);
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = `700 12px ${MONO}`;
  ctx.fillText(`KILLS ${game.kills}`, VIEW_W - 26, 88);

  // Bottom-left: health.
  panel(ctx, 14, VIEW_H - 58, 250, 44);
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = `700 12px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.fillText('HULL', 26, VIEW_H - 38);
  const hpPct = Math.max(0, p.hp / p.maxHp);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fillRect(70, VIEW_H - 48, 180, 14);
  ctx.fillStyle = hpPct > 0.35 ? PALETTE.power : PALETTE.danger;
  ctx.fillRect(70, VIEW_H - 48, 180 * hpPct, 14);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 12px ${MONO}`;
  ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, 70, VIEW_H - 22);

  // Bottom-centre: weapon and ammo.
  panel(ctx, VIEW_W / 2 - 140, VIEW_H - 58, 280, 44);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `700 15px ${SANS}`;
  ctx.fillText(weapon.name, VIEW_W / 2, VIEW_H - 36);
  ctx.font = `700 13px ${MONO}`;
  ctx.fillStyle = ammo.mag === 0 ? PALETTE.danger : PALETTE.accent;
  const reserve = ammo.reserve === Infinity ? '∞' : `${ammo.reserve}`;
  ctx.fillText(
    p.reloading ? 'RELOADING…' : `${ammo.mag} / ${reserve}`,
    VIEW_W / 2, VIEW_H - 20,
  );

  // Bottom-right: controls reminder.
  ctx.textAlign = 'right';
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = `700 11px ${MONO}`;
  ctx.fillText('WASD MOVE · SHIFT SPRINT', VIEW_W - 16, VIEW_H - 40);
  ctx.fillText('CLICK SHOOT · R RELOAD · E USE · 1-3 GUNS', VIEW_W - 16, VIEW_H - 24);
  ctx.fillText('ESC PAUSE · M MUTE', VIEW_W - 16, VIEW_H - 8);

  // Interact prompt.
  if (game.interactable) {
    ctx.textAlign = 'center';
    ctx.font = `700 16px ${MONO}`;
    const w = ctx.measureText(game.interactable.label).width + 48;
    panel(ctx, VIEW_W / 2 - w / 2, VIEW_H - 108, w, 32);
    ctx.fillStyle = PALETTE.accent;
    ctx.fillText(game.interactable.label, VIEW_W / 2, VIEW_H - 86);
  }

  // Banners.
  for (const b of game.banners) {
    const a = b.t < 0.25 ? b.t / 0.25 : b.t > b.dur - 0.5 ? (b.dur - b.t) / 0.5 : 1;
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 44px ${SANS}`;
    ctx.fillText(b.text, VIEW_W / 2, 190);
    if (b.sub) {
      ctx.font = `700 16px ${MONO}`;
      ctx.fillStyle = PALETTE.accent;
      ctx.fillText(b.sub, VIEW_W / 2, 218);
    }
    ctx.globalAlpha = 1;
  }

  // Low-health vignette and damage flash.
  if (hpPct < 0.35) {
    const pulse = 0.12 + Math.sin(game.time * 4) * 0.05;
    const grad = ctx.createRadialGradient(
      VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.75,
    );
    grad.addColorStop(0, 'rgba(229, 72, 77, 0)');
    grad.addColorStop(1, `rgba(229, 72, 77, ${pulse + (1 - hpPct) * 0.25})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (game.flash > 0) {
    ctx.fillStyle = `rgba(229, 72, 77, ${game.flash * 0.35})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}
