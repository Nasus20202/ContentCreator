import React, { useEffect, useRef } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import type { SkySnapshot, Vec3 } from '../../src/core/schemas';
import { useAccent } from '../accent';
import { theme } from '../theme';
import { type Cam, azAlt, fromAzAlt, makeProjector } from './projection';

/** Everything drawn on top of the sky, already resolved to opacities for the current frame. */
export interface SkyOverlay {
  labels: { body: string; text: string; sub?: string; side: 'left' | 'right'; opacity: number }[];
  starLabels: { name: string; opacity: number }[];
  separation?: { a: string; b: string; text: string; opacity: number };
  moonCompare?: { a: string; b: string; count: number; opacity: number };
  constellation?: { id: string; label: string; opacity: number };
  meteors?: { perSecond: number; opacity: number; startSec: number };
  showRadiant: number;
  twilight: number;
  lineOpacity: number;
}

const BODY_COLORS: Record<string, { glow: string; core: string }> = {
  Mercury: { glow: '230,220,205', core: '#fff8ee' },
  Venus: { glow: '255,255,240', core: '#ffffff' },
  Mars: { glow: '255,140,80', core: '#ffd2b0' },
  Jupiter: { glow: '255,244,220', core: '#ffffff' },
  Saturn: { glow: '245,220,160', core: '#fff6dc' },
  Uranus: { glow: '190,235,240', core: '#e8fbff' },
  Neptune: { glow: '160,180,255', core: '#dfe6ff' },
};

function bvColor(bv: number): string {
  if (bv < 0) return '200,215,255';
  if (bv < 0.4) return '230,236,255';
  if (bv < 0.8) return '255,250,235';
  if (bv < 1.3) return '255,225,185';
  return '255,200,150';
}

const hash = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Gentle procedural hills: altitude in degrees by azimuth. */
const hill = (az: number): number =>
  0.6 +
  0.9 * Math.sin(az * 0.07) ** 2 +
  0.6 * Math.sin(az * 0.23 + 1.3) * Math.sin(az * 0.05) +
  0.25 * Math.sin(az * 0.9);

const FONT = theme.font;

