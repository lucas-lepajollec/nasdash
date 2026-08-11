'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--nd-bg)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: '50%',
              border: '3px solid var(--nd-card-border)',
              borderTopColor: 'var(--nd-accent)',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--nd-text-muted)' }}>Chargement...</span>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRedirect = searchParams.get('redirect');
  const notice = searchParams.get('reason') === 'password-changed'
    ? 'Votre mot de passe a été modifié. Reconnectez-vous avec votre nouveau mot de passe.'
    : null;
  const redirectTo = requestedRedirect && /^\/(?!\/)/.test(requestedRedirect) && !requestedRedirect.includes('\\')
    ? requestedRedirect
    : '/';

  // Vérifier si déjà connecté au montage
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Veuillez remplir tous les champs.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erreur d\'authentification');
      }

      // Recharger pour que le ConfigProvider récupère la session
      window.location.href = redirectTo;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors de la connexion.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--nd-bg)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: '50%',
              border: '3px solid var(--nd-card-border)',
              borderTopColor: 'var(--nd-accent)',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--nd-text-muted)' }}>Vérification de la session...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
      backgroundColor: 'var(--nd-bg)',
      backgroundImage: 'var(--nd-bg-gradient)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }}>
      {/* Halo lumineux décoratif en arrière-plan */}
      <div style={{
        position: 'absolute',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(var(--nd-accent-rgb, 0, 168, 204), 0.15) 0%, rgba(0,0,0,0) 70%)',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 0,
        pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%',
        maxWidth: '400px',
        padding: '32px',
        background: 'var(--nd-card-bg, rgba(20, 20, 20, 0.6))',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--nd-card-border)',
        borderRadius: 'var(--nd-card-radius, 12px)',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
        zIndex: 1,
        transition: 'all 0.3s ease',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h1 style={{
            fontSize: '1.8rem',
            fontWeight: 800,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            color: 'var(--nd-text)',
            marginBottom: '8px',
            fontFamily: 'var(--font-outfit), sans-serif',
            background: 'linear-gradient(90deg, var(--nd-text) 0%, var(--nd-accent) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            NasDash
          </h1>
          <p style={{ fontSize: '0.78rem', color: 'var(--nd-text-muted)' }}>
            Accès sécurisé à votre tableau de bord
          </p>
        </div>

        {notice && (
          <div role="status" style={{
            padding: '12px',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '6px',
            color: 'var(--nd-green, #10b981)',
            fontSize: '0.75rem',
            marginBottom: '20px',
            textAlign: 'center',
          }}>
            {notice}
          </div>
        )}

        {error && (
          <div style={{
            padding: '12px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '6px',
            color: 'var(--nd-red, #ef4444)',
            fontSize: '0.75rem',
            marginBottom: '20px',
            textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="login-username" style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--nd-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Nom d&apos;utilisateur
            </label>
            <input
              id="login-username"
              type="text"
              className="nd-input"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Ex: admin"
              disabled={loading}
              autoFocus
              style={{
                width: '100%',
                padding: '12px 14px',
                fontSize: '0.85rem',
                borderRadius: '6px',
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--nd-card-border)',
                color: 'var(--nd-text)',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="login-password" style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--nd-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Mot de passe
            </label>
            <input
              id="login-password"
              type="password"
              className="nd-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 14px',
                fontSize: '0.85rem',
                borderRadius: '6px',
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--nd-card-border)',
                color: 'var(--nd-text)',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
            />
          </div>

          <button
            type="submit"
            className="nd-btn accent"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: '0.82rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              borderRadius: '6px',
              background: 'var(--nd-accent)',
              border: 'none',
              color: '#000000',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '10px',
              transition: 'opacity 0.2s',
            }}
          >
            {loading ? (
              <div
                style={{
                  width: 14, height: 14, borderRadius: '50%',
                  border: '2px solid rgba(0,0,0,0.1)',
                  borderTopColor: '#000000',
                  animation: 'spin 0.6s linear infinite',
                }}
              />
            ) : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
