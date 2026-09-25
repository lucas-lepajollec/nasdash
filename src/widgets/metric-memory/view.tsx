import { useConfig } from '@/hooks/useConfig';
import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import CalmeMetric from '../devices/CalmeMetric';
import type { WidgetViewProps } from '../types';

export default function MetricView({ instance, editMode, isVisible, onUpdateSettings }: WidgetViewProps) {
  const { config } = useConfig();
  return (
    <WidgetContainer>
      <CalmeMetric metric="memory" devices={config?.devices || []} settings={instance.settings} editMode={editMode} isVisible={isVisible} onUpdateSettings={settings => onUpdateSettings({ ...instance.settings, ...settings })} />
    </WidgetContainer>
  );
}
