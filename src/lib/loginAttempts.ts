/** Account-based failed-attempt quota is independent of untrusted forwarding headers. */
const attempts = new Map<string, { failures: number; until: number }>();
export function loginBlocked(username: string, now = Date.now()): boolean {
  const item = attempts.get(username.toLowerCase());
  if (item && now >= item.until) { attempts.delete(username.toLowerCase()); return false; }
  return Boolean(item && item.failures >= 10);
}
export function recordFailedLogin(username: string, now = Date.now()): void {
  for (const [key, item] of attempts) if (now >= item.until) attempts.delete(key);
  // Bound the total table; never evict an active protected account to accept junk identities.
  if (attempts.size >= 1000 && !attempts.has(username.toLowerCase())) return;
  const key = username.toLowerCase();
  const current = attempts.get(key) ?? { failures: 0, until: now + 60000 };
  current.failures++;
  attempts.set(key, current);
}
export function clearLoginFailures(username: string): void { attempts.delete(username.toLowerCase()); }
