import type { WidgetSettings } from '@/lib/pages/types';

/**
 * How a device widget shows its measures, shared by Device, Fleet, the
 * one-measure widgets (CPU, RAM, GPU, temperature, load, network, storage)
 * and the machines chart. Stored in the widget settings:
 *
 * - `metrics`: per measure, `{ shown, display, color, danger }`;
 * - `display` + `perMetricDisplay`: one display for all measures, or each its own;
 * - `dangerColor`: the colour used past a danger threshold.
 *
 * Colours are only ever hex values (checked here), so settings can never
 * inject anything into a style.
 */

export type MetricId = 'cpu' | 'memory' | 'gpu' | 'temperature' | 'load' | 'network' | 'disk' | 'history';
export type Display = 'value' | 'bar' | 'ring' | 'chart';

export const DISPLAYS: readonly Display[] = ['value', 'bar', 'ring', 'chart'];

export interface MetricInfo {
  /** Displays that make sense for it (a throughput has no 0–100 scale for a bar or a ring). */
  displays: readonly Display[];
  /** Default colour: a theme variable. */
  color: string;
  /** Default danger threshold, in the measure's own unit (`null`: none). */
  danger: number | null;
  /** Threshold unit, for the settings form. */
  unit: '%' | '°C' | '×' | 'MB/s' | '';
  /** Range of the threshold input. */
  dangerRange?: { min: number; max: number; step: number };
}

export const METRIC_INFO: Record<MetricId, MetricInfo> = {
  cpu: { displays: DISPLAYS, color: 'var(--ndc-kind-cpu)', danger: 90, unit: '%', dangerRange: { min: 1, max: 100, step: 1 } },
  memory: { displays: DISPLAYS, color: 'var(--ndc-kind-memory)', danger: 90, unit: '%', dangerRange: { min: 1, max: 100, step: 1 } },
  gpu: { displays: DISPLAYS, color: 'var(--ndc-kind-gpu)', danger: 90, unit: '%', dangerRange: { min: 1, max: 100, step: 1 } },
  temperature: { displays: DISPLAYS, color: 'var(--ndc-kind-temp)', danger: 80, unit: '°C', dangerRange: { min: 30, max: 110, step: 1 } },
  // Load per core: 1× means every core is busy.
  load: { displays: DISPLAYS, color: 'var(--ndc-kind-load)', danger: 1, unit: '×', dangerRange: { min: 0.1, max: 8, step: 0.1 } },
  network: { displays: ['value', 'chart'], color: 'var(--ndc-kind-net)', danger: null, unit: 'MB/s', dangerRange: { min: 1, max: 2000, step: 1 } },
  disk: { displays: ['value', 'bar', 'ring', 'chart'], color: 'var(--ndc-kind-disk)', danger: 90, unit: '%', dangerRange: { min: 1, max: 100, step: 1 } },
  history: { displays: ['chart'], color: 'var(--ndc-kind-cpu)', danger: null, unit: '' },
};

export const DEFAULT_DANGER_COLOR = 'var(--ndc-kind-alert)';

export type ChartStyle = 'line' | 'area' | 'bars';
export type ChartSize = 'small' | 'medium' | 'large';
export const CHART_STYLES: readonly ChartStyle[] = ['area', 'line', 'bars'];
export const CHART_SIZES: readonly ChartSize[] = ['small', 'medium', 'large'];
/** Plot height of a chart display, by size and by how much room the widget gives. */
export const CHART_HEIGHT: Record<ChartSize, number> = { small: 56, medium: 96, large: 160 };

export interface ChartLook { style: ChartStyle; size: ChartSize }

/**
 * Extra figures of a one-measure widget (not per machine): CPU temperature
 * and load, GPU temperature and video memory, network upload, load averages
 * and cores, the part a temperature comes from.
 */
export type Facet = 'temperature' | 'load' | 'vram' | 'upload' | 'averages' | 'cores' | 'part';
/**
 * What RAM and disks show, any of: their share, the used size, the free
 * size, the total size (written after a size: `210 Go / 500 Go`).
 */
export type ValuePart = 'percent' | 'used' | 'free' | 'total';
export const VALUE_PARTS: readonly ValuePart[] = ['percent', 'used', 'free', 'total'];
export const DEFAULT_VALUE_PARTS: readonly ValuePart[] = ['percent', 'total'];

