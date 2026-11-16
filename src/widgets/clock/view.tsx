import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import type { WidgetViewProps } from '../types';
import CalmeClock from './CalmeClock';

export default function ClockView({ instance, editMode, isVisible, onUpdateSettings }: WidgetViewProps) {
  return <WidgetContainer><CalmeClock editMode={editMode} isVisible={isVisible} settings={instance.settings} onUpdateSettings={onUpdateSettings} /></WidgetContainer>;
}
