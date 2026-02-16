/**
 * Parse HEARTBEAT.md into structured check items with frequency tags.
 */

export type Frequency = 'always' | 'daily' | 'weekly';

export interface HeartbeatCheck {
  description: string;
  frequency: Frequency;
  checked: boolean;
}

/**
 * Parse a HEARTBEAT.md markdown string into structured checks.
 * Expects sections with ## Always, ## Daily, ## Weekly headers
 * and checkbox items (- [ ] or - [x]).
 */
export function parseHeartbeatConfig(markdown: string): HeartbeatCheck[] {
  const checks: HeartbeatCheck[] = [];
  let currentFrequency: Frequency = 'always';

  for (const line of markdown.split('\n')) {
    const trimmed = line.trim();

    // Detect frequency headers
    if (/^##\s+always/i.test(trimmed)) {
      currentFrequency = 'always';
      continue;
    }
    if (/^##\s+daily/i.test(trimmed)) {
      currentFrequency = 'daily';
      continue;
    }
    if (/^##\s+weekly/i.test(trimmed)) {
      currentFrequency = 'weekly';
      continue;
    }

    // Parse checkbox items
    const checkboxMatch = trimmed.match(/^-\s+\[([ xX])\]\s+(.+)$/);
    if (checkboxMatch) {
      checks.push({
        description: checkboxMatch[2].trim(),
        frequency: currentFrequency,
        checked: checkboxMatch[1] !== ' ',
      });
    }
  }

  return checks;
}

/**
 * Filter checks that should run at the given interval.
 * - "always" checks run every 30 minutes
 * - "daily" checks run once per day (first heartbeat after midnight UTC)
 * - "weekly" checks run once per week (first heartbeat after Sunday midnight UTC)
 */
export function getActiveChecks(
  checks: HeartbeatCheck[],
  frequency: Frequency,
): HeartbeatCheck[] {
  const priorities: Record<Frequency, number> = { always: 0, daily: 1, weekly: 2 };
  const threshold = priorities[frequency];

  return checks.filter(c => priorities[c.frequency] <= threshold);
}
