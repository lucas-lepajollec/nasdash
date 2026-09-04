import ts from '../node_modules/typescript/lib/typescript.js';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const projectRoot = process.cwd();
const sourceRoot = join(projectRoot, 'src');
const generatedPath = join(sourceRoot, 'i18n/generated.ts');
const locales = ['en', 'fr', 'es', 'de'];
const userAttrs = new Set(['title', 'aria-label', 'placeholder', 'alt', 'label', 'sublabel', 'description']);
const userProps = new Set([
  'title',
  'label',
  'sublabel',
  'description',
  'placeholder',
  'message',
  'text',
  'hint',
  'emptyMessage',
  'error',
  'statusText',
]);
const userCalls = new Set(['alert', 'confirm', 'setError', 'setMessage', 'setToastMessage', 'showToast']);

const generatedSource = readFileSync(generatedPath, 'utf8');
const jsonStart = generatedSource.indexOf('{');
const jsonEnd = generatedSource.lastIndexOf(' as const;');
if (jsonStart < 0 || jsonEnd < 0) throw new Error('Unable to parse src/i18n/generated.ts');
const dictionaries = JSON.parse(generatedSource.slice(jsonStart, jsonEnd));
const canonicalKeys = Object.keys(dictionaries.en ?? {}).sort();
const failures = [];

if (canonicalKeys.length < 1) failures.push('The generated English dictionary is empty.');
for (const locale of locales) {
  const keys = Object.keys(dictionaries[locale] ?? {}).sort();
  if (JSON.stringify(keys) !== JSON.stringify(canonicalKeys)) {
    failures.push(`${locale}: message keys differ from the English dictionary.`);
  }
  for (const key of keys) {
    if (typeof dictionaries[locale][key] !== 'string' || !dictionaries[locale][key].trim()) {
      failures.push(`${locale}: blank or invalid translation for ${JSON.stringify(key)}.`);
    }
    if (locale !== 'fr') {
      const source = dictionaries.fr[key];
      const translation = dictionaries[locale][key];
      if (translation === source && looksClearlyFrench(source)) {
        failures.push(`${locale}: French text remains untranslated for ${JSON.stringify(key)}.`);
      }
      if (JSON.stringify(placeholders(translation)) !== JSON.stringify(placeholders(source))) {
        failures.push(`${locale}: placeholders differ for ${JSON.stringify(key)}.`);
      }
    }
  }
}

for (const file of walk(sourceRoot).filter((path) => path.endsWith('.tsx'))) {
  const text = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  visit(source);

  function report(node, kind, raw) {
    const value = raw.replace(/\s+/g, ' ').trim();
    if (!looksHuman(value) || insideStyleTag(node) || insideTranslationCall(node)) return;
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    failures.push(`${relative(projectRoot, file)}:${line}: untranslated ${kind}: ${JSON.stringify(value)}`);
  }

  function visit(node) {
    if (ts.isJsxText(node)) report(node, 'visible text', node.getText(source));
    else if (
      ts.isJsxAttribute(node)
      && userAttrs.has(node.name.text)
      && node.initializer
      && ts.isStringLiteral(node.initializer)
    ) report(node.initializer, `${node.name.text} attribute`, node.initializer.text);
    else if (
      ts.isPropertyAssignment(node)
      && ts.isIdentifier(node.name)
      && userProps.has(node.name.text)
      && (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))
    ) {
      const isGeneratedSourceKey = canonicalKeys.includes(node.initializer.text);
      if (!isGeneratedSourceKey || insideFunction(node)) {
        report(node.initializer, `${node.name.text} property`, node.initializer.text);
      }
    }
    else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && userCalls.has(node.expression.text)) {
      for (const argument of node.arguments) {
        if (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument)) {
          report(argument, `${node.expression.text} message`, argument.text);
        } else if (ts.isTemplateExpression(argument)) {
          report(argument, `${node.expression.text} template`, argument.getText(source));
        }
      }
    } else if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      && insideJsxExpression(node)
      && !insideIgnoredAttribute(node)
      && !insideComparison(node)
    ) report(node, 'visible expression', node.text);
    else if (ts.isTemplateExpression(node) && insideJsxExpression(node) && !insideIgnoredAttribute(node)) {
      report(node, 'visible template', node.getText(source));
    }
    ts.forEachChild(node, visit);
  }
}

