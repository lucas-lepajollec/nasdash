import { describe, expect, it } from 'vitest';
import { deviceGroupOrder, metricEntryId, moveMetricEntry, orderMetricEntries, readingOrderId, savedMetricOrder } from './order';

describe('widget-local metric order', () => {
  it('defaults display groups safely and keeps hidden groups in custom positions', () => {
    expect(deviceGroupOrder(undefined)).toEqual(['ring', 'value', 'bar', 'chart']);
    expect(deviceGroupOrder(['bar', 'invalid', 'bar', 5, 'ring'])).toEqual(['bar', 'ring', 'value', 'chart']);
    expect(moveMetricEntry(deviceGroupOrder(undefined), ['ring', 'bar', 'chart'], 'bar', 'ring')).toEqual(['bar', 'value', 'ring', 'chart']);
  });
  it('keeps CPU readings stable and multiple GPU temperatures distinct', () => {
    expect(readingOrderId('nas', { metric: 'temperature', key: 'cpu@temp' })).toBe(readingOrderId('nas', { metric: 'temperature', key: 'gpu:0@temp' }));
    expect(readingOrderId('nas', { metric: 'gpuTemperature', key: 'gpu:a@temp' })).not.toBe(readingOrderId('nas', { metric: 'gpuTemperature', key: 'gpu:b@temp' }));
    expect(readingOrderId('nas', { metric: 'temperature', key: 'cpu@temp' })).not.toBe(readingOrderId('nas', { metric: 'gpuTemperature', key: 'gpu:a@temp' }));
    expect(readingOrderId('nas', { metric: 'network', key: 'net.rx' })).toBe(readingOrderId('nas', { metric: 'network', key: 'net.total' }));
    expect(readingOrderId('nas', { metric: 'gpu', key: 'gpu:0' })).not.toBe(readingOrderId('nas', { metric: 'gpu', key: 'gpu:1' }));
  });
  it('distinguishes equal volume keys on different hosts and delimiter-like names', () => {
    expect(metricEntryId('a', 'disk:/')).not.toBe(metricEntryId('b', 'disk:/'));
    expect(metricEntryId('a|b', 'c')).not.toBe(metricEntryId('a', 'b|c'));
  });
  it('keeps unsaved readings in input order and tolerates invalid saved settings', () => {
    expect(savedMetricOrder(['a', 12, 'a', null, 'b'])).toEqual(['a', 'b']);
    expect(orderMetricEntries(['b', 'a'], {}, id => id)).toEqual(['b', 'a']);
  });
  it('keeps saved order across input refreshes and appends new readings', () => {
    expect(orderMetricEntries(['new', 'a', 'b'], ['b', 'missing', 'a'], id => id)).toEqual(['b', 'a', 'new']);
    expect(orderMetricEntries(['b', 'new', 'a'], ['b', 'missing', 'a'], id => id)).toEqual(['b', 'a', 'new']);
  });
  it('reorders the visible subset and retains slots for temporarily absent metrics', () => {
    expect(moveMetricEntry(['a', 'offline', 'b'], ['a', 'b', 'new'], 'new', 'a')).toEqual(['new', 'offline', 'a', 'b']);
    expect(orderMetricEntries(['a', 'offline', 'b', 'new'], ['new', 'offline', 'a', 'b'], id => id)).toEqual(['new', 'offline', 'a', 'b']);
  });
  it('does not mutate inputs or save an invalid/cancelled move', () => {
    const saved = ['a', 'b'];
    expect(moveMetricEntry(saved, saved, 'a', 'b')).toEqual(['b', 'a']);
    expect(saved).toEqual(['a', 'b']);
    expect(moveMetricEntry(saved, saved, 'a', 'a')).toBeNull();
    expect(moveMetricEntry(saved, saved, 'a', 'elsewhere')).toBeNull();
  });
});
