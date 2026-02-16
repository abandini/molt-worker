import { Env } from './types';

// Re-export Durable Object for wrangler to discover
export { VoiceSessionDO } from './gateway/voice-session';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
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
