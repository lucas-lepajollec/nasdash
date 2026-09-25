import { afterEach, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { WidgetContainer } from './WidgetContainer';

afterEach(() => vi.unstubAllGlobals());

it('keeps initial markup identical regardless of client viewport', () => {
  const render = () => renderToString(<WidgetContainer>{123}</WidgetContainer>);
  const server = render();
  for (const innerWidth of [390, 800, 1440]) {
    vi.stubGlobal('window', { innerWidth });
    expect(render()).toBe(server);
  }
  expect(server).toContain('nd-widget-size-medium');
});
