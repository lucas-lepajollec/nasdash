import { TopologyMap } from '@/components/tabs/networks/TopologyMap';
import type { WidgetViewProps } from '../types';

export default function NetworkTopologyView({ editMode, searchQuery, showSensitive }: WidgetViewProps) {
  return (
    <div className="nd-networks-main nd-page-network-topology">
      <TopologyMap editMode={editMode} searchQuery={searchQuery} showSensitive={showSensitive} />
    </div>
  );
}
