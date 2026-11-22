'use client';

import React, { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

/**
 * On a page in edit mode, every widget has one group of controls in its
 * top-right corner. Widgets put their own header buttons (add a service,
 * configure the list…) in that group through this component; elsewhere the
 * buttons stay where they are written.
 *
 * On a page the group is there from the second render: until then (null)
 * the buttons wait, instead of showing for one frame inside the widget (the
 * page would measure that height and keep it). Elsewhere (undefined) they
 * stay where they are written.
 */
export const WidgetActionsSlotContext = createContext<HTMLElement | null | undefined>(undefined);

export function WidgetHeaderActions({ children }: { children: React.ReactNode }) {
  const slot = useContext(WidgetActionsSlotContext);
  if (slot === null) return null;
  return slot ? createPortal(children, slot) : <>{children}</>;
}
