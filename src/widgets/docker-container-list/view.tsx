import { DockerContainerListWidget } from '@/components/widgets/docker/DockerPageWidgets';
import type { WidgetViewProps } from '../types';

export default function DockerContainerListView({ instance, editMode, searchQuery, onUpdateSettings }: WidgetViewProps) {
  return <DockerContainerListWidget editMode={editMode} searchQuery={searchQuery} settings={instance.settings} onUpdateSettings={onUpdateSettings} />;
}
