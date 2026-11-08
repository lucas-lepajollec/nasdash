import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import type { WidgetViewProps } from '../types';
import CalmeTodo from './CalmeTodo';

export default function TodoView({ instance, editMode, onUpdateSettings }: WidgetViewProps) {
  return <WidgetContainer><CalmeTodo settings={instance.settings} editMode={editMode} onUpdateSettings={onUpdateSettings} /></WidgetContainer>;
}
