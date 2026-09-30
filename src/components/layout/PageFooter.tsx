'use client';

import React from 'react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';

/**
 * The dashboard signature, centred under the last widgets (at the bottom of
 * the screen when the page is short). For admins it is also the switch that
 * reveals or hides the secret categories.
 */
export function PageFooter({ showSecretSections, onToggleSecretSections }: { showSecretSections: boolean; onToggleSecretSections: () => void }) {
  const { t } = useI18n();
  const { user } = useConfig();
  const label = t('NASDASH — Dashboard Privé');
  return (
    <footer className="nd-page-footer">
      {user?.role === 'admin' ? (
        <button
          type="button"
          className={`nd-page-signature ${showSecretSections ? 'is-revealed' : ''}`}
          onClick={onToggleSecretSections}
          aria-pressed={showSecretSections}
          title={t('Activez ou désactivez les sections secrètes')}
        >
          {label}
        </button>
      ) : (
        <span className="nd-page-signature">{label}</span>
      )}
    </footer>
  );
}
