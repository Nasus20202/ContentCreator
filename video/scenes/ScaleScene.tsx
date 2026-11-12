import React from 'react';
import { AbsoluteFill } from 'remotion';
import type { ScaleParams } from '../../src/core/schemas';
import { useAccent } from '../accent';
import { useSceneTime } from '../scene-context';
import { ease } from '../sky/projection';
import { Starfield } from '../components/overlays';
import { theme } from '../theme';

const TOP = 330;
const BOTTOM = 1090;
const X = 300;

/**
 * A distance drawn to scale: the line grows from the start (top) to the far end (bottom), and each
 * marker is placed at its distance along it. Nothing is exaggerated, so a near point stays at the top.
 * A spark travels down the line once it is drawn, so the length is felt, not just seen.
 */
export const ScaleScene: React.FC<{ params: ScaleParams }> = ({ params }) => {
  const accent = useAccent();
  const { t } = useSceneTime();
  const grow = ease(Math.min(1, t / 2.4));
  const y = (at: number) => TOP + (BOTTOM - TOP) * Math.min(1, at / params.total);
  const len = BOTTOM - TOP;
  const spark = t > 2.4 ? ((t - 2.4) / 2.6) % 1 : -1;
  return (
    <AbsoluteFill>
      <Starfield seed="scale" drift={0.02} />
      {/* Ticks every tenth of the way, so the scale has a ruler. */}
      {Array.from({ length: 11 }, (_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: X - (i % 5 === 0 ? 26 : 16),
            top: TOP + (len * i) / 10 - 1.5,
            width: i % 5 === 0 ? 52 : 32,
            height: 3,
            background: 'rgba(220,230,255,0.35)',
            opacity: ease(Math.min(1, Math.max(0, (grow * 10 - i) / 1))),
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          left: X - 5,
          top: TOP,
          width: 10,
          height: len * grow,
          background: `linear-gradient(180deg, #ffffff, ${accent.hex})`,
          borderRadius: 5,
          boxShadow: `0 0 28px ${accent.hex}`,
        }}
      />
      {spark >= 0 && (
        <div
          style={{
            position: 'absolute',
            left: X - 14,
            top: TOP + len * spark - 14,
            width: 28,
            height: 28,
            borderRadius: 14,
            background: '#fff',
            boxShadow: `0 0 30px #fff, 0 0 60px ${accent.hex}`,
            opacity: Math.sin(spark * Math.PI),
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          left: X - 16,
          top: TOP - 16,
          width: 32,
          height: 32,
          borderRadius: 16,
          background: theme.text,
          boxShadow: '0 0 24px #fff',
        }}
      />
      {params.markers.map((m, i) => {
        const my = y(m.at);
        const opacity = ease(Math.min(1, Math.max(0, (t - 0.8 - i * 0.9) / 0.6)));
        const far = m.at / params.total > 0.9;
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: 'absolute',
                left: X - 18,
                top: my - 18,
                width: 36,
                height: 36,
                borderRadius: 18,
                background: far ? accent.hex : '#ffffff',
                boxShadow: `0 0 ${far ? 50 : 30}px ${far ? accent.hex : '#ffffff'}`,
                opacity,
              }}
            />
            <div
              style={{
                position: 'absolute',
                // Near markers sit just below the start dot; keep their labels clear of it.
                top: Math.max(TOP + 34, my - 40),
                left: X + 56,
                maxWidth: 1080 - X - 56 - 50,
                fontFamily: theme.font,
                fontSize: 46,
                fontWeight: 700,
                color: far ? accent.hex : theme.text,
                lineHeight: 1.12,
                padding: '10px 22px',
                borderRadius: 16,
                background: 'rgba(8,12,30,0.62)',
                border: `2px solid ${far ? accent.hex : 'rgba(255,255,255,0.35)'}`,
                opacity,
                transform: `translateX(${(1 - opacity) * 20}px)`,
              }}
            >
              {m.label}
            </div>
          </React.Fragment>
        );
      })}
      <div
        style={{
          position: 'absolute',
          top: BOTTOM + 70,
          left: 60,
          right: 60,
          textAlign: 'center',
          fontFamily: theme.font,
          fontSize: 50,
          fontWeight: 700,
          color: theme.text,
          opacity: ease(Math.min(1, Math.max(0, (t - 2.6) / 0.6))),
        }}
      >
        {params.totalLabel}
      </div>
    </AbsoluteFill>
  );
};
