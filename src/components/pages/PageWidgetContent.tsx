'use client';

import React from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import type { WidgetViewProps } from '@/widgets/types';
import { WIDGET_VIEWS } from '@/widgets/views';

/**
 * Content of one widget on a page: the view registered for its type in
 * `src/widgets/views.ts`. Unknown types (a removed widget in an old page)
 * show a note while editing and nothing otherwise.
 */

export type PageWidgetContentProps = WidgetViewProps;

export function PageWidgetContent(props: PageWidgetContentProps) {
  const { t } = useI18n();
  const View = WIDGET_VIEWS[props.instance.type];
  if (View) return <View {...props} />;
  return props.editMode ? (
    <div className="nd-page-widget-missing">{t('pages.widget.unknown', { type: props.instance.type })}</div>
  ) : null;
}
