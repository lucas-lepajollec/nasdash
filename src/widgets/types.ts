import type { WidgetInstance, WidgetSettings } from '@/lib/pages/types';

/** What every widget view receives from the page. */
export interface WidgetViewProps {
  pageId: string;
  instance: WidgetInstance;
  editMode: boolean;
  isVisible: boolean;
  showSensitive: boolean;
  searchQuery: string;
  showSecretSections: boolean;
  onToggleSecretSections: () => void;
  onUpdateSettings: (settings: WidgetSettings) => void;
  /** Removes this view from the page (used after deleting its resource). */
  onRemoveView: () => void;
}