export const FACETS: Partial<Record<MetricId, readonly Facet[]>> = {
  cpu: ['temperature', 'load'],
  gpu: ['temperature', 'vram'],
  network: ['upload'],
  load: ['averages', 'cores'],
  temperature: ['part'],
};
export const DEFAULT_FACETS: Partial<Record<MetricId, readonly Facet[]>> = {
  cpu: ['temperature'], gpu: ['temperature'], network: ['upload'], load: ['cores'], temperature: ['part'],
};
/** Measures that have a size, so their shown values can be chosen. */
export const SIZED: readonly MetricId[] = ['memory', 'disk'];

export interface MetricLook {
  shown: boolean;
  /** Display in use (the widget's one when all measures share it). */
  display: Display;
  /** This measure's own display, kept while all share one, restored on "per measure". */
  ownDisplay: Display;
  color: string;
  /** Custom colour chosen (hex) or null for the default. */
  customColor: string | null;
  danger: number | null;
  /** Chart options in use, and this measure's own ones. */
  chart: ChartLook;
  ownChart: ChartLook | null;
}

export interface WidgetLook {
  metrics: Record<MetricId, MetricLook>;
  perMetricDisplay: boolean;
  display: Display;
  /** Chart options shared by every measure (used unless each has its own). */
  chart: ChartLook;
  dangerColor: string;
  customDangerColor: string | null;
  /** One-measure widgets: a colour per machine (hex), by device id. */
  deviceColors: Record<string, string>;
  facets: Facet[];
  /** RAM and disks: the values shown (never empty). */
  valueParts: ValuePart[];
}

/** What a widget type shows when nothing is set yet. */
export interface LookDefaults {
  /** Measures offered by the widget, in order. */
  offered: readonly MetricId[];
  shown: readonly MetricId[];
  display: Display;
  /** Per-measure defaults when each has its own display. */
  displays?: Partial<Record<MetricId, Display>>;
  /** Start with one display per measure (Device: rings, values and bars side by side). */
  perMetricDisplay?: boolean;
  chart?: ChartLook;
  facets?: readonly Facet[];
  valueParts?: readonly ValuePart[];
}

const HEX = /^#[0-9a-f]{6}$/i;
export const safeColor = (value: unknown): string | null => (typeof value === 'string' && HEX.test(value) ? value : null);

/** A display that suits the measure: the wanted one, else its first. */
export function fitDisplay(metric: MetricId, wanted: Display): Display {
  const allowed = METRIC_INFO[metric].displays;
  return allowed.includes(wanted) ? wanted : allowed.includes('value') ? 'value' : allowed[0];
}

type Stored = { shown?: unknown; display?: unknown; color?: unknown; danger?: unknown; chartStyle?: unknown; chartSize?: unknown };

const chartOf = (style: unknown, size: unknown): ChartLook | null =>
  CHART_STYLES.includes(style as ChartStyle) || CHART_SIZES.includes(size as ChartSize)
    ? { style: CHART_STYLES.includes(style as ChartStyle) ? style as ChartStyle : 'area', size: CHART_SIZES.includes(size as ChartSize) ? size as ChartSize : 'medium' }
    : null;

