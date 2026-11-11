/**
 * Detects what is worth looking at in the sky during a time window, for one location.
 * Output is deterministic: same inputs → same events and facts. Claude ranks/selects, never invents.
 */
import * as A from 'astronomy-engine';
import type { Fact, Location, SkyEvent } from '../../core/schemas';
import { METEOR_SHOWERS, METEOR_SHOWER_SOURCE } from './meteor-showers';
import {
  DAY,
  ENGINE,
  HOUR,
  MOON_DIAMETER_DEG,
  NAKED_EYE_PLANETS,
  bestViewing,
  compassWords,
  distanceKm,
  findMinima,
  formatLocal,
  formatLocalTime,
  geoSeparation,
  horizontal,
  horizontalRaDec,
  localDay,
  magnitude,
  moonIlluminationPct,
  nextRiseSet,
  observer,
  topoSeparation,
} from './sky';

export interface DetectionResult {
  events: SkyEvent[];
  facts: Fact[];
}

const round = (x: number, d = 2): number => Math.round(x * 10 ** d) / 10 ** d;
const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

class FactBook {
  readonly facts: Fact[] = [];
  constructor(private readonly loc: Location) {}

  add(id: string, statement: string, values: number[], inputs: Record<string, unknown>): string {
    this.facts.push({
      id,
      statement,
      values: values.map((v) => round(v, 3)),
      source: {
        type: 'computed',
        method: ENGINE,
        inputs: { location: this.loc.id, lat: this.loc.lat, lon: this.loc.lon, ...inputs },
      },
    });
    return id;
  }

  addSourced(
    id: string,
    statement: string,
    values: number[],
    src: { url: string; title: string; publisher?: string },
  ): string {
    this.facts.push({ id, statement, values, source: { type: 'url', ...src, accessed: isoDay(new Date()) } });
    return id;
  }
}

function viewingOf(body: string, around: Date, loc: Location, obs: A.Observer): SkyEvent['viewing'] {
  const v = bestViewing(body, new Date(around.getTime() - 14 * HOUR), new Date(around.getTime() + 14 * HOUR), obs);
  if (!v) return undefined;
  return {
    bestLocal: formatLocal(v.time, loc.timeZone),
    bestUtc: v.time.toISOString(),
    azimuth: round(v.az, 1),
    altitude: round(v.alt, 1),
    direction: compassWords(v.az),
  };
}

