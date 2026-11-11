import { loadFont } from '@remotion/google-fonts/SpaceGrotesk';

loadFont('normal', { weights: ['500', '600', '700'], subsets: ['latin'] });

/** Visual identity. Change here, not in templates. */
export const theme = {
  font: '"Space Grotesk"',
  accent: '#ffd666',
  accentRgb: '255,214,102',
  text: '#ffffff',
  muted: 'rgba(200,210,235,0.85)',
  bg: '#01030a',
  chipText: '#0b1020',
  /** Vertical safe zone: platform UI covers roughly the top 160 px and bottom 420 px. */
  safeTop: 170,
  captionTop: 1290,
} as const;
