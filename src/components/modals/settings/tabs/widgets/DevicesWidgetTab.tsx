import React, { useState } from 'react';
import { useConfig } from '@/hooks/useConfig';
import { Pencil, Trash2, Plus, HardDrive } from 'lucide-react';
import ConfirmModal from '../../../ConfirmModal';
import { Device } from '@/lib/types';
import { Emoji } from '../../../../shared/Emoji';
import { useI18n } from '@/i18n/I18nProvider';
import { WidgetPlacementNote } from '../../shared/WidgetPlacementNote';
import { useCalme } from '@/widgets/calme';
import { CalmeHeading } from '../../shared/CalmeControls';

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

  const calme = useCalme();
  if (calme) {
    return (
      <div className="ndc-set-page">
        <WidgetPlacementNote type="devices" />
        <section className="ndc-set-block">
          <CalmeHeading action={(
            <button type="button" className="ndc-text-button" onClick={handleAddDevice}><Plus size={12} style={{ verticalAlign: -2 }} /> {t("Ajouter")}</button>
          )}>{t('settings.calme.devices')}</CalmeHeading>
          {devicesList.length === 0 && <div className="ndc-set-empty">{t("Aucun appareil connecté pour le moment. Cliquez sur &quot;Ajouter&quot; pour lier un serveur.")}</div>}
          {devicesList.map(dev => (
            <div key={dev.id} className="ndc-lib-row ndc-lib-row--actions">
              <span className="ndc-lib-icon"><Emoji emoji={dev.icon || '🖥️'} /></span>
              <span className="ndc-lib-name" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <span>{dev.name}</span>
                <span className="ndc-set-list-sub">{[dev.host, dev.api?.ip].filter(Boolean).join(' · ') || t("IP inconnue")}</span>
              </span>
              <span className="ndc-tag">{dev.api?.type || 'glances'}</span>
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <WidgetPlacementNote type="devices" />

      {/* Centralized Devices Manager */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--nd-card-border)', paddingBottom: 8 }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--nd-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <HardDrive size={14} style={{ color: 'var(--nd-orange)' }} />
            {t("Liste des appareils connectés")}
          </span>
          <button
            onClick={handleAddDevice}
            className="nd-btn nd-btn-accent"
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: '0.68rem', height: 26 }}
          >
            <Plus size={12} />
            {t("Ajouter")}
          </button>
        </div>

        {devicesList.length === 0 ? (
          <div style={{ padding: '24px 12px', textAlign: 'center', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--nd-card-border)', borderRadius: 'var(--nd-card-radius)' }}>
            <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--nd-text-muted)' }}>
              {t("Aucun appareil connecté pour le moment. Cliquez sur &quot;Ajouter&quot; pour lier un serveur.")}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {devicesList.map((dev) => (
              <div
                key={dev.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--nd-card-border)',
                  borderRadius: 'var(--nd-card-radius)',
                  transition: 'all 0.2s ease',
                  gap: 12
                }}
                className="nd-weather-card-hover"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: '1.1rem', flexShrink: 0, display: 'flex', alignItems: 'center' }}><Emoji emoji={dev.icon || '🖥️'} /></span>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--nd-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {dev.name}
                    </span>
                    <span style={{ fontSize: '0.62rem', color: 'var(--nd-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {dev.host || t("Pas de description")} • <code style={{ fontSize: '0.6rem', color: 'var(--nd-text-dimmed)' }}>{dev.api?.ip || t("IP inconnue")}</code>
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <span style={{ fontSize: '0.58rem', fontWeight: 600, color: 'var(--nd-accent)', background: 'rgba(var(--nd-accent-rgb, 128,128,128), 0.1)', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>
                    {dev.api?.type || 'glances'}
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="nd-action-icon accent"
                      onClick={() => handleEditDevice(dev)}
                      title={t("Modifier les informations de connexion")}
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      className="nd-action-icon danger"
                      onClick={() => setDeviceToDelete(dev)}
                      title={t("Supprimer l'appareil de NasDash")}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
