import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import type { WidgetViewProps } from '../types';
import CalmeNotes from './CalmeNotes';

export default function NotesView({ instance, editMode, onUpdateSettings }: WidgetViewProps) {
  return <WidgetContainer><CalmeNotes settings={instance.settings} editMode={editMode} onUpdateSettings={onUpdateSettings} /></WidgetContainer>;
}
