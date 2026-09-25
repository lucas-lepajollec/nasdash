import { NetworkSidebar } from '@/components/tabs/networks/NetworkSidebar';
import type { WidgetViewProps } from '../types';

export default function NetworkToolsView({ showSensitive }: WidgetViewProps) {
  return <div className="nd-page-network-tools"><NetworkSidebar showSensitive={showSensitive} /></div>;
}
