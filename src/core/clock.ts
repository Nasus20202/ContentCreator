/**
 * How the `journey` template prints a running clock. Shared by the fact-check (which checks the
 * start and end readings) and the Remotion bundle (which draws them), so it must stay browser-safe.
 */
export type ClockUnit = 'min' | 's' | 'years';

export function formatClock(value: number, unit: ClockUnit, decimals = 0): string {
  if (unit === 'min') {
    let m = Math.floor(value);
    let s = Math.round((value - m) * 60);
    if (s === 60) {
      m += 1;
      s = 0;
    }
    return s === 0 ? `${m} min` : `${m} min ${s} s`;
  }
  if (unit === 's') return `${Math.round(value)} s`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(1).replace(/\.0$/, '')} billion yrs`;
  if (value >= 1e6) {
    const millions = value / 1e6;
    return `${millions.toFixed(millions >= 10 ? 0 : 1).replace(/\.0$/, '')} million yrs`;
  }
  return `${value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} yrs`;
}