function conjunctions(loc: Location, start: Date, end: Date, fb: FactBook): SkyEvent[] {
  const obs = observer(loc);
  const out: SkyEvent[] = [];
  const planets = [...NAKED_EYE_PLANETS];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const [a, b] = [planets[i], planets[j]];
      // search a padded window so a minimum right at the edge is still found
      const minima = findMinima(
        (d) => geoSeparation(a, b, d),
        new Date(start.getTime() - DAY),
        new Date(end.getTime() + DAY),
        3 * HOUR,
      );
      for (const m of minima) {
        if (m.value > 3 || m.time < start || m.time > end) continue;
        const viewing = viewingOf(a, m.time, loc, obs);
        const ma = magnitude(a, m.time),
          mb = magnitude(b, m.time);
        const id = `conj-${slug(a)}-${slug(b)}-${isoDay(m.time)}`;
        const ids = [
          fb.add(
            `${id}-sep`,
            `${a} and ${b} are closest on ${formatLocal(m.time, loc.timeZone)} (${loc.label} time), ${round(m.value)}° apart.`,
            [m.value, localDay(m.time, loc.timeZone)],
            { a, b, minimumUtc: m.time.toISOString() },
          ),
          fb.add(
            `${id}-moons`,
            `That separation equals about ${round(m.value / MOON_DIAMETER_DEG, 1)} full-Moon diameters (full Moon ≈ ${MOON_DIAMETER_DEG}°).`,
            [m.value / MOON_DIAMETER_DEG],
            { moonDiameterDeg: MOON_DIAMETER_DEG },
          ),
          fb.add(
            `${id}-dist`,
            `On that date ${a} is ${Math.round(distanceKm(a, m.time) / 1e6)} million km from Earth and ${b} is ${Math.round(distanceKm(b, m.time) / 1e6)} million km; ${b} is ${round(distanceKm(b, m.time) / distanceKm(a, m.time), 1)}× farther.`,
            [distanceKm(a, m.time) / 1e6, distanceKm(b, m.time) / 1e6, distanceKm(b, m.time) / distanceKm(a, m.time)],
            { at: m.time.toISOString() },
          ),
          fb.add(
            `${id}-mag`,
            `Brightness: ${a} magnitude ${round(ma, 1)}, ${b} magnitude ${round(mb, 1)} (lower = brighter).`,
            [ma, mb],
            { at: m.time.toISOString() },
          ),
        ];
        if (viewing) {
          ids.push(
            fb.add(
              `${id}-view`,
              `Best seen around ${viewing.bestLocal}, ${viewing.direction}, ${Math.round(viewing.altitude)}° above the horizon.`,
              [viewing.altitude, viewing.azimuth],
              { a, viewing },
            ),
          );
        }
        const brightBonus = Math.min(ma, mb) < -1 ? 10 : 0;
        out.push({
          id,
          kind: 'conjunction',
          title: `${a}–${b} conjunction (${round(m.value, 1)}°)`,
          time: m.time.toISOString(),
          score: viewing ? Math.round(60 + (3 - m.value) * 8 + brightBonus) : 15,
          bodies: [a, b],
          viewing,
          factIds: ids,
          notes: viewing
            ? []
            : ['Not visible in a dark sky from this location (too close to the Sun or below horizon).'],
        });
      }
    }
  }
  return out;
}

function moonPasses(loc: Location, start: Date, end: Date, fb: FactBook): SkyEvent[] {
  const obs = observer(loc);
  const out: SkyEvent[] = [];
  for (const p of NAKED_EYE_PLANETS) {
    for (const m of findMinima((d) => topoSeparation('Moon', p, d, obs), start, end, 2 * HOUR)) {
      if (m.value > 6) continue;
      const viewing = viewingOf(p, m.time, loc, obs);
      const id = `moon-${slug(p)}-${isoDay(m.time)}`;
      const ids = [
        fb.add(
          `${id}-sep`,
          `The Moon passes ${round(m.value, 1)}° from ${p} on ${formatLocal(m.time, loc.timeZone)} (as seen from ${loc.label}).`,
          [m.value, localDay(m.time, loc.timeZone)],
          { body: p, minimumUtc: m.time.toISOString() },
        ),
        fb.add(
          `${id}-illum`,
          `The Moon is ${moonIlluminationPct(m.time)}% illuminated then.`,
          [moonIlluminationPct(m.time)],
          { at: m.time.toISOString() },
        ),
      ];
      if (viewing)
        ids.push(
          fb.add(
            `${id}-view`,
            `Best seen around ${viewing.bestLocal}, ${viewing.direction}, ${Math.round(viewing.altitude)}° up.`,
            [viewing.altitude],
            { viewing },
          ),
        );
      out.push({
        id,
        kind: 'moon-pass',
        title: `Moon near ${p} (${round(m.value, 1)}°)`,
        time: m.time.toISOString(),
        score: viewing ? Math.round(40 + (6 - m.value) * 4) : 10,
        bodies: ['Moon', p],
        viewing,
        factIds: ids,
        notes: [],
      });
    }
  }
  return out;
}

