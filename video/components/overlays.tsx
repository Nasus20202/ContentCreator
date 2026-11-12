import React, { useMemo } from 'react';
import { Img, interpolate, random, useCurrentFrame, useVideoConfig } from 'remotion';
import markPng from '../brand/mark.png';
import type { Sentence } from '../../src/core/schemas';
import { captionChunks } from '../../src/voice/timing';
import { useAccent } from '../accent';
import { theme } from '../theme';

/** Short-form captions: ≤4 words per chunk, the word being spoken in accent colour. */
export const Captions: React.FC<{ sentences: Sentence[] }> = ({ sentences }) => {
  const accent = useAccent();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const chunks = useMemo(() => sentences.flatMap((s) => captionChunks(s.words)), [sentences]);
  const idx = chunks.findIndex(
    (c, i) => t >= c[0].start - 0.05 && t < (chunks[i + 1]?.[0].start ?? c[c.length - 1].end + 0.4) - 0.05,
  );
  if (idx < 0) return null;
  const chunk = chunks[idx];
  const pop = Math.min(1, (t - chunk[0].start + 0.05) / 0.12);
  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        right: 60,
        top: theme.captionTop,
        display: 'flex',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: '0 22px',
        transform: `scale(${0.92 + 0.08 * pop})`,
      }}
    >
      {chunk.map((w, i) => (
        <span
          key={i}
          style={{
            fontFamily: theme.font,
            fontWeight: 700,
            fontSize: 84,
            lineHeight: 1.1,
            letterSpacing: -1,
            color: t >= w.start && t < w.end + 0.05 ? accent.hex : theme.text,
            textShadow: '0 4px 0 rgba(0,0,0,0.55), 0 0 30px rgba(0,0,0,0.8)',
            WebkitTextStroke: '2px rgba(0,0,0,0.35)',
          }}
        >
          {w.w.toUpperCase()}
        </span>
      ))}
    </div>
  );
};

export const Chip: React.FC<{ text: string; opacity: number; top?: number }> = ({ text, opacity, top = 300 }) => {
  const accent = useAccent();
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        opacity,
        transform: `translateY(${(1 - opacity) * 20}px)`,
      }}
    >
      <div
        style={{
          fontFamily: theme.font,
          fontWeight: 700,
          fontSize: 42,
          color: theme.chipText,
          background: accent.hex,
          padding: '14px 30px',
          borderRadius: 14,
          letterSpacing: 1,
        }}
      >
        {text}
      </div>
    </div>
  );
};

export const TitleOverlay: React.FC<{ kicker: string; title: string; opacity: number }> = ({
  kicker,
  title,
  opacity,
}) => {
  const accent = useAccent();
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        top: 390,
        left: 20,
        right: 20,
        padding: '30px 20px',
        textAlign: 'center',
        opacity,
        fontFamily: theme.font,
        color: theme.text,
        // A soft scrim keeps the title readable over bright photos (clouds, the Sun); on a dark sky
        // it disappears.
        background:
          'radial-gradient(ellipse at center, rgba(1,3,10,0.62) 0%, rgba(1,3,10,0.4) 50%, rgba(1,3,10,0) 72%)',
        textShadow: '0 2px 6px #000, 0 4px 30px #000',
      }}
    >
      <div style={{ fontSize: 46, fontWeight: 600, letterSpacing: 10, color: accent.hex }}>{kicker.toUpperCase()}</div>
      <div style={{ fontSize: 110, fontWeight: 700, letterSpacing: -2, marginTop: 6, lineHeight: 1 }}>{title}</div>
    </div>
  );
};

/**
 * Series badge with the channel mark, so every frame after the hook carries the brand. A hairline
 * along its bottom edge fills with the episode's progress.
 */
export const Badge: React.FC<{ text: string; offset: number; total: number }> = ({ text, offset, total }) => {
  const accent = useAccent();
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const o = interpolate(frame, [0, 10, durationInFrames - 20, durationInFrames - 5], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const progress = Math.min(1, (frame + offset) / Math.max(1, total));
  return (
    <div
      style={{
        position: 'absolute',
        top: theme.safeTop,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        opacity: o,
        transform: `translateY(${(1 - o) * -12}px)`,
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          fontFamily: theme.font,
          fontSize: 34,
          fontWeight: 700,
          letterSpacing: 4,
          color: theme.text,
          background: 'rgba(8,12,30,0.72)',
          border: `2px solid rgba(${accent.rgb},0.55)`,
          padding: '8px 30px 8px 12px',
          borderRadius: 999,
          overflow: 'hidden',
          boxShadow: `0 6px 30px rgba(0,0,0,0.5), 0 0 24px rgba(${accent.rgb},0.18)`,
        }}
      >
        <Img src={markPng} style={{ width: 58, height: 58, margin: '-6px -4px' }} />
        {text.toUpperCase()}
        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            height: 4,
            width: `${progress * 100}%`,
            background: accent.hex,
            boxShadow: `0 0 10px ${accent.hex}`,
          }}
        />
      </div>
    </div>
  );
};

