import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import type { WidgetViewProps } from '../types';
import CalmeTailscale from './CalmeTailscale';

export default function TailscaleView({ editMode, showSensitive, isVisible }: WidgetViewProps) {
  return <WidgetContainer><CalmeTailscale editMode={editMode} showSensitive={showSensitive} isVisible={isVisible} /></WidgetContainer>;
}
