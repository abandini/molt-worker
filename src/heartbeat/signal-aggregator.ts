import type { ServiceBindings } from '../utils/service-bindings';
import * as svc from '../utils/service-bindings';

export interface SignalReport {
  timestamp: number;
  brainHealth: { ok: boolean; error?: string };
  watchdogSignals: { ok: boolean; data?: unknown; error?: string };
  repoRadar: { ok: boolean; data?: unknown; error?: string };
  worldModel: { ok: boolean; data?: unknown; error?: string };
  pendingApprovals: { ok: boolean; data?: unknown; error?: string };
}

/**
 * Query pillars via service bindings and aggregate into a signal report.
 * All queries run in parallel for speed.
 */
export async function aggregateSignals(
  bindings: ServiceBindings,
  tunnelUrl: string,
): Promise<SignalReport> {
  // Check brain-server health
  const brainHealthPromise = checkBrainHealth(tunnelUrl);

  // Query pillars in parallel
  const [brainHealth, watchdog, repoRadar, worldModel, approvals] = await Promise.all([
    brainHealthPromise,
    svc.watchdogSignals(bindings),
    svc.repoRadarPatterns(bindings),
    svc.worldModelSummary(bindings),
    svc.getApprovals(bindings),
  ]);

  return {
    timestamp: Date.now(),
    brainHealth,
    watchdogSignals: watchdog,
    repoRadar: repoRadar,
    worldModel: worldModel,
    pendingApprovals: approvals,
  };
}

async function checkBrainHealth(
  tunnelUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = new URL(tunnelUrl);
    url.pathname = '/api/status';

    const resp = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10_000),
    });

    if (!resp.ok) {
      return { ok: false, error: `HTTP ${resp.status}` };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Brain unreachable',
    };
  }
}
