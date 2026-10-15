export class ResponseTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super(`Remote response exceeds ${maxBytes} bytes`);
    this.name = 'ResponseTooLargeError';
  }
}

export async function readBoundedResponseBytes(
  response: Response,
  maxBytes: number,
  /** Keep the first `maxBytes` and stop reading, instead of failing (an HTML page's head). */
  truncate = false,
): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (!truncate && Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new ResponseTooLargeError(maxBytes);
  }

  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (truncate && totalBytes + value.byteLength >= maxBytes) {
      chunks.push(value.subarray(0, maxBytes - totalBytes));
      totalBytes = maxBytes;
      await reader.cancel();
      break;
    }
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new ResponseTooLargeError(maxBytes);
    }
    chunks.push(value);
  }

  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}
