import type { ServiceBindings } from '../utils/service-bindings';
import type { Gap } from './gap-detector';
import { synthesizeSkill, type SynthesisResult } from './skill-synthesizer';
import { storeProjectRequest, type ProjectRequest } from './project-spawner';

export type EscalationLevel = 'L1' | 'L2' | 'L3' | 'L4';

export interface EscalationResult {
  level: EscalationLevel;
  resolved: boolean;
  description: string;
  requiresNotification: boolean;
  data?: unknown;
}

/**
 * Escalation Ladder: attempts to resolve a capability gap through
 * increasingly expensive interventions.
 *
 * L1: DAG composition of existing skills
 * L2: Synthesizer creates new skill
 * L3: Store project request in D1 + push notification (human review)
 * L4: Always notify (critical unresolvable gap)
 */
export async function escalate(
  gap: Gap,
  bindings: ServiceBindings,
): Promise<EscalationResult> {
  // L1/L2: Automatic skill synthesis
  const synthesis = await synthesizeSkill(gap, bindings);

  if (synthesis.success) {
    return {
      level: synthesis.level === 'L1_compose' ? 'L1' : 'L2',
      resolved: true,
      description: synthesis.description,
      requiresNotification: false,
      data: synthesis.data,
    };
  }

  // L3: Store for human review + push notification
  const projectReq: ProjectRequest = {
    intentType: gap.intentType,
    entities: gap.entities,
    failureCount: gap.failureCount,
    errorPatterns: gap.errorPatterns,
    requestedAt: Date.now(),
  };

  storeProjectRequest(projectReq);

  if (gap.failureCount >= 10) {
    // L4: Critical gap - always notify urgently
    return {
      level: 'L4',
      resolved: false,
      description: `Critical capability gap: "${gap.intentType}" failed ${gap.failureCount} times. Requires immediate human attention.`,
      requiresNotification: true,
      data: projectReq,
    };
  }

  return {
    level: 'L3',
    resolved: false,
    description: `Stored project request for "${gap.intentType}". Push notification queued.`,
    requiresNotification: true,
    data: projectReq,
  };
}
