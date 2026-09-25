'use client';

import React from 'react';
import { useConfig } from '@/hooks/useConfig';

/** Shared widget shell of the Calme interface: the title sits above a quiet block. */

export function CalmeWidget({ title, aside, editMode, children, flush }: {
  title: string;
  aside?: React.ReactNode;
  editMode?: boolean;
  children: React.ReactNode;
  /** No inner padding (lists that draw their own rows). */
  flush?: boolean;
}) {
  const { config } = useConfig();
  const showTitle = !(config?.settings?.hideWidgetTitles ?? false) || editMode;
  return (
    <section className="ndc-widget">
      {showTitle && (
        <h3 className="ndc-title">
          <span>{title}</span>
          {aside && <span className="ndc-title-aside">{aside}</span>}
        </h3>
      )}
      <div className={`ndc-box ${flush ? 'ndc-box--flush' : ''}`}>{children}</div>
    </section>
  );
}
