import { useConfig } from '@/hooks/useConfig';
import QuickStatsWidget from '@/components/widgets/QuickStatsWidget';
import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import { useCalme } from '../calme';
import type { WidgetViewProps } from '../types';
import CalmeQuickStats from './CalmeQuickStats';

export default function QuickStatsView({ editMode }: WidgetViewProps) {
  const { config } = useConfig();
  const calme = useCalme();
  const categories = config?.categories || [];
  return (
    <WidgetContainer>
      {calme ? <CalmeQuickStats categories={categories} editMode={editMode} /> : <QuickStatsWidget categories={categories} editMode={editMode} />}
    </WidgetContainer>
  );
}