export const SkyCanvas: React.FC<{ sky: SkySnapshot; cam: Cam; overlay: SkyOverlay }> = ({ sky, cam, overlay }) => {
  const accent = useAccent();
  const ref = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const { width: W, height: H, fps } = useVideoConfig();

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const { project, pxPerDeg } = makeProjector(cam, W, H);
    const bodyPos = new Map<string, [number, number, boolean]>();
    const zoomBoost = Math.min(2.6, Math.pow(60 / cam.fov, 0.35));

    // --- sky gradient, brighter toward the horizon
    const [, hy] = project(fromAzAlt(cam.az, 0));
    const [, zy] = project(fromAzAlt(cam.az, Math.min(89, cam.alt + 60)));
    const g = ctx.createLinearGradient(0, zy, 0, hy);
    g.addColorStop(0, '#02040b');
    g.addColorStop(0.65, '#071029');
    g.addColorStop(1, '#13244a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    if (overlay.twilight > 0) {
      const s = azAlt(sky.sun);
      const [sx, sy, ok] = project(fromAzAlt(s.az, 0));
      if (ok) {
        const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, W * 1.1);
        rg.addColorStop(0, `rgba(70,110,170,${0.35 * overlay.twilight})`);
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, W, H);
      }
    }

    // --- constellation lines
    for (const l of sky.lines) {
      const hl = overlay.constellation?.id === l.c ? overlay.constellation.opacity : 0;
      const op = overlay.lineOpacity + hl * 0.55;
      if (op <= 0.01) continue;
      ctx.strokeStyle = hl > 0 ? `rgba(140,200,255,${op})` : `rgba(140,170,230,${op})`;
      ctx.lineWidth = hl > 0 ? 2 + hl * 1.5 : 2;
      ctx.beginPath();
      let pen = false;
      for (const p of l.p) {
        const [x, y, ok] = project(p);
        if (!ok) {
          pen = false;
          continue;
        }
        if (pen) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
        pen = true;
      }
      ctx.stroke();
    }

    // --- stars
    sky.stars.forEach(([x0, y0, z0, mag, bv], i) => {
      const [x, y, ok] = project([x0, y0, z0]);
      if (!ok || x < -10 || x > W + 10 || y < -10 || y > H + 10) return;
      const twinkle = 0.82 + 0.18 * Math.sin(frame * (0.12 + hash(i) * 0.25) + hash(i + 7) * 6.28);
      const extinction = z0 < 0.25 ? 0.55 + 0.45 * (z0 / 0.25) : 1;
      const r = Math.max(0.9, (6.0 - mag) * 1.05) * zoomBoost;
      const a = Math.min(1, Math.max(0.18, (6.3 - mag) / 4.5)) * twinkle * Math.max(0.2, extinction);
      const c = bvColor(bv);
      if (mag < 2.2) {
        const gl = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
        gl.addColorStop(0, `rgba(${c},${a * 0.5})`);
        gl.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = gl;
        ctx.beginPath();
        ctx.arc(x, y, r * 4, 0, 6.283);
        ctx.fill();
      }
      ctx.fillStyle = `rgba(${c},${a})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 6.283);
      ctx.fill();
    });

    // --- meteors streaking away from the radiant (deterministic per frame)
    if (overlay.meteors && overlay.meteors.opacity > 0 && sky.radiant) {
      drawMeteors(
        ctx,
        project(sky.radiant),
        pxPerDeg,
        frame / fps - overlay.meteors.startSec,
        overlay.meteors.perSecond,
        overlay.meteors.opacity,
        fps,
      );
    }

    // --- planets and Moon
    for (const b of sky.bodies) {
      const p = project(b.v);
      bodyPos.set(b.name, p);
      if (!p[2] || b.v[2] < -0.02) continue;
      if (b.name === 'Moon') {
        drawMoon(ctx, p[0], p[1], Math.max(34, 0.26 * pxPerDeg), b.phase, project(sky.sun));
        continue;
      }
      const st = BODY_COLORS[b.name] ?? BODY_COLORS.Jupiter;
      const r = Math.max(3, (2.2 - b.mag) * 2.2 + 4) * zoomBoost * 0.8;
      const gl = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r * 6);
      gl.addColorStop(0, `rgba(${st.glow},0.75)`);
      gl.addColorStop(0.25, `rgba(${st.glow},0.25)`);
      gl.addColorStop(1, `rgba(${st.glow},0)`);
      ctx.fillStyle = gl;
      ctx.beginPath();
      ctx.arc(p[0], p[1], r * 6, 0, 6.283);
      ctx.fill();
      ctx.fillStyle = st.core;
      ctx.beginPath();
      ctx.arc(p[0], p[1], r, 0, 6.283);
      ctx.fill();
    }

    const both = (a: string, b: string) => {
      const pa = bodyPos.get(a),
        pb = bodyPos.get(b);
      return pa?.[2] && pb?.[2] ? ([pa, pb] as const) : undefined;
    };

    // --- separation bracket
    const sep = overlay.separation;
    const sp = sep && sep.opacity > 0 ? both(sep.a, sep.b) : undefined;
    if (sep && sp) {
      const [[ax, ay], [bx, by]] = sp;
      const L = Math.hypot(bx - ax, by - ay) || 1;
      const nx = -(by - ay) / L,
        ny = (bx - ax) / L,
        off = 70;
      ctx.strokeStyle = `rgba(${accent.rgb},${sep.opacity})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(ax + nx * (off - 18), ay + ny * (off - 18));
      ctx.lineTo(ax + nx * off, ay + ny * off);
      ctx.lineTo(bx + nx * off, by + ny * off);
      ctx.lineTo(bx + nx * (off - 18), by + ny * (off - 18));
      ctx.stroke();
      ctx.fillStyle = `rgba(${accent.rgb},${sep.opacity})`;
      ctx.font = `700 54px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(sep.text, (ax + bx) / 2 + nx * (off + 50), (ay + by) / 2 + ny * (off + 50) + 18);
    }

    // --- full-moon size comparison discs
    const mc = overlay.moonCompare;
    const mp = mc && mc.opacity > 0 ? both(mc.a, mc.b) : undefined;
    if (mc && mp) {
      const [[ax, ay], [bx, by]] = mp;
      const L = Math.hypot(bx - ax, by - ay) || 1;
      const ux = (bx - ax) / L,
        uy = (by - ay) / L;
      const R = 0.26 * pxPerDeg;
      const nx = uy,
        ny = -ux,
        off = 120;
      ctx.setLineDash([10, 8]);
      ctx.lineWidth = 3;
      for (let k = 0; k < mc.count; k++) {
        const cx = ax + ux * R * (1 + 2 * k) + nx * off,
          cy = ay + uy * R * (1 + 2 * k) + ny * off;
        ctx.fillStyle = `rgba(220,225,240,${0.16 * mc.opacity})`;
        ctx.strokeStyle = `rgba(220,225,240,${0.7 * mc.opacity})`;
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, 6.283);
        ctx.fill();
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(220,225,240,${mc.opacity})`;
      ctx.font = `600 40px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(
        `${mc.count} full Moon${mc.count > 1 ? 's' : ''}`,
        ax + ux * R * mc.count + nx * (off + R + 50),
        ay + uy * R * mc.count + ny * (off + R + 50) + 14,
      );
    }

    // --- radiant marker
    if (overlay.showRadiant > 0 && sky.radiant) {
      const [rx, ry, ok] = project(sky.radiant);
      if (ok) {
        const o = overlay.showRadiant;
        ctx.strokeStyle = `rgba(${accent.rgb},${o})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(rx, ry, 34 + 6 * Math.sin(frame / 6), 0, 6.283);
        ctx.stroke();
        ctx.fillStyle = `rgba(${accent.rgb},${o})`;
        ctx.font = `700 40px ${FONT}`;
        ctx.textAlign = 'right';
        ctx.fillText('RADIANT', rx - 50, ry + 14);
      }
    }

    // --- ground silhouette
    const gpts: [number, number][] = [];
    const span = Math.min(170, cam.fov * 1.3);
    for (let a = cam.az - span; a <= cam.az + span; a += 0.4) {
      const [x, y, ok] = project(fromAzAlt(a, hill(a)));
      if (ok && x > -300 && x < W + 300) gpts.push([x, y]);
    }
    gpts.sort((p, q) => p[0] - q[0]);
    ctx.beginPath();
    if (gpts.length) {
      ctx.moveTo(-300, gpts[0][1]);
      for (const [x, y] of gpts) ctx.lineTo(x, y);
      ctx.lineTo(W + 300, gpts[gpts.length - 1][1]);
    } else ctx.moveTo(-300, H + 300);
    ctx.lineTo(W + 300, H + 300);
    ctx.lineTo(-300, H + 300);
    ctx.closePath();
    const gg = ctx.createLinearGradient(0, hy - 40, 0, H);
    gg.addColorStop(0, '#060912');
    gg.addColorStop(1, '#020305');
    ctx.fillStyle = gg;
    ctx.fill();

    // --- compass points
    ctx.font = `700 38px ${FONT}`;
    ctx.textAlign = 'center';
    for (const [n, a] of [
      ['N', 0],
      ['NE', 45],
      ['E', 90],
      ['SE', 135],
      ['S', 180],
      ['SW', 225],
      ['W', 270],
      ['NW', 315],
    ] as const) {
      const [x, y, ok] = project(fromAzAlt(a, -2.2));
      // keep compass letters out of the caption band (found in QA: they collided with captions)
      const inCaptionBand = y + 30 > theme.captionTop - 70 && y + 30 < theme.captionTop + 280;
      if (!ok || x < 0 || x > W || y > H - 40 || inCaptionBand) continue;
      ctx.fillStyle = 'rgba(160,180,220,0.75)';
      ctx.fillText(n, x, y + 30);
    }

    // --- labels
    for (const l of overlay.labels) {
      const p = bodyPos.get(l.body);
      if (!p?.[2] || l.opacity <= 0) continue;
      drawLabel(ctx, p[0], p[1], l.text, l.sub, l.opacity, l.side, BODY_COLORS[l.body]?.glow ?? '255,255,255');
    }
    for (const s of overlay.starLabels) {
      const star = sky.starNames.find((n) => n.name === s.name);
      if (!star || s.opacity <= 0) continue;
      const [x, y, ok] = project(star.v);
      if (!ok) continue;
      ctx.textAlign = 'left';
      ctx.fillStyle = `rgba(190,205,240,${s.opacity * 0.85})`;
      ctx.font = `500 34px ${FONT}`;
      ctx.fillText(s.name, x + 22, y + 10);
    }
    const hc = overlay.constellation;
    if (hc && hc.opacity > 0) {
      const pts = sky.lines
        .filter((x) => x.c === hc.id)
        .flatMap((x) => x.p)
        .map(project)
        .filter((p) => p[2]);
      if (pts.length) {
        const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        const my = Math.min(...pts.map((p) => p[1]));
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(140,200,255,${hc.opacity})`;
        ctx.font = `700 46px ${FONT}`;
        ctx.fillText(hc.label, mx, my - 40);
      }
    }
  }, [frame, cam, sky, overlay, W, H, fps, accent.rgb]);

  return <canvas ref={ref} width={W} height={H} style={{ position: 'absolute', inset: 0 }} />;
};

function drawLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  sub: string | undefined,
  o: number,
  side: 'left' | 'right',
  rgb: string,
) {
  const dir = side === 'right' ? 1 : -1;
  const lx = x + dir * 60,
    ly = y - 60;
  ctx.strokeStyle = `rgba(255,255,255,${0.6 * o})`;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x + dir * 16, y - 16);
  ctx.lineTo(lx, ly);
  ctx.lineTo(lx + dir * 24, ly);
  ctx.stroke();
  ctx.textAlign = side === 'right' ? 'left' : 'right';
  ctx.fillStyle = `rgba(${rgb},${o})`;
  ctx.font = `700 52px ${FONT}`;
  ctx.fillText(text, lx + dir * 34, ly + 16);
  if (sub) {
    ctx.fillStyle = `rgba(200,210,235,${o * 0.9})`;
    ctx.font = `500 34px ${FONT}`;
    ctx.fillText(sub, lx + dir * 34, ly + 58);
  }
}

function drawMeteors(
  ctx: CanvasRenderingContext2D,
  radiant: [number, number, boolean],
  pxPerDeg: number,
  t: number,
  perSecond: number,
  opacity: number,
  fps: number,
) {
  if (t < 0 || perSecond <= 0) return;
  const [rx, ry] = radiant;
  const first = Math.max(0, Math.floor((t - 1.5) * perSecond));
  const last = Math.ceil(t * perSecond) + 1;
  for (let m = first; m <= last; m++) {
    const start = (m + hash(m * 3.1) * 0.8) / perSecond;
    const life = (14 + hash(m * 5.7) * 10) / fps;
    const k = (t - start) / life;
    if (k < 0 || k > 1) continue;
    const ang = hash(m * 9.3) * Math.PI * 2;
    const d0 = (6 + hash(m * 1.9) * 40) * pxPerDeg;
    const len = (8 + hash(m * 4.4) * 16) * pxPerDeg;
    const head = d0 + len * Math.min(1, k * 1.4);
    const tail = d0 + len * Math.max(0, k * 1.4 - 0.55);
    const hx = rx + Math.cos(ang) * head,
      hy = ry + Math.sin(ang) * head;
    const tx = rx + Math.cos(ang) * tail,
      ty = ry + Math.sin(ang) * tail;
    const fade = Math.sin(Math.PI * k) * opacity;
    const lg = ctx.createLinearGradient(tx, ty, hx, hy);
    lg.addColorStop(0, 'rgba(180,220,255,0)');
    lg.addColorStop(1, `rgba(235,248,255,${fade})`);
    ctx.strokeStyle = lg;
    ctx.lineWidth = 3 + hash(m) * 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${fade})`;
    ctx.beginPath();
    ctx.arc(hx, hy, 3.2, 0, 6.283);
    ctx.fill();
  }
}

