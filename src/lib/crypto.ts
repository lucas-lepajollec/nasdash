import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { safeWriteFileSync } from './config';

const KEY_FILE = path.join(process.cwd(), 'data', 'encryption.key');

/**
 * Obtient ou génère une clé de chiffrement stable persistée sur le disque
 * (dans le volume monté /data) s'il n'y a pas de NASDASH_JWT_SECRET défini.
 */
function getEncryptionKey(): Buffer {
  let secret = process.env.NASDASH_JWT_SECRET;
  
  if (!secret) {
    try {
      if (fs.existsSync(KEY_FILE)) {
        secret = fs.readFileSync(KEY_FILE, 'utf-8').trim();
      } else {
        secret = crypto.randomBytes(32).toString('hex');
        const dir = path.dirname(KEY_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        safeWriteFileSync(KEY_FILE, secret, 'utf-8');
      }
    } catch (e) {
      console.error('⚠️ ERREUR CRITIQUE : Impossible de lire ou d\'écrire la clé de chiffrement persistée.', e);
      throw new Error(
        "Sécurité compromise : Impossible d'accéder au fichier de clé de chiffrement (encryption.key) " +
        "et aucun secret NASDASH_JWT_SECRET n'est configuré dans l'environnement."
      );
    }
  }

  // Dérivation d'une clé de 32 octets (256 bits)
  return crypto.scryptSync(secret, 'nasdash-salt-v1', 32);
}

const ALGORITHM = 'aes-256-gcm';

/**
 * Chiffre une chaîne de caractères en AES-256-GCM.
 */
export function encrypt(text: string): string {
  if (!text || text.startsWith('enc:aes256:')) return text;
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag().toString('hex');
    
    // Format : enc:aes256:iv:tag:encrypted_text
    return `enc:aes256:${iv.toString('hex')}:${tag}:${encrypted}`;
  } catch (e) {
    console.error('Erreur de chiffrement :', e);
    // Ne jamais enregistrer silencieusement un secret en clair.
    throw e instanceof Error ? e : new Error('Impossible de chiffrer la valeur sensible.');
  }
}

/**
 * Déchiffre une chaîne chiffrée en AES-256-GCM.
 */
export function decrypt(text: string): string {
  if (!text || !text.startsWith('enc:aes256:')) return text;
  try {
    const parts = text.split(':');
    if (parts.length !== 5) return text;
    
    const [, , ivHex, tagHex, encryptedText] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    if (iv.length !== 12 || tag.length !== 16 || !/^(?:[0-9a-f]{2})+$/i.test(encryptedText)) {
      return '';
    }
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: 16 });
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (e) {
    console.error('Échec du déchiffrement (la clé a peut-être changé) :', e);
    return ''; // Retourne vide pour masquer ou éviter l'affichage de valeurs corrompues
  }
}
