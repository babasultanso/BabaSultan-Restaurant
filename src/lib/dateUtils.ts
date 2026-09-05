/**
 * Business Date Utility for Baba Sultan ERP
 * Standardized on 'Africa/Mogadishu' timezone across all reporting, accounting, HR, and POS modules.
 */

export function getMogadishuDateString(dateInput?: Date | string | number): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Mogadishu',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Mogadishu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

export function getMogadishuDateTime(dateInput?: Date | string | number): Date {
  const dateStr = getMogadishuDateString(dateInput);
  return new Date(dateStr);
}

export function getMogadishuHour(dateInput?: Date | string | number): number {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput ?? Date.now());
  if (Number.isNaN(date.getTime())) return 0;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Mogadishu', hour: '2-digit', hour12: false }).formatToParts(date);
  const hourPart = parts.find((p) => p.type === 'hour')?.value;
  return Number.isFinite(Number(hourPart)) ? Number(hourPart) % 24 : 0;
}
