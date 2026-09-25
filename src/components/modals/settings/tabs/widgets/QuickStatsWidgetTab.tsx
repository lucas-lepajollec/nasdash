import React from 'react';
import { WidgetPlacementNote } from '../../shared/WidgetPlacementNote';

/** This widget has no shared option: it is placed and removed from pages. */
export function QuickStatsWidgetTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <WidgetPlacementNote type="quickstats" />
    </div>
  );
}
