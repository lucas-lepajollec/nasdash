import { useConfig } from '@/hooks/useConfig';
import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import type { WidgetViewProps } from '../types';
import CalmeQuickStats from './CalmeQuickStats';

export default function QuickStatsView({ editMode }: WidgetViewProps) {
  const { config } = useConfig();
  return <WidgetContainer><CalmeQuickStats categories={config?.categories || []} editMode={editMode} /></WidgetContainer>;
}
