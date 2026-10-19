import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TEMP_BANDS,
} from '@/utils/constants';
import {
  mapTempToBands,
  matchesTempBand,
  primaryBand,
} from './temperature';

describe('mapTempToBands', () => {
  it('returns nearest single band for a mid-range temp', () => {
    // 22 距 18=4, 距 25=3 → 25
    expect(mapTempToBands(22)).toEqual([25]);
  });

  it('returns 0° for very cold temps (0 is the primary)', () => {
    const res1 = mapTempToBands(-15);
    expect(res1[0]).toEqual(0);
    expect(res1).toContain(0);
    const res2 = mapTempToBands(5);
    expect(res2[0]).toEqual(0);
  });

  it('returns 40° for very hot temps (40 is the primary)', () => {
    const res1 = mapTempToBands(45);
    expect(res1[0]).toEqual(40);
    expect(res1).toContain(40);
    const res2 = mapTempToBands(60);
    expect(res2[0]).toEqual(40);
  });

  it('returns both neighboring bands at the exact midpoint', () => {
    // 中点：(18+25)/2=21.5
    const res = mapTempToBands(21.5);
    expect(res).toContain(18);
    expect(res).toContain(25);
    expect(res).toHaveLength(2);
  });

  it('handles a single-band input', () => {
    expect(mapTempToBands(15, [25])).toEqual([25]);
  });

  it('handles an empty input by defaulting to [0]', () => {
    expect(mapTempToBands(15, [])).toEqual([0]);
  });

  it('ignores the order of input bands', () => {
    // 22 距 18=4, 距 25=3 → 25
    expect(mapTempToBands(22, [40, 0, 25, 18, 30])).toEqual([25]);
  });

  it('returns the same bands array contents by default (DEFAULT_TEMP_BANDS)', () => {
    // 直接确认默认档位顺序
    expect([...DEFAULT_TEMP_BANDS].sort((a, b) => a - b)).toEqual([0, 18, 25, 30, 40]);
  });
});

describe('primaryBand', () => {
  it('returns the nearest single band', () => {
    expect(primaryBand(22)).toEqual(25);
    expect(primaryBand(-10)).toEqual(0);
    expect(primaryBand(50)).toEqual(40);
  });

  it('returns the first band when the list has one element', () => {
    expect(primaryBand(10, [25])).toEqual(25);
  });
});

describe('matchesTempBand', () => {
  it('returns true when itemBands is empty (universal item)', () => {
    expect(matchesTempBand([], [18, 25])).toBe(true);
  });

  it('returns true when any candidate is present', () => {
    expect(matchesTempBand([18, 25], [25])).toBe(true);
    expect(matchesTempBand([18, 25], [18, 25])).toBe(true);
  });

  it('returns false when no candidate matches', () => {
    expect(matchesTempBand([0], [18, 25])).toBe(false);
  });

  it('returns false for empty candidates', () => {
    expect(matchesTempBand([18], [])).toBe(false);
  });
});
