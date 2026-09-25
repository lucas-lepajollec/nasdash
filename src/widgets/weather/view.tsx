import WeatherWidget from '@/components/widgets/WeatherWidget';
import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import { useCalme } from '../calme';
import type { WidgetViewProps } from '../types';
import CalmeWeather from './CalmeWeather';

export default function WeatherView({ editMode, isVisible }: WidgetViewProps) {
  const calme = useCalme();
  return (
    <WidgetContainer>
      {calme ? <CalmeWeather editMode={editMode} isVisible={isVisible} /> : <WeatherWidget editMode={editMode} isVisible={isVisible} />}
    </WidgetContainer>
  );
}
