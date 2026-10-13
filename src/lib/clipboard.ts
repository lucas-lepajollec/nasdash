/** Copy a public UI value on both secure and ordinary LAN origins. */
export async function copyText(text: string): Promise<void> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return; }
  } catch { /* A browser permission may deny the modern API; try its native fallback. */ }
  const focused = document.activeElement as HTMLElement | null;
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.cssText = 'position:fixed;left:-9999px;top:0';
  document.body.appendChild(field);
  field.select();
  try { if (!document.execCommand('copy')) throw new Error('Clipboard unavailable'); }
  finally { field.remove(); focused?.focus(); }
}
