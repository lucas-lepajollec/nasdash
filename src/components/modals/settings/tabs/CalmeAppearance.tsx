'use client';

import React, { useState } from 'react';
import { applySoftEdges } from '@/lib/appearance';
import { Plus, X } from 'lucide-react';
import type { AppearanceProfile } from '@/lib/types';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { UI_LANGUAGES } from '@/i18n/messages';
import CustomSelect from '../../../shared/CustomSelect';
import { Emoji } from '../../../shared/Emoji';
import { THEME_GALLERY } from '../../ThemeGalleryView';
import { CalmeHeading, CalmeRow, CalmeSegmented, CalmeSlider, CalmeSwitch } from '../shared/CalmeControls';

/** Themes shown as thumbnails; the others are one click away in the gallery. */
const FEATURED_THEMES = ['nasdash', 'nord', 'everforest-dark', 'rose-pine-dawn'];
const ACCENTS = ['#5fd3e6', '#7ea8f8', '#9d8cff', '#ef7c8e', '#e9b44c', '#5fd49a'];
const CALME_RADIUS = 6;

export interface CalmeAppearanceProps {
  part: 'appearance' | 'wallpaper';
  theme: string;
  mode: 'light' | 'dark';
  onThemeChange: (theme: string) => void;
  onToggleMode: () => void;
  onOpenThemeGallery?: (tab: 'themes' | 'emojis') => void;
  globalFont: string;
  onFontChange: (font: string) => void;
  borderRadius: number;
  onRadiusChange: (value: number) => void;
  onRadiusSave: (value: number) => void;
  cardOpacity: number;
  onOpacityChange: (value: number) => void;
  onOpacitySave: (value: number) => void;
  backgroundImage: string;
  setBackgroundImage: (value: string) => void;
  onSaveBackground: () => void;
  onClearBackground: () => void;
  uploadedBgs: { name: string; url: string }[];
  onPickBackground: (url: string) => void;
  onRequestBackgroundDelete: (url: string) => void;
  onUploadBackground: (file: File) => void;
  profiles: AppearanceProfile[];
  onSaveProfile: (name: string) => void;
  onApplyProfile: (profile: AppearanceProfile) => void;
  onRequestProfileDelete: (id: string) => void;
}

/**
 * Appearance and Wallpaper in the Calme style, as in the D-Settings mock-up:
 * a few airy blocks (theme, accent, display, profiles), one line per
 * setting, explanations in ⓘ tooltips. Same handlers as the Classic tab.
 */
export function CalmeAppearance(props: CalmeAppearanceProps) {
  return props.part === 'wallpaper' ? <Wallpaper {...props} /> : <Appearance {...props} />;
}

