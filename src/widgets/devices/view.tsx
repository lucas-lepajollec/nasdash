import { useConfig } from '@/hooks/useConfig';
import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import type { WidgetViewProps } from '../types';
import CalmeFleet from './CalmeFleet';

/** The Fleet: one line per machine. */
export default function DevicesView({ instance, editMode, isVisible, onUpdateSettings }: WidgetViewProps) {
  const { config } = useConfig();
  return (
    <WidgetContainer>
      <CalmeFleet devices={config?.devices || []} settings={instance.settings} editMode={editMode} isVisible={isVisible} onUpdateSettings={settings => onUpdateSettings({ ...instance.settings, ...settings })} />
    </WidgetContainer>
  );
}
