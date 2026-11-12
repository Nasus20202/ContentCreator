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
const FIRST_Y = 600;
const STEP = 250;
/** Three bars sit closer together so the note stays clear of the caption band (1290). */
const STEP_3 = 215;
const BAR_H = 72;

/**
 * Horizontal bars, all in one unit, each on a full-width track so its length reads as a share of the
 * longest. Linear bars are drawn to scale; a bar too short to see becomes a glowing sliver rather than
 * disappearing, which is the point when one value dwarfs the other. Log bars use log10 of the value;
 * the scene says which one it is.
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
  const head = ease(Math.min(1, t / 0.6));
  const step = params.bars.length > 2 ? STEP_3 : STEP;
  return (
    <AbsoluteFill>
      <Starfield seed="compare" drift={0.02} />
      {params.heading && (
        <div
          style={{
            position: 'absolute',
            top: 400,
            left: 60,
            right: 60,
            textAlign: 'center',
            fontFamily: theme.font,
            fontSize: 62,
            fontWeight: 700,
            color: theme.text,
            opacity: head,
            transform: `translateY(${(1 - head) * 16}px)`,
            textShadow: '0 4px 24px #000',
          }}
        >
          {params.heading}
        </div>
      )}
      {params.bars.map((b, i) => {
        const y = FIRST_Y + i * step;
        const start = 0.5 + i * 0.7;
        const appear = ease(Math.min(1, Math.max(0, (t - start) / 0.5)));
        const grow = ease(Math.min(1, Math.max(0, (t - start) / 1.6)));
        const w = MAX_W * frac(b.value) * grow;
        const sliver = MAX_W * frac(b.value) < 14;
        const color = i === 0 ? '#ffffff' : accent.hex;
        const pulse = sliver ? 0.6 + 0.4 * Math.sin(t * 5) : 1;
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: 'absolute',
                left: LEFT,
                width: MAX_W,
                top: y - 84,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                fontFamily: theme.font,
                opacity: appear,
              }}
            >
              <div style={{ fontSize: 40, fontWeight: 600, color: theme.muted, maxWidth: 520, lineHeight: 1.1 }}>
                {b.label}
              </div>
              <div
                style={{
                  fontSize: 64,
                  fontWeight: 700,
                  color,
                  whiteSpace: 'nowrap',
                  opacity: ease(Math.min(1, Math.max(0, (grow - 0.5) / 0.4))),
                  textShadow: `0 0 24px ${color}66`,
                }}
              >
                {b.display}
              </div>
            </div>
            <div
              style={{
                position: 'absolute',
                left: LEFT,
                top: y,
                width: MAX_W,
                height: BAR_H,
                borderRadius: BAR_H / 2,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
                opacity: appear,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: LEFT,
                top: y,
                width: Math.max(sliver ? 12 : BAR_H * 0.5, w),
                height: BAR_H,
                borderRadius: BAR_H / 2,
                background: `linear-gradient(90deg, ${color}aa, ${color})`,
                boxShadow: `0 0 ${sliver ? 34 : 26}px ${color}`,
                opacity: appear * pulse,
              }}
            />
          </React.Fragment>
        );
      })}
      {params.note && (
        <div
          style={{
            position: 'absolute',
            top: FIRST_Y + (params.bars.length - 1) * step + BAR_H + 34,
            left: 60,
            right: 60,
            textAlign: 'center',
            fontFamily: theme.font,
            fontSize: 34,
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
