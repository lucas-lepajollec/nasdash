import { useVisibleCategories } from '@/hooks/useVisibleCategories';
import type { WidgetViewProps } from '../types';
import CalmeServicePorts from './CalmeServicePorts';

export default function ServicePortsView({ editMode, showSensitive }: WidgetViewProps) {
  const categories = useVisibleCategories();
  return <CalmeServicePorts categories={categories} showSensitive={showSensitive} editMode={editMode} />;
}
