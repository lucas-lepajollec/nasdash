/**
 * The integration kit (browser-safe). A kit family is one widget reading one
 * kind of service: its connections get their own section in Settings →
 * Integrations, a setup guide, a place in the first-start guide, the generic
 * connection test and the generic data route `/api/widgets/kit`. Adding a
 * service to the kit takes a manifest, a server module (`kitServer.ts`), a
 * widget and its translations: `npm run new:integration` writes them.
 * See `src/integrations/README.md` → "The integration kit".
 */

/** First-start guide families a kit family joins (`FirstRunGuide`). */
export type KitGuideFamily = 'machines' | 'docker' | 'network';

export interface KitFamily {
  /** Section of Settings → Integrations (`integrations.<section>…` keys) and setup guide (`setup.<section>…`). */
  section: string;
  /** The widget type that reads these connections. */
  widget: string;
  /** Service integration ids (`<id>/manifest.ts`, lowercase letters only, as demo ids require). */
  types: readonly string[];
  guide: KitGuideFamily;
}

const FAMILIES = [
  { section: 'sync', widget: 'syncthing', types: ['syncthing'], guide: 'machines' },
  { section: 'speedtest', widget: 'speedtest', types: ['speedtest'], guide: 'network' },
  { section: 'updates', widget: 'container-updates', types: ['wud'], guide: 'docker' },
  // new:integration families
] as const satisfies readonly KitFamily[];

/** Settings → Integrations sections and setup guides brought by the kit. */
export type KitSection = (typeof FAMILIES)[number]['section'];
export const KIT_FAMILIES: readonly KitFamily[] = FAMILIES;

export const KIT_TYPES: readonly string[] = KIT_FAMILIES.flatMap(family => family.types);
export const KIT_WIDGETS: readonly string[] = KIT_FAMILIES.map(family => family.widget);
export const KIT_SECTIONS: readonly string[] = KIT_FAMILIES.map(family => family.section);

export const kitFamilyOfWidget = (widget: string): KitFamily | undefined => KIT_FAMILIES.find(family => family.widget === widget);
export const kitFamilyOfSection = (section: string): KitFamily | undefined => KIT_FAMILIES.find(family => family.section === section);
export const isKitType = (type: string) => KIT_TYPES.includes(type);

