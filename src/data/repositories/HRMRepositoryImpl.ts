import {
  collection,
  doc,
  getDocs,
  setDoc,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  deleteDoc,
  runTransaction
} from 'firebase/firestore';
import { db, COLLECTIONS, getAuthToken, getEffectiveBranchId, getEffectiveBranchScope } from '../../lib/firebase';
import { getApiUrl } from '../../lib/apiConfig';
import { getMogadishuDateString } from '../../lib/dateUtils';
import { IHRMRepository } from '../../domain/repositories/IHRMRepository';
import {
  Employee,
  AttendanceRecord,
  Shift,
  PayrollRecord,
  PayFrequency,
  LeaveRequest,
  PerformanceRecord,
  EmployeeDocument,
  HRNotification,
  HRMAnalyticsData
} from '../../domain/entities/hrm';

function normalizePayFrequency(value: unknown): PayFrequency {
  const normalized = String(value || '').trim().toLowerCase();
  return (['daily', 'weekly', 'monthly'].includes(normalized) ? normalized : 'monthly') as PayFrequency;
}

function canReadSensitiveEmployeeFields(employee?: { id?: string; userId?: string; email?: string }): boolean {
  if (typeof localStorage === 'undefined') return true;
  try {
    const stored = localStorage.getItem('user_profile');
    if (!stored) return true;
    const u = JSON.parse(stored);
    if (!u || typeof u !== 'object') return true;
    const role = String(u.role || '').trim().toLowerCase();
    if (['owner', 'admin', 'manager', 'accountant'].includes(role) || u.isOwner === true || u.isAdmin === true) {
      return true;
    }
    const uid = String(u.id || u.uid || '').trim();
    const empId = String(u.employeeId || '').trim();
    const email = String(u.email || '').trim().toLowerCase();
    if (employee) {
      if (uid && (employee.id === uid || employee.userId === uid)) return true;
      if (empId && employee.id === empId) return true;
      if (email && String(employee.email || '').trim().toLowerCase() === email) return true;
    }
    return false;
  } catch {
    return true;
  }
}

export class HRMRepositoryImpl implements IHRMRepository {
  // ==========================================
  // EMPLOYEE MANAGEMENT
  // ==========================================

  async getAllEmployees(branchId?: string): Promise<Employee[]> {
    try {
      const effectiveBranch = branchId && branchId !== 'all' ? branchId : getEffectiveBranchScope();
      const q = effectiveBranch === 'all'
        ? collection(db, COLLECTIONS.EMPLOYEES)
        : query(collection(db, COLLECTIONS.EMPLOYEES), where('branchId', '==', effectiveBranch));
      const snap = await getDocs(q);
      const employees: Employee[] = snap.docs
        .filter((d) => {
          const data = d.data();
          return !data.isDeleted && !data.isArchived && data.status !== 'deleted';
        })
        .map((d) => {
        const data = d.data();
        const empName = data.fullName || data.name || 'Unnamed Employee';
        const empRole = data.jobTitle || data.position || data.role || 'Staff Member';
        const canViewSensitive = canReadSensitiveEmployeeFields({
          id: d.id,
          userId: data.userId || data.uid,
          email: data.email
        });
        return {
          id: d.id,
          employeeId: data.employeeId || d.id,
          fullName: empName,
          name: empName,
          photo: data.photo || data.photoUrl || '',
          nationalIdOrPassport: canViewSensitive ? (data.nationalIdOrPassport || data.nationalId || '') : '',
          phone: data.phone || '',
          email: data.email || '',
          address: data.address || '',
          dateOfBirth: data.dateOfBirth || '',
          gender: data.gender || '',
          nationality: data.nationality || '',
          hireDate: data.hireDate || getMogadishuDateString(),
          jobTitle: empRole,
          position: empRole,
          department: data.department || 'General Operations',
          branchId: data.branchId || data.branch || '',
          branch: data.branch || data.branchId || '',
          employmentStatus: data.employmentStatus || 'Active',
          status: data.status || (data.employmentStatus === 'Active' ? 'active' : 'on_leave'),
          role: data.role || 'Employee',
          salary: canViewSensitive && Number.isFinite(Number(data.salary)) ? Number(data.salary) : 0,
          payFrequency: normalizePayFrequency(data.payFrequency),
          totalSales: Number(data.totalSales) || 0,
          ordersCount: Number(data.ordersCount) || 0,
          bankAccount: canViewSensitive ? data.bankAccount : undefined,
          emergencyContact: data.emergencyContact || {
            name: '',
            relationship: '',
            phone: data.phone || ''
          },
          notes: data.notes || '',
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt
        } as Employee;
      });

      return employees.sort((a, b) => a.fullName.localeCompare(b.fullName));
    } catch (err) {
      console.error('Error fetching employees from Firestore:', err);
      throw err;
    }
  }

