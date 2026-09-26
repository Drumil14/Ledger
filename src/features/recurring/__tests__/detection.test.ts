/// <reference types="jest" />
import {
  computeNextExpectedDate,
  detectRecurring,
  matchingTransactions,
  normalizeMerchant,
} from '@/features/recurring/detection';
import type { Transaction } from '@/types/transaction';

let seq = 0;
const tx = (merchant: string, date: string, amount: number, id?: string): Transaction => ({
  id: id ?? `t${(seq += 1)}`,
  amount,
  currency: 'USD',
  merchant,
  category: 'Other',
  date,
  sourceType: 'manual',
});

const NOW = new Date('2026-09-25T00:00:00');
const detect = (transactions: Transaction[]) => detectRecurring(transactions, { now: NOW });

/* -------------------------------------------------------------------------- */
/* Merchant normalization                                                     */
/* -------------------------------------------------------------------------- */

describe('normalizeMerchant', () => {
  it('lowercases and trims', () => {
    expect(normalizeMerchant('  Gym  ')).toBe('gym');
    expect(normalizeMerchant('SPOTIFY')).toBe('spotify');
  });

  it('collapses common merchant variants to one key', () => {
    expect(normalizeMerchant('Spotify USA')).toBe('spotify');
    expect(normalizeMerchant('Spotify Premium')).toBe('spotify');
    expect(normalizeMerchant('SPOTIFY*1234')).toBe('spotify');
    expect(normalizeMerchant('Netflix.com')).toBe('netflix');
  });

  it('strips payment-processor prefixes', () => {
    expect(normalizeMerchant('SQ *BLUE BOTTLE')).toBe('blue bottle');
    expect(normalizeMerchant('TST* Joes Diner')).toBe('joes diner');
  });

  it('drops store / transaction numbers but keeps semantic short digits', () => {
    expect(normalizeMerchant('Costco #1084')).toBe('costco');
    expect(normalizeMerchant('7 Eleven')).toBe('7 eleven');
  });

  it('does NOT collapse unrelated merchants that share a first word', () => {
    expect(normalizeMerchant('Apple Music')).toBe('apple music');
    expect(normalizeMerchant('Apple TV')).toBe('apple tv');
    expect(normalizeMerchant('Apple Music')).not.toBe(normalizeMerchant('Apple TV'));
  });
});

/* -------------------------------------------------------------------------- */
/* Amount matching                                                            */
/* -------------------------------------------------------------------------- */