function meteorShowers(loc: Location, start: Date, end: Date, fb: FactBook): SkyEvent[] {
  const obs = observer(loc);
  const out: SkyEvent[] = [];
  for (const s of METEOR_SHOWERS) {
    const peak = A.SearchSunLongitude(s.peakSolarLongitude, new Date(start.getTime() - 2 * DAY), 9)?.date;
    if (!peak || peak < new Date(start.getTime() - DAY) || peak > end) continue;
    // the useful night is the local night around the peak; check radiant at 04:00-ish (sample the dark hours)
    let best = { time: peak, alt: -90, az: 0 };
    for (let t = peak.getTime() - 14 * HOUR; t <= peak.getTime() + 14 * HOUR; t += 15 * 60_000) {
      const d = new Date(t);
      if (horizontal('Sun', d, obs).alt > -12) continue;
      const h = horizontalRaDec(s.radiant.ra / 15, s.radiant.dec, d, obs);
      if (h.alt > best.alt) best = { time: d, ...h };
    }
    const illum = moonIlluminationPct(best.time);
    const moonAlt = horizontal('Moon', best.time, obs).alt;
    const moonset = nextRiseSet('Moon', obs, -1, new Date(best.time.getTime() - 12 * HOUR));
    const id = `meteors-${slug(s.name)}-${isoDay(peak)}`;
    const ids = [
      fb.addSourced(
        `${id}-zhr`,
        `${s.name} ZHR ≈ ${s.zhr} meteors per hour under ideal conditions; parent: ${s.parentBody}.`,
        [s.zhr],
        METEOR_SHOWER_SOURCE,
      ),
      fb.add(
        `${id}-peak`,
        `${s.name} peak (solar longitude ${s.peakSolarLongitude}°) falls on ${formatLocal(peak, loc.timeZone)} (${loc.label} time).`,
        [localDay(peak, loc.timeZone), localDay(best.time, loc.timeZone)],
        { solarLongitude: s.peakSolarLongitude, peakUtc: peak.toISOString() },
      ),
      fb.add(
        `${id}-radiant`,
        `The radiant (in ${s.constellation}) is highest in darkness around ${formatLocal(best.time, loc.timeZone)}, ${Math.round(best.alt)}° up in the ${compassWords(best.az)}.`,
        [best.alt],
        { radiant: s.radiant, bestUtc: best.time.toISOString() },
      ),
      fb.add(
        `${id}-moon`,
        `The Moon is ${illum}% illuminated${moonAlt < 0 ? ' and below the horizon' : ` and ${Math.round(moonAlt)}° up`} at that time.`,
        [illum],
        { at: best.time.toISOString(), moonAlt },
      ),
    ];
    if (moonset)
      ids.push(
        fb.add(`${id}-moonset`, `Moonset that night: ${formatLocalTime(moonset, loc.timeZone)} local time.`, [], {
          moonsetUtc: moonset.toISOString(),
        }),
      );
    const moonPenalty = moonAlt > 0 ? (illum / 100) * 35 : 0;
    out.push({
      id,
      kind: 'meteor-shower',
      title: `${s.name} peak (ZHR ~${s.zhr})`,
      time: peak.toISOString(),
      score: Math.round(Math.min(85, 35 + s.zhr / 2.5) - moonPenalty - (best.alt < 15 ? 25 : 0)),
      bodies: [],
      viewing: {
        bestLocal: formatLocal(best.time, loc.timeZone),
        bestUtc: best.time.toISOString(),
        azimuth: round(best.az, 1),
        altitude: round(best.alt, 1),
        direction: compassWords(best.az),
      },
      factIds: ids,
      notes: [`radiant RA ${s.radiant.ra}° Dec ${s.radiant.dec}°`, `constellation ${s.constellation}`],
    });
  }
  return out;
}

