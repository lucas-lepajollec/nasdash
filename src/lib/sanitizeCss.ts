/**
 * Sanitisation du CSS personnalisé fourni par l'utilisateur.
 *
 * Le champ `settings.customCss` est rendu comme contenu texte d'un élément
 * `<style>`. Le caractère `<` est néanmoins échappé au format CSS afin que la
 * valeur reste sûre si le mode de rendu change un jour.
 *
 * Stratégie : on neutralise tous les vecteurs de breakout et les
 * constructions CSS historiquement dangereuses. On agit à l'écriture
 * (route API) ET au rendu (ConfigProvider) pour défense en profondeur.
 */

/**
 * Liste de substitutions pour neutraliser le CSS utilisateur.
 * Ordre important : on retire d'abord les commentaires (qui peuvent
 * servir à masquer des payloads), puis les balises de breakout.
 */
const CSS_SANITIZER_RULES: { pattern: RegExp; replacement: string }[] = [
  // 1. Commentaires CSS /* ... */ — peuvent cacher des payloads et tromper les regex suivantes
  { pattern: /\/\*[\s\S]*?\*\//g, replacement: '' },
  // 2. Neutralise tout début de balise avec l'échappement CSS du caractère `<`.
  { pattern: /</g, replacement: '\\3C ' },
];

/**
 * Patterns de constructions CSS dangereuses à neutraliser.
 * `javascript:`, `vbscript:`, `expression()` (IE), `-moz-binding` (XBL, Firefox ancien).
 */
const DANGEROUS_CSS_VALUE_RULES: { pattern: RegExp; replacement: string }[] = [
  // url(javascript:...) et url(vbscript:...) dans toute déclaration url()
  { pattern: /(url\s*\(\s*['"]?\s*)(javascript|vbscript|data|mocha|livescript):/gi, replacement: '$1blocked:' },
  // expression(...) — exécution de script via CSS (IE)
  { pattern: /expression\s*\(/gi, replacement: 'blocked(' },
  // -moz-binding: url(...) — chargement XBL (Firefox ancien)
  { pattern: /-moz-binding\s*:/gi, replacement: 'blocked-moz-binding:' },
  // behavior: url(...) — HTC behaviors (IE)
  { pattern: /behavior\s*:/gi, replacement: 'blocked-behavior:' },
  // @import url(...) hors-data — permet de charger des feuilles externes
  { pattern: /@import\s+(?!url\s*\(\s*['"]?\/)/gi, replacement: '@import blocked ' },
];

/**
 * Sanitise une chaîne CSS destinée à être injectée dans un <style>.
 * Retourne une version sûre (commentaires retirés, breakouts neutralisés,
 * constructions dangereuses bloquées).
 */
export const CUSTOM_CSS_MAX_LENGTH = 256 * 1024;

export function isCustomCssSafeMode(search: string): boolean {
  return new URLSearchParams(search).get('safe-css') === '1';
}

export function sanitizeCustomCss(input: unknown): string {
  if (typeof input !== 'string') return '';

  let sanitized = input;

  for (const rule of CSS_SANITIZER_RULES) {
    sanitized = sanitized.replace(rule.pattern, rule.replacement);
  }
  for (const rule of DANGEROUS_CSS_VALUE_RULES) {
    sanitized = sanitized.replace(rule.pattern, rule.replacement);
  }

  // Limite de taille anti-abus (256 KB de CSS custom, c'est déjà énorme)
  if (sanitized.length > CUSTOM_CSS_MAX_LENGTH) {
    sanitized = sanitized.slice(0, CUSTOM_CSS_MAX_LENGTH);
  }

  return sanitized;
}
