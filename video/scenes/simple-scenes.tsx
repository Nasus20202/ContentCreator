import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import type { FactCardParams, ImageParams, OutroParams } from '../../src/core/schemas';
import { Credit, Starfield } from '../components/overlays';
import { useAccent } from '../accent';
import { useSceneTime } from '../scene-context';
import { ease } from '../sky/projection';
import { theme } from '../theme';
import { SkyView } from './SkyViewScene';

/** One big number with its meaning. The number must be backed by a fact (enforced by cc factcheck). */
export const FactCardScene: React.FC<{ sceneId: string; params: FactCardParams }> = ({ sceneId, params }) => {
  const accent = useAccent();
  const { t, durationSec } = useSceneTime();
  const k = ease(Math.min(1, t / 0.6));
  // A slow push-in over the whole card, so it keeps moving after the figure has landed.
  const push = 1 + 0.03 * Math.min(1, t / Math.max(1, durationSec));
  // Shrink long values ("101,000,000 km") so they stay inside the 960 px column.
  const size = Math.min(220, Math.floor(980 / (Math.max(4, params.value.length) * 0.6)));
  return (
    <AbsoluteFill>
      <Starfield seed={sceneId} drift={0.02} />
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
          }}
        >
          {params.value}
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

/** Real imagery with a slow push-in and the mandatory credit line. */
export const ImageScene: React.FC<{ params: ImageParams }> = ({ params }) => {
  const { t, durationSec, props } = useSceneTime();
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
      <Credit text={asset.credit} />
    </AbsoluteFill>
  );
};

export const OutroScene: React.FC<{ sceneId: string; params: OutroParams }> = ({ sceneId, params }) => {
  const accent = useAccent();
  const { win, props } = useSceneTime();
  const sky = props.sky[sceneId];
  const o = win(0.8);
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
            'radial-gradient(ellipse 820px 470px at 50% 810px, rgba(6,10,24,0.74) 0%, rgba(6,10,24,0.52) 48%, rgba(6,10,24,0) 76%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 640,
          left: 60,
          right: 60,
          textAlign: 'center',
          fontFamily: theme.font,
          color: theme.text,
          opacity: o,
          textShadow: '0 4px 30px #000',
        }}
      >
        <div style={{ fontSize: 44, letterSpacing: 8, color: accent.hex, fontWeight: 600 }}>
          {params.kicker.toUpperCase()}
        </div>
        <div style={{ fontSize: 96, fontWeight: 700, lineHeight: 1.05, marginTop: 14, whiteSpace: 'pre-line' }}>
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
