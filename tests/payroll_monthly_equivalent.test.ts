import { describe, expect, it } from 'vitest';
import { monthlyPayrollEquivalent } from '../src/lib/payroll';

describe('Payroll monthly reporting equivalent', () => {
  it('keeps monthly salary unchanged', () => {
    expect(monthlyPayrollEquivalent(600, 'monthly')).toBe(600);
  });
  it('annualizes daily salary to a monthly planning equivalent', () => {
    expect(monthlyPayrollEquivalent(20, 'daily')).toBeCloseTo(20 * (365 / 12), 8);
  });
  it('annualizes weekly salary to a monthly planning equivalent', () => {
    expect(monthlyPayrollEquivalent(120, 'weekly')).toBeCloseTo(120 * (52 / 12), 8);
  });
});
