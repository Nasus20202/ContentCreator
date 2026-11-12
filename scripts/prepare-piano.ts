/**
 * Fetch the piano samples the music bed plays and cut them down to the few seconds a bed needs.
 *
 *   pnpm tsx scripts/prepare-piano.ts
 *
 * The renderer does this on demand (src/assets/piano.ts), so running this is only needed to
 * prepare the samples ahead of time, e.g. on an offline machine that already has the cache.
 * Source: FreePats Upright Piano KW (CC0 1.0, no attribution needed) — see
 * `assets/audio/piano/README.md`.
 */
import { ensurePianoSamples, pianoDir, pianoFiles } from '../src/assets/piano';

await ensurePianoSamples();
console.log(`${pianoFiles().length} piano samples present in ${pianoDir()}`);
