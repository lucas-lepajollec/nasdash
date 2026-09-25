import NetworkGraphWidget from '@/components/widgets/NetworkGraphWidget';
import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import { useCalme } from '../calme';
import type { WidgetViewProps } from '../types';
import CalmeNetworkGraph from './CalmeNetworkGraph';

export default function NetworkGraphView({ editMode, isVisible }: WidgetViewProps) {
  const calme = useCalme();
  return <WidgetContainer>{calme ? <CalmeNetworkGraph editMode={editMode} isVisible={isVisible} /> : <NetworkGraphWidget editMode={editMode} />}</WidgetContainer>;
}