/** Darkens the frame edges: pulls the eye to the centre and keeps the corners from looking flat. */
export const Vignette: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      background: 'radial-gradient(ellipse 85% 70% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.5) 100%)',
    }}
  />
);

/**
 * Soft colour clouds behind the cards (not over sky views, which show the real sky). Decorative only:
 * they depict no object, they keep the explainer cards from being flat black.
 */
const Nebula: React.FC<{ seed: string }> = ({ seed }) => {
  const accent = useAccent();
  const frame = useCurrentFrame();
  const clouds = useMemo(
    () =>
      [
        { color: `rgba(${accent.rgb},0.20)`, size: 900 },
        { color: 'rgba(118,82,230,0.22)', size: 1100 },
        { color: 'rgba(40,140,220,0.16)', size: 1000 },
      ].map((c, i) => ({
        ...c,
        x: 120 + random(`${seed}nx${i}`) * 840,
        y: 250 + random(`${seed}ny${i}`) * 1250,
        dx: (random(`${seed}dx${i}`) - 0.5) * 0.5,
        dy: (random(`${seed}dy${i}`) - 0.5) * 0.4,
      })),
    [seed, accent.rgb],
  );
  return (
    <>
      {clouds.map((c, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: c.x + frame * c.dx - c.size / 2,
            top: c.y + frame * c.dy - c.size / 2,
            width: c.size,
            height: c.size,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${c.color} 0%, rgba(0,0,0,0) 65%)`,
          }}
        />
      ))}
    </>
  );
};

/**
 * Seeded starfield for non-sky templates, in three depth layers: the near stars drift faster than the
 * far ones, so the background moves with parallax instead of sliding as one sheet. A soft glow at the
 * bottom reads as a horizon, which gives the cards a place to sit.
 */
export const Starfield: React.FC<{ seed: string; drift?: number }> = ({ seed, drift = 0 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const layers = useMemo(
    () =>
      [0.35, 0.7, 1].map((depth, layer) => ({
        depth,
        stars: Array.from({ length: layer === 2 ? 90 : 110 }, (_, i) => ({
          x: random(`${seed}x${layer}${i}`) * width,
          y: random(`${seed}y${layer}${i}`) * height,
          r: (0.5 + random(`${seed}r${layer}${i}`) ** 3 * 2.2) * depth,
          a: (0.25 + random(`${seed}a${layer}${i}`) * 0.7) * (0.5 + 0.5 * depth),
          tw: random(`${seed}t${layer}${i}`) * 6.28,
        })),
      })),
    [seed, width, height],
  );
  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at 50% 30%, #0b1633 0%, ${theme.bg} 70%)`,
        }}
      />
      <Nebula seed={seed} />
      <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id={`horizon-${seed}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1b3a7a" stopOpacity="0" />
            <stop offset="100%" stopColor="#1b3a7a" stopOpacity="0.45" />
          </linearGradient>
        </defs>
        {layers.map((layer, li) =>
          layer.stars.map((s, i) => {
            const twinkle = 0.8 + 0.2 * Math.sin(frame * 0.08 + s.tw);
            return (
              <circle
                key={`${li}-${i}`}
                cx={s.x}
                cy={(s.y + frame * drift * 40 * layer.depth) % height}
                r={s.r}
                fill="#dfe8ff"
                opacity={s.a * twinkle}
              />
            );
          }),
        )}
        <rect x={0} y={height * 0.72} width={width} height={height * 0.28} fill={`url(#horizon-${seed})`} />
      </svg>
    </>
  );
};

export const Credit: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      position: 'absolute',
      // Inside the image band (470..1170) and clear of both the caption band (1290) and the inset
      // labels that sit in the bottom-right of press images: a full-width line at 1185 wrapped onto
      // the radar's own caption in QA, so the credit now lives on a small scrim at the lower left.
      top: 1082,
      left: 44,
      maxWidth: 640,
      fontFamily: theme.font,
      fontSize: 22,
      lineHeight: 1.3,
      color: 'rgba(232,238,250,0.92)',
      background: 'rgba(0,0,0,0.55)',
      padding: '8px 14px',
      borderRadius: 10,
      textShadow: '0 2px 8px #000',
    }}
  >
    {text}
  </div>
);
