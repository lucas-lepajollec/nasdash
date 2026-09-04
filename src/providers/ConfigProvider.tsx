'use client';

import React, { createContext } from 'react';
import { AuthContextType, AuthProvider, useAuth } from './AuthProvider';
import { DashboardContextType, DashboardProvider, useDashboard } from './DashboardProvider';
import { ModalContextType, ModalProvider, useModals } from './ModalProvider';
import { readRequestedLanguage, useI18n } from '@/i18n/I18nProvider';

export interface ConfigContextType extends AuthContextType, DashboardContextType, ModalContextType {}

export const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

function ConfigCombinedProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const dashboard = useDashboard();
  const modals = useModals();
  const { language, setLanguage } = useI18n();

  React.useEffect(() => {
    if (!dashboard.config || readRequestedLanguage()) return;
    const persistedLanguage = dashboard.config.settings.uiLanguage || 'en';
    if (persistedLanguage !== language) setLanguage(persistedLanguage);
  }, [dashboard.config, language, setLanguage]);

  const value: ConfigContextType = {
    ...auth,
    ...dashboard,
    ...modals
  };

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
}

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardProvider>
        <ModalProvider>
          <ConfigCombinedProvider>
            {children}
          </ConfigCombinedProvider>
        </ModalProvider>
      </DashboardProvider>
    </AuthProvider>
  );
}
