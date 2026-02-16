/**
 * Analyzes intent dispatch failures to detect missing capabilities.
 * Tracks failed intents and surfaces patterns.
 */

export interface Gap {
  intentType: string;
  failureCount: number;
  lastSeen: number;
  entities: string[];
  errorPatterns: string[];
}

export class GapDetector {
  private gaps: Map<string, Gap> = new Map();

  /**
   * Record a failed intent dispatch.
   */
  recordFailure(
    intentType: string,
    entities: string[],
    error: string,
  ): void {
    const key = intentType;
    const existing = this.gaps.get(key);

    if (existing) {
      existing.failureCount++;
      existing.lastSeen = Date.now();
      for (const e of entities) {
        if (!existing.entities.includes(e)) existing.entities.push(e);
      }
      if (!existing.errorPatterns.includes(error)) {
        existing.errorPatterns.push(error);
      }
    } else {
      this.gaps.set(key, {
        intentType,
        failureCount: 1,
        lastSeen: Date.now(),
        entities: [...entities],
        errorPatterns: [error],
      });
    }
  }

  /**
   * Get gaps that have reached the failure threshold.
   */
  getSignificantGaps(threshold: number = 3): Gap[] {
    return Array.from(this.gaps.values())
      .filter(g => g.failureCount >= threshold)
      .sort((a, b) => b.failureCount - a.failureCount);
  }

  /**
   * Clear a gap after it has been resolved.
   */
  resolve(intentType: string): boolean {
    return this.gaps.delete(intentType);
  }

  /**
   * Get all tracked gaps for reporting.
   */
  getAll(): Gap[] {
    return Array.from(this.gaps.values());
  }
}
