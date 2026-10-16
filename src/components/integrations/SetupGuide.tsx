'use client';

import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { monitoringInstances } from '@/integrations/sources';
import { latestInstance } from '@/integrations/instances';
import { useOpenSettings } from './useOpenSettings';
import { DNS_TYPES, PHOTO_TYPES } from '@/lib/widgetData/contracts';

/**
 * What a widget shows before it can work, in the order to follow: for the
 * machine widgets, connect a monitoring source then add the machines; for
 * Docker, add an engine; for the mesh widget, connect Tailscale or Headscale.
 * Each step links straight to the right place; done steps are ticked.
 * Visitors who cannot change the settings are told an admin has to.
 */
export type SetupKind = 'devices' | 'docker' | 'vpn' | 'dns' | 'photos' | 'bookmarks' | 'rss' | 'markets' | 'weather';


export function SetupGuide({ kind }: { kind: SetupKind }) {
  const { t } = useI18n();
  const { config, user } = useConfig();
  const { openIntegrations, openMachines, openWidgetSettings } = useOpenSettings();
  const admin = user?.role === 'admin';

  const steps = kind === 'devices'
    ? [
      { done: monitoringInstances(config).length > 0, label: t('setup.devices.source'), action: t('setup.devices.sourceAction'), open: () => openIntegrations('monitoring') },
      { done: (config?.devices ?? []).length > 0, label: t('setup.devices.machines'), action: t('setup.devices.machinesAction'), open: openMachines },
    ]
    : kind === 'docker'
      ? [{ done: (config?.dockerHosts ?? []).length > 0, label: t('setup.docker.engine'), action: t('setup.docker.engineAction'), open: () => openIntegrations('docker') }]
      : kind === 'vpn'
        ? [{ done: !!latestInstance(config ?? {}, ['tailscale', 'headscale']), label: t('setup.vpn.connect'), action: t('setup.vpn.connectAction'), open: () => openIntegrations('vpn') }]
        : kind === 'dns'
          ? [{ done: !!latestInstance(config ?? {}, [...DNS_TYPES]), label: t('setup.dns.connect'), action: t('setup.dns.connectAction'), open: () => openIntegrations('dns') }]
          : kind === 'photos'
            ? [{ done: !!latestInstance(config ?? {}, [...PHOTO_TYPES]), label: t('setup.photos.connect'), action: t('setup.photos.connectAction'), open: () => openIntegrations('photos') }]
          : kind === 'bookmarks'
            ? [{ done: (config?.settings?.bookmarks ?? []).some(item => item.kind === 'link'), label: t('setup.bookmarks.links'), action: t('setup.bookmarks.linksAction'), open: () => openWidgetSettings('widget-bookmarks') }]
          : kind === 'rss'
            ? [{ done: (config?.settings?.rssFeeds ?? []).length > 0, label: t('setup.rss.feeds'), action: t('setup.rss.feedsAction'), open: () => openWidgetSettings('widget-rss') }]
            : kind === 'weather'
              ? [{ done: (config?.settings?.weatherLocations ?? []).length > 0, label: t('setup.weather.city'), action: t('setup.weather.cityAction'), open: () => openWidgetSettings('widget-weather') }]
              : [{ done: (config?.settings?.marketSymbols ?? []).length > 0, label: t('setup.markets.symbols'), action: t('setup.markets.symbolsAction'), open: () => openWidgetSettings('widget-markets') }];
  const index = Math.max(0, steps.findIndex(step => !step.done));
  const step = steps[index];

  // Sober: what the widget will show, the next thing to do, one quiet button.
  return (
    <div className="ndc-welcome">
      <span className="ndc-welcome-title">{t(`setup.${kind}.title`)}</span>
      <span className="ndc-welcome-text">
        {steps.length > 1 && <span className="ndc-welcome-step">{index + 1}/{steps.length}</span>}
        {step.label}
      </span>
      {admin
        ? <button type="button" className="nd-btn nd-btn-compact ndc-welcome-action" onClick={step.open}>{step.action}<ArrowRight size={12} /></button>
        : <span className="ndc-welcome-note">{t('setup.adminOnly')}</span>}
    </div>
  );
}
