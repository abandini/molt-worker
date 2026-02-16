/**
 * Typed fetch wrappers for Service Binding calls to ai_cofounder and skill-forge.
 * Service Bindings provide zero-latency Worker-to-Worker calls within the same account.
 *
 * When service bindings are not yet configured (dev mode), these return
 * stub responses indicating the service is unavailable.
 */

export interface ServiceBindings {
  AI_COFOUNDER?: Fetcher;
  SKILL_FORGE?: Fetcher;
}

interface ServiceResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  source: string;
}

async function callService<T>(
  fetcher: Fetcher | undefined,
  path: string,
  options: RequestInit = {},
): Promise<ServiceResponse<T>> {
  if (!fetcher) {
    return { ok: false, error: 'Service binding not configured', source: path };
  }

  try {
    const resp = await fetcher.fetch(`https://internal${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!resp.ok) {
      return { ok: false, error: `HTTP ${resp.status}`, source: path };
    }

    const data = await resp.json() as T;
    return { ok: true, data, source: path };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      source: path,
    };
  }
}

// --- ai_cofounder service calls ---

export function chatWithOrchestrator(
  bindings: ServiceBindings,
  message: string,
  userId: string,
): Promise<ServiceResponse> {
  return callService(bindings.AI_COFOUNDER, '/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message, userId }),
  });
}

export function getProjectStatus(
  bindings: ServiceBindings,
  projectName: string,
): Promise<ServiceResponse> {
  return callService(bindings.AI_COFOUNDER, `/api/projects?name=${encodeURIComponent(projectName)}`);
}

export function getWorkflows(bindings: ServiceBindings): Promise<ServiceResponse> {
  return callService(bindings.AI_COFOUNDER, '/api/workflows');
}

export function getApprovals(bindings: ServiceBindings): Promise<ServiceResponse> {
  return callService(bindings.AI_COFOUNDER, '/api/approvals');
}

// --- skill-forge service calls ---

export function billMemRecall(
  bindings: ServiceBindings,
  query: string,
): Promise<ServiceResponse> {
  return callService(bindings.SKILL_FORGE, '/api/pillars/billmem/recall', {
    method: 'POST',
    body: JSON.stringify({ query }),
  });
}

export function billMemIngest(
  bindings: ServiceBindings,
  content: string,
  source: string,
): Promise<ServiceResponse> {
  return callService(bindings.SKILL_FORGE, '/api/pillars/billmem/ingest', {
    method: 'POST',
    body: JSON.stringify({ content, source }),
  });
}

export function worldModelSummary(bindings: ServiceBindings): Promise<ServiceResponse> {
  return callService(bindings.SKILL_FORGE, '/api/pillars/worldmodel/summary');
}

export function repoRadarPatterns(bindings: ServiceBindings): Promise<ServiceResponse> {
  return callService(bindings.SKILL_FORGE, '/api/pillars/reporadar/patterns');
}

export function watchdogSignals(bindings: ServiceBindings): Promise<ServiceResponse> {
  return callService(bindings.SKILL_FORGE, '/api/pillars/watchdog/signals');
}

export function synthesizerExtract(
  bindings: ServiceBindings,
  topic: string,
): Promise<ServiceResponse> {
  return callService(bindings.SKILL_FORGE, '/api/pillars/synthesizer/extract', {
    method: 'POST',
    body: JSON.stringify({ topic }),
  });
}
