import { demoFetch } from '@/lib/demoTransport';
import React, { useState, useEffect, useMemo } from 'react';
import { Search, ShieldAlert, CheckCircle, AlertTriangle, RefreshCw, HelpCircle, Network } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';
import { useI18n } from '@/i18n/I18nProvider';
import { WidgetHeaderActions } from '@/components/widgets/WidgetHeaderActions';

import { buildPortInventory, type PortEntry } from './portInventory';

/** Where a port was found, in the interface language: the service category, the Docker host, or both. */
function sourceLabel(item: PortEntry, t: (key: string) => string): string {
  if (item.origins.includes('service')) {
    const label = item.secondary ? t('ports.secondaryAddress') : item.category ?? 'NasDash';
    return item.origins.includes('docker') ? `${label} · Docker` : label;
  }
  return item.dockerHost ? `Docker · ${item.dockerHost}` : 'Docker';
}

export function NetworkSidebar({ showSensitive = true }: { showSensitive?: boolean }) {
  const { t } = useI18n();
  const { config, showSecretSections } = useConfig();
  const [dockerContainers, setDockerContainers] = useState<any[]>([]);
  const [loadingDocker, setLoadingDocker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Port checker state
  const [checkPortInput, setCheckPortInput] = useState('');
  const [checkIpInput, setCheckIpInput] = useState('');
  
  // Port generator state
  const [genPortInput, setGenPortInput] = useState('');
  const [genIpInput, setGenIpInput] = useState('');

  // Fetch docker containers ports from all hosts in parallel
  const fetchDockerPorts = async () => {
    const hosts = config?.dockerHosts || [];
    if (hosts.length === 0) return;
    setLoadingDocker(true);
    try {
      const promises = hosts.map(async (host) => {
        try {
          const res = await demoFetch(`/api/docker/${host.id}/containers?all=true`);
          if (res.ok) {
            const data = await res.json();
            return (data || []).map((container: any) => ({
              ...container,
              hostName: host.name,
              hostUrl: host.url
            }));
          }
        } catch (err) {
          console.error(`Failed to fetch docker containers for host ${host.name}:`, err);
        }
        return [];
      });

      const results = await Promise.all(promises);
      const flattened = results.flat();
      setDockerContainers(flattened);
    } catch (e) {
      console.error('Failed to load docker ports:', e);
    } finally {
      setLoadingDocker(false);
    }
  };

  const dockerHostsSerialized = JSON.stringify(config?.dockerHosts || []);
  useEffect(() => {
    if (config?.dockerHosts) {
      fetchDockerPorts();
    }
  }, [dockerHostsSerialized]);

  // Aggregate all ports from NasDash services config and Docker containers
  const activePorts = useMemo((): PortEntry[] => {
    return buildPortInventory({
      categories: config?.categories || [],
      containers: dockerContainers,
      showSecretSections,
    });
  }, [config?.categories, dockerContainers, showSecretSections]);

  // Filtered active ports
  const filteredPorts = useMemo(() => {
    return activePorts.filter(item => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.port.toString().includes(q) ||
        item.serviceName.toLowerCase().includes(q) ||
        item.ip.toLowerCase().includes(q) ||
        sourceLabel(item, t).toLowerCase().includes(q)
      );
    });
  }, [activePorts, searchQuery]);

  // Port Checker computation
  const checkResult = useMemo(() => {
    const portToCheck = parseInt(checkPortInput, 10);
    if (isNaN(portToCheck)) return null;

    const targetIp = checkIpInput.trim().toLowerCase();
    
    // Find collisions
    const collisions = activePorts.filter(item => {
      const matchPort = item.port === portToCheck;
      if (!matchPort) return false;
      if (!targetIp) return true; // check globally if no target IP
      return (
        item.ip.toLowerCase() === targetIp ||
        targetIp === '0.0.0.0' ||
        item.ip === '0.0.0.0'
      );
    });

    return {
      available: collisions.length === 0,
      collisions
    };
  }, [activePorts, checkPortInput, checkIpInput]);

  // Port Generator suggestions
  const suggestions = useMemo(() => {
    const basePort = parseInt(genPortInput, 10);
    if (isNaN(basePort) || basePort <= 0 || basePort > 65535) return [];

    const targetIp = genIpInput.trim().toLowerCase();
    const list: number[] = [];
    let candidate = basePort;

    while (list.length < 3 && candidate <= 65535) {
      const taken = activePorts.some(item => {
        if (item.port !== candidate) return false;
        if (!targetIp) return true;
        return (
          item.ip.toLowerCase() === targetIp ||
          targetIp === '0.0.0.0' ||
          item.ip === '0.0.0.0'
        );
      });

      if (!taken) {
        list.push(candidate);
      }
      candidate++;
    }

    return list;
  }, [activePorts, genPortInput, genIpInput]);


  return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <style>{`
          .nd-ports-list {
            max-height: 380px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 2px;
            padding-right: 2px;
          }
          .nd-ports-list::-webkit-scrollbar {
            width: 4px;
          }
          .nd-ports-list::-webkit-scrollbar-track {
            background: transparent;
          }
          .nd-ports-list::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.08);
            border-radius: 2px;
          }
          .nd-ports-list::-webkit-scrollbar-thumb:hover {
            background: var(--nd-accent-dim);
          }

          .nd-port-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 5px 8px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.03);
            transition: all 0.2s ease;
            gap: 8px;
            border-radius: calc(var(--nd-card-radius) * 0.4);
            cursor: default;
          }
          .nd-port-row:hover {
            background: rgba(255, 255, 255, 0.03);
          }
          .nd-port-group {
            padding: 10px 0 4px;
            font-size: 0.56rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--nd-text-dimmed);
          }
          .nd-port-row--stopped {
            opacity: 0.6;
          }
          .nd-port-row:last-child {
            border-bottom: none;
          }

          .nd-port-tag {
            font-family: 'JetBrains Mono', 'Fira Code', monospace;
            font-size: 0.64rem;
            font-weight: 700;
            color: var(--nd-accent);
            background: var(--nd-accent-glow);
            padding: 1px 5px;
            border-radius: 4px;
            border: 1px solid rgba(0, 229, 255, 0.12);
            flex-shrink: 0;
          }
          
          .nd-port-protocol {
            font-size: 0.52rem;
            font-weight: 700;
            color: var(--nd-text-muted);
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid var(--nd-card-border);
            padding: 1px 4px;
            border-radius: 3px;
            text-transform: uppercase;
            flex-shrink: 0;
          }
          .nd-port-protocol--exited {
            color: var(--nd-red);
            background: rgba(248, 81, 73, 0.06);
            border-color: rgba(248, 81, 73, 0.15);
          }
        `}</style>
        
        {/* 1. PORTS ASSIGNMENTS */}
        <div className="nd-sidebar-card">
          <div className="nd-section-title" style={{ marginBottom: 10 }}>
            <Network size={12} style={{ color: 'var(--nd-accent)' }} />
            <span>{t("Ports du Réseau")}</span>
            {/* In edit mode this joins the widget's controls, on this same line. */}
            <span style={{ marginLeft: 'auto', display: 'inline-flex' }}>
              <WidgetHeaderActions>
                <button
                  className="nd-action-icon"
                  onClick={fetchDockerPorts}
                  disabled={loadingDocker}
                  title={t("Rafraîchir")}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2 }}
                >
                  <RefreshCw size={11} className={loadingDocker ? 'nd-spin' : ''} style={{ color: 'var(--nd-text-muted)' }} />
                </button>
              </WidgetHeaderActions>
            </span>
          </div>
  
          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <Search size={11} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--nd-text-dimmed)', pointerEvents: 'none' }} />
            <input
              className="nd-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t("Rechercher port, IP, nom...")}
              style={{ paddingLeft: 26, fontSize: '0.68rem', height: 26 }}
            />
          </div>
  
          {/* Ports list container */}
          <div className="nd-ports-list">
            {filteredPorts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '12px 0', fontSize: '0.65rem', color: 'var(--nd-text-dimmed)' }}>
                {searchQuery ? t("Aucun port correspondant") : t("Aucun port actif détecté")}
              </div>
            ) : (
              filteredPorts.map((item, i) => (
                <React.Fragment key={i}>
                {/* Stopped containers come last, under their own heading. */}
                {item.stopped && !filteredPorts[i - 1]?.stopped && <div className="nd-port-group">{t('ports.stopped')}</div>}
                <div className={`nd-port-row ${item.stopped ? 'nd-port-row--stopped' : ''}`}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="nd-port-tag">
                        {!showSensitive ? '•••' : item.port}
                      </span>
                      <span style={{ fontWeight: 600, color: 'var(--nd-text)', fontSize: '0.68rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.serviceName}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.58rem', color: 'var(--nd-text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontFamily: 'monospace', opacity: 0.85 }}>{!showSensitive ? '•••' : item.ip}</span>
                      <span style={{ opacity: 0.3 }}>•</span>
                      <span style={{ opacity: 0.65 }}>{sourceLabel(item, t)}</span>
                    </div>
                  </div>
                  <span className={`nd-port-protocol ${item.stopped ? 'nd-port-protocol--exited' : ''}`}>
                    {item.type}
                  </span>
                </div>
                </React.Fragment>
              ))
            )}
          </div>
        </div>
  
        {/* 2. PORT AVAILABILITY CHECKER */}
        <div className="nd-sidebar-card">
          <div className="nd-section-title" style={{ marginBottom: 8 }}>
            <ShieldAlert size={12} style={{ color: 'var(--nd-orange)' }} />
            <span>{t("Vérificateur de Disponibilité")}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <input
            className="nd-input"
            type="number"
            min="1"
            max="65535"
            placeholder={t("Port (ex: 8080)")}
            value={checkPortInput}
            onChange={e => setCheckPortInput(e.target.value)}
            style={{ flex: 1, fontSize: '0.68rem', height: 26 }}
          />
          <input
            className="nd-input"
            placeholder={t("IP (opt. ex: 192.168.1.50)")}
            value={checkIpInput}
            onChange={e => setCheckIpInput(e.target.value)}
            style={{ flex: 1.2, fontSize: '0.68rem', height: 26 }}
          />
        </div>

        {/* Checker Results */}
        {checkResult && (
          <div 
            className={`ndc-check ${checkResult.available ? 'ndc-check--free' : 'ndc-check--busy'}`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
              {checkResult.available ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
              <span>
                {checkResult.available ? t("Port disponible !") : t("Port déjà utilisé")}
              </span>
            </div>
            {!checkResult.available && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4, color: 'var(--nd-text)', fontSize: '0.6rem' }}>
                {checkResult.collisions.map((item, idx) => (
                  <div key={idx} style={{ opacity: 0.85 }}>
                    {t("Occupé par")} <strong style={{ color: 'var(--nd-accent)' }}>{item.serviceName}</strong> {t("sur")} <code>{!showSensitive ? '•••' : item.ip}</code> ({sourceLabel(item, t)})
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. PORT GENERATOR */}
      <div className="nd-sidebar-card">
        <div className="nd-section-title" style={{ marginBottom: 8 }}>
          <HelpCircle size={12} style={{ color: 'var(--nd-purple)' }} />
          <span>{t("Générateur de Port Libre")}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <input
            className="nd-input"
            type="number"
            min="1"
            max="65535"
            placeholder={t("Port de départ")}
            value={genPortInput}
            onChange={e => setGenPortInput(e.target.value)}
            style={{ flex: 1, fontSize: '0.68rem', height: 26 }}
          />
          <input
            className="nd-input"
            placeholder={t("IP cible (opt.)")}
            value={genIpInput}
            onChange={e => setGenIpInput(e.target.value)}
            style={{ flex: 1.2, fontSize: '0.68rem', height: 26 }}
          />
        </div>

        {/* Suggestion list */}
        {suggestions.length > 0 && (
          <div>
            <div style={{ fontSize: '0.58rem', color: 'var(--nd-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {t("Suggestions de ports libres :")}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {suggestions.map((p, i) => (
                <button
                  key={i}
                  className="ndc-suggestion"
                  onClick={() => {
                    setCheckPortInput(String(p));
                    if (genIpInput) setCheckIpInput(genIpInput);
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
