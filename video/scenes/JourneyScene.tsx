import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { formatClock } from '../../src/core/clock';
import type { JourneyParams } from '../../src/core/schemas';
import { useAccent } from '../accent';
import markPng from '../brand/mark.png';
import { Starfield } from '../components/overlays';
import { useSceneTime } from '../scene-context';
import { ease } from '../sky/projection';
import { theme } from '../theme';

const TOP = 545;
const BOTTOM = 1080;
/** Track position; it moves right when a label has to sit on its left (see `crowded`). */
const X_RIGHT_LABELS = 330;
const X_LEFT_LABELS = 420;
/** Bodies are drawn a little larger than their base size so they read on a phone. */
const SCALE = 1.2;

type Kind = JourneyParams['stops'][number]['kind'];

/** Diagram bodies: recognisable, not photographs (sizes are not to scale; distances are). */
const BODY: Record<Kind, { r: number; fill: string; glow: string; label: string }> = {
  sun: {
    r: 70,
    fill: 'radial-gradient(circle at 45% 40%, #fffbe8 0%, #ffd45a 45%, #ff8a1e 100%)',
    glow: '#ffb340',
    label: '#ffd666',
  },
  earth: {
    r: 28,
    fill: 'radial-gradient(circle at 35% 35%, #bfe6ff 0%, #2f7fd8 45%, #0b2e6b 100%)',
    glow: '#4aa3ff',
    label: '#8cc8ff',
  },
  mars: {
    r: 22,
    fill: 'radial-gradient(circle at 35% 35%, #ffc29a 0%, #d9622b 55%, #6e2410 100%)',
    glow: '#ff7a3d',
    label: '#ff9a66',
  },
  jupiter: {
    r: 46,
    fill: 'repeating-linear-gradient(170deg, #f2dcb5 0px, #f2dcb5 9px, #c9925e 9px, #c9925e 15px, #e9c99a 15px, #e9c99a 24px)',
    glow: '#e8b97a',
    label: '#f2d3a4',
  },
  star: {
    r: 30,
    fill: 'radial-gradient(circle at 40% 40%, #ffe1d0 0%, #ff6a4a 55%, #8f1f12 100%)',
    glow: '#ff5a3a',
    label: '#ff9077',
  },
  blackhole: { r: 70, fill: 'none', glow: '#ff9a3c', label: '#ffc27a' },
  galaxy: {
    r: 60,
    fill: 'radial-gradient(ellipse at 50% 50%, #fff6e6 0%, #c9b8ff 22%, rgba(110,120,230,0.55) 50%, rgba(40,40,120,0) 75%)',
    glow: '#9aa6ff',
    label: '#b9c2ff',
  },
  point: { r: 12, fill: '#ffffff', glow: '#ffffff', label: '#ffffff' },
};

const Body: React.FC<{ kind: Kind; x: number; y: number; scale: number }> = ({ kind, x, y, scale }) => {
  const b = BODY[kind];
  const r = b.r * scale;
  if (kind === 'blackhole') {
    const s = r * 3.6;
    return <Img src={markPng} style={{ position: 'absolute', left: x - s / 2, top: y - s / 2, width: s, height: s }} />;
  }
  return (
    <div
      style={{
        position: 'absolute',
        left: x - r,
        top: y - (kind === 'galaxy' ? r * 0.45 : r),
        width: 2 * r,
        height: kind === 'galaxy' ? r * 0.9 : 2 * r,
        borderRadius: '50%',
        background: b.fill,
        boxShadow: `0 0 ${r * 0.9}px ${b.glow}`,
        transform: kind === 'galaxy' ? 'rotate(-28deg)' : undefined,
      }}
    />
  );
};

/** Position along the path at progress p (0..1), at constant speed or, for a ship, braking into each stop. */
function along(ys: number[], ship: boolean, p: number): { y: number; leg: number; arrived: number } {
  const lens = ys.slice(1).map((y, i) => Math.abs(y - ys[i]));
  const total = lens.reduce((a, b) => a + b, 0) || 1;
  let d = p * total;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const f = lens[i] > 0 ? Math.min(1, d / lens[i]) : 1;
      const k = ship ? ease(f) : f;
      return { y: ys[i] + (ys[i + 1] - ys[i]) * k, leg: i, arrived: f >= 1 ? i + 1 : i };
    }
    d -= lens[i];
  }
  return { y: ys[ys.length - 1], leg: lens.length - 1, arrived: lens.length };
}

