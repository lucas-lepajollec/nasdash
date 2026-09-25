import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import type { WidgetViewProps } from '../types';
import CalmeWeather from './CalmeWeather';

export default function WeatherView({ editMode, isVisible }: WidgetViewProps) {
  return <WidgetContainer><CalmeWeather editMode={editMode} isVisible={isVisible} /></WidgetContainer>;
}
