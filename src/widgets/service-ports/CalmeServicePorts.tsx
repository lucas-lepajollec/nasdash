'use client';

import React from 'react';
import type { Category } from '@/lib/types';
import { useConfig } from '@/hooks/useConfig';
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
 * is shown. The signature line below still toggles the hidden categories
 * for admins, as in the Classic version.
 */
export default function CalmeServicePorts({ categories, showSensitive, onToggleSecretSections, editMode }: {
  categories: Category[];
  showSensitive: boolean;
  onToggleSecretSections: () => void;
  editMode?: boolean;
}) {
  const { t } = useI18n();
  const { user } = useConfig();
  const isAdmin = user?.role === 'admin';
  const ports = servicePorts(categories);
  return (
    <CalmeWidget title={t('Ports')} editMode={editMode} aside={ports.length ? String(ports.length) : undefined}>
      <div className="ndc-ports">
        {ports.map(port => <span key={port} className="ndc-port">{showSensitive ? port : '••••'}</span>)}
      </div>
      <div
        className="ndc-signature"
        onClick={isAdmin ? onToggleSecretSections : undefined}
        style={{ cursor: isAdmin ? 'pointer' : 'default' }}
        title={isAdmin ? t('Activez ou désactivez les sections secrètes') : undefined}
      >
        {t('NASDASH — Dashboard Privé')}
      </div>
    </CalmeWidget>
  );
}
