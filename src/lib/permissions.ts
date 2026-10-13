/** Empty historical lists remain unrestricted; this reserved ID explicitly denies all. */
export const NO_ACCESS = '__nasdash_none__';
export function permissionSelection(values: string[] | undefined, options: string[]): string[] {
  if (!values?.length) return [...options];
  return values.filter(value => value !== NO_ACCESS && options.includes(value));
}
export function savedPermissions(values: string[]): string[] {
  return values.length ? [...new Set(values)] : [NO_ACCESS];
}
