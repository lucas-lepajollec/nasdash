import { useConfig } from '@/hooks/useConfig';
import DevicesWidget from '@/components/widgets/DevicesWidget';
import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import { useCalme } from '../calme';
import type { WidgetViewProps } from '../types';
import CalmeFleet from './CalmeFleet';

/** Calme: the Fleet (one line per machine); Classic: the historical cards. */
export default function DevicesView({ instance, editMode, isVisible, onUpdateSettings }: WidgetViewProps) {
  const calme = useCalme();
  const { config, setDeviceModal, deleteDevice, reorderDevices } = useConfig();
  return (
    <WidgetContainer>
      {calme ? (
        <CalmeFleet devices={config?.devices || []} settings={instance.settings} editMode={editMode} isVisible={isVisible} onUpdateSettings={settings => onUpdateSettings({ ...instance.settings, ...settings })} />
      ) : (
        <DevicesWidget
          devices={config?.devices || []}
          editMode={editMode}
          widgetInstanceId={instance.id}
          widgetProps={instance.settings}
          onUpdateProps={settings => onUpdateSettings(settings)}
          onAddDevice={() => setDeviceModal({ open: true })}
          onEditDevice={device => setDeviceModal({ open: true, device })}
          onDeleteDevice={async deviceId => { await deleteDevice(deviceId); setDeviceModal({ open: false }); }}
          onReorderDevices={reorderDevices}
          isVisible={isVisible}
        />
      )}
    </WidgetContainer>
  );
}
