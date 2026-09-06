import fs from 'fs';
import path from 'path';
import https from 'https';
import { Category, DashboardConfig, DeviceStat, LocalCalendarEvent, NetworkTopology } from './types';
import { encrypt, decrypt } from './crypto';
import { LegacyConfigData, migrateLegacySplitFiles } from './configMigration';
import { getDataDirectory } from './dataDirectory';
import { preserveCorruptFile } from './corruptFileRecovery';
import {
  classifyMonitoringError,
  MonitoringConfigurationError,
  MonitoringHttpError,
  MonitoringInvalidResponseError,
} from './monitoringError';
import { isDemoMode } from './demoMode';
import { getDemoSessionConfig, setDemoSessionConfig } from './demoSession';
import { createRollingDemoCalendar } from './demoCalendar';

const DATA_DIR = getDataDirectory();
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const SERVICES_PATH = path.join(DATA_DIR, 'services.json');
const TOPOLOGY_PATH = path.join(DATA_DIR, 'topology.json');
const CALENDAR_PATH = path.join(DATA_DIR, 'calendar.json');
const LOGOS_DIR = path.join(DATA_DIR, 'logos');

type MutableDashboardConfig = Omit<DashboardConfig, 'categories' | 'localEvents'> & {
  categories?: Category[];
  localEvents?: LocalCalendarEvent[];
};

interface DeviceStatus {
  online: boolean;
  stats?: DeviceStat[];
  updatedAt: number;
  error?: string;
  isOffline?: boolean;
}

interface ConfigRuntimeGlobal {
  __cachedConfig?: MutableDashboardConfig | null;
  __cachedConfigMtime?: number;
  __cachedServices?: Category[] | null;
  __cachedServicesMtime?: number;
  __cachedTopology?: NetworkTopology | null;
  __cachedTopologyMtime?: number;
  __cachedCalendar?: LocalCalendarEvent[] | null;
  __cachedCalendarMtime?: number;
  __errorLogCache?: Map<string, string>;
  __devicesStatusCache?: Record<string, DeviceStatus>;
  activeClients?: number;
  __monitoringInterval?: ReturnType<typeof setInterval> | null;
  __glancesUrlCache?: Record<string, string>;
}

interface GlancesSensor {
  label?: string;
  value?: number;
}

interface GlancesDisk {
  mnt_point: string;
  size: number;
  percent: number;
}

interface GlancesGpu {
  name?: string;
  proc?: number;
  temperature?: number;
}

interface GlancesResponse {
  sensors?: GlancesSensor[];
  cpu?: { total?: number };
  mem?: { percent?: number; total?: number };
  fs?: GlancesDisk[];
  gpu?: GlancesGpu[];
}

interface ProxmoxResponse {
  cpu?: number;
  memory?: { used?: number; total?: number };
  mem?: number;
  maxmem?: number;
  rootfs?: { used?: number; total?: number };
  disk?: number;
  maxdisk?: number;
  used?: number;
  total?: number;
}

interface LhmNode {
  Text?: string;
  Value?: string;
  Children?: LhmNode[];
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const configGlobal = globalThis as typeof globalThis & ConfigRuntimeGlobal;
const globalAny = configGlobal;
if (!configGlobal.__cachedConfig) configGlobal.__cachedConfig = null;
if (!configGlobal.__cachedServices) configGlobal.__cachedServices = null;
if (!configGlobal.__cachedTopology) configGlobal.__cachedTopology = null;
if (!configGlobal.__cachedCalendar) configGlobal.__cachedCalendar = null;

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
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
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
  if (isDemoMode()) {
    const sessionConfig = getDemoSessionConfig();
    if (sessionConfig) return sessionConfig;
  }
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

  let configData: MutableDashboardConfig | null = null;
  let needDefault = false;
  let configFileInvalid = false;
  let canPersistRecoveredConfig = true;

