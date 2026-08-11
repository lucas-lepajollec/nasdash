import { NextRequest, NextResponse } from 'next/server';
import { readCustomTabs, writeCustomTabs } from '@/lib/customTabs';
import { checkAdmin } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { TabDef } from '@/hooks/useTabs';
import { readConfig } from '@/lib/config';
import { canAccessTab, resolveAccessPrincipal } from '@/lib/access';
import { CustomTabLayout } from '@/lib/types';
import {
  RequestValidationError,
  assertSafeIdentifier,
  isJsonObject,
  readEnum,
  readJsonObject,
  readObject,
  readString,
} from '@/lib/requestValidation';
import { withDemoSession } from '@/lib/demoSession';

const MAX_CUSTOM_TAB_BODY_BYTES = 1024 * 1024;

function validateLayout(value: unknown): Omit<CustomTabLayout, 'id'> & { id?: string } {
  if (!isJsonObject(value) || !Array.isArray(value.rows)) {
    throw new RequestValidationError('La mise en page doit contenir une liste de lignes.');
  }
  if (value.rows.length > 100) {
    throw new RequestValidationError('La mise en page contient trop de lignes.', 413);
  }
  if (value.rows.some(row => !isJsonObject(row))) {
    throw new RequestValidationError('La mise en page contient une ligne invalide.');
  }
  return value as unknown as Omit<CustomTabLayout, 'id'> & { id?: string };
}

function validationResponse(error: unknown) {
  if (error instanceof RequestValidationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}

async function handleGET(req: NextRequest) {
  const config = readConfig();
  const principal = resolveAccessPrincipal(req, config.settings?.securityMode || 'public');
  if (!principal) {
    return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
  }

  const data = readCustomTabs();
  if (principal.role === 'admin') return NextResponse.json(data);

  const tabs = data.tabs.filter(tab => canAccessTab(principal, tab.id));
  const allowedIds = new Set(tabs.map(tab => tab.id));
  const layouts = Object.fromEntries(
    Object.entries(data.layouts).filter(([tabId]) => allowedIds.has(tabId))
  );

  return NextResponse.json({ ...data, tabs, layouts });
}

async function handlePOST(req: NextRequest) {
  const authError = checkAdmin(req);
  if (authError) return authError;


  try {
    const body = await readJsonObject(req, MAX_CUSTOM_TAB_BODY_BYTES);
    const type = readEnum(body, 'type', ['createTab'] as const, true);
    const data = readCustomTabs();

    if (type === 'createTab') {
      const name = readString(body, 'name', { maxLength: 100 });
      const icon = readString(body, 'icon', { maxLength: 32 });
      const description = readString(body, 'description', { maxLength: 500 });
      const layout = body.layout === undefined ? undefined : validateLayout(body.layout);
      const newId = `custom_${uuidv4()}`;
      const newTab: TabDef = {
        id: newId,
        name: name || 'Nouvel Onglet',
        icon: icon || '📝',
        description: description || 'Onglet personnalisé',
        isCustom: true
      };

      data.tabs.push(newTab);
      data.layouts[newId] = layout ? { ...layout, id: newId } : { id: newId, rows: [] };

      if (!writeCustomTabs(data)) {
        return NextResponse.json({ error: 'Impossible d’enregistrer les onglets personnalisés.' }, { status: 500 });
      }
      return NextResponse.json({ tab: newTab, layout: data.layouts[newId] }, { status: 201 });
    }

    return NextResponse.json({ error: 'Type invalide.' }, { status: 400 });
  } catch (error: unknown) {
    const response = validationResponse(error);
    if (response) return response;
    console.error('Erreur API Custom Tabs POST:', error);
    return NextResponse.json({ error: 'Une erreur interne est survenue.' }, { status: 500 });
  }
}

async function handlePUT(req: NextRequest) {
  const authError = checkAdmin(req);
  if (authError) return authError;


  try {
    const body = await readJsonObject(req, MAX_CUSTOM_TAB_BODY_BYTES);
    const type = readEnum(body, 'type', ['updateTab'] as const);
    const id = assertSafeIdentifier(readString(body, 'id', { required: true, maxLength: 128 })!);
    const tabUpdates = readObject(body, 'tabUpdates');
    const layoutValue = body.layoutUpdates ?? body.layout;

    const data = readCustomTabs();
    const tabIndex = data.tabs.findIndex(t => t.id === id);

    if (tabIndex === -1) {
      return NextResponse.json({ error: 'Onglet introuvable.' }, { status: 404 });
    }

    if (type === 'updateTab' || layoutValue !== undefined) {
      if (tabUpdates) {
        const updates: Partial<TabDef> = {};
        const name = readString(tabUpdates, 'name', { maxLength: 100 });
        const icon = readString(tabUpdates, 'icon', { maxLength: 32 });
        const description = readString(tabUpdates, 'description', { maxLength: 500 });
        if (name !== undefined) updates.name = name;
        if (icon !== undefined) updates.icon = icon;
        if (description !== undefined) updates.description = description;
        data.tabs[tabIndex] = { ...data.tabs[tabIndex], ...updates };
      }
      if (layoutValue !== undefined) {
        const finalLayout = validateLayout(layoutValue);
        data.layouts[id] = { ...data.layouts[id], ...finalLayout, id };
      }
      if (!writeCustomTabs(data)) {
        return NextResponse.json({ error: 'Impossible d’enregistrer les onglets personnalisés.' }, { status: 500 });
      }
      return NextResponse.json({ tab: data.tabs[tabIndex], layout: data.layouts[id] });
    }

    return NextResponse.json({ error: 'Type invalide.' }, { status: 400 });
  } catch (error: unknown) {
    const response = validationResponse(error);
    if (response) return response;
    console.error('Erreur API Custom Tabs PUT:', error);
    return NextResponse.json({ error: 'Une erreur interne est survenue.' }, { status: 500 });
  }
}

async function handleDELETE(req: NextRequest) {
  const authError = checkAdmin(req);
  if (authError) return authError;


  try {
    const { searchParams } = new URL(req.url);
    const rawId = searchParams.get('id');
    if (!rawId) return NextResponse.json({ error: 'ID requis.' }, { status: 400 });
    const id = assertSafeIdentifier(rawId);

    const data = readCustomTabs();
    data.tabs = data.tabs.filter(t => t.id !== id);
    delete data.layouts[id];

    if (!writeCustomTabs(data)) {
      return NextResponse.json({ error: 'Impossible d’enregistrer les onglets personnalisés.' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const response = validationResponse(error);
    if (response) return response;
    console.error('Erreur API Custom Tabs DELETE:', error);
    return NextResponse.json({ error: 'Une erreur interne est survenue.' }, { status: 500 });
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
