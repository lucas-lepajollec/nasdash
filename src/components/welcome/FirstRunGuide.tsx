'use client';

import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, Cpu, Container, Download, Film, Globe, Image as ImageIcon, Lock, Network, Zap } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { usePages } from '@/providers/PagesProvider';
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
import CustomSelect from '@/components/shared/CustomSelect';
import { CalmeHeading, CalmeSegmented } from '@/components/modals/settings/shared/CalmeControls';
import { DEFAULT_GLASS, WelcomeShell } from './WelcomeShell';

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
/** Back, skip (possible once the account is secured) and the step's own main action: the settings' buttons. */
function GuideFooter({ nav, primary, note }: { nav?: GuideNav; primary: React.ReactNode; note?: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <footer className="ndw-guide-actions">
      {nav && <button type="button" className="nd-btn" onClick={nav.onBack} disabled={nav.busy}>{t('welcome.back')}</button>}
      <span className="ndw-spacer">{note}</span>
      {nav && <button type="button" className="ndc-text-button" onClick={nav.onSkip} disabled={nav.busy}>{t('welcome.skip')}</button>}
      {primary}
    </footer>
  );
}
function Primary({ busy, onClick, children, disabled, submit, form }: { busy: boolean; onClick?: () => void; children: React.ReactNode; disabled?: boolean; submit?: boolean; form?: string }) {
  return (
    <button type={submit ? 'submit' : 'button'} form={form} className="nd-btn nd-btn-accent" onClick={onClick} disabled={busy || disabled}>
      {busy ? <span className="ndw-spinner" aria-hidden="true" /> : children}
    </button>
  );
}
/** The settings' heading: where you are, a large title, what the step is for. */
function StepHead({ index, step }: { index: number; step: Step }) {
  const { t } = useI18n();
  return (
    <div className="ndc-settings-head">
      <span className="ndc-settings-crumb">{t('welcome.guide.title')} / {t('welcome.guide.position', { current: index + 1, total: STEPS.length })}</span>
      <h1 className="ndc-settings-title">{t(`welcome.${step}.title`)}</h1>
      <p className="ndc-settings-desc">{t(`welcome.${step}.lead`)}</p>
    </div>
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
      window.location.href = '/?tour';
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('welcome.error.save')); setBusy(false); }
  };
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : t('welcome.error.save')); } finally { setBusy(false); }
  };
  const next = () => setStep(STEPS[Math.min(STEPS.length - 1, index + 1)]);
  const back = () => setStep(STEPS[Math.max(0, index - 1)]);
  const nav: GuideNav = { busy, onBack: back, onSkip: () => void finish() };

  const mode = config?.settings?.mode === 'light' ? 'light' : 'dark';
  const glass = {
    opacity: config?.settings?.cardOpacity ?? DEFAULT_GLASS.opacity,
    blur: config?.settings?.surfaceBlur ?? DEFAULT_GLASS.blur,
    dim: config?.settings?.wallpaperDim ?? DEFAULT_GLASS.dim,
  };
  return (
    <WelcomeShell wallpaper={wallpaper} mode={mode} glass={glass}>
      <div className="ndw-surface ndw-guide">
        <nav className="ndc-settings-nav" aria-label={t('welcome.guide.steps')}>
          <div className="ndc-settings-nav-label">{t('welcome.guide.title')}</div>
          <ol className="ndw-steps">
            {STEPS.map((item, position) => (
              <li key={item} className={`ndw-step ${position < index ? 'is-done' : position === index ? 'is-now' : ''}`} aria-current={position === index ? 'step' : undefined}>
                <span className="ndw-step-mark" aria-hidden="true">{position < index ? <Check size={13} /> : position + 1}</span>
                <span className="ndw-step-name">{t(`welcome.step.${item}`)}</span>
              </li>
            ))}
          </ol>
        </nav>
        <section className="ndw-guide-body">
          {step === 'account' && <AccountStep index={index} busy={busy} error={error} run={run} onDone={next} />}
          {step === 'appearance' && (
            <AppearanceStep index={index} error={error} nav={nav} onNext={next} wallpaper={wallpaper} language={language} mode={mode}
              onLanguage={value => { setLanguage(value); void run(async () => { await updateConfig({ uiLanguage: value }); }); }}
              onMode={value => void run(async () => { await updateConfig({ mode: value }); })}
              onWallpaper={value => { setWallpaper(value); void run(async () => { await updateConfig({ backgroundImage: value }); }); }} />
          )}
          {step === 'integrations' && <IntegrationsStep index={index} error={error} nav={nav} onNext={next} onChanged={() => void refresh()} />}
          {step === 'widgets' && <WidgetsStep index={index} error={error} nav={nav} busy={busy} run={run} onDone={next} />}
          {step === 'access' && <AccessStep index={index} error={error} nav={nav} busy={busy} run={run} onDone={() => void finish()} />}
        </section>
      </div>
    </WelcomeShell>
  );
}

