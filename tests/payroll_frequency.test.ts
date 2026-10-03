import { describe, expect, it } from 'vitest';
import {
  payrollPeriodInfo,
  handlePayrollProcess,
  handleSalaryDisbursement,
  handleAttendanceManual
} from '../server/trustedFinancialBackend';
import { getAdminDb } from '../server/db';

const OWNER_TOKEN = 'Bearer test_token_owner';
const BRANCH_ID = 'main_branch_01';

async function runHandler(handler: any, reqInit: { headers?: Record<string, string>; body?: any; params?: Record<string, string> }) {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(reqInit.headers || {})) {
    headers[k.toLowerCase()] = v;
  }
  let statusCode = 200;
  let bodyOut: any = undefined;
  const req: any = {
    headers,
    body: reqInit.body || {},
    params: reqInit.params || {},
    query: {},
  };
  const res: any = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: any) {
      bodyOut = payload;
      return this;
    },
  };
  await handler(req, res);
  return { statusCode, body: bodyOut };
}

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

  it('processes daily, weekly, and monthly payroll using exact cycle salary and frequency overtime divisor', async () => {
    const db = getAdminDb();
    await db.collection('employees').doc('emp_daily').set({
      id: 'emp_daily',
      fullName: 'Daily Worker',
      branchId: BRANCH_ID,
      branch: BRANCH_ID,
      employmentStatus: 'Active',
      status: 'active',
      salary: 32, // hourly = 32 / 8 = 4
      payFrequency: 'daily',
    });
    await db.collection('employees').doc('emp_weekly').set({
      id: 'emp_weekly',
      fullName: 'Weekly Worker',
      branchId: BRANCH_ID,
      branch: BRANCH_ID,
      employmentStatus: 'Active',
      status: 'active',
      salary: 200, // hourly = 200 / 40 = 5
      payFrequency: 'weekly',
    });
    await db.collection('employees').doc('emp_monthly').set({
      id: 'emp_monthly',
      fullName: 'Monthly Worker',
      branchId: BRANCH_ID,
      branch: BRANCH_ID,
      employmentStatus: 'Active',
      status: 'active',
      salary: 1600, // hourly = 1600 / 160 = 10
      payFrequency: 'monthly',
    });

    await db.collection('employee_attendance').doc('att_daily').set({
      id: 'att_daily',
      employeeId: 'emp_daily',
      branchId: BRANCH_ID,
      date: '2026-03-02',
      overtimeHours: 2,
      status: 'present',
    });
    await db.collection('employee_attendance').doc('att_weekly').set({
      id: 'att_weekly',
      employeeId: 'emp_weekly',
      branchId: BRANCH_ID,
      date: '2026-03-04',
      overtimeHours: 4,
      status: 'present',
    });

    const dailyRes = await runHandler(handlePayrollProcess, {
      headers: { Authorization: OWNER_TOKEN, 'Idempotency-Key': 'pay-daily-2026-03-02' },
      body: { branchId: BRANCH_ID, frequency: 'daily', period: '2026-03-02' },
    });
    expect(dailyRes.statusCode).toBe(200);
    expect(dailyRes.body.payroll[0]).toMatchObject({
      id: 'daily_2026-03-02_2026-03-02_emp_daily',
      employeeId: 'emp_daily',
      payFrequency: 'daily',
      basicSalary: 32,
      overtimePay: 12,
      netSalary: 44,
    });

    const weeklyRes = await runHandler(handlePayrollProcess, {
      headers: { Authorization: OWNER_TOKEN, 'Idempotency-Key': 'pay-weekly-2026-03-02' },
      body: { branchId: BRANCH_ID, frequency: 'weekly', period: '2026-03-02' },
    });
    expect(weeklyRes.statusCode).toBe(200);
    expect(weeklyRes.body.payroll[0]).toMatchObject({
      id: 'weekly_2026-03-02_2026-03-08_emp_weekly',
      employeeId: 'emp_weekly',
      payFrequency: 'weekly',
      basicSalary: 200,
      overtimePay: 30,
      netSalary: 230,
    });

    const monthlyRes = await runHandler(handlePayrollProcess, {
      headers: { Authorization: OWNER_TOKEN, 'Idempotency-Key': 'pay-monthly-2026-03' },
      body: { branchId: BRANCH_ID, frequency: 'monthly', period: '2026-03' },
    });
    expect(monthlyRes.statusCode).toBe(200);
    const monthlyEmp = monthlyRes.body.payroll.find((p: any) => p.employeeId === 'emp_monthly');
    expect(monthlyEmp).toMatchObject({
      id: 'monthly_2026-03-01_2026-03-31_emp_monthly',
      employeeId: 'emp_monthly',
      payFrequency: 'monthly',
      basicSalary: 1600,
      overtimePay: 0,
      netSalary: 1600,
    });
  });

  it('includes allowances, bonuses, deductions, advances, and unpaid leave in payroll calculation, and deduplicates overtime', async () => {
    const db = getAdminDb();
    await db.collection('employees').doc('emp_comp').set({
      id: 'emp_comp',
      fullName: 'Comp Employee',
      branchId: BRANCH_ID,
      branch: BRANCH_ID,
      employmentStatus: 'On Leave',
      status: 'on_leave',
      salary: 1600, // hourlyRate = 1600 / 160 = 10; daily (8h) = 80
      payFrequency: 'monthly',
      allowances: 150,
      bonuses: 50,
      deductions: 40,
      advances: 60,
    });
    await db.collection('employees').doc('emp_suspended').set({
      id: 'emp_suspended',
      fullName: 'Suspended Employee',
      branchId: BRANCH_ID,
      branch: BRANCH_ID,
      employmentStatus: 'Suspended',
      status: 'suspended',
      salary: 1200,
      payFrequency: 'monthly',
    });

    // Duplicate attendance on 2026-04-10 + absent record with overtime on 2026-04-11
    await db.collection('employee_attendance').doc('att_comp_1').set({
      id: 'att_comp_1',
      employeeId: 'emp_comp',
      branchId: BRANCH_ID,
      date: '2026-04-10',
      overtimeHours: 2,
      status: 'present',
    });
    await db.collection('employee_attendance').doc('att_comp_dup').set({
      id: 'att_comp_dup',
      employeeId: 'emp_comp',
      branchId: BRANCH_ID,
      date: '2026-04-10',
      overtimeHours: 2,
      status: 'present',
    });
    await db.collection('employee_attendance').doc('att_comp_absent').set({
      id: 'att_comp_absent',
      employeeId: 'emp_comp',
      branchId: BRANCH_ID,
      date: '2026-04-11',
      overtimeHours: 5,
      status: 'absent',
    });

    await db.collection('leave_requests').doc('leave_paid').set({
      id: 'leave_paid',
      employeeId: 'emp_comp',
      branchId: BRANCH_ID,
      leaveType: 'Annual',
      startDate: '2026-04-02',
      endDate: '2026-04-04',
      status: 'approved',
      approvalStatus: 'approved',
      workflowStatus: 'Completed',
    });
    await db.collection('leave_requests').doc('leave_unpaid').set({
      id: 'leave_unpaid',
      employeeId: 'emp_comp',
      branchId: BRANCH_ID,
      leaveType: 'Unpaid',
      startDate: '2026-04-15',
      endDate: '2026-04-16',
      status: 'approved',
      approvalStatus: 'approved',
      workflowStatus: 'Completed',
    });

    const res1 = await runHandler(handlePayrollProcess, {
      headers: { Authorization: OWNER_TOKEN, 'Idempotency-Key': 'pay-comp-2026-04-a' },
      body: { branchId: BRANCH_ID, frequency: 'monthly', period: '2026-04' },
    });
    expect(res1.statusCode).toBe(200);
    const compRec = res1.body.payroll.find((p: any) => p.employeeId === 'emp_comp');
    const suspRec = res1.body.payroll.find((p: any) => p.employeeId === 'emp_suspended');
    expect(suspRec).toBeUndefined();
    expect(compRec).toMatchObject({
      basicSalary: 1600,
      overtimePay: 30,
      bonuses: 50,
      allowances: 150,
      manualDeductions: 40,
      unpaidLeaveDays: 2,
      unpaidLeaveDeduction: 160,
      deductions: 200,
      advances: 60,
      netSalary: 1570,
    });

    const res2 = await runHandler(handlePayrollProcess, {
      headers: { Authorization: OWNER_TOKEN, 'Idempotency-Key': 'pay-comp-2026-04-b' },
      body: { branchId: BRANCH_ID, frequency: 'monthly', period: '2026-04' },
    });
    expect(res2.statusCode).toBe(200);
    const compSnap = await db.collection('payroll').where('employeeId', '==', 'emp_comp').where('month', '==', '2026-04').get();
    expect(compSnap.size).toBe(1);
    expect(compSnap.docs[0].data().netSalary).toBe(1570);
  });

  it('verifies full Payroll -> Payment -> Journal Entry -> Ledger chain, prevents double payment on retry/concurrent requests, and enforces branch & closed-period guards', async () => {
    const db = getAdminDb();

    await db.collection('accounts').doc('acc_bank').set({
      id: 'acc_bank',
      code: '1020',
      name: 'Primary Bank',
      type: 'Asset',
      balance: 10000,
      branchId: 'all',
    });
    await db.collection('accounts').doc('acc_payroll_expense').set({
      id: 'acc_payroll_expense',
      code: '6120',
      name: 'Salaries & Wages Expense',
      type: 'Expense',
      balance: 0,
      branchId: 'all',
    });
    await db.collection('bank_accounts').doc('bank_main_01').set({
      id: 'bank_main_01',
      accountName: 'Main Operating Bank',
      bankName: 'Premier Bank',
      accountNumber: '100200300',
      glAccountId: 'acc_bank',
      branchId: BRANCH_ID,
      status: 'Active',
      balance: 10000,
    });

    await db.collection('employees').doc('emp_gl').set({
      id: 'emp_gl',
      fullName: 'Amina Payroll',
      branchId: BRANCH_ID,
      branch: BRANCH_ID,
      employmentStatus: 'Active',
      status: 'active',
      salary: 800,
      payFrequency: 'monthly',
      allowances: 100,
      bonuses: 50,
      deductions: 30,
      advances: 20,
    });

    const att1 = await runHandler(handleAttendanceManual, {
      headers: { Authorization: OWNER_TOKEN, 'Idempotency-Key': 'manual-att-1' },
      body: {
        record: {
          employeeId: 'emp_gl',
          date: '2026-05-10',
          clockIn: '2026-05-10T08:00:00.000Z',
          clockOut: '2026-05-10T18:00:00.000Z',
          status: 'present',
        },
      },
    });
    expect(att1.statusCode).toBe(200);
    const att2 = await runHandler(handleAttendanceManual, {
      headers: { Authorization: OWNER_TOKEN, 'Idempotency-Key': 'manual-att-2' },
      body: {
        record: {
          employeeId: 'emp_gl',
          date: '2026-05-10',
          clockIn: '2026-05-10T08:00:00.000Z',
          clockOut: '2026-05-10T20:00:00.000Z',
          status: 'present',
        },
      },
    });
    expect(att2.statusCode).toBe(200);
    const attSnap = await db.collection('employee_attendance').where('employeeId', '==', 'emp_gl').where('date', '==', '2026-05-10').get();
    expect(attSnap.size).toBe(1);
    expect(attSnap.docs[0].data().overtimeHours).toBe(4);

    const procRes = await runHandler(handlePayrollProcess, {
      headers: { Authorization: OWNER_TOKEN, 'Idempotency-Key': 'pay-gl-2026-05' },
      body: { branchId: BRANCH_ID, frequency: 'monthly', period: '2026-05' },
    });
    expect(procRes.statusCode).toBe(200);
    const payrollDoc = procRes.body.payroll.find((p: any) => p.employeeId === 'emp_gl');
    expect(payrollDoc.netSalary).toBe(930);

    const badMethodRes = await runHandler(handleSalaryDisbursement, {
      headers: { Authorization: OWNER_TOKEN, 'Idempotency-Key': 'sal-bad-method' },
      body: {
        salaryData: {
          payrollId: payrollDoc.id,
          employeeId: 'emp_gl',
          netPaid: 930,
          paymentMethod: 'credit',
          branchId: BRANCH_ID,
        },
      },
    });
    expect(badMethodRes.statusCode).toBe(400);

    const wrongBranchRes = await runHandler(handleSalaryDisbursement, {
      headers: { Authorization: OWNER_TOKEN, 'Idempotency-Key': 'sal-wrong-branch' },
      body: {
        salaryData: {
          payrollId: payrollDoc.id,
          employeeId: 'emp_gl',
          netPaid: 930,
          paymentMethod: 'bank',
          branchId: 'branch_02',
        },
      },
    });
    expect(wrongBranchRes.statusCode).toBe(403);

    const [payRes1, payRes2, payRes3] = await Promise.all([
      runHandler(handleSalaryDisbursement, {
        headers: { Authorization: OWNER_TOKEN, 'Idempotency-Key': 'sal-pay-gl-key1' },
        body: {
          salaryData: {
            payrollId: payrollDoc.id,
            employeeId: 'emp_gl',
            netPaid: 930,
            paymentMethod: 'bank',
            bankAccountId: 'bank_main_01',
          },
        },
      }),
      runHandler(handleSalaryDisbursement, {
        headers: { Authorization: OWNER_TOKEN, 'Idempotency-Key': 'sal-pay-gl-key2' },
        body: {
          salaryData: {
            payrollId: payrollDoc.id,
            employeeId: 'emp_gl',
            netPaid: 930,
            paymentMethod: 'bank',
            bankAccountId: 'bank_main_01',
          },
        },
      }),
      runHandler(handleSalaryDisbursement, {
        headers: { Authorization: OWNER_TOKEN, 'Idempotency-Key': 'sal-pay-gl-key3' },
        body: {
          salaryData: {
            employeeId: 'emp_gl',
            period: '2026-05',
            netPaid: 930,
            paymentMethod: 'bank',
            bankAccountId: 'bank_main_01',
          },
        },
      }),
    ]);

    expect(payRes1.statusCode).toBe(200);
    expect(payRes2.statusCode).toBe(200);
    expect(payRes3.statusCode).toBe(200);
    const statuses = [payRes1.body.status, payRes2.body.status, payRes3.body.status].sort();
    expect(statuses).toEqual(['duplicate', 'duplicate', 'success']);

    const salSnap = await db.collection('salaries').where('employeeId', '==', 'emp_gl').get();
    expect(salSnap.size).toBe(1);
    const salData = salSnap.docs[0].data();
    expect(salData).toMatchObject({
      employeeId: 'emp_gl',
      payrollId: payrollDoc.id,
      baseSalary: 800,
      overtimePay: 30,
      bonuses: 50,
      allowances: 100,
      deductions: 30,
      advances: 20,
      netPaid: 930,
      amount: 930,
      branchId: BRANCH_ID,
      status: 'paid',
    });

    const jeSnap = await db.collection('journal_entries').where('reference', '==', salSnap.docs[0].id).get();
    expect(jeSnap.size).toBe(1);
    const jeData = jeSnap.docs[0].data();
    expect(jeData.totalDebit).toBe(930);
    expect(jeData.totalCredit).toBe(930);
    expect(jeData.branchId).toBe(BRANCH_ID);
    expect(jeData.source).toBe('Payroll');

    const ledgerSnap = await db.collection('ledger').where('journalEntryId', '==', jeData.id).get();
    expect(ledgerSnap.size).toBe(2);
    const debitLine = ledgerSnap.docs.map((d: any) => d.data()).find((l: any) => l.debit > 0);
    const creditLine = ledgerSnap.docs.map((d: any) => d.data()).find((l: any) => l.credit > 0);
    expect(debitLine).toMatchObject({ accountId: 'acc_payroll_expense', accountCode: '6120', debit: 930, credit: 0, branchId: BRANCH_ID });
    expect(creditLine).toMatchObject({ accountId: 'acc_bank', accountCode: '1020', debit: 0, credit: 930, branchId: BRANCH_ID });

    await db.collection('accounting_periods').doc('closed_2026_01').set({
      id: 'closed_2026_01',
      branchId: BRANCH_ID,
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      status: 'Closed',
    });

    const closedPayrollRes = await runHandler(handlePayrollProcess, {
      headers: { Authorization: OWNER_TOKEN, 'Idempotency-Key': 'pay-closed-2026-01' },
      body: { branchId: BRANCH_ID, frequency: 'monthly', period: '2026-01' },
    });
    expect(closedPayrollRes.statusCode).toBe(400);
    expect(closedPayrollRes.body.error).toMatch(/closed/i);

    const closedSalaryRes = await runHandler(handleSalaryDisbursement, {
      headers: { Authorization: OWNER_TOKEN, 'Idempotency-Key': 'sal-closed-2026-01' },
      body: {
        salaryData: {
          employeeId: 'emp_gl',
          period: '2026-01',
          netPaid: 800,
          paymentMethod: 'bank',
          bankAccountId: 'bank_main_01',
          branchId: BRANCH_ID,
        },
      },
    });
    expect(closedSalaryRes.statusCode).toBe(400);
    expect(closedSalaryRes.body.error).toMatch(/closed/i);
  });

  it('preserves payFrequency in HRMRepositoryImpl & StaffRepositoryImpl, enforces transactional leave approval consistency, and protects sensitive employee fields', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { doc, setDoc, getDoc } = await import('firebase/firestore');
    const { db: clientDb } = await import('../src/lib/firebase');
    const { HRMRepositoryImpl } = await import('../src/data/repositories/HRMRepositoryImpl');
    const { StaffRepositoryImpl } = await import('../src/data/repositories/StaffRepositoryImpl');
    const { getMogadishuDateString } = await import('../src/lib/dateUtils');

    const today = getMogadishuDateString();
    await setDoc(doc(clientDb, 'employees', 'emp_hr_1'), {
      id: 'emp_hr_1',
      employeeId: 'EMP-HR-001',
      fullName: 'Hodan Warsame',
      email: 'hodan@example.com',
      branchId: BRANCH_ID,
      branch: BRANCH_ID,
      employmentStatus: 'Active',
      status: 'active',
      salary: 250,
      payFrequency: 'weekly',
      nationalIdOrPassport: 'PASS-998877',
      bankAccount: {
        bankName: 'Salaam Somali Bank',
        accountNumber: 'SSB-11223344',
        accountHolder: 'Hodan Warsame',
      },
    });

    const hrmRepo = new HRMRepositoryImpl();
    const staffRepo = new StaffRepositoryImpl();

    const byId = await hrmRepo.getEmployeeById('emp_hr_1');
    expect(byId?.payFrequency).toBe('weekly');
    expect(byId?.salary).toBe(250);
    expect(byId?.nationalIdOrPassport).toBe('PASS-998877');
    expect(byId?.bankAccount?.accountNumber).toBe('SSB-11223344');

    const staffList = await staffRepo.fetchEmployees(BRANCH_ID);
    const staffEmp = staffList.find((e) => e.id === 'emp_hr_1');
    expect(staffEmp?.payFrequency).toBe('weekly');

    // Simulate non-privileged cashier viewing employees via window.localStorage
    const origWindow = (globalThis as any).window;
    const origLocalStorage = (globalThis as any).localStorage;
    const mockStorage: Record<string, string> = {
      user_profile: JSON.stringify({
        id: 'user_cashier_99',
        uid: 'user_cashier_99',
        role: 'cashier',
        branchId: BRANCH_ID,
        email: 'cashier99@example.com',
      }),
    };
    (globalThis as any).window = globalThis;
    (globalThis as any).localStorage = {
      getItem: (k: string) => mockStorage[k] ?? null,
      setItem: (k: string, v: string) => { mockStorage[k] = v; },
      removeItem: (k: string) => { delete mockStorage[k]; },
    };

    try {
      const redactedEmp = await hrmRepo.getEmployeeById('emp_hr_1');
      expect(redactedEmp?.salary).toBe(0);
      expect(redactedEmp?.nationalIdOrPassport).toBe('');
      expect(redactedEmp?.bankAccount).toBeUndefined();

      const redactedStaff = (await staffRepo.fetchEmployees(BRANCH_ID)).find((e) => e.id === 'emp_hr_1');
      expect(redactedStaff?.salary).toBe(0);
      expect(redactedStaff?.nationalIdOrPassport).toBe('');
      expect(redactedStaff?.bankAccount).toBeUndefined();
    } finally {
      (globalThis as any).window = origWindow;
      (globalThis as any).localStorage = origLocalStorage;
    }

    // Leave approval workflow & employee state consistency
    await setDoc(doc(clientDb, 'leave_requests', 'leave_hr_1'), {
      id: 'leave_hr_1',
      employeeId: 'emp_hr_1',
      employeeName: 'Hodan Warsame',
      branchId: BRANCH_ID,
      leaveType: 'Annual Leave',
      startDate: today,
      endDate: today,
      daysCount: 1,
      reason: 'Personal',
      approvalStatus: 'pending',
      status: 'pending',
      workflowStatus: 'Request',
    });

    // Cannot HR-approve directly from 'Request' without Manager Approval
    await expect(hrmRepo.approveLeaveByHR('leave_hr_1')).rejects.toThrow(/Manager Approval/i);

    await hrmRepo.approveLeaveByManager('leave_hr_1', 'Manager Ali');
    await hrmRepo.approveLeaveByHR('leave_hr_1');

    const updatedLeave = (await getDoc(doc(clientDb, 'leave_requests', 'leave_hr_1'))).data();
    const updatedEmp = (await getDoc(doc(clientDb, 'employees', 'emp_hr_1'))).data();
    expect(updatedLeave).toMatchObject({
      approvalStatus: 'approved',
      status: 'approved',
      workflowStatus: 'Completed',
    });
    expect(updatedEmp).toMatchObject({
      employmentStatus: 'On Leave',
      status: 'on_leave',
    });

    // Verify firestore.rules restricts /employees/{employeeId} read and blocks direct client writes on /payroll & /salaries
    const rulesContent = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
    expect(rulesContent).toContain('match /employees/{employeeId}');
    expect(rulesContent).toContain('isManagementOrAccountant() ||');
    expect(rulesContent).toContain('match /salaries/{salaryId}');
    expect(rulesContent).toContain('match /payroll/{id}');
  });
});
