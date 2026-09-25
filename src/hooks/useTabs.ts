'use client';

import { useMemo } from 'react';
import { isOfficialPageId } from '@/lib/pages/types';
import { usePages } from '@/providers/PagesProvider';

export type TabId = string;

/** Navigation entry derived from a page. */
export interface TabDef {
  id: TabId;
  name: string;
  icon: string;
  description: string;
  isCustom?: boolean;
}

/**
 * Compatibility view of the pages for navigation components (dock, header,
 * settings). Pages are the single source of truth.
 */
export function useTabs() {
  const { pages, loading, activePageId, setActivePageId, refreshPages } = usePages();
  const tabs = useMemo<TabDef[]>(() => pages.map(page => ({
    id: page.id,
    name: page.name,
    icon: page.icon,
    description: page.description ?? '',
    isCustom: !isOfficialPageId(page.id),
  })), [pages]);

  return { activeTab: activePageId, switchTab: setActivePageId, tabs, ready: !loading, refreshTabs: refreshPages };
}
