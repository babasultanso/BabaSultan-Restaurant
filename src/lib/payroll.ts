import type { Employee, PayFrequency } from '../domain/entities/hrm';

/**
 * Converts an employee's configured pay-cycle amount to a comparable monthly
 * planning value. This is an analytics equivalent only; payroll transactions
 * still use the employee's exact configured cycle amount.
 */
export function monthlyPayrollEquivalent(salary: number, frequency: PayFrequency | undefined): number {
  const amount = Number.isFinite(Number(salary)) && Number(salary) >= 0 ? Number(salary) : 0;
  switch (frequency || 'monthly') {
    case 'daily':
      return amount * (365 / 12);
    case 'weekly':
      return amount * (52 / 12);
    case 'monthly':
    default:
      return amount;
  }
}

export function employeeMonthlyPayrollEquivalent(employee: Pick<Employee, 'salary' | 'payFrequency'>): number {
  return monthlyPayrollEquivalent(employee.salary, employee.payFrequency);
}
