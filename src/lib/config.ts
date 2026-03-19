import fs from 'fs';
import path from 'path';
import { DashboardConfig } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const LOGOS_DIR = path.join(DATA_DIR, 'logos');

export function ensureDataDir() {
  console.log('Vérification du dossier data...');
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(LOGOS_DIR)) fs.mkdirSync(LOGOS_DIR, { recursive: true });
  } catch (e) {
    console.error('⚠️ ERREUR DE PERMISSION : Impossible d\'écrire dans /app/data. Vérifiez les droits (chmod 777) sur l\'hôte.', e);
  }
}

export function readConfig(): DashboardConfig {
  ensureDataDir();
  let needDefault = false;
  let configData = null;

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
        if (!configData || (!configData.categories && !configData.devices)) {
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
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      } catch (e) {
        console.error('⚠️ ERREUR DE PERMISSION ou de lecture lors de la copie de config.example.json :', e);
      }
    }

    const defaultConfig = getDefaultConfig();
    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
    } catch (e) {
      console.error('⚠️ ERREUR DE PERMISSION : Impossible de créer data/config.json. Configuration utilisée en mémoire.', e);
    }
    return defaultConfig;
  }

  return configData;
}

export function writeConfig(config: DashboardConfig) {
  ensureDataDir();
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error('⚠️ ERREUR DE PERMISSION : Impossible d\'écrire dans data/config.json', e);
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
      return JSON.parse(fs.readFileSync(examplePath, 'utf-8'));
    } catch (e) {
      console.error('Erreur lecture config.example.json', e);
    }
  }

  return {
    settings: {
      title: 'HOME LAB',
      showMonitor: true,
      totalSlots: 10
    },
    devices: [],
    categories: []
  };
}
