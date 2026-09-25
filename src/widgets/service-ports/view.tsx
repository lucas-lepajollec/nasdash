import { useConfig } from '@/hooks/useConfig';
import type { WidgetViewProps } from '../types';
import CalmeServicePorts from './CalmeServicePorts';

export default function ServicePortsView({ editMode, showSensitive, onToggleSecretSections }: WidgetViewProps) {
  const { config } = useConfig();
  return <CalmeServicePorts categories={config?.categories || []} showSensitive={showSensitive} onToggleSecretSections={onToggleSecretSections} editMode={editMode} />;
}
