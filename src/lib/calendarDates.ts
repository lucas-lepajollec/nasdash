import { RequestValidationError } from './requestValidation';
/** Accept only real ISO dates/date-times; malformed persisted dates must never reach the calendar. */
export function validateCalendarDates(start: string | undefined, end: string | undefined): void {
  const valid = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value)) return false;
    const stamp = Date.parse(value);
    if (!Number.isFinite(stamp)) return false;
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  };
  if (start !== undefined && !valid(start)) throw new RequestValidationError('calendar.invalidDate');
  if (end !== undefined && !valid(end)) throw new RequestValidationError('calendar.invalidDate');
  if (start && end && Date.parse(end) < Date.parse(start)) throw new RequestValidationError('calendar.invalidDate');
}
