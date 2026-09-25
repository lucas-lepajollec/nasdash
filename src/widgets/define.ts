import type { ReadAccessRequirement } from '@/lib/access';
import type { WidgetSettings } from '@/lib/pages/types';

/**
 * Server-safe description of one widget type, written in
 * `src/widgets/<type>/definition.ts`. It drives validation, access filtering,
 * the migration, the widget library and resizing. The display lives next to
 * it in `view.tsx`.
 */

export type WidgetGroup = 'services' | 'system' | 'docker' | 'network' | 'gadgets' | 'layout';

export interface WidgetDefinition {
  type: string;
  group: WidgetGroup;
  /** Emoji or `lucide:Name`, rendered by the shared Emoji component. */
  icon: string;
  /** Semantic i18n keys. */
  nameKey: string;
  descriptionKey: string;
  /**
   * `formats`: the only widths (columns out of 24) the widget can be resized
   * to, where its content is laid out well; `default`: width when added (one
   * of the formats); `minPx`: smallest usable width in pixels (narrower
   * formats are not offered on small screens); `h`: typical height in pixels,
   * used before the content is measured (the height always follows the content).
   */
  sizes: { formats: readonly number[]; default: number; minPx: number; h: number };
  /** Maximum instances across all pages (e.g. the editable topology). */
  maxInstances?: number;
  /**
   * Visibility for non-admin users: a historical per-user widget permission,
   * a page read requirement, or `null` for anyone who can open the page.
   * Server routes still enforce their own checks on every request.
   */
  access: { permission: string } | { requirement: ReadAccessRequirement } | null;
  /** Settings modal section that configures shared options of this type. */
  settingsTab?: string;
  /** Widgets of the same link group share page-level state (active host…). */
  linkGroup?: 'docker';
  defaultSettings?: WidgetSettings;
  /** Hidden from the library (created through dedicated flows). */
  internal?: boolean;
}

/** Identity function that type-checks a definition file. */
export function defineWidget(definition: WidgetDefinition): WidgetDefinition {
  return definition;
}
