import { describe, expect, it } from 'vitest';
import { buildConfigForPrincipal } from './configAccess';
import type { AccessPrincipal } from './access';
import type { DashboardConfig } from './types';
const config: DashboardConfig = { version: 1, categories: [], localEvents: [], settings: { title: 'Fictional', showMonitor: true, calendarUrl: 'https://calendar.example.test/feed?access=fictional-capability' } };
const viewer: AccessPrincipal = { username: 'calendar-reader', role: 'viewer', allowedTabs: ['__nasdash_none__'], allowedWidgets: ['calendar'], isAnonymous: false };
describe('calendar provider capability confidentiality', () => {
 it('lets an authorized reader discover configured calendar availability without exporting the capability URL', () => {
  const output = buildConfigForPrincipal(config, viewer);
  expect(output.settings.calendarConfigured).toBe(true);
  expect(JSON.stringify(output)).not.toContain('fictional-capability');
  expect(output.settings.calendarUrl).toBeUndefined();
  expect(config.settings.calendarUrl).toContain('fictional-capability');
 });
 it('hides calendar availability from a reader whose permission has been revoked', () => {
  expect(buildConfigForPrincipal(config, { ...viewer, allowedWidgets: ['__nasdash_none__'] }).settings.calendarConfigured).toBe(false);
 });
 it('keeps the admin editor address while excluding it from unrestricted public viewers', () => {
  expect(buildConfigForPrincipal(config, { ...viewer, role: 'admin' }).settings.calendarUrl).toBe(config.settings.calendarUrl);
  expect(buildConfigForPrincipal(config, { ...viewer, isAnonymous: true, allowedTabs: [], allowedWidgets: [] }).settings.calendarUrl).toBeUndefined();
 });
});
