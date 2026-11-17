// Dead Signal: Kestrel-9 — the entry program (Node 22, stdlib only).
// Hands the game in: copies game/ and screenshots/ from this repository to
// /output and writes /output/dossier.json with the vendored make.fun
// library, which is what the judge reads. Outside the grader's container,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

// Fail fast with a plain message when the entry is incomplete, rather
// than handing in a half-built output directory.
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('game/index.html is missing: nothing to hand in');
}
if (!existsSync(shotsDir)) {
  throw new Error('screenshots/ is missing: the entry needs 3 screenshots');
}

mkdirSync(outDir, { recursive: true });
cpSync(gameDir, join(outDir, 'game'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

// The gate's caps, from the competition's own reference: the dossier text
// is capped at 160 KiB, screenshots at 4 files of 256 KiB each, game/ at
// 993 files and 48 MiB with no path over 1000 bytes.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
