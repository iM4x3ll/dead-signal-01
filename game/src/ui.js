// Screens and prompts: the title, pause and game-over screens, the
// interact prompt, and the banner queue. The game world and HUD live in
// render.js; this file is the chrome around them.

import { VIEW_W, VIEW_H, PALETTE, PLAYER, REPAIR_POINTS, WEAPONS } from './config.js';
import { ensureFloor } from './render.js';

const SANS = "'Segoe UI', system-ui, -apple-system, sans-serif";
const MONO = "'Consolas', 'SF Mono', Menlo, monospace";

function fmt(n) {
  return n.toLocaleString('en-US');
}

// The nearest thing the player can use: a window needing boards, a locker,
// or the reactor. Returns {kind, label, ref} or null.
export function findInteractable(game) {
  const p = game.player;
  let best = null;
  let bestDist = PLAYER.interactRange;

  const consider = (x, y, item) => {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestDist) {
      bestDist = d;
      best = item;
    }
  };

  for (const w of game.station.windows) {
    if (w.boards < w.maxBoards) {
      consider(w.breach.x, w.breach.y, {
        kind: 'window',
        label: `[E] REPAIR BOARDS (+${REPAIR_POINTS})`,
        ref: w,
      });
    }
  }
  for (const l of game.station.lockers) {
    const owned = p.loadout.owned.includes(l.weapon);
    const label = owned
      ? `[E] RESTOCK ${WEAPONS[l.weapon].name} (${WEAPONS[l.weapon].ammoPrice} PTS)`
      : `[E] BUY ${l.label} (${l.price} PTS)`;
    consider(l.x, l.y, { kind: 'locker', label, ref: l });
  }
  const r = game.station.reactor;
  if (!r.restored && r.charging <= 0) {
    consider(r.x, r.y, { kind: 'reactor', label: '[E] RESTORE REACTOR POWER', ref: r });
  }
  return best;
}

export function pushBanner(game, text, sub, dur = 2.2) {
  game.banners.push({ text, sub: sub || '', t: 0, dur });
  if (game.banners.length > 2) game.banners.shift();
}

export function updateBanners(game, dt) {
  for (const b of game.banners) b.t += dt;
  game.banners = game.banners.filter((b) => b.t < b.dur);
}

