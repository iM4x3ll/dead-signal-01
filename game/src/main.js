// Dead Signal: Kestrel-9 — the game itself.
// Wires input, world, enemies, weapons, rendering and screens together
// into one fixed-timestep loop. The debug hook at the bottom (window.DS)
// exposes the live state so the game can be driven and screenshotted by
// automation; it changes nothing about how the game plays.

import {
  VIEW_W, VIEW_H, PLAYER, WEAPON_ORDER, rankFor,
  REPAIR_POINTS, REPAIR_COOLDOWN, REACTOR_CHARGE_TIME, POWER_BONUS,
} from './config.js';
import { attachInput } from './input.js';
import { SoundBank } from './audio.js';
import { buildStation, resolveCircle } from './world.js';
import { buildNavGraph } from './nav.js';
import { updateWave, updateEnemies, updateGlobs, startRound } from './enemies.js';
import {
  makeLoadout, updateWeapons, switchTo, startReload, buyAtLocker,
} from './weapons.js';
import { drawWorld, drawHUD } from './render.js';
import {
  findInteractable, pushBanner, updateBanners,
  drawTitleScreen, drawPauseScreen, drawGameOverScreen,
} from './ui.js';

const STEP = 1 / 60; // fixed logic step, 60 Hz
const BEST_KEY = 'dead-signal-kestrel9-best';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = attachInput(canvas);
    this.sounds = new SoundBank();
    this.screen = 'title';
    this.time = 0; // wall-clock for animation; always advances
    this.station = buildStation();
    this.power = false;
    this.floorCache = null;
    this.best = this.loadBest();
    this.newBest = false;
    this.resetRun();
  }

  resetRun() {
    this.station = buildStation();
    // Waypoint graph for the husks, rebuilt with the station.
    this.nav = buildNavGraph(this.station);
    this.power = false;
    this.floorCache = null;
    this.round = 0;
    this.points = 500;
    this.pointsEarned = 0;
    this.kills = 0;
    this.shots = 0;
    this.hits = 0;
    this.rank = 'LISTENER';
    this.enemies = [];
    this.globs = [];
    this.particles = [];
    this.tracers = [];
    this.floaters = [];
    this.banners = [];
    this.wave = { queue: [], time: 0, active: false, intermission: 0 };
    this.shake = 0;
    this.flash = 0;
    this.interactable = null;
    this.newBest = false;
    const s = this.station.playerSpawn;
    this.player = {
      x: s.x, y: s.y, angle: -Math.PI / 2,
      hp: PLAYER.hp, maxHp: PLAYER.hp, radius: PLAYER.radius,
      loadout: makeLoadout(),
      fireCd: 0, muzzle: 0, reloading: false, reloadTimer: 0,
      hurtTimer: 0, interactCd: 0,
    };
  }

  loadBest() {
    try {
      const raw = window.localStorage.getItem(BEST_KEY);
      if (!raw) return { rounds: 0, points: 0, rank: 'LISTENER' };
      const b = JSON.parse(raw);
      return { rounds: b.rounds || 0, points: b.points || 0, rank: b.rank || 'LISTENER' };
    } catch {
      return { rounds: 0, points: 0, rank: 'LISTENER' };
    }
  }

  saveBest() {
    const beaten = this.round > this.best.rounds
      || (this.round === this.best.rounds && this.pointsEarned > this.best.points);
    if (!beaten) return false;
    this.best = { rounds: this.round, points: this.pointsEarned, rank: this.rank };
    try {
      window.localStorage.setItem(BEST_KEY, JSON.stringify(this.best));
    } catch {
      // Storage unavailable (private mode, file://): the run still counts.
    }
    return true;
  }

  startRun() {
    this.sounds.unlock();
    this.resetRun();
    this.screen = 'playing';
    startRound(this, 1);
  }

  addPoints(n, x, y, label) {
    this.points += n;
    this.pointsEarned += n;
    if (label) this.addFloater(x, y, label, '#ffb454');
    const rank = rankFor(this.pointsEarned);
    if (rank.name !== this.rank) {
      this.rank = rank.name;
      this.sounds.rankUp();
      pushBanner(this, `SERVICE RANK: ${this.rank}`, 'THE RELAY REMEMBERS');
    }
  }

  addFloater(x, y, text, color) {
    this.floaters.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
    if (this.floaters.length > 40) this.floaters.shift();
  }

  spawnParticles(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 120;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.3 + Math.random() * 0.35, maxLife: 0.65,
        color, size: 2 + Math.random() * 3,
      });
    }
    if (this.particles.length > 300) this.particles.splice(0, this.particles.length - 300);
  }

  pushBanner(text, sub, dur) {
    pushBanner(this, text, sub, dur);
  }

  hurtPlayer(dmg, angle) {
    const p = this.player;
    if (this.screen !== 'playing' || p.hurtTimer > 0) return;
    p.hp -= dmg;
    p.hurtTimer = PLAYER.hurtCooldown;
    this.flash = 1;
    this.shake = Math.min(8, this.shake + 3);
    // Knock the player away from the hit.
    p.x -= Math.cos(angle) * 10;
    p.y -= Math.sin(angle) * 10;
    resolveCircle(this.station, p, p.radius);
    this.sounds.hurt();
    if (p.hp <= 0) {
      p.hp = 0;
      this.die();
    }
  }

  die() {
    this.screen = 'over';
    this.newBest = this.saveBest();
    this.sounds.gameOver();
  }

  doInteract() {
    const it = this.interactable;
    if (!it) return;
    if (it.kind === 'window') {
      const p = this.player;
      if (p.interactCd > 0) return;
      p.interactCd = REPAIR_COOLDOWN;
      it.ref.boards = Math.min(it.ref.maxBoards, it.ref.boards + 1);
      this.addPoints(REPAIR_POINTS, it.ref.breach.x, it.ref.breach.y - 24, `+${REPAIR_POINTS}`);
      this.sounds.repair();
      this.spawnParticles(it.ref.breach.x, it.ref.breach.y, 5, '#8a6a35');
    } else if (it.kind === 'locker') {
      const result = buyAtLocker(this, it.ref);
      if (result) pushBanner(this, result);
    } else if (it.kind === 'reactor') {
      it.ref.charging = REACTOR_CHARGE_TIME;
      pushBanner(this, 'REACTOR CHARGING…', 'HOLD THE LINE');
      this.sounds.click();
    }
  }

  restorePower() {
    const r = this.station.reactor;
    r.restored = true;
    r.charging = 0;
    this.power = true;
    this.floorCache = null; // the east wing lights up
    this.addPoints(POWER_BONUS, r.x, r.y - 50, `+${POWER_BONUS}`);
    pushBanner(this, 'REACTOR POWER RESTORED', 'EAST WING ONLINE — VK PULSE RIFLE UNLOCKED', 3.0);
    this.sounds.powerOn();
  }

  updatePlaying(dt) {
    const p = this.player;
    const input = this.input;

    // Move.
    const mv = input.moveVector();
    const sprinting = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = sprinting ? PLAYER.sprint : PLAYER.speed;
    p.x += mv.x * speed * dt;
    p.y += mv.y * speed * dt;
    resolveCircle(this.station, p, p.radius);

    // Aim at the mouse.
    p.angle = Math.atan2(input.mouse.y - p.y, input.mouse.x - p.x);

    // Keys.
    this.interactable = findInteractable(this);
    if (input.wasPressed('KeyE')) this.doInteract();
    if (input.wasPressed('KeyR')) startReload(this);
    if (input.wasPressed('Digit1')) switchTo(this, 0);
    if (input.wasPressed('Digit2')) switchTo(this, 1);
    if (input.wasPressed('Digit3')) switchTo(this, 2);
    if (input.wasPressed('Escape')) {
      this.screen = 'paused';
      this.sounds.click();
      return;
    }
    if (input.wasPressed('KeyM')) {
      const muted = this.sounds.toggleMute();
      pushBanner(this, muted ? 'SOUND OFF' : 'SOUND ON', '', 1.2);
    }

    p.hurtTimer = Math.max(0, p.hurtTimer - dt);
    p.interactCd = Math.max(0, p.interactCd - dt);
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.shake = Math.max(0, this.shake - dt * 22);

    // Reactor charging.
    const r = this.station.reactor;
    if (r.charging > 0) {
      r.charging -= dt;
      if (r.charging <= 0) this.restorePower();
    }

    updateWeapons(this, dt);
    updateWave(this, dt);
    updateEnemies(this, dt);
    updateGlobs(this, dt);

    // Window shake decay.
    for (const w of this.station.windows) w.shake = Math.max(0, w.shake - dt);

    // Effects.
    for (const t of this.tracers) t.life -= dt;
    this.tracers = this.tracers.filter((t) => t.life > 0);
    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.92;
      pt.vy *= 0.92;
      pt.life -= dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    for (const f of this.floaters) {
      f.y -= 34 * dt;
      f.life -= dt;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    this.enemies = this.enemies.filter((e) => !e.dead);
    updateBanners(this, dt);
  }

  update(dt) {
    this.time += dt;
    if (this.screen === 'title') {
      updateBanners(this, dt);
      if (this.input.wasPressed('Enter') || this.input.mouse.clicked) {
        this.sounds.unlock();
        this.startRun();
      }
      return;
    }
    if (this.screen === 'playing') {
      this.updatePlaying(dt);
      return;
    }
    if (this.screen === 'paused') {
      if (this.input.wasPressed('Escape')) {
        this.screen = 'playing';
        this.sounds.click();
      } else if (this.input.wasPressed('KeyR')) {
        this.startRun();
      } else if (this.input.wasPressed('KeyM')) {
        this.sounds.toggleMute();
      }
      return;
    }
    if (this.screen === 'over') {
      if (this.input.wasPressed('KeyR') || this.input.mouse.clicked) {
        this.startRun();
      } else if (this.input.wasPressed('Escape')) {
        this.screen = 'title';
        this.resetRun();
      }
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }
    if (this.screen === 'title') {
      drawTitleScreen(ctx, this, this.time);
    } else {
      drawWorld(ctx, this, this.time);
      if (this.screen === 'playing') drawHUD(ctx, this);
      if (this.screen === 'paused') {
        drawHUD(ctx, this);
        drawPauseScreen(ctx, this);
      }
      if (this.screen === 'over') drawGameOverScreen(ctx, this);
    }
    ctx.restore();
  }

  run() {
    let last = performance.now();
    let acc = 0;
    const frame = (now) => {
      requestAnimationFrame(frame);
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.25) dt = 0.25; // a tab that slept does not fast-forward
      acc += dt;
      let steps = 0;
      while (acc >= STEP && steps < 5) {
        this.update(STEP);
        acc -= STEP;
        steps += 1;
        // Edges (key presses, clicks) fire once per frame, not per step.
        if (steps === 1) this.input.endFrame();
      }
      if (steps === 0) this.input.endFrame();
      this.render();
    };
    requestAnimationFrame(frame);
  }
}

const canvas = document.getElementById('game');
const game = new Game(canvas);
game.run();

// Testing hook: the live game state, readable by automation (screenshots,
// play-testing). It exposes state only; the game plays the same with or
// without it.
window.DS = game;
