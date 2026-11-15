/**
 * Recorded instrument samples for the Tone.js music beds (see `assets/audio/tonejs-instruments.json`).
 *
 * Source: tonejs-instruments (samples CC BY 3.0; originals from the University of Iowa MIS, Karoryfer
 * and VSCO 2 CE), pinned to one commit. Files are fetched on first use into
 * `assets/audio/tonejs-instruments/` (gitignored), like the piano samples.
 */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { paths } from '../core/paths';

export const InstrumentManifest = z.object({
  source: z.string(),
  commit: z.string(),
  license: z.string(),
  credit: z.string(),
  instruments: z.record(z.string(), z.array(z.string())),
});
export type InstrumentManifest = z.infer<typeof InstrumentManifest>;

export const instrumentsDir = (): string => path.join(paths.root, 'assets', 'audio', 'tonejs-instruments');

export function instrumentManifest(): InstrumentManifest {
  const file = path.join(paths.root, 'assets', 'audio', 'tonejs-instruments.json');
  return InstrumentManifest.parse(JSON.parse(fs.readFileSync(file, 'utf8')));
}

/** Download any missing sample of the given instruments (all of them when `names` is omitted). */
export async function ensureInstrumentSamples(names?: string[]): Promise<void> {
  const m = instrumentManifest();
  for (const inst of names ?? Object.keys(m.instruments)) {
    const files = m.instruments[inst];
    if (!files) throw new Error(`unknown instrument ${inst}`);
    const dir = path.join(instrumentsDir(), inst);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of files) {
      const out = path.join(dir, f);
      if (fs.existsSync(out)) continue;
      const url = `https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/${m.commit}/samples/${inst}/${f}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`sample download failed (${res.status}): ${url}`);
      fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    }
  }
}
