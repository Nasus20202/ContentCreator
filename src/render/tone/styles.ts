/** Music bed styles and the recorded instruments each one loads. Shared by Node and the browser bundle. */
export const TONE_STYLES = ['acoustic', 'strings', 'flute', 'pulse', 'drive', 'lofi', 'nocturne'] as const;
export type ToneStyle = (typeof TONE_STYLES)[number];
export const isToneStyle = (s: string): s is ToneStyle => (TONE_STYLES as readonly string[]).includes(s);

export const STYLE_INSTRUMENTS: Record<ToneStyle, string[]> = {
  acoustic: ['guitar-acoustic', 'harp', 'violin'],
  strings: ['violin', 'piano', 'contrabass', 'harp'],
  flute: ['flute', 'guitar-acoustic', 'harp', 'contrabass'],
  pulse: ['piano', 'harp', 'contrabass', 'violin'],
  drive: ['guitar-electric', 'bass-electric', 'violin', 'piano'],
  lofi: ['piano', 'guitar-electric', 'bass-electric'],
  nocturne: ['piano', 'harp', 'violin', 'contrabass'],
};

/**
 * Names used by older plans (the retired score engine). They still validate and now play the
 * closest current style, so committed records stay valid. (`piano*` are the original piano beds again,
 * see `../piano-loop.ts`, and `orbit`/`nebula`/`meteor` the arranged piano beds in `../score.ts`.)
 */
export const LEGACY_STYLES = {
  telemetry: 'drive',
  lab: 'pulse',
} as const satisfies Record<string, ToneStyle>;
export type LegacyStyle = keyof typeof LEGACY_STYLES;
