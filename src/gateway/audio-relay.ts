import type { SidebandMessage } from '../types';

export type RelayAudioCallback = (data: ArrayBuffer) => void;
export type RelaySidebandCallback = (msg: SidebandMessage) => void;
export type RelayStatusCallback = (connected: boolean) => void;

/**
 * Opens a WebSocket to the Basement Brain tunnel and relays audio frames
 * bidirectionally between the client and the brain-server.
 *
 * Uses Cloudflare Workers fetch-based WebSocket API (not browser WebSocket).
 */
export class AudioRelay {
  private ws: WebSocket | null = null;
  private tunnelWsUrl: string;

  onAudioFromBrain: RelayAudioCallback | null = null;
  onSidebandFromBrain: RelaySidebandCallback | null = null;
  onStatus: RelayStatusCallback | null = null;

  constructor(tunnelBaseUrl: string) {
    // Convert HTTP URL to WebSocket path
    const url = new URL(tunnelBaseUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/ws/voice';
    this.tunnelWsUrl = url.toString();
  }

  /**
   * Connect to brain-server via fetch-based WebSocket (Workers runtime).
   * In CF Workers, you use fetch() with Upgrade: websocket to establish
   * a WebSocket to an upstream server.
   */
  async connect(): Promise<void> {
    const resp = await fetch(this.tunnelWsUrl, {
      headers: { Upgrade: 'websocket' },
    });

    const ws = resp.webSocket;
    if (!ws) {
      throw new Error('Brain tunnel did not return WebSocket');
    }

    ws.accept();
    this.ws = ws;
    this.onStatus?.(true);

    ws.addEventListener('message', (event: MessageEvent) => {
      if (event.data instanceof ArrayBuffer) {
        this.onAudioFromBrain?.(event.data);
      } else if (typeof event.data === 'string') {
        try {
          const msg: SidebandMessage = JSON.parse(event.data);
          this.onSidebandFromBrain?.(msg);
        } catch {
          console.error('[Relay] Invalid sideband from brain:', event.data);
        }
      }
    });

    ws.addEventListener('close', () => {
      this.ws = null;
      this.onStatus?.(false);
    });

    ws.addEventListener('error', () => {
      this.ws = null;
      this.onStatus?.(false);
    });
  }

  sendAudioToBrain(data: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.READY_STATE_OPEN) {
      this.ws.send(data);
    }
  }

  sendSidebandToBrain(msg: SidebandMessage): void {
    if (this.ws?.readyState === WebSocket.READY_STATE_OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.onStatus?.(false);
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.READY_STATE_OPEN;
  }
}