/** Moon disc with the correct illuminated fraction; bright limb faces the Sun's projected direction. */
function drawMoon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  k: number,
  sunP: [number, number, boolean],
) {
  const ang = Math.atan2(sunP[1] - y, sunP[0] - x);
  const gl = ctx.createRadialGradient(x, y, r, x, y, r * 5);
  gl.addColorStop(0, `rgba(200,210,235,${0.25 * k})`);
  gl.addColorStop(1, 'rgba(200,210,235,0)');
  ctx.fillStyle = gl;
  ctx.beginPath();
  ctx.arc(x, y, r * 5, 0, 6.283);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = 'rgba(40,46,62,0.9)';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, 6.283);
  ctx.fill();
  const lit = ctx.createRadialGradient(r * 0.3, -r * 0.2, r * 0.1, 0, 0, r * 1.05);
  lit.addColorStop(0, '#fbfaf4');
  lit.addColorStop(1, '#cfd2da');
  ctx.fillStyle = lit;
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
  ctx.ellipse(0, 0, Math.abs(r * (2 * k - 1)), r, 0, Math.PI / 2, -Math.PI / 2, k < 0.5);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(120,125,140,0.28)';
  for (const [mx, my, mr] of [
    [0.25, -0.3, 0.22],
    [-0.1, -0.05, 0.18],
    [0.35, 0.25, 0.16],
    [-0.3, 0.35, 0.12],
  ]) {
    ctx.beginPath();
    ctx.arc(mx * r, my * r, mr * r, 0, 6.283);
    ctx.fill();
  }
  ctx.restore();
}

export type { Vec3 };
