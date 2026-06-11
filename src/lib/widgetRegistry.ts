export interface WidgetDefinition {
  id: string; // The base ID for the widget, used for config keys like hide{Id}, {id}Sidebar, etc.
  name: string; // Display name
  icon: string; // Emoji icon
  description: string; // Short description for Library
  category: string; // Category badge (e.g., 'Système', 'Raccourci')
  color: string; // Accent color for the sidebar
  bg: string; // Background color for the sidebar icon
  defaultSidebar: 'left' | 'right' | 'bottom';
  defaultOrder: number;
  defaultHidden: boolean;
  hasConfig: boolean; // Does this widget have a dedicated configuration tab?
}

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  {
    id: 'devices',
    name: 'Appareils',
    icon: '🖥️',
    description: 'Vitalités en temps réel des serveurs connectés (Glances, Proxmox, LHM).',
    category: 'Système',
    color: '#3fb950',
    bg: 'rgba(63, 185, 80, 0.08)',
    defaultSidebar: 'left',
    defaultOrder: 0,
    defaultHidden: false,
    hasConfig: true // Since it manages specific devices
  },
  {
    id: 'quickstats',
    name: 'Vue d\'ensemble',
    icon: '📊',
    description: 'Résumé rapide (services, catégories, ports ouverts et statuts).',
    category: 'Raccourci',
    color: '#3fb950',
    bg: 'rgba(63, 185, 80, 0.08)',
    defaultSidebar: 'right',
    defaultOrder: 1,
    defaultHidden: false,
    hasConfig: false // Only uses Layout Config now
  },
  {
    id: 'tailscale',
    name: 'VPN Tailscale',
    icon: '🔒',
    description: 'État général et liste des machines Tailscale connectées.',
    category: 'Réseau',
    color: 'var(--nd-purple)',
    bg: 'rgba(168, 85, 247, 0.08)',
    defaultSidebar: 'right',
    defaultOrder: 2,
    defaultHidden: false,
    hasConfig: true // Auth Tailscale
  },
  {
    id: 'dockeractions',
    name: 'Actions Docker',
    icon: '🐳',
    description: 'Boutons de démarrage et d\'arrêt pour tous les conteneurs.',
    category: 'Système',
    color: 'var(--nd-orange)',
    bg: 'rgba(240, 136, 62, 0.08)',
    defaultSidebar: 'right',
    defaultOrder: 3,
    defaultHidden: true,
    hasConfig: false // Only Layout Config
  },
  {
    id: 'clock',
    name: 'Horloge',
    icon: '🕒',
    description: 'Affiche l\'heure actuelle et la date.',
    category: 'Gadget',
    color: 'var(--nd-accent)',
    bg: 'rgba(56, 189, 248, 0.08)',
    defaultSidebar: 'left',
    defaultOrder: 1,
    defaultHidden: false,
    hasConfig: false // Only Layout Config
  },
  {
    id: 'calendar',
    name: 'Calendrier',
    icon: '📅',
    description: 'Affiche un mini calendrier du mois en cours.',
    category: 'Gadget',
    color: '#fb923c',
    bg: 'rgba(251, 146, 60, 0.08)',
    defaultSidebar: 'left',
    defaultOrder: 2,
    defaultHidden: true,
    hasConfig: false // Only Layout Config
  },
  {
    id: 'weather',
    name: 'Météo',
    icon: '☁️',
    description: 'Conditions météorologiques actuelles.',
    category: 'Gadget',
    color: 'var(--nd-accent)',
    bg: 'rgba(56, 189, 248, 0.08)',
    defaultSidebar: 'left',
    defaultOrder: 3,
    defaultHidden: false,
    hasConfig: true // Multiple cities
  },
  {
    id: 'networkgraph',
    name: 'Graphe Réseau',
    icon: '📶',
    description: 'Latence réseau en temps réel.',
    category: 'Réseau',
    color: 'var(--nd-green)',
    bg: 'rgba(63, 185, 80, 0.08)',
    defaultSidebar: 'bottom',
    defaultOrder: 0,
    defaultHidden: false,
    hasConfig: false // Only Layout Config
  },
  {
    id: 'dockercontainers',
    name: 'Conteneurs Docker',
    icon: '🐳',
    description: 'Visualisation et état détaillé de vos conteneurs Docker.',
    category: 'Système',
    color: 'var(--nd-accent)',
    bg: 'var(--nd-accent-glow)',
    defaultSidebar: 'right',
    defaultOrder: 4,
    defaultHidden: true,
    hasConfig: false // Only Layout Config
  }
];

/**
 * Utility to capitalize the first letter of an ID
 */
export const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

/**
 * Helper to generate backend config keys for a widget
 */
export const getWidgetConfigKeys = (id: string) => {
  let base = id;
  if (id === 'quickstats') base = 'quickStats';
  else if (id === 'dockeractions') base = 'dockerActions';
  else if (id === 'networkgraph') base = 'networkGraph';
  else if (id === 'dockercontainers') base = 'dockerContainers';

  const hideKey = id === 'tailscale' ? 'hideTailscaleStatus' : `hide${capitalize(base)}`;

  return {
    hide: hideKey,
    sidebar: `${base}Sidebar`,
    order: `${base}Order`
  };
};