for (const file of walk(sourceRoot).filter((path) => path.endsWith('.ts') || path.endsWith('.tsx'))) {
  if (file === join(sourceRoot, 'i18n/messages.ts')) continue;
  const text = readFileSync(file, 'utf8');
  for (const pattern of [/'fr-FR'/g, /"fr-FR"/g, /language=fr(?:&|`|')/g]) {
    for (const match of text.matchAll(pattern)) {
      const line = text.slice(0, match.index).split('\n').length;
      failures.push(`${relative(projectRoot, file)}:${line}: hard-coded French locale instead of useI18n().`);
    }
  }
}

if (failures.length) {
  console.error(`i18n check failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`${canonicalKeys.length} generated interface strings are complete in EN/FR/ES/DE.`);
console.log('No supported hard-coded user-facing strings remain in TSX sources.');

function insideTranslationCall(node) {
  let current = node.parent;
  while (current && !ts.isSourceFile(current)) {
    if (
      ts.isCallExpression(current)
      && ts.isIdentifier(current.expression)
      && current.expression.text === 't'
    ) return true;
    if (ts.isFunctionLike(current) || ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current)) return false;
    current = current.parent;
  }
  return false;
}

function insideJsxExpression(node) {
  let current = node.parent;
  while (current && !ts.isSourceFile(current)) {
    if (ts.isJsxExpression(current)) return true;
    if (ts.isFunctionLike(current) || ts.isVariableStatement(current)) return false;
    current = current.parent;
  }
  return false;
}

function insideIgnoredAttribute(node) {
  let current = node.parent;
  while (current && !ts.isSourceFile(current)) {
    if (ts.isJsxAttribute(current)) return !userAttrs.has(current.name.text);
    if (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current)) return false;
    current = current.parent;
  }
  return false;
}

function insideComparison(node) {
  return ts.isBinaryExpression(node.parent)
    && [
      ts.SyntaxKind.EqualsEqualsToken,
      ts.SyntaxKind.EqualsEqualsEqualsToken,
      ts.SyntaxKind.ExclamationEqualsToken,
      ts.SyntaxKind.ExclamationEqualsEqualsToken,
    ].includes(node.parent.operatorToken.kind);
}

function insideStyleTag(node) {
  let current = node.parent;
  while (current && !ts.isSourceFile(current)) {
    if (ts.isJsxElement(current)) return current.openingElement.tagName.getText() === 'style';
    current = current.parent;
  }
  return false;
}

function insideFunction(node) {
  let current = node.parent;
  while (current && !ts.isSourceFile(current)) {
    if (ts.isFunctionLike(current)) return true;
    current = current.parent;
  }
  return false;
}

function looksHuman(value) {
  if (value.length < 2 || value.length > 500) return false;
  if (/^(?:use client|#[0-9a-f]{3,8}|rgba?\(|var\(|https?:\/\/)/i.test(value)) return false;
  if (/^[A-Z_]+$/.test(value)) return false;
  if (/^`?\$\{[^}]+\}(?:px|%|\s?ms|\s?[kmgt]?b)`?$/i.test(value)) return false;
  if (/^[a-z0-9_.-]+\/[a-z0-9_.:/-]+$/i.test(value)) return false;
  if (/^(?:tabs|widget|custom-tab|docker|networks)-[a-z0-9-]+$/i.test(value)) return false;
  if (/^(?:docker-demo\.invalid|docker-socket-proxy)$/.test(value)) return false;
  if (/^`\$\{[^}]+\.ip\}\$\{.+ports.+\}`$/.test(value) || /^`:\$\{.+ports.+\}`$/.test(value)) return false;
  if (/^[-\d.,%()\s]+$/.test(value)) return false;
  if (/^(?:@keyframes|:root|--[a-z-]+\s*:)/i.test(value)) return false;
  return /[A-Za-zÀ-ÿ]/.test(value) && (value.includes(' ') || /[À-ÿ]/.test(value) || value.length > 12);
}

function looksClearlyFrench(value) {
  if (/^(?:Español|Rosé Pine(?: Dawn| Main)?(?: 🌸)?)$/.test(value)) return false;
  return /[À-ÿ]/.test(value)
    || /\b(?:aucun|ajouter|afficher|activer|annuler|avec|connexion|désactiver|enregistrer|erreur|modifier|paramètres|pour|réseau|sans|supprimer|votre|vous)\b/i.test(value);
}

function placeholders(value) {
  return [...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map((match) => match[1]).sort();
}

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
