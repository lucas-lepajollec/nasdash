import React, { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';

export const EMOJI_TO_LUCIDE: Record<string, string> = {
  // === Tech & Dev ===
  '🤖': 'Bot',
  '🖥️': 'Monitor',
  '💻': 'Laptop',
  '⌨️': 'Keyboard',
  '🖱️': 'Mouse',
  '📱': 'Smartphone',
  '⌚': 'Watch',
  '🔋': 'Battery',
  '🔌': 'Plug',
  '💾': 'Save',
  '🐳': 'Container',
  '🐙': 'GitBranch',
  '🦀': 'ShieldAlert',
  '🌐': 'Globe',
  '☁️': 'Cloud',
  '🐘': 'Database',
  '🐍': 'Code',
  '☕': 'Coffee',
  '📦': 'Package',
  '🚀': 'Rocket',
  '🧪': 'FlaskConical',
  '👨‍💻': 'Terminal',
  '🕹️': 'Gamepad2',
  '📡': 'Radio',
  '🛰️': 'Satellite',
  '🔗': 'Link',
  '🔒': 'Lock',
  '🔑': 'Key',
  '🔐': 'LockKeyhole',
  '🛡️': 'Shield',
  '🗄️': 'Server',
  '🌩️': 'CloudLightning',
  '⚡': 'Zap',
  '🕸️': 'Network',
  '🚦': 'TrafficCone',
  '🛑': 'Octagon',
  '🚧': 'Construction',

  // === Médias ===
  '🎬': 'Film',
  '🎧': 'Headphones',
  '📺': 'Tv',
  '🎤': 'Mic',
  '🎭': 'Theater',
  '🎪': 'Tent',
  '📸': 'Camera',
  '🎥': 'Video',
  '💿': 'Disc',
  '🎛️': 'Sliders',
  '🎵': 'Music',
  '🎨': 'Palette',

  // === Fichiers & Docs ===
  '📁': 'Folder',
  '📂': 'FolderOpen',
  '📄': 'FileText',
  '📋': 'Clipboard',
  '📊': 'BarChart4',
  '📈': 'TrendingUp',
  '📉': 'TrendingDown',
  '🗂️': 'Files',
  '🗃️': 'Archive',
  '💽': 'HardDrive',
  '📝': 'FileEdit',
  '📓': 'Book',
  '📚': 'BookOpen',
  '📜': 'Scroll',
  '📰': 'Newspaper',

  // === Outils ===
  '🔧': 'Wrench',
  '🛠️': 'Hammer',
  '⚙️': 'Settings',
  '🧰': 'Briefcase',
  '💡': 'Lightbulb',
  '🔬': 'Binary',
  '🔭': 'Search',
  '🪜': 'Menu',
  '🗡️': 'Sword',
  '⚔️': 'Swords',
  '🧭': 'Compass',
  '⚖️': 'Scale',

  // === Maison ===
  '🏠': 'Home',
  '🏢': 'Building',
  '🏭': 'Building2',
  '📶': 'Wifi',
  '🛋️': 'Bed',
  '🚪': 'DoorClosed',
  '🪟': 'Layout',
  '🚽': 'Droplet',
  '🚿': 'ShowerHead',
  '🛁': 'Bath',
  '🧺': 'ShoppingBag',
  '🧹': 'Trash',

  // === Divertissement ===
  '🍿': 'Clapperboard',
  '🍺': 'CupSoda',
  '🍻': 'GlassWater',
  '🍕': 'Pizza',
  '⚽': 'Activity',

  // === Transport ===
  '🚗': 'Car',
  '🚌': 'Bus',
  '🚚': 'Truck',
  '🛵': 'Bike',
  '🚢': 'Ship',
  '✈️': 'Plane',

  // === Animaux ===
  '🐶': 'Smile',
  '🐜': 'Bug',
  '🐌': 'Snail',
  '🕷️': 'Spider',
  '🐢': 'Turtle',
  '🐟': 'Fish',

  // === Directions & UI additions ===
  '🌤️': 'SunDim',
  '⛅': 'CloudSun',
  '🕒': 'Clock',
  '📅': 'Calendar',
  '🧩': 'Puzzle',
  '⬅️': 'ArrowLeft',
  '➡️': 'ArrowRight',
  '⚠️': 'AlertTriangle'
};

export function normalizeEmoji(emoji: string): string {
  if (!emoji) return '';
  // Strip variation selectors (U+FE00 - U+FE0F) to normalize matching
  return emoji.replace(/[\ufe00-\ufe0f]/g, '').trim();
}

export const NORMALIZED_EMOJI_TO_LUCIDE: Record<string, string> = {};
export const LUCIDE_TO_EMOJI: Record<string, string> = {};

Object.entries(EMOJI_TO_LUCIDE).forEach(([k, v]) => {
  const normK = normalizeEmoji(k);
  NORMALIZED_EMOJI_TO_LUCIDE[normK] = v;
  
  const normV = v.toLowerCase().trim();
  if (!LUCIDE_TO_EMOJI[normV]) {
    LUCIDE_TO_EMOJI[normV] = k;
  }
});

export function getEmojiCodePoint(emoji: string): string {
  const codePoints = [];
  for (const char of emoji) {
    const cp = char.codePointAt(0);
    if (cp) {
      if (cp === 0xfe0f) continue; // Skip presentation selector
      codePoints.push(cp.toString(16));
    }
  }
  return codePoints.join('-');
}

interface EmojiProps {
  emoji: string;
  className?: string;
  style?: React.CSSProperties;
  forcedTheme?: 'native' | 'twemoji' | 'blobmoji' | 'openmoji' | 'lucide';
}

export function Emoji({ emoji, className, style, forcedTheme }: EmojiProps) {
  const { config } = useConfig();
  const theme = (forcedTheme || config?.settings?.emojiTheme || 'native') as EmojiProps['forcedTheme'];
  const [loadError, setLoadError] = useState(false);

  if (!emoji) return null;

  // Render Lucide Icon if prefixed with 'lucide:'
  if (emoji.startsWith('lucide:')) {
    const iconName = emoji.replace('lucide:', '');
    
    // Reverse translation if the theme is an emoji pack
    if (theme !== 'lucide') {
      const cleanIconName = iconName.toLowerCase().trim();
      const mappedEmoji = LUCIDE_TO_EMOJI[cleanIconName] || '🧩';
      return <Emoji emoji={mappedEmoji} forcedTheme={theme} className={className} style={style} />;
    }
    
    const IconComponent = (LucideIcons as any)[iconName];
    if (IconComponent) {
      return (
        <IconComponent
          className={className}
          style={{
            display: 'inline-block',
            width: '1.2em',
            height: '1.2em',
            verticalAlign: '-0.15em',
            ...style
          }}
        />
      );
    }
  }

  // Handle global Lucide theme mapping
  if (theme === 'lucide') {
    const cleanEmoji = normalizeEmoji(emoji);
    const mappedIconName = NORMALIZED_EMOJI_TO_LUCIDE[cleanEmoji];
    
    // Determine fallback Lucide icon so we never render a native emoji under the lucide theme
    const fallbackIcon = 'HelpCircle';
    const finalIconName = mappedIconName || fallbackIcon;
    const IconComponent = (LucideIcons as any)[finalIconName];
    
    if (IconComponent) {
      return (
        <IconComponent
          className={className}
          style={{
            display: 'inline-block',
            width: '1.2em',
            height: '1.2em',
            verticalAlign: '-0.15em',
            ...style
          }}
        />
      );
    }
  }

  if (theme === 'native' || loadError) {
    return <span className={className} style={style}>{emoji}</span>;
  }

  const cp = getEmojiCodePoint(emoji);
  let src = '';

  if (theme === 'twemoji') {
    src = `https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/${cp}.svg`;
  } else if (theme === 'blobmoji') {
    src = `https://cdn.jsdelivr.net/gh/C1710/blobmoji@master/svg/${cp}.svg`;
  } else if (theme === 'openmoji') {
    src = `https://openmoji.org/data/color/svg/${cp.toUpperCase()}.svg`;
  }

  if (!src) {
    return <span className={className} style={style}>{emoji}</span>;
  }

  return (
    <img
      src={src}
      alt={emoji}
      className={className}
      style={{
        display: 'inline-block',
        width: '1.2em',
        height: '1.2em',
        verticalAlign: '-0.15em',
        objectFit: 'contain',
        ...style
      }}
      onError={() => {
        setLoadError(true);
      }}
    />
  );
}
