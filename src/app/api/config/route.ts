import { NextRequest, NextResponse } from 'next/server';
import { readConfig, writeConfig } from '@/lib/config';
import { v4 as uuidv4 } from 'uuid';
import { Category, Service, Device } from '@/lib/types';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const config = readConfig();
  // Ensure devices array exists (backward compat)
  if (!config.devices) (config as any).devices = [];
  if (!config.dockerHosts) (config as any).dockerHosts = [];

  // Strip out sensitive tokens before sending to client
  const safeConfig = JSON.parse(JSON.stringify(config));
  safeConfig.devices.forEach((device: any) => {
    if (device.api && device.api.token) {
      device.api.token = '********';
    }
  });
  if (safeConfig.settings && safeConfig.settings.tailscaleClientSecret) {
    safeConfig.settings.tailscaleClientSecret = '********';
  }

  return NextResponse.json(safeConfig);
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
    
    // Automatically expand the grid by 1 slot so an empty dropzone immediately appears
    if (!config.settings) config.settings = {} as any;
    const currentSlots = config.settings.totalSlots || Math.max(12, config.categories.length - 1);
    if (currentSlots < config.categories.length + 1) {
       config.settings.totalSlots = config.categories.length + 1;
    }

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
        let baseUrl = body.api.ip;
        if (baseUrl && !baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
          baseUrl = `http://${baseUrl}`;
        }
        try {
          const urlObj = new URL(baseUrl);
          if (body.api.port) urlObj.port = body.api.port;
          newDevice.api.url = urlObj.toString().replace(/\/$/, '');
        } catch (e) {
          newDevice.api.url = body.api.port ? `${baseUrl}:${body.api.port}` : baseUrl;
        }

        if (body.api.username || body.api.password) {
          const authStr = `${body.api.username || ''}:${body.api.password || ''}`;
          newDevice.api.token = authStr;
        }
      } else if (body.api.type === 'homeassistant') {
        newDevice.api.url = `http://${body.api.ip}:${body.api.port || 8123}/api/states`;
        if (body.api.password) {
          newDevice.api.token = body.api.password;
        }
      } else if (body.api.type === 'proxmox') {
        const baseUrl = `https://${body.api.ip}:${body.api.port || 8006}/api2/json/nodes/${body.api.nodeName || 'pve'}`;
        if (body.api.vmid) {
          newDevice.api.url = `${baseUrl}/${body.api.vmType || 'qemu'}/${body.api.vmid}/status/current`;
        } else {
          newDevice.api.url = `${baseUrl}/status`;
        }
        if (body.api.password) {
          const fullToken = `${body.api.username}=${body.api.password}`;
          newDevice.api.token = fullToken;
        }
      } else if (body.api.type === 'lhm') {
        let baseUrl = body.api.ip;
        if (baseUrl && !baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
          baseUrl = `http://${baseUrl}`;
        }
        newDevice.api.url = `${baseUrl}:${body.api.port || 9001}/data.json`;
      }
    }

    config.devices.push(newDevice);
    writeConfig(config);

    // Strip sensitive info before returning
    const safeDevice = JSON.parse(JSON.stringify(newDevice));
    if (safeDevice.api?.token) safeDevice.api.token = '********';
    return NextResponse.json(safeDevice, { status: 201 });
  }

  if (type === 'dockerHost') {
    if (!config.dockerHosts) (config as any).dockerHosts = [];
    const newHost = {
      id: uuidv4(),
      name: body.name || 'Docker Host',
      icon: body.icon || '🐳',
      type: 'tcp' as const,
      url: body.url || '',
    };
    (config as any).dockerHosts.push(newHost);
    writeConfig(config);
    return NextResponse.json(newHost, { status: 201 });
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

  if (type === 'reorderDevices') {
    if (!config.devices) config.devices = [];

    // Preserve sensitive tokens from existing devices
    const newDevices = body.devices.map((newDevice: any) => {
      const existingDevice = config.devices.find((d: any) => d.id === newDevice.id);
      if (existingDevice && existingDevice.api?.token && newDevice.api?.token === '********') {
        // Keep the original token if the new one is masked
        newDevice.api.token = existingDevice.api.token;
      }
      return newDevice;
    });

    config.devices = newDevices;
    writeConfig(config);
    return NextResponse.json({ ok: true });
  }

  if (type === 'category') {
    const cat = config.categories.find(c => c.id === body.id);
    if (!cat) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (body.title !== undefined) cat.title = body.title;
    if (body.emoji !== undefined) cat.emoji = body.emoji;
    if (body.isSecret !== undefined) cat.isSecret = body.isSecret;
    if (body.services !== undefined) cat.services = body.services;
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
    if (body.tailscaleTailnet !== undefined) config.settings.tailscaleTailnet = body.tailscaleTailnet;
    if (body.tailscaleClientId !== undefined) config.settings.tailscaleClientId = body.tailscaleClientId;
    if (body.tailscaleClientSecret !== undefined) config.settings.tailscaleClientSecret = body.tailscaleClientSecret;
    if (body.dockPosition !== undefined) config.settings.dockPosition = body.dockPosition;
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
      const oldApiObj: any = device.api || {};
      const isChangingPlatform = oldApiObj.type !== body.api.type;

      // Check if username or password was specifically sent in the PUT request
      const updatingCredentials = body.api.password !== undefined || body.api.username !== undefined;

      device.api = {
        type: body.api.type,
        url: '',
        ip: body.api.ip,
        port: body.api.port,
        username: body.api.username !== undefined ? body.api.username : oldApiObj.username,
        nodeName: body.api.nodeName,
        vmid: body.api.vmid,
        vmType: body.api.vmType,
        token: (isChangingPlatform || updatingCredentials) ? undefined : oldApiObj.token
      };

      if (body.api.type === 'glances') {
        let baseUrl = body.api.ip;
        if (baseUrl && !baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
          baseUrl = `http://${baseUrl}`;
        }
        try {
          const urlObj = new URL(baseUrl);
          if (body.api.port) urlObj.port = body.api.port;
          device.api.url = urlObj.toString().replace(/\/$/, '');
        } catch (e) {
          device.api.url = body.api.port ? `${baseUrl}:${body.api.port}` : baseUrl;
        }

        if (updatingCredentials) {
          if (body.api.username || body.api.password) {
            const authStr = `${body.api.username || ''}:${body.api.password || ''}`;
            device.api.token = authStr;
          } else {
            device.api.token = undefined; // Cleared
          }
        }
      } else if (body.api.type === 'homeassistant') {
        device.api.url = `http://${body.api.ip}:${body.api.port || 8123}/api/states`;
        if (updatingCredentials) {
          device.api.token = body.api.password || undefined;
        }
      } else if (body.api.type === 'proxmox') {
        const baseUrl = `https://${body.api.ip}:${body.api.port || 8006}/api2/json/nodes/${body.api.nodeName || 'pve'}`;
        if (body.api.vmid) {
          device.api.url = `${baseUrl}/${body.api.vmType || 'qemu'}/${body.api.vmid}/status/current`;
        } else {
          device.api.url = `${baseUrl}/status`;
        }
        if (updatingCredentials) {
          if (body.api.username && body.api.password) {
            const fullToken = `${body.api.username}=${body.api.password}`;
            device.api.token = fullToken;
          } else {
            device.api.token = undefined; // Cleared
          }
        }
      } else if (body.api.type === 'lhm') {
        let baseUrl = body.api.ip;
        if (baseUrl && !baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
          baseUrl = `http://${baseUrl}`;
        }
        device.api.url = `${baseUrl}:${body.api.port || 9001}/data.json`;
      }
    }

    writeConfig(config);

    // Strip sensitive info before returning
    const safeDevice = JSON.parse(JSON.stringify(device));
    if (safeDevice.api?.token) safeDevice.api.token = '********';
    return NextResponse.json(safeDevice);
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
    config.devices = config.devices.filter((d: Device) => d.id !== id);
    writeConfig(config);
    return NextResponse.json({ ok: true });
  }

  if (type === 'dockerHost') {
    if (!(config as any).dockerHosts) (config as any).dockerHosts = [];
    (config as any).dockerHosts = (config as any).dockerHosts.filter((h: any) => h.id !== id);
    writeConfig(config);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
}
