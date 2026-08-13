/**
 * Sanitisation du CSS personnalisé fourni par l'utilisateur.
 *
 * Risque : le champ `settings.customCss` est injecté tel quel dans un
 * `<style dangerouslySetInnerHTML>` côté client (ConfigProvider.tsx).
 * Sans filtrage, un admin dont la session serait compromise pourrait
 * sortir du contexte `<style>` et exécuter du JS (`</style><script>...`).
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
  // 2. LE vecteur de breakout principal : la séquence "</style" (suivie d'un séparateur)
  //    ferme le <style> côté HTML parser → tout ce qui suit devient du HTML exécutable.
  //    On insère un backslash qui brise la reconnaissance du token sans casser le CSS lisible.
  //    \b = boundary : matche "</style>", "</style >", "</style/>" mais pas "</stylex>".
  { pattern: /<\/style\b/gi, replacement: '<\\/style' },
  // 3. Toute autre balise d'ouverture/fermeture (script, iframe...) — on échappe le "<"
  //    pour qu'aucun parser ne puisse l'interpréter comme une balise, même hors <style>.
  { pattern: /<(\/?)(script|iframe|object|embed|link|meta|base|img|svg)\b/gi, replacement: '&lt;$1$2' },
  // 4. Commentaires HTML conditionnels (`<!--` `-->`) — breakout IE/legacy
  { pattern: /<!--/g, replacement: '<\\!--' },
  { pattern: /-->/g, replacement: '--\\>' },
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
