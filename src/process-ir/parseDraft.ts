import type { ParsedDraftResult } from './types';

function extractJsonObject(text: string): string {
  const trimmed = text.trim();

  if (trimmed.startsWith('{')) {
    return trimmed;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

export function parseProcessIrDraft(text: string): ParsedDraftResult {
  const rawJson = extractJsonObject(text);

  try {
    return {
      success: true,
      rawJson,
      value: JSON.parse(rawJson),
    };
  } catch {
    return {
      success: false,
      rawJson,
      errors: ['LLM returned invalid JSON'],
    };
  }
}
