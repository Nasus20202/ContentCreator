/**
 * Builds render-ready sky geometry: unit vectors in the observer's horizon frame
 * (x = north, y = west, z = up), so the browser only has to project, not compute astronomy.
 */
import * as A from 'astronomy-engine';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { paths } from '../../core/paths';
import type { Location, OrbitSnapshot, SkySnapshot, Vec3 } from '../../core/schemas';
import { observer } from './sky';

const StarCatalog = z.object({
  features: z.array(
    z.object({
      properties: z.object({ mag: z.number(), bv: z.union([z.string(), z.number()]).optional() }),
      geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
    }),
  ),
});
const LineCatalog = z.object({
  features: z.array(
    z.object({
      id: z.string(),
      geometry: z.object({ coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))) }),
    }),
  ),
});

let cache: { stars: z.infer<typeof StarCatalog>; lines: z.infer<typeof LineCatalog> } | undefined;
function catalogs() {
  cache ??= {
    stars: StarCatalog.parse(JSON.parse(fs.readFileSync(path.join(paths.catalog, 'stars.6.json'), 'utf8'))),
    lines: LineCatalog.parse(
      JSON.parse(fs.readFileSync(path.join(paths.catalog, 'constellations.lines.json'), 'utf8')),
    ),
  };
  return cache;
}

/** Bright named stars that templates may label. J2000 RA/Dec in degrees. */
export const NAMED_STARS: Record<string, [number, number]> = {
  Sirius: [101.287, -16.716],
  Arcturus: [213.915, 19.182],
  Vega: [279.234, 38.784],
  Capella: [79.172, 45.998],
  Rigel: [78.634, -8.202],
  Procyon: [114.825, 5.225],
  Betelgeuse: [88.793, 7.407],
  Altair: [297.696, 8.868],
  Aldebaran: [68.98, 16.509],
  Antares: [247.352, -26.432],
  Spica: [201.298, -11.161],
  Pollux: [116.329, 28.026],
  Fomalhaut: [344.413, -29.622],
  Deneb: [310.358, 45.28],
  Regulus: [152.093, 11.967],
  Castor: [113.65, 31.888],
  Polaris: [37.955, 89.264],
  Pleiades: [56.75, 24.117],
};

const r5 = (x: number): number => Math.round(x * 1e5) / 1e5;
const r3v = (v: Vec3): Vec3 => [r5(v[0]), r5(v[1]), r5(v[2])];

export function eqjUnit(raDeg: number, decDeg: number): Vec3 {
  const ra = (raDeg * Math.PI) / 180,
    dec = (decDeg * Math.PI) / 180;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

export function skySnapshot(
  loc: Location,
  isoTime: string,
  bodies: string[],
  radiant?: { ra: number; dec: number },
  magLimit = 5.6,
): SkySnapshot {
  const date = new Date(isoTime);
  const time = new A.AstroTime(date);
  const obs = observer(loc);
  const rot = A.Rotation_EQJ_HOR(time, obs);
  const toHor = (v: Vec3): Vec3 => {
    const o = A.RotateVector(rot, new A.Vector(v[0], v[1], v[2], time));
    return [o.x, o.y, o.z];
  };
  const { stars, lines } = catalogs();

  const starOut: SkySnapshot['stars'] = [];
  for (const f of stars.features) {
    if (f.properties.mag > magLimit) continue;
    const h = toHor(eqjUnit(...f.geometry.coordinates));
    if (h[2] < -0.1) continue;
    const bv = Number(f.properties.bv ?? 0.6);
    starOut.push([...r3v(h), f.properties.mag, Number.isFinite(bv) ? Math.round(bv * 100) / 100 : 0.6]);
  }

  const lineOut: SkySnapshot['lines'] = [];
  for (const f of lines.features) {
    for (const seg of f.geometry.coordinates) {
      const p = seg.map(([ra, dec]) => r3v(toHor(eqjUnit(ra, dec))));
      if (p.some((v) => v[2] > -0.05)) lineOut.push({ c: f.id, p });
    }
  }

  const unitOf = (v: A.Vector): Vec3 => {
    const l = v.Length();
    return [v.x / l, v.y / l, v.z / l];
  };

  return {
    time: isoTime,
    stars: starOut,
    lines: lineOut,
    starNames: Object.entries(NAMED_STARS).map(([name, [ra, dec]]) => ({ name, v: r3v(toHor(eqjUnit(ra, dec))) })),
    bodies: bodies.map((b) => {
      const eq = A.Equator(b as A.Body, date, obs, false, true);
      const ill = A.Illumination(b as A.Body, date);
      return {
        name: b,
        v: r3v(toHor(unitOf(eq.vec))),
        mag: Math.round(ill.mag * 100) / 100,
        phase: Math.round(ill.phase_fraction * 1000) / 1000,
        distAu: Math.round(eq.dist * 1e4) / 1e4,
      };
    }),
    sun: r3v(toHor(unitOf(A.Equator(A.Body.Sun, date, obs, false, true).vec))),
    radiant: radiant ? r3v(toHor(eqjUnit(radiant.ra, radiant.dec))) : undefined,
  };
}

/** Heliocentric ecliptic positions (AU) for the 3D orbit template. */
export function orbitSnapshot(isoTime: string, bodies: string[]): OrbitSnapshot {
  const date = new Date(isoTime);
  return {
    bodies: bodies.map((b) => {
      const v = A.HelioVector(b as A.Body, date);
      const ecl = A.Ecliptic(v);
      const r = v.Length();
      const lon = (ecl.elon * Math.PI) / 180;
      const distKm = b === 'Earth' ? 0 : A.GeoVector(b as A.Body, date, true).Length() * A.KM_PER_AU;
      return { name: b, xy: [r5(r * Math.cos(lon)), r5(r * Math.sin(lon))], r: r5(r), distKm: Math.round(distKm) };
    }),
  };
}
