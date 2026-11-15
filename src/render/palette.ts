/** Per-series accent colours. Kept out of video/ so the CLI can resolve them without loading fonts. */
export const SERIES_ACCENT: Record<string, { hex: string; rgb: string }> = {
  // The weekly guide keeps the channel amber.
  'sky-this-week': { hex: '#ffd666', rgb: '255,214,102' },
  // "Go outside now": warmer, hotter.
  'sky-tonight': { hex: '#ff8a5c', rgb: '255,138,92' },
  // Explainers read as diagrams: cool, technical.
  'sky-school': { hex: '#63d8e8', rgb: '99,216,232' },
  // New series (2026-11-15): each gets its own colour so the feed doesn't look uniform.
  'one-shot': { hex: '#f2c879', rgb: '242,200,121' },
  'wrong-about-space': { hex: '#ff5a6e', rgb: '255,90,110' },
  'cosmic-top-5': { hex: '#ff4fd8', rgb: '255,79,216' },
  'mission-control': { hex: '#ff8c1a', rgb: '255,140,26' },
  'weird-physics': { hex: '#9dff57', rgb: '157,255,87' },
};

export const DEFAULT_ACCENT = SERIES_ACCENT['sky-this-week'];

export const accentFor = (series: string): { hex: string; rgb: string } => SERIES_ACCENT[series] ?? DEFAULT_ACCENT;
