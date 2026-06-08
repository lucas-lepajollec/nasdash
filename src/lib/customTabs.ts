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

export function readCustomTabs(): CustomTabsData {
  try {
    if (!fs.existsSync(CUSTOM_TABS_FILE)) {
      if (fs.existsSync(EXAMPLE_TABS_FILE)) {
        const exampleData = fs.readFileSync(EXAMPLE_TABS_FILE, 'utf-8');
        fs.writeFileSync(CUSTOM_TABS_FILE, exampleData, 'utf-8');
      }
    }
    
    if (fs.existsSync(CUSTOM_TABS_FILE)) {
      const data = fs.readFileSync(CUSTOM_TABS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading custom tabs:', error);
  }
  return DEFAULT_DATA;
}

export function writeCustomTabs(data: CustomTabsData): void {
  try {
    const dir = path.dirname(CUSTOM_TABS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CUSTOM_TABS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing custom tabs:', error);
  }
}