  async getEmployeeById(id: string): Promise<Employee | null> {
    const ref = doc(db, COLLECTIONS.EMPLOYEES, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data.isDeleted || data.isArchived || data.status === 'deleted') return null;
    const empRole = data.jobTitle || data.position || data.role || 'Staff Member';
    const canViewSensitive = canReadSensitiveEmployeeFields({
      id: snap.id,
      userId: data.userId || data.uid,
      email: data.email
    });
    return {
      id: snap.id,
      employeeId: data.employeeId || snap.id,
      fullName: data.fullName || data.name || 'Unnamed Employee',
      name: data.name || data.fullName || 'Unnamed Employee',
      photo: data.photo || data.photoUrl || '',
      nationalIdOrPassport: canViewSensitive ? (data.nationalIdOrPassport || data.nationalId || '') : '',
      phone: data.phone || '',
      email: data.email || '',
      address: data.address || '',
      dateOfBirth: data.dateOfBirth || '',
      gender: data.gender || '',
      nationality: data.nationality || '',
      hireDate: data.hireDate || getMogadishuDateString(),
      jobTitle: empRole,
      position: empRole,
      department: data.department || 'General Operations',
      branchId: data.branchId || data.branch || '',
      branch: data.branch || data.branchId || '',
      employmentStatus: data.employmentStatus || 'Active',
      status: data.status || (data.employmentStatus === 'Active' ? 'active' : 'on_leave'),
      role: data.role || 'Employee',
      salary: canViewSensitive && Number.isFinite(Number(data.salary)) ? Number(data.salary) : 0,
      payFrequency: normalizePayFrequency(data.payFrequency),
      totalSales: Number(data.totalSales) || 0,
      ordersCount: Number(data.ordersCount) || 0,
      bankAccount: canViewSensitive ? data.bankAccount : undefined,
      emergencyContact: data.emergencyContact || {
        name: 'Emergency Contact',
        relationship: 'Family',
        phone: data.phone || ''
      },
      notes: data.notes || '',
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt
    } as Employee;
  }

  async createEmployee(employee: Omit<Employee, 'id' | 'createdAt'>): Promise<Employee> {
    const colRef = collection(db, COLLECTIONS.EMPLOYEES);
    const docRef = doc(colRef);
    const now = new Date().toISOString();
    const effectiveBranchId = getEffectiveBranchId(employee.branchId || employee.branch);

    const empName = employee.fullName || (employee as any).name || 'Employee';
    const empRole = employee.jobTitle || (employee as any).position || employee.role || 'Staff Member';

    const newEmp: Employee = {
      ...employee,
      fullName: empName,
      name: empName,
      jobTitle: empRole,
      position: empRole,
      role: employee.role || (empRole as any),
      payFrequency: normalizePayFrequency(employee.payFrequency),
      totalSales: 0,
      ordersCount: 0,
      branchId: effectiveBranchId,
      branch: employee.branch || effectiveBranchId,
      id: docRef.id,
      employeeId: employee.employeeId || `EMP-${docRef.id.slice(0, 6).toUpperCase()}`,
      isDeleted: false,
      createdAt: now,
      updatedAt: now
    };

    await setDoc(docRef, newEmp);
    return newEmp;
  }

