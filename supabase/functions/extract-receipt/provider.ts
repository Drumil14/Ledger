import Anthropic from 'npm:@anthropic-ai/sdk';

import { CATEGORIES, receiptExtractionSchema, type ReceiptExtraction } from './schema.ts';

/** Provider abstraction so the AI backend can be swapped without touching callers. */
export interface ReceiptAIProvider {
  extractReceipt(input: { imageBase64: string; mediaType: string }): Promise<ReceiptExtraction>;
}

// Default to the most capable model; override with RECEIPT_AI_MODEL (e.g. a
// cheaper vision model) — that's an operator cost decision.
const MODEL = Deno.env.get('RECEIPT_AI_MODEL') ?? 'claude-opus-4-8';

const SYSTEM = `You extract structured data from a photo of a single receipt.

Return ONLY a JSON object. No markdown, no code fences, no commentary.

Schema:
{
  "merchant": string | null,
  "total": number | null,            // the FINAL charged total, not the subtotal
  "currency": string | null,          // ISO 4217 (e.g. "USD") if detectable, else null
  "transactionDate": string | null,   // "YYYY-MM-DD"
  "categorySuggestion": string | null,// EXACTLY one of the allowed categories
  "tax": number | null,
  "tip": number | null,
  "lineItems": [{ "name": string, "quantity": number | null, "price": number | null }] | null,
  "confidence": { "merchant": number, "total": number, "date": number } | null // 0..1
}

Rules:
- Never invent information. If a field is not clearly present, return null.
- Distinguish subtotal from the final total; always prefer the final charged total.
- If the date format is ambiguous (e.g. 09/04/26 vs 04/09/26), return null or a low date confidence rather than guessing.
- "categorySuggestion" MUST be exactly one of: ${CATEGORIES.join(', ')}. If unsure, use "Other". Never invent categories like "Coffee" or "Fast Food".
- Amounts are plain numbers (e.g. 47.82), no currency symbols.`;

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  // Strip accidental code fences, then take the first balanced {...} block.
  const withoutFences = trimmed.replace(/^```(?:json)?/i, '').replace(/```$/, '');
  const start = withoutFences.indexOf('{');
  const end = withoutFences.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON object in model response');
  }
  return JSON.parse(withoutFences.slice(start, end + 1));
}

export class AnthropicReceiptProvider implements ReceiptAIProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async extractReceipt({
    imageBase64,
    mediaType,
  }: {
    imageBase64: string;
    mediaType: string;
  }): Promise<ReceiptExtraction> {
    const message = await this.client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp',
                data: imageBase64,
              },
            },
            { type: 'text', text: 'Extract this receipt as JSON.' },
          ],
        },
      ],
    });

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    // Validate strictly — never trust the model output.
    return receiptExtractionSchema.parse(extractJsonObject(text));
  }
}
