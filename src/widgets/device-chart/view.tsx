import { useConfig } from '@/hooks/useConfig';
import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import CalmeMetric from '../devices/CalmeMetric';
import type { MetricId } from '../devices/look';
import type { WidgetSettings } from '@/lib/pages/types';
import type { WidgetViewProps } from '../types';

const METRICS: MetricId[] = ['cpu', 'memory', 'gpu', 'temperature', 'network'];

/**
 * The former machines chart, now covered by the one-measure widgets: an
 * existing one is shown as the one-measure widget of its measure, drawn as
 * a chart, with its machines, style and height. Hidden from the library.
 */
export default function DeviceChartView({ instance, editMode, isVisible, onUpdateSettings }: WidgetViewProps) {
  const { config } = useConfig();
  const saved = instance.settings;
  const metric = METRICS.includes(saved.metric as MetricId) ? saved.metric as MetricId : 'cpu';
  const settings: WidgetSettings = {
    display: 'chart',
    chartStyle: saved.chartStyle === 'bars' || saved.chartStyle === 'area' ? saved.chartStyle : 'line',
    chartSize: saved.size === 'small' || saved.size === 'large' ? saved.size : 'medium',
    ...saved,
  };
  return (
    <WidgetContainer>
      <CalmeMetric metric={metric} devices={config?.devices || []} settings={settings} editMode={editMode} isVisible={isVisible} onUpdateSettings={next => onUpdateSettings({ ...saved, ...next })} />
    </WidgetContainer>
  );
}
