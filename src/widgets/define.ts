import type { ReadAccessRequirement } from '@/lib/access';
import type { WidgetSettings } from '@/lib/pages/types';

/**
 * Server-safe description of one widget type, written in
 * `src/widgets/<type>/definition.ts`. It drives validation, access filtering,
 * the migration, the widget library and resizing. The display lives next to
 * it in `view.tsx`.
 */

export type WidgetGroup = 'services' | 'system' | 'docker' | 'network' | 'media' | 'music' | 'downloads' | 'content' | 'gadgets' | 'layout';

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
  /** Still being shaped: the library and its settings say so. */
  experimental?: boolean;
  /** Settings modal section that configures shared options of this type. */
  settingsTab?: string;
  /** Widgets of the same link group share page-level state (active host…). */
  linkGroup?: 'docker';
  defaultSettings?: WidgetSettings;
  /** Hidden from the library (created through dedicated flows). */
  internal?: boolean;
}

/**
 * The sizes policy: a widget fits every width (`ALL_WIDTHS`, from a quarter of
 * a phone to the whole page) and lays itself out more compactly when narrow,
 * with its container queries. Only widgets that mean nothing small keep
 * `WIDE_WIDTHS` or a short list (the Docker explorer, the topology, a web page).
 */
/** Every column from 3 to 24: resizing never skips an in-between width. */
export const ALL_WIDTHS: readonly number[] = Array.from({ length: 22 }, (_, index) => index + 3);
export const WIDE_WIDTHS = [12, 16, 18, 20, 24] as const;

/** Identity function that type-checks a definition file. */
export function defineWidget(definition: WidgetDefinition): WidgetDefinition {
  return definition;
}
