'use client';

import { useState, useEffect } from 'react';
import { Category, Service } from '@/lib/types';
import { X, Trash2, ChevronDown, ChevronRight, Pencil, Upload } from 'lucide-react';
import ConfirmModal from '../../../shared/ConfirmModal';

interface CategoryFormModalProps {
  category?: Category;
  onClose: () => void;
  onSave: (data: { title: string; emoji: string; isSecret: boolean; services: Service[] }) => void;
  onDelete?: (id: string) => void;
  secretMode: boolean;
}

const EMOJI_CATEGORIES: Record<string, string[]> = {
  'Tech': ['🤖', '🖥️', '💻', '⌨️', '🖱️', '📱', '⌚', '🔋', '🔌', '💾'],
  'Cloud': ['☁️', '🌍', '🌐', '📡', '🛰️', '🔗', '🔒', '🔑', '🔐', '🛡️'],
  'Médias': ['🎬', '🎮', '🎵', '🎧', '📺', '🎸', '🎹', '🎤', '🎭', '🎪'],
  'Fichiers': ['📁', '📂', '📄', '📊', '📈', '📉', '🗂️', '🗃️', '💿', '📀'],
  'Outils': ['🔧', '🛠️', '⚙️', '🔨', '🧰', '🔩', '⚡', '💡', '🔬', '🔭'],
  'Dev': ['🐳', '🐙', '🦀', '🦊', '🐘', '🐍', '☕', '📦', '🚀', '🧪'],
  'Maison': ['🏠', '🏡', '🏢', '🏭', '🏗️', '📶', '📟', '📠', '🖨️', '📷'],
  'Divers': ['💼', '📋', '📌', '📍', '🏷️', '🔖', '🎯', '✨', '⭐', '🔔']
};

