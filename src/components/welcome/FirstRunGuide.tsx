'use client';

import React, { useMemo, useState } from 'react';
import { Check, Cpu, Container, Download, Film, Image as ImageIcon, Network, Zap } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { UI_LANGUAGES, type UiLanguage } from '@/i18n/messages';
import { demoFetch } from '@/lib/demoTransport';
import { BUNDLED_WALLPAPERS, isBundledWallpaper } from '@/lib/wallpapers';
import { ARR_TYPES, DNS_TYPES, DOWNLOAD_CLIENT_TYPES, MEDIA_SERVER_TYPES, PHOTO_STATS_TYPES, UPS_TYPES, VPN_TUNNEL_TYPES } from '@/lib/widgetData/contracts';
import { getServiceIntegration, selectableDeviceIntegrations } from '@/integrations/registry';
import { insertWidget, newWidgetInstance } from '@/lib/pages/operations';
import type { Page } from '@/lib/pages/types';
import { getWidgetCatalogEntry } from '@/lib/widgets/catalog';
import { IntegrationLogo } from '@/components/integrations/IntegrationLogo';
import { MonitoringConnectionDialog } from '@/components/integrations/MonitoringConnectionDialog';
import { ServiceConnectionDialog } from '@/components/integrations/ServiceConnectionDialog';
import { DockerHostFormModal, type DockerHostDraft } from '@/components/widgets/docker/DockerViews';
import { Emoji } from '@/components/shared/Emoji';
import { NasDashMark, WelcomeShell } from './WelcomeShell';

type Step = 'account' | 'appearance' | 'integrations' | 'widgets' | 'access';
const STEPS: readonly Step[] = ['account', 'appearance', 'integrations', 'widgets', 'access'];

/** Families of connections, in the order a homelab usually has them. Each opens NasDash's own connection dialog. */
interface Family { id: string; icon: React.ReactNode; kinds: readonly string[]; docker?: boolean; monitoring?: boolean }
const DOCKER_KINDS = ['socket', 'tcp', 'portainer', 'dockhand'] as const;

/** Widgets offered by a connected family, then those that need nothing. */
const SUGGESTIONS: { family: string; widgets: string[] }[] = [
  { family: 'machines', widgets: ['devices', 'metric-cpu', 'metric-memory'] },
  { family: 'docker', widgets: ['dockercontainers'] },
  { family: 'media', widgets: ['media-nowplaying', 'media-recent'] },
  { family: 'arr', widgets: ['media-upcoming', 'media-queue', 'media-downloads'] },
  { family: 'network', widgets: ['dns', 'vpn', 'tailscale'] },
  { family: 'power', widgets: ['ups'] },
  { family: 'photos', widgets: ['photos', 'photos-stats'] },
];
const ALWAYS = ['clock', 'weather', 'calendar', 'bookmarks'];
const PRESELECTED = new Set(['devices', 'dockercontainers', 'media-nowplaying', 'media-downloads', 'dns', 'vpn', 'ups', 'clock', 'weather']);

/** Which widgets of a family make sense for what is connected (a VPN widget only with Gluetun…). */
function familyWidgetConnected(widget: string, types: Set<string>): boolean {
  if (widget === 'dns') return DNS_TYPES.some(type => types.has(type));
  if (widget === 'vpn') return VPN_TUNNEL_TYPES.some(type => types.has(type));
  if (widget === 'tailscale') return types.has('tailscale') || types.has('headscale');
  if (widget === 'media-downloads') return DOWNLOAD_CLIENT_TYPES.some(type => types.has(type));
  if (widget === 'media-upcoming' || widget === 'media-queue') return ARR_TYPES.some(type => types.has(type));
  return true;
}

interface GuideNav { busy: boolean; onBack: () => void; onSkip: () => void }
/** Back, skip (possible once the account is secured) and the step's own main action, on one line. */
function GuideFooter({ nav, primary, note }: { nav?: GuideNav; primary: React.ReactNode; note?: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <footer className="ndw-guide-actions">
      {nav && <button type="button" className="ndw-guide-secondary" onClick={nav.onBack} disabled={nav.busy}>{t('welcome.back')}</button>}
      <span className="ndw-guide-spacer">{note}</span>
      {nav && <button type="button" className="ndw-guide-quiet" onClick={nav.onSkip} disabled={nav.busy}>{t('welcome.skip')}</button>}
      {primary}
    </footer>
  );
}
function Primary({ busy, onClick, children, disabled, submit }: { busy: boolean; onClick?: () => void; children: React.ReactNode; disabled?: boolean; submit?: boolean }) {
  return (
    <button type={submit ? 'submit' : 'button'} className="ndw-welcome-submit ndw-guide-primary" onClick={onClick} disabled={busy || disabled}>
      {busy ? <span className="ndw-welcome-spinner" aria-hidden="true" /> : children}
    </button>
  );
}

