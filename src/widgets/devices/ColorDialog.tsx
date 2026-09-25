'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Star, X } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { useConfig } from '@/hooks/useConfig';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';
import { CalmeDialog, CalmeField } from '@/components/shared/CalmeDialog';
import { safeColor } from './look';

/** Colours offered in every picker, before the favourites. */
export const PRESET_COLORS = [
  '#5ec8d8', '#7aa2f7', '#bb9af7', '#f7768e', '#ff9e64', '#e0af68',
  '#9ece6a', '#73daca', '#2ac3de', '#c0caf5', '#f4b8e4', '#ea6962',
];

/** A dialog shown above the page (portal), with its overlay and keyboard behaviour. */
export function DialogPortal({ onClose, children }: { onClose: () => void; children: (ref: React.Ref<HTMLDivElement>) => React.ReactNode }) {
  const ref = useDialogAccessibility(onClose);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="nd-modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      {children(ref)}
    </div>,
    document.body,
  );
}

/** A colour swatch that opens the picker. */
export function ColorSwatch({ color, label, onClick }: { color: string; label: string; onClick: () => void }) {
  return (
    <button type="button" className="ndc-swatch-button" onClick={onClick} aria-label={label} title={label}>
      <span className="ndc-swatch" style={{ background: color }} />
    </button>
  );
}

/**
 * Picks a colour: preset swatches, the favourites (kept in the settings and
 * shared by every widget), a free colour and its hex code, or back to the
 * default colour of the measure.
 */
export function ColorDialog({ title, value, fallback, onPick, onClose }: {
  title: string;
  /** Current custom colour, or null when the default is used. */
  value: string | null;
  /** The default colour (a theme variable), previewed when no custom colour is set. */
  fallback: string;
  onPick: (color: string | null) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();
  const [color, setColor] = useState<string | null>(value);
  const [hex, setHex] = useState(value ?? '');
  const favorites = (config?.settings?.favoriteColors ?? []).filter(item => safeColor(item));
  const isFavorite = !!color && favorites.includes(color);

  const choose = (next: string | null) => { setColor(next); setHex(next ?? ''); };
  const toggleFavorite = () => {
    if (!color) return;
    void updateConfig({ favoriteColors: isFavorite ? favorites.filter(item => item !== color) : [...favorites, color].slice(-24) });
  };

  const swatch = (item: string, removable = false) => (
    <span key={item} className="ndc-color-choice">
      <button type="button" className={`ndc-color-dot ${color === item ? 'is-on' : ''}`} style={{ background: item }} onClick={() => choose(item)} aria-label={item} aria-pressed={color === item} />
      {removable && (
        <button type="button" className="ndc-color-remove" onClick={() => void updateConfig({ favoriteColors: favorites.filter(entry => entry !== item) })} aria-label={t('devices.look.removeFavorite')}>
          <X size={9} />
        </button>
      )}
    </span>
  );

  return (
    <DialogPortal onClose={onClose}>
      {ref => (
        <CalmeDialog
          dialogRef={ref}
          label={title}
          title={title}
          onClose={onClose}
          width={380}
          danger={<button type="button" className="nd-btn" onClick={() => { onPick(null); onClose(); }}>{t('devices.look.defaultColor')}</button>}
          footer={<>
            <button type="button" className="nd-btn" onClick={onClose}>{t('Annuler')}</button>
            <button type="button" className="nd-btn nd-btn-accent" onClick={() => { onPick(color); onClose(); }}>{t('devices.look.apply')}</button>
          </>}
        >
          <div className="ndc-color-preview">
            <span className="ndc-swatch is-large" style={{ background: color ?? fallback }} />
            <span className="ndc-color-preview-text">{color ?? t('devices.look.defaultColor')}</span>
            <button type="button" className={`ndc-icon-button ${isFavorite ? 'is-on' : ''}`} onClick={toggleFavorite} disabled={!color} aria-pressed={isFavorite} aria-label={t('devices.look.favorite')} title={t('devices.look.favorite')}>
              <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          </div>
          <CalmeField label={t('devices.look.presets')}>
            <div className="ndc-color-grid">{PRESET_COLORS.map(item => swatch(item))}</div>
          </CalmeField>
          <CalmeField label={t('devices.look.favorites')}>
            {favorites.length
              ? <div className="ndc-color-grid">{favorites.map(item => swatch(item, true))}</div>
              : <span className="ndc-color-empty">{t('devices.look.noFavorite')}</span>}
          </CalmeField>
          <CalmeField label={t('devices.look.custom')} htmlFor="ndc-color-hex">
            <div className="ndc-color-custom">
              <input type="color" value={color ?? '#5ec8d8'} onChange={event => choose(event.target.value)} aria-label={t('devices.look.custom')} />
              <input
                id="ndc-color-hex"
                className="nd-input"
                value={hex}
                placeholder="#5ec8d8"
                maxLength={7}
                onChange={event => {
                  const next = event.target.value.startsWith('#') ? event.target.value : `#${event.target.value}`;
                  setHex(event.target.value);
                  if (safeColor(next)) setColor(next.toLowerCase());
                }}
              />
            </div>
          </CalmeField>
        </CalmeDialog>
      )}
    </DialogPortal>
  );
}
