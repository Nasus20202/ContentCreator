/**
 * Import a file obtained by hand (e.g. a clip cut from an online video) with its provenance stated
 * explicitly. Unlike NASA and Commons imports there is no licence lookup: the caller records the
 * licence exactly as it is (including "all rights reserved") and the decision to use it is logged
 * separately with `cc decision`. `restore` cannot re-fetch these; the file must be re-imported.
 */
import fs from 'node:fs';
import path from 'node:path';
import { nowIso, PipelineError, sha256File } from '../core/io';
import type { AssetRecord } from '../core/schemas';

export interface LocalImport {
  file: string;
  assetId: string;
  url: string;
  title: string;
  credit: string;
  license: string;
  derivation?: string;
}

const VIDEO = new Set(['.mp4', '.webm', '.mov']);
const IMAGE = new Set(['.jpg', '.jpeg', '.png', '.webp']);

export function importLocal(input: LocalImport, destDir: string): AssetRecord {
  if (!fs.existsSync(input.file)) throw new PipelineError(`no such file: ${input.file}`);
  const ext = path.extname(input.file).toLowerCase();
  const kind = VIDEO.has(ext) ? 'video' : IMAGE.has(ext) ? 'image' : undefined;
  if (!kind)
    throw new PipelineError(
      `unsupported asset type ${ext || '(none)'}`,
      'use an mp4/webm/mov clip or a jpg/png/webp image',
    );
  for (const k of ['url', 'title', 'credit', 'license'] as const) {
    if (!input[k].trim()) throw new PipelineError(`--${k} is required for a --file import`);
  }
  fs.mkdirSync(destDir, { recursive: true });
  const fileName = `${input.assetId}${ext}`;
  const filePath = path.join(destDir, fileName);
  fs.copyFileSync(input.file, filePath);
  return {
    id: input.assetId,
    kind,
    file: `assets/${fileName}`,
    sha256: sha256File(filePath),
    source: {
      provider: 'web',
      url: input.url,
      pageUrl: input.url,
      title: input.title,
      credit: input.credit,
      license: input.license,
      ...(input.derivation ? { derivation: input.derivation } : {}),
    },
    aiGenerated: false,
    addedAt: nowIso(),
  };
}
