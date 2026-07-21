'use client';

import React, { useState, useMemo } from 'react';
import { Search, Check, Sun, Moon, Sparkles, Palette, Smile } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { Emoji } from '../shared/Emoji';

export interface ThemeDefinition {
  key: string;
  name: string;
  category: 'dark' | 'light';
  bg: string;
  cardBg: string;
  subcardBg: string;
  text: string;
  accent: string;
  description: string;
  tags: string[];
}

export const THEME_GALLERY: ThemeDefinition[] = [
  // DEFAULT
  {
    key: 'nasdash',
    name: 'NasDash (Défaut)',
    category: 'dark',
    bg: '#090d16',
    cardBg: '#161b22',
    subcardBg: '#0f141d',
    text: '#f5f5f7',
    accent: '#00e5ff',
    description: 'Thème emblématique NasDash bleu cyan & verre dépoli.',
    tags: ['défaut', 'cyan', 'nasdash', 'glass', 'dark']
  },

  // APPLE
  {
    key: 'apple-dark',
    name: 'Apple Dark 🍏',
    category: 'dark',
    bg: '#000000',
    cardBg: '#1c1c1e',
    subcardBg: '#2c2c2e',
    text: '#f5f5f7',
    accent: '#2997ff',
    description: 'Design officiel macOS/iOS Dark Mode avec verre dépoli et grands arrondis (Squircle).',
    tags: ['apple', 'macos', 'ios', 'dark', 'black', 'oled', 'blue']
  },
  {
    key: 'apple-light',
    name: 'Apple Light 🍏',
    category: 'light',
    bg: '#f5f5f7',
    cardBg: '#ffffff',
    subcardBg: '#f5f5f7',
    text: '#1d1d1f',
    accent: '#0071e3',
    description: 'Design officiel Apple Store & macOS Light System net et minimaliste.',
    tags: ['apple', 'macos', 'ios', 'light', 'store', 'minimal', 'white']
  },

  // GITHUB
  {
    key: 'github-dark',
    name: 'GitHub Dark 🐙',
    category: 'dark',
    bg: '#0d1117',
    cardBg: '#161b22',
    subcardBg: '#21262d',
    text: '#c9d1d9',
    accent: '#58a6ff',
    description: 'Thème sombre officiel GitHub Primer avec accent bleu azure.',
    tags: ['github', 'primer', 'dark', 'code', 'blue']
  },
  {
    key: 'github-light',
    name: 'GitHub Light 🐙',
    category: 'light',
    bg: '#f6f8fa',
    cardBg: '#ffffff',
    subcardBg: '#f6f8fa',
    text: '#1f2328',
    accent: '#0969da',
    description: 'Thème clair officiel GitHub Primer net et ultra lisible.',
    tags: ['github', 'primer', 'light', 'code', 'blue']
  },

  // GREEN & FOREST
  {
    key: 'everforest-dark',
    name: 'Everforest Dark 🌲',
    category: 'dark',
    bg: '#2b3339',
    cardBg: '#323c41',
    subcardBg: '#272e33',
    text: '#d3c6aa',
    accent: '#a7c080',
    description: 'Vert sauge sombre apaisant pour une réduction maximale de la fatigue visuelle.',
    tags: ['everforest', 'green', 'vert', 'sauge', 'dark', 'nature', 'soothing']
  },
  {
    key: 'everforest-light',
    name: 'Everforest Light 🌲',
    category: 'light',
    bg: '#f2efdf',
    cardBg: '#fffbef',
    subcardBg: '#e8e5d5',
    text: '#5c6a72',
    accent: '#8da101',
    description: 'Parchemin naturel et vert forêt pour des sessions de travail prolongées.',
    tags: ['everforest', 'green', 'vert', 'parchemin', 'light', 'nature']
  },
  {
    key: 'tokyo-night-day',
    name: 'Tokyo Night Day 🏙️',
    category: 'light',
    bg: '#e1e2e7',
    cardBg: '#e9e9ed',
    subcardBg: '#d5d6db',
    text: '#3760bf',
    accent: '#2e7de9',
    description: 'Style lumineux et contrasté du centre-ville de Tokyo.',
    tags: ['tokyo', 'night', 'day', 'blue', 'light']
  },
  {
    key: 'gruvbox-light',
    name: 'Gruvbox Light 🪵',
    category: 'light',
    bg: '#fbf1c7',
    cardBg: '#f2e5bc',
    subcardBg: '#ebdbb2',
    text: '#3c3836',
    accent: '#af3a03',
    description: 'Style rétro vintage parchemin et terre d’ombre chaleureuse.',
    tags: ['gruvbox', 'retro', 'light', 'amber', 'parchment']
  },
  {
    key: 'nord-light',
    name: 'Nord Light ❄️',
    category: 'light',
    bg: '#e5e9f0',
    cardBg: '#eceff4',
    subcardBg: '#d8dee9',
    text: '#2e3440',
    accent: '#5e81ac',
    description: 'Ambiance givre polaire et tempête de neige arctique.',
    tags: ['nord', 'light', 'snow', 'arctic', 'blue']
  },
  {
    key: 'matrix-cyber',
    name: 'Matrix Hacker 📟',
    category: 'dark',
    bg: '#070c0a',
    cardBg: '#0f1a14',
    subcardBg: '#14241b',
    text: '#e0f8eb',
    accent: '#00ff88',
    description: 'Esthétique hacker cyberspatial en vert néon sur fond noir matrice.',
    tags: ['matrix', 'hacker', 'neon', 'green', 'vert', 'cyber', 'dark']
  },

  // COMMUNITY FAVORITES (DARK)
  {
    key: 'one-dark-pro',
    name: 'One Dark Pro ⚛️',
    category: 'dark',
    bg: '#21252b',
    cardBg: '#282c34',
    subcardBg: '#21252b',
    text: '#abb2bf',
    accent: '#61afef',
    description: 'Le classique culte d’Atom aux nuances charbon et bleu cyan.',
    tags: ['atom', 'one dark', 'pro', 'vscode', 'dark', 'popular']
  },
  {
    key: 'tokyo-night',
    name: 'Tokyo Night 🏙️',
    category: 'dark',
    bg: '#1a1b26',
    cardBg: '#24283b',
    subcardBg: '#1f2335',
    text: '#a9b1d6',
    accent: '#7aa2f7',
    description: 'Ambiance nuit du centre-ville de Tokyo en bleu nuit saphir.',
    tags: ['tokyo', 'night', 'sapphire', 'blue', 'neovim', 'dark']
  },
  {
    key: 'kanagawa-wave',
    name: 'Kanagawa Wave 🌊',
    category: 'dark',
    bg: '#1f1f28',
    cardBg: '#2a2a37',
    subcardBg: '#22242e',
    text: '#dcd7ba',
    accent: '#7e9cd8',
    description: 'Palette artistique aux nuances de l’estampe La Grande Vague.',
    tags: ['kanagawa', 'wave', 'japanese', 'art', 'parchment', 'dark']
  },

  // ROSÉ PINE
  {
    key: 'rose-pine-dark',
    name: 'Rosé Pine Main 🌸',
    category: 'dark',
    bg: '#191724',
    cardBg: '#1f1d2e',
    subcardBg: '#191724',
    text: '#e0def4',
    accent: '#eb6f92',
    description: 'Palette vintage SoHo aux teintes rose quartz, prune et iris.',
    tags: ['rose', 'pine', 'soho', 'pink', 'dark']
  },
  {
    key: 'rose-pine-dawn',
    name: 'Rosé Pine Dawn 🌸',
    category: 'light',
    bg: '#faf4ed',
    cardBg: '#fffaf3',
    subcardBg: '#faf4ed',
    text: '#464261',
    accent: '#d7827e',
    description: 'Quartz rosé poudré et crème douce pour un look élégant.',
    tags: ['rose', 'pine', 'dawn', 'pink', 'light', 'cream']
  },

  // SOLARIZED
  {
    key: 'solarized-dark',
    name: 'Solarized Dark ☀️',
    category: 'dark',
    bg: '#002b36',
    cardBg: '#073642',
    subcardBg: '#002b36',
    text: '#839496',
    accent: '#268bd2',
    description: 'Thème sombre légendaire Solarized aux nuances bleutées précises.',
    tags: ['solarized', 'dark', 'cyan', 'teal', 'classic']
  },
  {
    key: 'solarized-light',
    name: 'Solarized Light ☀️',
    category: 'light',
    bg: '#fdf6e3',
    cardBg: '#fffcf0',
    subcardBg: '#eee8d5',
    text: '#002b36',
    accent: '#268bd2',
    description: 'Parchemin ambré chaud et bleu cyan solaire.',
    tags: ['solarized', 'light', 'amber', 'amber', 'parchment']
  },

  // CATPPUCCIN
  {
    key: 'catppuccin-latte',
    name: 'Catppuccin Latte 🐱',
    category: 'light',
    bg: '#eff1f5',
    cardBg: '#e6e9ef',
    subcardBg: '#dce0e8',
    text: '#4c4f69',
    accent: '#8839ef',
    description: 'Douceur pastel et accent mauve signature de Catppuccin.',
    tags: ['catppuccin', 'latte', 'mauve', 'purple', 'light']
  },
  {
    key: 'catppuccin-macchiato',
    name: 'Catppuccin Macchiato 🐱',
    category: 'dark',
    bg: '#181926',
    cardBg: '#24273a',
    subcardBg: '#1e2030',
    text: '#cad3f5',
    accent: '#8aadf4',
    description: 'Thème sombre pastel aux teintes lavande et bleu poudre.',
    tags: ['catppuccin', 'macchiato', 'lavender', 'blue', 'dark']
  },

  // CLASSIC DARK THEMES
  {
    key: 'gruvbox-dark',
    name: 'Gruvbox Dark 🪵',
    category: 'dark',
    bg: '#282828',
    cardBg: '#3c3836',
    subcardBg: '#32302f',
    text: '#ebdbb2',
    accent: '#fe8019',
    description: 'Style rétro vintage terre d’ombre et ambre chaleureux.',
    tags: ['gruvbox', 'retro', 'warm', 'orange', 'dark']
  },
  {
    key: 'nord',
    name: 'Nord Ice ❄️',
    category: 'dark',
    bg: '#20242c',
    cardBg: '#2e3440',
    subcardBg: '#272c36',
    text: '#d8dee9',
    accent: '#88c0d0',
    description: 'Inspiré du givre polaire et des aurores boréales arctiques.',
    tags: ['nord', 'ice', 'arctic', 'blue', 'dark']
  },
  {
    key: 'dracula',
    name: 'Dracula Gothic 🧛',
    category: 'dark',
    bg: '#282a36',
    cardBg: '#44475a',
    subcardBg: '#343746',
    text: '#f8f8f2',
    accent: '#bd93f9',
    description: 'Thème culte gothique violet & rose néon.',
    tags: ['dracula', 'gothic', 'purple', 'pink', 'neon', 'dark']
  },
  {
    key: 'ocean',
    name: 'Ocean Deep Glow 🌊',
    category: 'dark',
    bg: '#0f172a',
    cardBg: '#1e293b',
    subcardBg: '#0f172a',
    text: '#f8fafc',
    accent: '#38bdf8',
    description: 'Bleus abyssaux profonds et accents lagon.',
    tags: ['ocean', 'blue', 'deep', 'cyan', 'dark']
  },
  {
    key: 'midnight',
    name: 'Midnight OLED 🌑',
    category: 'dark',
    bg: '#09090b',
    cardBg: '#121215',
    subcardBg: '#18181b',
    text: '#fafafa',
    accent: '#6366f1',
    description: 'Noir absolu optimisé pour économiser l’énergie sur écrans OLED.',
    tags: ['midnight', 'oled', 'black', 'indigo', 'dark']
  },
  {
    key: 'cyberpunk',
    name: 'Retro Cyberpunk 🤖',
    category: 'dark',
    bg: '#120024',
    cardBg: '#230038',
    subcardBg: '#180029',
    text: '#00ffff',
    accent: '#ff007f',
    description: 'Néons magenta et cyan rétro-futuriste Synthwave.',
    tags: ['cyberpunk', 'retro', 'synthwave', 'neon', 'pink', 'dark']
  }
];

