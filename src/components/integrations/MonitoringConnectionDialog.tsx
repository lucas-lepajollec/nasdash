'use client';

import React, { useState } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import type { IntegrationInstance } from '@/lib/types';
import type { SourceTarget } from '@/integrations/types';
import { getDeviceIntegration } from '@/integrations/registry';
import { MASKED_SECRET } from '@/integrations/instances';
import { connectionFields, SERVER_SOURCES } from '@/integrations/sources';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeCheckRow, CalmeDialog, CalmeField } from '@/components/shared/CalmeDialog';
import { DialogPortal } from '@/widgets/devices/ColorDialog';
import { ConnectionFields, fieldDefaults, type FieldValues } from './ConnectionFields';

/** i18n key shown when the test request itself fails. */
const TEST_FAILED = 'integrations.test.failed';

export interface TestResult { ok: boolean; message: string; count?: number; targets?: SourceTarget[] }

/** Tries a connection (saved, or as typed in a form). */
export async function testConnection(body: { type: string; id?: string; settings?: Record<string, string>; password?: string; values?: Record<string, string> }): Promise<TestResult> {
  try {
    const response = await fetch('/api/integrations/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return await response.json() as TestResult;
  } catch {
    return { ok: false, message: TEST_FAILED };
  }
}

/** The icon and one-line description of each monitoring source. */
export const MONITORING_INFO: Record<string, { icon: string; descriptionKey: string; docs?: string }> = {
  glances: { icon: '👁️', descriptionKey: 'integrations.info.glances' },
  netdata: { icon: '📈', descriptionKey: 'integrations.info.netdata' },
  beszel: { icon: '📊', descriptionKey: 'integrations.info.beszel' },
  prometheus: { icon: '🔥', descriptionKey: 'integrations.info.prometheus' },
  proxmox: { icon: '🗄️', descriptionKey: 'integrations.info.proxmox' },
  lhm: { icon: '🌡️', descriptionKey: 'integrations.info.lhm' },
};

/**
 * Adds or edits a monitoring connection (Glances, Beszel…): its name, the
 * fields of the connection, a test. New single-machine connections can create
 * their machine at once; a server (Beszel, Prometheus, Proxmox) lists its
 * machines after a test, to add the chosen ones.
 */
export function MonitoringConnectionDialog({ type, instance, onClose, showSensitive = false }: {
  type: string;
  instance?: IntegrationInstance;
  onClose: () => void;
  /** Privacy mode off: addresses are shown while typing. */
  showSensitive?: boolean;
}) {
  const { t } = useI18n();
  const { saveIntegration, addDevice, config } = useConfig();
  const manifest = getDeviceIntegration(type)!;
  const fields = connectionFields(manifest);
  const server = SERVER_SOURCES.includes(type);
  const [name, setName] = useState(instance?.name ?? manifest.name);
  const [values, setValues] = useState<FieldValues>(() => ({
    ...fieldDefaults(fields),
    ...(instance ? { ip: instance.settings.ip ?? '', port: instance.settings.port ?? '', username: instance.settings.username ?? '', allowSelfSigned: instance.settings.allowSelfSigned ?? '' } : {}),
    password: '',
  }));
  const [createMachine, setCreateMachine] = useState(!instance && !server);
  const [test, setTest] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const demoMode = config?.demoMode === true;

  const settings = { ip: values.ip ?? '', port: values.port ?? '', username: values.username ?? '', allowSelfSigned: values.allowSelfSigned === 'true' ? 'true' : '' };
  const targetKey = (target: SourceTarget) => JSON.stringify(target.values);
  // Machines of this server already added, to leave them out of the list.
  const known = new Set((config?.devices ?? []).filter(device => instance && device.source?.integrationId === instance.id).map(device => JSON.stringify(device.source?.values ?? {})));

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    setTest(await testConnection({ type, id: instance?.id, settings, password: values.password || undefined }));
    setTesting(false);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const saved = await saveIntegration({
        ...(instance ? { id: instance.id } : {}),
        type,
        name: name.trim() || manifest.name,
        settings,
        secrets: { password: values.password ? values.password : instance ? MASKED_SECRET : '' },
      });
      if (createMachine && !instance) {
        await addDevice({ name: name.replace(new RegExp(`^${manifest.name}\\s*·\\s*`), '').trim() || manifest.name, host: '', icon: '🖥️', source: { integrationId: saved.id } });
      }
      for (const key of picked) {
        const target = test?.targets?.find(item => targetKey(item) === key);
        if (target) await addDevice({ name: target.label, host: target.detail ?? '', icon: '🖥️', source: { integrationId: saved.id, values: target.values } });
      }
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('integrations.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const offered = (test?.targets ?? []).filter(target => !known.has(JSON.stringify(target.values)));

  return (
    <DialogPortal onClose={onClose}>
      {ref => (
        <CalmeDialog
          dialogRef={ref}
          label={instance ? t('integrations.editConnection', { name: manifest.name }) : t('integrations.addConnection', { name: manifest.name })}
          title={instance ? t('integrations.editConnection', { name: manifest.name }) : t('integrations.addConnection', { name: manifest.name })}
          subtitle={t(MONITORING_INFO[type]?.descriptionKey ?? '')}
          onClose={onClose}
          width={520}
          danger={
            <button type="button" className="nd-btn" onClick={() => void runTest()} disabled={testing || !values.ip}>
              {testing ? <Loader2 size={14} className="nd-spin" /> : server ? t('integrations.testList') : t('integrations.test')}
            </button>
          }
          footer={<>
            <button type="button" className="nd-btn" onClick={onClose}>{t('Annuler')}</button>
            <button type="submit" form="nd-connection-form" className="nd-btn nd-btn-accent" disabled={saving}>{saving ? <Loader2 size={14} className="nd-spin" /> : t('Enregistrer')}</button>
          </>}
        >
          <form id="nd-connection-form" className="ndc-form" onSubmit={save}>
            {demoMode && <p className="ndc-dialog-hint">{t('integrations.demoHint')}</p>}
            <CalmeField label={t('integrations.connectionName')} info={t('integrations.connectionNameHint')} htmlFor="connection-name">
              <input id="connection-name" className="nd-input" value={name} onChange={event => setName(event.target.value)} required />
            </CalmeField>
            <ConnectionFields fields={fields} values={values} onChange={(id, value) => setValues(current => ({ ...current, [id]: value }))} editing={!!instance} showSensitive={showSensitive} />

            {test && (
              <div className={`ndc-test ${test.ok ? 'is-ok' : 'is-error'}`} role="status">
                {test.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                <span>{t(test.message, { count: test.count ?? 0 })}</span>
              </div>
            )}

            {!instance && !server && (
              <CalmeCheckRow checked={createMachine} onChange={() => setCreateMachine(!createMachine)}>
                <span className="ndc-dlg-name">{t('integrations.createMachine')}</span>
              </CalmeCheckRow>
            )}

            {offered.length > 0 && (
              <CalmeField label={t('integrations.addMachines')} info={t('integrations.addMachinesHint')}>
                <div className="ndc-dlg-list">
                  {offered.map(target => {
                    const key = targetKey(target);
                    return (
                      <CalmeCheckRow key={key} checked={picked.includes(key)} onChange={() => setPicked(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key])}>
                        <span className="ndc-dlg-name">{target.label}</span>
                        {target.detail && <span className="ndc-dlg-note">{target.detail}</span>}
                      </CalmeCheckRow>
                    );
                  })}
                </div>
              </CalmeField>
            )}
            {error && <p className="ndc-dialog-hint" style={{ color: 'var(--nd-red)' }}>{error}</p>}
          </form>
        </CalmeDialog>
      )}
    </DialogPortal>
  );
}
