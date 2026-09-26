import { decode } from 'base64-arraybuffer';
import * as Crypto from 'expo-crypto';
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { extractResponseSchema, type ReceiptExtraction } from '@/features/receipts/schema';

const BUCKET = 'receipts';

export type ReceiptErrorCode = 'offline' | 'rate_limited' | 'unauthorized' | 'failed';

/** Typed error so the UI can show the right message (offline vs failed vs limit). */
export class ReceiptError extends Error {
  constructor(public code: ReceiptErrorCode) {
    super(code);
    this.name = 'ReceiptError';
  }
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new ReceiptError('unauthorized');
  return data.user.id;
}

/** Send the image to the secure Edge Function and validate the structured result. */
export async function extractReceipt(input: {
  base64: string;
  mediaType: string;
}): Promise<ReceiptExtraction> {
  const { data, error } = await supabase.functions.invoke('extract-receipt', {
    body: { imageBase64: input.base64, mediaType: input.mediaType },
  });

  if (error) {
    if (error instanceof FunctionsFetchError) throw new ReceiptError('offline');
    if (error instanceof FunctionsHttpError) {
      try {
        const body: unknown = await (error.context as Response).json();
        const code = (body as { error?: string })?.error;
        if (code === 'rate_limited') throw new ReceiptError('rate_limited');
        if (code === 'unauthorized') throw new ReceiptError('unauthorized');
      } catch (parseError) {
        if (parseError instanceof ReceiptError) throw parseError;
      }
    }
    throw new ReceiptError('failed');
  }

  const parsed = extractResponseSchema.safeParse(data);
  if (!parsed.success) throw new ReceiptError('failed');
  return parsed.data.extraction;
}

/** Upload a receipt image to the private bucket at `{user_id}/{uuid}.jpg`. Returns the path. */
export async function uploadReceiptImage(base64: string): Promise<string> {
  const userId = await requireUserId();
  const path = `${userId}/${Crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, decode(base64), { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

/** Short-lived signed URL for viewing a private receipt image. */
export async function getSignedReceiptUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
  if (error || !data) throw new Error(error?.message ?? 'Could not load receipt');
  return data.signedUrl;
}