const EMOJI_STYLES = [
  {
    key: 'native',
    name: 'Native (Système)',
    description: 'Emojis par défaut de votre système d’exploitation. Ultra léger et familier.',
    samples: ['🏠', '🐳', '🖥️', '🚀', '🧩']
  },
  {
    key: 'twemoji',
    name: 'Twemoji (Twitter)',
    description: 'Emojis plats, colorés et modernes créés par Twitter. Idéal pour un design épuré.',
    samples: ['🏠', '🐳', '🖥️', '🚀', '🧩']
  },
  {
    key: 'blobmoji',
    name: 'Blobmoji (Google Blobs)',
    description: 'Les célèbres blobs rétro et sympathiques de Google. Un look unique et amusant.',
    samples: ['🏠', '🐳', '🖥️', '🚀', '🧩']
  },
  {
    key: 'openmoji',
    name: 'OpenMoji (Dessiné)',
    description: 'Emojis au contour noir dessiné à la main. Idéal pour un design schématique.',
    samples: ['🏠', '🐳', '🖥️', '🚀', '🧩']
  },
  {
    key: 'lucide',
    name: 'Icônes Vectorielles (Lucide)',
    description: 'Remplace tous les émojis par leur équivalent vectoriel moderne de la bibliothèque Lucide.',
    samples: ['lucide:Home', 'lucide:Container', 'lucide:Monitor', 'lucide:Rocket', 'lucide:Puzzle']
  },
  {
    key: 'tabler',
    name: 'Icônes Tabler',
    description: 'Icônes vectorielles modernes et légèrement arrondies de la bibliothèque Tabler.',
    samples: ['lucide:Home', 'lucide:Container', 'lucide:Monitor', 'lucide:Rocket', 'lucide:Puzzle']
  },
  {
    key: 'bootstrap',
    name: 'Icônes Bootstrap',
    description: 'Le set d’icônes officiel de Bootstrap. Moderne, robuste et complet.',
    samples: ['lucide:Home', 'lucide:Container', 'lucide:Monitor', 'lucide:Rocket', 'lucide:Puzzle']
  },
  {
    key: 'mdi',
    name: 'Material Design Icons',
    description: 'Le set d’icônes Material de Google. Très familier et universel.',
    samples: ['lucide:Home', 'lucide:Container', 'lucide:Monitor', 'lucide:Rocket', 'lucide:Puzzle']
  }
];