export function FirstRunGuide({ wallpaper: initialWallpaper }: { wallpaper: string }) {
  const { t, language, setLanguage } = useI18n();
  const { config, refresh, updateConfig } = useConfig();
  const [step, setStep] = useState<Step>('account');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wallpaper, setWallpaper] = useState(isBundledWallpaper(config?.settings?.backgroundImage) ? config!.settings.backgroundImage! : initialWallpaper);
  const index = STEPS.indexOf(step);

  const finish = async () => {
    setBusy(true); setError(null);
    try {
      const response = await demoFetch('/api/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'complete' }) });
      if (!response.ok) throw new Error(t('welcome.error.save'));
      window.location.href = '/';
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('welcome.error.save')); setBusy(false); }
  };
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : t('welcome.error.save')); } finally { setBusy(false); }
  };
  const next = () => setStep(STEPS[Math.min(STEPS.length - 1, index + 1)]);
  const back = () => setStep(STEPS[Math.max(0, index - 1)]);
  const nav: GuideNav = { busy, onBack: back, onSkip: () => void finish() };

  return (
    <WelcomeShell wallpaper={wallpaper}>
      <div className="ndw-guide">
        <nav className="ndw-guide-steps" aria-label={t('welcome.guide.steps')}>
          <div className="ndw-guide-brand"><NasDashMark />{t('welcome.guide.title')}</div>
          <ol>
            {STEPS.map((item, position) => (
              <li key={item} className={position < index ? 'is-done' : position === index ? 'is-now' : ''} aria-current={position === index ? 'step' : undefined}>
                <span className="ndw-guide-badge" aria-hidden="true">{position < index ? <Check size={12} /> : position + 1}</span>
                <span className="ndw-guide-step-text">
                  <span className="ndw-guide-step-name">{t(`welcome.step.${item}`)}</span>
                  <span className="ndw-guide-step-hint">{t(`welcome.step.${item}.hint`)}</span>
                </span>
              </li>
            ))}
          </ol>
        </nav>
        <section className="ndw-guide-body">
          <span className="ndw-welcome-eyebrow is-quiet">{t('welcome.guide.position', { current: index + 1, total: STEPS.length })}</span>
          {error && <p className="ndw-welcome-note is-error" role="alert">{error}</p>}
          {step === 'account' && <AccountStep busy={busy} run={run} onDone={next} />}
          {step === 'appearance' && (
            <AppearanceStep nav={nav} onNext={next} wallpaper={wallpaper} language={language} mode={config?.settings?.mode === 'light' ? 'light' : 'dark'}
              onLanguage={value => { setLanguage(value); void run(async () => { await updateConfig({ uiLanguage: value }); }); }}
              onMode={value => void run(async () => { await updateConfig({ mode: value }); })}
              onWallpaper={value => { setWallpaper(value); void run(async () => { await updateConfig({ backgroundImage: value }); }); }} />
          )}
          {step === 'integrations' && <IntegrationsStep nav={nav} onNext={next} onChanged={() => void refresh()} />}
          {step === 'widgets' && <WidgetsStep nav={nav} busy={busy} run={run} onDone={next} />}
          {step === 'access' && <AccessStep nav={nav} busy={busy} run={run} onDone={() => void finish()} />}
        </section>
      </div>
    </WelcomeShell>
  );
}

