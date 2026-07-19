import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from './crypto';

describe('Crypto Utility Tests', () => {
  it('should encrypt and decrypt a string successfully', () => {
    const originalText = 'SuperSecretDockerPassword123!';
    const encrypted = encrypt(originalText);
    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe(originalText);
    expect(encrypted.startsWith('enc:aes256:')).toBe(true);

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(originalText);
  });

  it('should return plain text if string is not encrypted', () => {
    const plainText = 'normal_text';
    expect(decrypt(plainText)).toBe(plainText);
  });

  it('should return original text if the format matches enc:aes256 but is invalid, or return empty string for failed decryption', () => {
    expect(decrypt('enc:aes256:invalid:format')).toBe('enc:aes256:invalid:format');
    expect(decrypt('enc:aes256:123456781234567812345678:123456781234567812345678:12345678')).toBe('');
  });
});
