import type { ServiceIntegrationManifest } from '../types';

export const minecraftManifest: ServiceIntegrationManifest = {
  id: 'minecraft',
  name: 'Minecraft server',
  // A logo of the dashboard-icons collection (svg/…svg or png/…png), checked to exist.
  logo: 'svg/minecraft.svg',
  fields: [
    // The address players type in the game: with no port, its SRV record or 25565. No account: the status is public.
    { id: 'host', kind: 'text', required: true, label: 'integrations.minecraft.host', placeholder: 'mc.example.com' },
    { id: 'port', kind: 'text', label: 'integrations.minecraft.port', placeholder: '25565' },
  ],
};
