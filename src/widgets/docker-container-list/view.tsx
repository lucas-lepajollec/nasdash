import { DockerContainerListWidget } from '@/components/widgets/docker/DockerPageWidgets';
import type { WidgetViewProps } from '../types';

export default function DockerContainerListView({ editMode, searchQuery }: WidgetViewProps) {
  return <DockerContainerListWidget editMode={editMode} searchQuery={searchQuery} />;
}