function moonPhases(loc: Location, start: Date, end: Date, fb: FactBook): SkyEvent[] {
  const names = ['New Moon', 'First Quarter', 'Full Moon', 'Last Quarter'];
  const out: SkyEvent[] = [];
  let q = A.SearchMoonQuarter(start);
  while (q.time.date <= end) {
    const id = `phase-${slug(names[q.quarter])}-${isoDay(q.time.date)}`;
    out.push({
      id,
      kind: 'moon-phase',
      title: names[q.quarter],
      time: q.time.date.toISOString(),
      score: q.quarter === 0 ? 20 : 10,
      bodies: ['Moon'],
      factIds: [
        fb.add(
          id,
          `${names[q.quarter]}: ${formatLocal(q.time.date, loc.timeZone)} (${loc.label} time).`,
          [localDay(q.time.date, loc.timeZone)],
          { quarter: q.quarter },
        ),
      ],
      notes: [],
    });
    q = A.NextMoonQuarter(q);
  }
  return out;
}

function oppositionsAndElongations(loc: Location, start: Date, end: Date, fb: FactBook): SkyEvent[] {
  const obs = observer(loc);
  const out: SkyEvent[] = [];
  for (const p of ['Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune']) {
    const t = A.SearchRelativeLongitude(p as A.Body, 0, start).date;
    if (t > end) continue;
    const id = `opposition-${slug(p)}-${isoDay(t)}`;
    const viewing = viewingOf(p, t, loc, obs);
    out.push({
      id,
      kind: 'opposition',
      title: `${p} at opposition`,
      time: t.toISOString(),
      score: p === 'Mars' ? 80 : p === 'Jupiter' || p === 'Saturn' ? 60 : 30,
      bodies: [p],
      viewing,
      factIds: [
        fb.add(
          id,
          `${p} reaches opposition on ${formatLocal(t, loc.timeZone)}: opposite the Sun, up all night, magnitude ${round(magnitude(p, t), 1)}.`,
          [localDay(t, loc.timeZone), magnitude(p, t)],
          { body: p },
        ),
      ],
      notes: p === 'Uranus' || p === 'Neptune' ? ['Needs binoculars (Uranus) or a telescope (Neptune).'] : [],
    });
  }
  for (const p of ['Mercury', 'Venus']) {
    const e = A.SearchMaxElongation(p as A.Body, start);
    if (e.time.date > end) continue;
    const id = `elongation-${slug(p)}-${isoDay(e.time.date)}`;
    out.push({
      id,
      kind: 'elongation',
      title: `${p} at greatest ${e.visibility} elongation (${round(e.elongation, 1)}°)`,
      time: e.time.date.toISOString(),
      score: p === 'Mercury' ? 45 : 40,
      bodies: [p],
      viewing: viewingOf(p, e.time.date, loc, obs),
      factIds: [
        fb.add(
          id,
          `${p} is ${round(e.elongation, 1)}° from the Sun in the ${e.visibility} sky on ${formatLocal(e.time.date, loc.timeZone)}.`,
          [e.elongation, localDay(e.time.date, loc.timeZone)],
          { body: p },
        ),
      ],
      notes: [],
    });
  }
  return out;
}

function eclipses(loc: Location, start: Date, end: Date, fb: FactBook): SkyEvent[] {
  const obs = observer(loc);
  const out: SkyEvent[] = [];
  const lunar = A.SearchLunarEclipse(start);
  if (lunar.peak.date <= end) {
    const alt = horizontal('Moon', lunar.peak.date, obs).alt;
    const id = `lunar-eclipse-${isoDay(lunar.peak.date)}`;
    out.push({
      id,
      kind: 'lunar-eclipse',
      title: `${lunar.kind} lunar eclipse`,
      time: lunar.peak.date.toISOString(),
      score: alt > 0 ? (lunar.kind === A.EclipseKind.Total ? 98 : 75) : 35,
      bodies: ['Moon'],
      factIds: [
        fb.add(
          id,
          `A ${lunar.kind} lunar eclipse peaks ${formatLocal(lunar.peak.date, loc.timeZone)}; Moon altitude then ${Math.round(alt)}° from ${loc.label}.`,
          [alt],
          { kind: lunar.kind },
        ),
      ],
      notes: alt > 0 ? [] : ['Moon is below the horizon at peak from this location.'],
    });
  }
  const solar = A.SearchLocalSolarEclipse(start, obs);
  if (solar.peak.time.date <= end) {
    const id = `solar-eclipse-${isoDay(solar.peak.time.date)}`;
    out.push({
      id,
      kind: 'solar-eclipse',
      title: `${solar.kind} solar eclipse (obscuration ${Math.round(solar.obscuration * 100)}%)`,
      time: solar.peak.time.date.toISOString(),
      score: 95,
      bodies: ['Sun', 'Moon'],
      factIds: [
        fb.add(
          id,
          `A ${solar.kind} solar eclipse is visible from ${loc.label}, peaking ${formatLocal(solar.peak.time.date, loc.timeZone)} with ${Math.round(solar.obscuration * 100)}% of the Sun covered.`,
          [solar.obscuration * 100],
          { kind: solar.kind },
        ),
      ],
      notes: ['Never look at the Sun without certified eclipse glasses — the script MUST say this.'],
    });
  }
  return out;
}