describe('detectRecurring — amount matching', () => {
  it('detects an exact repeated monthly amount', () => {
    const result = detect([
      tx('Netflix', '2026-06-10', 22.99),
      tx('Netflix', '2026-07-10', 22.99),
      tx('Netflix', '2026-08-10', 22.99),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      normalizedMerchant: 'netflix',
      frequency: 'monthly',
      expectedAmount: 22.99,
      occurrences: 3,
      confidence: 'high',
    });
  });

  it('accepts amounts that vary within tolerance (utilities)', () => {
    const result = detect([
      tx('City Power', '2026-06-05', 84.2),
      tx('City Power', '2026-07-05', 88.13),
      tx('City Power', '2026-08-05', 81.64),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].frequency).toBe('monthly');
    // median of the three
    expect(result[0].expectedAmount).toBe(84.2);
    // varied amounts ⇒ not "tight", so 3 occurrences ⇒ medium (not high)
    expect(result[0].confidence).toBe('medium');
  });

  it('rejects a series whose amounts differ beyond tolerance', () => {
    const result = detect([
      tx('Netflix', '2026-06-10', 22.99),
      tx('Netflix', '2026-07-10', 22.99),
      tx('Netflix', '2026-08-10', 30.0),
    ]);
    expect(result).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Date intervals                                                             */
/* -------------------------------------------------------------------------- */

describe('detectRecurring — frequencies', () => {
  it('treats natural calendar variation as monthly', () => {
    const result = detect([
      tx('Adobe', '2026-01-15', 22.99),
      tx('Adobe', '2026-02-15', 22.99), // 31 days
      tx('Adobe', '2026-03-14', 22.99), // 27 days
      tx('Adobe', '2026-04-15', 22.99), // 32 days
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].frequency).toBe('monthly');
    expect(result[0].occurrences).toBe(4);
  });

  it('detects a weekly pattern', () => {
    const result = detect([
      tx('Corner Cafe', '2026-01-01', 4.5),
      tx('Corner Cafe', '2026-01-08', 4.5),
      tx('Corner Cafe', '2026-01-15', 4.5),
    ]);
    expect(result[0].frequency).toBe('weekly');
  });

  it('detects a biweekly pattern', () => {
    const result = detect([
      tx('Payroll Save', '2026-01-01', 100),
      tx('Payroll Save', '2026-01-15', 100),
      tx('Payroll Save', '2026-01-29', 100),
    ]);
    expect(result[0].frequency).toBe('biweekly');
  });

  it('detects a quarterly pattern', () => {
    const result = detect([
      tx('Insurance Co', '2026-01-15', 210),
      tx('Insurance Co', '2026-04-15', 210), // 90 days
      tx('Insurance Co', '2026-07-15', 210), // 91 days
    ]);
    expect(result[0].frequency).toBe('quarterly');
  });

  it('handles a monthly pattern that crosses a year boundary', () => {
    const result = detect([
      tx('iCloud', '2025-11-15', 2.99),
      tx('iCloud', '2025-12-15', 2.99),
      tx('iCloud', '2026-01-15', 2.99),
    ]);
    expect(result[0].frequency).toBe('monthly');
    expect(result[0].occurrences).toBe(3);
  });

  it('detects a yearly pattern including a leap year', () => {
    const result = detect([
      tx('Domain Renewal', '2024-02-01', 18),
      tx('Domain Renewal', '2025-02-01', 18), // 366 days
      tx('Domain Renewal', '2026-02-01', 18), // 365 days
    ]);
    expect(result[0].frequency).toBe('yearly');
  });

  it('does not classify a series with mixed / irregular intervals', () => {
    const result = detect([
      tx('Random Store', '2026-01-01', 20),
      tx('Random Store', '2026-01-05', 20), // 4 days — below weekly
      tx('Random Store', '2026-03-05', 20), // ~59 days
    ]);
    expect(result).toHaveLength(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Evidence & confidence                                                      */
/* -------------------------------------------------------------------------- */

describe('detectRecurring — evidence', () => {
  it('requires at least two occurrences', () => {
    expect(detect([tx('Spotify', '2026-08-10', 11.99)])).toHaveLength(0);
  });

  it('flags two exact matches as a medium-confidence candidate', () => {
    const result = detect([
      tx('Spotify', '2026-07-10', 11.99),
      tx('Spotify', '2026-08-10', 11.99),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].occurrences).toBe(2);
    expect(result[0].confidence).toBe('medium');
  });

  it('treats two loosely-matching amounts as low confidence', () => {
    const result = detect([
      tx('City Power', '2026-07-05', 84.2),
      tx('City Power', '2026-08-05', 82.0),
    ]);
    expect(result[0].confidence).toBe('low');
  });

  it('does not merge unrelated merchants that share a first word', () => {
    const result = detect([
      tx('Apple Music', '2026-06-10', 10.99),
      tx('Apple Music', '2026-07-10', 10.99),
      tx('Apple Music', '2026-08-10', 10.99),
      tx('Apple TV', '2026-06-12', 6.99),
      tx('Apple TV', '2026-07-12', 6.99),
      tx('Apple TV', '2026-08-12', 6.99),
    ]);
    const keys = result.map((r) => r.normalizedMerchant).sort();
    expect(keys).toEqual(['apple music', 'apple tv']);
  });

  it('orders results by confidence then amount', () => {
    const result = detect([
      // low-amount high confidence
      tx('iCloud', '2026-06-10', 2.99),
      tx('iCloud', '2026-07-10', 2.99),
      tx('iCloud', '2026-08-10', 2.99),
      // high-amount high confidence
      tx('Gym', '2026-06-01', 49),
      tx('Gym', '2026-07-01', 49),
      tx('Gym', '2026-08-01', 49),
    ]);
    expect(result.map((r) => r.normalizedMerchant)).toEqual(['gym', 'icloud']);
  });

  it('exposes matched transaction ids newest first', () => {
    const result = detect([
      tx('Netflix', '2026-06-10', 22.99, 'a'),
      tx('Netflix', '2026-07-10', 22.99, 'b'),
      tx('Netflix', '2026-08-10', 22.99, 'c'),
    ]);
    expect(result[0].transactionIds).toEqual(['c', 'b', 'a']);
    expect(result[0].lastTransactionId).toBe('c');
  });
});

/* -------------------------------------------------------------------------- */
/* Next expected date                                                         */
/* -------------------------------------------------------------------------- */

describe('computeNextExpectedDate', () => {
  it('adds seven days for weekly', () => {
    expect(computeNextExpectedDate('2026-01-01', 'weekly')).toBe('2026-01-08');
  });

  it('adds a calendar month for monthly, clamping short months', () => {
    expect(computeNextExpectedDate('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(computeNextExpectedDate('2026-09-14', 'monthly')).toBe('2026-10-14');
  });

  it('adds a year for yearly, clamping a leap day', () => {
    expect(computeNextExpectedDate('2024-02-29', 'yearly')).toBe('2025-02-28');
  });
});

/* -------------------------------------------------------------------------- */
/* matchingTransactions                                                       */
/* -------------------------------------------------------------------------- */

describe('matchingTransactions', () => {
  const transactions = [
    tx('Spotify', '2026-06-10', 11.99, 'a'),
    tx('SPOTIFY*1234', '2026-07-10', 11.99, 'b'),
    tx('Spotify USA', '2026-08-10', 11.99, 'c'),
    tx('Spotify', '2026-08-11', 40.0, 'd'), // amount out of tolerance
    tx('Netflix', '2026-08-10', 22.99, 'e'),
  ];

  it('returns same-merchant charges within tolerance, newest first', () => {
    const rows = matchingTransactions(transactions, 'spotify', 11.99);
    expect(rows.map((t) => t.id)).toEqual(['c', 'b', 'a']);
  });

  it('returns all same-merchant charges when no target amount', () => {
    const rows = matchingTransactions(transactions, 'spotify', null);
    expect(rows.map((t) => t.id)).toEqual(['d', 'c', 'b', 'a']);
  });
});
