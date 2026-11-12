import React, { useMemo } from 'react';
import { interpolate, random, useCurrentFrame, useVideoConfig } from 'remotion';
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
        top: 420,
        left: 40,
        right: 40,
        textAlign: 'center',
        opacity,
        fontFamily: theme.font,
        color: theme.text,
        textShadow: '0 4px 30px #000',
      }}
    >
      <div style={{ fontSize: 46, fontWeight: 600, letterSpacing: 10, color: accent.hex }}>{kicker.toUpperCase()}</div>
      <div style={{ fontSize: 110, fontWeight: 700, letterSpacing: -2, marginTop: 6, lineHeight: 1 }}>{title}</div>
    </div>
  );
};

export const Badge: React.FC<{ text: string }> = ({ text }) => {
  const accent = useAccent();
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const o = interpolate(frame, [0, 10, durationInFrames - 20, durationInFrames - 5], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
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
      }}
    >
      <div
        style={{
          fontFamily: theme.font,
          fontSize: 34,
          fontWeight: 700,
          letterSpacing: 4,
          color: theme.text,
          background: 'rgba(10,16,36,0.6)',
          border: `2px solid rgba(${accent.rgb},0.6)`,
          padding: '10px 26px',
          borderRadius: 999,
        }}
      >
        ✦ {text.toUpperCase()}
      </div>
    </div>
  );
};

/** Static seeded starfield for non-sky templates. */
export const Starfield: React.FC<{ seed: string; drift?: number }> = ({ seed, drift = 0 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const stars = useMemo(
    () =>
      Array.from({ length: 260 }, (_, i) => ({
        x: random(`${seed}x${i}`) * width,
        y: random(`${seed}y${i}`) * height,
        r: 0.6 + random(`${seed}r${i}`) ** 3 * 2.6,
        a: 0.25 + random(`${seed}a${i}`) * 0.7,
      })),
    [seed, width, height],
  );
  return (
    <svg
      width={width}
      height={height}
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse at 50% 30%, #0b1633 0%, ${theme.bg} 70%)`,
      }}
    >
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={(s.y + frame * drift * s.r) % height} r={s.r} fill="#dfe8ff" opacity={s.a} />
      ))}
    </svg>
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
