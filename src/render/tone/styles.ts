/** Music bed styles and the recorded instruments each one loads. Shared by Node and the browser bundle. */
export const TONE_STYLES = ['acoustic', 'pulse', 'drive', 'lofi', 'nocturne'] as const;
export type ToneStyle = (typeof TONE_STYLES)[number];
export const isToneStyle = (s: string): s is ToneStyle => (TONE_STYLES as readonly string[]).includes(s);

export const STYLE_INSTRUMENTS: Record<ToneStyle, string[]> = {
  acoustic: ['guitar-acoustic', 'harp', 'violin'],
  pulse: [],
  drive: ['guitar-electric', 'bass-electric', 'violin', 'piano'],
  lofi: ['piano', 'guitar-electric', 'bass-electric'],
  nocturne: ['piano', 'harp', 'violin', 'contrabass'],
};

/**
 * Names used by older plans (the retired piano/score engine). They still validate and now play the
 * closest Tone style, so committed records stay valid.
 */
export const LEGACY_STYLES = {
  piano: 'nocturne',
  'piano-pulse': 'nocturne',
  'piano-air': 'nocturne',
  orbit: 'nocturne',
  nebula: 'acoustic',
  meteor: 'pulse',
  telemetry: 'drive',
  lab: 'pulse',
} as const satisfies Record<string, ToneStyle>;
export type LegacyStyle = keyof typeof LEGACY_STYLES;
