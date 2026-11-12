import React from 'react';
import { AbsoluteFill } from 'remotion';
import type { CompareParams } from '../../src/core/schemas';
import { useAccent } from '../accent';
import { Starfield } from '../components/overlays';
import { useSceneTime } from '../scene-context';
import { ease } from '../sky/projection';
import { theme } from '../theme';

const LEFT = 90;
const MAX_W = 900;
const FIRST_Y = 640;
const STEP = 300;

/**
 * Horizontal bars, all in one unit. Linear bars are drawn to scale; log bars use log10 of the value,
 * so a bar ten times longer than another is ten times the value. The scene says which one it is.
 */
export const CompareScene: React.FC<{ params: CompareParams }> = ({ params }) => {
  const accent = useAccent();
  const { t } = useSceneTime();
  const log = params.scale === 'log';
  const max = Math.max(...params.bars.map((b) => b.value));
  const frac = (v: number) => {
    if (!log) return v / max;
    return max > 1 ? Math.log10(v) / Math.log10(max) : 1;
  };
  return (
    <AbsoluteFill>
      <Starfield seed="compare" drift={0.02} />
      {params.heading && (
        <div
          style={{
            position: 'absolute',
            top: 380,
            left: 60,
            right: 60,
            textAlign: 'center',
            fontFamily: theme.font,
            fontSize: 60,
            fontWeight: 700,
            color: theme.text,
            opacity: ease(Math.min(1, t / 0.6)),
          }}
        >
          {params.heading}
        </div>
      )}
      {params.bars.map((b, i) => {
        const y = FIRST_Y + i * STEP;
        const grow = ease(Math.min(1, Math.max(0, (t - 0.5 - i * 0.6) / 1.5)));
        const w = MAX_W * frac(b.value) * grow;
        const color = i === 0 ? theme.text : accent.hex;
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: 'absolute',
                left: LEFT,
                top: y - 150,
                fontFamily: theme.font,
                fontSize: 46,
                fontWeight: 600,
                color: theme.muted,
                opacity: ease(Math.min(1, Math.max(0, (t - 0.5 - i * 0.6) / 0.5))),
              }}
            >
              {b.label}
            </div>
            <div
              style={{
                position: 'absolute',
                left: LEFT,
                top: y,
                width: Math.max(8, w),
                height: 96,
                borderRadius: 10,
                background: color,
                boxShadow: `0 0 26px ${color}`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: LEFT,
                top: y - 100,
                fontFamily: theme.font,
                fontSize: 62,
                fontWeight: 700,
                color,
                whiteSpace: 'nowrap',
                opacity: grow > 0.98 ? 1 : 0,
              }}
            >
              {b.display}
            </div>
          </React.Fragment>
        );
      })}
      {params.note && (
        <div
          style={{
            position: 'absolute',
            top: FIRST_Y + params.bars.length * STEP + 20,
            left: 60,
            right: 60,
            textAlign: 'center',
            fontFamily: theme.font,
            fontSize: 36,
            color: theme.muted,
            opacity: ease(Math.min(1, Math.max(0, (t - 2.5) / 0.6))),
          }}
        >
          {params.note}
        </div>
      )}
    </AbsoluteFill>
  );
};
