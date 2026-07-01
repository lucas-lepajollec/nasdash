import fs from 'fs';
import path from 'path';
import { CustomTabLayout } from './types';
import { TabDef } from '@/hooks/useTabs';

export interface CustomTabsData {
  tabs: TabDef[];
  layouts: Record<string, CustomTabLayout>;
}

const CUSTOM_TABS_FILE = path.join(process.cwd(), 'data', 'custom_tabs.json');

const DEFAULT_DATA: CustomTabsData = {
  tabs: [],
  layouts: {}
};

const EXAMPLE_TABS_FILE = path.join(process.cwd(), 'data', 'custom_tabs.example.json');

const globalAny: any = global;
if (!globalAny.__cachedCustomTabs) {
  globalAny.__cachedCustomTabs = null;
}

export function readCustomTabs(): CustomTabsData {
  let shouldReadTabs = !globalAny.__cachedCustomTabs;
  try {
    const mtime = fs.statSync(CUSTOM_TABS_FILE).mtimeMs;
    if (!globalAny.__cachedCustomTabsMtime || mtime !== globalAny.__cachedCustomTabsMtime) {
      shouldReadTabs = true;
      globalAny.__cachedCustomTabsMtime = mtime;
    }
  } catch {}

  if (globalAny.__cachedCustomTabs && !shouldReadTabs) {
    return JSON.parse(JSON.stringify(globalAny.__cachedCustomTabs));
  }

  try {
    if (!fs.existsSync(CUSTOM_TABS_FILE)) {
      if (fs.existsSync(EXAMPLE_TABS_FILE)) {
        const exampleData = fs.readFileSync(EXAMPLE_TABS_FILE, 'utf-8');
        fs.writeFileSync(CUSTOM_TABS_FILE, exampleData, 'utf-8');
        try {
          globalAny.__cachedCustomTabsMtime = fs.statSync(CUSTOM_TABS_FILE).mtimeMs;
        } catch {}
      }
    }
    
    if (fs.existsSync(CUSTOM_TABS_FILE)) {
      const data = fs.readFileSync(CUSTOM_TABS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      globalAny.__cachedCustomTabs = JSON.parse(JSON.stringify(parsed));
      return parsed;
    }
  } catch (error) {
    console.error('Error reading custom tabs:', error);
  }
  return DEFAULT_DATA;
}

export function writeCustomTabs(data: CustomTabsData): void {
  try {
    globalAny.__cachedCustomTabs = JSON.parse(JSON.stringify(data));
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
      return;
    }
    const dir = path.dirname(CUSTOM_TABS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CUSTOM_TABS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing custom tabs:', error);
  }
}
