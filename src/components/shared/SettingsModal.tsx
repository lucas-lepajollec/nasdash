'use client';

import React, { useState, useEffect } from 'react';
import { X, Palette } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import CustomSelect from './CustomSelect';

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { config, updateConfig } = useConfig();
  const [activeTab, setActiveTab] = useState('apparence');
  const [mode, setMode] = useState<'light' | 'dark'>('dark');
  const [theme, setTheme] = useState(config?.settings?.theme || 'nasdash');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (document.body.classList.contains('light')) {
      setMode('light');
    } else {
      setMode('dark');
    }
  }, []);

  const toggleMode = () => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    setMode(newMode);
    if (newMode === 'light') {
      document.body.classList.add('light');
      localStorage.setItem('nd-theme', 'light');
    } else {
      document.body.classList.remove('light');
      localStorage.setItem('nd-theme', 'dark');
    }
  };

  const handleThemeChange = async (newTheme: string) => {
    setTheme(newTheme);
    const classesToRemove = Array.from(document.body.classList).filter(cls => cls.startsWith('theme-'));
    classesToRemove.forEach(cls => document.body.classList.remove(cls));
    if (newTheme !== 'nasdash') {
      document.body.classList.add(`theme-${newTheme}`);
      // Force remove light mode for other themes
      if (document.body.classList.contains('light')) {
        document.body.classList.remove('light');
        setMode('dark');
        localStorage.setItem('nd-theme', 'dark');
      }
    }
    await updateConfig({ theme: newTheme });
  };

  return (
    <div className="nd-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div 
        className="nd-modal nd-settings-modal" 
        onClick={(e) => e.stopPropagation()} 
      >
        {/* Left Sidebar */}
        <div className="nd-settings-sidebar">
          <h2 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 20, paddingLeft: 4 }}>Paramètres</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button
              onClick={() => setActiveTab('apparence')}
              className="nd-settings-nav-item"
              style={{
                background: activeTab === 'apparence' ? 'rgba(255,255,255,0.06)' : 'transparent',
                color: activeTab === 'apparence' ? 'var(--nd-accent)' : 'var(--nd-text)',
                fontWeight: activeTab === 'apparence' ? 600 : 400
              }}
            >
              <Palette size={15} /> Apparence
            </button>
          </div>
        </div>

        {/* Right Content */}
        <div className="nd-settings-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>
              {activeTab === 'apparence' && 'Apparence et Thèmes'}
            </h3>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--nd-text-muted)', flexShrink: 0 }}>
              <X size={18} />
            </button>
          </div>

          {activeTab === 'apparence' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Mode Sombre / Clair - Uniquement pour le thème de base */}
              {theme === 'nasdash' && (
                <div className="nd-settings-card">
                  <div className="nd-settings-card-row">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>Mode d'affichage</h4>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--nd-text-muted)', marginTop: 4 }}>
                        Basculez entre le mode clair et le mode sombre.
                      </p>
                    </div>
                    <button className="nd-btn" onClick={toggleMode} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {mode === 'light' ? '☀️ Clair' : '🌙 Sombre'}
                    </button>
                  </div>
                </div>
              )}

              {/* Choix du Thème */}
              <div className="nd-settings-card">
                <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>Thème (Couleurs)</h4>
                <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--nd-text-muted)', marginTop: 4, marginBottom: 14 }}>
                  Personnalisez les couleurs du dashboard.
                </p>
                <div className="nd-settings-select-wrap">
                  <CustomSelect
                    value={theme}
                    onChange={handleThemeChange}
                    options={[
                      { value: 'nasdash', label: 'NasDash (Défaut)' },
                      { value: 'apple-dark', label: 'Apple Dark (Premium)' },
                      { value: 'apple-light', label: 'Apple Light (Premium)' },
                      { value: 'catppuccin-macchiato', label: 'Catppuccin Macchiato' },
                      { value: 'nord', label: 'Nord' },
                      { value: 'dracula', label: 'Dracula' },
                      { value: 'ocean', label: 'Ocean' },
                      { value: 'midnight', label: 'Midnight' }
                    ]}
                  />
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
