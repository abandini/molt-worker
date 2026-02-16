import type { SidebandMessage } from '../types';

export interface ParsedIntent {
  type: string;
  entities: string[];
  confidence: number;
  transcript: string;
}

/**
 * Parses JSON sideband messages from brain-server and extracts structured intents.
 */
export function parseIntent(msg: SidebandMessage): ParsedIntent | null {
  if (msg.type !== 'intent') return null;

  const { intent_type, entities, confidence, transcript_segment } = msg.data;

  if (!intent_type || confidence === undefined) return null;

  return {
    type: intent_type,
    entities: entities ?? [],
    confidence,
    transcript: transcript_segment ?? '',
  };
}