/** One step: its scrolling content under the settings' heading, then the footer, always visible. */
function StepFrame({ index, step, error, children, footer }: { index: number; step: Step; error: string | null; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <>
      <div className="ndw-guide-scroll">
        <StepHead index={index} step={step} />
        <div className="ndw-guide-content">
          {error && <p className="ndw-alert is-error" role="alert">{error}</p>}
          {children}
        </div>
      </div>
      {footer}
    </>
  );
}

function AccountStep({ index, busy, error, run, onDone }: { index: number; busy: boolean; error: string | null; run: (action: () => Promise<void>) => Promise<void>; onDone: () => void }) {
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
    <StepFrame index={index} step="account" error={error ?? problem} footer={<GuideFooter primary={<Primary busy={busy} submit form="setup-account">{t('welcome.continue')}</Primary>} />}>
      <form id="setup-account" className="ndw-guide-fields" onSubmit={submit} noValidate>
        <div className="ndw-field">
          <label className="ndw-label" htmlFor="setup-user">{t('welcome.signIn.username')}</label>
          <input id="setup-user" className="nd-input" value="admin" readOnly autoComplete="username" />
        </div>
        <div className="ndw-field">
          <label className="ndw-label" htmlFor="setup-password">{t('welcome.account.password')}</label>
          <input id="setup-password" type="password" className="nd-input" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" autoFocus disabled={busy} />
        </div>
        <div className="ndw-field">
          <label className="ndw-label" htmlFor="setup-confirm">{t('welcome.account.confirm')}</label>
          <input id="setup-confirm" type="password" className="nd-input" value={confirm} onChange={event => setConfirm(event.target.value)} autoComplete="new-password" disabled={busy} />
        </div>
        <p className="ndw-small">{t('welcome.account.hint')}</p>
      </form>
    </StepFrame>
  );
}

function AppearanceStep({ index, error, nav, onNext, wallpaper, language, mode, onLanguage, onMode, onWallpaper }: {
  index: number; error: string | null; nav: GuideNav; onNext: () => void; wallpaper: string; language: UiLanguage; mode: 'light' | 'dark'; onLanguage: (value: UiLanguage) => void; onMode: (value: 'light' | 'dark') => void; onWallpaper: (value: string) => void;
}) {
  const { t } = useI18n();
  return (
    <StepFrame index={index} step="appearance" error={error} footer={<GuideFooter nav={nav} primary={<Primary busy={nav.busy} onClick={onNext}>{t('welcome.continue')}</Primary>} />}>
      <section className="ndc-set-block">
        <CalmeHeading>{t('welcome.appearance.display')}</CalmeHeading>
        <div className="ndc-inline-row">
          <span>{t('welcome.appearance.language')}</span>
          <div style={{ width: 200 }}>
            <CustomSelect ariaLabel={t('welcome.appearance.language')} value={language} onChange={value => onLanguage(value as UiLanguage)} options={UI_LANGUAGES.map(item => ({ value: item.id, label: item.label }))} />
          </div>
        </div>
        <div className="ndc-inline-row">
          <span>{t('welcome.appearance.mode')}</span>
          <CalmeSegmented label={t('welcome.appearance.mode')} value={mode}
            options={[{ value: 'dark', label: t('welcome.appearance.dark') }, { value: 'light', label: t('welcome.appearance.light') }]}
            onChange={value => onMode(value)} />
        </div>
      </section>
      <section className="ndc-set-block">
        <CalmeHeading info={t('welcome.appearance.wallpaperHint')}>{t('welcome.appearance.wallpaper')}</CalmeHeading>
        {/* The tiles of Settings → Appearance → Wallpaper. */}
        <div className="ndc-wallpapers" role="group" aria-label={t('welcome.appearance.wallpaper')}>
          {BUNDLED_WALLPAPERS.map(item => (
            <button key={item.id} type="button" aria-pressed={wallpaper === item.src} aria-label={t(`wallpaper.${item.id}`)} title={t(`wallpaper.${item.id}`)}
              className="ndc-wallpaper" style={{ backgroundImage: `url("${item.src}")` }} onClick={() => onWallpaper(item.src)} />
          ))}
        </div>
      </section>
    </StepFrame>
  );
}

