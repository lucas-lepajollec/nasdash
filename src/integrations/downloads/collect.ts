import type { IntegrationInstance } from '@/lib/types';
import type { DownloadClientStatus, DownloadClientType } from '@/lib/widgetData/contracts';
import { collectQbittorrent } from '../qbittorrent/collect';
import { collectTransmission } from '../transmission/collect';
import { collectDeluge } from '../deluge/collect';
import { collectSabnzbd } from '../sabnzbd/collect';
import { collectNzbget } from '../nzbget/collect';
const collectors: Record<DownloadClientType, (instance: IntegrationInstance) => Promise<DownloadClientStatus>> = {
  qbittorrent: collectQbittorrent, transmission: collectTransmission, deluge: collectDeluge, sabnzbd: collectSabnzbd, nzbget: collectNzbget,
};
export const collectDownloadClient = (instance: IntegrationInstance) => collectors[instance.type as DownloadClientType](instance);
