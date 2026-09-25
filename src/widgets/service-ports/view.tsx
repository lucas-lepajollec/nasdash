import { useConfig } from '@/hooks/useConfig';
import Footer from '@/components/layout/Footer';
import { useCalme } from '../calme';
import type { WidgetViewProps } from '../types';
import CalmeServicePorts from './CalmeServicePorts';

export default function ServicePortsView({ editMode, showSecretSections, showSensitive, onToggleSecretSections }: WidgetViewProps) {
  const { config } = useConfig();
  const calme = useCalme();
  const categories = config?.categories || [];
  if (calme) {
    return <CalmeServicePorts categories={categories} showSensitive={showSensitive} onToggleSecretSections={onToggleSecretSections} editMode={editMode} />;
  }
  return (
    <Footer
      embedded
      editMode={editMode}
      categories={categories}
      showSecretSections={showSecretSections}
      showSensitive={showSensitive}
      onToggleSecretSections={onToggleSecretSections}
    />
  );
}
