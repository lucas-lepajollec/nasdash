import { NextRequest, NextResponse } from 'next/server';
import { readConfig, writeConfig, writeServices, writeCalendar } from '@/lib/config';
import { isAdmin, getSessionFromRequest } from '@/lib/auth';
import { sanitizeCustomCss } from '@/lib/sanitizeCss';
import { v4 as uuidv4 } from 'uuid';
import { Category, Service, Device } from '@/lib/types';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  const config = readConfig();

  // Bloquer l'accès en mode privé si non authentifié
  if (config.settings?.securityMode === 'private') {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
    }
  }

  // Ensure devices array exists (backward compat)
  if (!config.devices) (config as any).devices = [];
  if (!config.dockerHosts) (config as any).dockerHosts = [];
  if (!config.localEvents) config.localEvents = [];

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
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
  }

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
      layout: body.layout || 'standard',
    };
    config.categories.push(newCategory);
    
    // Automatically expand the grid by 1 slot so an empty dropzone immediately appears
    if (!config.settings) config.settings = {} as any;
    const currentSlots = config.settings.totalSlots || Math.max(12, config.categories.length - 1);
    if (currentSlots < config.categories.length + 1) {
       config.settings.totalSlots = config.categories.length + 1;
    }

    // Écrit à la fois la config (slots) et les services
    writeConfig(config);
    return NextResponse.json(newCategory, { status: 201 });
  }

  if (type === 'service') {
    const catIndex = config.categories.findIndex(c => c.id === body.categoryId);
    if (catIndex === -1) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

    const newService: Service = {
      id: uuidv4(),
      name: body.name || 'Nouveau',
      logo: body.logo || '',
      localUrl: body.localUrl || '',
      secondaryUrl: body.secondaryUrl || '',
      secondaryLogo: body.secondaryLogo || '',
    };
    config.categories[catIndex].services.push(newService);
    
    // N'écrit que le fichier services.json
    writeServices(config.categories);
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
      statStyle: body.statStyle || 'horizontal',
      hideValues: body.hideValues || false,
      colsDesktop: body.colsDesktop !== undefined ? body.colsDesktop : 3,
      colsMobile: body.colsMobile !== undefined ? body.colsMobile : 3,
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
  if (type === 'dockerAction') {
    if (!config.dockerActions) config.dockerActions = [];
    const newAction = {
      id: uuidv4(),
      name: body.name || 'New Action',
      icon: body.icon || 'Play',
      actionType: body.actionType || 'start',
      targets: body.targets || [],
    };
    config.dockerActions.push(newAction);
    writeConfig(config);
    return NextResponse.json(newAction, { status: 201 });
  }
  if (type === 'localEvent') {
    if (!config.localEvents) config.localEvents = [];
    const newEvent = {
      id: uuidv4(),
      title: body.title || 'Nouvel événement',
      start: body.start,
      end: body.end,
      description: body.description,
      isAllDay: body.isAllDay || false
    };
    config.localEvents.push(newEvent);
    
    // N'écrit que le calendrier
    writeCalendar(config.localEvents);
    return NextResponse.json(newEvent, { status: 201 });
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
}

export async function PUT(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
  }

  const body = await req.json();
  const config = readConfig();
  const { type } = body;

  if (type === 'reorder') {
    config.categories = body.categories;
    writeServices(config.categories);
    return NextResponse.json({ ok: true });
  }

  if (type === 'reorderDevices') {
    if (!config.devices) config.devices = [];

    // Preserve sensitive tokens from existing devices
    const newDevices = body.devices.map((newDevice: any) => {
      const existingDevice = (config.devices || []).find((d: any) => d.id === newDevice.id);
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
    if (body.layout !== undefined) cat.layout = body.layout;
    writeServices(config.categories);
    return NextResponse.json(cat);
  }

  if (type === 'service') {
    for (const cat of config.categories) {
      const svc = cat.services.find(s => s.id === body.id);
      if (svc) {
        if (body.name !== undefined) svc.name = body.name;
        if (body.logo !== undefined) svc.logo = body.logo;
        if (body.localUrl !== undefined) svc.localUrl = body.localUrl;
        if (body.secondaryUrl !== undefined) svc.secondaryUrl = body.secondaryUrl;
        if (body.secondaryLogo !== undefined) svc.secondaryLogo = body.secondaryLogo;
        // Keep tailscaleUrl setter for backwards compatibility if clients still send it
        if (body.tailscaleUrl !== undefined) svc.tailscaleUrl = body.tailscaleUrl;
        writeServices(config.categories);
        return NextResponse.json(svc);
      }
    }
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (type === 'settings') {
    if (!config.settings) (config as any).settings = {};

    if (body.title !== undefined) config.settings.title = body.title;
    if (body.titleMobile !== undefined) config.settings.titleMobile = body.titleMobile;
    if (body.titleLogo !== undefined) config.settings.titleLogo = body.titleLogo;
    if (body.titleFont !== undefined) config.settings.titleFont = body.titleFont;
    if (body.titleAnimation !== undefined) config.settings.titleAnimation = body.titleAnimation;
    if (body.showMonitor !== undefined) config.settings.showMonitor = body.showMonitor;
    if (body.totalSlots !== undefined) config.settings.totalSlots = body.totalSlots;
    if (body.tailscaleTailnet !== undefined) config.settings.tailscaleTailnet = body.tailscaleTailnet;
    if (body.tailscaleClientId !== undefined) config.settings.tailscaleClientId = body.tailscaleClientId;
    
    // Prevent overwriting secrets with masked values
    if (body.tailscaleClientSecret !== undefined && body.tailscaleClientSecret !== '********') {
      config.settings.tailscaleClientSecret = body.tailscaleClientSecret;
    }
    
    if (body.dockPosition !== undefined) config.settings.dockPosition = body.dockPosition;
    if (body.hideDock !== undefined) config.settings.hideDock = body.hideDock;

    
    if (body.extensionOrder !== undefined) config.settings.tabOrder = body.extensionOrder;
    if (body.tabOrder !== undefined) config.settings.tabOrder = body.tabOrder;
    if (body.widgetsOrder !== undefined) config.settings.widgetsOrder = body.widgetsOrder;
    if (body.widgetsTotalSlots !== undefined) config.settings.widgetsTotalSlots = body.widgetsTotalSlots;
    
    if (body.hiddenExtensions !== undefined) config.settings.hiddenTabs = body.hiddenExtensions;
    if (body.hiddenTabs !== undefined) config.settings.hiddenTabs = body.hiddenTabs;
    if (body.tabIcons !== undefined) config.settings.tabIcons = body.tabIcons;
    if (body.theme !== undefined) config.settings.theme = body.theme;
    if (body.tabs !== undefined) config.settings.tabs = body.tabs;
    if (body.homeWidgets !== undefined) config.settings.homeWidgets = body.homeWidgets;
    if (body.panels !== undefined) config.settings.panels = body.panels;
    if (body.networkTopology !== undefined) config.settings.networkTopology = body.networkTopology;

    // Advanced UI Customization Toggles
    if (body.hideWidgetTitles !== undefined) config.settings.hideWidgetTitles = body.hideWidgetTitles;
    if (body.hideCategoryTitles !== undefined) config.settings.hideCategoryTitles = body.hideCategoryTitles;
    if (body.categoryTitlePosition !== undefined) config.settings.categoryTitlePosition = body.categoryTitlePosition;
    if (body.calendarUrl !== undefined) config.settings.calendarUrl = body.calendarUrl;
    if (body.clockDesign !== undefined) config.settings.clockDesign = body.clockDesign;
    if (body.clockTimezone !== undefined) config.settings.clockTimezone = body.clockTimezone;
    if (body.customCss !== undefined) config.settings.customCss = sanitizeCustomCss(body.customCss);
    if (body.backgroundImage !== undefined) config.settings.backgroundImage = body.backgroundImage;
    if (body.mobileWallpaper !== undefined) config.settings.mobileWallpaper = body.mobileWallpaper;
    if (body.enablePerfMonitor !== undefined) config.settings.enablePerfMonitor = body.enablePerfMonitor;
    
    // Dynamically save all widget specific states (hide[Widget], [widget]Sidebar, [widget]Order)
    Object.keys(body).forEach(key => {
      if (key.startsWith('hide') || key.endsWith('Sidebar') || key.endsWith('Order') || key.endsWith('Props')) {
        (config.settings as any)[key] = body[key];
      }
    });
    if (body.weatherLocation !== undefined) config.settings.weatherLocation = body.weatherLocation;
    if (body.weatherLocations !== undefined) config.settings.weatherLocations = body.weatherLocations;
    if (body.activeWeatherLocationId !== undefined) config.settings.activeWeatherLocationId = body.activeWeatherLocationId;
    if (body.weatherWidgetStyle !== undefined) config.settings.weatherWidgetStyle = body.weatherWidgetStyle;
    if (body.dockerContainersStyle !== undefined) config.settings.dockerContainersStyle = body.dockerContainersStyle;
    if (body.dockerContainersAutoScroll !== undefined) config.settings.dockerContainersAutoScroll = body.dockerContainersAutoScroll;
    if (body.allowDockerActions !== undefined) config.settings.allowDockerActions = body.allowDockerActions;
    
    // Appearance Profiles
    if (body.appearanceProfiles !== undefined) {
      config.appearanceProfiles = body.appearanceProfiles;
    }
    if (body.mobileAppearanceProfiles !== undefined) {
      config.settings.mobileAppearanceProfiles = body.mobileAppearanceProfiles;
    }
    
    if (body.globalFont !== undefined) config.settings.globalFont = body.globalFont;
    if (body.borderRadius !== undefined) config.settings.borderRadius = body.borderRadius;
    if (body.cardOpacity !== undefined) config.settings.cardOpacity = body.cardOpacity;
    if (body.emojiTheme !== undefined) config.settings.emojiTheme = body.emojiTheme;
    
    // Header & Mobile Customizations
    if (body.headerLayoutDesktop !== undefined) config.settings.headerLayoutDesktop = body.headerLayoutDesktop;
    if (body.headerLayoutMobile !== undefined) config.settings.headerLayoutMobile = body.headerLayoutMobile;
    if (body.hideHeaderTitle !== undefined) config.settings.hideHeaderTitle = body.hideHeaderTitle;
    if (body.hideHeaderSearch !== undefined) config.settings.hideHeaderSearch = body.hideHeaderSearch;
    if (body.hideHeaderMenu !== undefined) config.settings.hideHeaderMenu = body.hideHeaderMenu;
    if (body.showHeaderMenuIcons !== undefined) config.settings.showHeaderMenuIcons = body.showHeaderMenuIcons;
    if (body.showPingDetails !== undefined) config.settings.showPingDetails = body.showPingDetails;
    if (body.pingIndicatorMode !== undefined) config.settings.pingIndicatorMode = body.pingIndicatorMode;
    if (body.mobileTheme !== undefined) config.settings.mobileTheme = body.mobileTheme;
    if (body.mobileGlobalFont !== undefined) config.settings.mobileGlobalFont = body.mobileGlobalFont;
    if (body.mobileBorderRadius !== undefined) config.settings.mobileBorderRadius = body.mobileBorderRadius;
    if (body.mobileCardOpacity !== undefined) config.settings.mobileCardOpacity = body.mobileCardOpacity;
    if (body.mobileTitleAnimation !== undefined) config.settings.mobileTitleAnimation = body.mobileTitleAnimation;
    if (body.securityMode !== undefined) config.settings.securityMode = body.securityMode;
    
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
    if (body.statStyle !== undefined) device.statStyle = body.statStyle;
    if (body.hideValues !== undefined) device.hideValues = body.hideValues;
    if (body.colsDesktop !== undefined) device.colsDesktop = body.colsDesktop;
    if (body.colsMobile !== undefined) device.colsMobile = body.colsMobile;

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
          const oldToken = !isChangingPlatform ? (oldApiObj.token || '') : '';
          const colonIdx = oldToken.indexOf(':');
          const oldPassword = colonIdx !== -1 ? oldToken.substring(colonIdx + 1) : '';
          const newPassword = body.api.password || oldPassword;

          if (body.api.username || newPassword) {
            const authStr = `${body.api.username || ''}:${newPassword}`;
            device.api.token = authStr;
          } else {
            device.api.token = undefined; // Cleared
          }
        }
      } else if (body.api.type === 'homeassistant') {
        device.api.url = `http://${body.api.ip}:${body.api.port || 8123}/api/states`;
        if (updatingCredentials) {
          const newPassword = body.api.password || (!isChangingPlatform ? oldApiObj.token : '');
          device.api.token = newPassword || undefined;
        }
      } else if (body.api.type === 'proxmox') {
        const baseUrl = `https://${body.api.ip}:${body.api.port || 8006}/api2/json/nodes/${body.api.nodeName || 'pve'}`;
        if (body.api.vmid) {
          device.api.url = `${baseUrl}/${body.api.vmType || 'qemu'}/${body.api.vmid}/status/current`;
        } else {
          device.api.url = `${baseUrl}/status`;
        }
        if (updatingCredentials) {
          const oldToken = !isChangingPlatform ? (oldApiObj.token || '') : '';
          const eqIdx = oldToken.indexOf('=');
          const oldPassword = eqIdx !== -1 ? oldToken.substring(eqIdx + 1) : '';
          const newPassword = body.api.password || oldPassword;

          if (body.api.username && newPassword) {
            const fullToken = `${body.api.username}=${newPassword}`;
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

  if (type === 'homeWidgetProps') {
    if (!config.settings.homeWidgets) config.settings.homeWidgets = [];
    const widget = config.settings.homeWidgets.find((w: any) => w.id === body.id);
    if (!widget) return NextResponse.json({ error: 'Widget not found' }, { status: 404 });
    if (!widget.props) widget.props = {};
    widget.props = { ...widget.props, ...body.props };
    writeConfig(config);
    return NextResponse.json(widget);
  }

  if (type === 'reorderDockerActions') {
    if (!config.dockerActions) config.dockerActions = [];
    config.dockerActions = body.dockerActions;
    writeConfig(config);
    return NextResponse.json({ ok: true });
  }

  if (type === 'dockerAction') {
    if (!config.dockerActions) config.dockerActions = [];
    const action = config.dockerActions.find((a: any) => a.id === body.id);
    if (!action) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (body.name !== undefined) action.name = body.name;
    if (body.icon !== undefined) action.icon = body.icon;
    if (body.actionType !== undefined) action.actionType = body.actionType;
    if (body.targets !== undefined) action.targets = body.targets;

    writeConfig(config);
    return NextResponse.json(action);
  }

  if (type === 'localEvent') {
    if (!config.localEvents) config.localEvents = [];
    const event = config.localEvents.find((e: any) => e.id === body.id);
    if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (body.title !== undefined) event.title = body.title;
    if (body.start !== undefined) event.start = body.start;
    if (body.end !== undefined) event.end = body.end;
    if (body.description !== undefined) event.description = body.description;
    if (body.isAllDay !== undefined) event.isAllDay = body.isAllDay;

    writeCalendar(config.localEvents);
    return NextResponse.json(event);
  }

  return NextResponse.json({ error: 'Unknown update type' }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const id = searchParams.get('id');

  if (!type || !id) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

  const config = readConfig();

  if (type === 'category') {
    config.categories = config.categories.filter(c => c.id !== id);
    writeConfig(config); // Écrit la config de base et services
    return NextResponse.json({ ok: true });
  }

  if (type === 'service') {
    for (const cat of config.categories) {
      cat.services = cat.services.filter(s => s.id !== id);
    }
    writeServices(config.categories);
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

  if (type === 'dockerAction') {
    if (!config.dockerActions) config.dockerActions = [];
    config.dockerActions = config.dockerActions.filter((a: any) => a.id !== id);
    writeConfig(config);
    return NextResponse.json({ ok: true });
  }

  if (type === 'localEvent') {
    if (!config.localEvents) config.localEvents = [];
    config.localEvents = config.localEvents.filter((e: any) => e.id !== id);
    writeCalendar(config.localEvents);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
}
