export type JsonObject = Record<string, unknown>;

export class RequestValidationError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'RequestValidationError';
    this.status = status;
  }
}

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function readJsonObject(request: Request, maxBytes: number): Promise<JsonObject> {
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const declaredBytes = Number(contentLength);
    if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
      throw new RequestValidationError('La requête dépasse la taille autorisée.', 413);
    }
  }

  if (!request.body) {
    throw new RequestValidationError('Le corps JSON est requis.');
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let rawBody = '';
  let receivedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    receivedBytes += value.byteLength;
    if (receivedBytes > maxBytes) {
      await reader.cancel();
      throw new RequestValidationError('La requête dépasse la taille autorisée.', 413);
    }
    rawBody += decoder.decode(value, { stream: true });
  }
  rawBody += decoder.decode();

  if (!rawBody.trim()) {
    throw new RequestValidationError('Le corps JSON est requis.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new RequestValidationError('Le corps JSON est invalide.');
  }

  if (!isJsonObject(parsed)) {
    throw new RequestValidationError('Le corps JSON doit être un objet.');
  }

  return parsed;
}

interface StringOptions {
  required?: boolean;
  minLength?: number;
  maxLength: number;
  trim?: boolean;
}

export function readString(
  object: JsonObject,
  key: string,
  options: StringOptions,
): string | undefined {
  const value = object[key];
  if (value === undefined || value === null) {
    if (options.required) throw new RequestValidationError(`Le champ « ${key} » est requis.`);
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new RequestValidationError(`Le champ « ${key} » doit être une chaîne de caractères.`);
  }

  const normalized = options.trim === false ? value : value.trim();
  if (options.required && normalized.length === 0) {
    throw new RequestValidationError(`Le champ « ${key} » est requis.`);
  }
  if (options.minLength !== undefined && normalized.length < options.minLength) {
    throw new RequestValidationError(`Le champ « ${key} » est trop court.`);
  }
  if (normalized.length > options.maxLength) {
    throw new RequestValidationError(`Le champ « ${key} » dépasse la taille autorisée.`);
  }
  return normalized;
}

export function readBoolean(object: JsonObject, key: string): boolean | undefined {
  const value = object[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') {
    throw new RequestValidationError(`Le champ « ${key} » doit être un booléen.`);
  }
  return value;
}

export function readEnum<const T extends readonly string[]>(
  object: JsonObject,
  key: string,
  values: T,
  required = false,
): T[number] | undefined {
  const value = readString(object, key, { required, maxLength: 128 });
  if (value === undefined) return undefined;
  if (!values.includes(value)) {
    throw new RequestValidationError(`Le champ « ${key} » contient une valeur invalide.`);
  }
  return value as T[number];
}

interface StringArrayOptions {
  maxItems: number;
  maxItemLength: number;
}

export function readStringArray(
  object: JsonObject,
  key: string,
  options: StringArrayOptions,
): string[] | undefined {
  const value = object[key];
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    throw new RequestValidationError(`Le champ « ${key} » doit être une liste de chaînes de caractères.`);
  }
  if (value.length > options.maxItems) {
    throw new RequestValidationError(`Le champ « ${key} » contient trop d’éléments.`);
  }

  const normalized = value.map(item => item.trim());
  if (normalized.some(item => item.length === 0 || item.length > options.maxItemLength)) {
    throw new RequestValidationError(`Le champ « ${key} » contient un élément invalide.`);
  }
  return [...new Set(normalized)];
}

export function readObject(object: JsonObject, key: string): JsonObject | undefined {
  const value = object[key];
  if (value === undefined || value === null) return undefined;
  if (!isJsonObject(value)) {
    throw new RequestValidationError(`Le champ « ${key} » doit être un objet.`);
  }
  return value;
}

export function assertSafeIdentifier(value: string, label = 'identifiant'): string {
  if (value.length > 128 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new RequestValidationError(`L’${label} est invalide.`);
  }
  return value;
}
