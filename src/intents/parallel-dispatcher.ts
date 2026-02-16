import type { SidebandMessage } from '../types';
import type { ServiceBindings } from '../utils/service-bindings';
import { parseIntent } from './intent-interceptor';
import { routeIntent, type RouteResult } from './command-router';

/**
 * Full intent dispatch pipeline:
 * 1. Parse sideband message into structured intent
 * 2. Route to appropriate service binding calls (parallel where possible)
 * 3. Package results as context sideband message for brain-server
 */
export async function dispatchIntent(
  msg: SidebandMessage,
  bindings: ServiceBindings,
): Promise<SidebandMessage | null> {
  const intent = parseIntent(msg);
  if (!intent) return null;

  const routeResult = await routeIntent(intent, bindings);

  return packageResult(routeResult);
}

function packageResult(result: RouteResult): SidebandMessage {
  // Collect successful data
  const contextData: Record<string, unknown> = {
    intent: result.intent,
    responses: result.results
      .filter(r => r.ok)
      .map(r => ({ source: r.source, data: r.data })),
    errors: result.results
      .filter(r => !r.ok)
      .map(r => ({ source: r.source, error: r.error })),
  };

  return {
    type: 'context',
    data: {
      intent_type: result.intent,
      context_data: contextData,
    },
    timestamp: Date.now(),
  };
}
