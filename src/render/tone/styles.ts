/** Music bed styles and the recorded instruments each one loads. Shared by Node and the browser bundle. */
export const TONE_STYLES = [
  'acoustic',
  'strings',
  'flute',
  'pulse',
  'lofi',
  'nocturne',
  'nebula-tone',
  'orbit-tone',
  'meteor-tone',
] as const;
export type ToneStyle = (typeof TONE_STYLES)[number];
export const isToneStyle = (s: string): s is ToneStyle => (TONE_STYLES as readonly string[]).includes(s);

export const STYLE_INSTRUMENTS: Record<ToneStyle, string[]> = {
  acoustic: ['guitar-acoustic', 'harp', 'violin'],
  strings: ['violin', 'piano', 'contrabass', 'harp'],
  flute: ['flute', 'guitar-acoustic', 'harp', 'contrabass'],
  pulse: ['piano', 'harp', 'contrabass', 'violin'],
  lofi: ['piano', 'guitar-electric', 'bass-electric'],
  nocturne: ['piano', 'harp', 'violin', 'contrabass'],
  // Tone.js ports of the original arranged beds (../score.ts) on the Kawai upright (assets/audio/piano).
  'nebula-tone': ['piano-kw'],
  'orbit-tone': ['piano-kw'],
  'meteor-tone': ['piano-kw'],
};

/** Served from assets/audio/piano (FreePats Upright Piano KW, CC0), not the tonejs-instruments manifest. */
export const KAWAI = 'piano-kw';
