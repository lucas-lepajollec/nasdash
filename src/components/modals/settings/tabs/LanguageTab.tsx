'use client';

import { Check, Languages } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { UI_LANGUAGES } from '@/i18n/messages';

export function LanguageTab() {
  const { language, setLanguage, t } = useI18n();

  return (
    <section aria-labelledby="nasdash-language-title" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h4 id="nasdash-language-title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, fontSize: '0.95rem' }}>
          <Languages size={18} style={{ color: 'var(--nd-accent)' }} />
          {t('settings.languageTitle')}
        </h4>
        <p style={{ color: 'var(--nd-text-muted)', fontSize: '0.72rem', lineHeight: 1.6, margin: '8px 0 0' }}>
          {t('settings.languageHint')}
        </p>
      </div>

      <div role="radiogroup" aria-label={t('settings.languageTitle')} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {UI_LANGUAGES.map((option) => {
          const selected = option.id === language;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setLanguage(option.id)}
              className="nd-btn"
              style={{
                justifyContent: 'space-between',
                minHeight: 48,
                padding: '10px 12px',
                borderColor: selected ? 'var(--nd-accent)' : 'var(--nd-card-border)',
                background: selected ? 'var(--nd-accent-glow)' : 'var(--nd-card-bg)',
                color: 'var(--nd-text)',
              }}
            >
              <span>{option.label}</span>
              {selected && <Check size={16} style={{ color: 'var(--nd-accent)' }} />}
            </button>
          );
        })}
      </div>

      <p style={{ color: 'var(--nd-text-muted)', fontSize: '0.67rem', margin: 0 }}>
        {t('settings.languageSaved')}
      </p>
    </section>
  );
}
