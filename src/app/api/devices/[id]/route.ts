import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import https from 'https';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, segmentData: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await segmentData.params;
    const configPath = path.join(process.cwd(), 'data', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const device = config.devices?.find((d: any) => d.id === id);

    if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    if (!device.api) return NextResponse.json(device.stats || []);

    // ENV interpolation for URLs (e.g. "http://${GLANCES_IP}:61208/api/3/all")
    const interpolateEnv = (str: string) => str.replace(/\${([^}]+)}/g, (_, v) => process.env[v] || '');
    const apiUrl = device.api.url ? interpolateEnv(device.api.url) : '';

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

    if (device.api.type === 'glances') {
      if (!apiUrl) return NextResponse.json({ error: 'URL Glances manquante.' }, { status: 400 });

      let baseUrl = apiUrl;
      // Remove trailing slash if any
      if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1);
      }

      let fetchUrls: string[] = [];

      if (baseUrl.endsWith('/all')) {
        fetchUrls.push(baseUrl);
      } else {
        let base = baseUrl;
        if (base.match(/\/api\/\d+$/)) {
          base = base.substring(0, base.lastIndexOf('/api/'));
        }
        const endpoints = ['/api/5/all', '/api/4/all', '/api/3/all', '/api/2/all'];
        for (const ep of endpoints) {
          fetchUrls.push(`${base}${ep}`);
        }
      }

      try {
        const headers: Record<string, string> = {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        };
        if (device.api.token) {
          const authString = interpolateEnv(device.api.token);
          if (authString.trim() !== '' && authString !== ':') {
            const base64Credentials = typeof btoa === 'function'
              ? btoa(authString)
              : Buffer.from(authString).toString('base64');
            headers['Authorization'] = `Basic ${base64Credentials}`;
          }
        }

        let res: Response | null = null;
        let lastError: any = null;
        let finalUrl = '';

        for (const url of fetchUrls) {
          console.log('🔗 URL GLANCES APPELÉE:', url);
          try {
            res = await fetch(url, { headers, cache: 'no-store' });
            if (res.ok) {
              finalUrl = url;
              break; // Success, stop trying other URLs
            }
            if (res.status !== 404) {
              // If it's 401 Unauthorized or something else, we probably hit the right endpoint but auth failed or server error
              finalUrl = url;
              break;
            }
          } catch (e) {
            lastError = e;
          }
        }

        if (!res || !res.ok) {
          if (res) {
            console.error('🔴 ERREUR GLANCES HTTP:', res.status, res.statusText);
            return NextResponse.json({ error: `Erreur serveur (${res.status})`, isOffline: true }, { status: 200 });
          } else {
            console.error('🔴 ERREUR GLANCES FETCH:', lastError);
            return NextResponse.json({ error: 'Impossible de joindre Glances', isOffline: true }, { status: 200 });
          }
        }

        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error('🔴 GLANCES HTML REÇU (Au lieu de JSON) SUR:', finalUrl);
          console.error('🔴 AUTH ENVOYÉE:', headers['Authorization']);
          console.error('🔴 DEBUT DU HTML:', text.substring(0, 50));
          throw new Error('Réponse invalide (HTML au lieu de JSON)');
        }

        const stats = [];

        let cpuTemp = '';
        let diskTemp = '';
        if (data?.sensors && Array.isArray(data.sensors)) {
          const getSensor = (kws: string[]) => data.sensors.find((s: any) => 
            kws.some(kw => s.label?.toLowerCase().includes(kw))
          );
          const cpuS = 
            getSensor(['package', 'tctl', 'tdie']) ||
            getSensor(['core']) ||
            getSensor(['cpu']) ||
            getSensor(['acpitz']);
          
          if (typeof cpuS?.value === 'number') {
            cpuTemp = ` ${Math.round(cpuS.value)}°C`;
          }

          const diskS = data.sensors.find((s: any) =>
            ['nvme', 'sda', 'disk', 'hdd', 'temp1'].some(keyword => s.label?.toLowerCase().includes(keyword)) &&
            !['cpu', 'core'].some(keyword => s.label?.toLowerCase().includes(keyword)) // avoid overlapping
          );
          if (typeof diskS?.value === 'number') {
            diskTemp = ` ${Math.round(diskS.value)}°C`;
          }
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

          // Deduplicate by exact size
          const uniqueDisks = new Map<number, any>();
          for (const disk of filteredDisks) {
            if (!disk.size) continue;
            const existing = uniqueDisks.get(disk.size);
            if (!existing || disk.mnt_point.length < existing.mnt_point.length) {
              uniqueDisks.set(disk.size, disk);
            }
          }

          let finalDisks = Array.from(uniqueDisks.values());
          // NO LIMIT - return all valid disks

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

            // Keep only the last word after the last /
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

        return NextResponse.json(stats);
      } catch (err: any) {
        console.error('🔴 ERREUR GLANCES REQUÊTE:', err.message || err);
        return NextResponse.json({ error: err.message || 'Impossible de joindre Glances', isOffline: true }, { status: 200 });
      }
    }

    if (device.api.type === 'proxmox') {
      if (!apiUrl || !device.api.token) return NextResponse.json({ error: 'URL ou Token manquant.' }, { status: 400 });

      try {
        const tokenStr = interpolateEnv(device.api.token);
        const data = await fetchProxmox(apiUrl, tokenStr);
        const stats = [];

        // Host Node Stats: { cpu: 0.05, memory: { used: X, total: Y }, rootfs: { used: X, total: Y } }
        // QEMU/LXC Stats: { cpu: 0.05, mem: X, maxmem: Y, disk: X, maxdisk: Y }

        if (data.cpu !== undefined) {
          const cpuUsage = data.cpu * 100; // Proxmox returns a float 0-1
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

        // Si c'est un noeud principal (et pas une VM), on récupère la somme de tous les stockages
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
          } catch(e) {
             console.error("Erreur récupération stockage additionnel Proxmox", e);
          }
        }

        if (diskUsed && diskTotal) {
          let diskPercent = 0;
          if (device.api.vmType === 'lxc') {
            diskPercent = (diskUsed / diskTotal) * 100; // LXC rootfs values match byte size loosely based on format
          } else {
            diskPercent = (diskUsed / diskTotal) * 100;
          }
          // Conversion intelligente identique à Glances
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

        // Catch offline/shutdown VMs (CPU missing)
        if (stats.length === 0) {
          return NextResponse.json({ error: 'VM arrêtée ou aucune stat.', isOffline: true }, { status: 200 });
        }

        return NextResponse.json(stats);
      } catch (err: any) {
        console.error('🔴 ERREUR PROXMOX REQUÊTE:', err.message || err);
        return NextResponse.json({ error: err.message || 'Impossible de joindre Proxmox', isOffline: true }, { status: 200 });
      }
    }

    if (device.api.type === 'lhm') {
      if (!apiUrl) return NextResponse.json({ error: 'URL LHM manquante.' }, { status: 400 });

      try {
        const res = await fetch(apiUrl, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
        if (!res.ok) throw new Error(`HTTP: ${res.status}`);
        const data = await res.json();
        const stats = [];

        // Recursive search helper
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
          // 1. CPU
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

          // 2. RAM (Select Physical RAM only)
          if (hw.Text === 'Total Memory' || hw.Text === 'Generic Memory' || hw.Text === 'System Memory') {
            const ramLoad = searchLHMTree(hw, (n: any) => n.Text === 'Memory' && n.Value?.includes('%'));
            if (ramLoad) {
              const val = parseFloat(ramLoad.Value.replace(',', '.'));
              ramStats.push({ label: 'RAM', value: `${val.toFixed(1)}%`, percent: val, color: 'var(--nd-green)' });
            }
          }

          // 3. GPU
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

          // 4. DISK
          const diskLoad = searchLHMTree(hw, (n: any) => n.Text === 'Used Space' && n.Value?.includes('%'));
          if (diskLoad) {
            const diskName = hw.Text;
            const finalDiskLabel = `Disque (${diskName})`;

            const diskTemp = searchLHMTree(hw, (n: any) => n.Text?.startsWith('Temperature') && n.Value?.includes('°C'));
            const totalSpace = searchLHMTree(hw, (n: any) => n.Text === 'Total Space');
            
            const val = parseFloat(diskLoad.Value.replace(',', '.'));
            
            const parts = [`${val.toFixed(1)}%`];
            if (diskTemp) parts.push(`${Math.round(parseFloat(diskTemp.Value.replace(',', '.')))}°C`);

            if (totalSpace && totalSpace.Value) {
               let gb = parseFloat(totalSpace.Value.replace(',', '.'));
               if (totalSpace.Value.includes('MB')) gb = gb / 1024;
               if (gb >= 1000) {
                 parts.push(`(${(gb/1000).toFixed(1).replace('.', ',')} To)`);
               } else {
                 parts.push(`(${gb.toFixed(0)} Go)`);
               }
            }
            
            diskStats.push({ label: finalDiskLabel, value: parts.join('\u00A0\u00A0\u00A0'), percent: val, color: 'var(--nd-orange)' });
          }
        }

        stats.push(...cpuStats, ...ramStats, ...diskStats, ...gpuStats);

        return NextResponse.json(stats);
      } catch (err: any) {
        console.error('🔴 ERREUR LHM REQUÊTE:', err.message || err);
        return NextResponse.json({ error: err.message || 'Impossible de joindre LHM', isOffline: true }, { status: 200 });
      }
    }

    return NextResponse.json(device.stats || []);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to proxy device API' }, { status: 500 });
  }
}
