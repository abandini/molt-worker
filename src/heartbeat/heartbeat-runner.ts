import type { Env } from '../types';
import { parseHeartbeatConfig, getActiveChecks, type Frequency } from './heartbeat-config';
import { aggregateSignals, type SignalReport } from './signal-aggregator';

export interface HeartbeatResult {
  timestamp: number;
  frequency: Frequency;
  checksRun: number;
  signals: SignalReport;
  actions: string[];
  noteworthy: boolean;
}

// Default HEARTBEAT.md content (used when R2 is not configured)
const DEFAULT_HEARTBEAT = `
## Always (every 30 min)
- [ ] Check brain-server tunnel connectivity
- [ ] Check active voice session count
- [ ] Report system health to Watchdog

## Daily
- [ ] Verify PersonaPlex model loaded on brain-server
- [ ] Review conversation logs for quality
- [ ] Check cost/usage metrics

## Weekly
- [ ] Rotate transcript archive
- [ ] Review escalation ladder performance
- [ ] Update knowledge cache
`;

/**
 * Determine the heartbeat frequency based on current time.
 */
function determineFrequency(): Frequency {
  const now = new Date();
  const hour = now.getUTCHours();
  const day = now.getUTCDay();

  // Weekly: Sunday at first heartbeat (0-1 AM UTC)
  if (day === 0 && hour < 1) return 'weekly';

  // Daily: first heartbeat after midnight UTC (0-1 AM)
  if (hour < 1) return 'daily';

  return 'always';
}

/**
 * Run the heartbeat: load config, aggregate signals, decide actions.
 */
export async function runHeartbeat(env: Env): Promise<HeartbeatResult> {
  const frequency = determineFrequency();

  // Parse heartbeat config
  const config = parseHeartbeatConfig(DEFAULT_HEARTBEAT);
  const activeChecks = getActiveChecks(config, frequency);

  // Aggregate signals from pillars
  const signals = await aggregateSignals(
    {
      AI_COFOUNDER: env.AI_COFOUNDER,
      SKILL_FORGE: env.SKILL_FORGE,
    },
    env.BASEMENT_TUNNEL_URL,
  );

  // Decide actions based on signals
  const actions: string[] = [];
  let noteworthy = false;

  if (!signals.brainHealth.ok) {
    actions.push(`Brain-server offline: ${signals.brainHealth.error}`);
    noteworthy = true;
  }

  if (signals.watchdogSignals.ok && signals.watchdogSignals.data) {
    actions.push('Watchdog signals received');
  }

  if (signals.pendingApprovals.ok && signals.pendingApprovals.data) {
    actions.push('Pending approvals available');
    noteworthy = true;
  }

  const result: HeartbeatResult = {
    timestamp: Date.now(),
    frequency,
    checksRun: activeChecks.length,
    signals,
    actions,
    noteworthy,
  };

  console.log(
    `[Heartbeat] ${frequency} | ${activeChecks.length} checks | ${actions.length} actions | noteworthy=${noteworthy}`,
  );

  return result;
}
