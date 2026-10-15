import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import type { WidgetViewProps } from '../types';
import CalmeBookmarks from './CalmeBookmarks';

export default function BookmarksView({ instance, editMode, onUpdateSettings }: WidgetViewProps) {
  return <WidgetContainer><CalmeBookmarks widgetId={instance.id} settings={instance.settings} editMode={editMode} onUpdateSettings={onUpdateSettings} /></WidgetContainer>;
}
