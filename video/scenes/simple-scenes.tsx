import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import type { FactCardParams, ImageParams, OutroParams } from '../../src/core/schemas';
import { Credit, Starfield } from '../components/overlays';
import markPng from '../brand/mark.png';
import { useAccent } from '../accent';
import { useSceneTime } from '../scene-context';
import { ease } from '../sky/projection';
import { theme } from '../theme';
import { SkyView } from './SkyViewScene';

/** One big number with its meaning. The number must be backed by a fact (enforced by cc factcheck). */
/**
 * Splits a value like "26,000 ly" into the number it starts with and the text after it, so the number
 * can count up on screen. Values without a leading number are shown as they are.
 */
function countUp(value: string, t: number): string {
  const m = value.match(/^(\d[\d,]*(?:\.\d+)?)(.*)$/);
  if (!m) return value;
  const target = Number(m[1].replace(/,/g, ''));
  const decimals = (m[1].split('.')[1] ?? '').length;
  const shown = target * ease(Math.min(1, t / 0.9));
  const body = shown.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return body + m[2];
}

export const FactCardScene: React.FC<{ sceneId: string; params: FactCardParams }> = ({ sceneId, params }) => {
  const accent = useAccent();
  const { t, durationSec } = useSceneTime();
  const k = ease(Math.min(1, t / 0.6));
  // A slow push-in over the whole card, so it keeps moving after the figure has landed.
  const push = 1 + 0.03 * Math.min(1, t / Math.max(1, durationSec));
  // Shrink long values ("101,000,000 km") so they stay inside the 960 px column.
  const shown = countUp(params.value, t);
  const size = Math.min(220, Math.floor(980 / (Math.max(4, params.value.length) * 0.6)));
  // An orbit ring around the figure: a fixed, slightly tilted ellipse that draws in with the card,
  // and a small body travelling along it, so the card keeps moving after the figure has landed.
  // (A ring that rotated as a whole swung through the text and read as a stray line.)
  const rx = 470;
  const ry = 120;
  const cy = 560 + size * 0.55;
  const a = t * 0.8 + 0.6;
  const dot = (
    <circle
      cx={540 + rx * Math.cos(a)}
      cy={cy + ry * Math.sin(a)}
      r={10}
      fill={accent.hex}
      opacity={k}
      style={{ filter: `drop-shadow(0 0 10px ${accent.hex})` }}
    />
  );
  const ringSvg = (withDot: boolean) => (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <g transform={`rotate(-8 540 ${cy})`}>
        {!withDot && (
          <ellipse
            cx={540}
            cy={cy}
            rx={rx}
            ry={ry}
            fill="none"
            stroke={accent.hex}
            strokeWidth={2.5}
            strokeDasharray={`${2 * Math.PI * rx * k} ${2 * Math.PI * rx}`}
            opacity={0.35 * k}
          />
        )}
        {withDot && dot}
      </g>
    </svg>
  );
  return (
    <AbsoluteFill>
      <Starfield seed={sceneId} drift={0.02} />
      {ringSvg(false)}
      {ringSvg(true)}
      <div
        style={{
          position: 'absolute',
          top: 560,
          left: 60,
          right: 60,
          textAlign: 'center',
          fontFamily: theme.font,
          opacity: k,
          transform: `scale(${(0.9 + 0.1 * k) * push})`,
        }}
      >
        <div
          style={{
            fontSize: size,
            fontWeight: 700,
            color: accent.hex,
            letterSpacing: size > 150 ? -6 : -2,
            lineHeight: 1.05,
            whiteSpace: 'nowrap',
            textShadow: `0 0 60px ${accent.hex}66`,
          }}
        >
          {shown}
        </div>
        <div style={{ fontSize: 58, fontWeight: 600, color: theme.text, marginTop: 24, lineHeight: 1.15 }}>
          {params.label}
        </div>
        {params.sourceLine && (
          <div style={{ fontSize: 30, color: theme.muted, marginTop: 30 }}>{params.sourceLine}</div>
        )}
      </div>
    </AbsoluteFill>
  );
};

export const ImageScene: React.FC<{ params: ImageParams }> = ({ params }) => {
  const accent = useAccent();
  const { t, at, durationSec, props } = useSceneTime();
  const asset = props.assets[params.assetId];
  if (!asset) throw new Error(`Asset ${params.assetId} missing`);
  const k = ease(Math.min(1, t / Math.max(1, durationSec)));
  // Landscape sources lose most of their frame when cropped to 9:16, so "contain" shows them whole
  // as a band between the badge and the captions.
  const band = params.fit === 'contain';
  // A zoom above 1 would push the contained image past the band and crop exactly the edges that
  // "contain" exists to preserve (the radar's inset label and its credit were cut in QA), so the
  // band settles from 0.985 to 1 instead of pushing in.
  const scale = band ? 0.985 + 0.015 * k : params.zoom[0] + (params.zoom[1] - params.zoom[0]) * k;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {band ? (
        <div style={{ position: 'absolute', top: 470, left: 0, right: 0, height: 700 }}>
          <Img
            src={staticFile(asset.file)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              transform: `scale(${scale})`,
              transformOrigin: 'center',
            }}
          />
        </div>
      ) : (
        <Img
          src={staticFile(asset.file)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: `${params.focus[0] * 100}% ${params.focus[1] * 100}%`,
            transform: `scale(${scale})`,
            transformOrigin: `${params.focus[0] * 100}% ${params.focus[1] * 100}%`,
          }}
        />
      )}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.6) 100%)',
        }}
      />
      {params.marker && !band && (
        <Marker
          x={params.focus[0] * 1080}
          y={params.focus[1] * 1920}
          label={params.marker.label}
          o={ease(Math.min(1, Math.max(0, (t - at(params.marker.from)) / 0.6)))}
          t={t}
          color={accent.hex}
        />
      )}
      <Credit text={asset.credit} />
    </AbsoluteFill>
  );
};

