/**
 * L3 stub: stores project requests for human review.
 * In production, these would be stored in D1 and trigger push notifications.
 * Full Claude Code integration is a future capability.
 */

export interface ProjectRequest {
  intentType: string;
  entities: string[];
  failureCount: number;
  errorPatterns: string[];
  requestedAt: number;
}

// In-memory store for now; will use D1 in production
const pendingRequests: ProjectRequest[] = [];

export function storeProjectRequest(request: ProjectRequest): void {
  pendingRequests.push(request);
  console.log(
    `[ProjectSpawner] Stored request: ${request.intentType} (${request.failureCount} failures)`,
  );
}

export function getPendingRequests(): ProjectRequest[] {
  return [...pendingRequests];
}

export function clearRequest(index: number): boolean {
  if (index >= 0 && index < pendingRequests.length) {
    pendingRequests.splice(index, 1);
    return true;
  }
  return false;
}
