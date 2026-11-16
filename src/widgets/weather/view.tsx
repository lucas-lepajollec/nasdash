import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import type { WidgetViewProps } from '../types';
import CalmeWeather from './CalmeWeather';

export default function WeatherView({ instance, editMode, isVisible, onUpdateSettings }: WidgetViewProps) {
  return <WidgetContainer><CalmeWeather editMode={editMode} isVisible={isVisible} settings={instance.settings} onUpdateSettings={onUpdateSettings} /></WidgetContainer>;
}
