'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, Plus, Trash2 } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import ConfirmModal from '../../ConfirmModal';
import { CalmeHeading, CalmeSegmented } from '../shared/CalmeControls';
import { AppearanceTab } from './AppearanceTab';

interface MediaFile { name: string; url: string; mtime: number }

/**
 * Media: every file of the dashboard in one place. The wallpaper section
 * (unchanged), then the logo and icon library: upload, where each file is
 * used, its address to paste in a service, and removal.
 */
export function MediaTab({ onOpenThemeGallery }: { onOpenThemeGallery: (tab: 'themes' | 'emojis') => void }) {
  return (
    <>
      <AppearanceTab part="wallpaper" onOpenThemeGallery={onOpenThemeGallery} />
      <LogoLibrary />
    </>
  );
}

function LogoLibrary() {
  const { t } = useI18n();
  const { config } = useConfig();
  const demoMode = config?.demoMode === true;
  const [files, setFiles] = useState<MediaFile[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'unused'>('all');
  const [copied, setCopied] = useState<string | null>(null);
  const [removing, setRemoving] = useState<MediaFile | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/logos');
      const data = await response.json() as { files?: MediaFile[] };
      setFiles(data.files ?? []);
    } catch {
      setFiles([]);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Where each file is used: service logos, secondary-link logos, the header logo.
  const usage = useMemo(() => {
    const uses = new Map<string, string[]>();
    const add = (url: string | undefined, label: string) => {
      if (!url) return;
      uses.set(url, [...(uses.get(url) ?? []), label]);
    };
    for (const category of config?.categories ?? []) {
      for (const service of category.services ?? []) {
        add(service.logo, service.name);
        add(service.secondaryLogo, `${service.name} (${t('services.secondary.open')})`);
      }
    }
    add(config?.settings?.titleLogo, t('settings.calme.header'));
    return uses;
  }, [config?.categories, config?.settings?.titleLogo, t]);

  const upload = async (file: File) => {
    setError('');
    const form = new FormData();
    form.append('file', file);
    form.append('type', 'logo');
    const response = await fetch('/api/upload', { method: 'POST', body: form }).catch(() => null);
    if (!response?.ok) setError(t('media.uploadFailed'));
    await load();
  };

  const remove = async (file: MediaFile) => {
    setError('');
    const response = await fetch(`/api/logos/${encodeURIComponent(file.name)}`, { method: 'DELETE' }).catch(() => null);
    if (!response?.ok) setError(t('media.deleteFailed'));
    await load();
  };

  const copy = async (file: MediaFile) => {
    try {
      await navigator.clipboard.writeText(file.url);
      setCopied(file.url);
      setTimeout(() => setCopied(current => current === file.url ? null : current), 1500);
    } catch {
      setError(t('media.copyFailed'));
    }
  };

  const shown = (files ?? []).filter(file => filter === 'all' || !usage.has(file.url));
  const unused = (files ?? []).filter(file => !usage.has(file.url)).length;

  return (
    <div className="ndc-set-page ndc-media-logos">
      <section className="ndc-set-block">
        <CalmeHeading
          info={demoMode ? t('media.demoHint') : t('media.logosHint')}
          action={!demoMode && (
            <label className="ndc-text-button" style={{ cursor: 'pointer' }}>
              <Plus size={12} style={{ verticalAlign: -2 }} /> {t('media.upload')}
              <input type="file" accept=".png,.svg,.jpg,.jpeg,.webp,.ico" hidden onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ''; }} />
            </label>
          )}
        >{t('media.logos')}</CalmeHeading>
        {files && files.length > 0 && (
          <div className="ndc-media-bar">
            <CalmeSegmented
              label={t('media.filter')}
              value={filter}
              options={[{ value: 'all', label: t('media.all', { count: files.length }) }, { value: 'unused', label: t('media.unused', { count: unused }) }]}
              onChange={setFilter}
            />
          </div>
        )}
        {error && <p className="ndc-dialog-hint" role="alert" style={{ color: 'var(--nd-red)' }}>{error}</p>}
        {files === null ? null : shown.length === 0 ? (
          <div className="ndc-set-empty">{files.length === 0 ? t('media.empty') : t('media.noneUnused')}</div>
        ) : (
          <ul className="ndc-media-grid">
            {shown.map(file => {
              const uses = usage.get(file.url) ?? [];
              return (
                <li key={file.name} className="ndc-media-item">
                  <span className="ndc-media-thumb"><img src={file.url} alt="" loading="lazy" /></span>
                  <span className="ndc-media-text">
                    <span className="ndc-media-name" title={file.name}>{file.name}</span>
                    <span className={`ndc-media-use ${uses.length ? '' : 'is-unused'}`} title={uses.join(', ')}>
                      {uses.length ? t('media.usedBy', { names: uses.slice(0, 2).join(', ') + (uses.length > 2 ? ` +${uses.length - 2}` : '') }) : t('media.notUsed')}
                    </span>
                  </span>
                  <span className="ndc-media-actions">
                    <button type="button" className="ndc-icon-button" onClick={() => void copy(file)} title={t('media.copy')} aria-label={[t('media.copy'), file.name].join(' · ')}>
                      {copied === file.url ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                    {!demoMode && (
                      <button type="button" className="ndc-icon-button ndc-danger" onClick={() => setRemoving(file)} title={t('Supprimer')} aria-label={[t('Supprimer'), file.name].join(' · ')}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <ConfirmModal
        isOpen={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => { if (removing) void remove(removing); }}
        title={t('media.deleteTitle')}
        description={removing && usage.has(removing.url)
          ? t('media.deleteUsed', { names: (usage.get(removing.url) ?? []).join(', ') })
          : t('media.deleteUnused')}
      />
    </div>
  );
}
