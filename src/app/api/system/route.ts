import { getSystemStats } from '@/lib/system';
import { incrementActiveClients, decrementActiveClients, readConfig } from '@/lib/config';
import { getSessionFromRequest } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const config = readConfig();

  // Bloquer l'accès en mode privé si non authentifié
  if (config.settings?.securityMode === 'private') {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
    }
  }

  const encoder = new TextEncoder();
  let active = true;

  incrementActiveClients();

  let interval: NodeJS.Timeout | any = null;
  const cleanup = () => {
    if (active) {
      active = false;
      decrementActiveClients();
      if (interval) clearInterval(interval);
    }
  };

  req.signal.addEventListener('abort', cleanup);

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        if (!active) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          active = false;
        }
      };

      // Send initial data immediately
      try {
        const stats = await getSystemStats();
        send(stats);
      } catch (err) {
        send({ error: 'Failed to get initial stats', details: String(err) });
      }

      // Then poll every 5 seconds
      interval = setInterval(async () => {
        if (!active) {
          if (interval) clearInterval(interval);
          return;
        }
        try {
          const stats = await getSystemStats();
          send(stats);
        } catch {
          // silently skip failed polls
        }
      }, 5000);

      // Cleanup when client disconnects
      setTimeout(() => {
        cleanup();
        try { controller.close(); } catch { /* ignore */ }
      }, 300000); // Max 5 min connection
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
