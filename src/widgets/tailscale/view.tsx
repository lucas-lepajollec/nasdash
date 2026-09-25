import TailscaleWidget from '@/components/widgets/TailscaleWidget';
import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import { useCalme } from '../calme';
import type { WidgetViewProps } from '../types';
import CalmeTailscale from './CalmeTailscale';

export default function TailscaleView({ editMode, showSensitive, isVisible }: WidgetViewProps) {
  const calme = useCalme();
  return (
    <WidgetContainer>
      {calme
        ? <CalmeTailscale editMode={editMode} showSensitive={showSensitive} isVisible={isVisible} />
        : <TailscaleWidget editMode={editMode} showSensitive={showSensitive} isVisible={isVisible} />}
    </WidgetContainer>
  );
}