function AccountStep({ busy, run, onDone }: { busy: boolean; run: (action: () => Promise<void>) => Promise<void>; onDone: () => void }) {
  const { t } = useI18n();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 12) return setProblem(t('welcome.account.tooShort'));
    if (password !== confirm) return setProblem(t('welcome.account.mismatch'));
    setProblem(null);
    void run(async () => {
      const saved = await demoFetch('/api/auth/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', role: 'admin', password }) });
      if (!saved.ok) throw new Error(t('welcome.error.save'));
      // A new password ends the sessions of the account, this one too: sign in again with it, then carry on.
      const signedIn = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password }) });
      if (!signedIn.ok) throw new Error(t('login.authFailed'));
      onDone();
    });
  };
  return (
    <form className="ndw-guide-content" onSubmit={submit} noValidate>
      <h1 className="ndw-welcome-title">{t('welcome.account.title')}</h1>
      <p className="ndw-welcome-lead">{t('welcome.account.lead')}</p>
      {problem && <p className="ndw-welcome-note is-error" role="alert">{problem}</p>}
      <div className="ndw-guide-fields">
        <div className="ndw-welcome-field">
          <label className="ndw-welcome-label" htmlFor="setup-user">{t('welcome.signIn.username')}</label>
          <input id="setup-user" className="ndw-welcome-input" value="admin" readOnly autoComplete="username" />
        </div>
        <div className="ndw-welcome-field">
          <label className="ndw-welcome-label" htmlFor="setup-password">{t('welcome.account.password')}</label>
          <input id="setup-password" type="password" className="ndw-welcome-input" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" autoFocus disabled={busy} />
        </div>
        <div className="ndw-welcome-field">
          <label className="ndw-welcome-label" htmlFor="setup-confirm">{t('welcome.account.confirm')}</label>
          <input id="setup-confirm" type="password" className="ndw-welcome-input" value={confirm} onChange={event => setConfirm(event.target.value)} autoComplete="new-password" disabled={busy} />
        </div>
      </div>
      <p className="ndw-welcome-small">{t('welcome.account.hint')}</p>
      <GuideFooter primary={<Primary busy={busy} submit>{t('welcome.continue')}</Primary>} />
    </form>
  );
}

