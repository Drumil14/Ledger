/**
 * Pure rate-limit decision for receipt AI extraction.
 *
 * Extracted from the Edge Function handler so the fail-closed behaviour can be
 * unit-tested without a running Deno/Supabase environment. No imports, no I/O,
 * no Deno globals — just the decision given the counter's result.
 *
 * Fail-closed is the whole point: if the per-user daily counter is unavailable
 * (the RPC errored, or returned something that isn't a finite number) we must
 * NOT proceed to a billable model call. A database hiccup should degrade to
 * "try again later", never to an uncapped spend path.
 */

export type RateLimitDecision =
  | { allowed: true; count: number }
  | { allowed: false; reason: 'limited'; count: number }
  | { allowed: false; reason: 'unavailable'; count: number | null };

/**
 * Decide whether a receipt extraction may proceed.
 *
 * @param count    The new usage count returned by `increment_receipt_ai_usage`.
 * @param errored  Whether the RPC reported an error.
 * @param limit    The per-user daily cap (inclusive — `limit` calls are allowed,
 *                 the `limit + 1`-th is blocked).
 */
export function evaluateRateLimit(
  count: number | null | undefined,
  errored: boolean,
  limit: number
): RateLimitDecision {
  // Fail closed: a missing or non-finite counter means we cannot prove the user
  // is under the cap, so we refuse rather than risk unbounded AI spend.
  if (errored || typeof count !== 'number' || !Number.isFinite(count)) {
    return {
      allowed: false,
      reason: 'unavailable',
      count: typeof count === 'number' && Number.isFinite(count) ? count : null,
    };
  }

  if (count > limit) {
    return { allowed: false, reason: 'limited', count };
  }

  return { allowed: true, count };
}
