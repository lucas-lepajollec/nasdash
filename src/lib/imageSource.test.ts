import { describe, expect, it } from 'vitest';
import { safeImageSource } from './imageSource';

describe('safe image sources', () => {
  it('accepts local paths and HTTP(S) URLs', () => {
    expect(safeImageSource('/api/logos/jellyfin.png')).toBe('/api/logos/jellyfin.png');
    expect(safeImageSource('https://cdn.example/logo.svg')).toBe('https://cdn.example/logo.svg');
  });

  it('rejects executable, opaque and credential-bearing sources', () => {
    expect(safeImageSource('javascript:alert(1)')).toBeUndefined();
    expect(safeImageSource('data:image/svg+xml,<svg onload=alert(1)>')).toBeUndefined();
    expect(safeImageSource('//evil.example/logo.png')).toBeUndefined();
    expect(safeImageSource('https://user:secret@example.com/logo.png')).toBeUndefined();
  });
});
