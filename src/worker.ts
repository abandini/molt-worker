import { Env, SidebandMessage, VoiceSessionState } from './types';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export class VoiceSessionDO implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private sessionState: VoiceSessionState | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/ws') {
      const upgradeHeader = request.headers.get('Upgrade');
      if (!upgradeHeader || upgradeHeader !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.state.acceptWebSocket(server);

      this.sessionState = {
        userId: url.searchParams.get('userId') || 'anonymous',
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        frameCount: 0,
      };

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('Not found', { status: 404 });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void | Promise<void> {
    if (!this.sessionState) return;
    this.sessionState.lastActivity = Date.now();

    if (message instanceof ArrayBuffer) {
      this.sessionState.frameCount++;
      ws.send(message);
    } else {
      try {
        const sideband: SidebandMessage = JSON.parse(message);
        if (sideband.data?.command === 'ping') {
          const response: SidebandMessage = {
            type: 'control',
            data: {
              command: 'stop',
              context_data: {
                pong: true,
                uptime: Date.now() - this.sessionState.connectedAt,
                frameCount: this.sessionState.frameCount,
              },
            },
            timestamp: Date.now(),
          };
          ws.send(JSON.stringify(response));
        }
      } catch {
        // Ignore malformed JSON
      }
    }
  }

  webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): void | Promise<void> {
    this.sessionState = null;
  }

  webSocketError(ws: WebSocket, error: unknown): void | Promise<void> {
    this.sessionState = null;
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return json({
        status: 'ok',
        service: 'molt-worker',
        timestamp: new Date().toISOString(),
      });
    }

    if (url.pathname === '/ws/voice') {
      const userId = url.searchParams.get('userId') || 'anonymous';
      const id = env.VOICE_SESSION.idFromName(userId);
      const stub = env.VOICE_SESSION.get(id);
      return stub.fetch(
        new Request(new URL('/ws', request.url).toString(), request),
      );
    }

    if (url.pathname === '/webhook/telegram' && request.method === 'POST') {
      return json({ ok: true, message: 'Telegram webhook stub - not yet implemented' });
    }

    return json({ error: 'Not found' }, 404);
  },

  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    console.log(`[Heartbeat] Cron fired at ${new Date().toISOString()}`);
  },
} satisfies ExportedHandler<Env>;