function planetVisibility(loc: Location, start: Date, end: Date, fb: FactBook): SkyEvent[] {
  const obs = observer(loc);
  const mid = new Date((start.getTime() + end.getTime()) / 2);
  const out: SkyEvent[] = [];
  for (const p of NAKED_EYE_PLANETS) {
    const v = bestViewing(p, new Date(mid.getTime() - 12 * HOUR), new Date(mid.getTime() + 12 * HOUR), obs);
    if (!v) continue;
    const mag = magnitude(p, v.time);
    const id = `visible-${slug(p)}-${isoDay(mid)}`;
    out.push({
      id,
      kind: 'planet-visibility',
      title: `${p} visible (mag ${round(mag, 1)})`,
      time: v.time.toISOString(),
      score: Math.round(Math.max(5, 20 - mag * 4)),
      bodies: [p],
      viewing: {
        bestLocal: formatLocal(v.time, loc.timeZone),
        bestUtc: v.time.toISOString(),
        azimuth: round(v.az, 1),
        altitude: round(v.alt, 1),
        direction: compassWords(v.az),
      },
      factIds: [
        fb.add(
          id,
          `Mid-week, ${p} (magnitude ${round(mag, 1)}) is best seen around ${formatLocalTime(v.time, loc.timeZone)}, ${compassWords(v.az)}, ${Math.round(v.alt)}° up.`,
          [mag, v.alt],
          { body: p },
        ),
      ],
      notes: [],
    });
  }
  return out;
}

export function detectSkyEvents(loc: Location, start: Date, end: Date): DetectionResult {
  const fb = new FactBook(loc);
  const last = new Date(end.getTime() - 1);
  fb.add(
    'episode-window',
    `This episode covers ${formatLocal(start, loc.timeZone).slice(0, 10)} to ${formatLocal(last, loc.timeZone).slice(0, 10)} ${start.getUTCFullYear()}.`,
    [localDay(start, loc.timeZone), localDay(last, loc.timeZone), start.getUTCFullYear()],
    { start: start.toISOString(), end: end.toISOString() },
  );
  fb.add(
    'episode-location',
    `Positions are computed for ${loc.label} (${Math.abs(loc.lat)}°${loc.lat >= 0 ? 'N' : 'S'}, ${Math.abs(loc.lon)}°${loc.lon >= 0 ? 'E' : 'W'}).`,
    [Math.abs(loc.lat), Math.abs(loc.lon)],
    {},
  );
  const events = [
    ...conjunctions(loc, start, end, fb),
    ...moonPasses(loc, start, end, fb),
    ...meteorShowers(loc, start, end, fb),
    ...moonPhases(loc, start, end, fb),
    ...oppositionsAndElongations(loc, start, end, fb),
    ...eclipses(loc, start, end, fb),
    ...planetVisibility(loc, start, end, fb),
  ].sort((a, b) => b.score - a.score || a.time.localeCompare(b.time));
  return { events, facts: fb.facts };
}
