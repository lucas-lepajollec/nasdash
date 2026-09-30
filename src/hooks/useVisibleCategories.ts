'use client';

import { useMemo } from 'react';
import { useConfig } from '@/hooks/useConfig';
import type { Category } from '@/lib/types';

/**
 * The categories the screen may show: secret ones only while secret
 * sections are revealed (the signature at the bottom of the page toggles
 * them). Visitors never receive secret categories from the server.
 */
export function useVisibleCategories(): Category[] {
  const { config, showSecretSections } = useConfig();
  return useMemo(
    () => (config?.categories ?? []).filter(category => showSecretSections || !category.isSecret),
    [config?.categories, showSecretSections],
  );
}
