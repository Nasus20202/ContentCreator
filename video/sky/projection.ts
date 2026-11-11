/** Stereographic sky camera. Horizon vectors: [x = north, y = west, z = up]. */
import type { Vec3 } from '../../src/core/schemas';

export type Cam = { az: number; alt: number; fov: number };

const D = Math.PI / 180;

export const azAlt = (v: Vec3): { az: number; alt: number } => ({
  az: (((Math.atan2(-v[1], v[0]) / D) % 360) + 360) % 360,
  alt: Math.asin(Math.max(-1, Math.min(1, v[2]))) / D,
});

export const fromAzAlt = (az: number, alt: number): Vec3 => [
  Math.cos(alt * D) * Math.cos(az * D),
  -Math.cos(alt * D) * Math.sin(az * D),
  Math.sin(alt * D),
];

export const midpoint = (a: Vec3, b: Vec3): Vec3 => {
  const m: Vec3 = [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const l = Math.hypot(...m) || 1;
  return [m[0] / l, m[1] / l, m[2] / l];
};

export type Projector = {
  project: (v: Vec3) => [number, number, boolean];
  pxPerDeg: number;
};

export function makeProjector(cam: Cam, W: number, H: number): Projector {
  const a = cam.az * D,
    h = cam.alt * D;
  // East-North-Up basis: forward, right, up
  const f = [Math.sin(a) * Math.cos(h), Math.cos(a) * Math.cos(h), Math.sin(h)];
  const r = [Math.cos(a), -Math.sin(a), 0];
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const scale = W / 2 / (2 * Math.tan((cam.fov * D) / 4));
  const pxPerDeg = scale * 2 * Math.tan(D / 2);
  const project = (v: Vec3): [number, number, boolean] => {
    const e = [-v[1], v[0], v[2]];
    const cx = e[0] * r[0] + e[1] * r[1] + e[2] * r[2];
    const cy = e[0] * u[0] + e[1] * u[1] + e[2] * u[2];
    const cz = e[0] * f[0] + e[1] * f[1] + e[2] * f[2];
    if (cz < -0.3) return [0, 0, false];
    const k = 2 / (1 + cz);
    const x = W / 2 + k * cx * scale;
    const y = H / 2 - k * cy * scale;
    return [x, y, x > -400 && x < W + 400 && y > -400 && y < H + 400];
  };
  return { project, pxPerDeg };
}

export const ease = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Shortest signed azimuth difference b - a in degrees. */
export const azDelta = (a: number, b: number): number => ((((b - a) % 360) + 540) % 360) - 180;

export function lerpCam(a: Cam, b: Cam, t: number): Cam {
  const e = ease(Math.max(0, Math.min(1, t)));
  return {
    az: (a.az + azDelta(a.az, b.az) * e + 360) % 360,
    alt: a.alt + (b.alt - a.alt) * e,
    // zoom in log space so it feels uniform
    fov: Math.exp(Math.log(a.fov) + (Math.log(b.fov) - Math.log(a.fov)) * e),
  };
}

export function camAt(t: number, keys: { t: number; cam: Cam }[]): Cam {
  if (t <= keys[0].t) return keys[0].cam;
  for (let i = 0; i < keys.length - 1; i++) {
    if (t <= keys[i + 1].t)
      return lerpCam(keys[i].cam, keys[i + 1].cam, (t - keys[i].t) / Math.max(1e-6, keys[i + 1].t - keys[i].t));
  }
  return keys[keys.length - 1].cam;
}