  if (globalAny.__cachedConfig && !shouldReadConfig) {
    configData = JSON.parse(JSON.stringify(globalAny.__cachedConfig));
  } else {
    if (!fs.existsSync(CONFIG_PATH)) {
      needDefault = true;
    } else {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8').trim();
      if (!raw || raw === '{}' || raw === '[]') {
        needDefault = true;
        configFileInvalid = true;
      } else {
        try {
          configData = JSON.parse(raw) as MutableDashboardConfig;
          // Minimal validation to consider it's not "empty"
          if (!configData || (!configData.categories && !configData.devices && !configData.settings)) {
            needDefault = true;
            configFileInvalid = true;
          }
        } catch {
          needDefault = true;
          configFileInvalid = true;
        }
      }
    }

    if (needDefault || !configData) {
      if (configFileInvalid) {
        try {
          const recoveryPath = preserveCorruptFile(CONFIG_PATH);
          console.error(`[NASDASH] Configuration invalide conservée avant récupération : ${recoveryPath}`);
        } catch (error) {
          canPersistRecoveredConfig = false;
          console.error(
            '[NASDASH] Impossible de préserver config.json invalide ; le fichier original ne sera pas remplacé.',
            error,
          );
        }
      }

      const examplePath = path.join(DATA_DIR, 'config.example.json');
      if (fs.existsSync(examplePath)) {
        try {
          const exampleData = fs.readFileSync(examplePath, 'utf-8');
          configData = JSON.parse(exampleData) as MutableDashboardConfig;
          if (canPersistRecoveredConfig) {
            safeWriteFileSync(CONFIG_PATH, exampleData, 'utf-8');
            try {
              globalAny.__cachedConfigMtime = fs.statSync(CONFIG_PATH).mtimeMs;
            } catch {}
          }
        } catch (e) {
          console.error('⚠️ ERREUR DE PERMISSION ou de lecture lors de la copie de config.example.json :', e);
        }
      }

      if (!configData) {
        configData = getDefaultConfig();
        if (canPersistRecoveredConfig) {
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
    }

    configData ??= getDefaultConfig();

    // --- MIGRATION AUTOMATIQUE TRANSPARENTE EN 4 FICHIERS ---
    let migrated = migrateLegacySplitFiles(configData as unknown as LegacyConfigData, {
      services: {
        target: SERVICES_PATH,
        example: path.join(DATA_DIR, 'services.example.json'),
      },
      topology: {
        target: TOPOLOGY_PATH,
        example: path.join(DATA_DIR, 'topology.example.json'),
      },
      calendar: {
        target: CALENDAR_PATH,
        example: path.join(DATA_DIR, 'calendar.example.json'),
      },
    }, (filePath, data) => safeWriteFileSync(filePath, data));

    // D. Migration vers la configuration par panneaux (panels)
    if (configData.settings && !configData.settings.panels) {
      migrateConfigToPanels(configData);
      migrated = true;
    }

    if (migrated && canPersistRecoveredConfig) {
      try {
        safeWriteFileSync(CONFIG_PATH, JSON.stringify(configData, null, 2));
        try {
          globalAny.__cachedConfigMtime = fs.statSync(CONFIG_PATH).mtimeMs;
        } catch {}
      } catch (e) {
        console.error('⚠️ ERREUR : Impossible d\'enregistrer la configuration migrée.', e);
      }
    }

    // E. Backfill missing settings from config.example.json to keep it up to date on disk
    try {
      const examplePath = path.join(DATA_DIR, 'config.example.json');
      if (fs.existsSync(examplePath)) {
        const exampleData = JSON.parse(fs.readFileSync(examplePath, 'utf-8'));
        if (exampleData && exampleData.settings) {
          let settingsChanged = false;
          if (!configData.settings) {
            configData.settings = { ...getDefaultConfig().settings };
            settingsChanged = true;
          }

          const settingsRecord = configData.settings as unknown as Record<string, unknown>;
          const exampleSettings = exampleData.settings as Record<string, unknown>;
          
          for (const [key, value] of Object.entries(exampleSettings)) {
            if (settingsRecord[key] === undefined) {
              settingsRecord[key] = value;
              settingsChanged = true;
            }
          }
          
          // Deep backfill for tabs settings
          if (exampleData.settings.tabs) {
            const exampleTabs = exampleData.settings.tabs as Record<string, unknown>;
            if (!settingsRecord.tabs) {
              settingsRecord.tabs = { ...exampleTabs };
              settingsChanged = true;
            } else {
              const configTabs = settingsRecord.tabs as Record<string, unknown>;
              for (const [key, value] of Object.entries(exampleTabs)) {
                if (configTabs[key] === undefined) {
                  configTabs[key] = value;
                  settingsChanged = true;
                } else if (typeof value === 'object' && value !== null) {
                  const configTab = configTabs[key] as Record<string, unknown>;
                  for (const [subKey, subValue] of Object.entries(value)) {
                    if (configTab[subKey] === undefined) {
                      configTab[subKey] = subValue;
                      settingsChanged = true;
                    }
                  }
                }
              }
            }
          }

          if (settingsChanged && canPersistRecoveredConfig) {
            safeWriteFileSync(CONFIG_PATH, JSON.stringify(configData, null, 2));
            try {
              globalAny.__cachedConfigMtime = fs.statSync(CONFIG_PATH).mtimeMs;
            } catch {}
            console.log('[NASDASH] ✅ Configuration settings backfilled with new default keys on disk.');
          }
        }
      }
    } catch (e) {
      console.error('[NASDASH] Failed to backfill missing settings:', e);
    }

    // Déchiffrer les paramètres sensibles avant la mise en cache en mémoire
    if (configData.settings?.tailscaleClientSecret) {
      configData.settings.tailscaleClientSecret = decrypt(configData.settings.tailscaleClientSecret);
    }
    if (configData.devices) {
      configData.devices.forEach((device) => {
        if (device.api?.token) {
          device.api.token = decrypt(device.api.token);
        }
      });
    }

    globalAny.__cachedConfig = JSON.parse(JSON.stringify(configData));
  }

  configData ??= getDefaultConfig();

  // 2. Charger les Services / Catégories (avec cache + mtime)
  let shouldReadServices = !globalAny.__cachedServices;
  try {
    const mtime = fs.statSync(SERVICES_PATH).mtimeMs;
    if (!globalAny.__cachedServicesMtime || mtime !== globalAny.__cachedServicesMtime) {
      shouldReadServices = true;
      globalAny.__cachedServicesMtime = mtime;
    }
  } catch {}

  let categories: Category[] = [];
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

  let topology: NetworkTopology = { nodes: [], groups: [], connections: [] };
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

  let localEvents: LocalCalendarEvent[] = [];
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

  if (isDemoMode()) {
    localEvents = createRollingDemoCalendar();
  }

  // 5. Assembler pour assurer la compatibilité
  const fullConfig: DashboardConfig = {
    ...configData,
    demoMode: isDemoMode(),
    categories,
    localEvents,
    settings: {
      ...configData.settings,
      networkTopology: topology
    }
  };

  if (fullConfig.categories) {
    fullConfig.categories.forEach((cat) => {
      if (cat.services) {
        cat.services.forEach((svc) => {
          if (svc.tailscaleUrl && !svc.secondaryUrl) {
            svc.secondaryUrl = svc.tailscaleUrl;
          }
        });
      }
    });
  }

  if (isDemoMode()) setDemoSessionConfig(fullConfig);
  return fullConfig;
}

export function writeConfig(config: DashboardConfig): boolean {
  const baseConfig: MutableDashboardConfig = cloneJson(config);
  delete baseConfig.demoMode;
  const categories = baseConfig.categories || [];
  const topology = baseConfig.settings?.networkTopology || { nodes: [], groups: [], connections: [] };
  const localEvents = baseConfig.localEvents || [];

  if (isDemoMode()) {
    if (setDemoSessionConfig(config)) return true;
    const cacheConfig: MutableDashboardConfig = cloneJson(config);
    delete cacheConfig.demoMode;
    delete cacheConfig.categories;
    delete cacheConfig.localEvents;
    if (cacheConfig.settings) {
      delete cacheConfig.settings.networkTopology;
    }
    globalAny.__cachedConfig = cacheConfig;
    globalAny.__cachedServices = JSON.parse(JSON.stringify(categories));
    globalAny.__cachedTopology = JSON.parse(JSON.stringify(topology));
    globalAny.__cachedCalendar = JSON.parse(JSON.stringify(localEvents));
    return true;
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
    baseConfig.devices.forEach((device) => {
      if (device.api?.token && device.api.token !== '********') {
        device.api.token = encrypt(device.api.token);
      }
    });
  }

  let success = true;

  try {
    safeWriteFileSync(CONFIG_PATH, JSON.stringify(baseConfig, null, 2));
    
    // Mettre en cache la version déchiffrée en mémoire
    const cacheConfig: MutableDashboardConfig = cloneJson(config);
    delete cacheConfig.demoMode;
    delete cacheConfig.categories;
    delete cacheConfig.localEvents;
    if (cacheConfig.settings) {
      delete cacheConfig.settings.networkTopology;
    }
    globalAny.__cachedConfig = cacheConfig;
  } catch (e) {
    success = false;
    console.error('⚠️ ERREUR DE PERMISSION : Impossible d\'écrire dans data/config.json', e);
  }

  try {
    safeWriteFileSync(SERVICES_PATH, JSON.stringify(categories, null, 2));
    globalAny.__cachedServices = JSON.parse(JSON.stringify(categories));
  } catch (e) {
    success = false;
    console.error('⚠️ ERREUR DE PERMISSION : Impossible d\'écrire dans data/services.json', e);
  }

  try {
    safeWriteFileSync(TOPOLOGY_PATH, JSON.stringify(topology, null, 2));
    globalAny.__cachedTopology = JSON.parse(JSON.stringify(topology));
  } catch (e) {
    success = false;
    console.error('⚠️ ERREUR DE PERMISSION : Impossible d\'écrire dans data/topology.json', e);
  }

  try {
    safeWriteFileSync(CALENDAR_PATH, JSON.stringify(localEvents, null, 2));
    globalAny.__cachedCalendar = JSON.parse(JSON.stringify(localEvents));
  } catch (e) {
    success = false;
    console.error('⚠️ ERREUR DE PERMISSION : Impossible d\'écrire dans data/calendar.json', e);
  }

  return success;
}

export function writeServices(categories: Category[]): boolean {
  if (isDemoMode()) {
    const sessionConfig = getDemoSessionConfig();
    if (sessionConfig) {
      sessionConfig.categories = cloneJson(categories);
      return setDemoSessionConfig(sessionConfig);
    }
    globalAny.__cachedServices = JSON.parse(JSON.stringify(categories));
    return true;
  }
  ensureDataDir();
  try {
    safeWriteFileSync(SERVICES_PATH, JSON.stringify(categories, null, 2));
    globalAny.__cachedServices = JSON.parse(JSON.stringify(categories));
    return true;
  } catch (e) {
    console.error('⚠️ ERREUR DE PERMISSION : Impossible d\'écrire dans data/services.json', e);
    return false;
  }
}

export function writeTopology(topology: NetworkTopology): boolean {
  if (isDemoMode()) {
    const sessionConfig = getDemoSessionConfig();
    if (sessionConfig) {
      sessionConfig.settings.networkTopology = cloneJson(topology);
      return setDemoSessionConfig(sessionConfig);
    }
    globalAny.__cachedTopology = JSON.parse(JSON.stringify(topology));
    return true;
  }
  ensureDataDir();
  try {
    safeWriteFileSync(TOPOLOGY_PATH, JSON.stringify(topology, null, 2));
    globalAny.__cachedTopology = JSON.parse(JSON.stringify(topology));
    return true;
  } catch (e) {
    console.error('⚠️ ERREUR DE PERMISSION : Impossible d\'écrire dans data/topology.json', e);
    return false;
  }
}

export function writeCalendar(calendar: LocalCalendarEvent[]): boolean {
  if (isDemoMode()) {
    const sessionConfig = getDemoSessionConfig();
    if (sessionConfig) {
      sessionConfig.localEvents = cloneJson(calendar);
      return setDemoSessionConfig(sessionConfig);
    }
    globalAny.__cachedCalendar = JSON.parse(JSON.stringify(calendar));
    return true;
  }
  ensureDataDir();
  try {
    safeWriteFileSync(CALENDAR_PATH, JSON.stringify(calendar, null, 2));
    globalAny.__cachedCalendar = JSON.parse(JSON.stringify(calendar));
    return true;
  } catch (e) {
    console.error('⚠️ ERREUR DE PERMISSION : Impossible d\'écrire dans data/calendar.json', e);
    return false;
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
      hideCalendar: true,
      hideDock: true,
      hideHeaderTitle: true,
      headerLayoutDesktop: { left: 'search', center: 'menu', right: 'none', splitMenuAround: 'none' },
      headerLayoutMobile: { left: 'title', center: 'search' }
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

function logMonitoringErrorSmartly(deviceId: string, context: string, error: unknown) {
  const failure = classifyMonitoringError(error);
  const key = `${deviceId}-${context}`;
  const signature = `${failure.code}:${failure.message}`;
  if (errorLogCache.get(key) === signature) return;

  const line = `[${context}] ${failure.message} ${failure.hint}`;
  if (failure.severity === 'warning') console.warn(`🟠 ${line}`);
  else console.error(`🔴 ${line}`);
  errorLogCache.set(key, signature);
}

function clearErrorSmartly(deviceId: string, context: string) {
  errorLogCache.delete(`${deviceId}-${context}`);
}
// ---------------------------------------------

if (!globalAny.__devicesStatusCache) globalAny.__devicesStatusCache = {};
export const devicesStatusCache: Record<string, DeviceStatus> = globalAny.__devicesStatusCache;

if (globalAny.activeClients === undefined) globalAny.activeClients = 0;

export function incrementActiveClients() {
  globalAny.activeClients = (globalAny.activeClients ?? 0) + 1;
  if (globalAny.activeClients === 1) {
    startBackgroundMonitoring();
  }
}

export function decrementActiveClients() {
  globalAny.activeClients = Math.max(0, (globalAny.activeClients ?? 0) - 1);
  if (globalAny.activeClients === 0 && globalAny.__monitoringInterval) {
    clearInterval(globalAny.__monitoringInterval);
    globalAny.__monitoringInterval = null;
    console.log('🛑 Arrêt du Background Monitoring des appareils (Aucun client actif)...');
  }
}

if (!globalAny.__glancesUrlCache) globalAny.__glancesUrlCache = {};
const glancesUrlCache: Record<string, string> = globalAny.__glancesUrlCache;
export function startBackgroundMonitoring() {
  if (isDemoMode()) {
    return;
  }
  if (globalAny.__monitoringInterval) {
    return;
  }
  console.log('🚀 Démarrage du Background Monitoring des appareils (Toutes les 10s)...');

  const interpolateEnv = (str: string) => str.replace(/\${([^}]+)}/g, (_, v) => process.env[v] || '');

  const fetchProxmox = <T extends ProxmoxResponse | ProxmoxResponse[]>(urlStr: string, token: string): Promise<T> => {
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
        timeout: 4000
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new MonitoringHttpError('Proxmox', res.statusCode || 500, res.statusMessage));
            return;
          }
          try {
            resolve((JSON.parse(data) as { data: T }).data); // Proxmox nests everything under .data
          } catch {
            reject(new MonitoringInvalidResponseError('Réponse JSON Proxmox invalide.'));
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
            logMonitoringErrorSmartly(id, 'Glances', new MonitoringConfigurationError('URL Glances manquante.'));
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
            let lastError: unknown = null;
            let finalUrl = '';

            for (const url of fetchUrls) {
              try {
                res = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(4000) });
                if (res.ok) { finalUrl = url; glancesUrlCache[id] = url; break; }
                if (res.status !== 404) { finalUrl = url; break; }
              } catch (error) {
                lastError = error;
              }
            }

            if (!res || !res.ok) {
              if (res) {
                logMonitoringErrorSmartly(id, 'Glances', new MonitoringHttpError('Glances', res.status, res.statusText));
                devicesStatusCache[id] = { online: false, error: `Erreur serveur (${res.status})`, isOffline: true, updatedAt: Date.now() };
              } else {
                logMonitoringErrorSmartly(id, 'Glances', lastError);
                devicesStatusCache[id] = { online: false, error: 'Impossible de joindre Glances', isOffline: true, updatedAt: Date.now() };
              }
              return;
            }

            const text = await res.text();
            let data: GlancesResponse;
            try {
              data = JSON.parse(text) as GlancesResponse;
            } catch {
              logMonitoringErrorSmartly(id, 'Glances', new MonitoringInvalidResponseError(`Réponse HTML reçue au lieu de JSON sur ${finalUrl}.`));
              devicesStatusCache[id] = { online: false, error: 'Réponse invalide (HTML)', isOffline: true, updatedAt: Date.now() };
              return;
            }

            const stats: DeviceStat[] = [];
            let cpuTemp = '';
            let diskTemp = '';
            if (data?.sensors && Array.isArray(data.sensors)) {
              const getSensor = (kws: string[]) => data.sensors?.find((sensor) => kws.some(kw => sensor.label?.toLowerCase().includes(kw)));
              const cpuS = getSensor(['package', 'tctl', 'tdie']) || getSensor(['core']) || getSensor(['cpu']) || getSensor(['acpitz']);
              if (typeof cpuS?.value === 'number') cpuTemp = ` ${Math.round(cpuS.value)}°C`;

              const diskS = data.sensors.find((sensor) => ['nvme', 'sda', 'disk', 'hdd', 'temp1'].some(keyword => sensor.label?.toLowerCase().includes(keyword)) && !['cpu', 'core'].some(keyword => sensor.label?.toLowerCase().includes(keyword)));
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
              const filteredDisks = data.fs.filter((disk) => {
                if (!disk.mnt_point) return false;
                const lowerMnt = disk.mnt_point.toLowerCase();
                return !excludeKeywords.some(kw => lowerMnt.includes(kw));
              });

              const uniqueDisks = new Map<number, GlancesDisk>();
              for (const disk of filteredDisks) {
                if (!disk.size) continue;
                const existing = uniqueDisks.get(disk.size);
                if (!existing || disk.mnt_point.length < existing.mnt_point.length) {
                  uniqueDisks.set(disk.size, disk);
                }
              }

              const finalDisks = Array.from(uniqueDisks.values());
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

          } catch (error: unknown) {
            const errorMessage = getErrorMessage(error);
            logMonitoringErrorSmartly(id, 'Glances', error);
            devicesStatusCache[id] = { online: false, error: errorMessage || 'Impossible de joindre Glances', isOffline: true, updatedAt: Date.now() };
          }
        }

