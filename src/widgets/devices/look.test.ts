import { describe, expect, it } from 'vitest';
import { colorOf, fillOf, fitDisplay, isDanger, lookSettings, readLook, safeColor, type LookDefaults } from './look';

const defaults: LookDefaults = { offered: ['cpu', 'memory', 'temperature', 'network', 'load'], shown: ['cpu', 'temperature'], display: 'bar', perMetricDisplay: true, displays: { temperature: 'value' } };

describe('device widget look', () => {
  it('starts from the widget defaults and coherent danger thresholds', () => {
    const look = readLook({}, defaults);
    expect(look.metrics.cpu).toMatchObject({ shown: true, display: 'bar', danger: 90, customColor: null });
    expect(look.metrics.temperature).toMatchObject({ shown: true, display: 'value', danger: 80 });
    expect(look.metrics.memory.shown).toBe(false);
    expect(look.metrics.network.danger).toBeNull();
    expect(look.metrics.load.danger).toBe(1);
  });

  it('keeps what was chosen, and one display for all when asked', () => {
    const look = readLook({ metrics: { memory: { shown: true, color: '#ff0000', danger: 70 } }, dangerColor: '#00ff00' }, defaults);
    expect(look.metrics.memory).toMatchObject({ shown: true, color: '#ff0000', danger: 70 });
    expect(look.dangerColor).toBe('#00ff00');
    const same = readLook({ perMetricDisplay: false, display: 'ring' }, defaults);
    expect(same.metrics.temperature.display).toBe('ring');
    // A throughput has no ring: it falls back to a figure.
    expect(same.metrics.network.display).toBe('value');
    expect(readLook(lookSettings(look), defaults)).toEqual(look);
  });

  it('never lets a setting put anything but a hex colour into a style', () => {
    expect(safeColor('#12abEF')).toBe('#12abEF');
    expect(safeColor('red; background: url(x)')).toBeNull();
    expect(readLook({ metrics: { cpu: { color: 'url(javascript:1)' } }, dangerColor: 'expression(1)' }, defaults).metrics.cpu.color).toBe('var(--ndc-kind-cpu)');
    expect(fitDisplay('network', 'bar')).toBe('value');
  });

  it('switches to the danger colour past the threshold (load per core, network in MB/s)', () => {
    const look = readLook({ metrics: { network: { danger: 10 } } }, defaults);
    expect(isDanger(look, 'cpu', 95)).toBe(true);
    expect(isDanger(look, 'cpu', 40)).toBe(false);
    expect(isDanger(look, 'load', 7, 8)).toBe(false);
    expect(isDanger(look, 'load', 9, 8)).toBe(true);
    expect(isDanger(look, 'network', 12 * 1024 * 1024)).toBe(true);
    expect(colorOf(look, 'cpu', 95)).toBe(look.dangerColor);
    expect(readLook({ metrics: { cpu: { danger: null } } }, defaults).metrics.cpu.danger).toBeNull();
    expect(fillOf('load', 4, 8)).toBe(50);
    expect(fillOf('temperature', 130)).toBe(100);
  });

  it('keeps each measure its own display while all share one, and gives it back', () => {
    const start = readLook({}, defaults);
    const shared = readLook(lookSettings({ ...start, perMetricDisplay: false, display: 'ring' }), defaults);
    expect(shared.metrics.temperature.display).toBe('ring');
    const back = readLook(lookSettings({ ...shared, perMetricDisplay: true }), defaults);
    expect(back.metrics.temperature.display).toBe('value');
    expect(back.metrics.cpu.display).toBe('bar');
  });

  it('reads chart options, machine colours and the options of one-measure widgets', () => {
    const one: LookDefaults = { offered: ['memory'], shown: ['memory'], display: 'bar' };
    const look = readLook({ chartStyle: 'bars', chartSize: 'large', deviceColors: { nas: '#123456', bad: 'red' }, valueParts: ['used', 'total', 'nope'], facets: ['vram'] }, one);
    expect(look.chart).toEqual({ style: 'bars', size: 'large' });
    expect(look.deviceColors).toEqual({ nas: '#123456' });
    expect(look.valueParts).toEqual(['used', 'total']);
    // Defaults: the share and the total; a former single format is kept.
    expect(readLook({}, one).valueParts).toEqual(['percent', 'total']);
    expect(readLook({ valueFormat: 'free' }, one).valueParts).toEqual(['free', 'total']);
    // RAM has no extra figures: an unknown one is dropped.
    expect(look.facets).toEqual([]);
    expect(readLook({}, { offered: ['cpu'], shown: ['cpu'], display: 'bar' }).facets).toEqual(['temperature']);
  });
});

