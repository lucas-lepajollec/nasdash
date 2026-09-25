import calendar from './calendar/definition';
import clock from './clock/definition';
import device from './device/definition';
import deviceChart from './device-chart/definition';
import devices from './devices/definition';
import metricCpu from './metric-cpu/definition';
import metricMemory from './metric-memory/definition';
import metricGpu from './metric-gpu/definition';
import metricTemperature from './metric-temperature/definition';
import metricLoad from './metric-load/definition';
import metricNetwork from './metric-network/definition';
import dockerContainerList from './docker-container-list/definition';
import dockerExplorer from './docker-explorer/definition';
import dockerHosts from './docker-hosts/definition';
import dockerSummary from './docker-summary/definition';
import dockeractions from './dockeractions/definition';
import dockercontainers from './dockercontainers/definition';
import networkTools from './network-tools/definition';
import networkTopology from './network-topology/definition';
import networkgraph from './networkgraph/definition';
import quickstats from './quickstats/definition';
import serviceCategory from './service-category/definition';
import servicePorts from './service-ports/definition';
import spacer from './spacer/definition';
import storage from './storage/definition';
import tailscale from './tailscale/definition';
import weather from './weather/definition';
import type { WidgetDefinition } from './define';

/**
 * Every widget type, in library order (server-safe). Adding a widget:
 * create `src/widgets/<type>/definition.ts` and `view.tsx`, then add one line
 * here and one in `views.ts` (a test checks both lists match).
 */
export const WIDGET_DEFINITIONS: readonly WidgetDefinition[] = [
  // Services
  serviceCategory, servicePorts, quickstats,
  // System
  devices, device, deviceChart, storage, metricCpu, metricMemory, metricGpu, metricTemperature, metricLoad, metricNetwork,
  // Docker
  dockercontainers, dockeractions, dockerHosts, dockerSummary, dockerContainerList, dockerExplorer,
  // Network
  networkgraph, tailscale, networkTools, networkTopology,
  // Gadgets
  clock, calendar, weather,
  // Layout
  spacer,
];
