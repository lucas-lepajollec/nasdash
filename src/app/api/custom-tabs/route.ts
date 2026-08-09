import { NextRequest, NextResponse } from 'next/server';
import { readCustomTabs, writeCustomTabs } from '@/lib/customTabs';
import { checkAdmin } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { TabDef } from '@/hooks/useTabs';
import { readConfig } from '@/lib/config';
import { canAccessTab, resolveAccessPrincipal } from '@/lib/access';

export async function GET(req: NextRequest) {
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

export async function POST(req: NextRequest) {
  const authError = checkAdmin(req);
  if (authError) return authError;


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
  const authError = checkAdmin(req);
  if (authError) return authError;


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
  const authError = checkAdmin(req);
  if (authError) return authError;


  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

  const data = readCustomTabs();
  data.tabs = data.tabs.filter(t => t.id !== id);
  delete data.layouts[id];
  
  writeCustomTabs(data);
  return NextResponse.json({ ok: true });
}
