import ts from '../node_modules/typescript/lib/typescript.js';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// A targeted regression detector, not a general language recognizer. Dynamic
// user names, upstream messages and UI translation keys are outside its scope.
export function looksFrench(value) {
  return /[À-ÖØ-öø-ÿ]/.test(value)
    || /\b(?:adresse|aucun|ajouter|afficher|annuler|avec|bienvenue|calendrier|connexion|depuis|erreur|exemple|hyperviseur|impossible|introuvable|manquant(?:e|s|es)?|modifier|onglet|outils|pour|routeur|sauvegarde|serveur|supprimer|votre|vous)\b/i.test(value)
    || /\bmon home lab\b/i.test(value);
}

export const EXAMPLE_FILES = ['config', 'services', 'topology', 'calendar', 'custom_tabs'];
const operationalFiles = new Set(['src/lib/monitoringError.ts', 'src/lib/dockerLog.ts', 'scripts/data-snapshot.mjs', 'src/lib/pages/presets.ts', 'src/lib/backups.ts']);
const diagnosticConstructors = new Set(['MonitoringConfigurationError', 'MonitoringInvalidResponseError']);
const technicalErrors = new Set(['Error', 'TypeError', 'RangeError']);
const logMethods = new Set(['log', 'info', 'warn', 'error', 'debug']);

export function checkInstallationLanguage(projectRoot) {
  const failures = [];
  const report = (file, line, text) => {
    if (looksFrench(text)) failures.push(`${relative(projectRoot, file)}:${line}: French installation/log text: ${JSON.stringify(text)}`);
  };
  for (const folder of ['src', 'scripts']) {
    for (const file of walk(join(projectRoot, folder)).filter(file => /\.(?:ts|tsx|mjs)$/.test(file) && !/\.(?:test|spec)\./.test(file))) {
      const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      const allStrings = operationalFiles.has(relative(projectRoot, file));
      function visit(node, diagnostic = allStrings) {
        const isLog = ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
          && node.expression.expression.getText(source) === 'console' && logMethods.has(node.expression.name.text);
        const isCause = ts.isNewExpression(node) && (diagnosticConstructors.has(node.expression.getText(source))
          || (!file.endsWith('.tsx') && technicalErrors.has(node.expression.getText(source))));
        const active = diagnostic || isLog || isCause;
        if (active && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
          || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node))) {
          report(file, source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, node.text);
        }
        ts.forEachChild(node, child => visit(child, active));
      }
      visit(source);
    }
  }
  const entrypoint = join(projectRoot, 'docker-entrypoint.sh');
  readFileSync(entrypoint, 'utf8').split('\n').forEach((line, index) => {
    if (/^\s*(?:echo|printf)\b/.test(line)) report(entrypoint, index + 1, line);
  });
  // Never scan data/*.json: those contain private, user-authored configuration.
  for (const name of EXAMPLE_FILES) {
    const file = join(projectRoot, 'data', `${name}.example.json`);
    const value = JSON.parse(readFileSync(file, 'utf8'));
    function visit(item, location = '$') {
      if (typeof item === 'string') report(file, location, item);
      else if (item && typeof item === 'object') Object.entries(item).forEach(([key, child]) => visit(child, `${location}.${key}`));
    }
    visit(value);
  }
  return failures;
}

function walk(directory) {
  return readdirSync(directory).flatMap(name => {
    const file = join(directory, name);
    return statSync(file).isDirectory() ? walk(file) : [file];
  });
}
