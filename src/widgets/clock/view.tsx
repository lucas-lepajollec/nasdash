import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import type { WidgetViewProps } from '../types';
import CalmeClock from './CalmeClock';

export default function ClockView({ editMode, isVisible }: WidgetViewProps) {
  return <WidgetContainer><CalmeClock editMode={editMode} isVisible={isVisible} /></WidgetContainer>;
}