/** A pulsing ring on one point of a photo, with a label beside it. */
const Marker: React.FC<{ x: number; y: number; label: string; o: number; t: number; color: string }> = ({
  x,
  y,
  label,
  o,
  t,
  color,
}) => {
  const r = 70 - 24 * o + 4 * Math.sin(t * 4);
  const left = x < 620;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: x - r,
          top: y - r,
          width: 2 * r,
          height: 2 * r,
          borderRadius: '50%',
          border: `4px solid ${color}`,
          boxShadow: `0 0 24px ${color}, inset 0 0 18px ${color}55`,
          opacity: o,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: y - 30,
          ...(left ? { left: x + 70 } : { right: 1080 - x + 70 }),
          fontFamily: theme.font,
          fontSize: 48,
          fontWeight: 700,
          color,
          whiteSpace: 'nowrap',
          textShadow: '0 2px 14px #000, 0 0 30px #000',
          opacity: o,
          transform: `translateX(${(left ? 1 : -1) * (1 - o) * 20}px)`,
        }}
      >
        {left ? '← ' : ''}
        {label}
        {left ? '' : ' →'}
      </div>
    </>
  );
};

export const OutroScene: React.FC<{ sceneId: string; params: OutroParams }> = ({ sceneId, params }) => {
  const accent = useAccent();
  const { win, props, t, timeline } = useSceneTime();
  const sky = props.sky[sceneId];
  const mark = ease(Math.min(1, t / 0.9));
  const o = win(0.5);
  // The call to action appears as it is spoken ("Follow…"), not at a fixed time.
  const follow = timeline.sentences.find((s) => /^follow\b/i.test(s.text.trim()));
  const cta = win(follow ? Math.max(0.6, follow.start - 0.1) : 1.1);
  return (
    <AbsoluteFill>
      {sky && params.sky ? (
        <SkyView sky={sky} params={{ camera: params.sky.camera, twilight: 0.3, constellationLines: 0.12 }} />
      ) : (
        <Starfield seed={sceneId} drift={0.03} />
      )}
      {/* The outro's sky is decorative, so a bright body can land right behind the call to action
          (a full Moon sat under "FOLLOW" in QA and the white text washed out). A soft vignette
          behind the text keeps the contrast without hiding the sky. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 860px 700px at 50% 720px, rgba(6,10,24,0.78) 0%, rgba(6,10,24,0.55) 50%, rgba(6,10,24,0) 78%)',
        }}
      />
      {/* Brand lockup: the channel mark settles in, then the name, then the call to action. */}
      <div
        style={{
          position: 'absolute',
          top: 300,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          fontFamily: theme.font,
          color: theme.text,
          textShadow: '0 4px 30px #000',
        }}
      >
        <Img
          src={markPng}
          style={{
            width: 380,
            height: 380,
            opacity: mark,
            transform: `scale(${0.8 + 0.2 * mark + 0.03 * Math.sin(t * 1.4)})`,
          }}
        />
        <div
          style={{
            marginTop: -40,
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: 14,
            opacity: o,
          }}
        >
          PHOTON SPHERE
        </div>
        <div style={{ fontSize: 30, fontWeight: 500, color: theme.muted, marginTop: 6, opacity: o }}>
          @thephotonsphere
        </div>
        <div
          style={{
            marginTop: 44,
            fontSize: 40,
            letterSpacing: 8,
            color: accent.hex,
            fontWeight: 600,
            opacity: cta,
          }}
        >
          {params.kicker.toUpperCase()}
        </div>
        <div
          style={{
            fontSize: 80,
            fontWeight: 700,
            lineHeight: 1.05,
            marginTop: 12,
            padding: '0 60px',
            textAlign: 'center',
            whiteSpace: 'pre-line',
            opacity: cta,
            transform: `translateY(${(1 - cta) * 24}px)`,
          }}
        >
          {params.cta.toUpperCase()}
        </div>
      </div>
      {params.footnote && (
        <div
          style={{
            position: 'absolute',
            top: 1110,
            left: 40,
            right: 40,
            textAlign: 'center',
            fontFamily: theme.font,
            fontSize: 30,
            color: theme.muted,
            opacity: win(0.3),
          }}
        >
          {params.footnote}
        </div>
      )}
    </AbsoluteFill>
  );
};
