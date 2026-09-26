import { createClient } from 'npm:@supabase/supabase-js@^2';

import { corsHeaders } from '../_shared/cors.ts';
import { AnthropicReceiptProvider } from './provider.ts';
import { normalizeCategory } from './schema.ts';

const DAILY_LIMIT = Number(Deno.env.get('RECEIPT_AI_DAILY_LIMIT') ?? '40');
const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // 6 MB decoded
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey || !apiKey) {
    return json({ error: 'server_misconfigured' }, 500);
  }

  // Verify the caller from their session (never trust a client-supplied user id).
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'unauthorized' }, 401);
  const userId = userData.user.id;

  let body: { imageBase64?: unknown; mediaType?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const { imageBase64, mediaType } = body;
  if (typeof imageBase64 !== 'string' || typeof mediaType !== 'string') {
    return json({ error: 'invalid_body' }, 400);
  }
  if (!ALLOWED_MIME.has(mediaType)) return json({ error: 'unsupported_media_type' }, 415);
  if (Math.floor(imageBase64.length * 0.75) > MAX_IMAGE_BYTES) {
    return json({ error: 'image_too_large' }, 413);
  }

  // Rate limit per user per day (service role bypasses RLS).
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: usageCount, error: usageErr } = await admin.rpc('increment_receipt_ai_usage', {
    p_user_id: userId,
  });
  if (!usageErr && typeof usageCount === 'number' && usageCount > DAILY_LIMIT) {
    return json({ error: 'rate_limited' }, 429);
  }

  try {
    const provider = new AnthropicReceiptProvider(apiKey);
    const extraction = await provider.extractReceipt({ imageBase64, mediaType });
    const normalized = {
      ...extraction,
      categorySuggestion: normalizeCategory(extraction.categorySuggestion),
    };
    return json({ extraction: normalized }, 200);
  } catch (error) {
    console.error('receipt extraction failed', error);
    return json({ error: 'extraction_failed' }, 502);
  }
});
