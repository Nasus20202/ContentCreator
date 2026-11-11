/** Thin, tested helpers around astronomy-engine. */
import * as A from 'astronomy-engine';
import type { Location } from '../../core/schemas';

export const ENGINE = 'astronomy-engine@2';
export const NAKED_EYE_PLANETS = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] as const;
export type PlanetName = (typeof NAKED_EYE_PLANETS)[number];

/** Mean angular diameter of the full Moon, degrees. */
export const MOON_DIAMETER_DEG = 0.52;

export const observer = (loc: Location): A.Observer => new A.Observer(loc.lat, loc.lon, 0);

export const HOUR = 3600_000;
export const DAY = 24 * HOUR;

export function horizontal(body: string, date: Date, obs: A.Observer): { az: number; alt: number } {
  const eq = A.Equator(body as A.Body, date, obs, true, true);
  const h = A.Horizon(date, obs, eq.ra, eq.dec, 'normal');
  return { az: h.azimuth, alt: h.altitude };
}

export function horizontalRaDec(
  raHours: number,
  decDeg: number,
  date: Date,
  obs: A.Observer,
): { az: number; alt: number } {
  const h = A.Horizon(date, obs, raHours, decDeg, 'normal');
  return { az: h.azimuth, alt: h.altitude };
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
const COMPASS_WORDS: Record<(typeof COMPASS)[number], string> = {
  N: 'north',
  NE: 'north-east',
  E: 'east',
  SE: 'south-east',
  S: 'south',
  SW: 'south-west',
  W: 'west',
  NW: 'north-west',
};

export function compass(az: number): (typeof COMPASS)[number] {
  return COMPASS[Math.round((((az % 360) + 360) % 360) / 45) % 8];
}
export const compassWords = (az: number): string => COMPASS_WORDS[compass(az)];

/** "Mon 16 Nov, 05:10" in the location's own time zone. */
export function formatLocal(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

export function formatLocalTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    date,
  );
}

/** Day-of-month in the location's time zone. */
export function localDay(date: Date, timeZone: string): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric' }).format(date));
}

export function geoSeparation(a: string, b: string, date: Date): number {
  return A.AngleBetween(A.GeoVector(a as A.Body, date, true), A.GeoVector(b as A.Body, date, true));
}

export function topoSeparation(a: string, b: string, date: Date, obs: A.Observer): number {
  const va = A.Equator(a as A.Body, date, obs, true, true).vec;
  const vb = A.Equator(b as A.Body, date, obs, true, true).vec;
  return A.AngleBetween(va, vb);
}

/**
 * Find local minima of f over [start, end] by coarse sampling then golden-section refinement.
 * Returns minima sorted by time.
 */
export function findMinima(
  f: (d: Date) => number,
  start: Date,
  end: Date,
  stepMs: number,
): { time: Date; value: number }[] {
  const out: { time: Date; value: number }[] = [];
  const t0 = start.getTime();
  const n = Math.ceil((end.getTime() - t0) / stepMs);
  const vals = Array.from({ length: n + 1 }, (_, i) => f(new Date(t0 + i * stepMs)));
  for (let i = 1; i < n; i++) {
    if (vals[i] <= vals[i - 1] && vals[i] < vals[i + 1]) {
      out.push(goldenMin(f, t0 + (i - 1) * stepMs, t0 + (i + 1) * stepMs));
    }
  }
  return out;
}

function goldenMin(f: (d: Date) => number, lo: number, hi: number): { time: Date; value: number } {
  const g = (Math.sqrt(5) - 1) / 2;
  let a = lo,
    b = hi;
  let c = b - g * (b - a),
    d = a + g * (b - a);
  while (b - a > 60_000) {
    if (f(new Date(c)) < f(new Date(d))) b = d;
    else a = c;
    c = b - g * (b - a);
    d = a + g * (b - a);
  }
  const t = new Date((a + b) / 2);
  return { time: t, value: f(t) };
}

/**
 * Best moment to see `body` within [from, to]: dark enough sky (Sun < -8°) and the body as high as possible.
 * Returns undefined when it never clears 8° altitude in darkness.
 */
export function bestViewing(
  body: string,
  from: Date,
  to: Date,
  obs: A.Observer,
): { time: Date; az: number; alt: number } | undefined {
  let best: { time: Date; az: number; alt: number; score: number } | undefined;
  for (let t = from.getTime(); t <= to.getTime(); t += 10 * 60_000) {
    const d = new Date(t);
    const sun = horizontal('Sun', d, obs);
    if (sun.alt > -8) continue;
    const h = horizontal(body, d, obs);
    if (h.alt < 8) continue;
    // prefer altitude, but reward darker skies up to astronomical twilight
    const score = Math.min(h.alt, 45) + Math.min(10, (-8 - sun.alt) * 0.6);
    if (!best || score > best.score) best = { time: d, ...h, score };
  }
  return best && { time: best.time, az: best.az, alt: best.alt };
}

export const magnitude = (body: string, date: Date): number => A.Illumination(body as A.Body, date).mag;

export const moonIlluminationPct = (date: Date): number =>
  Math.round(A.Illumination(A.Body.Moon, date).phase_fraction * 100);

export function nextRiseSet(
  body: string,
  obs: A.Observer,
  direction: 1 | -1,
  after: Date,
  limitDays = 1.2,
): Date | undefined {
  return A.SearchRiseSet(body as A.Body, obs, direction, after, limitDays)?.date;
}

export function distanceKm(body: string, date: Date): number {
  return A.GeoVector(body as A.Body, date, true).Length() * A.KM_PER_AU;
}
