import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import type { WidgetViewProps } from '../types';
import CalmeWebpage from './CalmeWebpage';

export default function WebpageView({ instance, editMode, onUpdateSettings }: WidgetViewProps) {
  return <WidgetContainer><CalmeWebpage settings={instance.settings} editMode={editMode} onUpdateSettings={onUpdateSettings} /></WidgetContainer>;
}
