import si from 'systeminformation';
import { SystemStats } from './types';

export async function getSystemStats(): Promise<SystemStats> {
  const [cpuLoad, cpuInfo, mem, disk, temp, timeData, graphics, latency, diskLayouts] = await Promise.all([
    si.currentLoad(),
    si.cpu(),
    si.mem(),
    si.fsSize(),
    si.cpuTemperature(),
    si.time(),
    si.graphics(),
    si.inetLatency(),
    si.diskLayout(),
  ]);

  const realDisks = disk.filter(d => 
    ['/', 'C:', 'D:', 'E:', 'F:'].includes(d.mount) || 
    (d.type && !d.type.includes('squashfs') && !d.type.includes('tmpfs') && d.size > 0)
  );
  const finalDisks = realDisks.length > 0 ? realDisks : [disk[0]];

  const gpus = graphics.controllers
    .filter(c => c.model && c.model.toLowerCase() !== 'unknown')
    .map(c => ({
      model: c.model,
      vram: c.vram || 0,
      usage: c.utilizationGpu ?? undefined,
      temp: c.temperatureGpu ?? undefined,
    }));

  return {
    cpu: {
      load: Math.round(cpuLoad.currentLoad * 10) / 10,
      speed: cpuInfo.speed,
      model: `${cpuInfo.manufacturer} ${cpuInfo.brand}`,
      cores: cpuInfo.cores,
    },
    ram: {
      used: Math.round((mem.used / 1073741824) * 10) / 10,
      total: Math.round((mem.total / 1073741824) * 10) / 10,
      percent: Math.round((mem.used / mem.total) * 1000) / 10,
    },
    disk: finalDisks.map(d => {
      // Tente de faire correspondre un nom de disque (/dev/sda) avec le layout physique pour choper la temp
      const physical = diskLayouts.find(l => d.fs.startsWith(l.device) || (d.fs === l.name));
      return {
        mount: d.mount,
        used: Math.round((d.used / 1073741824) * 10) / 10,
        total: Math.round((d.size / 1073741824) * 10) / 10,
        percent: Math.round(d.use * 10) / 10,
        temp: physical && physical.temperature ? physical.temperature : undefined,
      };
    }),
    temp: {
      main: temp.main !== null ? Math.round(temp.main * 10) / 10 : -1,
    },
    gpu: gpus.length > 0 ? gpus : undefined,
    network: {
      latency: Math.round(latency || 0),
    },
    uptime: timeData.uptime,
  };
}
