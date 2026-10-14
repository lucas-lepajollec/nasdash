import { DockerHostsWidget } from '@/components/widgets/docker/DockerPageWidgets';
import type { WidgetViewProps } from '../types';

export default function DockerHostsView({ editMode, instance, onUpdateSettings }: WidgetViewProps) {
  return <DockerHostsWidget editMode={editMode} settings={instance.settings} onUpdateSettings={onUpdateSettings} />;
}
