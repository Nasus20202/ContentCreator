import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ChannelConfig, Fact, Location, Plan } from '../src/core/schemas';

export const EU: Location = { id: 'eu-central', label: 'central Europe', lat: 50, lon: 15, timeZone: 'Europe/Warsaw' };

export const facts: Fact[] = [
  {
    id: 'sep',
    statement: 'Mars and Jupiter are closest on Mon 16 Nov, 03:03, 1.19° apart.',
    values: [1.194, 16],
    source: { type: 'computed', method: 'test', inputs: {} },
  },
  {
    id: 'dist',
    statement: 'Mars is 195 million km away; Jupiter is 4× farther.',
    values: [195.485, 787.885, 4.03],
    source: { type: 'computed', method: 'test', inputs: {} },
  },
  {
    id: 'zhr',
    statement: 'Leonids ZHR ≈ 15.',
    values: [15],
    source: { type: 'url', url: 'https://www.imo.net/resources/calendar/', title: 'IMO', accessed: '2026-11-11' },
  },
];

export function plan(overrides: Partial<Plan> = {}): Plan {
  return {
    episodeId: 'ep-test',
    series: 'sky-this-week',
    title: 'Test',
    badge: 'Sky this week',
    location: EU,
    voice: { id: 'af_heart', speed: 1 },
    music: { enabled: false, volume: 0.3 },
    scenes: [
      {
        id: 'conj',
        template: 'skyView',
        narration: [
          'On November sixteenth they are just over one degree apart.',
          'Mars is about two hundred million kilometers away.',
        ],
        factIds: ['sep', 'dist'],
        chips: [{ text: 'MON NOV 16', from: 0 }],
        captions: true,
        params: {
          time: '2026-11-16T03:00:00.000Z',
          bodies: ['Mars', 'Jupiter'],
          camera: [{ at: 0, target: { midpoint: ['Mars', 'Jupiter'] }, fov: 40, dAz: 0, dAlt: 0 }],
          labels: [{ body: 'Mars', text: 'Mars', side: 'left', from: { sentence: 1, edge: 'start', offset: 0 } }],
          starLabels: [],
          separation: { a: 'Mars', b: 'Jupiter', text: '1.2°', from: 0 },
          twilight: 0.3,
          constellationLines: 0.08,
        },
      },
      {
        id: 'outro',
        template: 'outro',
        narration: ['Follow for next week.'],
        factIds: [],
        chips: [],
        captions: true,
        params: { kicker: 'Next week', cta: 'Follow' },
      },
    ],
    post: { title: 'Mars and Jupiter on Nov 16', description: 'Just 1.2° apart.', hashtags: ['#astronomy'] },
    ...overrides,
  };
}

export const config: ChannelConfig = {
  name: 'test',
  defaultLocation: 'eu-central',
  locations: [EU],
  voice: { id: 'af_heart', speed: 1 },
  autoApprove: false,
  publishing: { defaultMode: 'draft', aiDisclosure: true, targets: [] },
};

/** Point the pipeline at a throwaway episodes/docs dir for the duration of a test. */
export function tempWorkspace(): { dir: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-test-'));
  const prev = { e: process.env.CC_EPISODES_DIR, d: process.env.CC_DOCS_DIR };
  process.env.CC_EPISODES_DIR = path.join(dir, 'episodes');
  process.env.CC_DOCS_DIR = path.join(dir, 'docs');
  return {
    dir,
    cleanup: () => {
      process.env.CC_EPISODES_DIR = prev.e;
      process.env.CC_DOCS_DIR = prev.d;
      if (prev.e === undefined) delete process.env.CC_EPISODES_DIR;
      if (prev.d === undefined) delete process.env.CC_DOCS_DIR;
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
