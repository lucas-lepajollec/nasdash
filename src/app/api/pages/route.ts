import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { checkAdmin } from '@/lib/auth';
import { resolveAccessPrincipal } from '@/lib/access';
import { readConfig } from '@/lib/config';
import { withDemoSession } from '@/lib/demoSession';
import { getWidgetCatalogEntry } from '@/lib/widgets/catalog';
import { buildOfficialPage, buildTemplate, PAGE_TEMPLATES, type PageTemplateId } from '@/lib/pages/presets';
import { pagesForViewer, readPagesDocument, writePagesDocument } from '@/lib/pages/store';
import { isOfficialPageId, type Page, type PagesDocument } from '@/lib/pages/types';
import { PAGE_LIMITS, validatePage } from '@/lib/pages/validation';
import {
  RequestValidationError,
  assertSafeIdentifier,
  readEnum,
  readJsonObject,
  readString,
} from '@/lib/requestValidation';

const MAX_BODY_BYTES = 2 * 1024 * 1024;

function errorResponse(error: unknown, context: string) {
  if (error instanceof RequestValidationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(`Erreur API Pages ${context}:`, error);
  return NextResponse.json({ error: 'Une erreur interne est survenue.' }, { status: 500 });
}

/** Single-instance widgets (the editable topology…) are checked across all pages. */
function assertInstanceLimits(document: PagesDocument, page: Page) {
  const pages = [...document.pages.filter(candidate => candidate.id !== page.id), page];
  const counts = new Map<string, number>();
  for (const widget of pages.flatMap(candidate => candidate.widgets)) {
    counts.set(widget.type, (counts.get(widget.type) ?? 0) + 1);
  }
  for (const [type, count] of counts) {
    const max = getWidgetCatalogEntry(type)?.maxInstances;
    if (max !== undefined && count > max) {
      throw new RequestValidationError(`Le widget « ${type} » ne peut exister qu’une fois.`, 409);
    }
  }
}

async function handleGET(req: NextRequest) {
  const config = readConfig();
  const principal = resolveAccessPrincipal(req, config.settings?.securityMode || 'public');
  if (!principal) return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
  try {
    const document = readPagesDocument();
    return NextResponse.json({ pages: pagesForViewer(document, principal) });
  } catch (error) {
    return errorResponse(error, 'GET');
  }
}

async function handlePOST(req: NextRequest) {
  const authError = checkAdmin(req);
  if (authError) return authError;
  try {
    const body = await readJsonObject(req, MAX_BODY_BYTES);
    const action = readEnum(body, 'action', ['create', 'restore', 'duplicate'] as const, true);
    const document = readPagesDocument();
    const config = readConfig();
    const categories = config.categories || [];
    const deviceCount = config.devices?.length ?? 1;

    if (action === 'create') {
      if (document.pages.length >= PAGE_LIMITS.pages) throw new RequestValidationError('Nombre maximal de pages atteint.', 413);
      const template = (readEnum(body, 'template', PAGE_TEMPLATES) ?? 'blank') as PageTemplateId;
      const name = readString(body, 'name', { maxLength: PAGE_LIMITS.nameLength })?.trim() || 'Nouvelle page';
      const icon = readString(body, 'icon', { maxLength: PAGE_LIMITS.iconLength }) || '📄';
      const description = readString(body, 'description', { maxLength: PAGE_LIMITS.descriptionLength });
      const id = `page_${uuidv4()}`;
      const built = buildTemplate(template, id, { categories, deviceCount, document });
      // A copied preset is an ordinary page: it does not claim to be the official one.
      const { preset: _preset, ...structure } = built;
      void _preset;
      const page = validatePage({ id, name, icon, ...(description ? { description } : {}), revision: 1, ...structure });
      assertInstanceLimits(document, page);
      document.pages.push(page);
      writePagesDocument(document);
      return NextResponse.json({ page }, { status: 201 });
    }

    const id = assertSafeIdentifier(readString(body, 'id', { required: true, maxLength: 128 })!);
    const index = document.pages.findIndex(page => page.id === id);
    if (index === -1) return NextResponse.json({ error: 'Page introuvable.' }, { status: 404 });
    const current = document.pages[index];

    if (action === 'duplicate') {
      if (document.pages.length >= PAGE_LIMITS.pages) throw new RequestValidationError('Nombre maximal de pages atteint.', 413);
      const copyId = `page_${uuidv4()}`;
      const copy: Page = { ...structuredClone(current), id: copyId, revision: 1, name: `${current.name} (2)`.slice(0, PAGE_LIMITS.nameLength) };
      delete copy.preset;
      // Single-instance widgets stay on the original page.
      copy.widgets = copy.widgets.filter(widget => getWidgetCatalogEntry(widget.type)?.maxInstances === undefined);
      const page = validatePage(copy);
      document.pages.splice(index + 1, 0, page);
      writePagesDocument(document);
      return NextResponse.json({ page }, { status: 201 });
    }

    // restore: rebuild an official page from its preset, keeping a backup first.
    const presetId = current.preset ?? (isOfficialPageId(current.id) ? current.id : undefined);
    if (!presetId) return NextResponse.json({ error: 'Cette page n’a pas de modèle d’origine.' }, { status: 400 });
    const rebuilt = buildOfficialPage(presetId, { categories, deviceCount, document });
    const page = validatePage({
      ...rebuilt,
      id: current.id,
      name: current.name,
      icon: current.icon,
      ...(current.description ? { description: current.description } : {}),
      revision: current.revision + 1,
    });
    document.pages[index] = page;
    writePagesDocument(document, { backup: true });
    return NextResponse.json({ page });
  } catch (error) {
    return errorResponse(error, 'POST');
  }
}

async function handlePUT(req: NextRequest) {
  const authError = checkAdmin(req);
  if (authError) return authError;
  try {
    const body = await readJsonObject(req, MAX_BODY_BYTES);
    const incoming = validatePage(body.page);
    const document = readPagesDocument();
    const index = document.pages.findIndex(page => page.id === incoming.id);
    if (index === -1) return NextResponse.json({ error: 'Page introuvable.' }, { status: 404 });
    const current = document.pages[index];
    if (incoming.revision !== current.revision) {
      // Another tab or device saved this page meanwhile: never overwrite silently.
      return NextResponse.json({ error: 'Cette page a été modifiée ailleurs.', code: 'conflict', page: current }, { status: 409 });
    }
    assertInstanceLimits(document, incoming);
    const saved: Page = { ...incoming, preset: current.preset, revision: current.revision + 1 };
    if (!saved.preset) delete saved.preset;
    document.pages[index] = saved;
    writePagesDocument(document);
    return NextResponse.json({ page: saved });
  } catch (error) {
    return errorResponse(error, 'PUT');
  }
}

async function handleDELETE(req: NextRequest) {
  const authError = checkAdmin(req);
  if (authError) return authError;
  try {
    const rawId = new URL(req.url).searchParams.get('id');
    if (!rawId) return NextResponse.json({ error: 'ID requis.' }, { status: 400 });
    const id = assertSafeIdentifier(rawId);
    const document = readPagesDocument();
    if (!document.pages.some(page => page.id === id)) return NextResponse.json({ error: 'Page introuvable.' }, { status: 404 });
    if (document.pages.length <= 1) return NextResponse.json({ error: 'Impossible de supprimer la dernière page.' }, { status: 400 });
    document.pages = document.pages.filter(page => page.id !== id);
    writePagesDocument(document, { backup: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, 'DELETE');
  }
}

export function GET(req: NextRequest) {
  return withDemoSession(req, () => handleGET(req));
}

export function POST(req: NextRequest) {
  return withDemoSession(req, () => handlePOST(req));
}

export function PUT(req: NextRequest) {
  return withDemoSession(req, () => handlePUT(req));
}

export function DELETE(req: NextRequest) {
  return withDemoSession(req, () => handleDELETE(req));
}
