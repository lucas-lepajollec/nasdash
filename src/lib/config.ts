import fs from 'fs';
import path from 'path';
import https from 'https';
import { DashboardConfig } from './types';
import { encrypt, decrypt } from './crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const SERVICES_PATH = path.join(DATA_DIR, 'services.json');
const TOPOLOGY_PATH = path.join(DATA_DIR, 'topology.json');
const CALENDAR_PATH = path.join(DATA_DIR, 'calendar.json');
const LOGOS_DIR = path.join(DATA_DIR, 'logos');

const globalAny: any = global;
if (!globalAny.__cachedConfig) globalAny.__cachedConfig = null;
if (!globalAny.__cachedServices) globalAny.__cachedServices = null;
if (!globalAny.__cachedTopology) globalAny.__cachedTopology = null;
if (!globalAny.__cachedCalendar) globalAny.__cachedCalendar = null;

export function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(LOGOS_DIR)) fs.mkdirSync(LOGOS_DIR, { recursive: true });
  } catch (e) {
    console.error('⚠️ ERREUR DE PERMISSION : Impossible d\'écrire dans /app/data. Vérifiez les droits (chmod 777) sur l\'hôte.', e);
  }
}

export function safeWriteFileSync(filePath: string, data: string | Buffer, options?: fs.WriteFileOptions) {
  ensureDataDir();
  const tempPath = filePath + '.tmp';
  try {
    fs.writeFileSync(tempPath, data, options);
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {}
    throw err;
  }
}

