/**
 * Server-side pickup-day resolution: the model passes the customer's own words, we turn them into a date.
 * "Today" is always computed in Asia/Kolkata (the shops' time zone), never the server's or UTC.
 * Anything not resolvable deterministically is returned as the trimmed original text (max 60 chars); nothing is rejected.
 */
const TZ = 'Asia/Kolkata';
const MAX_LEN = 60;

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
};
const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

function validDate(y: number, m: number, d: number): boolean {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** Calendar date of `now` in Asia/Kolkata. */
function todayIst(now: Date): { y: number; m: number; d: number } {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now).split('-').map(Number);
  return { y, m, d };
}

function addDays(y: number, m: number, d: number, n: number): string {
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return fmt(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function resolvePickup(text: string, now: Date = new Date()): string {
  const original = String(text ?? '').trim().slice(0, MAX_LEN).trim();
  const s = original.toLowerCase().replace(/[.,!]+$/g, '').replace(/\s+/g, ' ').replace(/^(on|this|coming) /, '').trim();
  if (!s || Number.isNaN(now.getTime())) return original;
  const t = todayIst(now);
  const wdToday = new Date(Date.UTC(t.y, t.m - 1, t.d)).getUTCDay();

  if (s === 'today') return fmt(t.y, t.m, t.d);
  if (s === 'tomorrow' || s === 'tmrw') return addDays(t.y, t.m, t.d, 1);
  if (s === 'day after tomorrow' || s === 'the day after tomorrow') return addDays(t.y, t.m, t.d, 2);

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return validDate(+iso[1], +iso[2], +iso[3]) ? s : original;

  const wd = s.match(/^(next )?([a-z]+)$/);
  if (wd && wd[2] in WEEKDAYS) {
    let delta = (WEEKDAYS[wd[2]] - wdToday + 7) % 7;
    if (wd[1] && delta === 0) delta = 7;
    return addDays(t.y, t.m, t.d, delta);
  }

  // "14 Nov", "14th November 2026", "Nov 14", "November 14, 2026"
  const dm = s.match(/^(\d{1,2})(?:st|nd|rd|th)? (?:of )?([a-z]+),? ?(\d{4})?$/);
  const md = s.match(/^([a-z]+) (\d{1,2})(?:st|nd|rd|th)?,? ?(\d{4})?$/);
  const parts = dm ? { d: +dm[1], mon: dm[2], y: dm[3] } : md ? { d: +md[2], mon: md[1], y: md[3] } : null;
  if (parts && parts.mon in MONTHS) {
    const m = MONTHS[parts.mon];
    if (parts.y) return validDate(+parts.y, m, parts.d) ? fmt(+parts.y, m, parts.d) : original;
    let y = t.y;
    if (m < t.m || (m === t.m && parts.d < t.d)) y += 1;
    return validDate(y, m, parts.d) ? fmt(y, m, parts.d) : original;
  }
  return original;
}
