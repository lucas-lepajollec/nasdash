import CalendarWidget from '@/components/widgets/CalendarWidget';
import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import { useCalme } from '../calme';
import type { WidgetViewProps } from '../types';
import CalmeCalendar from './CalmeCalendar';

export default function CalendarView({ editMode, isVisible }: WidgetViewProps) {
  const calme = useCalme();
  return (
    <WidgetContainer>
      {calme ? <CalmeCalendar editMode={editMode} isVisible={isVisible} /> : <CalendarWidget editMode={editMode} isVisible={isVisible} />}
    </WidgetContainer>
  );
}
