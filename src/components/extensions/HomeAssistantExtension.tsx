'use client';

import { useState, useRef, useCallback } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { Settings, Plus, Trash2, Home, RefreshCw } from 'lucide-react';

// ======================== HOME ASSISTANT FORM MODAL ========================
function HomeAssistantFormModal({ onClose, onSave, initialUrl }: {
  onClose: () => void;
  onSave: (url: string) => void;
  initialUrl: string;
}) {
  const [url, setUrl] = useState(initialUrl);

  return (
    <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="nd-modal animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
            <Home size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700 }}>Configuration HA</h3>
            <p style={{ fontSize: '0.65rem', color: 'var(--nd-text-muted)' }}>Lien vers votre dashboard Lovelace</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="nd-label mb-2 block">Adresse du Dashboard</label>
            <input 
              className="nd-input w-full" 
              value={url} 
              onChange={e => setUrl(e.target.value)} 
              placeholder="http://192.168.0.203:8123/lovelace/dashboard" 
            />
            <p style={{ fontSize: '0.62rem', color: 'var(--nd-text-dimmed)', marginTop: 8, lineHeight: 1.5 }}>
              Note : Le paramètre <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 4px', borderRadius: 3 }}>?kiosk</code> sera automatiquement ajouté pour une intégration invisible.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="nd-btn" onClick={onClose}>Annuler</button>
            <button className="nd-btn nd-btn-accent px-6" onClick={() => {
              if (!url) return;
              onSave(url);
            }} disabled={!url.trim()}>Enregistrer</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ======================== MAIN HOME ASSISTANT EXTENSION ========================
export default function HomeAssistantExtension({ editMode, isVisible }: { editMode: boolean; isVisible: boolean }) {
  const { config, refresh } = useConfig();
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const savedUrl = config?.settings?.homeAssistantUrl || '';

  const handleSave = async (urlInput: string) => {
    setIsSaving(true);
    try {
      let finalUrl = urlInput.trim();
      if (!finalUrl.includes('kiosk')) {
        finalUrl += (finalUrl.includes('?') ? '&' : '?') + 'kiosk';
      }

      await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'settings', homeAssistantUrl: finalUrl }),
      });
      await refresh();
      setShowModal(false);
    } catch (error) {
      console.error('Failed to save HA URL:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Voulez-vous vraiment supprimer la connexion à Home Assistant ?')) return;
    try {
      await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'settings', homeAssistantUrl: '' }),
      });
      await refresh();
    } catch (error) {
      console.error('Failed to delete HA URL:', error);
    }
  };

  const handleReload = useCallback(() => {
    if (iframeRef.current) {
      iframeRef.current.src = savedUrl;
    }
  }, [savedUrl]);

  // View Mode — Only render iframe when tab is active AND URL exists AND not editing
  // This is the key optimization: the iframe is fully UNMOUNTED when leaving the HA tab,
  // which stops all HA WebSocket connections, timers, and DOM from consuming resources.
  if (savedUrl && !editMode && isVisible) {
    return (
      <div className="flex flex-col w-full flex-1 overflow-hidden animate-in fade-in duration-500">
        <iframe
          ref={iframeRef}
          src={savedUrl}
          title="Home Assistant"
          className="grow w-full border-0 bg-transparent"
          allow="fullscreen"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
        />
      </div>
    );
  }

  // Setup / Edit View — Inspired by Docker Empty State
  return (
    <div className="flex flex-col items-center justify-center h-full animate-in fade-in duration-500">
      <div className="nd-docker-empty">
        <div className="nd-docker-empty-icon text-blue-400">🏠</div>
        <div className="nd-docker-empty-title">Dashboard Domotique</div>
        <div className="nd-docker-empty-desc">
          {savedUrl 
            ? "Votre dashboard Home Assistant est configuré. Vous pouvez modifier le lien ou supprimer la connexion."
            : "Connectez votre dashboard Home Assistant pour piloter votre maison directement depuis NasDash."
          }
        </div>
        
        <div className="flex gap-3 mt-4">
          <button className="nd-btn nd-btn-accent" onClick={() => setShowModal(true)} disabled={isSaving}>
            {savedUrl ? <Settings size={14} /> : <Plus size={14} />}
            {savedUrl ? "Modifier le lien" : "Connecter Home Assistant"}
          </button>

          {savedUrl && (
            <>
              <button className="nd-btn" onClick={handleReload} title="Recharger l'iframe">
                <RefreshCw size={14} />
              </button>
              <button className="nd-btn bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20" onClick={handleDelete}>
                <Trash2 size={14} /> Supprimer
              </button>
            </>
          )}
        </div>
      </div>

      {showModal && (
        <HomeAssistantFormModal 
          initialUrl={savedUrl}
          onClose={() => setShowModal(false)} 
          onSave={handleSave} 
        />
      )}
    </div>
  );
}
