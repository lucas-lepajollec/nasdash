import fs from 'fs';
import path from 'path';
import https from 'https';
import { DashboardConfig } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const LOGOS_DIR = path.join(DATA_DIR, 'logos');

export function ensureDataDir() {
  console.log('Vérification du dossier data...');
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(LOGOS_DIR)) fs.mkdirSync(LOGOS_DIR, { recursive: true });
  } catch (e) {
    console.error('⚠️ ERREUR DE PERMISSION : Impossible d\'écrire dans /app/data. Vérifiez les droits (chmod 777) sur l\'hôte.', e);
  }
}

export function readConfig(): DashboardConfig {
  ensureDataDir();
  let needDefault = false;
  let configData = null;

  if (!fs.existsSync(CONFIG_PATH)) {
    needDefault = true;
  } else {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8').trim();
    if (!raw || raw === '{}' || raw === '[]') {
      needDefault = true;
    } else {
      try {
        configData = JSON.parse(raw);
        // Minimal validation to consider it's not "empty"
        if (!configData || (!configData.categories && !configData.devices)) {
          needDefault = true;
        }
      } catch (e) {
        needDefault = true;
      }
    }
  }

  if (needDefault || !configData) {
    const examplePath = path.join(DATA_DIR, 'config.example.json');
    if (fs.existsSync(examplePath)) {
      try {
        fs.copyFileSync(examplePath, CONFIG_PATH);
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      } catch (e) {
        console.error('⚠️ ERREUR DE PERMISSION ou de lecture lors de la copie de config.example.json :', e);
      }
    }

    const defaultConfig = getDefaultConfig();
    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2));
    } catch (e) {
      console.error('⚠️ ERREUR DE PERMISSION : Impossible de créer data/config.json. Configuration utilisée en mémoire.', e);
    }
    return defaultConfig;
  }

  if (configData && configData.categories) {
    configData.categories.forEach((cat: any) => {
      if (cat.services) {
        cat.services.forEach((svc: any) => {
          if (svc.tailscaleUrl && !svc.secondaryUrl) {
            svc.secondaryUrl = svc.tailscaleUrl;
          }
        });
      }
    });
  }

  return configData;
}

export function writeConfig(config: DashboardConfig) {
  ensureDataDir();
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error('⚠️ ERREUR DE PERMISSION : Impossible d\'écrire dans data/config.json', e);
  }
}

export function getLogosDir() {
  ensureDataDir();
  return LOGOS_DIR;
}

function getDefaultConfig(): DashboardConfig {
  const examplePath = path.join(DATA_DIR, 'config.example.json');
  if (fs.existsSync(examplePath)) {
    try {
      return JSON.parse(fs.readFileSync(examplePath, 'utf-8'));
    } catch (e) {
      console.error('Erreur lecture config.example.json', e);
    }
  }

  return {
    settings: {
      title: 'HOME LAB',
      showMonitor: true,
      totalSlots: 10
    },
    devices: [],
    categories: []
  };
}

// --- Smart Logger to avoid spamming errors ---
const globalAny: any = global;
if (!globalAny.__errorLogCache) globalAny.__errorLogCache = new Map<string, string>();
const errorLogCache: Map<string, string> = globalAny.__errorLogCache;

function logErrorSmartly(deviceId: string, context: string, errorMsg: string) {
  const key = `${deviceId}-${context}`;
  if (errorLogCache.get(key) !== errorMsg) {
    console.error(`🔴 [${context}]`, errorMsg);
    errorLogCache.set(key, errorMsg);
  }
}

function clearErrorSmartly(deviceId: string, context: string) {
  errorLogCache.delete(`${deviceId}-${context}`);
}
// ---------------------------------------------

export const devicesStatusCache: Record<string, { online: boolean; stats?: any; updatedAt: number; error?: string; isOffline?: boolean }> = {};

