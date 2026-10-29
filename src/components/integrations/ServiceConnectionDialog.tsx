'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { getServiceIntegration } from '@/integrations/registry';
import { MASKED_SECRET } from '@/integrations/instances';
import { CalmeDialog, CalmeField } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import type { IntegrationInstance } from '@/lib/types';
import { createLocalId } from '@/lib/pages/operations';
import { DialogPortal } from '@/widgets/devices/ColorDialog';
import CustomSelect from '@/components/shared/CustomSelect';
import { CUSTOM_API_TYPES, DNS_TYPES, PHOTO_TYPES } from '@/lib/widgetData/contracts';

/** Services a dashboard may connect several times (two Pi-holes, two photo libraries…). */
import { MEDIA_SERVER_TYPES, ARR_TYPES, DOWNLOAD_CLIENT_TYPES, UPS_TYPES, VPN_TUNNEL_TYPES } from '@/lib/widgetData/contracts'; export const MULTI_INSTANCE_SERVICES: readonly string[] = [...DNS_TYPES, ...PHOTO_TYPES, ...CUSTOM_API_TYPES, ...MEDIA_SERVER_TYPES, 'navidrome', ...ARR_TYPES, ...DOWNLOAD_CLIENT_TYPES, ...VPN_TUNNEL_TYPES, ...UPS_TYPES];

/**
 * A service connection (Tailscale, Headscale, Pi-hole, AdGuard Home, Immich,
 * PhotoPrism) in a dialog, from its manifest: its fields with their labels,
 * saved on "Save". A secret already stored is kept when left empty. Services
 * that can be connected several times get a name and a fresh id when added;
 * `onSaved` receives the saved connection (a widget can then select it).
 */
export function ServiceConnectionDialog({ type, instance: chosen, onClose, onSaved }: { type: string; instance?: IntegrationInstance; onClose: () => void; onSaved?: (instance: IntegrationInstance) => void }) {
  const { t } = useI18n();
  const { config, saveIntegration } = useConfig();
  const manifest = getServiceIntegration(type);
  const multi = MULTI_INSTANCE_SERVICES.includes(type);
  const instance = multi ? chosen : chosen ?? config?.integrations?.find(candidate => candidate.type === type);
  const [name, setName] = useState(() => instance?.name ?? manifest?.name ?? type);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries((manifest?.fields ?? []).map(field => [
    field.id, field.kind === 'secret' ? '' : instance?.settings[field.id] ?? (field.kind === 'toggle' ? 'false' : field.kind === 'select' ? field.options?.[0]?.value ?? '' : ''),
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
      // Not crypto.randomUUID: browsers only offer it on HTTPS/localhost, NasDash is often opened by LAN address.
      const id = instance?.id ?? (multi ? createLocalId(type) : undefined);
      const saved = await saveIntegration({ id, type, name: multi ? name.trim() || manifest.name : instance?.name ?? manifest.name, settings, secrets });
      onSaved?.(saved);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? t(reason.message) : t('integrations.saveFailed'));
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
          subtitle={t(`integrations.info.${type}`)}
          onClose={onClose}
          width={480}
          footer={<>
            <button type="button" className="nd-btn" onClick={onClose}>{t('Annuler')}</button>
            <button type="submit" form="nd-service-connection" className="nd-btn nd-btn-accent" disabled={saving}>{saving ? <Loader2 size={14} className="nd-spin" /> : t('Enregistrer')}</button>
          </>}
        >
          <form id="nd-service-connection" className="ndc-form" onSubmit={save}>
            {multi && (
              <CalmeField label={t('integrations.connectionName')} htmlFor="service-name">
                <input id="service-name" className="nd-input" value={name} maxLength={60} onChange={event => setName(event.target.value)} required />
              </CalmeField>
            )}
            {manifest.fields.filter(field => (!field.showWhen || field.showWhen.values.includes(values[field.showWhen.field] ?? ''))).map(field => field.kind === 'select' ? (
              <CalmeField key={field.id} label={t(field.label)}>
                <CustomSelect
                  ariaLabel={t(field.label)}
                  value={values[field.id] || field.options?.[0]?.value || ''}
                  onChange={value => setValues(current => ({ ...current, [field.id]: value }))}
                  options={(field.options ?? []).map(option => ({ value: option.value, label: t(option.label) }))}
                />
              </CalmeField>
            ) : field.kind === 'toggle' ? (
              <CalmeRow key={field.id} label={t(field.label)} info={field.id === 'allowSelfSigned' ? t('integrations.allowSelfSignedHint') : undefined}>
                <CalmeSwitch label={t(field.label)} checked={values[field.id] === 'true'} onChange={on => setValues(current => ({ ...current, [field.id]: on ? 'true' : 'false' }))} />
              </CalmeRow>
            ) : (
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
