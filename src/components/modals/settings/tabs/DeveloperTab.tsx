import React, { useState } from 'react';
import { Cpu, Code, ExternalLink, RotateCcw, Save } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { CUSTOM_CSS_MAX_LENGTH, isCustomCssSafeMode } from '@/lib/sanitizeCss';
import { SettingsAccordion } from '../shared/SettingsAccordion';
import { ToggleSwitch } from '../shared/ToggleSwitch';
import { useI18n } from '@/i18n/I18nProvider';

export function DeveloperTab() {
  const { t, locale } = useI18n();
  const { config, updateConfig } = useConfig();
  
  const [openAccordions, setOpenAccordions] = useState<string[]>(['perf']);
  const [customCss, setCustomCss] = useState(() => config?.settings?.customCss ?? '');
  const [cssSaveStatus, setCssSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const customCssSafeMode = typeof window !== 'undefined' && isCustomCssSafeMode(window.location.search);

  const toggleAccordion = (id: string) => {
    setOpenAccordions(prev => prev.includes(id) ? [] : [id]);
  };

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SettingsAccordion
        title={t("Performance Monitor")}
        description={t("Statistiques en temps réel sur les performances")}
        icon={<Cpu size={18} />}
        isOpen={openAccordions.includes('perf')}
        onToggle={() => toggleAccordion('perf')}
      >
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 12px', borderRadius: 'var(--nd-card-radius)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <ToggleSwitch 
            checked={!!config?.settings?.enablePerfMonitor}
            onChange={async (val) => { await updateConfig({ enablePerfMonitor: val }); }}
            label={t("Activer le Performance Monitor")}
            sublabel={t("Désactivé par défaut pour économiser les ressources client.")}
          />
        </div>
      </SettingsAccordion>

      <SettingsAccordion
        title={t("Custom CSS")}
        description={t("Code CSS personnalisé pour l'interface globale")}
        icon={<Code size={18} />}
        isOpen={openAccordions.includes('css')}
        onToggle={() => toggleAccordion('css')}
      >
        <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>{t("Surcharge CSS personnalisée")}</h4>
        <p style={{ margin: '4px 0 10px 0', fontSize: '0.7rem', color: 'var(--nd-text-muted)' }}>
          {t("Personnalisez l&apos;interface avec les variables publiques NasDash. Les scripts, imports distants et URL dangereuses sont neutralisés.")}
        </p>
        {customCssSafeMode && (
          <div role="status" style={{ padding: '10px 12px', marginBottom: 10, borderRadius: 'var(--nd-card-radius)', border: '1px solid var(--nd-yellow)', background: 'color-mix(in srgb, var(--nd-yellow) 8%, transparent)', color: 'var(--nd-text)', fontSize: '0.7rem', lineHeight: 1.5 }}>
            <strong>{t("Mode de secours actif.")}</strong> {t('developer.safeCssHint', { parameter: '?safe-css=1' })}
          </div>
        )}
        <textarea
          className="nd-input"
          rows={10}
          maxLength={CUSTOM_CSS_MAX_LENGTH}
          spellCheck={false}
          aria-label={t("CSS personnalisé")}
          placeholder={":root {\n  --nd-accent: #7c3aed;\n  --nd-card-radius: 16px;\n}"}
          value={customCss}
          onChange={(e) => {
            setCustomCss(e.target.value);
            setCssSaveStatus('idle');
          }}
          style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.7rem', resize: 'vertical', minHeight: '180px', marginBottom: '6px' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <span style={{ fontSize: '0.64rem', color: 'var(--nd-text-dimmed)', fontVariantNumeric: 'tabular-nums' }}>
            {customCss.length.toLocaleString(locale)} / {CUSTOM_CSS_MAX_LENGTH.toLocaleString(locale)} {t("caractères")}
          </span>
          <span aria-live="polite" style={{ fontSize: '0.68rem', color: cssSaveStatus === 'error' ? 'var(--nd-red)' : cssSaveStatus === 'saved' ? 'var(--nd-green)' : 'var(--nd-text-muted)' }}>
            {cssSaveStatus === 'saving' && t("Enregistrement…")}
            {cssSaveStatus === 'saved' && t("CSS enregistré.")}
            {cssSaveStatus === 'error' && t("Échec de l’enregistrement. La dernière version persistée a été restaurée.")}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <a className="nd-btn" href="https://github.com/lucas-lepajollec/nasdash/blob/main/CUSTOM_CSS.md" target="_blank" rel="noreferrer" style={{ padding: '6px 12px', fontSize: '0.72rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {t("Guide et exemples")} <ExternalLink size={12} />
          </a>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="nd-btn" onClick={handleResetCss} disabled={cssSaveStatus === 'saving' || customCss.length === 0} style={{ padding: '6px 12px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <RotateCcw size={12} /> {t("Réinitialiser")}
            </button>
            <button className="nd-btn nd-btn-accent" onClick={handleSaveCss} disabled={cssSaveStatus === 'saving'} style={{ padding: '6px 14px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Save size={12} /> {t("Appliquer le CSS")}
            </button>
          </div>
        </div>
      </SettingsAccordion>
    </div>
  );
}
