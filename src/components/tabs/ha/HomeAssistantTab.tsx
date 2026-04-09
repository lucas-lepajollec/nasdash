'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { Settings, Plus, Trash2, Home, RefreshCw } from 'lucide-react';
import ConfirmModal from '../../shared/ConfirmModal';

// ======================== HOME ASSISTANT FORM MODAL ========================
function HomeAssistantFormModal({ onClose, onSave, onDelete, initialUrl }: {
  onClose: () => void;
  onSave: (url: string) => void;
  onDelete?: () => void;
  initialUrl: string;
}) {
  const [url, setUrl] = useState(initialUrl);

  return (
    <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="nd-modal">
        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 16 }}>Configuration Home Assistant</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="nd-label">Adresse du Dashboard</label>
            <input 
              className="nd-input w-full" 
              value={url} 
              onChange={e => setUrl(e.target.value)} 
              placeholder="http://192.168.0.203:8123/lovelace/dashboard" 
            />
          </div>
          <p style={{ fontSize: '0.62rem', color: 'var(--nd-text-dimmed)', lineHeight: 1.5 }}>
            Note : Le paramètre <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 4px', borderRadius: 3 }}>?kiosk</code> sera automatiquement ajouté pour une intégration invisible.
          </p>
          
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8, alignItems: 'center' }}>
            {onDelete && (
              <button 
                className="nd-btn" 
                style={{ marginRight: 'auto', border: 'none', background: 'transparent', color: 'var(--nd-red)', padding: '4px 8px' }}
                onClick={onDelete}
              >
                <Trash2 size={14} /> Supprimer
              </button>
            )}
            <button className="nd-btn" onClick={onClose}>Annuler</button>
            <button className="nd-btn nd-btn-accent" onClick={() => {
              if (!url) return;
              onSave(url);
            }} disabled={!url.trim()}>Enregistrer</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ======================== MAIN HOME ASSISTANT TAB ========================
export default function HomeAssistantTab({ editMode, isVisible }: { editMode: boolean; isVisible: boolean }) {
  const { config, refresh } = useConfig();
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const savedUrl = config?.settings?.homeAssistantUrl || '';

  useEffect(() => {
    if (isVisible) {
      setShowLoader(true);
    }
  }, [isVisible, savedUrl]);

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
    try {
      await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'settings', homeAssistantUrl: '' }),
      });
      await refresh();
      setShowDeleteConfirm(false); // Close confirmation modal after success
    } catch (error) {
      console.error('Failed to delete HA URL:', error);
    }
  };

  const handleReload = useCallback(() => {
    setShowLoader(true);
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  }, []);

  const handleIframeLoad = () => {
    setTimeout(() => {
      setShowLoader(false);
    }, 1500);
  };

  if (savedUrl && !editMode && isVisible) {
    return (
      <div className="flex flex-col w-full flex-1 overflow-hidden animate-in fade-in duration-500 relative bg-[#0d1117]">
        <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0d1117] transition-opacity duration-1000 ${showLoader ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="animate-spin w-8 h-8 relative mb-4">
            <div className="absolute inset-0 rounded-full border-2 border-[var(--nd-card-border)]"></div>
            <div className="absolute inset-0 rounded-full border-t-2 border-blue-500"></div>
          </div>
          <div className="text-sm text-[var(--nd-text-muted)] font-medium">Chargement Dashboard...</div>
        </div>
        
        <iframe
          ref={iframeRef}
          src={savedUrl}
          title="Home Assistant"
          onLoad={handleIframeLoad}
          className={`grow w-full border-0 bg-transparent min-h-[calc(100vh-140px)] transition-opacity duration-1000 ${showLoader ? 'opacity-0' : 'opacity-100'}`}
          allow="fullscreen"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
        />
      </div>
    );
  }

  // Setup / Edit View - Handled centering locally
  return (
    <div className="flex flex-col items-center justify-center p-6 animate-in fade-in duration-500" style={{ minHeight: 'calc(100vh - 120px)' }}>
      <div className="nd-docker-empty nd-card p-12 max-w-xl shadow-2xl" style={{ borderStyle: 'dashed', borderWidth: 2, background: 'rgba(59, 130, 246, 0.03)' }}>
        <div className="nd-docker-empty-icon text-blue-400 mb-6" style={{ fontSize: '4rem', opacity: 0.9 }}>🏠</div>
        <div className="nd-docker-empty-title" style={{ fontSize: '1.25rem', marginBottom: 12 }}>Dashboard Domotique</div>
        <div className="nd-docker-empty-desc" style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: 32, lineHeight: 1.6 }}>
          {savedUrl 
            ? "Votre dashboard Home Assistant est configuré. Vous pouvez modifier le lien ou supprimer la connexion."
            : "Connectez votre dashboard Home Assistant pour piloter votre maison directement depuis NasDash."
          }
        </div>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
          <button className="nd-btn nd-btn-accent w-full sm:w-auto px-10 py-3 h-auto text-sm shadow-lg shadow-blue-500/10" onClick={() => setShowModal(true)} disabled={isSaving}>
            {savedUrl ? <Settings size={18} /> : <Plus size={18} />}
            <span className="ml-1">{savedUrl ? "Modifier le lien" : "Connecter Home Assistant"}</span>
          </button>

          {savedUrl && (
            <button 
              className="nd-btn w-full sm:w-auto px-5 py-3 h-auto border-white/10 hover:bg-white/5" 
              onClick={handleReload} 
              title="Recharger l'iframe"
            >
              <RefreshCw size={16} />
            </button>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setShowModal(true); // Re-open configuration modal when cancelling delete
        }}
        onConfirm={handleDelete}
        title="Supprimer la connexion HA ?"
        description="Cette action retirera l'affichage de Home Assistant de votre tableau de bord. Vous pourrez le reconnecter plus tard."
        confirmLabel="Oui, supprimer"
        cancelLabel="Annuler"
      />

      {showModal && (
        <HomeAssistantFormModal 
          initialUrl={savedUrl}
          onClose={() => setShowModal(false)} 
          onSave={handleSave} 
          onDelete={savedUrl ? () => {
            setShowModal(false);
            setShowDeleteConfirm(true);
          } : undefined}
        />
      )}
    </div>
  );
}