function Appearance(props: CalmeAppearanceProps) {
  const { t, language, setLanguage } = useI18n();
  const { config, updateConfig } = useConfig();
  const settings = config?.settings;
  const [newProfile, setNewProfile] = useState<string | null>(null);

  const featured = FEATURED_THEMES.includes(props.theme) ? FEATURED_THEMES : [props.theme, ...FEATURED_THEMES.slice(0, -1)];
  const themes = featured.map(key => THEME_GALLERY.find(theme => theme.key === key)).filter((theme): theme is NonNullable<typeof theme> => !!theme);
  const themeAccent = THEME_GALLERY.find(theme => theme.key === props.theme)?.accent ?? '#5fd3e6';
  const accent = settings?.accentColor || '';
  // Under Calme, the historical defaults (12 px corners, 80 % opacity) mean "not customised".
  const radius = props.borderRadius === 12 ? CALME_RADIUS : props.borderRadius;
  const opacity = props.cardOpacity === 0.8 ? 1 : props.cardOpacity;
  const emojiTheme = settings?.emojiTheme || 'native';
  const emojiLabel = ({ twemoji: 'Twemoji', blobmoji: 'Blobmoji', openmoji: 'OpenMoji', lucide: 'Lucide' } as Record<string, string>)[emojiTheme] ?? 'Native';
  const showCategoryTitles = !(settings?.hideCategoryTitles ?? false);
  const selectLanguage = async (next: typeof language) => {
    const previous = language;
    setLanguage(next);
    if (!await updateConfig({ uiLanguage: next })) setLanguage(previous);
  };

  return (
    <div className="ndc-appearance">
      <section className="ndc-set-block">
        <CalmeHeading action={props.onOpenThemeGallery && (
          <button type="button" className="ndc-text-button" onClick={() => props.onOpenThemeGallery?.('themes')}>
            {t('settings.calme.allThemes', { count: THEME_GALLERY.length })} →
          </button>
        )}>{t('settings.calme.theme')}</CalmeHeading>
        <div className="ndc-themes" role="radiogroup" aria-label={t('settings.calme.theme')}>
          {themes.map(theme => (
            <button key={theme.key} type="button" role="radio" aria-checked={props.theme === theme.key} className="ndc-theme" onClick={() => props.onThemeChange(theme.key)}>
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
              <span className="ndc-theme-name">{t(theme.name).replace(/\s*\(.*\)|\s*[^\p{L}\p{N}\s'’&-]+$/gu, '')}</span>
            </button>
          ))}
        </div>
        {props.theme === 'nasdash' && (
          <div className="ndc-inline-row">
            <span>{t('settings.calme.mode')}</span>
            <CalmeSegmented
              label={t('settings.calme.mode')}
              value={props.mode}
              options={[{ value: 'dark', label: t('settings.calme.dark') }, { value: 'light', label: t('settings.calme.light') }]}
              onChange={value => { if (value !== props.mode) props.onToggleMode(); }}
            />
          </div>
        )}
      </section>

      <section className="ndc-set-block">
        <CalmeHeading info={t('settings.calme.accentInfo')}>{t('settings.calme.accent')}</CalmeHeading>
        <div className="ndc-swatches" role="radiogroup" aria-label={t('settings.calme.accent')}>
          <button
            type="button"
            role="radio"
            aria-checked={!accent}
            aria-label={t('settings.calme.accentTheme')}
            title={t('settings.calme.accentTheme')}
            className="ndc-swatch ndc-swatch--theme"
            style={{ '--ndc-theme-accent': themeAccent } as React.CSSProperties}
            onClick={() => updateConfig({ accentColor: '' })}
          />
          {ACCENTS.map(color => (
            <button key={color} type="button" role="radio" aria-checked={accent.toLowerCase() === color} aria-label={color} className="ndc-swatch" style={{ background: color }} onClick={() => updateConfig({ accentColor: color })} />
          ))}
          <span className="ndc-swatch-value">{accent ? accent.toUpperCase() : t('settings.calme.accentTheme')}</span>
        </div>
      </section>

      <section className="ndc-set-block">
        <CalmeHeading>{t('settings.calme.display')}</CalmeHeading>
        <CalmeRow label={t('settings.designStyle.title')} info={t('settings.designStyle.description')}>
          <CalmeSegmented
            label={t('settings.designStyle.title')}
            value={settings?.designStyle === 'classic' ? 'classic' : 'calme'}
            options={[{ value: 'calme', label: t('settings.designStyle.calme') }, { value: 'classic', label: t('settings.designStyle.classic') }]}
            onChange={style => { void updateConfig({ designStyle: style }); }}
          />
        </CalmeRow>
        <CalmeRow label={t('settings.languageTitle')}>
          <div style={{ width: 200 }}>
            <CustomSelect value={language} onChange={value => void selectLanguage(value as typeof language)} options={UI_LANGUAGES.map(option => ({ value: option.id, label: option.label }))} />
          </div>
        </CalmeRow>
        <CalmeRow label={t('settings.calme.font')}>
          <div style={{ width: 200 }}>
            <CustomSelect
              value={props.globalFont || 'Outfit'}
              onChange={props.onFontChange}
              options={[
                { value: 'Outfit', label: t('settings.calme.fontDefault') },
                ...['Inter', 'Poppins', 'Rubik', 'Ubuntu', 'Lexend', 'JetBrains Mono', 'Fira Code', 'Source Code Pro', 'Montserrat', 'Roboto'].map(font => ({ value: font, label: font })),
              ]}
            />
          </div>
        </CalmeRow>
        <CalmeRow label={t('settings.calme.radius')} info={t('settings.calme.radiusHint')}>
          <CalmeSlider label={t('settings.calme.radius')} value={radius} min={0} max={24} step={1} onChange={props.onRadiusChange} onCommit={props.onRadiusSave} format={value => `${value} px`} />
        </CalmeRow>
        <CalmeRow label={t('settings.calme.opacity')} info={t('settings.calme.opacityHint')}>
          <CalmeSlider label={t('settings.calme.opacity')} value={opacity} min={0} max={1} step={0.05} onChange={props.onOpacityChange} onCommit={props.onOpacitySave} format={value => `${Math.round(value * 100)} %`} />
        </CalmeRow>
        <CalmeRow label={t('settings.calme.blur')} info={t('settings.calme.blurHint')}>
          <BlurSlider />
        </CalmeRow>
        <CalmeRow label={t('settings.calme.softEdges')} info={t('settings.calme.softEdgesHint')}>
          <SoftEdgesSlider />
        </CalmeRow>
        <CalmeRow label={t('settings.calme.outlines')} info={t('settings.calme.outlinesHint')}>
          <CalmeSwitch label={t('settings.calme.outlines')} checked={!settings?.hideOutlines} onChange={value => updateConfig({ hideOutlines: !value })} />
        </CalmeRow>
        <CalmeRow label={t('settings.calme.widgetTitles')} info={t('settings.calme.widgetTitlesHint')}>
          <CalmeSwitch label={t('settings.calme.widgetTitles')} checked={!(settings?.hideWidgetTitles ?? false)} onChange={value => updateConfig({ hideWidgetTitles: !value })} />
        </CalmeRow>
        <CalmeRow label={t('settings.calme.categoryTitles')} info={t('settings.calme.categoryTitlesHint')}>
          {showCategoryTitles && (
            <CalmeSegmented
              label={t('settings.calme.categoryTitlePosition')}
              value={settings?.categoryTitlePosition || 'above'}
              options={[{ value: 'above', label: t('settings.calme.above') }, { value: 'inside', label: t('settings.calme.inside') }]}
              onChange={value => updateConfig({ categoryTitlePosition: value })}
            />
          )}
          <CalmeSwitch label={t('settings.calme.categoryTitles')} checked={showCategoryTitles} onChange={value => updateConfig({ hideCategoryTitles: !value })} />
        </CalmeRow>
        <CalmeRow label={t('settings.calme.emojiStyle')}>
          {props.onOpenThemeGallery && (
            <button type="button" className="ndc-pick" onClick={() => props.onOpenThemeGallery?.('emojis')}>
              <Emoji emoji="🏠" /><Emoji emoji="🐳" /><Emoji emoji="🖥️" /><span>{emojiLabel}</span>
            </button>
          )}
        </CalmeRow>
      </section>

      <section className="ndc-set-block">
        <CalmeHeading
          info={t('settings.calme.profilesHint')}
          action={newProfile === null && (
            <button type="button" className="ndc-text-button" onClick={() => setNewProfile('')}><Plus size={12} style={{ verticalAlign: -2 }} /> {t('settings.calme.saveCurrent')}</button>
          )}
        >{t('settings.calme.profiles')}</CalmeHeading>
        {newProfile !== null && (
          <div className="ndc-field" style={{ marginBottom: 6 }}>
            <input
              autoFocus
              type="text"
              className="nd-input"
              placeholder={t('settings.calme.profileName')}
              aria-label={t('settings.calme.profileName')}
              value={newProfile}
              onChange={event => setNewProfile(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && newProfile.trim()) { props.onSaveProfile(newProfile); setNewProfile(null); }
                if (event.key === 'Escape') setNewProfile(null);
              }}
            />
            <button type="button" className="nd-btn nd-btn-accent" disabled={!newProfile.trim()} onClick={() => { props.onSaveProfile(newProfile); setNewProfile(null); }}>{t('Sauvegarder')}</button>
            <button type="button" className="ndc-icon-button" aria-label={t('Annuler')} onClick={() => setNewProfile(null)}><X size={14} /></button>
          </div>
        )}
        {props.profiles.length === 0 && newProfile === null && <div className="ndc-set-empty">{t('settings.calme.noProfile')}</div>}
        {props.profiles.map(profile => (
          <CalmeRow key={profile.id} label={profile.name} value={profile.settings.theme}>
            <button type="button" className="nd-btn" onClick={() => props.onApplyProfile(profile)}>{t('Appliquer')}</button>
            <button type="button" className="ndc-icon-button" aria-label={t('Supprimer le profil')} title={t('Supprimer le profil')} onClick={() => props.onRequestProfileDelete(profile.id)}>
              <X size={14} />
            </button>
          </CalmeRow>
        ))}
      </section>
    </div>
  );
}

/** Background blur: moves live, saved on release. */
function BlurSlider() {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();
  const [value, setValue] = useState<number | null>(null);
  const shown = value ?? config?.settings?.surfaceBlur ?? 0;
  const preview = (next: number) => {
    setValue(next);
    if (next > 0) {
      document.body.style.setProperty('--nd-surface-blur', `${next}px`);
      document.body.setAttribute('data-blur', 'on');
    } else {
      document.body.removeAttribute('data-blur');
    }
  };
  return (
    <CalmeSlider
      label={t('settings.calme.blur')}
      value={shown}
      min={0}
      max={24}
      step={1}
      onChange={preview}
      onCommit={async next => { await updateConfig({ surfaceBlur: next }); setValue(null); }}
      format={next => (next === 0 ? t('settings.calme.off') : `${next} px`)}
    />
  );
}

/** Soft edges: moves live, saved on release. */
function SoftEdgesSlider() {
  const { t } = useI18n();
  const { config, updateConfig } = useConfig();
  const [value, setValue] = useState<number | null>(null);
  const shown = value ?? config?.settings?.softEdges ?? 0;
  return (
    <CalmeSlider
      label={t('settings.calme.softEdges')}
      value={shown}
      min={0}
      max={20}
      step={1}
      onChange={next => { setValue(next); applySoftEdges(next); }}
      onCommit={async next => { await updateConfig({ softEdges: next }); setValue(null); }}
      format={next => (next === 0 ? t('settings.calme.off') : `${next} px`)}
    />
  );
}

function Wallpaper(props: CalmeAppearanceProps) {
  const { t } = useI18n();
  const { config } = useConfig();
  const demoMode = config?.demoMode === true;
  return (
    <div className="ndc-set-page">
      <section className="ndc-set-block">
        <CalmeHeading info={demoMode ? t("L&apos;import de fichiers est désactivé dans la démo publique. Vous pouvez tester une URL d&apos;image fictive ; elle ne sera conservée que dans cette session.") : t('settings.calme.wallpaperHint')}>
          {t('settings.calme.wallpaperImage')}
        </CalmeHeading>
        <div className="ndc-field">
          <input
            type="text"
            className="nd-input"
            placeholder="https://…"
            value={props.backgroundImage}
            onChange={event => props.setBackgroundImage(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') props.onSaveBackground(); }}
            aria-label={t('settings.calme.wallpaperImage')}
          />
          <button type="button" className="nd-btn" onClick={props.onSaveBackground}>{t('Enregistrer')}</button>
          {props.backgroundImage && <button type="button" className="ndc-icon-button" aria-label={t('Effacer')} title={t('Effacer')} onClick={props.onClearBackground}><X size={14} /></button>}
        </div>
      </section>

      <section className="ndc-set-block">
        <CalmeHeading action={!demoMode && (
          <label className="ndc-text-button" style={{ cursor: 'pointer' }}>
            <Plus size={12} style={{ verticalAlign: -2 }} /> {t('settings.calme.importImage')}
            <input type="file" accept="image/*" hidden onChange={event => { const file = event.target.files?.[0]; if (file) props.onUploadBackground(file); event.target.value = ''; }} />
          </label>
        )}>{t('settings.calme.gallery')}</CalmeHeading>
        {props.uploadedBgs.length === 0 ? <div className="ndc-set-empty">{t('settings.calme.noWallpaper')}</div> : (
          <div className="ndc-wallpapers">
            {props.uploadedBgs.map(bg => (
              <div
                key={bg.name}
                role="button"
                tabIndex={0}
                aria-pressed={props.backgroundImage === bg.url}
                className="ndc-wallpaper"
                style={{ backgroundImage: `url("${bg.url}")` }}
                title={bg.name}
                onClick={() => props.onPickBackground(bg.url)}
                onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); props.onPickBackground(bg.url); } }}
              >
                <button type="button" className="ndc-wallpaper-remove" aria-label={t("Supprimer l'image de fond")} onClick={event => { event.stopPropagation(); props.onRequestBackgroundDelete(bg.url); }}>
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
