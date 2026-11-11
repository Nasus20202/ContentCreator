/** Production Renderer: props → music → Remotion → loudness normalisation → build/video.mp4. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { Episode } from '../core/episode';
import { writeJson } from '../core/io';
import type { Plan, Timeline } from '../core/schemas';
import type { Renderer } from '../pipeline/stages';
import { loadAssets } from '../pipeline/stages';
import { totalFrames } from '../core/timing';
import { FPS, buildRenderProps } from './prepare';
import { normalizeLoudness, probe, synthesizePad } from './media';
import { renderEpisode } from './render';

const remotionVersion = (): string => {
  const req = createRequire(import.meta.url);
  return (req('remotion/package.json') as { version: string }).version;
};

export function remotionRenderer(log: (msg: string) => void): Renderer {
  return {
    async render(ep: Episode, plan: Plan, timeline: Timeline) {
      const started = Date.now();
      const b = ep.paths.build;
      fs.mkdirSync(b, { recursive: true });

      let musicFile: string | undefined;
      if (plan.music.enabled) {
        musicFile = 'music.wav';
        await synthesizePad(path.join(b, musicFile), totalFrames(timeline, FPS) / FPS);
      }
      const props = buildRenderProps(plan, timeline, ep.manifest.location, loadAssets(ep), musicFile);
      writeJson(ep.paths.renderProps, props);

      const raw = path.join(b, 'video.raw.mp4');
      log('bundling + rendering (CPU, SwiftShader WebGL)…');
      await renderEpisode(props, { publicDir: b, output: raw, onProgress: (p) => log(`  ${p}%`) });
      log('normalising loudness to -14 LUFS…');
      await normalizeLoudness(raw, ep.paths.video);
      fs.rmSync(raw);

      const pr = await probe(ep.paths.video);
      const v = pr.streams.find((s) => s.codec_type === 'video');
      return {
        renderSeconds: (Date.now() - started) / 1000,
        durationSec: Number(pr.format.duration),
        width: v?.width ?? 0,
        height: v?.height ?? 0,
        fps: FPS,
        remotionVersion: remotionVersion(),
      };
    },
  };
}
