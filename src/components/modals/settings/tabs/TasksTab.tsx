'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Archive, Download, ExternalLink, History, Loader2, Server, Trash2 } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import type { BackupSchedule, TaskId, TaskRun, TaskSettings } from '@/lib/tasks';
import CustomSelect from '../../../shared/CustomSelect';
import ConfirmModal from '../../ConfirmModal';
import { CalmeHeading, CalmeInfo, CalmeSegmented } from '../shared/CalmeControls';
import { docsUrl } from './HelpTab';

interface TaskStatus { id: TaskId; everySeconds?: number; idleSeconds?: number; schedule?: BackupSchedule; last: TaskRun | null }
interface BackupInfo { name: string; size: number; createdAt: number; automatic: boolean }

const MONITORING = [5, 10, 15, 30, 60];
const IDLE = [60, 300, 900, 3600];
const PINGS = [15, 30, 60, 120, 300];
const KEEP = [3, 7, 14, 30];
/** The documented restore command (`scripts/data-snapshot.mjs`). */
const RESTORE_COMMAND = 'npm run data:restore -- --from <folder> --force';
const SCHEDULE_MS: Record<Exclude<BackupSchedule, 'off'>, number> = { daily: 86_400_000, weekly: 7 * 86_400_000 };

/**
 * Tasks and backups. First what the server does on its own: one row per
 * task (state, last run, rhythm). Then the backups: the schedule, the saved
 * archives, and how to restore one.
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
  // When the lists were read: relative times count from it (render stays pure).
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

  const duration = (value: number) => value < 60 ? t('tasks.seconds', { count: value }) : value < 3600 ? t('tasks.minutes', { count: Math.round(value / 60) }) : t('tasks.hours', { count: Math.round(value / 3600) });
  const relative = (at: number) => {
    const diff = Math.round((at - now) / 1000);
    const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (Math.abs(diff) < 60) return format.format(diff, 'second');
    if (Math.abs(diff) < 3600) return format.format(Math.round(diff / 60), 'minute');
    if (Math.abs(diff) < 86_400) return format.format(Math.round(diff / 3600), 'hour');
    return format.format(Math.round(diff / 86_400), 'day');
  };
  const size = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} ${t('units.kb')}` : `${(bytes / 1024 / 1024).toFixed(1)} ${t('units.mb')}`;
  const rhythms = (values: number[]) => values.map(value => ({ value: String(value), label: duration(value) }));

  if (!tasks || !settings) return <div className="ndc-set-page"><div className="ndc-empty"><Loader2 size={16} className="nd-spin" /></div></div>;

  const byId = (id: TaskId) => tasks.find(task => task.id === id);
  const latestAutomatic = backups.find(backup => backup.automatic);
  const nextBackup = settings.backupSchedule === 'off' ? null : latestAutomatic ? latestAutomatic.createdAt + SCHEDULE_MS[settings.backupSchedule] : now;

  const rows: Array<{ id: TaskId; icon: React.ReactNode; rhythm?: React.ReactNode }> = [
    {
      id: 'device-monitoring',
      icon: <Server size={15} />,
      rhythm: <>
        <Rhythm label={t('tasks.whileOpen')} value={settings.monitoringSeconds} options={rhythms(MONITORING)} onChange={value => void change({ monitoringSeconds: value })} />
        <Rhythm label={t('tasks.whileClosed')} value={settings.idleMonitoringSeconds} options={rhythms(IDLE)} onChange={value => void change({ idleMonitoringSeconds: value })} />
      </>,
    },
    { id: 'service-pings', icon: <Activity size={15} />, rhythm: <Rhythm label={t('tasks.every')} value={settings.pingSeconds} options={rhythms(PINGS)} onChange={value => void change({ pingSeconds: value })} /> },
    { id: 'history-save', icon: <History size={15} />, rhythm: <span className="ndc-task-fixed">{t('tasks.everyFixed', { every: duration(byId('history-save')?.everySeconds ?? 300) })}</span> },
  ];

  return (
    <div className="ndc-set-page">
      <section className="ndc-set-block">
        <CalmeHeading info={demo ? t('tasks.demoHint') : t('tasks.backgroundHint')}>{t('tasks.background')}</CalmeHeading>
        <ul className="ndc-tasks">
          {rows.map(row => {
            const task = byId(row.id);
            const last = task?.last;
            return (
              <li key={row.id} className="ndc-task">
                <span className="ndc-task-icon" aria-hidden="true">{row.icon}</span>
                <span className="ndc-task-name">{t(`tasks.name.${row.id}`)}<CalmeInfo text={t(`tasks.hint.${row.id}`)} /></span>
                <State run={last} />
                <span className="ndc-task-meta">
                  <span>{last ? t('tasks.lastRun', { when: relative(last.at) }) : t('tasks.neverRun')}</span>
                  {last?.note && last.ok && <span className="ndc-task-note">{t(`tasks.note.${row.id}`, { value: last.note })}</span>}
                </span>
                <span className="ndc-task-rhythm">{row.rhythm}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="ndc-set-block">
        <CalmeHeading
          info={demo ? t('backups.demoDisabled') : t('backups.hint')}
          action={!demo && (
            <button type="button" className="nd-btn nd-btn-accent ndc-backup-now" onClick={() => void backupNow()} disabled={busy}>
              {busy ? <Loader2 size={13} className="nd-spin" /> : <Archive size={13} />} {t('backups.now')}
            </button>
          )}
        >{t('backups.title')}</CalmeHeading>

        <div className="ndc-backup-plan">
          <div className="ndc-backup-field">
            <span className="ndc-backup-label">{t('backups.automatic')}<CalmeInfo text={t('backups.automaticHint')} /></span>
            <CalmeSegmented
              label={t('backups.automatic')}
              value={settings.backupSchedule}
              options={[{ value: 'off', label: t('backups.off') }, { value: 'daily', label: t('backups.daily') }, { value: 'weekly', label: t('backups.weekly') }]}
              onChange={value => { if (!demo) void change({ backupSchedule: value }); }}
            />
          </div>
          <div className={`ndc-backup-field ${settings.backupSchedule === 'off' ? 'is-off' : ''}`}>
            <span className="ndc-backup-label">{t('backups.keep')}<CalmeInfo text={t('backups.keepHint')} /></span>
            <div className="ndc-backup-keep">
              <CustomSelect
                ariaLabel={t('backups.keep')}
                value={String(settings.backupKeep)}
                options={KEEP.map(count => ({ value: String(count), label: t('backups.keepCount', { count }) }))}
                onChange={value => void change({ backupKeep: Number(value) })}
              />
            </div>
          </div>
          <div className="ndc-backup-field">
            <span className="ndc-backup-label">{t('backups.next')}</span>
            <span className="ndc-backup-value">{nextBackup === null ? t('backups.nextOff') : nextBackup <= now ? t('backups.nextSoon') : relative(nextBackup)}</span>
          </div>
        </div>

        {error && <p className="ndc-dialog-hint" role="alert" style={{ color: 'var(--nd-red)' }}>{error}</p>}

        {!demo && (
          <>
            <div className="ndc-backup-list-head">{t('backups.saved', { count: backups.length })}</div>
            {backups.length === 0 ? <div className="ndc-int-empty">{t('backups.empty')}</div> : (
              <ul className="ndc-backups">
                {backups.map(item => (
                  <li key={item.name} className="ndc-backup">
                    <span className="ndc-task-icon" aria-hidden="true"><Archive size={14} /></span>
                    <span className="ndc-backup-text">
                      <span className="ndc-backup-date">
                        {new Date(item.createdAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}
                        <span className="ndc-tag">{item.automatic ? t('backups.auto') : t('backups.manual')}</span>
                      </span>
                      <span className="ndc-backup-sub">{size(item.size)} · {relative(item.createdAt)}</span>
                    </span>
                    <a className="ndc-icon-button" href={`/api/backups/${encodeURIComponent(item.name)}`} download title={t('backups.download')} aria-label={[t('backups.download'), item.name].join(' · ')}><Download size={14} /></a>
                    <button type="button" className="ndc-icon-button ndc-danger" onClick={() => setRemoving(item)} title={t('Supprimer')} aria-label={[t('Supprimer'), item.name].join(' · ')}><Trash2 size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <div className="ndc-restore">
          <div className="ndc-restore-head">
            <span className="ndc-restore-title">{t('backups.restoreTitle')}</span>
            <a className="ndc-link" href={docsUrl(language, 'operations/restore')} target="_blank" rel="noopener noreferrer">{t('backups.restoreDocs')} <ExternalLink size={11} /></a>
          </div>
          <ol className="ndc-restore-steps">
            <li>{t('backups.restoreStep1')}</li>
            <li>{t('backups.restoreStep2')}</li>
            <li>{t('backups.restoreStep3')} <code>{RESTORE_COMMAND}</code></li>
          </ol>
        </div>
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

function State({ run }: { run: TaskRun | null | undefined }) {
  const { t } = useI18n();
  if (!run) return <span className="ndc-int-state ndc-task-state">{t('tasks.notYet')}</span>;
  return (
    <span className={`ndc-int-state ndc-task-state ${!run.ok ? 'is-error' : run.partial ? 'is-partial' : 'is-ok'}`} title={run.ok ? undefined : run.note}>
      <span className="ndc-int-state-dot" />{!run.ok ? t('tasks.failed') : run.partial ? t('tasks.partial') : t('tasks.ok')}
    </span>
  );
}

function Rhythm({ label, value, options, onChange }: { label: string; value: number; options: Array<{ value: string; label: string }>; onChange: (value: number) => void }) {
  return (
    <label className="ndc-task-select">
      <span>{label}</span>
      <CustomSelect ariaLabel={label} value={String(value)} options={options} onChange={next => onChange(Number(next))} />
    </label>
  );
}
