import { useVisibleCategories } from '@/hooks/useVisibleCategories';
import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import type { WidgetViewProps } from '../types';
import CalmeQuickStats from './CalmeQuickStats';

export default function QuickStatsView({ editMode }: WidgetViewProps) {
  const categories = useVisibleCategories();
  return <WidgetContainer><CalmeQuickStats categories={categories} editMode={editMode} /></WidgetContainer>;
}
