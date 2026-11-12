import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Episode } from '../src/core/episode';
import { pianoFiles, sampleName } from '../src/assets/piano';
import { restoreAssets } from '../src/pipeline/stages';
import { sha256File } from '../src/core/io';

describe('piano samples', () => {
  it('names notes in scientific pitch notation', () => {
    expect(sampleName(33)).toBe('A1');
    expect(sampleName(60)).toBe('C4');
    expect(sampleName(87)).toBe('D#6');
  });

  it('covers A1..D#6 every three semitones in two velocity layers', () => {
    const files = pianoFiles();
    expect(files).toHaveLength(19 * 2);
    expect(files[0].file.endsWith('33_v4.mp3')).toBe(true);
    expect(files.at(-1)!.file.endsWith('87_v12.mp3')).toBe(true);
  });
});

describe('restoreAssets', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'restore-'));
  const build = path.join(tmp, 'build');
  const assetsFile = path.join(tmp, 'assets.json');
  const payload = Buffer.from('fake jpeg bytes');
  const sha = (() => {
    fs.mkdirSync(build, { recursive: true });
    const f = path.join(tmp, 'expected.jpg');
    fs.writeFileSync(f, payload);
    return sha256File(f);
  })();
  const record = (file: string, recordedSha: string) => ({
    id: 'a1',
    kind: 'image',
    file,
    sha256: recordedSha,
    source: {
      provider: 'nasa-images',
      url: 'https://example.test/a1.jpg',
      title: 'Test image',
      credit: 'NASA',
      license: 'NASA media usage guidelines',
    },
    aiGenerated: false,
    addedAt: '2026-11-12T00:00:00.000Z',
  });
  const ep = { paths: { build, assets: assetsFile } } as unknown as Episode;
  const fetchOk = (() => Promise.resolve(new Response(payload))) as typeof fetch;

  it('fetches a missing asset and verifies its hash', async () => {
    fs.writeFileSync(assetsFile, JSON.stringify({ assets: [record('assets/a1.jpg', sha)] }));
    const out = await restoreAssets(ep, fetchOk);
    expect(out).toEqual([{ id: 'a1', status: 'fetched' }]);
    expect(fs.readFileSync(path.join(build, 'assets/a1.jpg'))).toEqual(payload);
  });

  it('reports present assets without fetching', async () => {
    const never = (() => Promise.reject(new Error('should not fetch'))) as typeof fetch;
    expect(await restoreAssets(ep, never)).toEqual([{ id: 'a1', status: 'present' }]);
  });

  it('flags a mismatch instead of using the file', async () => {
    fs.writeFileSync(assetsFile, JSON.stringify({ assets: [record('assets/a1.jpg', 'deadbeef')] }));
    expect(await restoreAssets(ep, fetchOk)).toEqual([{ id: 'a1', status: 'mismatch' }]);
  });
});
