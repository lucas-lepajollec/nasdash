import ClockWidget from '@/components/widgets/ClockWidget';
import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import { useCalme } from '../calme';
import type { WidgetViewProps } from '../types';
import CalmeClock from './CalmeClock';

export default function ClockView({ editMode, isVisible }: WidgetViewProps) {
  const calme = useCalme();
  return <WidgetContainer>{calme ? <CalmeClock editMode={editMode} isVisible={isVisible} /> : <ClockWidget editMode={editMode} />}</WidgetContainer>;
}