interface ThemeGalleryViewProps {
  currentTheme: string;
  onSelectTheme: (themeKey: string) => Promise<void>;
  onClose?: () => void;
  initialTab?: 'themes' | 'emojis';
}

export default function ThemeGalleryView({ currentTheme, onSelectTheme, onClose, initialTab = 'themes' }: ThemeGalleryViewProps) {
  const { config, updateConfig } = useConfig();
  const [galleryMode, setGalleryMode] = useState<'themes' | 'emojis'>(initialTab);
  
  // Theme list state
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'dark' | 'light'>('all');

  const currentEmojiTheme = config?.settings?.emojiTheme || 'native';

  const filteredThemes = useMemo(() => {
    return THEME_GALLERY.filter(t => {
      const matchesTab = activeTab === 'all' || t.category === activeTab;
      const q = search.toLowerCase().trim();
      const matchesSearch = !q || 
        t.name.toLowerCase().includes(q) || 
        t.description.toLowerCase().includes(q) || 
        t.tags.some(tag => tag.includes(q));
      return matchesTab && matchesSearch;
    });
  }, [search, activeTab]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      boxSizing: 'border-box',
      gap: 16
    }}>
      {/* Gallery Section Tab Selection */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--nd-card-border)',
        paddingBottom: 12,
        gap: 12,
        flexShrink: 0
      }}>
        <button
          onClick={() => setGalleryMode('themes')}
          style={{
            padding: '8px 16px',
            borderRadius: 10,
            border: 'none',
            background: galleryMode === 'themes' ? 'var(--nd-accent-glow)' : 'transparent',
            color: galleryMode === 'themes' ? 'var(--nd-accent)' : 'var(--nd-text-muted)',
            fontWeight: galleryMode === 'themes' ? 700 : 500,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease'
          }}
        >
          <Palette size={15} />
          Thèmes Visuels
        </button>
        <button
          onClick={() => setGalleryMode('emojis')}
          style={{
            padding: '8px 16px',
            borderRadius: 10,
            border: 'none',
            background: galleryMode === 'emojis' ? 'var(--nd-accent-glow)' : 'transparent',
            color: galleryMode === 'emojis' ? 'var(--nd-accent)' : 'var(--nd-text-muted)',
            fontWeight: galleryMode === 'emojis' ? 700 : 500,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease'
          }}
        >
          <Smile size={15} />
          Style des Emojis & Icônes
        </button>
      </div>

      {galleryMode === 'themes' ? (
        <>
          {/* Search + Category Tabs Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flexShrink: 0 }}>
            {/* Search Input */}
            <div style={{
              flex: 1,
              minWidth: 240,
              position: 'relative',
              display: 'flex',
              alignItems: 'center'
            }}>
              <Search size={16} style={{ position: 'absolute', left: 12, color: 'var(--nd-text-muted)' }} />
              <input 
                type="text"
                placeholder="Rechercher un thème (ex: Apple, GitHub, Vert, OLED...)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  height: 38,
                  paddingLeft: 36,
                  paddingRight: 12,
                  borderRadius: 12,
                  border: '1px solid var(--nd-card-border)',
                  background: 'var(--nd-subcard-bg)',
                  color: 'var(--nd-text)',
                  fontSize: '0.82rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Filter Tabs */}
            <div style={{
              display: 'flex',
              background: 'var(--nd-subcard-bg)',
              padding: 3,
              borderRadius: 12,
              border: '1px solid var(--nd-card-border)'
            }}>
              <button
                onClick={() => setActiveTab('all')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 9,
                  border: 'none',
                  background: activeTab === 'all' ? 'var(--nd-card-bg)' : 'transparent',
                  color: activeTab === 'all' ? 'var(--nd-text)' : 'var(--nd-text-muted)',
                  fontWeight: activeTab === 'all' ? 600 : 400,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease'
                }}
              >
                <Sparkles size={13} color={activeTab === 'all' ? 'var(--nd-accent)' : undefined} />
                Tous ({THEME_GALLERY.length})
              </button>
              <button
                onClick={() => setActiveTab('dark')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 9,
                  border: 'none',
                  background: activeTab === 'dark' ? 'var(--nd-card-bg)' : 'transparent',
                  color: activeTab === 'dark' ? 'var(--nd-text)' : 'var(--nd-text-muted)',
                  fontWeight: activeTab === 'dark' ? 600 : 400,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease'
                }}
              >
                <Moon size={13} color={activeTab === 'dark' ? 'var(--nd-accent)' : undefined} />
                Sombres ({THEME_GALLERY.filter(t => t.category === 'dark').length})
              </button>
              <button
                onClick={() => setActiveTab('light')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 9,
                  border: 'none',
                  background: activeTab === 'light' ? 'var(--nd-card-bg)' : 'transparent',
                  color: activeTab === 'light' ? 'var(--nd-text)' : 'var(--nd-text-muted)',
                  fontWeight: activeTab === 'light' ? 600 : 400,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease'
                }}
              >
                <Sun size={13} color={activeTab === 'light' ? 'var(--nd-accent)' : undefined} />
                Clairs ({THEME_GALLERY.filter(t => t.category === 'light').length})
              </button>
            </div>
          </div>

          {/* Gallery Grid Content */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 6px 8px 4px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gridAutoRows: '190px',
            gap: 14,
            alignContent: 'start'
          }}>
            {filteredThemes.length === 0 ? (
              <div style={{
                gridColumn: '1 / -1',
                padding: '60px 20px',
                textAlign: 'center',
                color: 'var(--nd-text-muted)'
              }}>
                <p style={{ margin: 0, fontSize: '0.95rem' }}>Aucun thème ne correspond à votre recherche "{search}".</p>
              </div>
            ) : (
              filteredThemes.map((theme) => {
                const isSelected = currentTheme === theme.key;

                return (
                  <div
                    key={theme.key}
                    onClick={() => onSelectTheme(theme.key)}
                    style={{
                      borderRadius: 16,
                      border: isSelected 
                        ? '2px solid var(--nd-accent)' 
                        : '1px solid var(--nd-card-border)',
                      background: 'var(--nd-subcard-bg)',
                      padding: 12,
                      height: 190,
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 10,
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = 'var(--nd-accent)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = 'var(--nd-card-border)';
                        e.currentTarget.style.transform = 'none';
                      }
                    }}
                  >
                    {/* Live Theme Preview Card */}
                    <div style={{
                      width: '100%',
                      height: 85,
                      borderRadius: 10,
                      background: theme.bg,
                      padding: 8,
                      boxSizing: 'border-box',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      border: '1px solid rgba(128, 128, 128, 0.15)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      {/* Simulated Header Bar */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: theme.accent }} />
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(128,128,128,0.3)' }} />
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(128,128,128,0.3)' }} />
                        </div>
                        <div style={{
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: theme.subcardBg,
                          color: theme.text,
                          fontSize: '0.55rem',
                          fontWeight: 700
                        }}>
                          NasDash
                        </div>
                      </div>

                      {/* Simulated Widget Card — Positioned higher above color dots */}
                      <div style={{
                        background: theme.cardBg,
                        borderRadius: 6,
                        padding: 5,
                        border: '1px solid rgba(128,128,128,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 20,
                        paddingRight: 10
                      }}>
                        <div style={{
                          width: 12,
                          height: 12,
                          borderRadius: 4,
                          background: theme.accent
                        }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ height: 3, width: '55%', background: theme.text, opacity: 0.8, borderRadius: 2, marginBottom: 2 }} />
                          <div style={{ height: 2, width: '35%', background: theme.text, opacity: 0.4, borderRadius: 2 }} />
                        </div>
                      </div>

                      {/* Color Swatch Badges */}
                      <div style={{
                        position: 'absolute',
                        bottom: 5,
                        right: 6,
                        display: 'flex',
                        gap: 3,
                        padding: 2,
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: 10,
                        backdropFilter: 'blur(4px)'
                      }}>
                        <div style={{ width: 9, height: 9, borderRadius: '50%', background: theme.bg, border: '1px solid #fff' }} title="Canvas BG" />
                        <div style={{ width: 9, height: 9, borderRadius: '50%', background: theme.cardBg, border: '1px solid #fff' }} title="Card Surface" />
                        <div style={{ width: 9, height: 9, borderRadius: '50%', background: theme.text, border: '1px solid #fff' }} title="Text Color" />
                        <div style={{ width: 9, height: 9, borderRadius: '50%', background: theme.accent, border: '1px solid #fff' }} title="Accent Color" />
                      </div>
                    </div>

                    {/* Info */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--nd-text)' }}>
                          {theme.name}
                        </span>
                        {isSelected && (
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '2px 8px',
                            borderRadius: 20,
                            background: 'var(--nd-accent)',
                            color: '#ffffff',
                            fontSize: '0.62rem',
                            fontWeight: 700
                          }}>
                            <Check size={11} /> Actif
                          </div>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--nd-text-muted)', lineHeight: '1.25' }}>
                        {theme.description}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        /* EMOJIS & ICONS GALLERY MODE */
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 6px 8px 4px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
          gridAutoRows: '190px',
          gap: 14,
          alignContent: 'start'
        }}>
          {EMOJI_STYLES.map((style) => {
            const isSelected = currentEmojiTheme === style.key;

            return (
              <div
                key={style.key}
                onClick={async () => {
                  await updateConfig({ emojiTheme: style.key });
                }}
                style={{
                  borderRadius: 16,
                  border: isSelected 
                    ? '2px solid var(--nd-accent)' 
                    : '1px solid var(--nd-card-border)',
                  background: 'var(--nd-subcard-bg)',
                  padding: 12,
                  height: 190,
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 10,
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = 'var(--nd-accent)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = 'var(--nd-card-border)';
                    e.currentTarget.style.transform = 'none';
                  }
                }}
              >
                {/* Live Emoji Preview Card */}
                <div style={{
                  width: '100%',
                  height: 85,
                  borderRadius: 10,
                  background: 'var(--nd-card-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  border: '1px solid rgba(128, 128, 128, 0.15)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {style.samples.map((char, index) => (
                    <div key={index} style={{ fontSize: '1.6rem', display: 'flex', alignItems: 'center' }}>
                      <Emoji emoji={char} forcedTheme={style.key as any} />
                    </div>
                  ))}
                </div>

                {/* Info */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--nd-text)' }}>
                      {style.name}
                    </span>
                    {isSelected && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 8px',
                        borderRadius: 20,
                        background: 'var(--nd-accent)',
                        color: '#ffffff',
                        fontSize: '0.62rem',
                        fontWeight: 700
                      }}>
                        <Check size={11} /> Actif
                      </div>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--nd-text-muted)', lineHeight: '1.25' }}>
                    {style.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Info & Fermer Button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 8,
        borderTop: '1px solid var(--nd-card-border)',
        flexShrink: 0
      }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--nd-text-muted)' }}>
          {galleryMode === 'themes' 
            ? `${filteredThemes.length} sur ${THEME_GALLERY.length} thèmes affichés`
            : `${EMOJI_STYLES.length} styles d'emojis disponibles`
          }
        </span>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              padding: '6px 18px',
              borderRadius: 10,
              border: '1px solid var(--nd-card-border)',
              background: 'var(--nd-subcard-bg)',
              color: 'var(--nd-text)',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--nd-accent)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--nd-card-border)'}
          >
            Fermer
          </button>
        )}
      </div>
    </div>
  );
}
