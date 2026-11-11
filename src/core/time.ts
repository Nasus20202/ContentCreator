/** Time-zone helpers built on Intl only (no tz database dependency). */

/** Offset of `timeZone` from UTC at `date`, in milliseconds (e.g. +3_600_000 for CET). */
export function tzOffsetMs(date: Date, timeZone: string): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName')?.value;
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name ?? '');
  if (!m) return 0;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 3600_000 + Number(m[3] ?? 0) * 60_000);
}

/** The UTC instant of local midnight on `isoDate` (YYYY-MM-DD) in `timeZone`. */
export function localMidnight(isoDate: string, timeZone: string): Date {
  const guess = new Date(`${isoDate}T00:00:00Z`);
  const first = new Date(guess.getTime() - tzOffsetMs(guess, timeZone));
  // re-evaluate in case the offset differs at the corrected instant (DST edge)
  return new Date(guess.getTime() - tzOffsetMs(first, timeZone));
}

export function addLocalDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
