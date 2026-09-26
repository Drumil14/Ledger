/**
 * Public runtime configuration.
 *
 * Only `EXPO_PUBLIC_*` variables are inlined into the client bundle, and the
 * Supabase URL + anon/publishable key are designed to be public (row-level
 * security enforces access). Never put service-role keys or other secrets here.
 */

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const env = {
  supabaseUrl,
  supabaseAnonKey,
} as const;

/** True only when both Supabase values are present. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
