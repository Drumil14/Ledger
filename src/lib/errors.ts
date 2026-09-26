/**
 * Maps low-level Supabase / network errors to calm, user-facing copy. Raw
 * backend strings are never shown to users.
 */

type WithMessage = { message?: unknown; code?: unknown };

/** Sentinel thrown when there is no authenticated session. */
export const SESSION_EXPIRED = 'SESSION_EXPIRED';

function readMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const { message } = error as WithMessage;
    if (typeof message === 'string') return message;
  }
  return '';
}

export function toUserMessage(error: unknown): string {
  const raw = readMessage(error).toLowerCase();

  if (raw === SESSION_EXPIRED.toLowerCase() || raw.includes('jwt') || raw.includes('not authenticated')) {
    return 'Your session expired. Please log in again.';
  }
  if (raw.includes('network') || raw.includes('fetch') || raw.includes('failed to fetch')) {
    return 'Network error. Check your connection and try again.';
  }
  if (raw.includes('row-level security') || raw.includes('permission')) {
    return 'You don’t have permission to do that.';
  }
  return 'Something went wrong. Please try again.';
}
