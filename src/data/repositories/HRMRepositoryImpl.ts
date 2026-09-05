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
  deleteDoc
} from 'firebase/firestore';
import { db, COLLECTIONS, getAuthToken, getEffectiveBranchId } from '../../lib/firebase';
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

export class HRMRepositoryImpl implements IHRMRepository {
  // ==========================================
  // EMPLOYEE MANAGEMENT
  // ==========================================

  async getAllEmployees(branchId?: string): Promise<Employee[]> {
    try {
      const effectiveBranch = branchId && branchId !== 'all' ? branchId : getEffectiveBranchId();
      const q = effectiveBranch === 'all'
        ? collection(db, COLLECTIONS.EMPLOYEES)
        : query(collection(db, COLLECTIONS.EMPLOYEES), where('branchId', '==', effectiveBranch));
      const snap = await getDocs(q);
      const employees: Employee[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          employeeId: data.employeeId || d.id,
          fullName: data.fullName || data.name || 'Unnamed Employee',
          name: data.name || data.fullName || 'Unnamed Employee',
          photo: data.photo || data.photoUrl || '',
          nationalIdOrPassport: data.nationalIdOrPassport || data.nationalId || '',
          phone: data.phone || '',
          email: data.email || '',
          address: data.address || '',
          dateOfBirth: data.dateOfBirth || '',
          gender: data.gender || '',
          nationality: data.nationality || '',
          hireDate: data.hireDate || getMogadishuDateString(),
          jobTitle: data.jobTitle || data.role || 'Staff Member',
          department: data.department || 'General Operations',
          branchId: data.branchId || data.branch || '',
          branch: data.branch || data.branchId || '',
          employmentStatus: data.employmentStatus || 'Active',
          status: data.status || (data.employmentStatus === 'Active' ? 'active' : 'on_leave'),
          role: data.role || 'Employee',
          salary: Number.isFinite(Number(data.salary)) ? Number(data.salary) : 0,
          payFrequency: ['daily', 'weekly', 'monthly'].includes(String(data.payFrequency || '').toLowerCase()) ? String(data.payFrequency).toLowerCase() : 'monthly',
          totalSales: Number(data.totalSales) || 0,
          ordersCount: Number(data.ordersCount) || 0,
          bankAccount: data.bankAccount,
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
    return {
      id: snap.id,
      employeeId: data.employeeId || snap.id,
      fullName: data.fullName || data.name || 'Unnamed Employee',
      name: data.name || data.fullName || 'Unnamed Employee',
      photo: data.photo || data.photoUrl || '',
      nationalIdOrPassport: data.nationalIdOrPassport || '',
      phone: data.phone || '',
      email: data.email || '',
      address: data.address || '',
      dateOfBirth: data.dateOfBirth || '',
      gender: data.gender || '',
      nationality: data.nationality || '',
      hireDate: data.hireDate || getMogadishuDateString(),
      jobTitle: data.jobTitle || data.role || 'Staff Member',
      department: data.department || 'General Operations',
      branchId: data.branchId || data.branch || '',
      branch: data.branch || data.branchId || '',
      employmentStatus: data.employmentStatus || 'Active',
      status: data.status || (data.employmentStatus === 'Active' ? 'active' : 'on_leave'),
      role: data.role || 'Employee',
      salary: Number.isFinite(Number(data.salary)) ? Number(data.salary) : 0,
      totalSales: Number(data.totalSales) || 0,
      ordersCount: Number(data.ordersCount) || 0,
      bankAccount: data.bankAccount,
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

    const newEmp: Employee = {
      ...employee,
      branchId: effectiveBranchId,
      branch: employee.branch || effectiveBranchId,
      id: docRef.id,
      employeeId: employee.employeeId || `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: now,
      updatedAt: now
    };

    await setDoc(docRef, newEmp);
    return newEmp;
  }

  async updateEmployee(id: string, employee: Partial<Employee>): Promise<Employee> {
    const ref = doc(db, COLLECTIONS.EMPLOYEES, id);
    const updatedData = {
      ...employee,
      updatedAt: new Date().toISOString()
    };

    await setDoc(ref, updatedData, { merge: true });
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
    const effectiveBranch = filter?.branchId && filter.branchId !== 'all' ? filter.branchId : getEffectiveBranchId();
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
    const response = await fetch(getApiUrl('/api/hrm/attendance/clock-in'), { method:'POST', headers:{'Content-Type':'application/json', ...(token?{'Authorization':`Bearer ${token}`}:{})}, body:JSON.stringify({employeeId, employeeName, notes}) });
    const data = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(data.error || `Attendance clock-in failed (${response.status})`);
    return data.attendance as AttendanceRecord;
  }

  async clockOut(attendanceId: string, notes?: string): Promise<AttendanceRecord> {
    const token = await getAuthToken();
    const response = await fetch(getApiUrl(`/api/hrm/attendance/${attendanceId}/clock-out`), { method:'POST', headers:{'Content-Type':'application/json', ...(token?{'Authorization':`Bearer ${token}`}:{})}, body:JSON.stringify({notes}) });
    const data = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(data.error || `Attendance clock-out failed (${response.status})`);
    return data.attendance as AttendanceRecord;
  }

  async recordAttendanceManually(record: Omit<AttendanceRecord, 'id' | 'createdAt'>): Promise<AttendanceRecord> {
    const token = await getAuthToken();
    const response = await fetch(getApiUrl('/api/hrm/attendance/manual'), { method:'POST', headers:{'Content-Type':'application/json', ...(token?{'Authorization':`Bearer ${token}`}:{})}, body:JSON.stringify({record}) });
    const data = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(data.error || `Manual attendance failed (${response.status})`);
    return data.attendance as AttendanceRecord;
  }

  async getAllShifts(): Promise<Shift[]> {
    const branchId = getEffectiveBranchId();
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
    await setDoc(ref, shift, { merge: true });
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
    const branchId = getEffectiveBranchId();
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
    const branchId = getEffectiveBranchId();
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
    const docRef = doc(collection(db, COLLECTIONS.HRM_LEAVE_REQUESTS));
    const now = new Date().toISOString();

    const start = new Date(request.startDate);
    const end = new Date(request.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const leaveNumber = `LR-${Math.floor(1000 + Math.random() * 9000)}`;
    const effectiveBranchId = getEffectiveBranchId(request.branchId || request.branch);

    const newReq: LeaveRequest = {
      ...request,
      branchId: effectiveBranchId,
      branch: request.branch || effectiveBranchId,
      id: docRef.id,
      leaveNumber,
      daysCount: daysCount || 1,
      workflowStatus: 'Request',
      createdAt: now
    };

    await setDoc(docRef, newReq);
    return newReq;
  }

  async approveLeaveByManager(id: string, approvedBy: string, notes?: string): Promise<LeaveRequest> {
    const ref = doc(db, COLLECTIONS.HRM_LEAVE_REQUESTS, id);
    const now = new Date().toISOString();

    const updated: Partial<LeaveRequest> = {
      workflowStatus: 'Manager Approval',
      managerApproval: {
        approvedBy,
        approvedAt: now,
        notes: notes || 'Approved by Manager'
      }
    };

    await updateDoc(ref, updated);
    const snap = await getDoc(ref);
    return { id: snap.id, ...snap.data() } as LeaveRequest;
  }

  async approveLeaveByHR(id: string, approvedBy: string, notes?: string): Promise<LeaveRequest> {
    const ref = doc(db, COLLECTIONS.HRM_LEAVE_REQUESTS, id);
    const now = new Date().toISOString();

    const updated: Partial<LeaveRequest> = {
      workflowStatus: 'Completed',
      hrApproval: {
        approvedBy,
        approvedAt: now,
        notes: notes || 'Final Approval by HR'
      }
    };

    await updateDoc(ref, updated);
    const snap = await getDoc(ref);
    return { id: snap.id, ...snap.data() } as LeaveRequest;
  }

  async rejectLeaveRequest(id: string, rejectedBy: string, notes?: string): Promise<LeaveRequest> {
    const ref = doc(db, COLLECTIONS.HRM_LEAVE_REQUESTS, id);
    const now = new Date().toISOString();

    const updated: Partial<LeaveRequest> = {
      workflowStatus: 'Rejected',
      hrApproval: {
        approvedBy: rejectedBy,
        approvedAt: now,
        notes: notes || 'Leave request rejected'
      }
    };

    await updateDoc(ref, updated);
    const snap = await getDoc(ref);
    return { id: snap.id, ...snap.data() } as LeaveRequest;
  }

  // ==========================================
  // PERFORMANCE
  // ==========================================

  async getPerformanceRecords(filter?: { employeeId?: string; period?: string }): Promise<PerformanceRecord[]> {
    const branchId = getEffectiveBranchId();
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
    const branchId = getEffectiveBranchId();
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
    const branchId = getEffectiveBranchId();
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