        else if (device.api.type === 'proxmox') {
          if (!apiUrl || !device.api.token) {
            logMonitoringErrorSmartly(id, 'Proxmox', new MonitoringConfigurationError('URL ou jeton Proxmox manquant.'));
            devicesStatusCache[id] = { online: false, error: 'URL ou Token manquant.', isOffline: true, updatedAt: Date.now() };
            return;
          }

          try {
            const tokenStr = interpolateEnv(device.api.token);
            const data = await fetchProxmox<ProxmoxResponse>(apiUrl, tokenStr);
            const stats: DeviceStat[] = [];

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
                 const storageData = await fetchProxmox<ProxmoxResponse[]>(storageUrl, tokenStr);
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
                 clearErrorSmartly(id, 'Proxmox Storage');
              } catch (error: unknown) {
                 logMonitoringErrorSmartly(id, 'Proxmox Storage', error);
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

          } catch (error: unknown) {
            const errorMessage = getErrorMessage(error);
            logMonitoringErrorSmartly(id, 'Proxmox', error);
            devicesStatusCache[id] = { online: false, error: errorMessage || 'Impossible de joindre Proxmox', isOffline: true, updatedAt: Date.now() };
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
            const data = await res.json() as LhmNode;
            const stats: DeviceStat[] = [];

            const searchLHMTree = (node: LhmNode, matchFn: (candidate: LhmNode) => boolean): LhmNode | null => {
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

            const cpuStats: DeviceStat[] = [];
            const ramStats: DeviceStat[] = [];
            const gpuStats: DeviceStat[] = [];
            const diskStats: DeviceStat[] = [];

            for (const hw of hwNodes) {
              const cpuLoad = searchLHMTree(hw, (node) => node.Text === 'CPU Total' && Boolean(node.Value?.includes('%')));
              if (cpuLoad) {
                let cpuTemp = searchLHMTree(hw, (node) => Boolean((node.Text === 'CPU Package' || node.Text?.includes('Core (Tctl/Tdie)')) && node.Value?.includes('°C')));
                if (!cpuTemp) {
                  cpuTemp = searchLHMTree(hw, (node) => node.Text === 'Core Max' && Boolean(node.Value?.includes('°C')));
                }
                const val = parseFloat(cpuLoad.Value!.replace(',', '.'));
                const parts = [`${val.toFixed(1)}%`];
                if (cpuTemp) parts.push(`${Math.round(parseFloat(cpuTemp.Value!.replace(',', '.')))}°C`);
                cpuStats.push({ label: 'CPU', value: parts.join('\u00A0\u00A0'), percent: val > 100 ? 100 : val, color: 'var(--nd-accent)' });
              }

              if (hw.Text === 'Total Memory' || hw.Text === 'Generic Memory' || hw.Text === 'System Memory') {
                const ramLoad = searchLHMTree(hw, (node) => node.Text === 'Memory' && Boolean(node.Value?.includes('%')));
                if (ramLoad) {
                  const val = parseFloat(ramLoad.Value!.replace(',', '.'));
                  let ramTotalStr = '';
                  const memUsedNode = searchLHMTree(hw, (node) => node.Text === 'Memory Used');
                  const memAvailNode = searchLHMTree(hw, (node) => node.Text === 'Memory Available');
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

              const gpuLoad = searchLHMTree(hw, (node) => node.Text === 'GPU Core' && Boolean(node.Value?.includes('%')));
              if (gpuLoad) {
                const gpuName = hw.Text!.replace('NVIDIA ', '').replace('AMD ', '');
                let gpuTemp = searchLHMTree(hw, (node) => node.Text === 'GPU Core' && Boolean(node.Value?.includes('°C')));
                if (!gpuTemp) {
                  gpuTemp = searchLHMTree(hw, (node) => Boolean(node.Text?.startsWith('GPU') && node.Value?.includes('°C')));
                }
                const val = parseFloat(gpuLoad.Value!.replace(',', '.'));
                const parts = [`${val.toFixed(1)}%`];
                if (gpuTemp) parts.push(`${Math.round(parseFloat(gpuTemp.Value!.replace(',', '.')))}°C`);
                gpuStats.push({ label: gpuName, value: parts.join('\u00A0\u00A0'), percent: val > 100 ? 100 : val, color: 'var(--nd-purple)' });
              }

              const diskLoad = searchLHMTree(hw, (node) => node.Text === 'Used Space' && Boolean(node.Value?.includes('%')));
              if (diskLoad) {
                const diskName = hw.Text;
                const diskTemp = searchLHMTree(hw, (node) => Boolean(node.Text?.startsWith('Temperature') && node.Value?.includes('°C')));
                const totalSpace = searchLHMTree(hw, (node) => node.Text === 'Total Space');
                const val = parseFloat(diskLoad.Value!.replace(',', '.'));
                const parts = [`${val.toFixed(1)}%`];
                if (diskTemp) parts.push(`${Math.round(parseFloat(diskTemp.Value!.replace(',', '.')))}°C`);
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

          } catch (error: unknown) {
            const errorMessage = getErrorMessage(error);
            logErrorSmartly(id, 'LHM', errorMessage);
            devicesStatusCache[id] = { online: false, error: errorMessage || 'Impossible de joindre LHM', isOffline: true, updatedAt: Date.now() };
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

export function migrateConfigToPanels(configData: Pick<DashboardConfig, 'settings'>) {
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

