import type { ServiceBindings } from '../utils/service-bindings';
import * as svc from '../utils/service-bindings';
import type { Gap } from './gap-detector';

export type SynthesisLevel = 'L1_compose' | 'L2_synthesize';

export interface SynthesisResult {
  level: SynthesisLevel;
  success: boolean;
  description: string;
  data?: unknown;
}

/**
 * L1: Attempt to compose existing skills via DAG to fill the gap.
 * Queries skill-forge for existing skills that could be chained.
 */
async function tryL1Compose(
  gap: Gap,
  bindings: ServiceBindings,
): Promise<SynthesisResult> {
  const result = await svc.synthesizerExtract(bindings, gap.intentType);

  if (result.ok && result.data) {
    return {
      level: 'L1_compose',
      success: true,
      description: `Composed existing skills for "${gap.intentType}"`,
      data: result.data,
    };
  }

  return {
    level: 'L1_compose',
    success: false,
    description: `No existing skills found for "${gap.intentType}"`,
  };
}

/**
 * L2: Use Synthesizer pillar to create a new skill from scratch.
 */
async function tryL2Synthesize(
  gap: Gap,
  bindings: ServiceBindings,
): Promise<SynthesisResult> {
  const topic = `Create capability for intent "${gap.intentType}" handling entities: ${gap.entities.join(', ')}`;
  const result = await svc.synthesizerExtract(bindings, topic);

  if (result.ok && result.data) {
    return {
      level: 'L2_synthesize',
      success: true,
      description: `Synthesizer created new skill for "${gap.intentType}"`,
      data: result.data,
    };
  }

  return {
    level: 'L2_synthesize',
    success: false,
    description: `Synthesizer failed for "${gap.intentType}"`,
  };
}

/**
 * Attempt to fill a capability gap using skill composition or synthesis.
 * Returns the result of the first successful level.
 */
export async function synthesizeSkill(
  gap: Gap,
  bindings: ServiceBindings,
): Promise<SynthesisResult> {
  // Try L1 first (compose existing)
  const l1 = await tryL1Compose(gap, bindings);
  if (l1.success) return l1;

  // Try L2 (synthesize new)
  const l2 = await tryL2Synthesize(gap, bindings);
  return l2;
}
