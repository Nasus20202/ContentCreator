/**
 * Preview stills of episodes without a full render.
 *   pnpm tsx scripts/preview-stills.ts <outDir> <episode>:<t1,t2,...> [<episode>:<...>]
 * Times are seconds; "s<i>" means the middle of scene i, "e<i>" 1.2 s into scene i, "z<i>" its last half second.
 */
import fs from 'node:fs';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { Episode } from '../src/core/episode';
import { readJson } from '../src/core/io';
import { Plan, Timeline } from '../src/core/schemas';
import { paths } from '../src/core/paths';
import { sceneStarts } from '../src/core/timing';
import { loadAssets, restoreAssets } from '../src/pipeline/stages';
import { FPS, buildRenderProps } from '../src/render/prepare';

const [outDir, ...specs] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const pub = path.join(outDir, 'public');
fs.mkdirSync(pub, { recursive: true });

const serveUrl = await bundle({ entryPoint: paths.videoEntry, publicDir: pub });
for (const spec of specs) {
  const [id, times] = spec.split(':');
  const ep = Episode.load(id);
  await restoreAssets(ep);
  const assetsDir = path.join(ep.paths.build, 'assets');
  if (fs.existsSync(assetsDir)) fs.cpSync(assetsDir, path.join(pub, 'assets'), { recursive: true });
  const plan = readJson(ep.paths.plan, Plan);
  const timeline = readJson(ep.paths.timeline, Timeline);
  const props = buildRenderProps(plan, timeline, ep.manifest.location, loadAssets(ep), undefined);
  const starts = sceneStarts(timeline, FPS);
  const inputProps = props as unknown as Record<string, unknown>;
  const composition = await selectComposition({ serveUrl, id: 'Episode', inputProps });
  for (const tok of (times ?? 's0,s1,s2,s3,s4,s5').split(',')) {
    let frame: number;
    const m = /^([sez])(\d+)$/.exec(tok);
    if (m) {
      const s = starts[Math.min(Number(m[2]), starts.length - 1)];
      frame = m[1] === 's' ? s.from + Math.floor(s.frames / 2) : m[1] === 'z' ? s.from + s.frames - 15 : s.from + 36;
    } else frame = Math.round(Number(tok) * FPS);
    frame = Math.min(frame, composition.durationInFrames - 1);
    const output = path.join(outDir, `${id}-${tok}.jpg`);
    await renderStill({
      composition,
      serveUrl,
      output,
      frame,
      inputProps,
      imageFormat: 'jpeg',
      jpegQuality: 85,
      chromiumOptions: { gl: 'swangle' },
    });
    console.log(output);
  }
}
