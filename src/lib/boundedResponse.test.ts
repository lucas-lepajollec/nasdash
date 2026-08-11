import { describe, expect, it } from 'vitest';
import { readBoundedResponseBytes, ResponseTooLargeError } from './boundedResponse';

describe('bounded remote responses', () => {
  it('reads a response that stays within the limit', async () => {
    const response = new Response('calendar-data');

    const bytes = await readBoundedResponseBytes(response, 64);

    expect(new TextDecoder().decode(bytes)).toBe('calendar-data');
  });

  it('rejects a declared response that is too large', async () => {
    const response = new Response('ignored', {
      headers: { 'content-length': '4096' },
    });

    await expect(readBoundedResponseBytes(response, 1024)).rejects.toBeInstanceOf(ResponseTooLargeError);
  });

  it('stops a streamed response once its real size exceeds the limit', async () => {
    const response = new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(700));
        controller.enqueue(new Uint8Array(700));
        controller.close();
      },
    }));

    await expect(readBoundedResponseBytes(response, 1024)).rejects.toBeInstanceOf(ResponseTooLargeError);
  });
});
