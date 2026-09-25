import { withScheme, type ConnectionField, type ConnectionInput } from './types';

/** Shared pieces of manifests: address + port, optional `user:password` credentials. */

/** `nas`, `http://nas`, `https://nas:443`… plus the port field → base URL without trailing slash. */
export function baseUrl(input: ConnectionInput, defaultPort?: string): string {
  const base = withScheme(input.ip);
  const port = input.port || defaultPort;
  try {
    const parsed = new URL(base);
    if (port) parsed.port = port;
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return port ? `${base}:${port}` : base;
  }
}

/** Stored as `user:password`; an empty password keeps the stored one. */
export function userPasswordToken(input: ConnectionInput, previousToken?: string): string | undefined {
  const colon = previousToken?.indexOf(':') ?? -1;
  const password = input.password || (colon !== -1 ? previousToken!.substring(colon + 1) : '');
  return input.username || password ? `${input.username || ''}:${password}` : undefined;
}

/** Splits a stored `user:password` token. */
export function splitUserPassword(token: string | undefined): { username: string; password: string } {
  const colon = token?.indexOf(':') ?? -1;
  return colon === -1 ? { username: token ?? '', password: '' } : { username: token!.slice(0, colon), password: token!.slice(colon + 1) };
}

export const addressField = (row = 0): ConnectionField => ({ id: 'ip', kind: 'address', label: 'IP (Hôte)', placeholder: 'ex: 192.168.1.10', required: true, row, flex: 3 });
export const portField = (defaultValue: string, row = 0): ConnectionField => ({ id: 'port', kind: 'text', label: 'Port', placeholder: `ex: ${defaultValue}`, required: true, defaultValue, row });
export const optionalCredentialFields = (row: number): ConnectionField[] => [
  { id: 'username', kind: 'text', label: 'Utilisateur (Si requis)', placeholder: 'Optionnel', row },
  { id: 'password', kind: 'secret', label: 'Mot de passe / Jeton', placeholder: 'Optionnel (Masqué)', row },
];
export const selfSignedField: ConnectionField = { id: 'allowSelfSigned', kind: 'toggle', label: 'integrations.allowSelfSigned', hint: 'integrations.allowSelfSignedHint', row: 9 };
