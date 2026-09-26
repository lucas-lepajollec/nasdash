'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Download, ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import type { BackupSchedule, TaskId, TaskRun, TaskSettings } from '@/lib/tasks';
import CustomSelect from '../../../shared/CustomSelect';
import ConfirmModal from '../../ConfirmModal';
import { CalmeHeading, CalmeRow, CalmeSegmented } from '../shared/CalmeControls';
import { docsUrl } from './HelpTab';

interface TaskStatus { id: TaskId; everySeconds?: number; idleSeconds?: number; schedule?: BackupSchedule; last: TaskRun | null }
interface BackupInfo { name: string; size: number; createdAt: number; automatic: boolean }

const MONITORING = [5, 10, 15, 30, 60];
const IDLE = [60, 300, 900, 3600];
const PINGS = [15, 30, 60, 120, 300];
const KEEP = [3, 7, 14, 30];

/**
 * Tasks: what the server does in the background (reading the machines,
 * pinging services, saving the device history, backups), when each last ran,
 * and their rhythm; then the backups themselves.
 */
export function TasksTab() {
  const { t, language, locale } = useI18n();
  const { updateConfig } = useConfig();
  const [tasks, setTasks] = useState<TaskStatus[] | null>(null);
  const [settings, setSettings] = useState<TaskSettings | null>(null);
  const [demo, setDemo] = useState(false);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<BackupInfo | null>(null);
  // When the list was read: relative times are counted from it (render stays pure).
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    try {
      const [taskData, backupData] = await Promise.all([
        fetch('/api/tasks').then(response => response.json()),
        fetch('/api/backups').then(response => response.json()),
      ]);
      setTasks(taskData.tasks ?? []);
      setSettings(taskData.settings ?? null);
      setDemo(!!taskData.demo);
      setBackups(backupData.backups ?? []);
      setNow(Date.now());
    } catch {
      setTasks([]);
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(load, 15_000);
    return () => clearInterval(timer);
  }, [load]);

  const change = async (next: Partial<TaskSettings>) => {
    if (!settings) return;
    setSettings({ ...settings, ...next });
    await updateConfig({ tasks: next });
    void load();
  };

  const backupNow = async () => {
    setBusy(true);
    setError('');
    const response = await fetch('/api/backups', { method: 'POST' }).catch(() => null);
    if (!response?.ok) setError(t('backups.failed'));
    setBusy(false);
    void load();
  };

  const remove = async (backup: BackupInfo) => {
    const response = await fetch(`/api/backups/${encodeURIComponent(backup.name)}`, { method: 'DELETE' }).catch(() => null);
    if (!response?.ok) setError(t('backups.deleteFailed'));
    void load();
  };

  const seconds = (value: number) => value < 60 ? t('tasks.seconds', { count: value }) : value < 3600 ? t('tasks.minutes', { count: Math.round(value / 60) }) : t('tasks.hours', { count: Math.round(value / 3600) });
  const ago = (at: number) => {
    const diff = Math.round((at - now) / 1000);
    const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (Math.abs(diff) < 60) return format.format(diff, 'second');
    if (Math.abs(diff) < 3600) return format.format(Math.round(diff / 60), 'minute');
    if (Math.abs(diff) < 86_400) return format.format(Math.round(diff / 3600), 'hour');
    return format.format(Math.round(diff / 86_400), 'day');
  };
  const size = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} ${t('units.kb')}` : `${(bytes / 1024 / 1024).toFixed(1)} ${t('units.mb')}`;
  const options = (values: number[]) => values.map(value => ({ value: String(value), label: seconds(value) }));

  const state = (task: TaskStatus) => {
    if (task.id === 'backups' && task.schedule === 'off' && !task.last) return <span className="ndc-int-state">{t('tasks.off')}</span>;
    if (!task.last) return <span className="ndc-int-state">{t('tasks.notYet')}</span>;
    return (
      <span className={`ndc-int-state ${task.last.ok ? 'is-ok' : 'is-error'}`} title={task.last.note}>
        <span className="ndc-int-state-dot" />{task.last.ok ? t('tasks.ok') : t('tasks.failed')}
      </span>
    );
  };

  const describe = (task: TaskStatus) => {
    const last = task.last ? t('tasks.lastRun', { when: ago(task.last.at) }) : t('tasks.neverRun');
    const note = task.last?.note && task.id !== 'backups' ? ` · ${task.last.note}` : '';
    return `${last}${note}`;
  };

  if (!tasks || !settings) return <div className="ndc-set-page"><div className="ndc-empty"><Loader2 size={16} className="nd-spin" /></div></div>;

  const byId = (id: TaskId) => tasks.find(task => task.id === id);
  const monitoring = byId('device-monitoring');
  const pings = byId('service-pings');
  const history = byId('history-save');
  const backup = byId('backups');

  return (
    <div className="ndc-set-page">
      <section className="ndc-set-block">
        <CalmeHeading info={demo ? t('tasks.demoHint') : t('tasks.backgroundHint')}>{t('tasks.background')}</CalmeHeading>
        {monitoring && (
          <CalmeRow label={<span className="ndc-task-label">{t('tasks.monitoring')} {state(monitoring)}</span>} info={t('tasks.monitoringHint')} value={describe(monitoring)} stacked>
            <div className="ndc-task-rhythms">
              <label className="ndc-task-rhythm"><span>{t('tasks.whileOpen')}</span><CustomSelect ariaLabel={t('tasks.whileOpen')} value={String(settings.monitoringSeconds)} options={options(MONITORING)} onChange={value => void change({ monitoringSeconds: Number(value) })} /></label>
              <label className="ndc-task-rhythm"><span>{t('tasks.whileClosed')}</span><CustomSelect ariaLabel={t('tasks.whileClosed')} value={String(settings.idleMonitoringSeconds)} options={options(IDLE)} onChange={value => void change({ idleMonitoringSeconds: Number(value) })} /></label>
            </div>
          </CalmeRow>
        )}
        {pings && (
          <CalmeRow label={<span className="ndc-task-label">{t('tasks.pings')} {state(pings)}</span>} info={t('tasks.pingsHint')} value={describe(pings)} stacked>
            <div className="ndc-task-rhythms">
              <label className="ndc-task-rhythm"><span>{t('tasks.every')}</span><CustomSelect ariaLabel={t('tasks.pings')} value={String(settings.pingSeconds)} options={options(PINGS)} onChange={value => void change({ pingSeconds: Number(value) })} /></label>
            </div>
          </CalmeRow>
        )}
        {history && (
          <CalmeRow label={<span className="ndc-task-label">{t('tasks.history')} {state(history)}</span>} info={t('tasks.historyHint')} value={`${describe(history)} · ${t('tasks.everyFixed', { every: seconds(history.everySeconds ?? 300) })}`} />
        )}
      </section>

      <section className="ndc-set-block">
        <CalmeHeading
          info={demo ? t('backups.demoDisabled') : t('backups.hint')}
          action={!demo && (
            <button type="button" className="ndc-text-button" onClick={() => void backupNow()} disabled={busy}>
              {busy ? <Loader2 size={12} className="nd-spin" /> : <Plus size={12} style={{ verticalAlign: -2 }} />} {t('backups.now')}
            </button>
          )}
        >{t('backups.title')}</CalmeHeading>
        {backup && (
          <CalmeRow label={<span className="ndc-task-label">{t('backups.automatic')} {state(backup)}</span>} info={t('backups.automaticHint')} value={backup.last ? t('tasks.lastRun', { when: ago(backup.last.at) }) : undefined}>
            <CalmeSegmented
              label={t('backups.automatic')}
              value={settings.backupSchedule}
              options={[{ value: 'off', label: t('backups.off') }, { value: 'daily', label: t('backups.daily') }, { value: 'weekly', label: t('backups.weekly') }]}
              onChange={value => { if (!demo) void change({ backupSchedule: value }); }}
            />
          </CalmeRow>
        )}
        {settings.backupSchedule !== 'off' && (
          <CalmeRow label={t('backups.keep')} info={t('backups.keepHint')}>
            <div style={{ width: 150 }}>
              <CustomSelect ariaLabel={t('backups.keep')} value={String(settings.backupKeep)} options={KEEP.map(count => ({ value: String(count), label: t('backups.keepCount', { count }) }))} onChange={value => void change({ backupKeep: Number(value) })} />
            </div>
          </CalmeRow>
        )}
        {error && <p className="ndc-dialog-hint" role="alert" style={{ color: 'var(--nd-red)' }}>{error}</p>}
        {!demo && (backups.length === 0 ? <div className="ndc-set-empty">{t('backups.empty')}</div> : (
          <ul className="ndc-set-list ndc-backups">
            {backups.map(item => (
              <li key={item.name} className="ndc-backup">
                <span className="ndc-backup-text">
                  <span>{new Date(item.createdAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}<span className="ndc-tag" style={{ marginLeft: 8 }}>{item.automatic ? t('backups.auto') : t('backups.manual')}</span></span>
                  <span className="ndc-set-list-sub">{size(item.size)} · {ago(item.createdAt)}</span>
                </span>
                <a className="ndc-icon-button" href={`/api/backups/${encodeURIComponent(item.name)}`} download title={t('backups.download')} aria-label={[t('backups.download'), item.name].join(' · ')}><Download size={13} /></a>
                <button type="button" className="ndc-icon-button ndc-danger" onClick={() => setRemoving(item)} title={t('Supprimer')} aria-label={[t('Supprimer'), item.name].join(' · ')}><Trash2 size={13} /></button>
              </li>
            ))}
          </ul>
        ))}
        <p className="ndc-set-note-muted">
          {t('backups.restoreHint')}{' '}
          <a className="ndc-link" href={docsUrl(language, 'operations/restore')} target="_blank" rel="noopener noreferrer">{t('backups.restoreDocs')} <ExternalLink size={11} /></a>
        </p>
      </section>

      <ConfirmModal
        isOpen={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => { if (removing) void remove(removing); }}
        title={t('backups.deleteTitle')}
        description={t('backups.deleteDescription')}
      />
    </div>
  );
}
