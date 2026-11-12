import React, { useMemo } from 'react';
import { AbsoluteFill, random } from 'remotion';
import { theme } from '../theme';
import { BlackHoleMark } from './BlackHoleMark';

export const BRAND = {
  name: 'Photon Sphere',
  tagline: 'Your sky this week, computed, not guessed',
} as const;

const Stars: React.FC<{
  width: number;
  height: number;
  count: number;
  seed: string;
  /** Rectangles (x0, y0, x1, y1) kept free of stars, e.g. behind text. */
  keepOut?: [number, number, number, number][];
}> = ({ width, height, count, seed, keepOut = [] }) => {
  const stars = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: random(`${seed}x${i}`) * width,
        y: random(`${seed}y${i}`) * height,
        r: 0.7 + random(`${seed}r${i}`) ** 4 * 2.6,
        a: 0.2 + random(`${seed}a${i}`) * 0.6,
      })).filter((s) => !keepOut.some(([x0, y0, x1, y1]) => s.x > x0 && s.x < x1 && s.y > y0 && s.y < y1)),
    [width, height, count, seed, keepOut],
  );
  return (
    <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#dfe8ff" opacity={s.a} />
      ))}
    </svg>
  );
};

/** Square avatar (YouTube/TikTok crop it to a circle). */
export const Logo: React.FC = () => (
  <AbsoluteFill style={{ background: theme.bg }}>
    <BlackHoleMark size={800} radius={0.19} />
  </AbsoluteFill>
);

/**
 * The mark alone on a transparent background, for use inside episodes (badge, outro). Rendered to
 * video/brand/mark.png: pnpm exec remotion still video/index.tsx Mark video/brand/mark.png
 */
export const Mark: React.FC = () => (
  <AbsoluteFill>
    <BlackHoleMark size={512} radius={0.15} />
  </AbsoluteFill>
);

const BANNER_TEXT_BOX: [number, number, number, number] = [1000, 590, 2060, 840];
const HOLE = { x: 760, y: 720, size: 1400 };

/**
 * YouTube banner, 2560×1440. Only the centre 1546×423 (x 507–2053, y 508–931) is visible
 * on every device, so the mark and the name sit inside it; the rest is atmosphere.
 */
export const Banner: React.FC = () => (
  <AbsoluteFill style={{ background: theme.bg, fontFamily: theme.font, color: theme.text }}>
    <Stars width={2560} height={1440} count={900} seed="banner" keepOut={[BANNER_TEXT_BOX]} />
    <div style={{ position: 'absolute', left: HOLE.x - HOLE.size / 2, top: HOLE.y - HOLE.size / 2 }}>
      <BlackHoleMark size={HOLE.size} radius={0.075} />
    </div>
    <div
      style={{
        position: 'absolute',
        left: BANNER_TEXT_BOX[0],
        top: BANNER_TEXT_BOX[1],
        width: BANNER_TEXT_BOX[2] - BANNER_TEXT_BOX[0] - 40,
        height: BANNER_TEXT_BOX[3] - BANNER_TEXT_BOX[1],
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-end',
      }}
    >
      <div style={{ fontSize: 112, fontWeight: 700, letterSpacing: 4, lineHeight: 1 }}>{BRAND.name.toUpperCase()}</div>
      <div style={{ fontSize: 40, fontWeight: 500, color: theme.muted, marginTop: 22 }}>{BRAND.tagline}</div>
    </div>
  </AbsoluteFill>
);
