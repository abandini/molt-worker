export type SidebandType = 'intent' | 'context' | 'control' | 'transcript';

export interface SidebandMessage {
  type: SidebandType;
  data: {
    intent_type?: string;
    entities?: string[];
    confidence?: number;
    transcript_segment?: string;
    context_data?: Record<string, unknown>;
    command?: 'start' | 'stop' | 'ping';
  };
  timestamp: number;
}

export interface VoiceSessionState {
  userId: string;
  connectedAt: number;
  lastActivity: number;
  frameCount: number;
}

export interface Env {
  VOICE_SESSION: DurableObjectNamespace;
  BASEMENT_TUNNEL_URL: string;
  // Service Bindings (optional until deployed together)
  AI_COFOUNDER?: Fetcher;
  SKILL_FORGE?: Fetcher;
  // Storage
  DB: D1Database;
  CACHE: KVNamespace;
  STORAGE: R2Bucket;
}
