import fs from 'fs';
import path from 'path';
import { Category, DashboardConfig, LocalCalendarEvent, NetworkTopology } from './types';
import { encrypt, decrypt } from './crypto';
import { LegacyConfigData, migrateLegacySplitFiles } from './configMigration';
import { getDataDirectory } from './dataDirectory';
import { preserveCorruptFile } from './corruptFileRecovery';
import { isDemoMode } from './demoMode';
import { getDemoSessionConfig, setDemoSessionConfig } from './demoSession';
import { createRollingDemoCalendar } from './demoCalendar';
import { mapInstanceSecrets, migrateLegacyIntegrations } from '@/integrations/instances';
import { migrateDeviceConnections } from '@/integrations/sources';

function hasLegacyIntegrationSettings(config: { settings?: object }): boolean {
  return Boolean(config.settings && ('tailscaleTailnet' in config.settings || 'tailscaleClientId' in config.settings || 'tailscaleClientSecret' in config.settings));
}

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

interface ConfigRuntimeGlobal {
  __cachedConfig?: MutableDashboardConfig | null;
  __cachedConfigMtime?: number;
  __cachedServices?: Category[] | null;
  __cachedServicesMtime?: number;
  __cachedTopology?: NetworkTopology | null;
  __cachedTopologyMtime?: number;
  __cachedCalendar?: LocalCalendarEvent[] | null;
  __cachedCalendarMtime?: number;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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

    // E. Identifiants d'intégrations (Tailscale) : settings → config.integrations.
    //    Une copie du fichier d'avant est gardée une fois (config.pre-integrations.json).
    if (hasLegacyIntegrationSettings(configData) && canPersistRecoveredConfig) {
      const backup = path.join(DATA_DIR, 'config.pre-integrations.json');
      try {
        if (!fs.existsSync(backup) && fs.existsSync(CONFIG_PATH)) fs.copyFileSync(CONFIG_PATH, backup);
      } catch (e) {
        console.error('⚠️ Impossible de sauvegarder config.json avant la migration des intégrations.', e);
      }
    }
    if (migrateLegacyIntegrations(configData)) {
      // Legacy secrets are already encrypted; encrypt() leaves those unchanged.
      mapInstanceSecrets(configData, encrypt);
      migrated = true;
    }

    // F. Connexions de surveillance : device.api → connexion enregistrée (config.integrations)
    //    + device.source. Une copie du fichier d'avant est gardée une fois (config.pre-sources.json).
    if (!isDemoMode() && (configData.devices ?? []).some(device => device.api && !device.source)) {
      const before = JSON.stringify(configData);
      if (migrateDeviceConnections(configData, decrypt, encrypt)) {
        if (canPersistRecoveredConfig) {
          const backup = path.join(DATA_DIR, 'config.pre-sources.json');
          try {
            if (!fs.existsSync(backup)) safeWriteFileSync(backup, JSON.stringify(JSON.parse(before), null, 2));
          } catch (e) {
            console.error('⚠️ Impossible de sauvegarder config.json avant la migration des connexions de surveillance.', e);
          }
        }
        migrated = true;
      }
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

    // F. Backfill missing settings from config.example.json to keep it up to date on disk
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
    mapInstanceSecrets(configData, decrypt);
    if (configData.devices) {
      configData.devices.forEach((device) => {
        if (device.api?.token) {
          device.api.token = decrypt(device.api.token);
        }
      });
    }
    for (const host of configData.dockerHosts ?? []) {
      if (host.token) host.token = decrypt(host.token);
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
  mapInstanceSecrets(baseConfig, encrypt);
  if (baseConfig.devices) {
    baseConfig.devices.forEach((device) => {
      if (device.api?.token && device.api.token !== '********') {
        device.api.token = encrypt(device.api.token);
      }
    });
  }
  for (const host of baseConfig.dockerHosts ?? []) {
    if (host.token && host.token !== '********') host.token = encrypt(host.token);
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

