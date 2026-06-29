import React, { useState } from 'react';
import { useConfig } from '@/hooks/useConfig';

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
}

export function Emoji({ emoji, className, style }: EmojiProps) {
  const { config } = useConfig();
  const theme = config?.settings?.emojiTheme || 'native';
  const [loadError, setLoadError] = useState(false);

  if (!emoji) return null;

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
