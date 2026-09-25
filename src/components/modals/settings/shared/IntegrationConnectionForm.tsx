import React, { useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { getServiceIntegration } from '@/integrations/registry';
import { MASKED_SECRET } from '@/integrations/instances';

/**
 * Fields of one service connection, drawn from its manifest. Each field is
 * saved when it loses focus; a secret already stored shows as a mask and is
 * kept unless something else is typed.
 */
export function IntegrationConnectionForm({ type }: { type: string }) {
  const { t } = useI18n();
  const { config, saveIntegration } = useConfig();
  const manifest = getServiceIntegration(type);
  const instance = config?.integrations?.find(candidate => candidate.type === type);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries((manifest?.fields ?? []).map(field => [
    field.id,
    field.kind === 'secret' ? (instance?.secrets?.[field.id] ? MASKED_SECRET : '') : instance?.settings[field.id] ?? '',
  ])));
  const [error, setError] = useState('');
  if (!manifest) return null;

  const save = async () => {
    const settings: Record<string, string> = {};
    const secrets: Record<string, string> = {};
    for (const field of manifest.fields) {
      if (field.kind === 'secret') secrets[field.id] = values[field.id] ?? '';
      else settings[field.id] = (values[field.id] ?? '').trim();
    }
    try {
      setError('');
      await saveIntegration({ id: instance?.id, type, name: instance?.name ?? manifest.name, settings, secrets });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {manifest.fields.map(field => (
        <input
          key={field.id}
          type={field.kind === 'text' ? 'text' : 'password'}
          aria-label={t(field.label)}
          className="nd-input"
          placeholder={field.placeholder ? t(field.placeholder) : t(field.label)}
          value={values[field.id] ?? ''}
          onFocus={event => { if (event.target.value === MASKED_SECRET) setValues(current => ({ ...current, [field.id]: '' })); }}
          onChange={event => setValues(current => ({ ...current, [field.id]: event.target.value }))}
          onBlur={() => {
            if (field.kind === 'secret' && !values[field.id] && instance?.secrets?.[field.id]) setValues(current => ({ ...current, [field.id]: MASKED_SECRET }));
            void save();
          }}
          style={{ fontSize: '0.75rem', padding: '10px 14px' }}
        />
      ))}
      {error && <div role="alert" style={{ color: 'var(--nd-red)', fontSize: '0.68rem' }}>{error}</div>}
    </div>
  );
}
