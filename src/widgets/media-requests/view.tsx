import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import type { WidgetViewProps } from '../types';
import CalmeMediaRequests from './CalmeMediaRequests';

export default function MediaRequestsView({ instance, editMode, isVisible, onUpdateSettings }: WidgetViewProps) {
  return <WidgetContainer><CalmeMediaRequests widgetId={instance.id} settings={instance.settings} editMode={editMode} isVisible={isVisible} onUpdateSettings={onUpdateSettings} /></WidgetContainer>;
}
