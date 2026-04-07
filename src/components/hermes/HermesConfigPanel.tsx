'use client';

import { useState, useEffect, useCallback } from 'react';
import { useHermesConfig, useHermesStatus } from '@/hooks/useHermes';
import {
  Save, RotateCcw, RefreshCw, ChevronDown, AlertTriangle,
  CheckCircle, XCircle, Loader, Cpu, Globe, Terminal, Shield,
  Settings, Code, Eye, EyeOff
} from 'lucide-react';

// ============================================================
// Known model providers for the dropdown
// ============================================================
const KNOWN_PROVIDERS = [
  { id: 'ollama', label: 'Ollama (Local)', prefix: 'ollama/', placeholder: 'qwen3.5:9b' },
  { id: 'openrouter', label: 'OpenRouter', prefix: 'openrouter/', placeholder: 'anthropic/claude-3.5-sonnet' },
  { id: 'anthropic', label: 'Anthropic', prefix: 'anthropic/', placeholder: 'claude-opus-4' },
  { id: 'openai', label: 'OpenAI', prefix: 'openai/', placeholder: 'gpt-4o' },
  { id: 'nous', label: 'Nous Portal', prefix: 'nous/', placeholder: 'hermes-3-llama-3.1-405b' },
  { id: 'custom', label: 'Custom', prefix: '', placeholder: 'provider/model-name' },
];

const TERMINAL_BACKENDS = [
  { id: 'local', label: 'Local', desc: 'Commandes sur la machine hôte' },
  { id: 'docker', label: 'Docker', desc: 'Sandbox Docker isolé' },
  { id: 'ssh', label: 'SSH', desc: 'Serveur distant via SSH' },
];

// ============================================================
// Helper: parse model string into provider + model
// ============================================================
function parseModel(model: string) {
  for (const p of KNOWN_PROVIDERS) {
    if (p.prefix && model.startsWith(p.prefix)) {
      return { provider: p.id, model: model.slice(p.prefix.length) };
    }
  }
  return { provider: 'custom', model };
}

function buildModel(provider: string, model: string) {
  const p = KNOWN_PROVIDERS.find(x => x.id === provider);
  if (!p || !p.prefix) return model;
  return `${p.prefix}${model}`;
}

