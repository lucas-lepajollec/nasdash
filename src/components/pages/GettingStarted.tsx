'use client';

import React from 'react';
import { ArrowRight, Check, LogIn, X } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { useOpenSettings } from '@/components/integrations/useOpenSettings';
import { isMonitoringType } from '@/integrations/sources';
import type { DashboardConfig } from '@/lib/types';
import { CalmeInfo } from '@/components/modals/settings/shared/CalmeControls';

export type StepId = 'services' | 'monitoring' | 'machines' | 'docker' | 'weather' | 'look';

/** What is already set up, read from the configuration. */
export function startingSteps(config: DashboardConfig | null | undefined): Array<{ id: StepId; done: boolean }> {
  const settings = config?.settings;
  return [
    { id: 'services', done: (config?.categories ?? []).some(category => (category.services ?? []).length > 0) },
    { id: 'monitoring', done: (config?.integrations ?? []).some(instance => isMonitoringType(instance.type)) },
    { id: 'machines', done: (config?.devices ?? []).length > 0 },
    { id: 'docker', done: (config?.dockerHosts ?? []).length > 0 },
    { id: 'weather', done: (settings?.weatherLocations ?? []).length > 0 || !!settings?.weatherLocation },
    { id: 'look', done: !!settings?.accentColor || !!settings?.backgroundImage || (!!settings?.theme && settings.theme !== 'nasdash') },
  ];
}

/** A dashboard nobody has set up yet: no service, no machine, no Docker engine. */
export function isUnconfigured(config: DashboardConfig | null | undefined): boolean {
  return !(config?.categories ?? []).some(category => (category.services ?? []).length > 0) && !(config?.devices ?? []).length && !(config?.dockerHosts ?? []).length;
}

/**
 * First steps, on the Home page. Admins get a checklist that ticks itself as
 * the dashboard is set up, each step opening the right place; it can be
 * closed (Settings → Help brings it back) and disappears once everything is
 * done. Visitors of a dashboard not set up yet get one welcome card.
 */
export function GettingStarted() {
  const { t } = useI18n();
  const { config, user, updateConfig, setCategoryModal, setSettingsModal } = useConfig();
  const { openIntegrations, openMachines } = useOpenSettings();
  if (!config) return null;

  if (user?.role !== 'admin') {
    if (!isUnconfigured(config) || user) return null;
    return (
      <section className="nd-start nd-start--visitor" aria-labelledby="nd-start-title">
        <div className="nd-start-head">
          <h2 id="nd-start-title" className="nd-start-title">{t('start.visitorTitle')}</h2>
          <p className="nd-start-text">{t('start.visitorText')}</p>
        </div>
        <a className="nd-btn nd-btn-accent nd-start-login" href="/login"><LogIn size={14} /> {t('start.login')}</a>
      </section>
    );
  }

  const steps = startingSteps(config);
  const done = steps.filter(step => step.done).length;
  if (config.settings?.onboardingDismissed || done === steps.length) return null;

  const open: Record<StepId, () => void> = {
    services: () => setCategoryModal({ open: true }),
    monitoring: () => openIntegrations('monitoring'),
    machines: openMachines,
    docker: () => openIntegrations('docker'),
    weather: () => setSettingsModal({ open: true, targetTab: 'widget-weather' }),
    look: () => setSettingsModal({ open: true, targetTab: 'apparence' }),
  };
  const next = steps.find(step => !step.done)?.id;

  return (
    <section className="nd-start" aria-labelledby="nd-start-title">
      <div className="nd-start-head">
        <div>
          <h2 id="nd-start-title" className="nd-start-title">{t('start.title')}</h2>
          <p className="nd-start-text">{t('start.progress', { done, total: steps.length })}</p>
        </div>
        <button type="button" className="ndc-icon-button" onClick={() => void updateConfig({ onboardingDismissed: true })} title={t('start.dismiss')} aria-label={t('start.dismiss')}>
          <X size={15} />
        </button>
      </div>
      <div className="nd-start-bar" aria-hidden="true"><span style={{ width: `${(done / steps.length) * 100}%` }} /></div>
      <ol className="nd-start-steps">
        {steps.map((step, index) => (
          <li key={step.id} className={`nd-start-step ${step.done ? 'is-done' : ''} ${step.id === next ? 'is-next' : ''}`}>
            <span className="nd-start-mark" aria-hidden="true">{step.done ? <Check size={13} /> : index + 1}</span>
            <span className="nd-start-step-title">{t(`start.${step.id}`)}<CalmeInfo text={t(`start.${step.id}Desc`)} /></span>
            <button type="button" className={`nd-btn ${step.id === next ? 'nd-btn-accent' : ''} nd-start-action`} onClick={open[step.id]} aria-label={[t(`start.${step.id}Action`), t(`start.${step.id}`)].join(' · ')}>
              <span className="nd-start-action-label">{step.done ? t('start.review') : t(`start.${step.id}Action`)}</span> <ArrowRight size={13} />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