export function readLook(settings: WidgetSettings, defaults: LookDefaults): WidgetLook {
  const stored = (settings.metrics && typeof settings.metrics === 'object' && !Array.isArray(settings.metrics) ? settings.metrics : {}) as Record<string, Stored>;
  const display = DISPLAYS.includes(settings.display as Display) ? settings.display as Display : defaults.display;
  const perMetricDisplay = typeof settings.perMetricDisplay === 'boolean' ? settings.perMetricDisplay : defaults.perMetricDisplay ?? false;
  const chart = chartOf(settings.chartStyle, settings.chartSize) ?? defaults.chart ?? { style: 'area', size: 'medium' };
  const metrics = {} as Record<MetricId, MetricLook>;
  for (const id of Object.keys(METRIC_INFO) as MetricId[]) {
    const info = METRIC_INFO[id];
    const own = stored[id] ?? {};
    const ownDisplay = fitDisplay(id, DISPLAYS.includes(own.display as Display) ? own.display as Display : defaults.displays?.[id] ?? defaults.display);
    const ownChart = chartOf(own.chartStyle, own.chartSize);
    const customColor = safeColor(own.color);
    const danger = own.danger === null ? null : typeof own.danger === 'number' && Number.isFinite(own.danger) ? own.danger : info.danger;
    metrics[id] = {
      shown: typeof own.shown === 'boolean' ? own.shown && defaults.offered.includes(id) : defaults.shown.includes(id),
      display: perMetricDisplay ? ownDisplay : fitDisplay(id, display),
      ownDisplay,
      color: customColor ?? info.color,
      customColor,
      danger,
      chart: perMetricDisplay ? ownChart ?? chart : chart,
      ownChart,
    };
  }
  const customDangerColor = safeColor(settings.dangerColor);
  const deviceColors: Record<string, string> = {};
  if (settings.deviceColors && typeof settings.deviceColors === 'object' && !Array.isArray(settings.deviceColors)) {
    for (const [id, color] of Object.entries(settings.deviceColors)) { const safe = safeColor(color); if (safe) deviceColors[id] = safe; }
  }
  const metric = defaults.offered[0];
  const allowedFacets = defaults.offered.length === 1 ? FACETS[metric] ?? [] : [];
  const facets = (Array.isArray(settings.facets) ? settings.facets : defaults.facets ?? (defaults.offered.length === 1 ? DEFAULT_FACETS[metric] : []) ?? [])
    .filter((facet): facet is Facet => allowedFacets.includes(facet as Facet));
  const storedParts = Array.isArray(settings.valueParts) ? settings.valueParts.filter((part): part is ValuePart => VALUE_PARTS.includes(part as ValuePart)) : [];
  // Settings written before the multiple choice kept one format.
  const legacy = settings.valueFormat === 'used' || settings.valueFormat === 'free' ? [settings.valueFormat, 'total'] as ValuePart[] : [];
  const valueParts = storedParts.length ? storedParts : legacy.length ? legacy : [...(defaults.valueParts ?? DEFAULT_VALUE_PARTS)];
  return { metrics, perMetricDisplay, display, chart, dangerColor: customDangerColor ?? DEFAULT_DANGER_COLOR, customDangerColor, deviceColors, facets, valueParts };
}

/** The settings that store a look. Each measure keeps its own display and chart options. */
export function lookSettings(look: WidgetLook): WidgetSettings {
  const metrics: Record<string, { shown: boolean; display: Display; color: string | null; danger: number | null; chartStyle: ChartStyle | null; chartSize: ChartSize | null }> = {};
  for (const [id, metric] of Object.entries(look.metrics)) {
    metrics[id] = { shown: metric.shown, display: metric.ownDisplay, color: metric.customColor, danger: metric.danger, chartStyle: metric.ownChart?.style ?? null, chartSize: metric.ownChart?.size ?? null };
  }
  return {
    metrics, display: look.display, perMetricDisplay: look.perMetricDisplay, dangerColor: look.customDangerColor,
    chartStyle: look.chart.style, chartSize: look.chart.size, deviceColors: look.deviceColors, facets: look.facets, valueParts: look.valueParts, valueFormat: null,
  };
}

/** Is a value past its danger threshold? `load` is compared per core. */
export function isDanger(look: WidgetLook, metric: MetricId, value: number | undefined, cores?: number): boolean {
  const threshold = look.metrics[metric].danger;
  if (threshold === null || value === undefined || !Number.isFinite(value)) return false;
  if (metric === 'load') return value / Math.max(1, cores ?? 1) >= threshold;
  if (metric === 'network') return value / (1024 * 1024) >= threshold;
  return value >= threshold;
}

/** Colour of a measure right now: its own, or the danger colour past the threshold. */
export function colorOf(look: WidgetLook, metric: MetricId, value: number | undefined, cores?: number, base?: string): string {
  return isDanger(look, metric, value, cores) ? look.dangerColor : base ?? look.metrics[metric].color;
}

/** Fill of a measure on a 0–100 scale (bars and rings). */
export function fillOf(metric: MetricId, value: number | undefined, cores?: number): number | undefined {
  if (value === undefined) return undefined;
  if (metric === 'load') return Math.min(100, (value / Math.max(1, cores ?? 1)) * 100);
  if (metric === 'temperature') return Math.min(100, value);
  return value;
}
