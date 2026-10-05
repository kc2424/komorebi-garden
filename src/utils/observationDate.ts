/** Format an ISO timestamp for `<input type="date">` in local timezone. */
export function localDateInputValue(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Keep original timestamp when the user did not change the displayed local date. */
export function resolveTakenAtOnSave(originalIso: string, dateInputValue: string): string {
  if (!dateInputValue) return originalIso;
  if (dateInputValue === localDateInputValue(originalIso)) return originalIso;
  const [y, m, d] = dateInputValue.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0).toISOString();
}
