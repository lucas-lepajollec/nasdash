'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { getServiceIntegration } from '@/integrations/registry';
import { MASKED_SECRET } from '@/integrations/instances';
import { CalmeDialog, CalmeField } from '@/components/shared/CalmeDialog';
import { DialogPortal } from '@/widgets/devices/ColorDialog';

/**
 * A service connection (Tailscale, Headscale) in a dialog, from its manifest:
 * its fields with their labels, saved on "Save". A secret already stored is
 * kept when left empty.
 */
export function ServiceConnectionDialog({ type, onClose }: { type: string; onClose: () => void }) {
  const { t } = useI18n();
  const { config, saveIntegration } = useConfig();
  const manifest = getServiceIntegration(type);
  const instance = config?.integrations?.find(candidate => candidate.type === type);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries((manifest?.fields ?? []).map(field => [
    field.id, field.kind === 'secret' ? '' : instance?.settings[field.id] ?? '',
  ])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  if (!manifest) return null;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const settings: Record<string, string> = {};
    const secrets: Record<string, string> = {};
    for (const field of manifest.fields) {
      if (field.kind === 'secret') secrets[field.id] = values[field.id] || (instance?.secrets?.[field.id] ? MASKED_SECRET : '');
      else settings[field.id] = (values[field.id] ?? '').trim();
    }
    try {
      await saveIntegration({ id: instance?.id, type, name: instance?.name ?? manifest.name, settings, secrets });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('integrations.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const title = instance ? t('integrations.editConnection', { name: manifest.name }) : t('integrations.addConnection', { name: manifest.name });
  return (
    <DialogPortal onClose={onClose}>
      {ref => (
        <CalmeDialog
          dialogRef={ref}
          label={title}
          title={title}
          subtitle={t(type === 'headscale' ? 'integrations.info.headscale' : 'integrations.info.tailscale')}
          onClose={onClose}
          width={480}
          footer={<>
            <button type="button" className="nd-btn" onClick={onClose}>{t('Annuler')}</button>
            <button type="submit" form="nd-service-connection" className="nd-btn nd-btn-accent" disabled={saving}>{saving ? <Loader2 size={14} className="nd-spin" /> : t('Enregistrer')}</button>
          </>}
        >
          <form id="nd-service-connection" className="ndc-form" onSubmit={save}>
            {manifest.fields.map(field => (
              <CalmeField key={field.id} label={t(field.label)} htmlFor={`service-${field.id}`}>
                <input
                  id={`service-${field.id}`}
                  className="nd-input"
                  type={field.kind === 'text' ? 'text' : 'password'}
                  value={values[field.id] ?? ''}
                  placeholder={field.kind === 'secret' && instance?.secrets?.[field.id] ? t("Laisser vide pour garder l'actuel") : field.placeholder ? t(field.placeholder) : undefined}
                  onChange={event => setValues(current => ({ ...current, [field.id]: event.target.value }))}
                  required={!!field.required && !(field.kind === 'secret' && instance?.secrets?.[field.id])}
                  autoComplete={field.kind === 'text' ? 'off' : 'new-password'}
                />
              </CalmeField>
            ))}
            {error && <p className="ndc-dialog-hint" style={{ color: 'var(--nd-red)' }}>{error}</p>}
          </form>
        </CalmeDialog>
      )}
    </DialogPortal>
  );
}
