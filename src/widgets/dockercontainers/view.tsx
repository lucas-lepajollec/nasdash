import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import type { WidgetViewProps } from '../types';
import CalmeDockerContainers from './CalmeDockerContainers';

export default function DockerContainersView({ instance, editMode, isVisible, onUpdateSettings }: WidgetViewProps) {
  return (
    <WidgetContainer>
      <CalmeDockerContainers editMode={editMode} widgetProps={instance.settings} onUpdateProps={settings => onUpdateSettings(settings)} isVisible={isVisible} />
    </WidgetContainer>
  );
}
