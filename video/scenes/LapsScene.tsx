import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import type { LapsParams } from '../../src/core/schemas';
import { useAccent } from '../accent';
import { Starfield } from '../components/overlays';
import { useSceneTime } from '../scene-context';
import { ease } from '../sky/projection';
import { theme } from '../theme';

const CX = 540;
const CY = 820;
const R = 190;
const RX = 330;
const RY = 96;
const TILT = -14;

const FILL: Record<LapsParams['body'], string> = {
  earth: 'radial-gradient(circle at 36% 32%, #d8f0ff 0%, #4aa0e8 28%, #1d5fb8 55%, #0a2556 85%, #04122e 100%)',
  moon: 'radial-gradient(circle at 36% 32%, #ffffff 0%, #cfd2d8 40%, #7c818c 85%, #3a3d44 100%)',
};

/**
 * Something circling a body in slow motion, with a lap counter. The ring is drawn in two halves so
 * the traveller passes behind the body and in front of it.
 */
export const LapsScene: React.FC<{ params: LapsParams }> = ({ params }) => {
  const accent = useAccent();
  const { t, at, props } = useSceneTime();
  const photo = params.assetId ? props.assets[params.assetId] : undefined;
  const t0 = at(params.start);
  const p = Math.min(1, Math.max(0, (t - t0) / params.over));
  const laps = params.laps * p;
  const a = laps * 2 * Math.PI + Math.PI / 2;
  const appear = ease(Math.min(1, t / 0.6));
  const px = RX * Math.cos(a);
  const py = RY * Math.sin(a);
  const front = Math.sin(a) > 0;
  const trail = Array.from({ length: 14 }, (_, i) => {
    const b = a - (i + 1) * 0.09;
    return { x: RX * Math.cos(b), y: RY * Math.sin(b), o: 1 - i / 14, front: Math.sin(b) > 0 };
  });

  const ring = (half: 'back' | 'front') => (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
      <g transform={`translate(${CX} ${CY}) rotate(${TILT})`}>
        <path
          d={half === 'back' ? `M ${-RX} 0 A ${RX} ${RY} 0 0 1 ${RX} 0` : `M ${RX} 0 A ${RX} ${RY} 0 0 1 ${-RX} 0`}
          fill="none"
          stroke={accent.hex}
          strokeWidth={3}
          opacity={0.45 * appear}
        />
        {t >= t0 &&
          trail
            .filter((d) => d.front === (half === 'front'))
            .map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={9 * d.o + 2} fill="#fff6cc" opacity={0.55 * d.o} />)}
        {t >= t0 && front === (half === 'front') && (
          <circle cx={px} cy={py} r={16} fill="#fffdf0" style={{ filter: `drop-shadow(0 0 18px #fff6b0)` }} />
        )}
      </g>
    </svg>
  );

  return (
    <AbsoluteFill>
      <Starfield seed="laps" drift={0.015} />
      {ring('back')}
      <div
        style={{
          position: 'absolute',
          left: CX - R,
          top: CY - R,
          width: 2 * R,
          height: 2 * R,
          borderRadius: '50%',
          overflow: 'hidden',
          background: photo ? '#000' : FILL[params.body],
          boxShadow: `0 0 80px rgba(80,160,255,0.5)${photo ? '' : ', inset -40px -30px 80px rgba(0,0,0,0.65)'}`,
          opacity: appear,
          transform: `scale(${0.92 + 0.08 * appear}) rotate(${t * 2}deg)`,
        }}
      >
        {photo && (
          // Crop the photo to its disc: scale so the disc fills the circle, centred on the disc.
          <Img
            src={staticFile(photo.file)}
            style={{
              position: 'absolute',
              width: (2 * R) / params.disc.size,
              height: (2 * R) / params.disc.size,
              left: R - ((2 * R) / params.disc.size) * params.disc.cx,
              top: R - ((2 * R) / params.disc.size) * params.disc.cy,
            }}
          />
        )}
      </div>
      {ring('front')}
      <div
        style={{
          position: 'absolute',
          top: 300,
          left: 60,
          right: 60,
          textAlign: 'center',
          fontFamily: theme.font,
          opacity: appear,
          textShadow: '0 4px 24px #000',
        }}
      >
        <div
          style={{
            fontSize: 190,
            fontWeight: 700,
            lineHeight: 1,
            color: accent.hex,
            fontVariantNumeric: 'tabular-nums',
            textShadow: `0 0 50px ${accent.hex}66`,
          }}
        >
          {p >= 1 ? String(params.laps) : laps.toFixed(1)}
          <span style={{ fontSize: 80 }}>×</span>
        </div>
        <div style={{ fontSize: 50, fontWeight: 600, color: theme.text, marginTop: 4 }}>{params.label}</div>
      </div>
      {params.note && (
        <div
          style={{
            position: 'absolute',
            top: CY + R + 50,
            left: 60,
            right: 60,
            textAlign: 'center',
            fontFamily: theme.font,
            fontSize: 32,
            color: theme.muted,
            opacity: appear,
          }}
        >
          {params.note}
        </div>
      )}
      {photo && (
        <div
          style={{
            position: 'absolute',
            top: CY + R + 100,
            left: 60,
            right: 60,
            textAlign: 'center',
            fontFamily: theme.font,
            fontSize: 22,
            color: 'rgba(232,238,250,0.75)',
          }}
        >
          {photo.credit}
        </div>
      )}
    </AbsoluteFill>
  );
};
