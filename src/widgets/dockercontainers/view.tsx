import DockerContainersWidget from '@/components/widgets/DockerContainersWidget';
import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import { useCalme } from '../calme';
import type { WidgetViewProps } from '../types';
import CalmeDockerContainers from './CalmeDockerContainers';

export default function DockerContainersView({ instance, editMode, isVisible, onUpdateSettings }: WidgetViewProps) {
  const calme = useCalme();
  return (
    <WidgetContainer>
      {calme
        ? <CalmeDockerContainers editMode={editMode} widgetProps={instance.settings} onUpdateProps={settings => onUpdateSettings(settings)} isVisible={isVisible} />
        : <DockerContainersWidget editMode={editMode} widgetInstanceId={instance.id} widgetProps={instance.settings} onUpdateProps={settings => onUpdateSettings(settings)} isVisible={isVisible} />}
    </WidgetContainer>
  );
}
