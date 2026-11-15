import { describe, expect, it } from 'vitest';
import { spokenForm } from '../src/voice/lexicon';

describe('spokenForm', () => {
  it('reads mission Roman numerals as words', () => {
    expect(spokenForm('The Artemis II crew shot it.')).toBe('The Artemis two crew shot it.');
    expect(spokenForm('Apollo III and Saturn V')).toBe('Apollo three and Saturn five');
  });
  it('leaves other text alone', () => {
    expect(spokenForm('Voyager 1 is one light-day away. I saw it.')).toBe('Voyager 1 is one light-day away. I saw it.');
  });
});
