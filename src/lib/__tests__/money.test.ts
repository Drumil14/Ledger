/// <reference types="jest" />
import {
  amountToCents,
  amountToInput,
  centsToAmount,
  parseAmountToCents,
  sanitizeAmountInput,
  sumAmounts,
} from '@/lib/money';

describe('parseAmountToCents', () => {
  it('parses valid amounts to integer cents', () => {
    expect(parseAmountToCents('47.82')).toBe(4782);
    expect(parseAmountToCents('100')).toBe(10000);
    expect(parseAmountToCents('1.5')).toBe(150);
    expect(parseAmountToCents('0.99')).toBe(99);
    expect(parseAmountToCents('  5  ')).toBe(500);
  });

  it('rejects invalid amounts', () => {
    expect(parseAmountToCents('')).toBeNull();
    expect(parseAmountToCents('0')).toBeNull();
    expect(parseAmountToCents('0.00')).toBeNull();
    expect(parseAmountToCents('-1')).toBeNull();
    expect(parseAmountToCents('12.3.4')).toBeNull();
    expect(parseAmountToCents('12.345')).toBeNull();
    expect(parseAmountToCents('abc')).toBeNull();
    expect(parseAmountToCents('1e3')).toBeNull();
  });

  it('rejects amounts above the ceiling', () => {
    expect(parseAmountToCents('1000000.01')).toBeNull();
  });
});

describe('cents conversions', () => {
  it('round-trips cents and amounts', () => {
    expect(centsToAmount(4782)).toBe(47.82);
    expect(amountToCents(47.82)).toBe(4782);
    expect(amountToInput(47.8)).toBe('47.80');
    expect(amountToInput(47.826)).toBe('47.83');
  });
});

describe('sumAmounts', () => {
  it('avoids floating point drift', () => {
    expect(sumAmounts([0.1, 0.2])).toBe(0.3);
    expect(sumAmounts([47.82, 14.6, 11.99])).toBe(74.41);
    expect(sumAmounts([])).toBe(0);
  });
});

describe('sanitizeAmountInput', () => {
  it('keeps digits and a single dot with max two decimals', () => {
    expect(sanitizeAmountInput('12.3.4')).toBe('12.34');
    expect(sanitizeAmountInput('abc12')).toBe('12');
    expect(sanitizeAmountInput('12.345')).toBe('12.34');
    expect(sanitizeAmountInput('12.')).toBe('12.');
    expect(sanitizeAmountInput('9')).toBe('9');
  });
});
