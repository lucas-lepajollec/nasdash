import { DockerSummaryWidget } from '@/components/widgets/docker/DockerPageWidgets';
import type { WidgetViewProps } from '../types';

export default function DockerSummaryView({ editMode, onRemoveView }: WidgetViewProps) {
  return <DockerSummaryWidget editMode={editMode} onRemove={onRemoveView} />;
}
