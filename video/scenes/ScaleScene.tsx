import React from 'react';
import { AbsoluteFill } from 'remotion';
import type { ScaleParams } from '../../src/core/schemas';
import { useAccent } from '../accent';
import { useSceneTime } from '../scene-context';
import { ease } from '../sky/projection';
import { Starfield } from '../components/overlays';
import { theme } from '../theme';

const TOP = 300;
const BOTTOM = 980;
const X = 540;

/**
 * A distance drawn to scale: the bar grows from the start (top) to the far end (bottom), and each
 * marker is placed at its distance along it. Nothing is exaggerated, so a near point stays at the top.
 */
export const ScaleScene: React.FC<{ params: ScaleParams }> = ({ params }) => {
  const accent = useAccent();
  const { t } = useSceneTime();
  const grow = ease(Math.min(1, t / 3));
  const y = (at: number) => TOP + (BOTTOM - TOP) * Math.min(1, at / params.total);
  return (
    <AbsoluteFill>
      <Starfield seed="scale" drift={0.02} />
      <div
        style={{
          position: 'absolute',
          left: X - 4,
          top: TOP,
          width: 8,
          height: (BOTTOM - TOP) * grow,
          background: accent.hex,
          borderRadius: 4,
          boxShadow: `0 0 24px ${accent.hex}`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: X - 12,
          top: TOP - 12,
          width: 24,
          height: 24,
          borderRadius: 12,
          background: theme.text,
        }}
      />
      {params.markers.map((m, i) => {
        const my = y(m.at);
        const opacity = ease(Math.min(1, Math.max(0, (t - 0.8 - i * 0.9) / 0.6)));
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: 'absolute',
                left: X - 14,
                top: my - 14,
                width: 28,
                height: 28,
                borderRadius: 14,
                background: '#ffffff',
                boxShadow: '0 0 30px #ffffff',
                opacity,
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: my - 26,
                left: X + 40,
                fontFamily: theme.font,
                fontSize: 44,
                fontWeight: 700,
                color: theme.text,
                lineHeight: 1.15,
                maxWidth: 440,
                opacity,
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
          top: BOTTOM + 120,
          left: 60,
          right: 60,
          textAlign: 'center',
          fontFamily: theme.font,
          fontSize: 56,
          fontWeight: 700,
          color: accent.hex,
          opacity: ease(Math.min(1, Math.max(0, (t - 2.8) / 0.6))),
        }}
      >
        {params.totalLabel}
      </div>
    </AbsoluteFill>
  );
};
