import { NextRequest, NextResponse } from 'next/server';
import { readConfig, writeConfig } from '@/lib/config';
import { v4 as uuidv4 } from 'uuid';
import { Category, Service, Device } from '@/lib/types';
import fs from 'fs';
import path from 'path';

function cleanEnvForDevice(shortId: string) {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  
  let envContent = fs.readFileSync(envPath, 'utf-8');
  let modified = false;
  
  const prefixes = ['GLANCES_AUTH_', 'HA_TOKEN_', 'PVE_TOKEN_'];
  
  prefixes.forEach(prefix => {
    const key = `${prefix}${shortId}`;
    const regex = new RegExp(`^${key}=.*\\r?\\n?`, 'gm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, '');
      modified = true;
    }
    delete process.env[key];
  });
  
  if (modified) {
    fs.writeFileSync(envPath, envContent.trim() + '\n');
  }
}

export async function GET() {
  const config = readConfig();
  // Ensure devices array exists (backward compat)
  if (!config.devices) (config as any).devices = [];
  return NextResponse.json(config);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const config = readConfig();
  const { type } = body;

  if (type === 'category') {
    const newCategory: Category = {
      id: uuidv4(),
      title: body.title || 'Nouvelle catégorie',
      emoji: body.emoji || '📁',
      order: config.categories.length,
      isSecret: body.isSecret || false,
      services: [],
    };
    config.categories.push(newCategory);
    writeConfig(config);
    return NextResponse.json(newCategory, { status: 201 });
  }

  if (type === 'service') {
    const catIndex = config.categories.findIndex(c => c.id === body.categoryId);
    if (catIndex === -1) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

    const newService: Service = {
      id: uuidv4(),
      name: body.name || 'New Service',
      logo: body.logo || '',
      localUrl: body.localUrl || '',
      tailscaleUrl: body.tailscaleUrl || '',
    };
    config.categories[catIndex].services.push(newService);
    writeConfig(config);
    return NextResponse.json(newService, { status: 201 });
  }

  if (type === 'device') {
    if (!config.devices) config.devices = [];
    
    const newId = uuidv4();
    const newDevice: Device = {
      id: newId,
      name: body.name || 'Nouvel appareil',
      host: body.host || '',
      icon: body.icon || '🖥️',
      stats: [],
    };

    if (body.api) {
       const shortId = newId.split('-')[0].toUpperCase();
       
       newDevice.api = { 
          type: body.api.type, 
          url: '',
          ip: body.api.ip,
          port: body.api.port,
          username: body.api.username,
          nodeName: body.api.nodeName,
          vmid: body.api.vmid,
          vmType: body.api.vmType
       };
       
       if (body.api.type === 'glances') {
          newDevice.api.url = `http://${body.api.ip}:${body.api.port || 61208}/api/3/all`;
          if (body.api.username || body.api.password) {
             const envKey = `GLANCES_AUTH_${shortId}`;
             const authStr = `${body.api.username || ''}:${body.api.password || ''}`;
             process.env[envKey] = authStr;
             fs.appendFileSync(path.join(process.cwd(), '.env'), `\n${envKey}=${authStr}\n`);
             newDevice.api.token = `\${${envKey}}`;
          }
       } else if (body.api.type === 'homeassistant') {
          newDevice.api.url = `http://${body.api.ip}:${body.api.port || 8123}/api/states`;
          if (body.api.password) {
             const envKey = `HA_TOKEN_${shortId}`;
             process.env[envKey] = body.api.password;
             fs.appendFileSync(path.join(process.cwd(), '.env'), `\n${envKey}=${body.api.password}\n`);
             newDevice.api.token = `\${${envKey}}`;
          }
       } else if (body.api.type === 'proxmox') {
          const baseUrl = `https://${body.api.ip}:${body.api.port || 8006}/api2/json/nodes/${body.api.nodeName || 'pve'}`;
          if (body.api.vmid) {
             newDevice.api.url = `${baseUrl}/${body.api.vmType || 'qemu'}/${body.api.vmid}/status/current`;
          } else {
             newDevice.api.url = `${baseUrl}/status`;
          }
          if (body.api.password) {
             // username contains USER@REALM!TOKENID, password contains SECRET
             const envKey = `PVE_TOKEN_${shortId}`;
             const fullToken = `${body.api.username}=${body.api.password}`;
             process.env[envKey] = fullToken;
             fs.appendFileSync(path.join(process.cwd(), '.env'), `\n${envKey}=${fullToken}\n`);
             newDevice.api.token = `\${${envKey}}`;
          }
       }
    }

    config.devices.push(newDevice);
    writeConfig(config);
    return NextResponse.json(newDevice, { status: 201 });
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const config = readConfig();
  const { type } = body;

  if (type === 'reorder') {
    config.categories = body.categories;
    writeConfig(config);
    return NextResponse.json({ ok: true });
  }

  if (type === 'category') {
    const cat = config.categories.find(c => c.id === body.id);
    if (!cat) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (body.title !== undefined) cat.title = body.title;
    if (body.emoji !== undefined) cat.emoji = body.emoji;
    if (body.isSecret !== undefined) cat.isSecret = body.isSecret;
    writeConfig(config);
    return NextResponse.json(cat);
  }

  if (type === 'service') {
    for (const cat of config.categories) {
      const svc = cat.services.find(s => s.id === body.id);
      if (svc) {
        if (body.name !== undefined) svc.name = body.name;
        if (body.logo !== undefined) svc.logo = body.logo;
        if (body.localUrl !== undefined) svc.localUrl = body.localUrl;
        if (body.tailscaleUrl !== undefined) svc.tailscaleUrl = body.tailscaleUrl;
        writeConfig(config);
        return NextResponse.json(svc);
      }
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (type === 'settings') {
    if (body.title !== undefined) config.settings.title = body.title;
    if (body.showMonitor !== undefined) config.settings.showMonitor = body.showMonitor;
    if (body.totalSlots !== undefined) config.settings.totalSlots = body.totalSlots;
    writeConfig(config);
    return NextResponse.json(config.settings);
  }

  if (type === 'device') {
    if (!config.devices) config.devices = [];
    const device = config.devices.find((d: Device) => d.id === body.id);
    if (!device) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    
    if (body.name !== undefined) device.name = body.name;
    if (body.host !== undefined) device.host = body.host;
    if (body.icon !== undefined) device.icon = body.icon;
    
    if (body.api) {
       const shortId = device.id.split('-')[0].toUpperCase();
       
       const oldApiObj: any = device.api || {};
       const isChangingPlatform = oldApiObj.type !== body.api.type;
       const updatingCredentials = !!body.api.password;
       
       if (isChangingPlatform || updatingCredentials) {
           cleanEnvForDevice(shortId);
       }
       
       device.api = { 
          type: body.api.type, 
          url: '',
          ip: body.api.ip,
          port: body.api.port,
          username: body.api.username || oldApiObj.username,
          nodeName: body.api.nodeName,
          vmid: body.api.vmid,
          vmType: body.api.vmType,
          token: (isChangingPlatform || updatingCredentials) ? undefined : oldApiObj.token
       };
       
       if (body.api.type === 'glances') {
          device.api.url = `http://${body.api.ip}:${body.api.port || 61208}/api/3/all`;
          if (updatingCredentials) {
             const envKey = `GLANCES_AUTH_${shortId}`;
             const authStr = `${body.api.username || ''}:${body.api.password}`;
             process.env[envKey] = authStr;
             fs.appendFileSync(path.join(process.cwd(), '.env'), `\n${envKey}=${authStr}\n`);
             device.api.token = `\${${envKey}}`;
          }
       } else if (body.api.type === 'homeassistant') {
          device.api.url = `http://${body.api.ip}:${body.api.port || 8123}/api/states`;
          if (updatingCredentials) {
             const envKey = `HA_TOKEN_${shortId}`;
             process.env[envKey] = body.api.password;
             fs.appendFileSync(path.join(process.cwd(), '.env'), `\n${envKey}=${body.api.password}\n`);
             device.api.token = `\${${envKey}}`;
          }
       } else if (body.api.type === 'proxmox') {
          const baseUrl = `https://${body.api.ip}:${body.api.port || 8006}/api2/json/nodes/${body.api.nodeName || 'pve'}`;
          if (body.api.vmid) {
             device.api.url = `${baseUrl}/${body.api.vmType || 'qemu'}/${body.api.vmid}/status/current`;
          } else {
             device.api.url = `${baseUrl}/status`;
          }
          if (updatingCredentials) {
             const envKey = `PVE_TOKEN_${shortId}`;
             const fullToken = `${body.api.username}=${body.api.password}`;
             process.env[envKey] = fullToken;
             fs.appendFileSync(path.join(process.cwd(), '.env'), `\n${envKey}=${fullToken}\n`);
             device.api.token = `\${${envKey}}`;
          }
       }
    }
    
    writeConfig(config);
    return NextResponse.json(device);
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const id = searchParams.get('id');

  if (!type || !id) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  const config = readConfig();

  if (type === 'category') {
    config.categories = config.categories.filter(c => c.id !== id);
    writeConfig(config);
    return NextResponse.json({ ok: true });
  }

  if (type === 'service') {
    for (const cat of config.categories) {
      cat.services = cat.services.filter(s => s.id !== id);
    }
    writeConfig(config);
    return NextResponse.json({ ok: true });
  }

  if (type === 'device') {
    if (!config.devices) config.devices = [];
    
    // Purge related .env secrets before deleting
    const shortId = id.split('-')[0].toUpperCase();
    cleanEnvForDevice(shortId);
    
    config.devices = config.devices.filter((d: Device) => d.id !== id);
    writeConfig(config);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
}
