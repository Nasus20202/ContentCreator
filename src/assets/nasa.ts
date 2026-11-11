/**
 * NASA Image and Video Library (images.nasa.gov): real imagery, generally not copyrighted.
 * Items that mention third-party copyright are rejected — NASA hosts some licensed media.
 * Guidelines: https://www.nasa.gov/nasa-brand-center/images-and-media/
 */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { AssetRecord } from '../core/schemas';
import { nowIso, PipelineError, sha256File } from '../core/io';

const API = 'https://images-api.nasa.gov';
export const NASA_LICENSE = 'NASA media usage guidelines (not copyrighted unless noted)';

const SearchResponse = z.object({
  collection: z.object({
    items: z.array(
      z.object({
        data: z.array(
          z.object({
            nasa_id: z.string(),
            title: z.string(),
            center: z.string().optional(),
            date_created: z.string().optional(),
            description: z.string().optional(),
            photographer: z.string().optional(),
            secondary_creator: z.string().optional(),
            media_type: z.string(),
          }),
        ),
        links: z.array(z.object({ href: z.string(), rel: z.string().optional() })).optional(),
      }),
    ),
  }),
});

export interface NasaHit {
  nasaId: string;
  title: string;
  date?: string;
  center?: string;
  credit: string;
  preview?: string;
  copyrightFlag: boolean;
  description: string;
}

const COPYRIGHT = /©|copyright|all rights reserved|courtesy of(?! nasa)/i;

export function searchNasa(query: string, limit = 10, fetchImpl: typeof fetch = fetch): Promise<NasaHit[]> {
  return search({ q: query, media_type: 'image' }, limit, fetchImpl);
}

async function search(params: Record<string, string>, limit: number, fetchImpl: typeof fetch): Promise<NasaHit[]> {
  const res = await fetchImpl(`${API}/search?${new URLSearchParams(params)}`);
  if (!res.ok) throw new PipelineError(`NASA search failed: HTTP ${res.status}`);
  const data = SearchResponse.parse(await res.json());
  return data.collection.items.slice(0, limit).map((it) => {
    const d = it.data[0];
    const description = d.description ?? '';
    return {
      nasaId: d.nasa_id,
      title: d.title,
      date: d.date_created?.slice(0, 10),
      center: d.center,
      credit: ['NASA', d.center, d.photographer ?? d.secondary_creator].filter(Boolean).join(' / '),
      preview: it.links?.[0]?.href,
      copyrightFlag: COPYRIGHT.test(description) || COPYRIGHT.test(d.photographer ?? ''),
      description: description.slice(0, 300),
    };
  });
}

const AssetManifest = z.object({ collection: z.object({ items: z.array(z.object({ href: z.string() })) }) });

/** Pick the largest web-friendly rendition (prefer ~large over ~orig, which can be 100+ MB TIFF). */
export function pickRendition(hrefs: string[]): string | undefined {
  const jpgs = hrefs.filter((h) => /\.(jpe?g|png)$/i.test(h));
  return (
    jpgs.find((h) => /~large\./.test(h)) ??
    jpgs.find((h) => /~orig\./.test(h)) ??
    jpgs.find((h) => /~medium\./.test(h)) ??
    jpgs[0]
  );
}

export async function downloadNasa(
  hit: NasaHit,
  assetId: string,
  destDir: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AssetRecord> {
  if (hit.copyrightFlag) {
    throw new PipelineError(`NASA item ${hit.nasaId} mentions third-party copyright; pick another image`);
  }
  const manifest = AssetManifest.parse(
    await (await fetchImpl(`${API}/asset/${encodeURIComponent(hit.nasaId)}`)).json(),
  );
  const href = pickRendition(manifest.collection.items.map((i) => i.href.replace(/^http:/, 'https:')));
  if (!href) throw new PipelineError(`No JPEG/PNG rendition for ${hit.nasaId}`);
  const res = await fetchImpl(href);
  if (!res.ok) throw new PipelineError(`Download failed: HTTP ${res.status}`);
  fs.mkdirSync(destDir, { recursive: true });
  const fileName = `${assetId}${path.extname(new URL(href).pathname).toLowerCase()}`;
  const filePath = path.join(destDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(await res.arrayBuffer()));
  return {
    id: assetId,
    kind: 'image',
    file: `assets/${fileName}`,
    sha256: sha256File(filePath),
    source: {
      provider: 'nasa-images',
      url: href,
      pageUrl: `https://images.nasa.gov/details/${encodeURIComponent(hit.nasaId)}`,
      title: hit.title,
      credit: hit.credit,
      license: NASA_LICENSE,
    },
    aiGenerated: false,
    addedAt: nowIso(),
  };
}

export async function lookupNasa(nasaId: string, fetchImpl: typeof fetch = fetch): Promise<NasaHit> {
  const hit = (await search({ nasa_id: nasaId }, 1, fetchImpl))[0];
  if (!hit) throw new PipelineError(`NASA id "${nasaId}" not found`);
  return hit;
}
