export interface CronValidationResult {
  valid: boolean;
  error?: string;
}

const FIELD_RANGES = [
  { min: 0, max: 59, name: 'minute' },
  { min: 0, max: 23, name: 'hour' },
  { min: 1, max: 31, name: 'day-of-month' },
  { min: 1, max: 12, name: 'month' },
  { min: 0, max: 6, name: 'day-of-week' },
];

function validateField(field: string, min: number, max: number, name: string): string | null {
  if (field === '*') return null;
  if (field.includes('/')) {
    const [range, stepStr] = field.split('/');
    const step = parseInt(stepStr, 10);
    if (isNaN(step) || step < 1) return `Invalid step in ${name}`;
    if (range === '*') return null;
    return validateField(range, min, max, name);
  }
  if (field.includes(',')) {
    for (const part of field.split(',')) {
      const err = validateField(part, min, max, name);
      if (err) return err;
    }
    return null;
  }
  if (field.includes('-')) {
    const [startStr, endStr] = field.split('-');
    const start = parseInt(startStr, 10);
    const end = parseInt(endStr, 10);
    if (isNaN(start) || isNaN(end)) return `Invalid range in ${name}`;
    if (start < min || end > max || start > end) return `Range out of bounds in ${name} (${min}-${max})`;
    return null;
  }
  const val = parseInt(field, 10);
  if (isNaN(val) || val < min || val > max) return `Value out of bounds in ${name} (${min}-${max})`;
  return null;
}

export function validateCronExpr(expr: string): CronValidationResult {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5 || parts.length > 6) {
    return { valid: false, error: 'Cron expression must have 5 or 6 fields' };
  }
  const offset = parts.length === 6 ? 1 : 0;
  if (offset === 1) {
    const err = validateField(parts[0], 0, 59, 'second');
    if (err) return { valid: false, error: err };
  }
  for (let i = 0; i < 5; i++) {
    const err = validateField(parts[i + offset], FIELD_RANGES[i].min, FIELD_RANGES[i].max, FIELD_RANGES[i].name);
    if (err) return { valid: false, error: err };
  }
  return { valid: true };
}