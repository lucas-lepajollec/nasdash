'use client';

import React, { createContext } from 'react';
import { AuthProvider, useAuth } from './AuthProvider';
import { DashboardProvider, useDashboard } from './DashboardProvider';
import { ModalProvider, useModals } from './ModalProvider';
import { DashboardConfig, Category, Service, Device } from '@/lib/types';

export interface ConfigContextType {
  config: DashboardConfig | null;
  loading: boolean;
  refresh: () => Promise<void>;
  showSecretSections: boolean;
  setShowSecretSections: React.Dispatch<React.SetStateAction<boolean>>;
  addCategory: (title: string, emoji: string, isSecret?: boolean, layout?: Category['layout']) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  addService: (categoryId: string, service: Omit<Service, 'id'>) => Promise<void>;
  updateService: (id: string, updates: Partial<Service>) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  saveCategories: (newCategories: Category[]) => Promise<void>;
  addSlot: () => Promise<void>;
  addWidgetsSlot: () => Promise<void>;
  removeSlot: (slotId: number) => Promise<void>;
  addDevice: (device: Omit<Device, 'id'>) => Promise<void>;
  reorderDevices: (newDevices: Device[]) => Promise<void>;
  updateDevice: (id: string, updates: Partial<Device>) => Promise<void>;
  deleteDevice: (id: string) => Promise<void>;
  updateConfig: (updates: any) => Promise<void>;
  updateHomeWidgetProps: (widgetId: string, newProps: any) => Promise<void>;
  uploadLogo: (file: File) => Promise<string>;
  
  // Docker Actions
  addDockerAction: (action: any) => Promise<void>;
  updateDockerAction: (id: string, updates: any) => Promise<void>;
  deleteDockerAction: (id: string) => Promise<void>;
  reorderDockerActions: (newActions: any[]) => Promise<void>;

  // Local Events
  addLocalEvent: (event: Omit<any, 'id'>) => Promise<void>;
  updateLocalEvent: (id: string, updates: any) => Promise<void>;
  deleteLocalEvent: (id: string) => Promise<void>;

  // Shared Modal States
  serviceModal: { open: boolean; service?: Service; categoryId?: string };
  setServiceModal: (state: { open: boolean; service?: Service; categoryId?: string }) => void;
  categoryModal: { open: boolean; category?: Category };
  setCategoryModal: (state: { open: boolean; category?: Category }) => void;
  deviceModal: { open: boolean; device?: Device };
  setDeviceModal: (state: { open: boolean; device?: Device }) => void;
  dockerActionModal: { open: boolean; action?: any };
  setDockerActionModal: (state: { open: boolean; action?: any }) => void;
  settingsModal: { open: boolean; targetTab?: string; targetCustomTabId?: string };
  setSettingsModal: (state: { open: boolean; targetTab?: string; targetCustomTabId?: string }) => void;

  calendarEventModal: { open: boolean; date?: string; events?: any[] };
  setCalendarEventModal: (state: { open: boolean; date?: string; events?: any[] }) => void;
  viewEventModal: { open: boolean; event?: any };
  setViewEventModal: (state: { open: boolean; event?: any }) => void;

  // Authentification
  user: { username: string; role: 'admin' | 'viewer'; allowedTabs?: string[]; allowedWidgets?: string[]; isAnonymous?: boolean } | null;
  authLoading: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  pingResults: Record<string, { status: string; statusText: string; latency: number }>;
}

export const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

function ConfigCombinedProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const dashboard = useDashboard();
  const modals = useModals();

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
