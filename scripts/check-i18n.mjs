import ts from '../node_modules/typescript/lib/typescript.js';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const projectRoot = process.cwd();
const sourceRoot = join(projectRoot, 'src');
const generatedPath = join(sourceRoot, 'i18n/generated.ts');
const supplementalPath = join(sourceRoot, 'i18n/messages.ts');
const locales = ['en', 'fr', 'es', 'de'];
const userAttrs = new Set(['title', 'aria-label', 'placeholder', 'alt', 'label', 'sublabel', 'description', 'message', 'text', 'hint', 'emptyMessage', 'error', 'statusText']);
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
const userCalls = new Set(['alert', 'confirm', 'setError', 'setSaveError', 'setMessage', 'setToastMessage', 'showToast']);

const generatedSource = readFileSync(generatedPath, 'utf8');
const jsonStart = generatedSource.indexOf('{');
const jsonEnd = generatedSource.lastIndexOf(' as const;');
if (jsonStart < 0 || jsonEnd < 0) throw new Error('Unable to parse src/i18n/generated.ts');
const generatedDictionaries = JSON.parse(generatedSource.slice(jsonStart, jsonEnd));
const supplementalDictionaries = readSupplementalDictionaries(supplementalPath);
const dictionaries = Object.fromEntries(locales.map((locale) => [
  locale,
  { ...generatedDictionaries[locale], ...supplementalDictionaries[locale] },
]));
const canonicalKeys = Object.keys(dictionaries.en ?? {}).sort();
const failures = [];

if (canonicalKeys.length < 1) failures.push('The English dictionary is empty.');
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

for (const file of walk(sourceRoot).filter((path) => path.endsWith('.ts') || path.endsWith('.tsx'))) {
  if (file === supplementalPath || file === generatedPath) continue;
  const text = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  visit(source);

  function visit(node) {
    if (
      ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === 't'
      && node.arguments.length > 0
      && (ts.isStringLiteral(node.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(node.arguments[0]))
    ) {
      const key = node.arguments[0].text;
      if (!Object.prototype.hasOwnProperty.call(dictionaries.en, key)) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        failures.push(`${relative(projectRoot, file)}:${line}: unknown translation key ${JSON.stringify(key)}.`);
      }
    }
    ts.forEachChild(node, visit);
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
      ts.isJsxAttribute(node)
      && userAttrs.has(node.name.text)
      && node.initializer
      && ts.isJsxExpression(node.initializer)
      && node.initializer.expression
      && (ts.isStringLiteral(node.initializer.expression) || ts.isNoSubstitutionTemplateLiteral(node.initializer.expression))
    ) report(node.initializer.expression, `${node.name.text} attribute`, node.initializer.expression.text);
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
      && isRenderedJsxLiteral(node)
      && !insideIgnoredAttribute(node)
      && !insideComparison(node)
    ) report(node, 'visible expression', node.text);
    else if (ts.isTemplateExpression(node) && isRenderedJsxLiteral(node) && !insideIgnoredAttribute(node)) {
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

console.log(`${canonicalKeys.length} interface strings are complete in EN/FR/ES/DE.`);
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

function isRenderedJsxLiteral(node) {
  let current = node;
  while (current.parent && !ts.isSourceFile(current.parent)) {
    const parent = current.parent;
    if (ts.isJsxExpression(parent)) return true;
    if (ts.isConditionalExpression(parent)) {
      if (parent.condition === current) return false;
      current = parent;
      continue;
    }
    if (ts.isBinaryExpression(parent)) {
      if (insideComparison(current)) return false;
      if (
        [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(parent.operatorToken.kind)
        && parent.left === current
      ) return false;
      current = parent;
      continue;
    }
    if (
      ts.isParenthesizedExpression(parent)
      || ts.isAsExpression(parent)
      || ts.isNonNullExpression(parent)
    ) {
      current = parent;
      continue;
    }
    return false;
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
  if (/^(?:NasDash|Docker|GitHub|Tailscale|Linux|Glances|Jellyfin|admin@nas:~)$/i.test(value)) return false;
  if (/^(?:ms|px\)?|rw|ro|[kmgt]?b)$/i.test(value)) return false;
  if (/^(?:\/|\?|[a-z-]+@)[^\s]*$/i.test(value)) return false;
  if (/^[A-Z_]+$/.test(value)) return false;
  if (/^`?\$\{[^}]+\}(?:px|%|\s?ms|\s?[kmgt]?b)`?$/i.test(value)) return false;
  if (/^[a-z0-9_.-]+\/[a-z0-9_.:/-]+$/i.test(value)) return false;
  if (/^(?:tabs|widget|custom-tab|docker|networks)-[a-z0-9-]+$/i.test(value)) return false;
  if (/^(?:docker-demo\.invalid|docker-socket-proxy)$/.test(value)) return false;
  if (/^`\$\{[^}]+\.ip\}\$\{.+ports.+\}`$/.test(value) || /^`:\$\{.+ports.+\}`$/.test(value)) return false;
  if (/^[-\d.,%()\s]+$/.test(value)) return false;
  if (/^(?:@keyframes|:root|--[a-z-]+\s*:)/i.test(value)) return false;
  return /[A-Za-zÀ-ÿ]/.test(value);
}

function looksClearlyFrench(value) {
  if (/^(?:Español|Rosé Pine(?: Dawn| Main)?(?: 🌸)?)$/.test(value)) return false;
  return /[À-ÿ]/.test(value)
    || /\b(?:aucun|ajouter|afficher|activer|annuler|avec|connexion|désactiver|enregistrer|erreur|modifier|paramètres|pour|réseau|sans|supprimer|votre|vous)\b/i.test(value);
}

function placeholders(value) {
  return [...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map((match) => match[1]).sort();
}

function readSupplementalDictionaries(path) {
  const text = readFileSync(path, 'utf8');
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const result = Object.fromEntries(locales.map((locale) => [locale, {}]));

  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !locales.includes(declaration.name.text)) continue;
      if (!declaration.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) continue;
      const locale = declaration.name.text;
      for (const property of declaration.initializer.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const key = ts.isComputedPropertyName(property.name) ? null : property.name.text;
        const value = property.initializer;
        if (!key || (!ts.isStringLiteral(value) && !ts.isNoSubstitutionTemplateLiteral(value))) {
          throw new Error(`Unable to statically parse supplemental ${locale} messages.`);
        }
        result[locale][key] = value.text;
      }
    }
  }
  return result;
}

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
