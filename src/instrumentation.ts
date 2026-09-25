import { logger } from './lib/logger';

export async function register() {
  logger.init();
  // Device history needs polling even before the first browser connects.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startBackgroundMonitoring } = await import('./integrations/runtime');
    startBackgroundMonitoring();
  }
}
