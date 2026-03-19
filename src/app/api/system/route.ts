import { getSystemStats } from '@/lib/system';

export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();
  let active = true;

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

      // Then poll every 2 seconds
      const interval = setInterval(async () => {
        if (!active) {
          clearInterval(interval);
          return;
        }
        try {
          const stats = await getSystemStats();
          send(stats);
        } catch {
          // silently skip failed polls
        }
      }, 2000);

      // Cleanup when client disconnects
      setTimeout(() => {
        if (active) {
          active = false;
          clearInterval(interval);
          try { controller.close(); } catch { /* ignore */ }
        }
      }, 300000); // Max 5 min connection
    },
    cancel() {
      active = false;
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
