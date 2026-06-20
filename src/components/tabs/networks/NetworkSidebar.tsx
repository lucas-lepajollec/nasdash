import React, { useState, useEffect, useMemo } from 'react';
import { Search, ShieldAlert, CheckCircle, AlertTriangle, RefreshCw, HelpCircle, Network } from 'lucide-react';
import { useConfig } from '@/hooks/useConfig';

interface ActivePortItem {
  port: number;
  serviceName: string;
  ip: string;
  source: string;
  type: string; // 'tcp' | 'udp' | 'http' etc.
  status?: string; // e.g. 'running', 'active', 'offline'
}

export function NetworkSidebar() {
  const { config } = useConfig();
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
          const res = await fetch(`/api/docker/${host.id}/containers?all=true`);
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
  const activePorts = useMemo((): ActivePortItem[] => {
    const list: ActivePortItem[] = [];
    const seenKeys = new Set<string>();

    const addPortItem = (item: ActivePortItem) => {
      const key = `${item.ip}:${item.port}-${item.source}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        list.push(item);
      }
    };

    // Helper to parse IP and Port from URL
    const parseUrl = (urlString: string) => {
      if (!urlString) return null;
      try {
        // Handle URL missing http protocol prefix for standard URL constructor
        const urlWithProto = urlString.match(/^https?:\/\//i) ? urlString : `http://${urlString}`;
        const urlObj = new URL(urlWithProto);
        const port = urlObj.port ? parseInt(urlObj.port, 10) : (urlObj.protocol === 'https:' ? 443 : 80);
        return {
          ip: urlObj.hostname,
          port
        };
      } catch (e) {
        // Fallback simple regex parsing for common format "ip:port"
        const match = urlString.match(/^(?:https?:\/\/)?([^:\/]+):(\d+)/i);
        if (match) {
          return {
            ip: match[1],
            port: parseInt(match[2], 10)
          };
        }
        return null;
      }
    };

    // 1. Extract ports from configured NasDash Services
    const categories = config?.categories || [];
    categories.forEach(cat => {
      cat.services.forEach(svc => {
        if (svc.localUrl) {
          const parsed = parseUrl(svc.localUrl);
          if (parsed) {
            addPortItem({
              port: parsed.port,
              serviceName: svc.name,
              ip: parsed.ip,
              source: `Service NasDash (${cat.title})`,
              type: svc.localUrl.startsWith('https') ? 'HTTPS' : 'HTTP'
            });
          }
        }
        if (svc.secondaryUrl) {
          const parsed = parseUrl(svc.secondaryUrl);
          if (parsed) {
            addPortItem({
              port: parsed.port,
              serviceName: svc.name,
              ip: parsed.ip,
              source: `Service NasDash (Secondaire)`,
              type: svc.secondaryUrl.startsWith('https') ? 'HTTPS' : 'HTTP'
            });
          }
        }
      });
    });

    // 2. Extract ports from Docker hosts containers
    dockerContainers.forEach((c) => {
      const containerName = c.names?.[0] || c.id;
      const hostIp = (() => {
        try {
          const u = new URL(c.hostUrl);
          return u.hostname;
        } catch (e) {
          return 'localhost';
        }
      })();

      c.ports?.forEach((p: any) => {
        const publicPort = p.publicPort;
        if (publicPort) {
          addPortItem({
            port: publicPort,
            serviceName: containerName,
            ip: p.ip || hostIp,
            source: `Conteneur Docker (${c.hostName})`,
            type: p.type?.toUpperCase() || 'TCP',
            status: c.state
          });
        }
      });
    });

    return list.sort((a, b) => a.port - b.port);
  }, [config?.categories, dockerContainers]);

  // Filtered active ports
  const filteredPorts = useMemo(() => {
    return activePorts.filter(item => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.port.toString().includes(q) ||
        item.serviceName.toLowerCase().includes(q) ||
        item.ip.toLowerCase().includes(q) ||
        item.source.toLowerCase().includes(q)
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

  const cleanSource = (src: string) => {
    if (src.includes('Conteneur Docker')) {
      const match = src.match(/\(([^)]+)\)/);
      return match ? match[1] : 'Docker';
    }
    if (src.includes('Service NasDash')) {
      const match = src.match(/\(([^)]+)\)/);
      return match ? match[1] : 'NasDash';
    }
    return src;
  };

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
            <span>Ports du Réseau</span>
            <button 
              className="nd-action-icon" 
              onClick={fetchDockerPorts} 
              disabled={loadingDocker}
              title="Rafraîchir"
              style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', padding: 2 }}
            >
              <RefreshCw size={11} className={loadingDocker ? 'nd-spin' : ''} style={{ color: 'var(--nd-text-muted)' }} />
            </button>
          </div>
  
          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 8 }}>
            <Search size={11} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--nd-text-dimmed)', pointerEvents: 'none' }} />
            <input
              className="nd-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Rechercher port, IP, nom..."
              style={{ paddingLeft: 26, fontSize: '0.68rem', height: 26 }}
            />
          </div>
  
          {/* Ports list container */}
          <div className="nd-ports-list">
            {filteredPorts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '12px 0', fontSize: '0.65rem', color: 'var(--nd-text-dimmed)' }}>
                {searchQuery ? 'Aucun port correspondant' : 'Aucun port actif détecté'}
              </div>
            ) : (
              filteredPorts.map((item, i) => (
                <div key={i} className="nd-port-row">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="nd-port-tag">
                        {item.port}
                      </span>
                      <span style={{ fontWeight: 600, color: 'var(--nd-text)', fontSize: '0.68rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.serviceName}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.58rem', color: 'var(--nd-text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontFamily: 'monospace', opacity: 0.85 }}>{item.ip}</span>
                      <span style={{ opacity: 0.3 }}>•</span>
                      <span style={{ opacity: 0.65 }}>{cleanSource(item.source)}</span>
                    </div>
                  </div>
                  <span className={`nd-port-protocol ${item.status === 'exited' ? 'nd-port-protocol--exited' : ''}`}>
                    {item.type}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
  
        {/* 2. PORT AVAILABILITY CHECKER */}
        <div className="nd-sidebar-card">
          <div className="nd-section-title" style={{ marginBottom: 8 }}>
            <ShieldAlert size={12} style={{ color: 'var(--nd-orange)' }} />
            <span>Vérificateur de Disponibilité</span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <input
            className="nd-input"
            type="number"
            min="1"
            max="65535"
            placeholder="Port (ex: 8080)"
            value={checkPortInput}
            onChange={e => setCheckPortInput(e.target.value)}
            style={{ flex: 1, fontSize: '0.68rem', height: 26 }}
          />
          <input
            className="nd-input"
            placeholder="IP (opt. ex: 192.168.1.50)"
            value={checkIpInput}
            onChange={e => setCheckIpInput(e.target.value)}
            style={{ flex: 1.2, fontSize: '0.68rem', height: 26 }}
          />
        </div>

        {/* Checker Results */}
        {checkResult && (
          <div 
            style={{ 
              padding: 8, 
              borderRadius: 'calc(var(--nd-card-radius) * 0.6)', 
              background: checkResult.available ? 'rgba(48, 209, 88, 0.06)' : 'rgba(255, 69, 58, 0.06)',
              border: `1px solid ${checkResult.available ? 'rgba(48, 209, 88, 0.2)' : 'rgba(255, 69, 58, 0.2)'}`,
              fontSize: '0.66rem',
              color: checkResult.available ? 'var(--nd-green)' : 'var(--nd-red)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
              {checkResult.available ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
              <span>
                {checkResult.available ? 'Port disponible !' : 'Port déjà utilisé'}
              </span>
            </div>
            {!checkResult.available && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4, color: 'var(--nd-text)', fontSize: '0.6rem' }}>
                {checkResult.collisions.map((item, idx) => (
                  <div key={idx} style={{ opacity: 0.85 }}>
                    Occupé par <strong style={{ color: 'var(--nd-accent)' }}>{item.serviceName}</strong> sur <code>{item.ip}</code> ({item.source})
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
          <span>Générateur de Port Libre</span>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <input
            className="nd-input"
            type="number"
            min="1"
            max="65535"
            placeholder="Port de départ"
            value={genPortInput}
            onChange={e => setGenPortInput(e.target.value)}
            style={{ flex: 1, fontSize: '0.68rem', height: 26 }}
          />
          <input
            className="nd-input"
            placeholder="IP cible (opt.)"
            value={genIpInput}
            onChange={e => setGenIpInput(e.target.value)}
            style={{ flex: 1.2, fontSize: '0.68rem', height: 26 }}
          />
        </div>

        {/* Suggestion list */}
        {suggestions.length > 0 && (
          <div>
            <div style={{ fontSize: '0.58rem', color: 'var(--nd-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Suggestions de ports libres :
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {suggestions.map((p, i) => (
                <button
                  key={i}
                  className="nd-btn"
                  onClick={() => {
                    setCheckPortInput(String(p));
                    if (genIpInput) setCheckIpInput(genIpInput);
                  }}
                  style={{ 
                    flex: 1, 
                    fontSize: '0.68rem', 
                    padding: '3px 0', 
                    height: 'auto',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    borderColor: 'var(--nd-purple)',
                    background: 'rgba(191, 90, 242, 0.05)',
                    color: 'var(--nd-purple)'
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
