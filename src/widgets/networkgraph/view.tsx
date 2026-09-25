import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import type { WidgetViewProps } from '../types';
import CalmeNetworkGraph from './CalmeNetworkGraph';

export default function NetworkGraphView({ editMode, isVisible }: WidgetViewProps) {
  return <WidgetContainer><CalmeNetworkGraph editMode={editMode} isVisible={isVisible} /></WidgetContainer>;
}