export function readConfig(): DashboardConfig {
  ensureDataDir();

  // 1. Lire la configuration de base (avec cache + mtime)
  let shouldReadConfig = !globalAny.__cachedConfig;
  try {
    const mtime = fs.statSync(CONFIG_PATH).mtimeMs;
    if (!globalAny.__cachedConfigMtime || mtime !== globalAny.__cachedConfigMtime) {
      shouldReadConfig = true;
      globalAny.__cachedConfigMtime = mtime;
    }
  } catch {}

  let configData: any = null;
  let needDefault = false;

  if (globalAny.__cachedConfig && !shouldReadConfig) {
    configData = JSON.parse(JSON.stringify(globalAny.__cachedConfig));
  } else {
    if (!fs.existsSync(CONFIG_PATH)) {
      needDefault = true;
    } else {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8').trim();
      if (!raw || raw === '{}' || raw === '[]') {
        needDefault = true;
      } else {
        try {
          configData = JSON.parse(raw);
          // Minimal validation to consider it's not "empty"
          if (!configData || (!configData.categories && !configData.devices && !configData.settings)) {
            needDefault = true;
          }
        } catch (e) {
          needDefault = true;
        }
      }
    }

    if (needDefault || !configData) {
      const examplePath = path.join(DATA_DIR, 'config.example.json');
      if (fs.existsSync(examplePath)) {
        try {
          fs.copyFileSync(examplePath, CONFIG_PATH);
          configData = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
          // Set mtime to cache
          try {
            globalAny.__cachedConfigMtime = fs.statSync(CONFIG_PATH).mtimeMs;
          } catch {}
        } catch (e) {
          console.error('⚠️ ERREUR DE PERMISSION ou de lecture lors de la copie de config.example.json :', e);
        }
      }

      if (!configData) {
        configData = getDefaultConfig();
        try {
          safeWriteFileSync(CONFIG_PATH, JSON.stringify(configData, null, 2));
          try {
            globalAny.__cachedConfigMtime = fs.statSync(CONFIG_PATH).mtimeMs;
          } catch {}
        } catch (e) {
          console.error('⚠️ ERREUR DE PERMISSION : Impossible de créer data/config.json. Configuration utilisée en mémoire.', e);
        }
      }
    }

    // --- MIGRATION AUTOMATIQUE TRANSPARENTE EN 4 FICHIERS ---
    let migrated = false;

    // A. Migration des catégories/services vers services.json
    if (configData.categories && configData.categories.length > 0) {
      if (!fs.existsSync(SERVICES_PATH)) {
        safeWriteFileSync(SERVICES_PATH, JSON.stringify(configData.categories, null, 2));
      }
      delete configData.categories;
      migrated = true;
    }

    // B. Migration de networkTopology vers topology.json
    if (configData.settings && configData.settings.networkTopology) {
      if (!fs.existsSync(TOPOLOGY_PATH)) {
        safeWriteFileSync(TOPOLOGY_PATH, JSON.stringify(configData.settings.networkTopology, null, 2));
      }
      delete configData.settings.networkTopology;
      migrated = true;
    }

    // C. Migration des localEvents vers calendar.json
    if (configData.localEvents && configData.localEvents.length > 0) {
      if (!fs.existsSync(CALENDAR_PATH)) {
        safeWriteFileSync(CALENDAR_PATH, JSON.stringify(configData.localEvents, null, 2));
      }
      delete configData.localEvents;
      migrated = true;
    }

    // D. Migration vers la configuration par panneaux (panels)
    if (configData.settings && !configData.settings.panels) {
      migrateConfigToPanels(configData);
      migrated = true;
    }

    if (migrated) {
      try {
        safeWriteFileSync(CONFIG_PATH, JSON.stringify(configData, null, 2));
        try {
          globalAny.__cachedConfigMtime = fs.statSync(CONFIG_PATH).mtimeMs;
        } catch {}
      } catch (e) {
        console.error('⚠️ ERREUR : Impossible d\'enregistrer la configuration migrée.', e);
      }
    }

    // Déchiffrer les paramètres sensibles avant la mise en cache en mémoire
    if (configData.settings?.tailscaleClientSecret) {
      configData.settings.tailscaleClientSecret = decrypt(configData.settings.tailscaleClientSecret);
    }
    if (configData.devices) {
      configData.devices.forEach((device: any) => {
        if (device.api?.token) {
          device.api.token = decrypt(device.api.token);
        }
      });
    }

    globalAny.__cachedConfig = JSON.parse(JSON.stringify(configData));
  }

  // 2. Charger les Services / Catégories (avec cache + mtime)
  let shouldReadServices = !globalAny.__cachedServices;
  try {
    const mtime = fs.statSync(SERVICES_PATH).mtimeMs;
    if (!globalAny.__cachedServicesMtime || mtime !== globalAny.__cachedServicesMtime) {
      shouldReadServices = true;
      globalAny.__cachedServicesMtime = mtime;
    }
  } catch {}

  let categories: any[] = [];
  if (globalAny.__cachedServices && !shouldReadServices) {
    categories = JSON.parse(JSON.stringify(globalAny.__cachedServices));
  } else {
    if (!fs.existsSync(SERVICES_PATH)) {
      const examplePath = path.join(DATA_DIR, 'services.example.json');
      if (fs.existsSync(examplePath)) {
        try {
          fs.copyFileSync(examplePath, SERVICES_PATH);
        } catch (e) {
          console.error('Erreur copie services.example.json', e);
        }
      }
    }
    if (fs.existsSync(SERVICES_PATH)) {
      try {
        categories = JSON.parse(fs.readFileSync(SERVICES_PATH, 'utf-8'));
      } catch (e) {
        console.error('Erreur lecture services.json', e);
      }
    } else {
      categories = [];
    }
    globalAny.__cachedServices = JSON.parse(JSON.stringify(categories));
  }

  // 3. Charger la Topologie (avec cache + mtime)
  let shouldReadTopology = !globalAny.__cachedTopology;
  try {
    const mtime = fs.statSync(TOPOLOGY_PATH).mtimeMs;
    if (!globalAny.__cachedTopologyMtime || mtime !== globalAny.__cachedTopologyMtime) {
      shouldReadTopology = true;
      globalAny.__cachedTopologyMtime = mtime;
    }
  } catch {}

  let topology: any = { nodes: [], groups: [], connections: [] };
  if (globalAny.__cachedTopology && !shouldReadTopology) {
    topology = JSON.parse(JSON.stringify(globalAny.__cachedTopology));
  } else {
    if (!fs.existsSync(TOPOLOGY_PATH)) {
      const examplePath = path.join(DATA_DIR, 'topology.example.json');
      if (fs.existsSync(examplePath)) {
        try {
          fs.copyFileSync(examplePath, TOPOLOGY_PATH);
        } catch (e) {
          console.error('Erreur copie topology.example.json', e);
        }
      }
    }
    if (fs.existsSync(TOPOLOGY_PATH)) {
      try {
        topology = JSON.parse(fs.readFileSync(TOPOLOGY_PATH, 'utf-8'));
      } catch (e) {
        console.error('Erreur lecture topology.json', e);
      }
    }
    globalAny.__cachedTopology = JSON.parse(JSON.stringify(topology));
  }

  // 4. Charger le Calendrier (avec cache + mtime)
  let shouldReadCalendar = !globalAny.__cachedCalendar;
  try {
    const mtime = fs.statSync(CALENDAR_PATH).mtimeMs;
    if (!globalAny.__cachedCalendarMtime || mtime !== globalAny.__cachedCalendarMtime) {
      shouldReadCalendar = true;
      globalAny.__cachedCalendarMtime = mtime;
    }
  } catch {}

  let localEvents: any[] = [];
  if (globalAny.__cachedCalendar && !shouldReadCalendar) {
    localEvents = JSON.parse(JSON.stringify(globalAny.__cachedCalendar));
  } else {
    if (!fs.existsSync(CALENDAR_PATH)) {
      const examplePath = path.join(DATA_DIR, 'calendar.example.json');
      if (fs.existsSync(examplePath)) {
        try {
          fs.copyFileSync(examplePath, CALENDAR_PATH);
        } catch (e) {
          console.error('Erreur copie calendar.example.json', e);
        }
      }
    }
    if (fs.existsSync(CALENDAR_PATH)) {
      try {
        localEvents = JSON.parse(fs.readFileSync(CALENDAR_PATH, 'utf-8'));
      } catch (e) {
        console.error('Erreur lecture calendar.json', e);
      }
    } else {
      localEvents = [];
    }
    globalAny.__cachedCalendar = JSON.parse(JSON.stringify(localEvents));
  }

  // 5. Assembler pour assurer la compatibilité
  const fullConfig: DashboardConfig = {
    ...configData,
    categories,
    localEvents,
    settings: {
      ...configData.settings,
      networkTopology: topology
    }
  };

  if (fullConfig.categories) {
    fullConfig.categories.forEach((cat: any) => {
      if (cat.services) {
        cat.services.forEach((svc: any) => {
          if (svc.tailscaleUrl && !svc.secondaryUrl) {
            svc.secondaryUrl = svc.tailscaleUrl;
          }
        });
      }
    });
  }

  return fullConfig;
}

