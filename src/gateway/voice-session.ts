import type { Env, SidebandMessage, VoiceSessionState } from '../types';
import { AudioRelay } from './audio-relay';

/**
 * Durable Object managing a single voice session.
 * Bridges client WebSocket <-> brain-server tunnel WebSocket.
 * Binary frames (audio) are relayed bidirectionally.
 * Text frames (JSON sideband) are intercepted for intent processing.
 */
export class VoiceSessionDO implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private sessionState: VoiceSessionState | null = null;
  private relay: AudioRelay | null = null;
  private clientWs: WebSocket | null = null;

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
      this.clientWs = server;

      this.sessionState = {
        userId: url.searchParams.get('userId') || 'anonymous',
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        frameCount: 0,
      };

      // Connect to brain-server via tunnel
      await this.connectRelay(server);

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('Not found', { status: 404 });
  }

  private async connectRelay(clientWs: WebSocket): Promise<void> {
    try {
      this.relay = new AudioRelay(this.env.BASEMENT_TUNNEL_URL);

      // Wire brain -> client relay
      this.relay.onAudioFromBrain = (data: ArrayBuffer) => {
        if (clientWs.readyState === WebSocket.READY_STATE_OPEN) {
          clientWs.send(data);
        }
      };

      this.relay.onSidebandFromBrain = (msg: SidebandMessage) => {
        if (clientWs.readyState === WebSocket.READY_STATE_OPEN) {
          clientWs.send(JSON.stringify(msg));
        }
      };

      this.relay.onStatus = (connected: boolean) => {
        console.log(`[VoiceSession] Brain relay ${connected ? 'connected' : 'disconnected'}`);
      };

      await this.relay.connect();
    } catch (err) {
      console.error('[VoiceSession] Failed to connect relay:', err);
      // Session continues without relay - client gets silence
      // Brain-server may be offline or tunnel not configured
    }
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void | Promise<void> {
    if (!this.sessionState) return;
    this.sessionState.lastActivity = Date.now();

    if (message instanceof ArrayBuffer) {
      // Binary audio: relay to brain
      this.sessionState.frameCount++;
      if (this.relay?.connected) {
        this.relay.sendAudioToBrain(message);
      } else {
        // Loopback echo when brain is not connected (dev mode)
        ws.send(message);
      }
    } else {
      // JSON sideband
      try {
        const sideband: SidebandMessage = JSON.parse(message);
        this.handleSideband(ws, sideband);
      } catch {
        // Ignore malformed JSON
      }
    }
  }

  private handleSideband(ws: WebSocket, msg: SidebandMessage): void {
    if (msg.data?.command === 'ping') {
      const response: SidebandMessage = {
        type: 'control',
        data: {
          command: 'stop',
          context_data: {
            pong: true,
            uptime: Date.now() - (this.sessionState?.connectedAt ?? Date.now()),
            frameCount: this.sessionState?.frameCount ?? 0,
            brainConnected: this.relay?.connected ?? false,
          },
        },
        timestamp: Date.now(),
      };
      ws.send(JSON.stringify(response));
    } else if (this.relay?.connected) {
      // Forward other sideband messages to brain
      this.relay.sendSidebandToBrain(msg);
    }
  }

  webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): void | Promise<void> {
    this.cleanup();
  }

  webSocketError(ws: WebSocket, error: unknown): void | Promise<void> {
    this.cleanup();
  }

  private cleanup(): void {
    if (this.relay) {
      this.relay.disconnect();
      this.relay = null;
    }
    this.clientWs = null;
    this.sessionState = null;
  }
}