function AppearanceStep({ nav, onNext, wallpaper, language, mode, onLanguage, onMode, onWallpaper }: {
  nav: GuideNav; onNext: () => void; wallpaper: string; language: UiLanguage; mode: 'light' | 'dark'; onLanguage: (value: UiLanguage) => void; onMode: (value: 'light' | 'dark') => void; onWallpaper: (value: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="ndw-guide-content">
      <h1 className="ndw-welcome-title">{t('welcome.appearance.title')}</h1>
      <p className="ndw-welcome-lead">{t('welcome.appearance.lead')}</p>
      <div className="ndw-guide-row">
        <div className="ndw-welcome-field">
          <label className="ndw-welcome-label" htmlFor="setup-language">{t('welcome.appearance.language')}</label>
          <select id="setup-language" className="ndw-welcome-input" value={language} onChange={event => onLanguage(event.target.value as UiLanguage)}>
            {UI_LANGUAGES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </div>
        <fieldset className="ndw-welcome-field ndw-guide-fieldset">
          <legend className="ndw-welcome-label">{t('welcome.appearance.mode')}</legend>
          <div className="ndw-guide-segmented" role="radiogroup">
            {(['dark', 'light'] as const).map(value => (
              <button key={value} type="button" role="radio" aria-checked={mode === value} className={mode === value ? 'is-on' : ''} onClick={() => onMode(value)}>{t(`welcome.appearance.${value}`)}</button>
            ))}
          </div>
        </fieldset>
      </div>
      <fieldset className="ndw-guide-fieldset">
        <legend className="ndw-welcome-label">{t('welcome.appearance.wallpaper')}</legend>
        <div className="ndw-guide-wallpapers" role="radiogroup">
          {BUNDLED_WALLPAPERS.map(item => (
            <button key={item.id} type="button" role="radio" aria-checked={wallpaper === item.src} aria-label={t(`wallpaper.${item.id}`)} title={t(`wallpaper.${item.id}`)}
              className={wallpaper === item.src ? 'is-on' : ''} onClick={() => onWallpaper(item.src)}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a small local preview of the bundled photo */}
              <img src={item.src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
        <p className="ndw-welcome-small">{t('welcome.appearance.wallpaperHint')}</p>
      </fieldset>
      <GuideFooter nav={nav} primary={<Primary busy={nav.busy} onClick={onNext}>{t('welcome.continue')}</Primary>} />
    </div>
  );
}

function IntegrationsStep({ nav, onNext, onChanged }: { nav: GuideNav; onNext: () => void; onChanged: () => void }) {
  const { t } = useI18n();
  const { config } = useConfig();
  const [open, setOpen] = useState<string | null>(null);
  const [monitoring, setMonitoring] = useState<string | null>(null);
  const [service, setService] = useState<string | null>(null);
  const [docker, setDocker] = useState<DockerHostDraft['type'] | null>(null);
  const families: Family[] = useMemo(() => [
    { id: 'machines', icon: <Cpu size={17} />, kinds: selectableDeviceIntegrations().map(item => item.id), monitoring: true },
    { id: 'docker', icon: <Container size={17} />, kinds: DOCKER_KINDS, docker: true },
    { id: 'media', icon: <Film size={17} />, kinds: [...MEDIA_SERVER_TYPES, 'navidrome'] },
    { id: 'arr', icon: <Download size={17} />, kinds: [...ARR_TYPES, ...DOWNLOAD_CLIENT_TYPES] },
    { id: 'network', icon: <Network size={17} />, kinds: ['tailscale', 'headscale', ...VPN_TUNNEL_TYPES, ...DNS_TYPES] },
    { id: 'power', icon: <Zap size={17} />, kinds: UPS_TYPES },
    { id: 'photos', icon: <ImageIcon size={17} />, kinds: PHOTO_STATS_TYPES },
  ], []);
  const count = (family: Family) => family.docker ? (config?.dockerHosts ?? []).length
    : (config?.integrations ?? []).filter(instance => family.kinds.includes(instance.type)).length;
  const name = (kind: string) => getServiceIntegration(kind)?.name ?? selectableDeviceIntegrations().find(item => item.id === kind)?.name ?? kind;
  const addHost = async (draft: DockerHostDraft) => {
    const response = await demoFetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, type: 'dockerHost', connection: draft.type }) });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error || t('integrations.saveFailed'));
    }
    onChanged();
    setDocker(null);
  };
  return (
    <div className="ndw-guide-content">
      <h1 className="ndw-welcome-title">{t('welcome.integrations.title')}</h1>
      <p className="ndw-welcome-lead">{t('welcome.integrations.lead')}</p>
      <div className="ndw-guide-tiles">
        {families.map(family => {
          const connected = count(family);
          return (
            <div key={family.id} className={`ndw-guide-family ${open === family.id ? 'is-open' : ''}`}>
              <button type="button" className="ndw-guide-tile" aria-expanded={open === family.id} onClick={() => setOpen(current => current === family.id ? null : family.id)}>
                <span className="ndw-guide-tile-icon" aria-hidden="true">{family.icon}</span>
                <span className="ndw-guide-tile-text">
                  <span className="ndw-guide-tile-name">{t(`welcome.family.${family.id}`)}</span>
                  <span className="ndw-guide-tile-hint">{t(`welcome.family.${family.id}.hint`)}</span>
                </span>
                <span className={connected ? 'ndw-guide-tile-state is-on' : 'ndw-guide-tile-state'}>{connected ? t('welcome.integrations.connected', { count: connected }) : t('welcome.integrations.connect')}</span>
              </button>
              {open === family.id && (
                <div className="ndw-guide-kinds">
                  {family.kinds.map(kind => (
                    <button key={kind} type="button" className="ndw-guide-kind" onClick={() => family.docker ? setDocker(kind as DockerHostDraft['type']) : family.monitoring ? setMonitoring(kind) : setService(kind)}>
                      <IntegrationLogo id={kind} size={18} bare />
                      <span>{family.docker ? t(`integrations.docker.${kind}`) : name(kind)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <GuideFooter nav={nav} primary={<Primary busy={nav.busy} onClick={onNext}>{t('welcome.continue')}</Primary>} />
      {monitoring && <MonitoringConnectionDialog type={monitoring} onClose={() => { setMonitoring(null); onChanged(); }} />}
      {service && <ServiceConnectionDialog type={service} onClose={() => { setService(null); onChanged(); }} onSaved={() => onChanged()} />}
      {docker && <DockerHostFormModal initialConnection={docker} onClose={() => setDocker(null)} onSave={addHost} />}
    </div>
  );
}

function WidgetsStep({ nav, busy, run, onDone }: { nav: GuideNav; busy: boolean; run: (action: () => Promise<void>) => Promise<void>; onDone: () => void }) {
  const { t } = useI18n();
  const { config } = useConfig();
  const connectedTypes = useMemo(() => new Set((config?.integrations ?? []).map(instance => instance.type)), [config?.integrations]);
  const families = useMemo(() => new Set([
    ...((config?.devices ?? []).length ? ['machines'] : []),
    ...((config?.dockerHosts ?? []).length ? ['docker'] : []),
    ...(MEDIA_SERVER_TYPES.some(type => connectedTypes.has(type)) || connectedTypes.has('navidrome') ? ['media'] : []),
    ...([...ARR_TYPES, ...DOWNLOAD_CLIENT_TYPES].some(type => connectedTypes.has(type)) ? ['arr'] : []),
    ...(['tailscale', 'headscale', ...VPN_TUNNEL_TYPES, ...DNS_TYPES].some(type => connectedTypes.has(type)) ? ['network'] : []),
    ...(UPS_TYPES.some(type => connectedTypes.has(type)) ? ['power'] : []),
    ...(PHOTO_STATS_TYPES.some(type => connectedTypes.has(type)) ? ['photos'] : []),
  ]), [config?.devices, config?.dockerHosts, connectedTypes]);
  const offered = SUGGESTIONS.filter(item => families.has(item.family)).flatMap(item => item.widgets).filter(widget => familyWidgetConnected(widget, connectedTypes) && getWidgetCatalogEntry(widget));
  const always = ALWAYS.filter(widget => getWidgetCatalogEntry(widget));
  const [chosen, setChosen] = useState<Set<string>>(() => new Set([...offered, ...always].filter(widget => PRESELECTED.has(widget))));
  const toggle = (widget: string) => setChosen(current => { const nextSet = new Set(current); if (nextSet.has(widget)) nextSet.delete(widget); else nextSet.add(widget); return nextSet; });

  const save = () => void run(async () => {
    const response = await demoFetch('/api/pages', { cache: 'no-store' });
    const document = await response.json() as { pages?: Page[] };
    const home = document.pages?.[0];
    if (!home) throw new Error(t('welcome.error.save'));
    // In the order shown: the integrations' widgets first, then the everyday ones, each in the first free place.
    const page = [...offered, ...always].filter(widget => chosen.has(widget)).reduce((current, widget) => insertWidget(current, newWidgetInstance(widget, {}, current)), home);
    const saved = await demoFetch('/api/pages', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page }) });
    if (!saved.ok) throw new Error(t('welcome.error.save'));
    onDone();
  });

  const card = (widget: string) => {
    const entry = getWidgetCatalogEntry(widget)!;
    return (
      <label key={widget} className={`ndw-guide-widget ${chosen.has(widget) ? 'is-on' : ''}`}>
        <input type="checkbox" checked={chosen.has(widget)} onChange={() => toggle(widget)} />
        <Emoji emoji={entry.icon} forcedTheme="lucide" />
        <span>{t(entry.nameKey)}</span>
      </label>
    );
  };
  return (
    <div className="ndw-guide-content">
      <h1 className="ndw-welcome-title">{t('welcome.widgets.title')}</h1>
      <p className="ndw-welcome-lead">{t('welcome.widgets.lead')}</p>
      {offered.length > 0 && (
        <div className="ndw-guide-group">
          <span className="ndw-guide-group-name">{t('welcome.widgets.fromIntegrations')}</span>
          <div className="ndw-guide-widgets">{offered.map(card)}</div>
        </div>
      )}
      <div className="ndw-guide-group">
        <span className="ndw-guide-group-name">{t('welcome.widgets.always')}</span>
        <div className="ndw-guide-widgets">{always.map(card)}</div>
      </div>
      <GuideFooter nav={nav} note={<span className="ndw-welcome-small">{t('welcome.widgets.count', { count: chosen.size })}</span>}
        primary={<Primary busy={busy} onClick={save} disabled={chosen.size === 0}>{t('welcome.continue')}</Primary>} />
    </div>
  );
}

function AccessStep({ nav, busy, run, onDone }: { nav: GuideNav; busy: boolean; run: (action: () => Promise<void>) => Promise<void>; onDone: () => void }) {
  const { t } = useI18n();
  const { updateConfig } = useConfig();
  const [mode, setMode] = useState<'private' | 'public'>('private');
  const save = () => void run(async () => {
    if (mode === 'public' && !await updateConfig({ securityMode: 'public' })) throw new Error(t('welcome.error.save'));
    onDone();
  });
  return (
    <div className="ndw-guide-content">
      <h1 className="ndw-welcome-title">{t('welcome.access.title')}</h1>
      <p className="ndw-welcome-lead">{t('welcome.access.lead')}</p>
      <div className="ndw-guide-choices" role="radiogroup">
        {(['private', 'public'] as const).map(value => (
          <button key={value} type="button" role="radio" aria-checked={mode === value} className={`ndw-guide-choice ${mode === value ? 'is-on' : ''}`} onClick={() => setMode(value)}>
            <span className="ndw-guide-tile-name">{t(`welcome.access.${value}`)}</span>
            <span className="ndw-guide-tile-hint">{t(`welcome.access.${value}.hint`)}</span>
          </button>
        ))}
      </div>
      <GuideFooter nav={{ ...nav, onSkip: onDone }} primary={<Primary busy={busy} onClick={save}>{t('welcome.access.finish')}</Primary>} />
    </div>
  );
}
