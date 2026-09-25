import { DockerExplorerWidget } from '@/components/widgets/docker/DockerPageWidgets';
import type { WidgetViewProps } from '../types';

export default function DockerExplorerView({ editMode, showSensitive, isVisible }: WidgetViewProps) {
  return <DockerExplorerWidget editMode={editMode} showSensitive={showSensitive} isVisible={isVisible} />;
}
