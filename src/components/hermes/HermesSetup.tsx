'use client';

import { useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { Settings, Plug, CheckCircle, XCircle, Loader } from 'lucide-react';

export default function HermesSetup({ onComplete }: { onComplete: () => void }) {
  const { refresh } = useConfig();
  const [dataPath, setDataPath] = useState('/appdata/hermes');
  const [containerName, setContainerName] = useState('hermes-agent');
  const [dockerProxy, setDockerProxy] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Save settings first, then test
      await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'settings',
          hermesDataPath: dataPath,
          hermesContainerName: containerName,
          hermesDockerProxy: dockerProxy || undefined,
          hermesUrl: apiUrl || undefined,
          hermesApiKey: apiKey || undefined,
        }),
      });

      const res = await fetch('/api/hermes/status');
      const data = await res.json();

      if (data.container?.running) {
        setTestResult({ ok: true, message: `Conteneur actif • Image: ${data.container.image || 'n/a'}` });
      } else if (data.container) {
        setTestResult({ ok: false, message: `Conteneur trouvé mais état: ${data.container.state}` });
      } else {
        setTestResult({ ok: false, message: 'Conteneur introuvable via le proxy Docker' });
      }
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message });
    }
    setTesting(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'settings',
        hermesDataPath: dataPath,
        hermesContainerName: containerName,
        hermesDockerProxy: dockerProxy || undefined,
        hermesUrl: apiUrl || undefined,
        hermesApiKey: apiKey || undefined,
      }),
    });
    await refresh();
    setSaving(false);
    onComplete();
  };

  return (
    <div className="flex flex-col items-center justify-center h-full animate-in fade-in duration-500">
      <div className="nd-modal" style={{ maxWidth: 520, width: '100%' }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
            <Plug size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 700 }}>Connexion Hermes Agent</h3>
            <p style={{ fontSize: '0.65rem', color: 'var(--nd-text-muted)' }}>Configurez l'accès à votre agent IA</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Data path */}
          <div>
            <label className="nd-label mb-2 block">📁 Chemin des données Hermes</label>
            <input className="nd-input w-full" value={dataPath} onChange={e => setDataPath(e.target.value)}
              placeholder="/appdata/hermes" />
            <p style={{ fontSize: '0.6rem', color: 'var(--nd-text-dimmed)', marginTop: 4 }}>
              Le volume monté contenant config.yaml, skills/, cron/, etc.
            </p>
          </div>

          {/* Container name */}
          <div>
            <label className="nd-label mb-2 block">🐳 Nom du conteneur</label>
            <input className="nd-input w-full" value={containerName} onChange={e => setContainerName(e.target.value)}
              placeholder="hermes-agent" />
          </div>

          {/* Docker proxy (optional) */}
          <div>
            <label className="nd-label mb-2 block">🔌 Docker Proxy URL <span style={{ opacity: 0.5 }}>(optionnel)</span></label>
            <input className="nd-input w-full" value={dockerProxy} onChange={e => setDockerProxy(e.target.value)}
              placeholder="Auto-détecté depuis les hosts Docker" />
            <p style={{ fontSize: '0.6rem', color: 'var(--nd-text-dimmed)', marginTop: 4 }}>
              Laisser vide pour utiliser le proxy Docker déjà configuré dans NasDash.
            </p>
          </div>

          {/* API URL (optional — for chat feature later) */}
          <div>
            <label className="nd-label mb-2 block">🌐 URL API Hermes <span style={{ opacity: 0.5 }}>(optionnel, pour le chat)</span></label>
            <input className="nd-input w-full" value={apiUrl} onChange={e => setApiUrl(e.target.value)}
              placeholder="http://hermes-agent:8642" />
          </div>

          {/* API Key */}
          {apiUrl && (
            <div>
              <label className="nd-label mb-2 block">🔑 API Key</label>
              <input className="nd-input w-full" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                placeholder="API_SERVER_KEY" />
            </div>
          )}

          {/* Test result */}
          {testResult && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-xs font-medium ${testResult.ok ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              {testResult.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
              {testResult.message}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button className="nd-btn" onClick={handleTest} disabled={testing || !dataPath.trim()}>
              {testing ? <Loader size={14} className="animate-spin" /> : <Settings size={14} />}
              Tester
            </button>
            <button className="nd-btn nd-btn-accent px-6" onClick={handleSave} disabled={saving || !dataPath.trim()}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
