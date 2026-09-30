'use client';

import React from 'react';
import type { Category } from '@/lib/types';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeWidget } from '../calme';

/** Ports used by the services' addresses, sorted. */
export function servicePorts(categories: Category[]): string[] {
  const ports = new Set<string>();
  for (const category of categories || []) {
    for (const service of category.services ?? []) {
      for (const url of [service.localUrl, service.tailscaleUrl]) {
        if (!url) continue;
        try {
          const port = new URL(/^https?:\/\//.test(url) ? url : `http://${url}`).port;
          if (port) ports.add(port);
        } catch { /* not an address */ }
      }
    }
  }
  return Array.from(ports).sort((a, b) => Number(a) - Number(b));
}

/**
 * Calme ports: the ports in use as quiet chips, hidden until sensitive data
 * is shown. (The dashboard signature, which toggles secret categories, is
 * now the page footer.)
 */
export default function CalmeServicePorts({ categories, showSensitive, editMode }: {
  categories: Category[];
  showSensitive: boolean;
  editMode?: boolean;
}) {
  const { t } = useI18n();
  const ports = servicePorts(categories);
  // Nothing to list: no empty block on the page (still placeable in edit mode).
  if (ports.length === 0 && !editMode) return null;
  return (
    <CalmeWidget title={t('Ports')} editMode={editMode} aside={ports.length ? String(ports.length) : undefined}>
      <div className="ndc-ports">
        {ports.map(port => <span key={port} className="ndc-port">{showSensitive ? port : '••••'}</span>)}
      </div>
    </CalmeWidget>
  );
}
