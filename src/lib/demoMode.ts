/**
 * Server-side switch for the public, isolated NasDash showcase.
 *
 * NASDASH_DEMO_MODE is evaluated at runtime so the same container image can be
 * deployed normally or as a demo without exposing the flag to browser bundles.
 */
export function isDemoMode(): boolean {
  return process.env.NASDASH_DEMO_MODE === 'true';
}
