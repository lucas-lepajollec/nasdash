import { DockerHostsWidget } from '@/components/widgets/docker/DockerPageWidgets';
import type { WidgetViewProps } from '../types';

export default function DockerHostsView({ editMode }: WidgetViewProps) {
  return <DockerHostsWidget editMode={editMode} />;
}
