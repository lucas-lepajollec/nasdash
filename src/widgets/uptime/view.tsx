import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import type { WidgetViewProps } from '../types';
import CalmeUptime from './CalmeUptime';

export default function UptimeView({ instance, editMode, isVisible, onUpdateSettings }: WidgetViewProps) {
  return <WidgetContainer><CalmeUptime widgetId={instance.id} settings={instance.settings} editMode={editMode} isVisible={isVisible} onUpdateSettings={onUpdateSettings} /></WidgetContainer>;
}
