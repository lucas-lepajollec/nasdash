'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Copy, Check } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { normalizeSetupCode, WelcomeShell, useSetupStatus } from '@/components/welcome/WelcomeShell';
import '../welcome.css';

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginFallback() {
  const { t } = useI18n();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--nd-bg)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--nd-card-border)', borderTopColor: 'var(--nd-accent)', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontSize: '0.75rem', color: 'var(--nd-text-muted)' }}>{t('Chargement…')}</span>
      </div>
    </div>
  );
}

// The documented offline recovery: NasDash stopped, so its account cache cannot overwrite the new password.
const RESET_COMMAND = 'docker compose stop nasdash && docker compose run --rm --no-deps --entrypoint node nasdash scripts/reset-password.mjs admin && docker compose up -d nasdash';
const SETUP_COMMAND = 'docker compose logs nasdash | grep "Setup code"';

function LoginForm() {
  const { t } = useI18n();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [forgotten, setForgotten] = useState(false);
  const setup = useSetupStatus();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRedirect = searchParams.get('redirect');
  const notice = searchParams.get('reason') === 'password-changed'
    ? t('login.passwordChanged')
    : null;
  const redirectTo = requestedRedirect && /^\/(?!\/)/.test(requestedRedirect) && !requestedRedirect.includes('\\')
    ? requestedRedirect
    : '/';

  // Already signed in: straight to the requested page.
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        const data = await res.json();
        if (data.user && !data.user.isAnonymous) {
          router.replace(redirectTo);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setCheckingSession(false);
      }
    }
    checkSession();
  }, [router, redirectTo]);

  const signIn = async (name: string, secret: string) => fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: name, password: secret }),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const firstStart = setup?.pending === true;
    if ((!firstStart && !username) || !password) {
      setError(t('Veuillez remplir tous les champs.'));
      return;
    }

    setError(null);
    setLoading(true);

    try {
      let res: Response;
      if (firstStart) {
        // The setup code is the administrator's first password. A password chosen through NASDASH_ADMIN_PASSWORD is
        // tried as typed; a code is also tried in its canonical form (upper case, with dashes).
        res = await signIn('admin', password.trim());
        const code = normalizeSetupCode(password);
        if (res.status === 401 && code !== password.trim()) res = await signIn('admin', code);
      } else {
        res = await signIn(username, password);
      }
      const data = await res.json();

      if (!res.ok) {
        throw new Error(firstStart && res.status === 401 ? t('welcome.code.wrong') : data.error ? t(data.error) : t('login.authFailed'));
      }

      // A full reload lets the providers pick the session up.
      window.location.href = firstStart ? '/setup' : redirectTo;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('login.unexpectedError'));
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession || !setup) return <LoginFallback />;

  const submit = (label: string) => (
    <button type="submit" className="nd-btn nd-btn-accent is-block" disabled={loading}>
      {loading ? <span className="ndw-spinner" aria-hidden="true" /> : label}
    </button>
  );

  if (setup.pending) {
    return (
      <WelcomeShell wallpaper={setup.wallpaper} mode={setup.mode} glass={setup.glass}>
        <form className="ndw-surface ndw-card is-wide" onSubmit={handleSubmit} noValidate>
          <div>
            <span className="ndc-settings-crumb">{t('welcome.code.eyebrow')}</span>
            <h1 className="ndc-settings-title">{t('welcome.code.title')}</h1>
            <p className="ndc-settings-desc">{t('welcome.code.lead')}</p>
          </div>
          {error && <p className="ndw-alert is-error" role="alert">{error}</p>}
          <div className="ndw-field">
            <label className="ndw-label" htmlFor="setup-code">{t('welcome.code.label')}</label>
            <input id="setup-code" className="nd-input is-code" value={password} onChange={event => setPassword(event.target.value)}
              placeholder={t('welcome.code.placeholder')} autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} disabled={loading} autoFocus />
          </div>
          <div className="ndw-help">
            <span className="ndw-help-title">{t('welcome.code.where')}</span>
            <CopyCommand command={SETUP_COMMAND} />
            <p className="ndw-small">{t('welcome.code.whereHint')}</p>
          </div>
          {submit(t('welcome.continue'))}
        </form>
      </WelcomeShell>
    );
  }

  return (
    <WelcomeShell wallpaper={setup.wallpaper} mode={setup.mode} glass={setup.glass}>
      <form className="ndw-surface ndw-card" onSubmit={handleSubmit} noValidate>
        <div>
          <span className="ndc-settings-crumb">nasdash</span>
          <h1 className="ndc-settings-title">{t('welcome.signIn.title')}</h1>
          <p className="ndc-settings-desc">{t('welcome.signIn.lead')}</p>
        </div>
        {notice && <p className="ndw-alert is-ok" role="status">{notice}</p>}
        {error && <p className="ndw-alert is-error" role="alert">{error}</p>}
        <div className="ndw-field">
          <label className="ndw-label" htmlFor="login-username">{t('welcome.signIn.username')}</label>
          <input id="login-username" className="nd-input" value={username} onChange={e => setUsername(e.target.value)}
            autoComplete="username" autoCapitalize="none" spellCheck={false} disabled={loading} autoFocus />
        </div>
        <div className="ndw-field">
          <div className="ndw-label-row">
            <label className="ndw-label" htmlFor="login-password">{t('Mot de passe')}</label>
            <button type="button" className="ndc-text-button" aria-expanded={forgotten} onClick={() => setForgotten(open => !open)}>{t('welcome.signIn.forgotten')}</button>
          </div>
          <input id="login-password" type="password" className="nd-input" value={password} onChange={e => setPassword(e.target.value)}
            autoComplete="current-password" disabled={loading} />
        </div>
        {forgotten && (
          <div className="ndw-help">
            <span className="ndw-help-title">{t('welcome.signIn.resetTitle')}</span>
            <CopyCommand command={RESET_COMMAND} />
            <p className="ndw-small">{t('welcome.signIn.resetHint')}</p>
          </div>
        )}
        {submit(t('Se connecter'))}
      </form>
    </WelcomeShell>
  );
}

function CopyCommand({ command }: { command: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(command); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { /* The command stays selectable. */ }
  };
  return (
    <div className="ndw-command">
      <code>{command}</code>
      <button type="button" className="ndc-icon-button" onClick={() => void copy()} aria-label={t('welcome.copyCommand')} title={t('welcome.copyCommand')}>
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      </button>
    </div>
  );
}
