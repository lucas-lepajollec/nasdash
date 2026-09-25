import React, { useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { Pencil, Trash2, Plus } from 'lucide-react';
import ConfirmModal from '../../../ConfirmModal';
import { Device } from '@/lib/types';
import { Emoji } from '../../../../shared/Emoji';
import { useI18n } from '@/i18n/I18nProvider';
import { WidgetPlacementNote } from '../../shared/WidgetPlacementNote';
import { CalmeHeading } from '../../shared/CalmeControls';
import { monitoringInstances } from '@/integrations/sources';
import { getDeviceIntegration } from '@/integrations/registry';
import { useOpenSettings } from '@/components/integrations/useOpenSettings';

export function DevicesWidgetTab() {
  const { t } = useI18n();
  const { config, setDeviceModal, deleteDevice } = useConfig();
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null);
  const devicesList = config?.devices || [];

  const handleAddDevice = () => {
    setDeviceModal({ open: true });
  };

  const handleEditDevice = (device: Device) => {
    setDeviceModal({ open: true, device });
  };

  const handleDeleteDevice = async (id: string) => {
    await deleteDevice(id);
    setDeviceToDelete(null);
  };

  const { openIntegrations } = useOpenSettings();
  const sources = monitoringInstances(config);
  const sourceOf = (device: Device) => (device.source ? config?.integrations?.find(instance => instance.id === device.source!.integrationId) : undefined);
  const sourceName = (device: Device) => {
    const source = sourceOf(device);
    if (!device.source) return '';
    const machine = device.source.values ? Object.values(device.source.values).filter(Boolean).join(' / ') : '';
    return source ? [source.name, machine].filter(Boolean).join(' · ') : t('integrations.sourceMissing');
  };
  const sourceType = (device: Device) => getDeviceIntegration(sourceOf(device)?.type ?? device.api?.type)?.name ?? t('integrations.manual');

  return (
    <div className="ndc-set-page">
      <WidgetPlacementNote type="devices" />
      {sources.length === 0 && (
        <section className="ndc-set-block">
          <div className="ndc-callout">
            <span className="ndc-callout-title">{t('integrations.noSourceTitle')}</span>
            <span className="ndc-callout-text">{t('integrations.noSourceText')}</span>
            <button type="button" className="nd-btn nd-btn-accent" onClick={() => openIntegrations('monitoring')}>{t('integrations.openPage')}</button>
          </div>
        </section>
      )}
      <section className="ndc-set-block">
        <CalmeHeading info={t('integrations.machinesHint')} action={(
          <button type="button" className="ndc-text-button" onClick={handleAddDevice}><Plus size={12} style={{ verticalAlign: -2 }} /> {t("Ajouter")}</button>
        )}>{t('settings.calme.devices')}</CalmeHeading>
        {devicesList.length === 0 && <div className="ndc-set-empty">{t("Aucun appareil connecté pour le moment. Cliquez sur &quot;Ajouter&quot; pour lier un serveur.")}</div>}
        {devicesList.map(dev => (
          <div key={dev.id} className="ndc-lib-row ndc-lib-row--actions">
            <span className="ndc-lib-icon"><Emoji emoji={dev.icon || '🖥️'} /></span>
            <span className="ndc-lib-name" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <span>{dev.name}</span>
              <span className="ndc-set-list-sub">{[dev.host, sourceName(dev)].filter(Boolean).join(' · ') || t('integrations.noSource')}</span>
            </span>
            <span className="ndc-tag">{sourceType(dev)}</span>
            <span style={{ display: 'flex', gap: 2 }}>
              <button type="button" className="ndc-icon-button" onClick={() => handleEditDevice(dev)} title={t("Modifier les informations de connexion")} aria-label={t("Modifier les informations de connexion")}><Pencil size={13} /></button>
              <button type="button" className="ndc-icon-button" onClick={() => setDeviceToDelete(dev)} title={t("Supprimer l'appareil de NasDash")} aria-label={t("Supprimer l'appareil de NasDash")}><Trash2 size={13} /></button>
            </span>
          </div>
        ))}
      </section>
    {deviceToDelete && (
      <ConfirmModal
        isOpen={!!deviceToDelete}
        onClose={() => setDeviceToDelete(null)}
        onConfirm={() => handleDeleteDevice(deviceToDelete.id)}
        title={t("Supprimer l'appareil ?")}
        description={t('confirm.deviceDeleteAndDisconnect', { name: deviceToDelete.name })}
        confirmLabel={t("Supprimer")}
        cancelLabel={t("Annuler")}
      />
    )}
    </div>
  );
}
