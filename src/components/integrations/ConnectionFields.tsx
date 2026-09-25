'use client';

import React from 'react';
import type { ConnectionField, ConnectionFieldId } from '@/integrations/types';
import CustomSelect from '@/components/shared/CustomSelect';
import { CalmeField } from '@/components/shared/CalmeDialog';
import { CalmeRow, CalmeSwitch } from '@/components/modals/settings/shared/CalmeControls';
import { useI18n } from '@/i18n/I18nProvider';

export type FieldValues = Partial<Record<ConnectionFieldId, string>>;

/**
 * The fields an integration's manifest describes, laid out by row (side by
 * side) and panel (a framed box), as in the device and connection dialogs.
 * Values are text; switches hold `'true'` or `''`. Secrets start empty when
 * editing and keep the stored value when left so.
 */
export function ConnectionFields({ fields, values, onChange, editing, showSensitive }: {
  fields: readonly ConnectionField[];
  values: FieldValues;
  onChange: (id: ConnectionFieldId, value: string) => void;
  /** Editing a saved connection: an empty secret keeps the stored one. */
  editing: boolean;
  showSensitive: boolean;
}) {
  const { t } = useI18n();
  const isShown = (field: ConnectionField) => !field.showWhen || Boolean(values[field.showWhen]);
  const isRequired = (field: ConnectionField) => field.required === true || (field.required === 'create' && !editing);

  const groups: { panel: boolean; rows: ConnectionField[][] }[] = [];
  for (const field of fields) {
    if (!isShown(field)) continue;
    const panel = Boolean(field.panel);
    let group = groups[groups.length - 1];
    if (!group || group.panel !== panel) groups.push(group = { panel, rows: [] });
    const row = group.rows.find(candidate => candidate[0].row === field.row);
    if (row) row.push(field);
    else group.rows.push([field]);
  }

  const control = (field: ConnectionField) => {
    const value = values[field.id] ?? '';
    if (field.kind === 'select') {
      return (
        <CustomSelect
          value={value || field.defaultValue || ''}
          onChange={next => onChange(field.id, next)}
          ariaLabel={t(field.label)}
          options={(field.options ?? []).map(option => ({ value: option.value, label: t(option.label) }))}
        />
      );
    }
    const secret = field.kind === 'secret';
    const placeholder = secret && editing ? t("Laisser vide pour garder l'actuel") : field.placeholder ? t(field.placeholder) : undefined;
    return (
      <input
        id={`connection-${field.id}`}
        type={secret || (field.kind === 'address' && !showSensitive) ? 'password' : 'text'}
        className="nd-input"
        value={value}
        onChange={event => onChange(field.id, event.target.value)}
        placeholder={placeholder}
        required={isRequired(field)}
        autoComplete={secret ? 'new-password' : 'off'}
      />
    );
  };

  return (
    <>
      {groups.map(({ panel, rows }, index) => (
        <div key={index} className={panel ? 'ndc-form-panel' : 'ndc-form'}>
          {rows.map(row => (
            <div key={row[0].id} className="ndc-form-row">
              {row.map(field => (
                <div key={field.id} style={{ flex: field.flex ?? 1, minWidth: 0 }}>
                  {field.kind === 'toggle' ? (
                    <CalmeRow label={t(field.label)} info={field.hint ? t(field.hint) : undefined}>
                      <CalmeSwitch label={t(field.label)} checked={values[field.id] === 'true'} onChange={checked => onChange(field.id, checked ? 'true' : '')} />
                    </CalmeRow>
                  ) : (
                    <CalmeField label={t(field.label)} htmlFor={`connection-${field.id}`}>{control(field)}</CalmeField>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

/** Values of the fields that start filled (port, node name…). */
export function fieldDefaults(fields: readonly ConnectionField[]): FieldValues {
  return Object.fromEntries(fields.filter(field => field.defaultValue).map(field => [field.id, field.defaultValue!]));
}
