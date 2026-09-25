import { useConfig } from '@/hooks/useConfig';
import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import CalmeDevice from '../devices/CalmeDevice';
import type { WidgetViewProps } from '../types';

export default function DeviceView({ instance, editMode, isVisible, showSensitive, onUpdateSettings }: WidgetViewProps) {
  const { config } = useConfig();
  return (
    <WidgetContainer>
      <CalmeDevice devices={config?.devices || []} settings={instance.settings} editMode={editMode} isVisible={isVisible} showSensitive={showSensitive} onUpdateSettings={settings => onUpdateSettings({ ...instance.settings, ...settings })} />
    </WidgetContainer>
  );
}
