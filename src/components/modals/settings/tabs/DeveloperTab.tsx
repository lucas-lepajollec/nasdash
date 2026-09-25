import React, { useState } from 'react';
import { ExternalLink, RotateCcw } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { CUSTOM_CSS_MAX_LENGTH, isCustomCssSafeMode } from '@/lib/sanitizeCss';
import { useI18n } from '@/i18n/I18nProvider';
import { CalmeHeading, CalmeRow, CalmeSwitch } from '../shared/CalmeControls';

export function DeveloperTab() {
  const { t, locale } = useI18n();
  const { config, updateConfig } = useConfig();
  
  const [customCss, setCustomCss] = useState(() => config?.settings?.customCss ?? '');
  const [cssSaveStatus, setCssSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const customCssSafeMode = typeof window !== 'undefined' && isCustomCssSafeMode(window.location.search);

  const handleSaveCss = async () => {
    setCssSaveStatus('saving');
    const saved = await updateConfig({ customCss });
    setCssSaveStatus(saved ? 'saved' : 'error');
  };

  const handleResetCss = async () => {
    const previousCss = customCss;
    setCustomCss('');
    setCssSaveStatus('saving');
    const saved = await updateConfig({ customCss: '' });
    if (!saved) setCustomCss(previousCss);
    setCssSaveStatus(saved ? 'saved' : 'error');
  };

  return (
    <div className="ndc-set-page">
      <section className="ndc-set-block">
        <CalmeHeading>{t('settings.calme.performance')}</CalmeHeading>
        <CalmeRow label={t("Activer le Performance Monitor")} info={t("Désactivé par défaut pour économiser les ressources client.")}>
          <CalmeSwitch label={t("Activer le Performance Monitor")} checked={!!config?.settings?.enablePerfMonitor} onChange={async (val) => { await updateConfig({ enablePerfMonitor: val }); }} />
        </CalmeRow>
      </section>
      <section className="ndc-set-block">
        <CalmeHeading
          info={t("Personnalisez l&apos;interface avec les variables publiques NasDash. Les scripts, imports distants et URL dangereuses sont neutralisés.")}
          action={<a className="ndc-text-button" href="https://github.com/lucas-lepajollec/nasdash/blob/main/CUSTOM_CSS.md" target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>{t("Guide et exemples")} <ExternalLink size={11} style={{ verticalAlign: -1 }} /></a>}
        >{t("Custom CSS")}</CalmeHeading>
        {customCssSafeMode && (
          <div role="status" className="ndc-set-row-hint" style={{ marginBottom: 8 }}>
            <strong>{t("Mode de secours actif.")}</strong> {t('developer.safeCssHint', { parameter: '?safe-css=1' })}
          </div>
        )}
        <textarea
          className="nd-input ndc-code"
          rows={12}
          maxLength={CUSTOM_CSS_MAX_LENGTH}
          spellCheck={false}
          aria-label={t("CSS personnalisé")}
          placeholder={":root {\n  --nd-accent: #7c3aed;\n  --nd-card-radius: 16px;\n}"}
          value={customCss}
          onChange={(e) => { setCustomCss(e.target.value); setCssSaveStatus('idle'); }}
        />
        <div className="ndc-code-bar">
          <span className="ndc-set-row-hint">
            {customCss.length.toLocaleString(locale)} / {CUSTOM_CSS_MAX_LENGTH.toLocaleString(locale)}
            <span aria-live="polite" style={{ marginLeft: 10, color: cssSaveStatus === 'error' ? 'var(--nd-red)' : cssSaveStatus === 'saved' ? 'var(--nd-green)' : undefined }}>
              {cssSaveStatus === 'saving' && t("Enregistrement…")}
              {cssSaveStatus === 'saved' && t("CSS enregistré.")}
              {cssSaveStatus === 'error' && t("Échec de l’enregistrement. La dernière version persistée a été restaurée.")}
            </span>
          </span>
          <span style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="nd-btn" onClick={handleResetCss} disabled={cssSaveStatus === 'saving' || customCss.length === 0}><RotateCcw size={12} /> {t("Réinitialiser")}</button>
            <button type="button" className="nd-btn nd-btn-accent" onClick={handleSaveCss} disabled={cssSaveStatus === 'saving'}>{t("Appliquer le CSS")}</button>
          </span>
        </div>
      </section>
    </div>
  );
}