  async updateEmployee(id: string, employee: Partial<Employee>): Promise<Employee> {
    const ref = doc(db, COLLECTIONS.EMPLOYEES, id);
    const { branchId: _branchId, branch: _branch, totalSales: _ts, ordersCount: _oc, ...safeEmployee } = employee as any;
    if (safeEmployee.payFrequency !== undefined) {
      safeEmployee.payFrequency = normalizePayFrequency(safeEmployee.payFrequency);
    }
    const updatedData = {
      ...safeEmployee,
      updatedAt: new Date().toISOString()
    };

    await updateDoc(ref, updatedData);
    const updated = await this.getEmployeeById(id);
    if (!updated) throw new Error('Failed to retrieve updated employee');
    return updated;
  }

  async deleteEmployee(id: string): Promise<boolean> {
    const ref = doc(db, COLLECTIONS.EMPLOYEES, id);
    await updateDoc(ref, { isDeleted: true, isArchived: true, employmentStatus: 'Inactive', status: 'inactive', deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    return true;
  }

  // ==========================================
  // ATTENDANCE
  // ==========================================

  async getAttendanceRecords(filter?: { employeeId?: string; date?: string; month?: string; branchId?: string }): Promise<AttendanceRecord[]> {
    const effectiveBranch = filter?.branchId && filter.branchId !== 'all' ? filter.branchId : getEffectiveBranchScope();
    const q = effectiveBranch === 'all'
      ? collection(db, COLLECTIONS.HRM_ATTENDANCE)
      : query(collection(db, COLLECTIONS.HRM_ATTENDANCE), where('branchId', '==', effectiveBranch));
    const snap = await getDocs(q);
    let records: AttendanceRecord[] = snap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    } as AttendanceRecord));

    if (filter?.employeeId) {
      records = records.filter((r) => r.employeeId === filter.employeeId);
    }
    if (filter?.date) {
      records = records.filter((r) => r.date === filter.date);
    }
    if (filter?.month) {
      records = records.filter((r) => r.date?.startsWith(filter.month!));
    }

