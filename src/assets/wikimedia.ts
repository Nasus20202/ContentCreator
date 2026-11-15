/**
 * Wikimedia Commons images with their licence checked and recorded. Only licences that allow
 * commercial reuse with modification are accepted (public domain, CC0, CC BY, CC BY-SA); NC and ND
 * licences are refused, because the channel is monetised and frames are cropped and zoomed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { nowIso, PipelineError, sha256File } from '../core/io';
import type { AssetRecord } from '../core/schemas';

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'ContentCreator/1.0 (asset provenance; https://github.com/)';

const ImageInfo = z.object({
  url: z.url(),
  thumburl: z.url().optional(),
  descriptionurl: z.url(),
  extmetadata: z.record(z.string(), z.object({ value: z.union([z.string(), z.number()]) })).default({}),
});

export const stripHtml = (s: string): string =>
  s
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

/** True for licences that allow commercial reuse and adaptation. */
export function commercialOk(license: string): boolean {
  const l = license.toLowerCase();
  if (/\bnc\b|non-?commercial|\bnd\b|no-?deriv/.test(l)) return false;
  return /public domain|^pd\b|cc0|cc[ -]by(-sa)?[ -]\d/.test(l);
}

export async function downloadCommons(
  title: string,
  assetId: string,
  destDir: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AssetRecord> {
  const file = title.startsWith('File:') ? title : `File:${title}`;
  const q = new URLSearchParams({
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '2400',
    titles: file,
    format: 'json',
  });
  const res = await fetchImpl(`${API}?${q}`, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new PipelineError(`Commons lookup failed: HTTP ${res.status}`);
  const json = (await res.json()) as { query?: { pages?: Record<string, { imageinfo?: unknown[] }> } };
  const page = Object.values(json.query?.pages ?? {})[0];
  if (!page?.imageinfo?.[0]) throw new PipelineError(`No such file on Commons: ${file}`);
  const info = ImageInfo.parse(page.imageinfo[0]);
  const meta = (k: string) => stripHtml(String(info.extmetadata[k]?.value ?? ''));
  const license = meta('LicenseShortName') || meta('License');
  if (!commercialOk(license)) {
    throw new PipelineError(`${file} is licensed "${license || 'unknown'}", which does not allow commercial reuse`);
  }
  const artist = meta('Artist') || 'unknown author';
  const href = info.thumburl ?? info.url;
  const img = await fetchImpl(href, { headers: { 'user-agent': UA } });
  if (!img.ok) throw new PipelineError(`Download failed: HTTP ${img.status}`);
  fs.mkdirSync(destDir, { recursive: true });
  const ext = path.extname(new URL(href).pathname).toLowerCase() || '.jpg';
  const fileName = `${assetId}${ext}`;
  const filePath = path.join(destDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(await img.arrayBuffer()));
  return {
    id: assetId,
    kind: 'image',
    file: `assets/${fileName}`,
    sha256: sha256File(filePath),
    source: {
      provider: 'wikimedia',
      url: href,
      pageUrl: info.descriptionurl,
      title: file.replace(/^File:/, ''),
      credit: `${artist} / Wikimedia Commons (${license})`,
      license,
    },
    aiGenerated: false,
    addedAt: nowIso(),
  };
}