// A slow radar sweep over the dimmed station, behind the title.
function drawTitleBackground(ctx, game, time) {
  ensureFloor(game);
  ctx.drawImage(game.floorCache.canvas, 0, 0);
  ctx.fillStyle = 'rgba(6, 9, 12, 0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const cx = VIEW_W / 2;
  const cy = VIEW_H / 2 + 40;
  const sweep = (time * 0.35) % (Math.PI * 2);
  const grad = ctx.createConicGradient
    ? null
    : null;
  void grad;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(sweep);
  const sweepGrad = ctx.createLinearGradient(0, 0, 420, 0);
  sweepGrad.addColorStop(0, 'rgba(84, 224, 192, 0.10)');
  sweepGrad.addColorStop(1, 'rgba(84, 224, 192, 0)');
  ctx.fillStyle = sweepGrad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, 420, -0.12, 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(84, 224, 192, 0.14)';
  ctx.lineWidth = 1;
  for (const r of [140, 260, 380]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function drawTitleScreen(ctx, game, time) {
  drawTitleBackground(ctx, game, time);
  ctx.textAlign = 'center';

  ctx.fillStyle = PALETTE.accent;
  ctx.font = `700 15px ${MONO}`;
  ctx.fillText('FIVE STATIONS // NO RESPONSE SINCE CYCLE 4471', VIEW_W / 2, 128);

  ctx.fillStyle = PALETTE.text;
  ctx.font = `900 92px ${SANS}`;
  ctx.fillText('DEAD SIGNAL', VIEW_W / 2, 216);
  ctx.fillStyle = PALETTE.power;
  ctx.font = `700 26px ${MONO}`;
  ctx.fillText('— KESTREL-9 —', VIEW_W / 2, 252);

  ctx.fillStyle = PALETTE.textDim;
  ctx.font = `400 17px ${SANS}`;
  ctx.fillText('Board the windows. Buy the guns. Restore the power. Survive.', VIEW_W / 2, 290);

  // Start prompt, blinking.
  if (Math.floor(time * 1.6) % 2 === 0) {
    ctx.fillStyle = PALETTE.accent;
    ctx.font = `800 22px ${SANS}`;
    ctx.fillText('CLICK OR PRESS ENTER TO START', VIEW_W / 2, 350);
  }

  // Controls.
  const controls = [
    ['WASD', 'MOVE'],
    ['SHIFT', 'SPRINT'],
    ['MOUSE', 'AIM'],
    ['CLICK', 'SHOOT'],
    ['R', 'RELOAD'],
    ['E', 'USE / REPAIR'],
    ['1 – 3', 'WEAPONS'],
    ['ESC', 'PAUSE'],
    ['M', 'MUTE'],
  ];
  ctx.font = `700 13px ${MONO}`;
  const colW = 200;
  const startX = VIEW_W / 2 - ((controls.length - 1) / 2) * (colW / 2) - 40;
  controls.forEach(([key, label], i) => {
    const x = 150 + i * 104;
    void startX;
    void colW;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(key, x, 420);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = `700 11px ${MONO}`;
    ctx.fillText(label, x, 438);
    ctx.font = `700 13px ${MONO}`;
  });

  // Enemies on the card.
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = `700 13px ${MONO}`;
  ctx.fillText('HOSTILES:  HUSK  ·  SPRINTER  ·  SPITTER  ·  BRUTE', VIEW_W / 2, 490);

  if (game.best && game.best.rounds > 0) {
    ctx.fillStyle = PALETTE.accent;
    ctx.font = `700 14px ${MONO}`;
    ctx.fillText(
      `BEST RUN — ROUND ${game.best.rounds} · ${fmt(game.best.points)} PTS · ${game.best.rank}`,
      VIEW_W / 2, 528,
    );
  }

  ctx.fillStyle = 'rgba(139, 152, 169, 0.75)';
  ctx.font = `400 12px ${MONO}`;
  ctx.fillText('AN ORIGINAL GAME · SOUND SYNTHESIZED LIVE · PLAYS OFFLINE', VIEW_W / 2, VIEW_H - 24);
}

export function drawPauseScreen(ctx, game) {
  ctx.fillStyle = 'rgba(6, 9, 12, 0.66)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = `800 56px ${SANS}`;
  ctx.fillText('PAUSED', VIEW_W / 2, 250);
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = `400 17px ${SANS}`;
  ctx.fillText('The husks wait. They are patient.', VIEW_W / 2, 288);
  ctx.fillStyle = PALETTE.accent;
  ctx.font = `700 18px ${MONO}`;
  ctx.fillText('ESC — RESUME', VIEW_W / 2, 350);
  ctx.fillText('R — RESTART RUN', VIEW_W / 2, 382);
  ctx.fillText('M — MUTE', VIEW_W / 2, 414);
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = `700 13px ${MONO}`;
  ctx.fillText(
    `ROUND ${game.round} · ${fmt(game.points)} PTS · ${game.kills} KILLS`,
    VIEW_W / 2, 470,
  );
}

export function drawGameOverScreen(ctx, game) {
  ctx.fillStyle = 'rgba(8, 4, 6, 0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';

  ctx.fillStyle = PALETTE.danger;
  ctx.font = `900 72px ${SANS}`;
  ctx.fillText('SIGNAL LOST', VIEW_W / 2, 190);
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = `400 17px ${SANS}`;
  ctx.fillText('The station went dark. The relay holds no one now.', VIEW_W / 2, 226);

  const accuracy = game.shots > 0 ? Math.round((game.hits / game.shots) * 100) : 0;
  const stats = [
    ['ROUNDS SURVIVED', `${game.round}`],
    ['KILLS', `${game.kills}`],
    ['ACCURACY', `${accuracy}%`],
    ['POINTS EARNED', fmt(game.pointsEarned)],
    ['SERVICE RANK', game.rank],
  ];
  ctx.font = `700 15px ${MONO}`;
  const rowY0 = 290;
  stats.forEach(([label, value], i) => {
    const y = rowY0 + i * 34;
    ctx.fillStyle = PALETTE.textDim;
    ctx.textAlign = 'right';
    ctx.fillText(label, VIEW_W / 2 - 20, y);
    ctx.fillStyle = PALETTE.text;
    ctx.textAlign = 'left';
    ctx.fillText(value, VIEW_W / 2 + 20, y);
  });

  if (game.newBest) {
    ctx.fillStyle = PALETTE.accent;
    ctx.font = `800 18px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText('★ NEW BEST RUN ★', VIEW_W / 2, rowY0 + stats.length * 34 + 16);
  }

  if (Math.floor(game.time * 1.6) % 2 === 0) {
    ctx.fillStyle = PALETTE.accent;
    ctx.font = `800 22px ${SANS}`;
    ctx.fillText('PRESS R OR CLICK TO RESTART', VIEW_W / 2, 560);
  }
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = `700 13px ${MONO}`;
  ctx.fillText('ESC — BACK TO TITLE', VIEW_W / 2, 596);
}
