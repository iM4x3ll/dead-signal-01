// Weapons: the player's loadout, hitscan firing, reloading, switching,
// and buying at lockers. Shots are hitscan rays: each pellet walks out
// from the muzzle until it meets a wall or a husk, so shooting feels
// instant and the tracers show exactly where the shot went.

import { WEAPONS, WEAPON_ORDER } from './config.js';
import { pointInWalls } from './world.js';
import { damageEnemy } from './enemies.js';

export function makeLoadout() {
  return {
    owned: ['sidearm'],
    current: 'sidearm',
    ammo: {
      sidearm: { mag: WEAPONS.sidearm.mag, reserve: Infinity },
      scattergun: { mag: 0, reserve: 0 },
      rifle: { mag: 0, reserve: 0 },
    },
  };
}

export function currentWeapon(loadout) {
  return WEAPONS[loadout.current];
}

export function switchTo(game, index) {
  const id = WEAPON_ORDER[index];
  if (!id || !game.player.loadout.owned.includes(id)) return;
  if (game.player.loadout.current === id) return;
  game.player.loadout.current = id;
  game.player.reloading = false;
  game.player.fireCd = Math.max(game.player.fireCd, 0.12);
  game.sounds.click();
}

// Walk a ray from (x0, y0) along angle: the first wall or enemy it meets.
// Returns {x, y, enemy, dist}.
function raycast(game, x0, y0, angle, range) {
  const step = 6;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  for (let d = 8; d <= range; d += step) {
    const x = x0 + cos * d;
    const y = y0 + sin * d;
    if (pointInWalls(game.station, x, y)) return { x, y, enemy: null, dist: d };
    for (const e of game.enemies) {
      if (e.dead || e.state === 'breach') continue;
      const dd = Math.hypot(e.x - x, e.y - y);
      if (dd < e.def.radius) return { x, y, enemy: e, dist: d };
    }
  }
  return { x: x0 + cos * range, y: y0 + sin * range, enemy: null, dist: range };
}

function fireOne(game) {
  const player = game.player;
  const weapon = currentWeapon(player.loadout);
  const ammo = player.loadout.ammo[weapon.id];
  if (ammo.mag <= 0) {
    game.sounds.dryFire();
    startReload(game);
    return;
  }
  ammo.mag -= 1;
  player.fireCd = 1 / weapon.rate;
  player.muzzle = 0.06;
  game.shots += 1;
  game.sounds.shoot(weapon.id);
  game.shake = Math.min(5, game.shake + weapon.kick * 0.25);

  const mx = player.x + Math.cos(player.angle) * (player.radius + 8);
  const my = player.y + Math.sin(player.angle) * (player.radius + 8);
  for (let p = 0; p < weapon.pellets; p++) {
    const angle = player.angle + (Math.random() - 0.5) * 2 * weapon.spread;
    const hit = raycast(game, mx, my, angle, weapon.range);
    game.tracers.push({
      x0: mx, y0: my, x1: hit.x, y1: hit.y, life: 0.07, maxLife: 0.07,
    });
    if (hit.enemy) {
      game.hits += 1;
      damageEnemy(game, hit.enemy, weapon.damage, angle);
      game.spawnParticles(hit.x, hit.y, 3, '#ffd27a');
    } else if (hit.dist < weapon.range) {
      game.spawnParticles(hit.x, hit.y, 3, '#8b98a9');
    }
  }
  // A spent shell, for a little life.
  game.spawnParticles(mx, my, 1, '#ffb454');
}

export function startReload(game) {
  const player = game.player;
  const weapon = currentWeapon(player.loadout);
  const ammo = player.loadout.ammo[weapon.id];
  if (player.reloading) return;
  if (ammo.mag >= weapon.mag) return;
  if (ammo.reserve <= 0) return;
  player.reloading = true;
  player.reloadTimer = weapon.reload;
  game.sounds.reload();
}

function finishReload(game) {
  const player = game.player;
  const weapon = currentWeapon(player.loadout);
  const ammo = player.loadout.ammo[weapon.id];
  const need = weapon.mag - ammo.mag;
  const take = Math.min(need, ammo.reserve);
  ammo.mag += take;
  if (ammo.reserve !== Infinity) ammo.reserve -= take;
  player.reloading = false;
}

// Called every frame while playing: cooldowns, the reload timer, and
// firing while the mouse is held.
export function updateWeapons(game, dt) {
  const player = game.player;
  player.fireCd = Math.max(0, player.fireCd - dt);
  player.muzzle = Math.max(0, player.muzzle - dt);
  if (player.reloading) {
    player.reloadTimer -= dt;
    if (player.reloadTimer <= 0) finishReload(game);
    return;
  }
  if (game.input.mouse.down && player.fireCd <= 0) fireOne(game);
}

// Buy a locker's weapon, or refill its ammo when already owned.
// Returns a one-line result for the banner, or null when nothing happened.
export function buyAtLocker(game, locker) {
  const weapon = WEAPONS[locker.weapon];
  const loadout = game.player.loadout;
  if (locker.needsPower && !game.power) {
    game.sounds.denied();
    return 'NO POWER — RESTORE THE REACTOR FIRST';
  }
  if (!loadout.owned.includes(locker.weapon)) {
    if (game.points < weapon.price) {
      game.sounds.denied();
      return `NEED ${weapon.price - game.points} MORE POINTS`;
    }
    game.points -= weapon.price;
    loadout.owned.push(locker.weapon);
    loadout.ammo[locker.weapon] = { mag: weapon.mag, reserve: weapon.reserve };
    loadout.current = locker.weapon;
    game.player.reloading = false;
    game.sounds.buy();
    return `${weapon.name} ACQUIRED`;
  }
  // Already owned: refill the reserve.
  const ammo = loadout.ammo[locker.weapon];
  if (ammo.reserve === Infinity || ammo.reserve >= weapon.reserve) {
    game.sounds.denied();
    return 'AMMO ALREADY FULL';
  }
  if (game.points < weapon.ammoPrice) {
    game.sounds.denied();
    return `NEED ${weapon.ammoPrice - game.points} MORE POINTS`;
  }
  game.points -= weapon.ammoPrice;
  ammo.reserve = weapon.reserve;
  game.sounds.buy();
  return `${weapon.name} AMMO RESTOCKED`;
}
