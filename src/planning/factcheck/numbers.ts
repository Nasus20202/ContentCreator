/**
 * Extracts numeric claims from narration / on-screen text, including spelled-out English numbers
 * ("two hundred million", "sixteenth"), so they can be matched against facts.
 */

export interface NumberMention {
  raw: string;
  value: number;
  /** Clock-time components ("23:28") only ever match other clock times. */
  kind: 'number' | 'time';
}

const UNITS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
const SCALES: Record<string, number> = { hundred: 100, thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12 };
const ORDINALS: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
  thirteenth: 13,
  fourteenth: 14,
  fifteenth: 15,
  sixteenth: 16,
  seventeenth: 17,
  eighteenth: 18,
  nineteenth: 19,
  twentieth: 20,
  thirtieth: 30,
};
const MONTHS =
  /^(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)$/;
/** Words after a bare "one" that make it a quantity rather than a pronoun ("the bright one"). */
const ONE_UNITS =
  /^(degree|degrees|hour|minute|second|day|week|month|year|percent|in|million|billion|thousand|hundred|meteor|planet|moon|full|kilometer|kilometers|km|mile|miles|light|times?)$/;

const isNumberWord = (w: string): boolean => w in UNITS || w in TENS || w in SCALES || w === 'a' || w === 'and';

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/(\d),(\d{3})/g, '$1$2')
    .replace(/([a-z])-(?=[a-z])/g, '$1 ')
    .replace(/[–—/]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^[^a-z0-9≈+-]+/, '').replace(/[^a-z0-9%°×]+$/, ''))
    .filter(Boolean);
}

/** Parse a run of number words (e.g. ["two","hundred","million"]) into a value. */
export function wordsToNumber(words: string[]): number | undefined {
  let total = 0,
    current = 0,
    seen = false;
  for (const w of words) {
    if (w === 'and') continue;
    if (w === 'a') {
      current = current || 1;
      continue;
    }
    if (w in UNITS) current += UNITS[w];
    else if (w in TENS) current += TENS[w];
    else if (w === 'hundred') current = (current || 1) * 100;
    else if (w in SCALES) {
      total += (current || 1) * SCALES[w];
      current = 0;
    } else return undefined;
    seen = true;
  }
  return seen ? total + current : undefined;
}

export function extractNumbers(text: string): NumberMention[] {
  const tokens = tokenize(text);
  const out: NumberMention[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    // digits: 1.19, 23:28, 15%, 1.2°, 5°
    const digit = /^[-+]?(\d+(?:\.\d+)?)(?::(\d{2}))?[%°×x]?$/.exec(t) ?? /^≈?(\d+(?:\.\d+)?)[%°×x]?$/.exec(t);
    if (digit) {
      const kind = digit[2] ? 'time' : 'number';
      out.push({ raw: t, value: Number(digit[1]), kind });
      if (digit[2]) out.push({ raw: t, value: Number(digit[2]), kind });
      continue;
    }

    // ordinals: "sixteenth", "twenty-first" (hyphen split into twenty + first)
    const ordinalBase = ORDINALS[t];
    if (ordinalBase !== undefined) {
      const prevTen = i > 0 ? TENS[tokens[i - 1]] : undefined;
      const value = (prevTen ?? 0) + ordinalBase;
      const nearMonth = [tokens[i - 1], tokens[i - 2], tokens[i + 1], tokens[i + 2]].some((x) => x && MONTHS.test(x));
      // first/second/third are too often plain English ("for the first time")
      if (ordinalBase > 3 || nearMonth || prevTen) {
        if (prevTen) out.pop();
        out.push({ raw: prevTen ? `${tokens[i - 1]}-${t}` : t, value, kind: 'number' });
      }
      continue;
    }

    // cardinal word runs
    if (t in UNITS || t in TENS || (t === 'a' && tokens[i + 1] in SCALES)) {
      let j = i;
      while (
        j < tokens.length &&
        isNumberWord(tokens[j]) &&
        !(tokens[j] === 'and' && !isNumberWord(tokens[j + 1] ?? ''))
      )
        j++;
      // trailing "and"/"a" are not part of the number
      while (j > i && (tokens[j - 1] === 'and' || tokens[j - 1] === 'a')) j--;
      const run = tokens.slice(i, j);
      if (run.length === 1 && run[0] === 'one' && !ONE_UNITS.test(tokens[j] ?? '')) {
        continue;
      }
      if (run.length === 0 || (run.length === 1 && run[0] === 'a')) continue;
      // "twenty" followed by an ordinal is handled by the ordinal branch
      if (run.length === 1 && t in TENS && tokens[j] in ORDINALS) continue;
      const value = wordsToNumber(run);
      if (value !== undefined) {
        out.push({ raw: run.join(' '), value, kind: 'number' });
        i = j - 1;
      }
    }
  }
  return out;
}

const decimals = (x: number): number => (Number.isInteger(x) ? 0 : (String(x).split('.')[1]?.length ?? 0));

/**
 * Does a spoken/displayed value honestly quote a fact value?
 * - Integer facts (days, counts) must match exactly: "17" never matches 16.
 * - Decimal facts may be rounded at the precision spoken: "1.2" or "just over one" for 1.194, not "1.5".
 * - Large numbers (≥100, incl. scale words) may be rounded within 10%: "two hundred million" for 195.5 million.
 */
export function matchesValue(spoken: number, factValue: number): boolean {
  for (const scale of [1, 1e3, 1e6, 1e9]) {
    const f = factValue * scale;
    if (spoken === f) return true;
    const diff = Math.abs(spoken - f);
    if (Math.abs(f) >= 100) {
      if (diff / Math.abs(f) <= 0.1) return true;
      continue;
    }
    if (Number.isInteger(f)) continue;
    // rounding at the spoken precision ("2" for 2.296 → tolerance 0.5; "1.2" for 1.194 → 0.05)
    if (diff <= 0.5 * 10 ** -decimals(spoken) + 1e-9) return true;
  }
  return false;
}
