import { describe, expect, it } from 'vitest';
import { payrollPeriodInfo } from '../server/trustedFinancialBackend';

describe('Payroll frequency periods', () => {
  it('builds a daily payroll period', () => {
    expect(payrollPeriodInfo('daily', '2026-09-04')).toEqual({
      month: '2026-09', periodStart: '2026-09-04', periodEnd: '2026-09-04'
    });
  });

  it('builds a weekly Monday-to-Sunday period', () => {
    expect(payrollPeriodInfo('weekly', '2026-08-31')).toEqual({
      month: '2026-08', periodStart: '2026-08-31', periodEnd: '2026-09-06'
    });
  });

  it('builds the last day for a monthly period', () => {
    expect(payrollPeriodInfo('monthly', '2026-09')).toEqual({
      month: '2026-09', periodStart: '2026-09-01', periodEnd: '2026-09-30'
    });
  });

  it('rejects a non-Monday weekly period', () => {
    expect(() => payrollPeriodInfo('weekly', '2026-09-04')).toThrow('must start on Monday');
  });

  it('rejects an invalid calendar date instead of normalizing it silently', () => {
    expect(() => payrollPeriodInfo('daily', '2026-02-30')).toThrow('not a valid calendar date');
  });
});
