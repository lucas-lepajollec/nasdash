import type { ComponentType } from 'react';
import calendar from './calendar/view';
import clock from './clock/view';
import device from './device/view';
import deviceChart from './device-chart/view';
import devices from './devices/view';
import metricCpu from './metric-cpu/view';
import metricMemory from './metric-memory/view';
import metricGpu from './metric-gpu/view';
import metricTemperature from './metric-temperature/view';
import metricLoad from './metric-load/view';
import metricNetwork from './metric-network/view';
import dockerContainerList from './docker-container-list/view';
import dockerExplorer from './docker-explorer/view';
import dockerHosts from './docker-hosts/view';
import dockerSummary from './docker-summary/view';
import dockeractions from './dockeractions/view';
import dockercontainers from './dockercontainers/view';
import networkTools from './network-tools/view';
import networkTopology from './network-topology/view';
import networkgraph from './networkgraph/view';
import quickstats from './quickstats/view';
import serviceCategory from './service-category/view';
import servicePorts from './service-ports/view';
import spacer from './spacer/view';
import storage from './storage/view';
import tailscale from './tailscale/view';
import weather from './weather/view';
import quotes from './quotes/view';
import photos from './photos/view';
import bookmarks from './bookmarks/view';
import customapi from './customapi/view';
import mediaNowPlaying from './media-nowplaying/view';
import mediaRecent from './media-recent/view';
import mediaLibrary from './media-library/view';
import mediaUpcoming from './media-upcoming/view';
import mediaQueue from './media-queue/view';
import mediaDownloads from './media-downloads/view';
import mediaIndexers from './media-indexers/view';
import mediaArr from './media-arr/view';
import rss from './rss/view';
import markets from './markets/view';
import dns from './dns/view';
import type { WidgetViewProps } from './types';

/**
 * Display of every widget type (client side), by type. Keep in sync with
 * `definitions.ts`: a test checks that each definition has a view here.
 */
export const WIDGET_VIEWS: Readonly<Record<string, ComponentType<WidgetViewProps>>> = {
  'service-category': serviceCategory,
  'service-ports': servicePorts,
  'quickstats': quickstats,
  'devices': devices,
  'device': device,
  'device-chart': deviceChart,
  'storage': storage,
  'metric-cpu': metricCpu,
  'metric-memory': metricMemory,
  'metric-gpu': metricGpu,
  'metric-temperature': metricTemperature,
  'metric-load': metricLoad,
  'metric-network': metricNetwork,
  'dockercontainers': dockercontainers,
  'dockeractions': dockeractions,
  'docker-hosts': dockerHosts,
  'docker-summary': dockerSummary,
  'docker-container-list': dockerContainerList,
  'docker-explorer': dockerExplorer,
  'networkgraph': networkgraph,
  'tailscale': tailscale,
  'network-tools': networkTools,
  'network-topology': networkTopology,
  'dns': dns,
  'rss': rss,
  'markets': markets,
  'quotes': quotes,
  'photos': photos,
  'bookmarks': bookmarks,
  'customapi': customapi,
  'media-nowplaying': mediaNowPlaying,
  'media-recent': mediaRecent,
  'media-library': mediaLibrary,
  'media-upcoming': mediaUpcoming,
  'media-queue': mediaQueue,
  'media-downloads': mediaDownloads,
  'media-indexers': mediaIndexers,
  'media-arr': mediaArr,
  'clock': clock,
  'calendar': calendar,
  'weather': weather,
  'spacer': spacer,
};
