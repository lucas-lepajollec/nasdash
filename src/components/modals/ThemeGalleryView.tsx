'use client';

import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { Emoji } from '../shared/Emoji';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeInfo, CalmeSegmented } from './settings/shared/CalmeControls';

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
  const { t } = useI18n();
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

  // Calme: the same choices as quiet thumbnails and rows, the mode switch and
  // the search on one line (the frame and title come from the settings).
  const cleanName = (name: string) => t(name).replace(/\s*\(.*\)|\s*[^\p{L}\p{N}\s'’&-]+$/gu, '');
  type EmojiTheme = NonNullable<React.ComponentProps<typeof Emoji>['forcedTheme']>;
  return (
    <div className="ndc-gallery">
      <div className="ndc-gallery-bar">
        <CalmeSegmented
          label={t('settings.calme.theme')}
          value={galleryMode}
          options={[{ value: 'themes', label: t('settings.calme.themes') }, { value: 'emojis', label: t('settings.calme.icons') }]}
          onChange={setGalleryMode}
        />
        {galleryMode === 'themes' && (
          <>
            <label className="ndc-settings-search ndc-gallery-search">
              <Search size={14} aria-hidden="true" />
              <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={t('settings.calme.searchTheme')} aria-label={t('settings.calme.searchTheme')} />
            </label>
            <CalmeSegmented
              label={t('settings.calme.mode')}
              value={activeTab}
              options={[{ value: 'all', label: t('settings.calme.all') }, { value: 'dark', label: t('settings.calme.dark') }, { value: 'light', label: t('settings.calme.light') }]}
              onChange={setActiveTab}
            />
          </>
        )}
      </div>

      {galleryMode === 'themes' ? (
        <div className="ndc-gallery-grid" role="radiogroup" aria-label={t('settings.calme.theme')}>
          {filteredThemes.map(theme => (
            <button key={theme.key} type="button" role="radio" aria-checked={currentTheme === theme.key} className="ndc-theme" onClick={() => onSelectTheme(theme.key)} title={t(theme.description)}>
              <span className="ndc-theme-mini" style={{ background: theme.bg }}>
                <span className="ndc-theme-bar">
                  <span style={{ width: 14, background: theme.accent }} />
                  <span style={{ width: 18, background: theme.text, opacity: 0.35 }} />
                  <span style={{ width: 12, background: theme.text, opacity: 0.35 }} />
                </span>
                <span className="ndc-theme-cards">
                  {[0, 1, 2].map(i => <span key={i} style={{ background: theme.cardBg, border: `1px solid ${theme.subcardBg}` }} />)}
                </span>
              </span>
              <span className="ndc-theme-name">{cleanName(theme.name)}</span>
            </button>
          ))}
          {filteredThemes.length === 0 && <div className="ndc-set-empty">{t('settings.calme.noTheme')}</div>}
        </div>
      ) : (
        <div className="ndc-icon-styles" role="radiogroup" aria-label={t('settings.calme.icons')}>
          {EMOJI_STYLES.map(style => (
            <button key={style.key} type="button" role="radio" aria-checked={currentEmojiTheme === style.key} className="ndc-icon-style" onClick={() => updateConfig({ emojiTheme: style.key })}>
              <span className="ndc-icon-style-samples">
                {style.samples.map((char, index) => <Emoji key={index} emoji={char} forcedTheme={style.key as EmojiTheme} />)}
              </span>
              <span className="ndc-icon-style-name">{cleanName(style.name)}<CalmeInfo text={t(style.description)} /></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
