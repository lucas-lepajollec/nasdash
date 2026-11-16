import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import type { WidgetViewProps } from '../types';
import CalmeNotifications from './CalmeNotifications';

export default function NotificationsView({ instance, editMode, isVisible, onUpdateSettings }: WidgetViewProps) {
  return <WidgetContainer><CalmeNotifications widgetId={instance.id} settings={instance.settings} editMode={editMode} isVisible={isVisible} onUpdateSettings={onUpdateSettings} /></WidgetContainer>;
}
