import { describe, expect, it } from 'vitest';
import { extractNumbers, matchesValue, wordsToNumber } from '../src/planning/factcheck/numbers';

const values = (t: string) => extractNumbers(t).map((m) => m.value);

describe('wordsToNumber', () => {
  it.each([
    [['two', 'hundred', 'million'], 200e6],
    [['fifteen'], 15],
    [['one', 'hundred', 'and', 'twenty', 'three'], 123],
    [['a', 'thousand'], 1000],
    [['three', 'point'], undefined],
  ])('%j → %s', (words, expected) => expect(wordsToNumber(words)).toBe(expected));
});

describe('extractNumbers', () => {
  it('ignores numbers inside source URLs', () => {
    expect(values('Starshot: https://breakthroughinitiatives.org/initiative/3 is 15% of c')).toEqual([15]);
  });

  it('reads spelled-out cardinals with scales', () => {
    expect(values('Mars is about two hundred million kilometers away.')).toEqual([200e6]);
  });

  it('reads digits, decimals, degrees, percentages and clock times', () => {
    expect(values('Only 1.19° apart, 57% lit, moonset 23:28.')).toEqual([1.19, 57, 23, 28]);
  });

  it('reads date ordinals including hyphenated ones', () => {
    expect(values('On Monday, November sixteenth')).toEqual([16]);
    expect(values('the twenty-first of November')).toEqual([21]);
  });

  it('ignores pronoun "one" and casual first/second/third', () => {
    expect(values('Jupiter is the brilliant one. For the first time in a second.')).toEqual([]);
  });

  it('keeps "one" when it is a quantity', () => {
    expect(values('just over one degree apart')).toEqual([1]);
  });

  it('does not treat the article "a" as a number', () => {
    expect(values('a meteor shower and a planet')).toEqual([]);
  });
});

describe('matchesValue', () => {
  it('accepts honest rounding', () => {
    expect(matchesValue(1, 1.194)).toBe(true);
    expect(matchesValue(2, 2.296)).toBe(true);
    expect(matchesValue(4, 4.03)).toBe(true);
  });
  it('accepts scale words against values stored in millions', () => {
    expect(matchesValue(200e6, 195.485)).toBe(true);
  });
  it('respects the precision that was spoken', () => {
    expect(matchesValue(1.2, 1.194)).toBe(true);
    expect(matchesValue(1.5, 1.194)).toBe(false);
  });
  it('never fuzzes integer facts like dates', () => {
    expect(matchesValue(17, 16)).toBe(false);
    expect(matchesValue(23, 22)).toBe(false);
  });
  it('rejects wrong numbers', () => {
    expect(matchesValue(3, 1.194)).toBe(false);
    expect(matchesValue(300e6, 195.485)).toBe(false);
    expect(matchesValue(25, 15)).toBe(false);
  });
});

describe('clock times', () => {
  it('tags hh:mm components as time', () => {
    expect(extractNumbers('moonset 23:28, 3 degrees').map((m) => m.kind)).toEqual(['time', 'time', 'number']);
  });
});
