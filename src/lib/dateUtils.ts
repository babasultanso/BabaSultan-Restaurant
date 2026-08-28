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
