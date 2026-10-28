import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import type { WidgetViewProps } from '../types';
import CalmeVpn from './CalmeVpn';

export default function VpnView({ instance, editMode, isVisible, onUpdateSettings }: WidgetViewProps) {
  return <WidgetContainer><CalmeVpn widgetId={instance.id} settings={instance.settings} editMode={editMode} isVisible={isVisible} onUpdateSettings={onUpdateSettings} /></WidgetContainer>;
}