export function writeConfig(config: DashboardConfig) {
  const baseConfig = JSON.parse(JSON.stringify(config));
  const categories = baseConfig.categories || [];
  const topology = baseConfig.settings?.networkTopology || { nodes: [], groups: [], connections: [] };
  const localEvents = baseConfig.localEvents || [];

  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    const cacheConfig = JSON.parse(JSON.stringify(config));
    delete cacheConfig.categories;
    delete cacheConfig.localEvents;
    if (cacheConfig.settings) {
      delete cacheConfig.settings.networkTopology;
    }
    globalAny.__cachedConfig = cacheConfig;
    globalAny.__cachedServices = JSON.parse(JSON.stringify(categories));
    globalAny.__cachedTopology = JSON.parse(JSON.stringify(topology));
    globalAny.__cachedCalendar = JSON.parse(JSON.stringify(localEvents));
    return;
  }

  ensureDataDir();

  delete baseConfig.categories;
  delete baseConfig.localEvents;
  if (baseConfig.settings) {
    delete baseConfig.settings.networkTopology;
  }

  // Chiffrer les secrets avant l'écriture sur le disque
  if (baseConfig.settings?.tailscaleClientSecret) {
    baseConfig.settings.tailscaleClientSecret = encrypt(baseConfig.settings.tailscaleClientSecret);
  }
  if (baseConfig.devices) {
    baseConfig.devices.forEach((device: any) => {
      if (device.api?.token && device.api.token !== '********') {
        device.api.token = encrypt(device.api.token);
      }
    });
  }

  try {
    safeWriteFileSync(CONFIG_PATH, JSON.stringify(baseConfig, null, 2));
    
    // Mettre en cache la version déchiffrée en mémoire
    const cacheConfig = JSON.parse(JSON.stringify(config));
    delete cacheConfig.categories;
    delete cacheConfig.localEvents;
    if (cacheConfig.settings) {
      delete cacheConfig.settings.networkTopology;
    }
    globalAny.__cachedConfig = cacheConfig;
  } catch (e) {
    console.error('⚠️ ERREUR DE PERMISSION : Impossible d\'écrire dans data/config.json', e);
  }

  try {
    safeWriteFileSync(SERVICES_PATH, JSON.stringify(categories, null, 2));
    globalAny.__cachedServices = JSON.parse(JSON.stringify(categories));
  } catch (e) {
    console.error('⚠️ ERREUR DE PERMISSION : Impossible d\'écrire dans data/services.json', e);
  }

  try {
    safeWriteFileSync(TOPOLOGY_PATH, JSON.stringify(topology, null, 2));
    globalAny.__cachedTopology = JSON.parse(JSON.stringify(topology));
  } catch (e) {
    console.error('⚠️ ERREUR DE PERMISSION : Impossible d\'écrire dans data/topology.json', e);
  }

  try {
    safeWriteFileSync(CALENDAR_PATH, JSON.stringify(localEvents, null, 2));
    globalAny.__cachedCalendar = JSON.parse(JSON.stringify(localEvents));
  } catch (e) {
    console.error('⚠️ ERREUR DE PERMISSION : Impossible d\'écrire dans data/calendar.json', e);
  }
}

export function writeServices(categories: any[]) {
  globalAny.__cachedServices = JSON.parse(JSON.stringify(categories));
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return;
  }
  ensureDataDir();
  try {
    safeWriteFileSync(SERVICES_PATH, JSON.stringify(categories, null, 2));
  } catch (e) {
    console.error('⚠️ ERREUR DE PERMISSION : Impossible d\'écrire dans data/services.json', e);
  }
}

