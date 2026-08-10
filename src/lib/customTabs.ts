import fs from 'fs';
import path from 'path';
import { CustomTabLayout } from './types';
import { TabDef } from '@/hooks/useTabs';
import { safeWriteFileSync } from './config';
import { getDataDirectory } from './dataDirectory';

export interface CustomTabsData {
  tabs: TabDef[];
  layouts: Record<string, CustomTabLayout>;
}

const DATA_DIR = getDataDirectory();
const CUSTOM_TABS_FILE = path.join(DATA_DIR, 'custom_tabs.json');

const DEFAULT_DATA: CustomTabsData = {
  tabs: [],
  layouts: {}
};

const EXAMPLE_TABS_FILE = path.join(DATA_DIR, 'custom_tabs.example.json');

const globalCache = globalThis as typeof globalThis & {
  __cachedCustomTabs?: CustomTabsData | null;
  __cachedCustomTabsMtime?: number;
};
if (!globalCache.__cachedCustomTabs) {
  globalCache.__cachedCustomTabs = null;
}

export function readCustomTabs(): CustomTabsData {
  let shouldReadTabs = !globalCache.__cachedCustomTabs;
  try {
    const mtime = fs.statSync(CUSTOM_TABS_FILE).mtimeMs;
    if (!globalCache.__cachedCustomTabsMtime || mtime !== globalCache.__cachedCustomTabsMtime) {
      shouldReadTabs = true;
      globalCache.__cachedCustomTabsMtime = mtime;
    }
  } catch {}

  if (globalCache.__cachedCustomTabs && !shouldReadTabs) {
    return JSON.parse(JSON.stringify(globalCache.__cachedCustomTabs));
  }

  try {
    if (!fs.existsSync(CUSTOM_TABS_FILE)) {
      if (fs.existsSync(EXAMPLE_TABS_FILE)) {
        const exampleData = fs.readFileSync(EXAMPLE_TABS_FILE, 'utf-8');
        safeWriteFileSync(CUSTOM_TABS_FILE, exampleData, 'utf-8');
        try {
          globalCache.__cachedCustomTabsMtime = fs.statSync(CUSTOM_TABS_FILE).mtimeMs;
        } catch {}
      }
    }
    
    if (fs.existsSync(CUSTOM_TABS_FILE)) {
      const data = fs.readFileSync(CUSTOM_TABS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      globalCache.__cachedCustomTabs = JSON.parse(JSON.stringify(parsed));
      return parsed;
    }
  } catch (error) {
    console.error('Error reading custom tabs:', error);
  }
  return DEFAULT_DATA;
}

export function writeCustomTabs(data: CustomTabsData): boolean {
  try {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
      globalCache.__cachedCustomTabs = JSON.parse(JSON.stringify(data));
      return true;
    }
    const dir = path.dirname(CUSTOM_TABS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    safeWriteFileSync(CUSTOM_TABS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    globalCache.__cachedCustomTabs = JSON.parse(JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Error writing custom tabs:', error);
    return false;
  }
}
