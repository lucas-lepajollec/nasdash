'use client';

import { useConfig } from '@/hooks/useConfig';
import type { IntegrationSection } from '@/components/modals/settings/tabs/IntegrationsTab';

/**
 * Opens the settings on a tab (and a section of it), from a widget, a dialog
 * or another tab: the links of the first steps ("connect a source", "add
 * your machines") all go through here.
 */
export function useOpenSettings() {
  const { setSettingsModal, setDeviceModal } = useConfig();
  return {
    openIntegrations: (section: IntegrationSection) => {
      setDeviceModal({ open: false });
      setSettingsModal({ open: true, targetTab: 'integrations', targetSection: section });
    },
    openMachines: () => {
      setDeviceModal({ open: false });
      setSettingsModal({ open: true, targetTab: 'widget-devices' });
    },
  };
}
