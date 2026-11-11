/** CI smoke test: the Remotion project compiles with webpack (catches browser-incompatible imports). */
import { bundle } from '@remotion/bundler';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { paths } from '../src/core/paths';

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-bundle-'));
const started = Date.now();
await bundle({ entryPoint: paths.videoEntry, outDir: out });
console.log(`✓ Remotion bundle compiled in ${((Date.now() - started) / 1000).toFixed(1)} s`);
fs.rmSync(out, { recursive: true, force: true });