export default function CategoryFormModal({ category, onClose, onSave, onDelete, secretMode }: CategoryFormModalProps) {
  const [title, setTitle] = useState(category?.title || '');
  const [emoji, setEmoji] = useState(category?.emoji || '📁');
  const [isSecret, setIsSecret] = useState(category?.isSecret || false);
  const [services, setServices] = useState<Service[]>(category?.services || []);
  const [selectedCategory, setSelectedCategory] = useState<string>('Tech');
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
  
  const [deleteCategoryConfirm, setDeleteCategoryConfirm] = useState(false);
  const [deleteServiceConfirm, setDeleteServiceConfirm] = useState<string | null>(null);
  const [deleteLogoConfirm, setDeleteLogoConfirm] = useState<string | null>(null);
  const [pendingLogoDeletions, setPendingLogoDeletions] = useState<string[]>([]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async () => {
    if (!title.trim()) return;

    for (const url of pendingLogoDeletions) {
      await fetch(url, { method: 'DELETE' }).catch(console.error);
    }

    onSave({ title, emoji, isSecret, services });
  };

  const updateServiceField = (id: string, field: keyof Service, value: string) => {
    setServices(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const removeService = (id: string) => {
    setServices(services.filter(s => s.id !== id));
  };

  const handleUploadLogo = async (serviceId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      
      const svc = services.find(s => s.id === serviceId);
      if (svc?.logo?.startsWith('/api/logos/')) {
        setPendingLogoDeletions(prev => [...prev, svc.logo]);
      }

      updateServiceField(serviceId, 'logo', data.url);
    } catch (err) {
      console.error('Error uploading logo:', err);
      alert('Failed to upload logo.');
    }
  };

  const handleRemoveLogo = (serviceId: string) => {
    const svc = services.find(s => s.id === serviceId);
    if (svc?.logo?.startsWith('/api/logos/')) {
      setPendingLogoDeletions(prev => [...prev, svc.logo]);
    }
    updateServiceField(serviceId, 'logo', '');
  };

  return (
    <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="nd-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700 }}>{category ? 'Modifier' : 'Ajouter'} une catégorie</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nd-text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="nd-label">Nom</label>
            <input className="nd-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Médias" />
          </div>

          <div>
            <label className="nd-label">Emoji</label>
            {/* Category tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
              {Object.keys(EMOJI_CATEGORIES).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    fontSize: '0.65rem',
                    padding: '4px 8px',
                    borderRadius: 4,
                    border: 'none',
                    cursor: 'pointer',
                    background: selectedCategory === cat ? 'var(--nd-accent)' : 'var(--nd-bg-alt)',
                    color: selectedCategory === cat ? 'var(--nd-bg)' : 'var(--nd-text-muted)',
                    fontWeight: selectedCategory === cat ? 600 : 400,
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
            {/* Emoji grid */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {EMOJI_CATEGORIES[selectedCategory].map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  style={{
                    width: 32, height: 32, borderRadius: 6, fontSize: '1rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', border: 'none',
                    background: emoji === e ? 'var(--nd-accent-glow)' : 'transparent',
                    outline: emoji === e ? '2px solid var(--nd-accent)' : 'none',
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Secret checkbox — ONLY visible when secret mode is active */}
          {secretMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
              <input
                type="checkbox"
                id="secret-check"
                checked={isSecret}
                onChange={(e) => setIsSecret(e.target.checked)}
                style={{ accentColor: 'var(--nd-red)' }}
              />
              <label htmlFor="secret-check" style={{ fontSize: '0.75rem', color: 'var(--nd-red)', fontWeight: 600 }}>
                🔒 Section Secrète
              </label>
            </div>
          )}

          {category && services.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <label className="nd-label">Services rattachés</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--nd-bg-alt)', padding: 12, borderRadius: 8, border: '1px solid var(--nd-card-border)' }}>
                {services.map(svc => (
                  <div key={svc.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--nd-bg)', padding: 10, borderRadius: 6, border: '1px solid transparent' }}>
                    
                    {/* Header Row */}
                    <div 
                      onClick={() => setExpandedServiceId(prev => prev === svc.id ? null : svc.id)}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {svc.logo.startsWith('http') || svc.logo.startsWith('/') ? (
                           <img src={svc.logo} alt="" style={{ width: 16, height: 16, borderRadius: 4, objectFit: 'contain' }} />
                        ) : (
                           <span style={{ fontSize: '0.9rem', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{svc.logo}</span>
                        )}
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{svc.name}</span>
                      </div>
                      <div style={{ color: 'var(--nd-text-dimmed)' }}>
                        {expandedServiceId === svc.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </div>
                    </div>

                    {/* Expanded Edit Form */}
                    {expandedServiceId === svc.id && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4, paddingTop: 8, borderTop: '1px solid var(--nd-card-border)' }}>
                        <div>
                          <label style={{ fontSize: '0.65rem', color: 'var(--nd-text-muted)', marginBottom: 2, display: 'block' }}>Nom du service</label>
                          <input className="nd-input" style={{ padding: '6px 10px', fontSize: '0.75rem' }} value={svc.name} onChange={(e) => updateServiceField(svc.id, 'name', e.target.value)} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.65rem', color: 'var(--nd-text-muted)', marginBottom: 2, display: 'block' }}>Logo (URL ou Upload)</label>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input className="nd-input" style={{ flex: 1, padding: '6px 10px', fontSize: '0.75rem' }} value={svc.logo} onChange={(e) => updateServiceField(svc.id, 'logo', e.target.value)} placeholder="https://... ou emoji" />
                            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--nd-bg-alt)', border: '1px solid var(--nd-card-border)', borderRadius: 6, padding: '0 10px', color: 'var(--nd-text-muted)', transition: 'all 0.2s' }}>
                              <Upload size={14} />
                              <input type="file" accept=".png,.svg,.jpg,.jpeg,.webp,.ico" style={{ display: 'none' }} onChange={(e) => {
                                if (e.target.files && e.target.files[0]) handleUploadLogo(svc.id, e.target.files[0]);
                              }} />
                            </label>
                            {svc.logo?.startsWith('/api/logos/') && (
                              <button type="button" onClick={() => setDeleteLogoConfirm(svc.id)} title="Supprimer le logo local" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 6, padding: '0 10px', color: 'var(--nd-red)', transition: 'all 0.2s' }}>
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.65rem', color: 'var(--nd-text-muted)', marginBottom: 2, display: 'block' }}>URL Locale</label>
                          <input className="nd-input" style={{ padding: '6px 10px', fontSize: '0.75rem' }} value={svc.localUrl} onChange={(e) => updateServiceField(svc.id, 'localUrl', e.target.value)} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.65rem', color: 'var(--nd-text-muted)', marginBottom: 2, display: 'block' }}>URL Tailscale (Optionnel)</label>
                          <input className="nd-input" style={{ padding: '6px 10px', fontSize: '0.75rem' }} value={svc.tailscaleUrl || ''} onChange={(e) => updateServiceField(svc.id, 'tailscaleUrl', e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteServiceConfirm(svc.id); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(248, 81, 73, 0.1)', color: 'var(--nd-red)', border: 'none', padding: '6px 10px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            <Trash2 size={12} /> Supprimer le service
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          {category && onDelete && (
            <button className="nd-btn nd-btn-danger" onClick={() => setDeleteCategoryConfirm(true)} style={{ flex: 1, borderColor: 'var(--nd-red)', color: 'var(--nd-red)' }}>
              <Trash2 size={12} style={{ marginRight: 6 }} /> Supprimer
            </button>
          )}
          <div style={{ flex: category ? 1 : 2, display: 'flex', gap: 12 }}>
            <button className="nd-btn" onClick={onClose} style={{ flex: 1 }}>Annuler</button>
            <button className="nd-btn nd-btn-accent" onClick={handleSubmit} style={{ flex: 1 }}>
              {category ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={deleteCategoryConfirm}
        onClose={() => setDeleteCategoryConfirm(false)}
        onConfirm={() => category && onDelete && onDelete(category.id)}
        title="Supprimer la catégorie ?"
        description={category ? `Voulez-vous vraiment supprimer "${category.title}" et tous ses services ? Cette action est irréversible.` : ''}
      />

      <ConfirmModal
        isOpen={deleteServiceConfirm !== null}
        onClose={() => setDeleteServiceConfirm(null)}
        onConfirm={() => {
          if (deleteServiceConfirm) removeService(deleteServiceConfirm);
        }}
        title="Supprimer le service ?"
        description={`Voulez-vous vraiment supprimer le service "${services.find(s => s.id === deleteServiceConfirm)?.name}" ?`}
      />

      <ConfirmModal
        isOpen={deleteLogoConfirm !== null}
        onClose={() => setDeleteLogoConfirm(null)}
        onConfirm={() => {
          if (deleteLogoConfirm) handleRemoveLogo(deleteLogoConfirm);
        }}
        title="Supprimer le logo ?"
        description="Voulez-vous vraiment retirer le logo de ce service ? L'image sera définitivement supprimée lors de la sauvegarde."
      />
    </div>
  );
}