export function startBackgroundMonitoring() {
  if (globalAny.monitoringStarted) return;
  globalAny.monitoringStarted = true;
  console.log('🚀 Démarrage du Background Monitoring des appareils (Toutes les 20s)...');

  const interpolateEnv = (str: string) => str.replace(/\${([^}]+)}/g, (_, v) => process.env[v] || '');

  const fetchProxmox = (urlStr: string, token: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      const url = new URL(urlStr);
      const options = {
        hostname: url.hostname,
        port: url.port || 8006,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'Authorization': `PVEAPIToken=${token}`,
          'Accept': 'application/json'
        },
        agent: new https.Agent({ rejectUnauthorized: false }), // BYPASS SELF-SIGNED SECRETS
        timeout: 4000
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`Proxmox SSL/API Error: ${res.statusCode} ${res.statusMessage}`));
            return;
          }
          try {
            resolve(JSON.parse(data).data); // Proxmox nests everything under .data
          } catch (e) {
            reject(new Error('Invalid JSON from Proxmox'));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      req.end();
    });
  };

  const doPoll = async () => {
    try {
      // Toujours lire la configuration la plus à jour (en cas de modif)
      const currentConfig = readConfig();
      if (!currentConfig.devices) return;

      for (const device of currentConfig.devices) {
        if (!device.api) {
          devicesStatusCache[device.id] = { online: true, stats: device.stats || [], updatedAt: Date.now() };
          continue;
        }

        const id = device.id;
        const apiUrl = device.api.url ? interpolateEnv(device.api.url) : '';

        if (device.api.type === 'glances') {
          if (!apiUrl) {
            devicesStatusCache[id] = { online: false, error: 'URL Glances manquante.', isOffline: true, updatedAt: Date.now() };
            continue;
          }

          let baseUrl = apiUrl;
          if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

          let fetchUrls: string[] = [];
          if (baseUrl.endsWith('/all')) {
            fetchUrls.push(baseUrl);
          } else {
            let base = baseUrl;
            if (base.match(/\/api\/\d+$/)) {
              base = base.substring(0, base.lastIndexOf('/api/'));
            }
            const endpoints = ['/api/5/all', '/api/4/all', '/api/3/all', '/api/2/all'];
            for (const ep of endpoints) fetchUrls.push(`${base}${ep}`);
          }

          try {
            const headers: Record<string, string> = {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            };
            if (device.api.token) {
              const authString = interpolateEnv(device.api.token);
              if (authString.trim() !== '' && authString !== ':') {
                const base64Credentials = typeof btoa === 'function' ? btoa(authString) : Buffer.from(authString).toString('base64');
                headers['Authorization'] = `Basic ${base64Credentials}`;
              }
            }

            let res: Response | null = null;
            let lastError: any = null;
            let finalUrl = '';

            for (const url of fetchUrls) {
              try {
                res = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(4000) });
                if (res.ok) { finalUrl = url; break; }
                if (res.status !== 404) { finalUrl = url; break; }
              } catch (e) {
                lastError = e;
              }
            }

            if (!res || !res.ok) {
              if (res) {
                logErrorSmartly(id, 'Glances', `Erreur HTTP: ${res.status} ${res.statusText}`);
                devicesStatusCache[id] = { online: false, error: `Erreur serveur (${res.status})`, isOffline: true, updatedAt: Date.now() };
              } else {
                logErrorSmartly(id, 'Glances', `Fetch Error: ${lastError?.message || lastError}`);
                devicesStatusCache[id] = { online: false, error: 'Impossible de joindre Glances', isOffline: true, updatedAt: Date.now() };
              }
              continue;
            }

            const text = await res.text();
            let data;
            try {
              data = JSON.parse(text);
            } catch (e) {
              logErrorSmartly(id, 'Glances HTML', `Reçu HTML au lieu de JSON sur ${finalUrl}`);
              devicesStatusCache[id] = { online: false, error: 'Réponse invalide (HTML)', isOffline: true, updatedAt: Date.now() };
              continue;
            }

            const stats = [];
            let cpuTemp = '';
            let diskTemp = '';
            if (data?.sensors && Array.isArray(data.sensors)) {
              const getSensor = (kws: string[]) => data.sensors.find((s: any) => kws.some(kw => s.label?.toLowerCase().includes(kw)));
              const cpuS = getSensor(['package', 'tctl', 'tdie']) || getSensor(['core']) || getSensor(['cpu']) || getSensor(['acpitz']);
              if (typeof cpuS?.value === 'number') cpuTemp = ` ${Math.round(cpuS.value)}°C`;

              const diskS = data.sensors.find((s: any) => ['nvme', 'sda', 'disk', 'hdd', 'temp1'].some(keyword => s.label?.toLowerCase().includes(keyword)) && !['cpu', 'core'].some(keyword => s.label?.toLowerCase().includes(keyword)));
              if (typeof diskS?.value === 'number') diskTemp = ` ${Math.round(diskS.value)}°C`;
            }

            if (data?.cpu?.total !== undefined) {
              const tStr = cpuTemp ? `\u00A0\u00A0\u00A0${cpuTemp.trim()}` : '';
              stats.push({ label: 'CPU', value: `${data.cpu.total.toFixed(1)}%${tStr}`, percent: data.cpu.total, color: 'var(--nd-accent)' });
            }

            if (data?.mem?.percent !== undefined) {
              stats.push({ label: 'RAM', value: `${data.mem.percent.toFixed(1)}%`, percent: data.mem.percent, color: 'var(--nd-green)' });
            }

            if (data?.fs && Array.isArray(data.fs)) {
              const excludeKeywords = ['boot', 'efi', 'overlay', 'tmpfs', 'docker'];
              let filteredDisks = data.fs.filter((disk: any) => {
                if (!disk.mnt_point) return false;
                const lowerMnt = disk.mnt_point.toLowerCase();
                return !excludeKeywords.some(kw => lowerMnt.includes(kw));
              });

              const uniqueDisks = new Map<number, any>();
              for (const disk of filteredDisks) {
                if (!disk.size) continue;
                const existing = uniqueDisks.get(disk.size);
                if (!existing || disk.mnt_point.length < existing.mnt_point.length) {
                  uniqueDisks.set(disk.size, disk);
                }
              }

              let finalDisks = Array.from(uniqueDisks.values());
              for (const disk of finalDisks) {
                let totalStr = '';
                if (disk.size) {
                  const gb = disk.size / 1024 / 1024 / 1024;
                  if (gb >= 1000) {
                    const tb = gb / 1000;
                    totalStr = tb.toFixed(1).replace('.', ',') + ' To';
                  } else {
                    totalStr = gb.toFixed(0) + ' Go';
                  }
                }

                let displayName = disk.mnt_point;
                if (displayName && displayName !== '/') {
                  const parts = displayName.split('/').filter(Boolean);
                  displayName = parts.pop() || displayName;
                }

                const parts = [`${disk.percent.toFixed(1)}%`];
                if (diskTemp) parts.push(diskTemp.trim());
                if (totalStr) parts.push(`(${totalStr.trim()})`);

                stats.push({
                  label: `Disque (${displayName})`,
                  value: parts.join('\u00A0\u00A0\u00A0'),
                  percent: disk.percent,
                  color: 'var(--nd-orange)'
                });
              }
            }

            if (data?.gpu && Array.isArray(data.gpu)) {
              for (const gpu of data.gpu) {
                if (gpu.proc !== undefined) {
                  const tStr = typeof gpu.temperature === 'number' ? `\u00A0\u00A0\u00A0${Math.round(gpu.temperature)}°C` : '';
                  stats.push({ label: gpu.name || 'GPU', value: `${gpu.proc.toFixed(1)}%${tStr}`, percent: gpu.proc, color: 'var(--nd-purple)' });
                }
              }
            }

            clearErrorSmartly(id, 'Glances');
            devicesStatusCache[id] = { online: true, stats, updatedAt: Date.now() };

          } catch (err: any) {
            logErrorSmartly(id, 'Glances', err.message || err);
            devicesStatusCache[id] = { online: false, error: err.message || 'Impossible de joindre Glances', isOffline: true, updatedAt: Date.now() };
          }
        }

        else if (device.api.type === 'proxmox') {
          if (!apiUrl || !device.api.token) {
            devicesStatusCache[id] = { online: false, error: 'URL ou Token manquant.', isOffline: true, updatedAt: Date.now() };
            continue;
          }

          try {
            const tokenStr = interpolateEnv(device.api.token);
            const data = await fetchProxmox(apiUrl, tokenStr);
            const stats = [];

            if (data.cpu !== undefined) {
              const cpuUsage = data.cpu * 100;
              if (!isNaN(cpuUsage)) {
                stats.push({ label: 'CPU', value: `${cpuUsage.toFixed(1)}%`, percent: cpuUsage > 100 ? 100 : cpuUsage, color: 'var(--nd-accent)' });
              }
            }

            const memUsed = data.memory?.used || data.mem;
            const memTotal = data.memory?.total || data.maxmem;
            if (memUsed && memTotal) {
              const memPercent = (memUsed / memTotal) * 100;
              stats.push({ label: 'RAM', value: `${memPercent.toFixed(1)}%`, percent: memPercent, color: 'var(--nd-green)' });
            }

            let diskUsed = data.rootfs?.used || data.disk;
            let diskTotal = data.rootfs?.total || data.maxdisk;

            if (!device.api.vmid && typeof apiUrl === 'string' && apiUrl.endsWith('/status')) {
              const storageUrl = apiUrl.replace('/status', '/storage');
              try {
                 const storageData = await fetchProxmox(storageUrl, tokenStr);
                 if (Array.isArray(storageData) && storageData.length > 0) {
                   let sUsed = 0, sTotal = 0;
                   for (const st of storageData) {
                      sUsed += st.used || 0;
                      sTotal += st.total || 0;
                   }
                   if (sTotal > 0) {
                     diskUsed = sUsed;
                     diskTotal = sTotal;
                   }
                 }
              } catch(e: any) {
                 logErrorSmartly(id, 'Proxmox Storage', e.message || e);
              }
            }

            if (diskUsed && diskTotal) {
              let diskPercent = 0;
              if (device.api.vmType === 'lxc') {
                diskPercent = (diskUsed / diskTotal) * 100;
              } else {
                diskPercent = (diskUsed / diskTotal) * 100;
              }
              const gb = diskTotal / 1024 / 1024 / 1024;
              let totalStr = '';
              if (gb >= 1000) {
                const tb = gb / 1000;
                totalStr = tb.toFixed(1).replace('.', ',') + ' To';
              } else {
                totalStr = gb.toFixed(0) + ' Go';
              }
              stats.push({ label: 'Disque (Local)', value: `${diskPercent.toFixed(1)}% (${totalStr})`, percent: diskPercent, color: 'var(--nd-orange)' });
            }

            if (stats.length === 0) {
              devicesStatusCache[id] = { online: false, error: 'VM arrêtée ou aucune stat.', isOffline: true, updatedAt: Date.now() };
              continue;
            }

            clearErrorSmartly(id, 'Proxmox');
            devicesStatusCache[id] = { online: true, stats, updatedAt: Date.now() };

          } catch (err: any) {
            logErrorSmartly(id, 'Proxmox', err.message || err);
            devicesStatusCache[id] = { online: false, error: err.message || 'Impossible de joindre Proxmox', isOffline: true, updatedAt: Date.now() };
          }
        }

        else if (device.api.type === 'lhm') {
          if (!apiUrl) {
            devicesStatusCache[id] = { online: false, error: 'URL LHM manquante.', isOffline: true, updatedAt: Date.now() };
            continue;
          }

          try {
            const res = await fetch(apiUrl, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
            if (!res.ok) throw new Error(`HTTP: ${res.status}`);
            const data = await res.json();
            const stats = [];

            const searchLHMTree = (node: any, matchFn: (n: any) => boolean): any => {
              if (matchFn(node)) return node;
              if (node.Children) {
                for (const child of node.Children) {
                  const f = searchLHMTree(child, matchFn);
                  if (f) return f;
                }
              }
              return null;
            };

            const computerNode = data.Children?.[0];
            const hwNodes = computerNode?.Children || [];

            const cpuStats: any[] = [];
            const ramStats: any[] = [];
            const gpuStats: any[] = [];
            const diskStats: any[] = [];

            for (const hw of hwNodes) {
              const cpuLoad = searchLHMTree(hw, (n: any) => n.Text === 'CPU Total' && n.Value?.includes('%'));
              if (cpuLoad) {
                let cpuTemp = searchLHMTree(hw, (n: any) => (n.Text === 'CPU Package' || n.Text?.includes('Core (Tctl/Tdie)')) && n.Value?.includes('°C'));
                if (!cpuTemp) {
                  cpuTemp = searchLHMTree(hw, (n: any) => n.Text === 'Core Max' && n.Value?.includes('°C'));
                }
                const val = parseFloat(cpuLoad.Value.replace(',', '.'));
                const parts = [`${val.toFixed(1)}%`];
                if (cpuTemp) parts.push(`${Math.round(parseFloat(cpuTemp.Value.replace(',', '.')))}°C`);
                cpuStats.push({ label: 'CPU', value: parts.join('\u00A0\u00A0\u00A0'), percent: val > 100 ? 100 : val, color: 'var(--nd-accent)' });
              }

              if (hw.Text === 'Total Memory' || hw.Text === 'Generic Memory' || hw.Text === 'System Memory') {
                const ramLoad = searchLHMTree(hw, (n: any) => n.Text === 'Memory' && n.Value?.includes('%'));
                if (ramLoad) {
                  const val = parseFloat(ramLoad.Value.replace(',', '.'));
                  ramStats.push({ label: 'RAM', value: `${val.toFixed(1)}%`, percent: val, color: 'var(--nd-green)' });
                }
              }

              const gpuLoad = searchLHMTree(hw, (n: any) => n.Text === 'GPU Core' && n.Value?.includes('%'));
              if (gpuLoad) {
                const gpuName = hw.Text.replace('NVIDIA ', '').replace('AMD ', '');
                let gpuTemp = searchLHMTree(hw, (n: any) => n.Text === 'GPU Core' && n.Value?.includes('°C'));
                if (!gpuTemp) {
                  gpuTemp = searchLHMTree(hw, (n: any) => n.Text?.startsWith('GPU') && n.Value?.includes('°C'));
                }
                const val = parseFloat(gpuLoad.Value.replace(',', '.'));
                const parts = [`${val.toFixed(1)}%`];
                if (gpuTemp) parts.push(`${Math.round(parseFloat(gpuTemp.Value.replace(',', '.')))}°C`);
                gpuStats.push({ label: gpuName, value: parts.join('\u00A0\u00A0\u00A0'), percent: val > 100 ? 100 : val, color: 'var(--nd-purple)' });
              }

              const diskLoad = searchLHMTree(hw, (n: any) => n.Text === 'Used Space' && n.Value?.includes('%'));
              if (diskLoad) {
                const diskName = hw.Text;
                const diskTemp = searchLHMTree(hw, (n: any) => n.Text?.startsWith('Temperature') && n.Value?.includes('°C'));
                const totalSpace = searchLHMTree(hw, (n: any) => n.Text === 'Total Space');
                const val = parseFloat(diskLoad.Value.replace(',', '.'));
                const parts = [`${val.toFixed(1)}%`];
                if (diskTemp) parts.push(`${Math.round(parseFloat(diskTemp.Value.replace(',', '.')))}°C`);
                if (totalSpace && totalSpace.Value) {
                   let gb = parseFloat(totalSpace.Value.replace(',', '.'));
                   if (totalSpace.Value.includes('MB')) gb = gb / 1024;
                   if (gb >= 1000) parts.push(`(${((gb/1000)).toFixed(1).replace('.', ',')} To)`);
                   else parts.push(`(${gb.toFixed(0)} Go)`);
                }
                diskStats.push({ label: `Disque (${diskName})`, value: parts.join('\u00A0\u00A0\u00A0'), percent: val, color: 'var(--nd-orange)' });
              }
            }

            stats.push(...cpuStats, ...ramStats, ...diskStats, ...gpuStats);
            clearErrorSmartly(id, 'LHM');
            devicesStatusCache[id] = { online: true, stats, updatedAt: Date.now() };

          } catch (err: any) {
            logErrorSmartly(id, 'LHM', err.message || err);
            devicesStatusCache[id] = { online: false, error: err.message || 'Impossible de joindre LHM', isOffline: true, updatedAt: Date.now() };
          }
        }
        else {
          // Unknown or unsupported type just uses static stats if they exist
          devicesStatusCache[id] = { online: true, stats: device.stats || [], updatedAt: Date.now() };
        }
      }
    } catch (err) {
      console.error('Background Polling Loop Error:', err);
    }
  };

  // Run immediately then every 20s
  doPoll();
  setInterval(doPoll, 20000);
}

// Auto-start on server load
if (typeof window === 'undefined') {
  try {
    startBackgroundMonitoring();
  } catch (err) {
    console.error('Failed to start background monitoring:', err);
  }
}

