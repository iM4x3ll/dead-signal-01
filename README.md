# dead-signal-01

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/iM4x3ll/dead-signal-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/iM4x3ll/dead-signal-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Dead Signal: Kestrel-9 — a 2D top-down wave-survival shooter. Hold the Kestrel-9 relay deck against the husks: board the windows they break through, earn points per kill, buy better guns from the lockers, and restore reactor power to light the east wing and unlock the pulse rifle. An entry for [make.fun's best-game-01 bounty](https://make.fun/bounty/best-game-01).

## The game

- **Waves that escalate** — husks, then sprinters, spitters, and brutes, in growing numbers each round, with a breather and a bonus between rounds.
- **Boarded windows** — six windows around the station. Husks break the boards to get in; repair them with E for points.
- **Three guns** — the P9 sidearm you start with, the M87 scattergun from the storage locker, and the VK pulse rifle from the east wing once the reactor is back on.
- **An objective** — restore reactor power to light the east wing and unlock the best gun, then keep surviving.
- **Service ranks** — Listener to Legend, earned on points, with your best run kept between visits.
- **Complete loop** — title screen, HUD (round, points, rank, health, ammo, hostiles), pause, and a game-over screen with run stats and restart.
- **Light and fast** — plain canvas 2D, no images, no libraries, no network. Sound is synthesized live with WebAudio; nothing is downloaded.

## Controls

WASD move · Shift sprint · mouse aim · click shoot · R reload · E use/repair · 1–3 weapons · Esc pause · M mute.

## Run it

Play it (any static server; ES modules need HTTP, not `file://`):

```sh
python3 -m http.server --directory game 8080
```

Then open http://localhost:8080.

Hand it in (writes `out/` with the game, screenshots, and dossier):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Files

- `game/` — the game: `index.html` plus `src/` (config, input, audio, world, enemies, weapons, render, ui, main), one job per file.
- `main.ts` — the entry program (Node 22, stdlib only): copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.
- `screenshots/` — the title, a run in progress, and the game-over screen, rendered from the game's own code in a browser.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.
