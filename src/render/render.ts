import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import os from 'node:os';
import { paths } from '../core/paths';
import type { RenderProps } from '../core/schemas';

export const COMPOSITION_ID = 'Episode';

export interface RenderOptions {
  publicDir: string;
  output: string;
  onProgress?: (pct: number) => void;
}

/**
 * Bundle the Remotion project with the episode's build dir as public/ and render H.264.
 * WebGL runs through SwiftShader ("swangle") so renders work on machines without a GPU.
 */
export async function renderEpisode(props: RenderProps, opts: RenderOptions): Promise<void> {
  const serveUrl = await bundle({ entryPoint: paths.videoEntry, publicDir: opts.publicDir });
  const inputProps = props as unknown as Record<string, unknown>;
  const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps });
  let last = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    crf: 18,
    audioCodec: 'aac',
    outputLocation: opts.output,
    inputProps,
    chromiumOptions: { gl: 'swangle' },
    concurrency: Math.max(1, Math.floor(os.cpus().length / 2)),
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 100);
      if (pct >= last + 10) {
        last = pct;
        opts.onProgress?.(pct);
      }
    },
  });
}
