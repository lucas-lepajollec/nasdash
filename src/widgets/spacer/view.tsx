import type { WidgetViewProps } from '../types';

/** Empty room kept from older layouts; visible only while editing. */
export default function SpacerView({ editMode }: WidgetViewProps) {
  return <div className={`nd-page-spacer ${editMode ? 'nd-page-spacer--editing' : ''}`} />;
}
