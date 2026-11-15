/**
 * Renders a Tone.js bed (`compose.ts`) offline in headless Chromium and returns raw stereo samples.
 * The compose module is bundled with esbuild once per process; samples are served over a local HTTP
 * server so the browser can fetch them. Browser: $CHROMIUM_PATH, else the system Chromium/Chrome.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import puppeteer from 'puppeteer-core';
import { ensureInstrumentSamples, instrumentManifest, instrumentsDir } from '../../assets/instruments';
import type { BedSpec, ToneStyle } from './compose';

export const TONE_STYLES: readonly ToneStyle[] = ['pulse', 'telemetry', 'lab', 'acoustic', 'lofi'];
export const isToneStyle = (s: string): s is ToneStyle => (TONE_STYLES as readonly string[]).includes(s);

/** Which sampled instruments each style loads (the rest are Tone synths). */
const STYLE_INSTRUMENTS: Record<ToneStyle, string[]> = {
  pulse: [],
  telemetry: [],
  lab: ['xylophone', 'harp', 'bass-electric'],
  acoustic: ['guitar-acoustic', 'harp', 'violin'],
  lofi: ['bass-electric'],
};

const here = path.dirname(fileURLToPath(import.meta.url));
let bundled: string | undefined;

async function bundle(): Promise<string> {
  if (bundled) return bundled;
  const out = await build({
    entryPoints: [path.join(here, 'compose.ts')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    write: false,
    logLevel: 'silent',
  });
  bundled = out.outputFiles[0].text;
  return bundled;
}

function browserPath(): string {
  const candidates = [
    process.env.CHROMIUM_PATH,
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/opt/google/chrome/chrome',
  ].filter((p): p is string => !!p);
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error('No Chromium found for music rendering; set CHROMIUM_PATH');
  return found;
}

export async function renderToneBed(
  style: ToneStyle,
  seconds: number,
  variant: { seed?: number; transpose?: number; cues?: number[] } = {},
): Promise<{ sampleRate: number; left: Float32Array; right: Float32Array }> {
  const instruments = STYLE_INSTRUMENTS[style];
  await ensureInstrumentSamples(instruments);
  const manifest = instrumentManifest();
  const js = await bundle();
  const root = instrumentsDir();
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<!doctype html><html><body><script src="/bed.js"></script></body></html>');
      return;
    }
    if (url === '/bed.js') {
      res.writeHead(200, { 'content-type': 'text/javascript' });
      res.end(js);
      return;
    }
    const file = path.join(root, url.replace(/^\/samples\//, ''));
    if (!file.startsWith(root) || !fs.existsSync(file)) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': 'audio/mpeg' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  const port = (server.address() as { port: number }).port;
  const browser = await puppeteer.launch({
    executablePath: browserPath(),
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--no-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    const spec: BedSpec = {
      style,
      seconds,
      seed: variant.seed ?? 0,
      transpose: variant.transpose ?? 0,
      cues: variant.cues ?? [0],
      sampleBase: `http://127.0.0.1:${port}/samples`,
      samples: Object.fromEntries(instruments.map((i) => [i, manifest.instruments[i] ?? []])),
    };
    const out = await page.evaluate(
      (s) =>
        (
          globalThis as unknown as {
            renderBed: (x: BedSpec) => Promise<{ sampleRate: number; left: string; right: string }>;
          }
        ).renderBed(s),
      spec,
    );
    const decode = (b64: string) => {
      const buf = Buffer.from(b64, 'base64');
      return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4).slice();
    };
    return { sampleRate: out.sampleRate, left: decode(out.left), right: decode(out.right) };
  } finally {
    await browser.close();
    server.close();
  }
}
