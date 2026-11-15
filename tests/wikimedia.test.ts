import { describe, expect, it } from 'vitest';
import { commercialOk } from '../src/assets/wikimedia';

describe('Commons licence gate', () => {
  it('accepts licences that allow commercial reuse and adaptation', () => {
    for (const l of ['CC BY 2.0', 'CC BY-SA 4.0', 'CC0', 'Public domain', 'CC BY 4.0'])
      expect(commercialOk(l)).toBe(true);
  });
  it('refuses non-commercial, no-derivatives and unknown licences', () => {
    for (const l of ['CC BY-NC 2.0', 'CC BY-ND 4.0', 'CC BY-NC-SA 3.0', '', 'All rights reserved'])
      expect(commercialOk(l)).toBe(false);
  });
});
