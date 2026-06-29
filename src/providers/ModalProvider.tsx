'use client';

import React, { createContext, useContext, useState } from 'react';
import { Service, Category, Device } from '@/lib/types';

export interface ModalContextType {
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
}

export const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [serviceModal, setServiceModal] = useState<{ open: boolean; service?: Service; categoryId?: string }>({ open: false });
  const [categoryModal, setCategoryModal] = useState<{ open: boolean; category?: Category }>({ open: false });
  const [deviceModal, setDeviceModal] = useState<{ open: boolean; device?: Device }>({ open: false });
  const [dockerActionModal, setDockerActionModal] = useState<{ open: boolean; action?: any }>({ open: false });
  const [settingsModal, setSettingsModal] = useState<{ open: boolean; targetTab?: string; targetCustomTabId?: string }>({ open: false });
  const [calendarEventModal, setCalendarEventModal] = useState<{ open: boolean; date?: string; events?: any[] }>({ open: false });
  const [viewEventModal, setViewEventModal] = useState<{ open: boolean; event?: any }>({ open: false });

  return (
    <ModalContext.Provider
      value={{
        serviceModal,
        setServiceModal,
        categoryModal,
        setCategoryModal,
        deviceModal,
        setDeviceModal,
        dockerActionModal,
        setDockerActionModal,
        settingsModal,
        setSettingsModal,
        calendarEventModal,
        setCalendarEventModal,
        viewEventModal,
        setViewEventModal
      }}
    >
      {children}
    </ModalContext.Provider>
  );
}

export function useModals() {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModals must be used within a ModalProvider');
  }
  return context;
}
