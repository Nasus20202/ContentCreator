import { describe, expect, it } from 'vitest';
import { detectSkyEvents } from '../src/planning/astro/events';
import { compass, compassWords, findMinima, formatLocal, localDay } from '../src/planning/astro/sky';
import { orbitSnapshot, skySnapshot } from '../src/planning/astro/snapshot';
import { addLocalDays, localMidnight, tzOffsetMs } from '../src/core/time';
import { EU } from './fixtures';

describe('sky helpers', () => {
  it('maps azimuths to compass points', () => {
    expect(compass(0)).toBe('N');
    expect(compass(131)).toBe('SE');
    expect(compass(359)).toBe('N');
    expect(compassWords(225)).toBe('south-west');
  });

  it('formats in the location time zone', () => {
    const d = new Date('2026-11-16T02:03:00Z');
    expect(formatLocal(d, 'Europe/Warsaw')).toBe('Mon 16 Nov, 03:03');
    expect(localDay(new Date('2026-11-16T23:30:00Z'), 'Europe/Warsaw')).toBe(17);
  });

  it('finds and refines local minima', () => {
    const t0 = Date.UTC(2026, 0, 1);
    const f = (d: Date) => Math.abs((d.getTime() - t0) / 3600_000 - 37.25);
    const m = findMinima(f, new Date(t0), new Date(t0 + 100 * 3600_000), 3 * 3600_000);
    expect(m).toHaveLength(1);
    expect(Math.abs(m[0].time.getTime() - (t0 + 37.25 * 3600_000))).toBeLessThan(2 * 60_000);
  });
});

describe('time zones', () => {
  it('computes offsets across DST', () => {
    expect(tzOffsetMs(new Date('2026-01-15T12:00:00Z'), 'Europe/Warsaw')).toBe(3600_000);
    expect(tzOffsetMs(new Date('2026-07-15T12:00:00Z'), 'Europe/Warsaw')).toBe(7200_000);
    expect(tzOffsetMs(new Date('2026-07-15T12:00:00Z'), 'America/New_York')).toBe(-4 * 3600_000);
  });

  it('finds local midnight', () => {
    expect(localMidnight('2026-11-16', 'Europe/Warsaw').toISOString()).toBe('2026-11-15T23:00:00.000Z');
    expect(localMidnight('2026-07-01', 'America/New_York').toISOString()).toBe('2026-07-01T04:00:00.000Z');
    expect(addLocalDays('2026-11-16', 7)).toBe('2026-11-23');
  });
});

describe('detectSkyEvents (regression: week of 16 Nov 2026, central Europe)', () => {
  const start = localMidnight('2026-11-16', EU.timeZone);
  const end = localMidnight('2026-11-23', EU.timeZone);
  const { events, facts } = detectSkyEvents(EU, start, end);
  const byId = (prefix: string) => events.find((e) => e.id.startsWith(prefix));

  it('ranks the Mars–Jupiter conjunction first, ~1.19° on 16 Nov', () => {
    expect(events[0].id).toBe('conj-mars-jupiter-2026-11-16');
    const sep = facts.find((f) => f.id === 'conj-mars-jupiter-2026-11-16-sep');
    expect(sep?.values[0]).toBeCloseTo(1.19, 1);
    expect(events[0].viewing?.direction).toBe('south-east');
  });

  it('finds the Leonids with the IMO ZHR and a sourced fact', () => {
    const leo = byId('meteors-leonids');
    expect(leo).toBeDefined();
    const zhr = facts.find((f) => f.id === `${leo!.id}-zhr`);
    expect(zhr?.values).toEqual([15]);
    expect(zhr?.source.type).toBe('url');
  });

  it('finds the Moon–Saturn pass on Friday 20 Nov', () => {
    const ms = byId('moon-saturn-2026-11-20');
    expect(ms).toBeDefined();
    expect(facts.find((f) => f.id === 'moon-saturn-2026-11-20-sep')?.values[0]).toBeCloseTo(5.5, 0);
  });

  it('emits window and location facts', () => {
    expect(facts.find((f) => f.id === 'episode-window')?.values).toEqual([16, 22, 2026]);
    expect(facts.find((f) => f.id === 'episode-location')?.values).toEqual([50, 15]);
  });

  it('every event fact id exists and every computed fact records its inputs', () => {
    const ids = new Set(facts.map((f) => f.id));
    for (const e of events) for (const f of e.factIds) expect(ids.has(f)).toBe(true);
    for (const f of facts)
      if (f.source.type === 'computed') expect(f.source.inputs).toMatchObject({ location: 'eu-central' });
  });
});

describe('detectSkyEvents (eclipse of 2 Aug 2027 from Luxor)', () => {
  it('detects a total solar eclipse and requires an eye-safety note', () => {
    const luxor = { id: 'luxor', label: 'Luxor', lat: 25.69, lon: 32.64, timeZone: 'Africa/Cairo' };
    const { events } = detectSkyEvents(luxor, new Date('2027-08-01T00:00:00Z'), new Date('2027-08-04T00:00:00Z'));
    const ecl = events.find((e) => e.kind === 'solar-eclipse');
    expect(ecl?.title).toMatch(/total/i);
    expect(ecl?.notes.join(' ')).toMatch(/eclipse glasses/);
    expect(events[0].kind).toBe('solar-eclipse');
  });
});

describe('snapshots', () => {
  it('produces unit vectors for stars and bodies above the horizon', () => {
    const s = skySnapshot(EU, '2026-11-16T03:00:00.000Z', ['Mars', 'Jupiter', 'Moon'], { ra: 152, dec: 22 });
    expect(s.stars.length).toBeGreaterThan(1000);
    for (const [x, y, z] of s.stars.slice(0, 50)) expect(Math.hypot(x, y, z)).toBeCloseTo(1, 3);
    const mars = s.bodies.find((b) => b.name === 'Mars')!;
    expect(mars.v[2]).toBeGreaterThan(0.6); // ~46° up
    expect(s.radiant).toBeDefined();
    expect(s.lines.some((l) => l.c === 'Leo')).toBe(true);
  });

  it('places Earth at ~1 AU and reports distances in km', () => {
    const o = orbitSnapshot('2026-11-16T03:00:00.000Z', ['Earth', 'Mars', 'Jupiter']);
    expect(o.bodies.find((b) => b.name === 'Earth')!.r).toBeCloseTo(0.99, 1);
    expect(o.bodies.find((b) => b.name === 'Jupiter')!.distKm / 1e6).toBeCloseTo(788, -1);
  });
});
