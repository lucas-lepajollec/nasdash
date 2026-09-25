'use client';

import React, { useState } from 'react';
import { Pencil } from 'lucide-react';
import type { WidgetSettings } from '@/lib/pages/types';
import { WidgetHeaderActions } from '@/components/widgets/WidgetHeaderActions';
import { DeviceWidgetDialog, type DeviceDialogOptions } from './DeviceWidgetDialog';

/** The ✎ of a device widget in edit mode: opens its settings dialog. */
export function SettingsButton({ options, settings, onSave }: {
  options: DeviceDialogOptions;
  settings: WidgetSettings;
  onSave: (settings: WidgetSettings) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <WidgetHeaderActions>
      <button type="button" className="nd-action-icon accent" onClick={event => { event.stopPropagation(); setOpen(true); }} title={options.title} aria-label={options.title}>
        <Pencil size={13} />
      </button>
      {open && <DeviceWidgetDialog options={options} settings={settings} onSave={onSave} onClose={() => setOpen(false)} />}
    </WidgetHeaderActions>
  );
}