export function writeTopology(topology: any) {
  globalAny.__cachedTopology = JSON.parse(JSON.stringify(topology));
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return;
  }
  ensureDataDir();
  try {
    safeWriteFileSync(TOPOLOGY_PATH, JSON.stringify(topology, null, 2));
  } catch (e) {
    console.error('⚠️ ERREUR DE PERMISSION : Impossible d\'écrire dans data/topology.json', e);
  }
}

export function writeCalendar(calendar: any[]) {
  globalAny.__cachedCalendar = JSON.parse(JSON.stringify(calendar));
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return;
  }
  ensureDataDir();
  try {
    safeWriteFileSync(CALENDAR_PATH, JSON.stringify(calendar, null, 2));
  } catch (e) {
    console.error('⚠️ ERREUR DE PERMISSION : Impossible d\'écrire dans data/calendar.json', e);
  }
}

export function getLogosDir() {
  ensureDataDir();
  return LOGOS_DIR;
}

function getDefaultConfig(): DashboardConfig {
  const examplePath = path.join(DATA_DIR, 'config.example.json');
  if (fs.existsSync(examplePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(examplePath, 'utf-8'));
      delete parsed.categories;
      delete parsed.localEvents;
      if (parsed.settings) delete parsed.settings.networkTopology;
      return parsed;
    } catch (e) {
      console.error('Erreur lecture config.example.json', e);
    }
  }

  return {
    version: 1,
    settings: {
      title: 'HOME LAB',
      showMonitor: true,
      totalSlots: 10,
      hideDockerActions: true,
      hideCalendar: true
    },
    devices: [],
    categories: [],
    localEvents: []
  };
}

// --- Smart Logger to avoid spamming errors ---
if (!globalAny.__errorLogCache) globalAny.__errorLogCache = new Map<string, string>();
const errorLogCache: Map<string, string> = globalAny.__errorLogCache;

function logErrorSmartly(deviceId: string, context: string, errorMsg: string) {
  const key = `${deviceId}-${context}`;
  if (errorLogCache.get(key) !== errorMsg) {
    console.error(`🔴 [${context}]`, errorMsg);
    errorLogCache.set(key, errorMsg);
  }
}

function clearErrorSmartly(deviceId: string, context: string) {
  errorLogCache.delete(`${deviceId}-${context}`);
}
// ---------------------------------------------

if (!globalAny.__devicesStatusCache) globalAny.__devicesStatusCache = {};
export const devicesStatusCache: Record<string, { online: boolean; stats?: any; updatedAt: number; error?: string; isOffline?: boolean }> = globalAny.__devicesStatusCache;

if (globalAny.activeClients === undefined) globalAny.activeClients = 0;

export function incrementActiveClients() {
  globalAny.activeClients++;
  if (globalAny.activeClients === 1) {
    startBackgroundMonitoring();
  }
}

export function decrementActiveClients() {
  globalAny.activeClients = Math.max(0, globalAny.activeClients - 1);
  if (globalAny.activeClients === 0 && globalAny.__monitoringInterval) {
    clearInterval(globalAny.__monitoringInterval);
    globalAny.__monitoringInterval = null;
    console.log('🛑 Arrêt du Background Monitoring des appareils (Aucun client actif)...');
  }
}

