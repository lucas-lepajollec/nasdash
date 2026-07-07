import { NextRequest, NextResponse } from 'next/server';
import { readCustomTabs, writeCustomTabs } from '@/lib/customTabs';
import { isAdmin, getSessionFromRequest } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { TabDef } from '@/hooks/useTabs';
import { readConfig } from '@/lib/config';

export async function GET(req: NextRequest) {
  const config = readConfig();

  // Bloquer l'accès en mode privé si non authentifié
  if (config.settings?.securityMode === 'private') {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
    }
  }

  const data = readCustomTabs();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
  }

  const body = await req.json();
  const { type } = body;
  const data = readCustomTabs();

  if (type === 'createTab') {
    const { name, icon, description, layout } = body;
    const newId = `custom_${uuidv4()}`;
    const newTab: TabDef = {
      id: newId,
      name: name || 'Nouvel Onglet',
      icon: icon || '📝',
      description: description || 'Onglet personnalisé',
      isCustom: true
    };
    
    data.tabs.push(newTab);
    
    if (layout) {
      data.layouts[newId] = layout;
    } else {
      data.layouts[newId] = {
        id: newId,
        rows: []
      };
    }
    
    writeCustomTabs(data);
    return NextResponse.json({ tab: newTab, layout: data.layouts[newId] }, { status: 201 });
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
}

export async function PUT(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
  }

  const body = await req.json();
  const { type, id, tabUpdates, layoutUpdates, layout } = body;
  
  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  
  const data = readCustomTabs();
  const tabIndex = data.tabs.findIndex(t => t.id === id);
  
  if (tabIndex === -1) {
    return NextResponse.json({ error: 'Tab not found' }, { status: 404 });
  }

  if (type === 'updateTab' || layout || layoutUpdates) {
    if (tabUpdates) {
      data.tabs[tabIndex] = { ...data.tabs[tabIndex], ...tabUpdates };
    }
    const finalLayout = layoutUpdates || layout;
    if (finalLayout) {
      data.layouts[id] = { ...data.layouts[id], ...finalLayout, id };
    }
    writeCustomTabs(data);
    return NextResponse.json({ tab: data.tabs[tabIndex], layout: data.layouts[id] });
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

  const data = readCustomTabs();
  data.tabs = data.tabs.filter(t => t.id !== id);
  delete data.layouts[id];
  
  writeCustomTabs(data);
  return NextResponse.json({ ok: true });
}
