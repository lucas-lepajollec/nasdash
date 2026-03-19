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

    if (device.api.type === 'homeassistant') {
      const { token, mapping } = device.api;
      if (!apiUrl || !token || !mapping) return NextResponse.json({ error: 'Configuration HA incomplète.' }, { status: 400 });

      const stats = [];
      const fetchSensor = async (sensorId: string) => {
        try {
          const res = await fetch(`${apiUrl}/api/states/${sensorId}`, {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: AbortSignal.timeout(3000) // 3s timeout
          });
          if (!res.ok) return null;
          const data = await res.json();
          return data.state;
        } catch (err) {
          return null;
        }
      };

      // CPU
      if (mapping.cpu) {
        const val = await fetchSensor(mapping.cpu);
        if (val !== null && !isNaN(parseFloat(val))) {
          let tempStr = '';
          const tempSensorName = mapping.temp || mapping['cpu-temp'] || mapping.cpu_temp;
          if (tempSensorName) {
            const tempVal = await fetchSensor(tempSensorName);
            if (tempVal !== null && !isNaN(parseFloat(tempVal))) tempStr = ` ${parseFloat(tempVal)}°C`;
          }
          const p = parseFloat(val);
          stats.push({ label: 'CPU', value: `${p.toFixed(1)}${val.toString().includes('.') || p <= 100 ? '%' : ''}${tempStr}`, percent: p <= 100 ? p : undefined, color: 'var(--nd-accent)' });
        }
      }

      // RAM
      if (mapping.ram) {
        const val = await fetchSensor(mapping.ram);
        if (val !== null && !isNaN(parseFloat(val))) {
          const p = parseFloat(val);
          stats.push({ label: 'RAM', value: `${p.toFixed(1)}${p <= 100 ? '%' : ' GB'}`, percent: p <= 100 ? p : undefined, color: 'var(--nd-green)' });
        }
      }

      // Disks
      if (mapping.disk) {
        const disks = Array.isArray(mapping.disk) ? mapping.disk : [{ name: 'Stockage', sensor: mapping.disk }];
        for (const d of disks) {
          const val = await fetchSensor(d.sensor);
          if (val !== null && !isNaN(parseFloat(val))) {
            let tempStr = '';
            if (d.tempSensor || mapping['disk-temp']) {
              const tempVal = await fetchSensor(d.tempSensor || mapping['disk-temp']);
              if (tempVal !== null && !isNaN(parseFloat(tempVal))) tempStr = ` ${parseFloat(tempVal)}°C`;
            }
            const p = parseFloat(val);
            stats.push({ label: d.name || 'Stockage', value: `${p.toFixed(1)}${p <= 100 ? '%' : ' GB'}${tempStr}`, percent: p <= 100 ? p : undefined, color: 'var(--nd-orange)' });
          }
        }
      }

      // GPUs
      if (mapping.gpu) {
        const gpus = Array.isArray(mapping.gpu) ? mapping.gpu : [{ name: 'GPU', sensor: mapping.gpu }];
        for (const g of gpus) {
          const val = await fetchSensor(g.sensor);
          if (val !== null && !isNaN(parseFloat(val))) {
            let tempStr = '';
            if (g.tempSensor) {
              const tempVal = await fetchSensor(g.tempSensor);
              if (tempVal !== null && !isNaN(parseFloat(tempVal))) tempStr = ` ${parseFloat(tempVal)}°C`;
            }
            const p = parseFloat(val);
            stats.push({ label: g.name || 'GPU', value: `${p.toFixed(1)}%${tempStr}`, percent: p <= 100 ? p : undefined, color: 'var(--nd-purple)' });
          }
        }
      }

      if (stats.length === 0) {
        return NextResponse.json({ error: 'Aucun capteur dynamique n\'a pu être lu.', isOffline: true }, { status: 503 });
      }

      return NextResponse.json(stats);
    }

    if (device.api.type === 'glances') {
      if (!apiUrl) return NextResponse.json({ error: 'URL Glances manquante.' }, { status: 400 });

      try {
        const headers: Record<string, string> = {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        };
        if (device.api.token) {
          const authString = interpolateEnv(device.api.token);
          const base64Credentials = typeof btoa === 'function'
            ? btoa(authString)
            : Buffer.from(authString).toString('base64');
          headers['Authorization'] = `Basic ${base64Credentials}`;
        }

        const res = await fetch(apiUrl, { headers, cache: 'no-store' });
        if (!res.ok) {
          console.error('🔴 ERREUR GLANCES HTTP:', res.status, res.statusText);
          return NextResponse.json({ error: `Erreur serveur (${res.status})`, isOffline: true }, { status: 200 });
        }

        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error('🔴 GLANCES HTML REÇU (Au lieu de JSON) SUR:', apiUrl);
          console.error('🔴 AUTH ENVOYÉE:', headers['Authorization']);
          console.error('🔴 DEBUT DU HTML:', text.substring(0, 50));
          throw new Error('Réponse invalide (HTML au lieu de JSON)');
        }

        const stats = [];

        let cpuTemp = '';
        let diskTemp = '';
        if (data?.sensors && Array.isArray(data.sensors)) {
          const cpuS = data.sensors.find((s: any) =>
            ['cpu', 'core', 'package', 'acpitz'].some(keyword => s.label?.toLowerCase().includes(keyword))
          );
          if (cpuS?.value !== undefined) {
            cpuTemp = ` ${Math.round(cpuS.value)}°C`;
          }

          const diskS = data.sensors.find((s: any) =>
            ['nvme', 'sda', 'disk', 'hdd', 'temp1'].some(keyword => s.label?.toLowerCase().includes(keyword)) &&
            !['cpu', 'core'].some(keyword => s.label?.toLowerCase().includes(keyword)) // avoid overlapping
          );
          if (diskS?.value !== undefined) {
            diskTemp = ` ${Math.round(diskS.value)}°C`;
          }
        }

        if (data?.cpu?.total !== undefined) {
          stats.push({ label: 'CPU', value: `${data.cpu.total.toFixed(1)}%${cpuTemp}`, percent: data.cpu.total, color: 'var(--nd-accent)' });
        }

        if (data?.mem?.percent !== undefined) {
          stats.push({ label: 'RAM', value: `${data.mem.percent.toFixed(1)}%`, percent: data.mem.percent, color: 'var(--nd-green)' });
        }

        if (data?.fs && Array.isArray(data.fs)) {
          const rootDisk = data.fs.find((disk: any) => disk.mnt_point === '/');
          const mainDisk = rootDisk || data.fs.find((disk: any) =>
            !disk.mnt_point.startsWith('/snap') &&
            !disk.mnt_point.startsWith('/run') &&
            !disk.mnt_point.startsWith('/sys') &&
            !disk.mnt_point.startsWith('/dev')
          );

          if (mainDisk) {
            const totalGB = mainDisk.size ? (mainDisk.size / 1024 / 1024 / 1024).toFixed(0) + 'G' : '';
            stats.push({
              label: `Disque (${mainDisk.mnt_point})`,
              value: `${mainDisk.percent.toFixed(1)}% ${totalGB ? `(${totalGB})` : ''}${diskTemp}`,
              percent: mainDisk.percent,
              color: 'var(--nd-orange)'
            });
          }
        }

        if (data?.gpu && Array.isArray(data.gpu)) {
          for (const gpu of data.gpu) {
            if (gpu.proc !== undefined) {
              const gTemp = gpu.temperature !== undefined ? ` ${Math.round(gpu.temperature)}°C` : '';
              stats.push({ label: gpu.name || 'GPU', value: `${gpu.proc.toFixed(1)}%${gTemp}`, percent: gpu.proc, color: 'var(--nd-purple)' });
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

        const diskUsed = data.rootfs?.used || data.disk;
        const diskTotal = data.rootfs?.total || data.maxdisk;
        if (diskUsed && diskTotal) {
          let diskPercent = 0;
          if (device.api.vmType === 'lxc') {
            diskPercent = (diskUsed / diskTotal) * 100; // LXC rootfs values match byte size loosely based on format
          } else {
            diskPercent = (diskUsed / diskTotal) * 100;
          }
          const totalGB = (diskTotal / 1024 / 1024 / 1024).toFixed(0) + 'G';
          stats.push({ label: 'Disque (Local)', value: `${diskPercent.toFixed(1)}% (${totalGB})`, percent: diskPercent, color: 'var(--nd-orange)' });
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

    return NextResponse.json(device.stats || []);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to proxy device API' }, { status: 500 });
  }
}
