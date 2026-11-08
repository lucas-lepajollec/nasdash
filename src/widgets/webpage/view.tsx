import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import type { WidgetViewProps } from '../types';
import CalmeWebpage from './CalmeWebpage';

export default function WebpageView({ instance, editMode, isVisible, onUpdateSettings }: WidgetViewProps) {
  return <WidgetContainer><CalmeWebpage settings={instance.settings} editMode={editMode} isVisible={isVisible} onUpdateSettings={onUpdateSettings} /></WidgetContainer>;
}
