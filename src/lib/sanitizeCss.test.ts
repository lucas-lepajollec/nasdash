import { describe, expect, it } from 'vitest';
import { CUSTOM_CSS_MAX_LENGTH, isCustomCssSafeMode, sanitizeCustomCss } from './sanitizeCss';

describe('custom CSS safety', () => {
  it('keeps normal theme variables while removing comments', () => {
    expect(sanitizeCustomCss('/* theme */ :root { --nd-accent: #7c3aed; }')).toBe(
      ' :root { --nd-accent: #7c3aed; }',
    );
  });

  it('neutralizes HTML breakouts and executable CSS values', () => {
    const sanitized = sanitizeCustomCss(
      '</style><script>alert(1)</script>.x{background:url(javascript:alert(1));behavior:url(x)}',
    );

    expect(sanitized).not.toContain('</style');
    expect(sanitized).not.toContain('<script');
    expect(sanitized).not.toContain('javascript:');
    expect(sanitized).not.toMatch(/(?:^|[;{])\s*behavior\s*:/i);
  });

  it('enforces the same size limit exposed by the editor', () => {
    expect(sanitizeCustomCss('a'.repeat(CUSTOM_CSS_MAX_LENGTH + 10))).toHaveLength(CUSTOM_CSS_MAX_LENGTH);
  });

  it('enables safe mode only for the explicit query value', () => {
    expect(isCustomCssSafeMode('?safe-css=1')).toBe(true);
    expect(isCustomCssSafeMode('?tab=home&safe-css=1')).toBe(true);
    expect(isCustomCssSafeMode('?safe-css=0')).toBe(false);
    expect(isCustomCssSafeMode('?safe-css=true')).toBe(false);
  });
});
