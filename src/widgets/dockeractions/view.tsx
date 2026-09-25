import DockerWidget from '@/components/widgets/DockerWidget';
import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import type { WidgetViewProps } from '../types';

export default function DockerActionsView({ editMode }: WidgetViewProps) {
  return <WidgetContainer><DockerWidget editMode={editMode} /></WidgetContainer>;
}