if (!globalAny.__glancesUrlCache) globalAny.__glancesUrlCache = {};
const glancesUrlCache: Record<string, string> = globalAny.__glancesUrlCache;
export function startBackgroundMonitoring() {
  if (globalAny.__monitoringInterval) {
    return;
  }
  console.log('🚀 Démarrage du Background Monitoring des appareils (Toutes les 10s)...');

  const interpolateEnv = (str: string) => str.replace(/\${([^}]+)}/g, (_, v) => process.env[v] || '');

  const fetchProxmox = (urlStr: string, token: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      const url = new URL(urlStr);
      const options = {
        hostname: url.hostname,
        port: url.port || 8006,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'Authorization': `PVEAPIToken=${token}`,
          'Accept': 'application/json'
        },
        agent: new https.Agent({ rejectUnauthorized: false }), // BYPASS SELF-SIGNED SECRETS
        timeout: 4000
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`Proxmox SSL/API Error: ${res.statusCode} ${res.statusMessage}`));
            return;
          }
          try {
            resolve(JSON.parse(data).data); // Proxmox nests everything under .data
          } catch (e) {
            reject(new Error('Invalid JSON from Proxmox'));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      req.end();
    });
  };

  const doPoll = async () => {
    try {
      // Toujours lire la configuration la plus à jour (en cas de modif)
      const currentConfig = readConfig();
      if (!currentConfig.devices) return;

      const promises = currentConfig.devices.map(async (device) => {
        if (!device.api) {
          devicesStatusCache[device.id] = { online: true, stats: device.stats || [], updatedAt: Date.now() };
          return;
        }

        const id = device.id;
        const apiUrl = device.api.url ? interpolateEnv(device.api.url) : '';

        if (device.api.type === 'glances') {
          if (!apiUrl) {
            devicesStatusCache[id] = { online: false, error: 'URL Glances manquante.', isOffline: true, updatedAt: Date.now() };
            return;
          }

          let baseUrl = apiUrl;
          if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

           let fetchUrls: string[] = [];
          if (glancesUrlCache[id]) {
            fetchUrls.push(glancesUrlCache[id]);
          } else if (baseUrl.endsWith('/all')) {
            fetchUrls.push(baseUrl);
          } else {
            let base = baseUrl;
            if (base.match(/\/api\/\d+$/)) {
              base = base.substring(0, base.lastIndexOf('/api/'));
            }
            const endpoints = ['/api/5/all', '/api/4/all', '/api/3/all', '/api/2/all'];
            for (const ep of endpoints) fetchUrls.push(`${base}${ep}`);
            fetchUrls = Array.from(new Set(fetchUrls));
          }

          try {
            const headers: Record<string, string> = {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            };
            if (device.api.token) {
              const authString = interpolateEnv(device.api.token);
              if (authString.trim() !== '' && authString !== ':') {
                const base64Credentials = typeof btoa === 'function' ? btoa(authString) : Buffer.from(authString).toString('base64');
                headers['Authorization'] = `Basic ${base64Credentials}`;
              }
            }

            let res: Response | null = null;
            let lastError: any = null;
            let finalUrl = '';

            for (const url of fetchUrls) {
              try {
                res = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(4000) });
                if (res.ok) { finalUrl = url; glancesUrlCache[id] = url; break; }
                if (res.status !== 404) { finalUrl = url; break; }
              } catch (e) {
                lastError = e;
              }
            }

            if (!res || !res.ok) {
              if (res) {
                logErrorSmartly(id, 'Glances', `Erreur HTTP: ${res.status} ${res.statusText}`);
                devicesStatusCache[id] = { online: false, error: `Erreur serveur (${res.status})`, isOffline: true, updatedAt: Date.now() };
              } else {
                logErrorSmartly(id, 'Glances', `Fetch Error: ${lastError?.message || lastError}`);
                devicesStatusCache[id] = { online: false, error: 'Impossible de joindre Glances', isOffline: true, updatedAt: Date.now() };
              }
              return;
            }

            const text = await res.text();
            let data;
            try {
              data = JSON.parse(text);
            } catch (e) {
              logErrorSmartly(id, 'Glances HTML', `Reçu HTML au lieu de JSON sur ${finalUrl}`);
              devicesStatusCache[id] = { online: false, error: 'Réponse invalide (HTML)', isOffline: true, updatedAt: Date.now() };
              return;
            }

            const stats = [];
            let cpuTemp = '';
            let diskTemp = '';
            if (data?.sensors && Array.isArray(data.sensors)) {
              const getSensor = (kws: string[]) => data.sensors.find((s: any) => kws.some(kw => s.label?.toLowerCase().includes(kw)));
              const cpuS = getSensor(['package', 'tctl', 'tdie']) || getSensor(['core']) || getSensor(['cpu']) || getSensor(['acpitz']);
              if (typeof cpuS?.value === 'number') cpuTemp = ` ${Math.round(cpuS.value)}°C`;

              const diskS = data.sensors.find((s: any) => ['nvme', 'sda', 'disk', 'hdd', 'temp1'].some(keyword => s.label?.toLowerCase().includes(keyword)) && !['cpu', 'core'].some(keyword => s.label?.toLowerCase().includes(keyword)));
              if (typeof diskS?.value === 'number') diskTemp = ` ${Math.round(diskS.value)}°C`;
            }

            if (data?.cpu?.total !== undefined) {
              const tStr = cpuTemp ? `\u00A0\u00A0${cpuTemp.trim()}` : '';
              stats.push({ label: 'CPU', value: `${data.cpu.total.toFixed(1)}%${tStr}`, percent: data.cpu.total, color: 'var(--nd-accent)' });
            }

            if (data?.mem?.percent !== undefined) {
              const parts = [`${data.mem.percent.toFixed(1)}%`];
              if (data.mem.total) {
                const gb = data.mem.total / 1024 / 1024 / 1024;
                if (gb >= 1000) {
                  parts.push(`(${(gb / 1000).toFixed(1).replace('.', ',')} To)`);
                } else {
                  parts.push(`(${gb.toFixed(0)} Go)`);
                }
              }
              stats.push({ label: 'RAM', value: parts.join('\u00A0\u00A0'), percent: data.mem.percent, color: 'var(--nd-green)' });
            }

            if (data?.fs && Array.isArray(data.fs)) {
              const excludeKeywords = ['boot', 'efi', 'overlay', 'tmpfs', 'docker'];
              let filteredDisks = data.fs.filter((disk: any) => {
                if (!disk.mnt_point) return false;
                const lowerMnt = disk.mnt_point.toLowerCase();
                return !excludeKeywords.some(kw => lowerMnt.includes(kw));
              });

              const uniqueDisks = new Map<number, any>();
              for (const disk of filteredDisks) {
                if (!disk.size) continue;
                const existing = uniqueDisks.get(disk.size);
                if (!existing || disk.mnt_point.length < existing.mnt_point.length) {
                  uniqueDisks.set(disk.size, disk);
                }
              }

              let finalDisks = Array.from(uniqueDisks.values());
              for (const disk of finalDisks) {
                let totalStr = '';
                if (disk.size) {
                  const gb = disk.size / 1024 / 1024 / 1024;
                  if (gb >= 1000) {
                    const tb = gb / 1000;
                    totalStr = tb.toFixed(1).replace('.', ',') + ' To';
                  } else {
                    totalStr = gb.toFixed(0) + ' Go';
                  }
                }

                let displayName = disk.mnt_point;
                if (displayName && displayName !== '/') {
                  const parts = displayName.split('/').filter(Boolean);
                  displayName = parts.pop() || displayName;
                }

                const parts = [`${disk.percent.toFixed(1)}%`];
                if (diskTemp) parts.push(diskTemp.trim());
                if (totalStr) parts.push(`(${totalStr.trim()})`);

                stats.push({
                  label: `Disque (${displayName})`,
                  value: parts.join('\u00A0\u00A0'),
                  percent: disk.percent,
                  color: 'var(--nd-orange)'
                });
              }
            }

            if (data?.gpu && Array.isArray(data.gpu)) {
              for (const gpu of data.gpu) {
                if (gpu.proc !== undefined) {
                  const tStr = typeof gpu.temperature === 'number' ? `\u00A0\u00A0${Math.round(gpu.temperature)}°C` : '';
                  stats.push({ label: gpu.name || 'GPU', value: `${gpu.proc.toFixed(1)}%${tStr}`, percent: gpu.proc, color: 'var(--nd-purple)' });
                }
              }
            }

            clearErrorSmartly(id, 'Glances');
            devicesStatusCache[id] = { online: true, stats, updatedAt: Date.now() };

          } catch (err: any) {
            logErrorSmartly(id, 'Glances', err.message || err);
            devicesStatusCache[id] = { online: false, error: err.message || 'Impossible de joindre Glances', isOffline: true, updatedAt: Date.now() };
          }
        }

        else if (device.api.type === 'proxmox') {
          if (!apiUrl || !device.api.token) {
            devicesStatusCache[id] = { online: false, error: 'URL ou Token manquant.', isOffline: true, updatedAt: Date.now() };
            return;
          }

          try {
            const tokenStr = interpolateEnv(device.api.token);
            const data = await fetchProxmox(apiUrl, tokenStr);
            const stats = [];

            if (data.cpu !== undefined) {
              const cpuUsage = data.cpu * 100;
              if (!isNaN(cpuUsage)) {
                stats.push({ label: 'CPU', value: `${cpuUsage.toFixed(1)}%`, percent: cpuUsage > 100 ? 100 : cpuUsage, color: 'var(--nd-accent)' });
              }
            }

            const memUsed = data.memory?.used || data.mem;
            const memTotal = data.memory?.total || data.maxmem;
            if (memUsed && memTotal) {
              const memPercent = (memUsed / memTotal) * 100;
              const parts = [`${memPercent.toFixed(1)}%`];
              const gb = memTotal / 1024 / 1024 / 1024;
              if (gb >= 1000) {
                parts.push(`(${(gb / 1000).toFixed(1).replace('.', ',')} To)`);
              } else {
                parts.push(`(${gb.toFixed(0)} Go)`);
              }
              stats.push({ label: 'RAM', value: parts.join('\u00A0\u00A0'), percent: memPercent, color: 'var(--nd-green)' });
            }

            let diskUsed = data.rootfs?.used || data.disk;
            let diskTotal = data.rootfs?.total || data.maxdisk;

            if (!device.api.vmid && typeof apiUrl === 'string' && apiUrl.endsWith('/status')) {
              const storageUrl = apiUrl.replace('/status', '/storage');
              try {
                 const storageData = await fetchProxmox(storageUrl, tokenStr);
                 if (Array.isArray(storageData) && storageData.length > 0) {
                   let sUsed = 0, sTotal = 0;
                   for (const st of storageData) {
                      sUsed += st.used || 0;
                      sTotal += st.total || 0;
                   }
                   if (sTotal > 0) {
                     diskUsed = sUsed;
                     diskTotal = sTotal;
                   }
                 }
              } catch(e: any) {
                 logErrorSmartly(id, 'Proxmox Storage', e.message || e);
              }
            }

            if (diskUsed && diskTotal) {
              let diskPercent = 0;
              if (device.api.vmType === 'lxc') {
                diskPercent = (diskUsed / diskTotal) * 100;
              } else {
                diskPercent = (diskUsed / diskTotal) * 100;
              }
              const gb = diskTotal / 1024 / 1024 / 1024;
              let totalStr = '';
              if (gb >= 1000) {
                const tb = gb / 1000;
                totalStr = tb.toFixed(1).replace('.', ',') + ' To';
              } else {
                totalStr = gb.toFixed(0) + ' Go';
              }
              stats.push({ label: 'Disque (Local)', value: `${diskPercent.toFixed(1)}% (${totalStr})`, percent: diskPercent, color: 'var(--nd-orange)' });
            }

            if (stats.length === 0) {
              devicesStatusCache[id] = { online: false, error: 'VM arrêtée ou aucune stat.', isOffline: true, updatedAt: Date.now() };
              return;
            }

            clearErrorSmartly(id, 'Proxmox');
            devicesStatusCache[id] = { online: true, stats, updatedAt: Date.now() };

          } catch (err: any) {
            logErrorSmartly(id, 'Proxmox', err.message || err);
            devicesStatusCache[id] = { online: false, error: err.message || 'Impossible de joindre Proxmox', isOffline: true, updatedAt: Date.now() };
          }
        }

        else if (device.api.type === 'lhm') {
          if (!apiUrl) {
            devicesStatusCache[id] = { online: false, error: 'URL LHM manquante.', isOffline: true, updatedAt: Date.now() };
            return;
          }

          try {
            const res = await fetch(apiUrl, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
            if (!res.ok) throw new Error(`HTTP: ${res.status}`);
            const data = await res.json();
            const stats = [];

            const searchLHMTree = (node: any, matchFn: (n: any) => boolean): any => {
              if (matchFn(node)) return node;
              if (node.Children) {
                for (const child of node.Children) {
                  const f = searchLHMTree(child, matchFn);
                  if (f) return f;
                }
              }
              return null;
            };

            const computerNode = data.Children?.[0];
            const hwNodes = computerNode?.Children || [];

            const cpuStats: any[] = [];
            const ramStats: any[] = [];
            const gpuStats: any[] = [];
            const diskStats: any[] = [];

            for (const hw of hwNodes) {
              const cpuLoad = searchLHMTree(hw, (n: any) => n.Text === 'CPU Total' && n.Value?.includes('%'));
              if (cpuLoad) {
                let cpuTemp = searchLHMTree(hw, (n: any) => (n.Text === 'CPU Package' || n.Text?.includes('Core (Tctl/Tdie)')) && n.Value?.includes('°C'));
                if (!cpuTemp) {
                  cpuTemp = searchLHMTree(hw, (n: any) => n.Text === 'Core Max' && n.Value?.includes('°C'));
                }
                const val = parseFloat(cpuLoad.Value.replace(',', '.'));
                const parts = [`${val.toFixed(1)}%`];
                if (cpuTemp) parts.push(`${Math.round(parseFloat(cpuTemp.Value.replace(',', '.')))}°C`);
                cpuStats.push({ label: 'CPU', value: parts.join('\u00A0\u00A0'), percent: val > 100 ? 100 : val, color: 'var(--nd-accent)' });
              }

              if (hw.Text === 'Total Memory' || hw.Text === 'Generic Memory' || hw.Text === 'System Memory') {
                const ramLoad = searchLHMTree(hw, (n: any) => n.Text === 'Memory' && n.Value?.includes('%'));
                if (ramLoad) {
                  const val = parseFloat(ramLoad.Value.replace(',', '.'));
                  let ramTotalStr = '';
                  const memUsedNode = searchLHMTree(hw, (n: any) => n.Text === 'Memory Used');
                  const memAvailNode = searchLHMTree(hw, (n: any) => n.Text === 'Memory Available');
                  if (memUsedNode && memAvailNode && memUsedNode.Value && memAvailNode.Value) {
                    let usedGB = parseFloat(memUsedNode.Value.replace(',', '.'));
                    if (memUsedNode.Value.includes('MB')) usedGB /= 1024;
                    let availGB = parseFloat(memAvailNode.Value.replace(',', '.'));
                    if (memAvailNode.Value.includes('MB')) availGB /= 1024;
                    const totalGB = usedGB + availGB;
                    
                    if (totalGB >= 1000) {
                      ramTotalStr = `(${(totalGB / 1000).toFixed(1).replace('.', ',')} To)`;
                    } else {
                      ramTotalStr = `(${Math.round(totalGB)} Go)`;
                    }
                  }
                  
                  const parts = [`${val.toFixed(1)}%`];
                  if (ramTotalStr) parts.push(ramTotalStr);
                  ramStats.push({ label: 'RAM', value: parts.join('\u00A0\u00A0'), percent: val, color: 'var(--nd-green)' });
                }
              }

              const gpuLoad = searchLHMTree(hw, (n: any) => n.Text === 'GPU Core' && n.Value?.includes('%'));
              if (gpuLoad) {
                const gpuName = hw.Text.replace('NVIDIA ', '').replace('AMD ', '');
                let gpuTemp = searchLHMTree(hw, (n: any) => n.Text === 'GPU Core' && n.Value?.includes('°C'));
                if (!gpuTemp) {
                  gpuTemp = searchLHMTree(hw, (n: any) => n.Text?.startsWith('GPU') && n.Value?.includes('°C'));
                }
                const val = parseFloat(gpuLoad.Value.replace(',', '.'));
                const parts = [`${val.toFixed(1)}%`];
                if (gpuTemp) parts.push(`${Math.round(parseFloat(gpuTemp.Value.replace(',', '.')))}°C`);
                gpuStats.push({ label: gpuName, value: parts.join('\u00A0\u00A0'), percent: val > 100 ? 100 : val, color: 'var(--nd-purple)' });
              }

              const diskLoad = searchLHMTree(hw, (n: any) => n.Text === 'Used Space' && n.Value?.includes('%'));
              if (diskLoad) {
                const diskName = hw.Text;
                const diskTemp = searchLHMTree(hw, (n: any) => n.Text?.startsWith('Temperature') && n.Value?.includes('°C'));
                const totalSpace = searchLHMTree(hw, (n: any) => n.Text === 'Total Space');
                const val = parseFloat(diskLoad.Value.replace(',', '.'));
                const parts = [`${val.toFixed(1)}%`];
                if (diskTemp) parts.push(`${Math.round(parseFloat(diskTemp.Value.replace(',', '.')))}°C`);
                if (totalSpace && totalSpace.Value) {
                   let gb = parseFloat(totalSpace.Value.replace(',', '.'));
                   if (totalSpace.Value.includes('MB')) gb = gb / 1024;
                   if (gb >= 1000) parts.push(`(${((gb/1000)).toFixed(1).replace('.', ',')} To)`);
                   else parts.push(`(${gb.toFixed(0)} Go)`);
                }
                diskStats.push({ label: `Disque (${diskName})`, value: parts.join('\u00A0\u00A0'), percent: val, color: 'var(--nd-orange)' });
              }
            }

            stats.push(...cpuStats, ...ramStats, ...diskStats, ...gpuStats);
            clearErrorSmartly(id, 'LHM');
            devicesStatusCache[id] = { online: true, stats, updatedAt: Date.now() };

          } catch (err: any) {
            logErrorSmartly(id, 'LHM', err.message || err);
            devicesStatusCache[id] = { online: false, error: err.message || 'Impossible de joindre LHM', isOffline: true, updatedAt: Date.now() };
          }
        }
        else {
          // Unknown or unsupported type just uses static stats if they exist
          devicesStatusCache[id] = { online: true, stats: device.stats || [], updatedAt: Date.now() };
        }
      });
      await Promise.all(promises);
    } catch (err) {
      console.error('Background Polling Loop Error:', err);
    }
  };

  // Run immediately then every 10s
  doPoll();
  globalAny.__monitoringInterval = setInterval(doPoll, 10000);
}

export function migrateConfigToPanels(configData: any) {
  if (configData.settings && !configData.settings.panels) {
    configData.settings.panels = {
      'home-left': {
        widgets: [
          { id: 'quickstats-1', type: 'quickstats', props: {} },
          { id: 'weather-1', type: 'weather', props: {} },
          { id: 'calendar-1', type: 'calendar', props: {} }
        ]
      },
      'home-right': {
        widgets: [
          { id: 'clock-1', type: 'clock', props: {} },
          { id: 'devices-1', type: 'devices', props: {} }
        ]
      },
      'home-bottom': {
        widgets: [
          { id: 'networkgraph-1', type: 'networkgraph', props: {} }
        ]
      },
      'docker-widgets': {
        widgets: [
          { id: 'dockercontainers-1', type: 'dockercontainers', props: {} },
          { id: 'dockeractions-1', type: 'dockeractions', props: {} }
        ]
      },
      'networks-widgets': {
        widgets: [
          { id: 'networkgraph-networks-1', type: 'networkgraph', props: {} },
          { id: 'tailscale-networks-1', type: 'tailscale', props: {} }
        ]
      }
    };
  }
}

// Auto-start on server load disabled (handled dynamically on client connection)

