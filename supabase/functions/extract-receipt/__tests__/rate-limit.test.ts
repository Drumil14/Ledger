/// <reference types="jest" />
import { evaluateRateLimit } from '../rate-limit';

const LIMIT = 40;

describe('evaluateRateLimit', () => {
  it('allows calls at or below the limit', () => {
    expect(evaluateRateLimit(1, false, LIMIT)).toEqual({ allowed: true, count: 1 });
    expect(evaluateRateLimit(LIMIT, false, LIMIT)).toEqual({ allowed: true, count: LIMIT });
  });

  it('blocks the first call over the limit', () => {
    expect(evaluateRateLimit(LIMIT + 1, false, LIMIT)).toEqual({
      allowed: false,
      reason: 'limited',
      count: LIMIT + 1,
    });
  });

  it('fails closed when the RPC errored', () => {
    // Even with a count that would otherwise pass, an error must refuse the call.
    expect(evaluateRateLimit(1, true, LIMIT)).toEqual({
      allowed: false,
      reason: 'unavailable',
      count: 1,
    });
  });

  it('fails closed when the counter is missing or non-numeric', () => {
    expect(evaluateRateLimit(null, false, LIMIT)).toEqual({
      allowed: false,
      reason: 'unavailable',
      count: null,
    });
    expect(evaluateRateLimit(undefined, false, LIMIT)).toEqual({
      allowed: false,
      reason: 'unavailable',
      count: null,
    });
  });

  it('fails closed on non-finite counts', () => {
    expect(evaluateRateLimit(Number.NaN, false, LIMIT)).toMatchObject({
      allowed: false,
      reason: 'unavailable',
    });
    expect(evaluateRateLimit(Number.POSITIVE_INFINITY, false, LIMIT)).toMatchObject({
      allowed: false,
      reason: 'unavailable',
    });
  });
});
