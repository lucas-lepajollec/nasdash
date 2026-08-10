'use client';

import React, { createContext, useContext, useState } from 'react';
import { Service, Category, Device, DockerActionConfig, CalendarDisplayEvent } from '@/lib/types';

export interface ServiceModalState { open: boolean; service?: Service; categoryId?: string }
export interface CategoryModalState { open: boolean; category?: Category }
export interface DeviceModalState { open: boolean; device?: Device }
export interface DockerActionModalState { open: boolean; action?: DockerActionConfig }
export interface SettingsModalState { open: boolean; targetTab?: string; targetCustomTabId?: string }
export interface CalendarEventModalState { open: boolean; date?: string; events?: CalendarDisplayEvent[] }
export interface ViewEventModalState { open: boolean; event?: CalendarDisplayEvent }

export interface ModalContextType {
  serviceModal: ServiceModalState;
  setServiceModal: (state: ServiceModalState) => void;
  categoryModal: CategoryModalState;
  setCategoryModal: (state: CategoryModalState) => void;
  deviceModal: DeviceModalState;
  setDeviceModal: (state: DeviceModalState) => void;
  dockerActionModal: DockerActionModalState;
  setDockerActionModal: (state: DockerActionModalState) => void;
  settingsModal: SettingsModalState;
  setSettingsModal: (state: SettingsModalState) => void;
  calendarEventModal: CalendarEventModalState;
  setCalendarEventModal: (state: CalendarEventModalState) => void;
  viewEventModal: ViewEventModalState;
  setViewEventModal: (state: ViewEventModalState) => void;
}

export const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [serviceModal, setServiceModal] = useState<ServiceModalState>({ open: false });
  const [categoryModal, setCategoryModal] = useState<CategoryModalState>({ open: false });
  const [deviceModal, setDeviceModal] = useState<DeviceModalState>({ open: false });
  const [dockerActionModal, setDockerActionModal] = useState<DockerActionModalState>({ open: false });
  const [settingsModal, setSettingsModal] = useState<SettingsModalState>({ open: false });
  const [calendarEventModal, setCalendarEventModal] = useState<CalendarEventModalState>({ open: false });
  const [viewEventModal, setViewEventModal] = useState<ViewEventModalState>({ open: false });

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
