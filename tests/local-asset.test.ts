import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { importLocal } from '../src/assets/local';
import { AssetRecord } from '../src/core/schemas';

const base = {
  url: 'https://www.youtube.com/watch?v=example',
  title: 'Clip',
  credit: 'Someone',
  license: 'all rights reserved',
};

describe('local asset import', () => {
  it('copies a clip, records it as a web video with its provenance, and validates', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-'));
    const src = path.join(dir, 'in.mp4');
    fs.writeFileSync(src, 'not really a video');
    const rec = importLocal(
      { ...base, file: src, assetId: 'catch', derivation: 'trim 0:27–0:50, muted' },
      path.join(dir, 'out'),
    );
    expect(AssetRecord.parse(rec)).toBeTruthy();
    expect(rec.kind).toBe('video');
    expect(rec.file).toBe('assets/catch.mp4');
    expect(rec.source.provider).toBe('web');
    expect(rec.source.license).toBe('all rights reserved');
    expect(rec.source.derivation).toContain('muted');
    expect(fs.existsSync(path.join(dir, 'out', 'catch.mp4'))).toBe(true);
  });

  it('refuses missing provenance and unknown file types', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-'));
    const src = path.join(dir, 'in.png');
    fs.writeFileSync(src, 'x');
    expect(() => importLocal({ ...base, license: ' ', file: src, assetId: 'a' }, dir)).toThrow(/license/);
    const txt = path.join(dir, 'in.txt');
    fs.writeFileSync(txt, 'x');
    expect(() => importLocal({ ...base, file: txt, assetId: 'a' }, dir)).toThrow(/unsupported/);
  });
});