export const JourneyScene: React.FC<{ params: JourneyParams }> = ({ params }) => {
  const accent = useAccent();
  const { t, at, props } = useSceneTime();
  const backdrop = params.backdrop ? props.assets[params.backdrop.assetId] : undefined;
  const max = Math.max(...params.stops.map((s) => s.at)) || 1;
  const yOf = (v: number) => TOP + (BOTTOM - TOP) * (v / max);
  // At true scale two stops can sit close together (the Sun and Earth are 1 AU of 5.2): the upper
  // one puts its label on the left of the track so the two do not stack.
  const isCrowded = (v: number) => params.stops.some((o2) => o2.at > v && yOf(o2.at) - yOf(v) < 190);
  const X = params.stops.some((s) => isCrowded(s.at)) ? X_LEFT_LABELS : X_RIGHT_LABELS;
  const ys = params.path.map((k) => yOf(params.stops[k].at));
  const t0 = at(params.start);
  const p = Math.min(1, Math.max(0, (t - t0) / params.travel));
  const pos = along(ys, params.traveller === 'ship', p);
  const appear = ease(Math.min(1, t / 0.6));
  const ship = params.traveller === 'ship';
  const travelColor = ship ? accent.hex : '#fff3c4';
  // Stops already reached on this path (the start counts), so their arrival labels can show.
  const reached = new Set(params.path.slice(0, p > 0 ? pos.arrived + 1 : 1));
  const dir = ys[pos.leg + 1] >= ys[pos.leg] ? 1 : -1;
  const trailLen = ship ? 90 : 260;
  // The destination photo comes closer as the traveller does, and brightens on arrival.
  const near = ease(p);
  const landed = ease(Math.min(1, Math.max(0, (t - t0 - params.travel) / 0.8)));

  return (
    <AbsoluteFill>
      <Starfield seed="journey" drift={0.015} />
      {backdrop && (
        <>
          <Img
            src={staticFile(backdrop.file)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: appear * (0.2 + 0.28 * near + 0.12 * landed),
              transform: `scale(${1.04 + 0.22 * near + 0.04 * landed})`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, rgba(1,3,10,0.75) 0%, rgba(1,3,10,0.25) 30%, rgba(1,3,10,0.25) 60%, rgba(1,3,10,0.8) 100%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 1214,
              left: 44,
              right: 44,
              textAlign: 'center',
              fontFamily: theme.font,
              textShadow: '0 2px 10px #000',
              opacity: appear,
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 600, color: theme.text, lineHeight: 1.15 }}>
              {params.backdrop!.label}
            </div>
            <div style={{ fontSize: 18, color: 'rgba(232,238,250,0.75)', lineHeight: 1.2 }}>{backdrop.credit}</div>
          </div>
        </>
      )}
      {/* The track, with ruler ticks every tenth of the way. */}
      <div
        style={{
          position: 'absolute',
          left: X - 2,
          top: TOP,
          width: 4,
          height: (BOTTOM - TOP) * appear,
          background: 'rgba(200,215,255,0.28)',
          borderRadius: 2,
        }}
      />
      {Array.from({ length: 11 }, (_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: X - (i % 5 === 0 ? 18 : 11),
            top: TOP + ((BOTTOM - TOP) * i) / 10 - 1,
            width: i % 5 === 0 ? 36 : 22,
            height: 2,
            background: 'rgba(200,215,255,0.3)',
            opacity: appear,
          }}
        />
      ))}
      {params.stops.map((s, i) => {
        const y = yOf(s.at);
        const o = ease(Math.min(1, Math.max(0, (t - 0.15 * i) / 0.5)));
        const arrived = reached.has(i) && s.arrive;
        const b = BODY[s.kind];
        const crowded = isCrowded(s.at);
        const gap = Math.max(64, b.r * SCALE * (s.kind === 'blackhole' ? 1.4 : 1) + 34);
        return (
          <React.Fragment key={i}>
            <div style={{ opacity: o }}>
              <Body kind={s.kind} x={X} y={y} scale={SCALE} />
            </div>
            <div
              style={{
                position: 'absolute',
                ...(crowded ? { right: 1080 - X + gap, textAlign: 'right' as const } : { left: X + gap }),
                top: y - 40,
                fontFamily: theme.font,
                opacity: o,
                textShadow: '0 2px 14px #000',
              }}
            >
              <div style={{ fontSize: 56, fontWeight: 700, color: b.label, lineHeight: 1.05 }}>{s.name}</div>
              {s.sub && <div style={{ fontSize: 34, fontWeight: 500, color: theme.muted }}>{s.sub}</div>}
              {s.arrive && (
                <div
                  style={{
                    marginTop: 8,
                    display: 'inline-block',
                    fontSize: 38,
                    fontWeight: 700,
                    color: theme.chipText,
                    background: accent.hex,
                    padding: '4px 16px',
                    borderRadius: 10,
                    opacity: arrived ? 1 : 0,
                    transform: `scale(${arrived ? 1 : 0.8})`,
                  }}
                >
                  {s.arrive}
                </div>
              )}
            </div>
          </React.Fragment>
        );
      })}
      {/* The traveller, with a trail behind it. */}
      {t >= t0 && (
        <>
          <div
            style={{
              position: 'absolute',
              left: X - 3,
              top: dir > 0 ? pos.y - trailLen : pos.y,
              width: 6,
              height: trailLen,
              borderRadius: 3,
              background:
                dir > 0
                  ? `linear-gradient(180deg, rgba(0,0,0,0), ${travelColor})`
                  : `linear-gradient(0deg, rgba(0,0,0,0), ${travelColor})`,
              opacity: p < 1 ? 0.9 : Math.max(0, 1 - (t - t0 - params.travel) / 0.5),
            }}
          />
          {ship ? (
            <div
              style={{
                position: 'absolute',
                left: X - 28,
                top: pos.y - 34,
                width: 0,
                height: 0,
                borderLeft: '28px solid transparent',
                borderRight: '28px solid transparent',
                [dir > 0 ? 'borderTop' : 'borderBottom']: `68px solid ${accent.hex}`,
                filter: `drop-shadow(0 0 16px ${accent.hex})`,
              }}
            />
          ) : (
            <div
              style={{
                position: 'absolute',
                left: X - 16,
                top: pos.y - 16,
                width: 32,
                height: 32,
                borderRadius: 16,
                background: '#fffdf0',
                boxShadow: `0 0 24px #fff, 0 0 60px ${travelColor}, 0 0 110px ${travelColor}`,
              }}
            />
          )}
        </>
      )}
      {/* Clocks. */}
      {params.clocks.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 290,
            left: 50,
            right: 50,
            display: 'flex',
            justifyContent: 'center',
            gap: 28,
            fontFamily: theme.font,
            opacity: appear,
          }}
        >
          {params.clocks.map((c, i) => {
            const v = c.from + (c.to - c.from) * p;
            return (
              <div
                key={i}
                style={{
                  flex: params.clocks.length > 1 ? 1 : undefined,
                  minWidth: 420,
                  textAlign: 'center',
                  padding: '14px 18px 18px',
                  borderRadius: 22,
                  background: 'rgba(8,12,30,0.66)',
                  border: `2px solid ${i === 0 ? `rgba(${accent.rgb},0.7)` : 'rgba(255,255,255,0.3)'}`,
                  boxShadow: '0 8px 30px rgba(0,0,0,0.45)',
                }}
              >
                <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: 4, color: theme.muted }}>
                  {'⏱ ' + c.label.toUpperCase()}
                </div>
                <div
                  style={{
                    fontSize: params.clocks.length > 1 ? 58 : 80,
                    fontWeight: 700,
                    color: i === 0 ? accent.hex : theme.text,
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatClock(v, c.unit, c.decimals)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AbsoluteFill>
  );
};
