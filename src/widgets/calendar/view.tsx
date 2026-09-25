import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import type { WidgetViewProps } from '../types';
import CalmeCalendar from './CalmeCalendar';

export default function CalendarView({ editMode, isVisible }: WidgetViewProps) {
  return <WidgetContainer><CalmeCalendar editMode={editMode} isVisible={isVisible} /></WidgetContainer>;
}
