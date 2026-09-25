import { useConfig } from '@/hooks/useConfig';
import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import CalmeMetric from '../devices/CalmeMetric';
import type { WidgetViewProps } from '../types';

/** Every disk of every machine: the one-measure widget for disks. */
export default function StorageView({ instance, editMode, isVisible, onUpdateSettings }: WidgetViewProps) {
  const { config } = useConfig();
  return (
    <WidgetContainer>
      <CalmeMetric metric="disk" devices={config?.devices || []} settings={instance.settings} editMode={editMode} isVisible={isVisible} onUpdateSettings={settings => onUpdateSettings({ ...instance.settings, ...settings })} />
    </WidgetContainer>
  );
}