function IntegrationsStep({ index, error, nav, onNext, onChanged }: { index: number; error: string | null; nav: GuideNav; onNext: () => void; onChanged: () => void }) {
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
  const label = (family: Family, kind: string) => family.docker ? t(`integrations.docker.${kind}`) : name(kind);
  return (
    <StepFrame index={index} step="integrations" error={error} footer={<GuideFooter nav={nav} primary={<Primary busy={nav.busy} onClick={onNext}>{t('welcome.continue')}</Primary>} />}>
      <div className="ndw-families">
        {families.map(family => {
          const connected = count(family);
          const isOpen = open === family.id;
          return (
            <div key={family.id} className="ndw-family">
              <button type="button" className="ndw-family-row" aria-expanded={isOpen} onClick={() => setOpen(current => current === family.id ? null : family.id)}>
                <span className="ndw-family-icon" aria-hidden="true">{family.icon}</span>
                <span className="ndw-family-text">
                  <span className="ndw-family-name">{t(`welcome.family.${family.id}`)}</span>
                  <span className="ndw-family-hint">{t(`welcome.family.${family.id}.hint`)}</span>
                </span>
                <span className={connected ? 'ndw-family-state is-on' : 'ndw-family-state'}>{connected ? t('welcome.integrations.connected', { count: connected }) : t('welcome.integrations.none')}</span>
                <ChevronDown size={14} aria-hidden="true" style={{ flex: 'none', color: 'var(--nd-text-dimmed)', transform: isOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s ease' }} />
              </button>
              {isOpen && (
                // The tiles of Settings → Integrations: each opens NasDash's own connection window.
                <div className="ndc-int-tiles">
                  {family.kinds.map(kind => (
                    <button key={kind} type="button" className="ndc-int-tile" onClick={() => family.docker ? setDocker(kind as DockerHostDraft['type']) : family.monitoring ? setMonitoring(kind) : setService(kind)}>
                      <IntegrationLogo id={kind} size={28} />
                      <span className="ndc-int-tile-text"><span className="ndc-int-tile-name">{label(family, kind)}</span></span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {monitoring && <MonitoringConnectionDialog type={monitoring} onClose={() => { setMonitoring(null); onChanged(); }} />}
      {service && <ServiceConnectionDialog type={service} onClose={() => { setService(null); onChanged(); }} onSaved={() => onChanged()} />}
      {docker && <DockerHostFormModal initialConnection={docker} onClose={() => setDocker(null)} onSave={addHost} />}
    </StepFrame>
  );
}

function WidgetsStep({ index, error, nav, busy, run, onDone }: { index: number; error: string | null; nav: GuideNav; busy: boolean; run: (action: () => Promise<void>) => Promise<void>; onDone: () => void }) {
  const { t } = useI18n();
  const { config } = useConfig();
  const home = usePages().pages[0];
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
  // Home already holds the clock and the weather: they start ticked, like the main widgets of what is connected.
  const onHome = useMemo(() => new Set((home?.widgets ?? []).map(widget => widget.type)), [home]);
  const [chosen, setChosen] = useState<Set<string>>(() => new Set([...offered, ...always].filter(widget => PRESELECTED.has(widget) || onHome.has(widget))));
  const toggle = (widget: string) => setChosen(current => { const nextSet = new Set(current); if (nextSet.has(widget)) nextSet.delete(widget); else nextSet.add(widget); return nextSet; });

  const save = () => void run(async () => {
    const response = await demoFetch('/api/pages', { cache: 'no-store' });
    const document = await response.json() as { pages?: Page[] };
    const current = document.pages?.[0];
    if (!current) throw new Error(t('welcome.error.save'));
    const listed = new Set([...offered, ...always]);
    // Unticked widgets of the list leave Home; ticked ones not there yet arrive, in the order shown, each in the first free place.
    const kept = current.widgets.filter(widget => !listed.has(widget.type) || chosen.has(widget.type));
    const present = new Set(kept.map(widget => widget.type));
    const page = [...offered, ...always].filter(widget => chosen.has(widget) && !present.has(widget))
      .reduce((draft, widget) => insertWidget(draft, newWidgetInstance(widget, {}, draft)), { ...current, widgets: kept });
    const saved = await demoFetch('/api/pages', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page }) });
    if (!saved.ok) throw new Error(t('welcome.error.save'));
    onDone();
  });

  // The cards of the widget library.
  const card = (widget: string) => {
    const entry = getWidgetCatalogEntry(widget)!;
    const picked = chosen.has(widget);
    return (
      <button key={widget} type="button" className={`nd-page-library-card ${picked ? 'is-picked' : ''}`} aria-pressed={picked} onClick={() => toggle(widget)}>
        <span className="nd-page-library-card-icon"><Emoji emoji={entry.icon} forcedTheme="lucide" /></span>
        {picked && <span className="nd-page-library-check" aria-hidden="true"><Check size={12} /></span>}
        <span className="nd-page-library-card-text">
          <strong>{t(entry.nameKey)}</strong>
          <span>{t(entry.descriptionKey)}</span>
        </span>
      </button>
    );
  };
  return (
    <StepFrame index={index} step="widgets" error={error} footer={
      <GuideFooter nav={nav} note={t('welcome.widgets.count', { count: chosen.size })}
        primary={<Primary busy={busy} onClick={save}>{t('welcome.continue')}</Primary>} />
    }>
      {offered.length > 0 && (
        <section className="ndc-set-block">
          <CalmeHeading>{t('welcome.widgets.fromIntegrations')}</CalmeHeading>
          <div className="nd-page-library-grid">{offered.map(card)}</div>
        </section>
      )}
      <section className="ndc-set-block">
        <CalmeHeading>{t('welcome.widgets.always')}</CalmeHeading>
        <div className="nd-page-library-grid">{always.map(card)}</div>
      </section>
    </StepFrame>
  );
}

function AccessStep({ index, error, nav, busy, run, onDone }: { index: number; error: string | null; nav: GuideNav; busy: boolean; run: (action: () => Promise<void>) => Promise<void>; onDone: () => void }) {
  const { t } = useI18n();
  const { updateConfig } = useConfig();
  const [mode, setMode] = useState<'private' | 'public'>('private');
  const save = () => void run(async () => {
    if (mode === 'public' && !await updateConfig({ securityMode: 'public' })) throw new Error(t('welcome.error.save'));
    onDone();
  });
  return (
    <StepFrame index={index} step="access" error={error} footer={<GuideFooter nav={{ ...nav, onSkip: onDone }} primary={<Primary busy={busy} onClick={save}>{t('welcome.access.finish')}</Primary>} />}>
      {/* The cards of the widget library, one choice at a time. */}
      <div className="nd-page-library-grid" role="radiogroup" aria-label={t('welcome.access.title')}>
        {(['private', 'public'] as const).map(value => (
          <button key={value} type="button" role="radio" aria-checked={mode === value} className={`nd-page-library-card ${mode === value ? 'is-picked' : ''}`} onClick={() => setMode(value)}>
            <span className="nd-page-library-card-icon">{value === 'private' ? <Lock size={18} /> : <Globe size={18} />}</span>
            {mode === value && <span className="nd-page-library-check" aria-hidden="true"><Check size={12} /></span>}
            <span className="nd-page-library-card-text">
              <strong>{t(`welcome.access.${value}`)}</strong>
              <span>{t(`welcome.access.${value}.hint`)}</span>
            </span>
          </button>
        ))}
      </div>
    </StepFrame>
  );
}
