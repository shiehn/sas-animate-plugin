/**
 * animation-defs — the panel's type metadata. Pins the rate-token convention
 * (quarter-note periods: '1/4' = 1 qn, one 4/4 bar = 4 qn) and structural
 * integrity of every def (knobs vs defaults coherence, preset params).
 */

import {
  ANIMATION_DEFS,
  ANIMATION_DEF_BY_TYPE,
  FAMILY_ORDER,
  RATE_QN,
} from '../animation-defs';

describe('RATE_QN', () => {
  it('uses the platform quarter-note-period convention', () => {
    expect(RATE_QN['1/4']).toBe(1);
    expect(RATE_QN['1/8']).toBe(0.5);
    expect(RATE_QN['1/16']).toBe(0.25);
    expect(RATE_QN['1bar']).toBe(4);
    expect(RATE_QN['4bar']).toBe(16);
    expect(RATE_QN['1/8T']).toBeCloseTo(1 / 3);
  });

  it('stays within the engine motion clamp (1/16..16 qn)', () => {
    for (const [token, qn] of Object.entries(RATE_QN)) {
      expect(qn).toBeGreaterThanOrEqual(1 / 16);
      expect(qn).toBeLessThanOrEqual(16);
      expect(token.length).toBeGreaterThan(0);
    }
  });
});

describe('ANIMATION_DEFS', () => {
  it('every def has a unique type, a family in order, and a positive default amount', () => {
    const seen = new Set<string>();
    for (const def of ANIMATION_DEFS) {
      expect(seen.has(def.type)).toBe(false);
      seen.add(def.type);
      expect(FAMILY_ORDER).toContain(def.family);
      expect(typeof def.defaults.amount).toBe('number');
      expect(def.defaults.amount as number).toBeGreaterThan(0);
      expect(def.blurb.length).toBeGreaterThan(10);
    }
  });

  it('rate-knob types default to an in-range rateQn', () => {
    for (const def of ANIMATION_DEFS) {
      if (!def.knobs.includes('rate')) continue;
      const rateQn = def.defaults.rateQn as number;
      expect(typeof rateQn).toBe('number');
      expect(rateQn).toBeGreaterThanOrEqual(1 / 16);
      expect(rateQn).toBeLessThanOrEqual(16);
    }
  });

  it('reactive defs are flagged needsListen; others are not', () => {
    expect(ANIMATION_DEF_BY_TYPE.get('duck')?.needsListen).toBe(true);
    expect(ANIMATION_DEF_BY_TYPE.get('autopan')?.needsListen).toBeUndefined();
  });

  it('lookup map covers every def', () => {
    expect(ANIMATION_DEF_BY_TYPE.size).toBe(ANIMATION_DEFS.length);
  });
});
