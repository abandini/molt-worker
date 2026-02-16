import type { ParsedIntent } from './intent-interceptor';
import type { ServiceBindings } from '../utils/service-bindings';
import * as svc from '../utils/service-bindings';

export interface RouteResult {
  intent: string;
  results: Array<{ ok: boolean; data?: unknown; error?: string; source: string }>;
}

/**
 * Routes parsed intents to the appropriate service binding calls.
 * Returns a RouteResult with aggregated responses.
 */
export async function routeIntent(
  intent: ParsedIntent,
  bindings: ServiceBindings,
): Promise<RouteResult> {
  const entity = intent.entities[0] ?? '';

  switch (intent.type) {
    case 'project_status':
      return {
        intent: 'project_status',
        results: [
          await svc.getProjectStatus(bindings, entity),
        ],
      };

    case 'brainstorm':
      // Query both Coach agent and BillMem for context
      return {
        intent: 'brainstorm',
        results: await Promise.all([
          svc.chatWithOrchestrator(bindings, intent.transcript, 'molt-voice'),
          svc.billMemRecall(bindings, intent.transcript),
        ]),
      };

    case 'deploy':
      return {
        intent: 'deploy',
        results: [
          await svc.getWorkflows(bindings),
        ],
      };

    case 'remember':
      return {
        intent: 'remember',
        results: [
          await svc.billMemIngest(bindings, intent.transcript, 'voice-command'),
        ],
      };

    case 'research':
      // Query multiple pillars in parallel
      return {
        intent: 'research',
        results: await Promise.all([
          svc.billMemRecall(bindings, intent.transcript),
          svc.synthesizerExtract(bindings, entity || intent.transcript),
          svc.worldModelSummary(bindings),
        ]),
      };

    case 'command':
      return {
        intent: 'command',
        results: [
          await svc.chatWithOrchestrator(bindings, intent.transcript, 'molt-voice'),
        ],
      };

    case 'question':
      return {
        intent: 'question',
        results: await Promise.all([
          svc.chatWithOrchestrator(bindings, intent.transcript, 'molt-voice'),
          svc.billMemRecall(bindings, intent.transcript),
        ]),
      };

    default:
      return {
        intent: intent.type,
        results: [
          await svc.chatWithOrchestrator(bindings, intent.transcript, 'molt-voice'),
        ],
      };
  }
}