    return records.sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime());
  }

  async clockIn(employeeId: string, employeeName: string, notes?: string): Promise<AttendanceRecord> {
    const token = await getAuthToken();
    const idempotencyKey = `attendance-clockin:${employeeId}:${getMogadishuDateString()}`;
    const response = await fetch(getApiUrl('/api/hrm/attendance/clock-in'), { method:'POST', headers:{'Content-Type':'application/json', 'Idempotency-Key': idempotencyKey, ...(token?{'Authorization':`Bearer ${token}`}:{})}, body:JSON.stringify({employeeId, employeeName, notes, idempotencyKey}) });
    const data = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(data.error || `Attendance clock-in failed (${response.status})`);
    return data.attendance as AttendanceRecord;
  }

  async clockOut(attendanceId: string, notes?: string): Promise<AttendanceRecord> {
    const token = await getAuthToken();
    const idempotencyKey = `attendance-clockout:${attendanceId}`;
    const response = await fetch(getApiUrl(`/api/hrm/attendance/${attendanceId}/clock-out`), { method:'POST', headers:{'Content-Type':'application/json', 'Idempotency-Key': idempotencyKey, ...(token?{'Authorization':`Bearer ${token}`}:{})}, body:JSON.stringify({notes, idempotencyKey}) });
    const data = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(data.error || `Attendance clock-out failed (${response.status})`);
    return data.attendance as AttendanceRecord;
  }

  async recordAttendanceManually(record: Omit<AttendanceRecord, 'id' | 'createdAt'>): Promise<AttendanceRecord> {
    const token = await getAuthToken();
    const idempotencyKey = `attendance-manual:${record.employeeId}:${record.date}:${record.clockIn}`;
    const response = await fetch(getApiUrl('/api/hrm/attendance/manual'), { method:'POST', headers:{'Content-Type':'application/json', 'Idempotency-Key': idempotencyKey, ...(token?{'Authorization':`Bearer ${token}`}:{})}, body:JSON.stringify({record, idempotencyKey}) });
    const data = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(data.error || `Manual attendance failed (${response.status})`);
    return data.attendance as AttendanceRecord;
  }

  async getAllShifts(): Promise<Shift[]> {
    const branchId = getEffectiveBranchScope();
    const shiftsQuery = branchId === 'all'
      ? query(collection(db, COLLECTIONS.HRM_SHIFTS))
      : query(collection(db, COLLECTIONS.HRM_SHIFTS), where('branchId', '==', branchId));
    const snap = await getDocs(shiftsQuery);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Shift));
  }

  async createShift(shift: Omit<Shift, 'id' | 'createdAt'>): Promise<Shift> {
    const docRef = doc(collection(db, COLLECTIONS.HRM_SHIFTS));
    const effectiveBranchId = getEffectiveBranchId(shift.branchId || shift.branch);
    const newShift: Shift = {
      ...shift,
      branchId: effectiveBranchId,
      branch: shift.branch || effectiveBranchId,
      id: docRef.id,
      createdAt: new Date().toISOString()
    };
    await setDoc(docRef, newShift);
    return newShift;
  }

  async updateShift(id: string, shift: Partial<Shift>): Promise<Shift> {
    const ref = doc(db, COLLECTIONS.HRM_SHIFTS, id);
    const { branchId: _branchId, branch: _branch, ...safeShift } = shift as any;
    await updateDoc(ref, {
      ...safeShift,
      updatedAt: new Date().toISOString()
    });
    const snap = await getDoc(ref);
    return { id: snap.id, ...snap.data() } as Shift;
  }

  async deleteShift(id: string): Promise<boolean> {
    await deleteDoc(doc(db, COLLECTIONS.HRM_SHIFTS, id));
    return true;
  }

  async assignEmployeesToShift(shiftId: string, employeeIds: string[]): Promise<Shift> {
    return this.updateShift(shiftId, { assignedEmployeeIds: employeeIds });
  }

  // ==========================================
  // PAYROLL
  // ==========================================

  async getPayrollRecords(filter?: { month?: string; employeeId?: string; status?: string }): Promise<PayrollRecord[]> {
    const branchId = getEffectiveBranchScope();
    const payrollQuery = branchId === 'all'
      ? query(collection(db, COLLECTIONS.HRM_PAYROLL))
      : query(collection(db, COLLECTIONS.HRM_PAYROLL), where('branchId', '==', branchId));
    const snap = await getDocs(payrollQuery);
    let records: PayrollRecord[] = snap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    } as PayrollRecord));

    if (filter?.month) {
      records = records.filter((r) => r.month === filter.month);
    }
    if (filter?.employeeId) {
      records = records.filter((r) => r.employeeId === filter.employeeId);
    }
    if (filter?.status) {
      records = records.filter((r) => r.paymentStatus === filter.status);
    }

    return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async generatePayroll(frequency: PayFrequency, period: string): Promise<PayrollRecord[]> {
    const branchId = getEffectiveBranchId();
    const token = await getAuthToken();
    const idempotencyKey = `payroll-process:${branchId}:${frequency}:${period}`;
    const response = await fetch(getApiUrl('/api/payroll/process'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ frequency, period, branchId })
    });
    if (!response.ok) {
      let message = 'Payroll processing failed';
      try { message = (await response.json())?.error || message; } catch {}
      throw new Error(message);
    }
    const result = await response.json();
    return Array.isArray(result?.payroll) ? result.payroll as PayrollRecord[] : [];
  }

  async generateMonthlyPayroll(month: string): Promise<PayrollRecord[]> {
    return this.generatePayroll('monthly', month);
  }

  async updatePayrollRecord(_id: string, _data: Partial<PayrollRecord>): Promise<PayrollRecord> {
    throw new Error('Direct payroll mutation is disabled. Payroll records are server-authoritative; use the payroll backend workflow.');
  }

  async markPayrollPaid(id: string, paymentMethod: string): Promise<PayrollRecord> {
    const now = new Date().toISOString();
    const payrollRef = doc(db, COLLECTIONS.HRM_PAYROLL, id);
    const payrollSnap = await getDoc(payrollRef);
    if (!payrollSnap.exists()) throw new Error('Payroll record not found');
    const current = { id: payrollSnap.id, ...payrollSnap.data() } as PayrollRecord;
    if (current.paymentStatus === 'paid') return current;

    const token = await getAuthToken();
    const response = await fetch(getApiUrl('/api/salaries'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `payroll-payment:${id}`,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        salaryData: {
          payrollId: id,
          employeeId: current.employeeId,
          employeeName: current.employeeName,
          period: current.periodStart || current.month,
          periodStart: current.periodStart,
          periodEnd: current.periodEnd,
          payFrequency: current.payFrequency,
          baseSalary: current.basicSalary,
          overtimePay: current.overtimePay || 0,
          bonuses: current.bonuses || 0,
          allowances: (current as any).allowances || 0,
          deductions: current.deductions || 0,
          advances: current.advances || 0,
          netPaid: current.netSalary,
          paymentMethod,
          branchId: current.branchId || (current as any).branch || ''
        }
      })
    });
    if (!response.ok) {
      let message = 'Salary disbursement failed';
      try { message = (await response.json())?.error || message; } catch {}
      throw new Error(message);
    }

    // Payroll status is finalized by the trusted backend transaction; direct client writes are blocked by Firestore Rules.
    const finalSnap = await getDoc(payrollRef);
    return { id: finalSnap.id, ...finalSnap.data() } as PayrollRecord;
  }

  // ==========================================
  // LEAVE MANAGEMENT
  // ==========================================

  async getLeaveRequests(filter?: { employeeId?: string; status?: string }): Promise<LeaveRequest[]> {
    const branchId = getEffectiveBranchScope();
    const leaveConstraints = branchId !== 'all' ? [where('branchId', '==', branchId)] : [];
    if (filter?.employeeId) leaveConstraints.push(where('employeeId', '==', filter.employeeId));
    const leaveQuery = query(collection(db, COLLECTIONS.HRM_LEAVE_REQUESTS), ...leaveConstraints);
    const snap = await getDocs(leaveQuery);
    let requests: LeaveRequest[] = snap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    } as LeaveRequest));

    if (filter?.employeeId) {
      requests = requests.filter((r) => r.employeeId === filter.employeeId);
    }
    if (filter?.status) {
      requests = requests.filter((r) => r.workflowStatus === filter.status);
    }

    return requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createLeaveRequest(
    request: Omit<LeaveRequest, 'id' | 'leaveNumber' | 'createdAt' | 'workflowStatus'>
  ): Promise<LeaveRequest> {
    const start = new Date(request.startDate);
    const end = new Date(request.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error('Invalid leave start or end date.');
    }
    if (start.getTime() > end.getTime()) {
      throw new Error('Leave start date cannot be after end date.');
    }

    const docRef = doc(collection(db, COLLECTIONS.HRM_LEAVE_REQUESTS));
    const now = new Date().toISOString();

    // Prevent overlapping active/approved leave requests for this employee
    const existingQ = query(
      collection(db, COLLECTIONS.HRM_LEAVE_REQUESTS),
      where('employeeId', '==', request.employeeId)
    );
    const existingSnap = await getDocs(existingQ);
    const newStartMs = start.getTime();
    const newEndMs = end.getTime();
    for (const d of existingSnap.docs) {
      const data = d.data();
      if (['Rejected', 'Cancelled', 'cancelled'].includes(data.workflowStatus)) continue;
      const exStartMs = new Date(data.startDate).getTime();
      const exEndMs = new Date(data.endDate).getTime();
      if (Number.isFinite(exStartMs) && Number.isFinite(exEndMs)) {
        if (Math.max(newStartMs, exStartMs) <= Math.min(newEndMs, exEndMs)) {
          throw new Error(`Overlapping leave request already exists (#${data.leaveNumber || d.id}) from ${data.startDate} to ${data.endDate}.`);
        }
      }
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const leaveNumber = `LR-${getMogadishuDateString(now).replace(/-/g, '')}-${docRef.id.slice(0, 6).toUpperCase()}`;
    const effectiveBranchId = getEffectiveBranchId(request.branchId || request.branch);
    const {
      managerApproval: _ma,
      hrApproval: _hra,
      approvedBy: _ab,
      approvedAt: _aa,
      rejectedReason: _rr,
      ...safeRequest
    } = request as any;

    const newReq: LeaveRequest = {
      ...safeRequest,
      branchId: effectiveBranchId,
      branch: request.branch || effectiveBranchId,
      id: docRef.id,
      leaveNumber,
      daysCount: daysCount || 1,
      status: 'pending' as any,
      approvalStatus: 'pending' as any,
      workflowStatus: 'Request',
      createdAt: now
    };

    await setDoc(docRef, newReq);
    return newReq;
  }

  async approveLeaveByManager(id: string, approvedBy: string = 'Manager', notes?: string): Promise<LeaveRequest> {
    const ref = doc(db, COLLECTIONS.HRM_LEAVE_REQUESTS, id);
    const now = new Date().toISOString();

    return await runTransaction(db, async (transaction) => {
      const currentSnap = await transaction.get(ref);
      if (!currentSnap.exists()) throw new Error('Leave request not found.');
      const leaveData = currentSnap.data() as LeaveRequest;
      if (leaveData.workflowStatus === 'Rejected' || (leaveData as any).status === 'rejected') {
        throw new Error('Cannot approve a rejected leave request.');
      }
      if (leaveData.workflowStatus === 'Completed' || (leaveData as any).status === 'approved') {
        throw new Error('Leave request is already approved and completed.');
      }

      const updated: Record<string, any> = {
        workflowStatus: 'Manager Approval',
        managerApproval: {
          approvedBy: approvedBy || 'Manager',
          approvedAt: now,
          notes: notes || 'Approved by Manager'
        },
        updatedAt: now
      };

      transaction.update(ref, updated);
      return { ...leaveData, ...updated, id: currentSnap.id } as LeaveRequest;
    });
  }

  async approveLeaveByHR(id: string, approvedBy: string = 'HR Admin', notes?: string): Promise<LeaveRequest> {
    const ref = doc(db, COLLECTIONS.HRM_LEAVE_REQUESTS, id);
    const now = new Date().toISOString();
    const today = getMogadishuDateString(now);

    return await runTransaction(db, async (transaction) => {
      const currentSnap = await transaction.get(ref);
      if (!currentSnap.exists()) throw new Error('Leave request not found.');
      const leaveData = currentSnap.data() as LeaveRequest;
      if (!leaveData.employeeId) {
        throw new Error('Leave request is missing employeeId.');
      }
      if (leaveData.workflowStatus === 'Rejected' || (leaveData as any).status === 'rejected') {
        throw new Error('Cannot approve a rejected leave request.');
      }
      if (leaveData.workflowStatus === 'Request') {
        throw new Error('Leave request requires Manager Approval before final HR approval.');
      }

      const empRef = doc(db, COLLECTIONS.EMPLOYEES, leaveData.employeeId);
      const empSnap = await transaction.get(empRef);
      if (!empSnap.exists()) {
        throw new Error(`Linked employee "${leaveData.employeeId}" not found for ongoing leave approval.`);
      }

      const updated: Record<string, any> = {
        workflowStatus: 'Completed',
        status: 'approved',
        approvalStatus: 'approved',
        hrApproval: {
          approvedBy: approvedBy || 'HR Admin',
          approvedAt: now,
          notes: notes || 'Final Approval by HR'
        },
        updatedAt: now
      };

      transaction.update(ref, updated);
      const isLeaveActiveToday = !leaveData.startDate || !leaveData.endDate || (today >= leaveData.startDate && today <= leaveData.endDate);
      if (isLeaveActiveToday) {
        transaction.update(empRef, {
          status: 'on_leave',
          employmentStatus: 'On Leave',
          updatedAt: now
        });
      }

      return {
        ...leaveData,
        ...updated,
        id: currentSnap.id
      } as LeaveRequest;
    });
  }

  async rejectLeaveRequest(id: string, rejectedBy: string = 'HR Admin', notes?: string): Promise<LeaveRequest> {
    const ref = doc(db, COLLECTIONS.HRM_LEAVE_REQUESTS, id);
    const now = new Date().toISOString();

    return await runTransaction(db, async (transaction) => {
      const currentSnap = await transaction.get(ref);
      if (!currentSnap.exists()) throw new Error('Leave request not found.');
      const leaveData = currentSnap.data() as LeaveRequest;
      let empRef: any = null;
      let empSnap: any = null;
      if (leaveData.employeeId && (leaveData.workflowStatus === 'Completed' || (leaveData as any).status === 'approved')) {
        empRef = doc(db, COLLECTIONS.EMPLOYEES, leaveData.employeeId);
        empSnap = await transaction.get(empRef);
      }

      const updated: Record<string, any> = {
        workflowStatus: 'Rejected',
        status: 'rejected',
        approvalStatus: 'rejected',
        rejectedReason: notes || 'Leave request rejected',
        hrApproval: {
          approvedBy: rejectedBy || 'HR Admin',
          approvedAt: now,
          notes: notes || 'Leave request rejected'
        },
        updatedAt: now
      };

      transaction.update(ref, updated);
      if (empRef && empSnap?.exists()) {
        const empData = empSnap.data() || {};
        if (empData.status === 'on_leave' || empData.employmentStatus === 'On Leave') {
          transaction.update(empRef, {
            status: 'active',
            employmentStatus: 'Active',
            updatedAt: now
          });
        }
      }

      return { ...leaveData, ...updated, id: currentSnap.id } as LeaveRequest;
    });
  }

  // ==========================================
  // PERFORMANCE
  // ==========================================

  async getPerformanceRecords(filter?: { employeeId?: string; period?: string }): Promise<PerformanceRecord[]> {
    const branchId = getEffectiveBranchScope();
    const performanceConstraints = branchId !== 'all' ? [where('branchId', '==', branchId)] : [];
    if (filter?.employeeId) performanceConstraints.push(where('employeeId', '==', filter.employeeId));
    const performanceQuery = query(collection(db, COLLECTIONS.HRM_PERFORMANCE), ...performanceConstraints);
    const snap = await getDocs(performanceQuery);
    let records: PerformanceRecord[] = snap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    } as PerformanceRecord));

    if (filter?.employeeId) {
      records = records.filter((r) => r.employeeId === filter.employeeId);
    }
    if (filter?.period) {
      records = records.filter((r) => r.period === filter.period);
    }

    return records.sort((a, b) => b.period.localeCompare(a.period));
  }

  async upsertPerformanceRecord(record: Omit<PerformanceRecord, 'id' | 'updatedAt'>): Promise<PerformanceRecord> {
    const docId = `${record.employeeId}_${record.period}`;
    const docRef = doc(db, COLLECTIONS.HRM_PERFORMANCE, docId);
    const now = new Date().toISOString();
    const effectiveBranchId = getEffectiveBranchId(record.branchId || record.branch);

    const newRecord: PerformanceRecord = {
      ...record,
      branchId: effectiveBranchId,
      branch: record.branch || effectiveBranchId,
      id: docId,
      updatedAt: now
    };

    await setDoc(docRef, newRecord, { merge: true });
    return newRecord;
  }

  // ==========================================
  // DOCUMENTS
  // ==========================================

  async getEmployeeDocuments(employeeId: string): Promise<EmployeeDocument[]> {
    const branchId = getEffectiveBranchScope();
    const constraints = branchId !== 'all' ? [where('branchId', '==', branchId)] : [];
    constraints.push(where('employeeId', '==', employeeId));
    const snap = await getDocs(query(collection(db, COLLECTIONS.HRM_EMPLOYEE_DOCUMENTS), ...constraints));
    const docs = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as EmployeeDocument))
      .filter((d) => d.employeeId === employeeId);
    return docs.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }

  async addEmployeeDocument(docData: Omit<EmployeeDocument, 'id' | 'uploadedAt'>): Promise<EmployeeDocument> {
    const docRef = doc(collection(db, COLLECTIONS.HRM_EMPLOYEE_DOCUMENTS));
    const now = new Date().toISOString();
    const effectiveBranchId = getEffectiveBranchId(docData.branchId || docData.branch);

    const newDoc: EmployeeDocument = {
      ...docData,
      branchId: effectiveBranchId,
      branch: docData.branch || effectiveBranchId,
      id: docRef.id,
      uploadedAt: now
    };

    await setDoc(docRef, newDoc);
    return newDoc;
  }

  async deleteEmployeeDocument(id: string): Promise<boolean> {
    await deleteDoc(doc(db, COLLECTIONS.HRM_EMPLOYEE_DOCUMENTS, id));
    return true;
  }

  // ==========================================
  // NOTIFICATIONS
  // ==========================================

  async getNotifications(employeeId?: string): Promise<HRNotification[]> {
    const branchId = getEffectiveBranchScope();
    const notificationConstraints = branchId !== 'all' ? [where('branchId', '==', branchId)] : [];
    if (employeeId) notificationConstraints.push(where('employeeId', '==', employeeId));
    const notificationsQuery = query(collection(db, COLLECTIONS.HRM_EMPLOYEE_NOTIFICATIONS), ...notificationConstraints);
    const snap = await getDocs(notificationsQuery);
    let notifs: HRNotification[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as HRNotification));
    if (employeeId) {
      notifs = notifs.filter((n) => !n.employeeId || n.employeeId === employeeId);
    }
    return notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createNotification(
    notification: Omit<HRNotification, 'id' | 'createdAt' | 'isRead'>
  ): Promise<HRNotification> {
    const docRef = doc(collection(db, COLLECTIONS.HRM_EMPLOYEE_NOTIFICATIONS));
    const now = new Date().toISOString();
    const effectiveBranchId = getEffectiveBranchId(notification.branchId || (notification as any).branch);

    const newNotif: HRNotification = {
      ...notification,
      branchId: effectiveBranchId,
      branch: (notification as any).branch || effectiveBranchId,
      id: docRef.id,
      isRead: false,
      createdAt: now
    };

    await setDoc(docRef, newNotif);
    return newNotif;
  }

  async markNotificationRead(id: string): Promise<boolean> {
    const ref = doc(db, COLLECTIONS.HRM_EMPLOYEE_NOTIFICATIONS, id);
    await updateDoc(ref, { isRead: true });
    return true;
  }

  // ==========================================
  // ANALYTICS
  // ==========================================

  async getHRMAnalytics(): Promise<HRMAnalyticsData> {
    const employees = await this.getAllEmployees();
    const today = getMogadishuDateString();
    const attendance = await this.getAttendanceRecords({ date: today });
    const leave = await this.getLeaveRequests();
    const currentMonth = today.substring(0, 7);
    const payroll = await this.getPayrollRecords({ month: currentMonth });

    const totalEmployees = employees.length;
    const activeEmployees = employees.filter((e) => e.employmentStatus === 'Active').length;
    const onLeaveEmployees = employees.filter((e) => e.employmentStatus === 'On Leave').length;

    const presentToday = attendance.filter((a) => a.status === 'present').length;
    const todayAttendanceRate = totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 0;

    const pendingLeaveRequests = leave.filter(
      (l) => l.workflowStatus === 'Request' || l.workflowStatus === 'Manager Approval'
    ).length;

    const monthlyPayrollTotal = payroll.reduce((acc, p) => acc + (p.netSalary || 0), 0);

    const departmentDistribution: Record<string, number> = {};
    const roleDistribution: Record<string, number> = {};

    employees.forEach((e) => {
      departmentDistribution[e.department] = (departmentDistribution[e.department] || 0) + 1;
      roleDistribution[e.role] = (roleDistribution[e.role] || 0) + 1;
    });

    return {
      totalEmployees,
      activeEmployees,
      onLeaveEmployees,
      todayAttendanceRate,
      pendingLeaveRequests,
      monthlyPayrollTotal,
      departmentDistribution,
      roleDistribution
    };
  }
}
