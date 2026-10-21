/** Fictional, shared JSON for the demo widget and administrator field picker. */
export const customApiDemo = {
  download: 912.4,
  upload: 48.2,
  ping: 7.1,
  server: { name: 'Fiber Lab' },
  disks: [
    { name: 'nvme0', temp: 41, health: 'ok', used: 0.62 },
    { name: 'nvme1', temp: 39, health: 'ok', used: 0.48 },
    { name: 'sda', temp: 34, health: 'ok', used: 0.73 },
    { name: 'sdb', temp: 35, health: 'ok', used: 0.71 },
  ],
  updatedAt: '2026-10-01T12:00:00.000Z',
  online: true,
  statusPage: 'https://status.demo.invalid/lab/overview/nightly-backups',
  note: 'All systems nominal after the nightly backup window; next maintenance on Sunday.',
  ups: { battery: 100, load: 23 },
};
