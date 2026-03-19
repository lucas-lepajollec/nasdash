import fs from 'fs';
import path from 'path';
import { DashboardConfig } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const LOGOS_DIR = path.join(DATA_DIR, 'logos');

export function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(LOGOS_DIR)) fs.mkdirSync(LOGOS_DIR, { recursive: true });
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
    const defaultConfig = getDefaultConfig();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }

  return configData;
}

export function writeConfig(config: DashboardConfig) {
  ensureDataDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
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
