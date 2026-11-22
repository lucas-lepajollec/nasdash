'use client';

import { createContext, useContext } from 'react';
import type { TabDef, TabId } from '@/hooks/useTabs';

/**
 * What the header widgets (search, page menu, buttons) act on. There is one
 * search and one menu for the whole dashboard: every search widget shows and
 * changes the same query, every menu the same pages, wherever they are placed.
 * Only their size and display settings belong to each widget.
 */
export interface ShellControls {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  /** Sensitive information (addresses, names…) is shown. */
  showSensitive: boolean;
  toggleSensitive: () => void;
  editMode: boolean;
  toggleEdit: () => void;
  openSettings: (trigger?: HTMLButtonElement) => void;
  /** Every page the user can open, in menu order. */
  tabs: TabDef[];
  activeTab: TabId;
  switchTab: (id: TabId) => void;
}

export const ShellControlsContext = createContext<ShellControls | null>(null);

const INERT: ShellControls = {
  searchQuery: '',
  setSearchQuery: () => {},
  showSensitive: true,
  toggleSensitive: () => {},
  editMode: false,
  toggleEdit: () => {},
  openSettings: () => {},
  tabs: [],
  activeTab: '',
  switchTab: () => {},
};

/** The dashboard's controls; inert outside the dashboard (previews, tests). */
export function useShellControls(): ShellControls {
  return useContext(ShellControlsContext) ?? INERT;
}