// ============================================================
// Status Badge component
// ============================================================
function StatusBadge({ status }: { status: any }) {
  if (!status) return null;

  const container = status.container;
  const isRunning = container?.running;

  return (
    <div className="nd-hermes-status-bar">
      <div className={`nd-hermes-status-dot ${isRunning ? 'nd-hermes-status-dot--ok' : 'nd-hermes-status-dot--error'}`} />
      <span>{isRunning ? 'En ligne' : container?.state || 'Hors ligne'}</span>
      {isRunning && container?.uptime && (
        <span style={{ color: 'var(--nd-text-dimmed)', fontSize: '0.62rem' }}>
          · Uptime {formatUptime(container.uptime)}
        </span>
      )}
      {container?.image && (
        <span style={{ color: 'var(--nd-text-dimmed)', fontSize: '0.62rem', fontFamily: 'monospace' }}>
          · {container.image}
        </span>
      )}
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}j ${Math.floor((seconds % 86400) / 3600)}h`;
}

// ============================================================
// MAIN CONFIG PANEL
// ============================================================
export default function HermesConfigPanel() {
  const { config, loading, saving, error, saveConfig, restartContainer, refresh } = useHermesConfig();
  const { status, refresh: refreshStatus } = useHermesStatus();

  // Local form state
  const [modelProvider, setModelProvider] = useState('ollama');
  const [modelName, setModelName] = useState('');
  const [terminalBackend, setTerminalBackend] = useState('local');
  const [compressionEnabled, setCompressionEnabled] = useState(true);
  const [maxTokens, setMaxTokens] = useState(0);
  const [temp, setTemp] = useState(0.7);
  const [rawMode, setRawMode] = useState(false);
  const [rawYaml, setRawYaml] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [restartStatus, setRestartStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [restarting, setRestarting] = useState(false);

  // Populate form from loaded config
  useEffect(() => {
    if (!config?.config) return;
    const c = config.config;

    const parsed = parseModel(c.model || '');
    setModelProvider(parsed.provider);
    setModelName(parsed.model);
    setTerminalBackend(c.terminal?.backend || 'local');
    setCompressionEnabled(c.compression?.enabled !== false);
    setMaxTokens(c.max_tokens || 0);
    setTemp(c.temperature ?? 0.7);
    setRawYaml(config.raw || '');
    setHasChanges(false);
  }, [config]);

  const markChanged = useCallback(() => setHasChanges(true), []);

  // Save handler
  const handleSave = async () => {
    if (rawMode) {
      // Save raw YAML
      const res = await fetch('/api/hermes/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: rawYaml }),
      });
      if (res.ok) {
        setHasChanges(false);
        await refresh();
      }
      return;
    }

    // Build config object from form
    const newConfig = { ...(config?.config || {}) };
    newConfig.model = buildModel(modelProvider, modelName);

    if (!newConfig.terminal) newConfig.terminal = {};
    newConfig.terminal.backend = terminalBackend;

    if (!newConfig.compression) newConfig.compression = {};
    newConfig.compression.enabled = compressionEnabled;

    if (maxTokens > 0) newConfig.max_tokens = maxTokens;
    else delete newConfig.max_tokens;

    newConfig.temperature = temp;

    const ok = await saveConfig(newConfig);
    if (ok) setHasChanges(false);
  };

  // Restart handler
  const handleRestart = async () => {
    setRestarting(true);
    setRestartStatus(null);
    const result = await restartContainer();
    setRestartStatus(result);
    setRestarting(false);
    // Refresh status after a short delay
    setTimeout(refreshStatus, 3000);
  };

  // Save + Restart
  const handleSaveAndRestart = async () => {
    await handleSave();
    await handleRestart();
  };

  if (loading) {
    return (
      <div className="nd-hermes-loading">
        <Loader size={20} className="animate-spin" style={{ color: 'var(--nd-accent)' }} />
        <span>Chargement de la configuration…</span>
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="nd-hermes-error">
        <AlertTriangle size={20} />
        <div>
          <strong>Impossible de lire la config Hermes</strong>
          <p>{error}</p>
          <p style={{ fontSize: '0.6rem', color: 'var(--nd-text-dimmed)', marginTop: 8 }}>
            Vérifiez que le volume est monté et que le chemin hermesDataPath est correct dans les paramètres.
          </p>
        </div>
      </div>
    );
  }

  const currentProvider = KNOWN_PROVIDERS.find(p => p.id === modelProvider) || KNOWN_PROVIDERS[5];

  return (
    <div className="nd-hermes-config">
      {/* Header bar */}
      <div className="nd-hermes-config-header">
        <div className="flex items-center gap-3">
          <Settings size={16} style={{ color: 'var(--nd-accent)' }} />
          <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Configuration</span>
          <StatusBadge status={status} />
        </div>

        <div className="flex items-center gap-2">
          {/* Raw/Visual toggle */}
          <button
            className={`nd-btn ${rawMode ? 'nd-btn-active' : ''}`}
            onClick={() => setRawMode(!rawMode)}
            title={rawMode ? 'Mode visuel' : 'Mode YAML brut'}
          >
            <Code size={13} />
          </button>
          <button className="nd-btn" onClick={refresh} title="Recharger">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Restart result toast */}
      {restartStatus && (
        <div className={`nd-hermes-toast ${restartStatus.ok ? 'nd-hermes-toast--ok' : 'nd-hermes-toast--error'}`}>
          {restartStatus.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
          {restartStatus.message}
          <button onClick={() => setRestartStatus(null)} style={{ marginLeft: 'auto', opacity: 0.6 }}>✕</button>
        </div>
      )}

      {rawMode ? (
        /* ========== RAW YAML EDITOR ========== */
        <div className="nd-hermes-raw-editor">
          <textarea
            className="nd-hermes-yaml-textarea"
            value={rawYaml}
            onChange={e => { setRawYaml(e.target.value); markChanged(); }}
            spellCheck={false}
          />
        </div>
      ) : (
        /* ========== VISUAL FORM ========== */
        <div className="nd-hermes-config-panels">
          {/* ── Model Section ── */}
          <div className="nd-hermes-panel">
            <div className="nd-hermes-panel-title">
              <Cpu size={14} /> Modèle IA
            </div>
            <div className="nd-hermes-field-row">
              <div className="nd-hermes-field" style={{ flex: '0 0 180px' }}>
                <label className="nd-label">Provider</label>
                <select
                  className="nd-input"
                  value={modelProvider}
                  onChange={e => { setModelProvider(e.target.value); markChanged(); }}
                >
                  {KNOWN_PROVIDERS.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className="nd-hermes-field" style={{ flex: 1 }}>
                <label className="nd-label">Modèle</label>
                <input
                  className="nd-input w-full"
                  value={modelName}
                  onChange={e => { setModelName(e.target.value); markChanged(); }}
                  placeholder={currentProvider.placeholder}
                />
              </div>
            </div>
            <div className="nd-hermes-field-hint">
              Modèle complet : <code>{buildModel(modelProvider, modelName)}</code>
            </div>
          </div>

          {/* ── Parameters Section ── */}
          <div className="nd-hermes-panel">
            <div className="nd-hermes-panel-title">
              <Settings size={14} /> Paramètres
            </div>
            <div className="nd-hermes-field-row">
              <div className="nd-hermes-field">
                <label className="nd-label">Température</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range" min="0" max="2" step="0.1"
                    value={temp}
                    onChange={e => { setTemp(parseFloat(e.target.value)); markChanged(); }}
                    className="flex-1"
                  />
                  <span className="nd-hermes-field-value">{temp}</span>
                </div>
              </div>
              <div className="nd-hermes-field">
                <label className="nd-label">Max Tokens <span style={{ opacity: 0.5 }}>(0 = auto)</span></label>
                <input
                  type="number" className="nd-input w-full"
                  value={maxTokens} min={0} step={1024}
                  onChange={e => { setMaxTokens(parseInt(e.target.value) || 0); markChanged(); }}
                />
              </div>
            </div>
          </div>

          {/* ── Terminal Backend ── */}
          <div className="nd-hermes-panel">
            <div className="nd-hermes-panel-title">
              <Terminal size={14} /> Terminal Backend
            </div>
            <div className="nd-hermes-backend-grid">
              {TERMINAL_BACKENDS.map(b => (
                <button
                  key={b.id}
                  className={`nd-hermes-backend-card ${terminalBackend === b.id ? 'nd-hermes-backend-card--active' : ''}`}
                  onClick={() => { setTerminalBackend(b.id); markChanged(); }}
                >
                  <strong>{b.label}</strong>
                  <span>{b.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Compression ── */}
          <div className="nd-hermes-panel">
            <div className="nd-hermes-panel-title">
              <Shield size={14} /> Options
            </div>
            <label className="nd-hermes-toggle">
              <input
                type="checkbox" checked={compressionEnabled}
                onChange={e => { setCompressionEnabled(e.target.checked); markChanged(); }}
              />
              <span className="nd-hermes-toggle-slider" />
              <span>Compression de contexte</span>
            </label>
          </div>
        </div>
      )}

      {/* ── Actions Footer ── */}
      <div className="nd-hermes-config-footer">
        {hasChanges && (
          <div className="nd-hermes-unsaved">
            <AlertTriangle size={12} /> Modifications non sauvegardées
          </div>
        )}
        <div className="flex gap-2" style={{ marginLeft: 'auto' }}>
          <button className="nd-btn" onClick={handleRestart} disabled={restarting} title="Redémarrer sans sauvegarder">
            {restarting
              ? <Loader size={14} className="animate-spin" />
              : <RotateCcw size={14} />}
            Redémarrer
          </button>
          <button className="nd-btn nd-btn-accent" onClick={handleSave} disabled={saving || !hasChanges}>
            <Save size={14} />
            Sauvegarder
          </button>
          <button className="nd-btn nd-btn-accent" onClick={handleSaveAndRestart} disabled={saving || restarting || !hasChanges}
            style={{ background: 'var(--nd-green)', borderColor: 'var(--nd-green)', color: '#000' }}>
            <Save size={14} />
            Sauv. & Redémarrer
          </button>
        </div>
      </div>
    </div>
  );
}
