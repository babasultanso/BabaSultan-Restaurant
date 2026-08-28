import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy
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
      const q = branchId && branchId !== 'all'
        ? query(collection(db, COLLECTIONS.EMPLOYEES), where('branchId', '==', branchId))
        : collection(db, COLLECTIONS.EMPLOYEES);
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
          dateOfBirth: data.dateOfBirth || '1995-01-01',
          gender: data.gender || 'Male',
          nationality: data.nationality || 'Somali',
          hireDate: data.hireDate || getMogadishuDateString(),
          jobTitle: data.jobTitle || data.role || 'Staff Member',
          department: data.department || 'General Operations',
          branchId: data.branchId || data.branch || '',
          branch: data.branch || data.branchId || '',
          employmentStatus: data.employmentStatus || 'Active',
          status: data.status || (data.employmentStatus === 'Active' ? 'active' : 'on_leave'),
          role: data.role || 'Employee',
          salary: Number(data.salary) || 500,
          totalSales: Number(data.totalSales) || 0,
          ordersCount: Number(data.ordersCount) || 0,
          bankAccount: data.bankAccount,
          emergencyContact: data.emergencyContact || {
            name: 'Emergency Contact',
            relationship: 'Family',
            phone: data.phone || '+252 61 000 0000'
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
      dateOfBirth: data.dateOfBirth || '1995-01-01',
      gender: data.gender || 'Male',
      nationality: data.nationality || 'Somali',
      hireDate: data.hireDate || getMogadishuDateString(),
      jobTitle: data.jobTitle || data.role || 'Staff Member',
      department: data.department || 'General Operations',
      branchId: data.branchId || data.branch || '',
      branch: data.branch || data.branchId || '',
      employmentStatus: data.employmentStatus || 'Active',
      status: data.status || (data.employmentStatus === 'Active' ? 'active' : 'on_leave'),
      role: data.role || 'Employee',
      salary: Number(data.salary) || 500,
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
    await deleteDoc(ref);
    return true;
  }

  // ==========================================
  // ATTENDANCE
  // ==========================================

  async getAttendanceRecords(filter?: { employeeId?: string; date?: string; month?: string }): Promise<AttendanceRecord[]> {
    const snap = await getDocs(collection(db, COLLECTIONS.HRM_ATTENDANCE));
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
    const today = getMogadishuDateString();
    const existing = await this.getAttendanceRecords({ employeeId, date: today });
    const active = existing.find((r) => !r.clockOut);
    if (active) return active;

    const docRef = doc(collection(db, COLLECTIONS.HRM_ATTENDANCE));
    const now = new Date();
    const clockInTimeStr = now.toISOString();

    // Determine if late (after 08:30 AM)
    const scheduledHour = 8;
    const scheduledMinute = 30;
    const isLate = now.getHours() > scheduledHour || (now.getHours() === scheduledHour && now.getMinutes() > scheduledMinute);

    const empDoc = await this.getEmployeeById(employeeId);
    const effectiveBranchId = getEffectiveBranchId(empDoc?.branchId || empDoc?.branch);

    const record: AttendanceRecord = {
      id: docRef.id,
      employeeId,
      employeeName,
      branchId: effectiveBranchId,
      branch: empDoc?.branch || effectiveBranchId,
      date: today,
      clockIn: clockInTimeStr,
      breakTimeMinutes: 0,
      workingHours: 0,
      overtimeHours: 0,
      isLate,
      isEarlyLeave: false,
      status: 'present',
      notes: notes || '',
      createdAt: clockInTimeStr
    };

    await setDoc(docRef, record);
    return record;
  }

  async clockOut(attendanceId: string, notes?: string): Promise<AttendanceRecord> {
    const ref = doc(db, COLLECTIONS.HRM_ATTENDANCE, attendanceId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Attendance record not found');

    const data = snap.data() as AttendanceRecord;
    const now = new Date();
    const clockOutTimeStr = now.toISOString();

    const start = new Date(data.clockIn).getTime();
    const end = now.getTime();
    const diffMs = end - start;
    const diffHours = Math.max(0, diffMs / (1000 * 60 * 60) - (data.breakTimeMinutes || 0) / 60);

    const workingHours = Number(diffHours.toFixed(2));
    const overtimeHours = Number(Math.max(0, workingHours - 8).toFixed(2));
    const isEarlyLeave = now.getHours() < 16; // Leaving before 4:00 PM

    const updated: Partial<AttendanceRecord> = {
      clockOut: clockOutTimeStr,
      workingHours,
      overtimeHours,
      isEarlyLeave,
      notes: notes ? (data.notes ? `${data.notes} | ${notes}` : notes) : data.notes
    };

    await updateDoc(ref, updated);
    return { ...data, ...updated } as AttendanceRecord;
  }

  async recordAttendanceManually(record: Omit<AttendanceRecord, 'id' | 'createdAt'>): Promise<AttendanceRecord> {
    const docRef = doc(collection(db, COLLECTIONS.HRM_ATTENDANCE));
    const now = new Date().toISOString();
    const effectiveBranchId = getEffectiveBranchId(record.branchId || (record as any).branch);
    const newRecord: AttendanceRecord = {
      ...record,
      branchId: effectiveBranchId,
      branch: record.branch || effectiveBranchId,
      id: docRef.id,
      createdAt: now
    };
    await setDoc(docRef, newRecord);
    return newRecord;
  }

  // ==========================================
  // SHIFT MANAGEMENT
  // ==========================================

  async getAllShifts(): Promise<Shift[]> {
    const snap = await getDocs(collection(db, COLLECTIONS.HRM_SHIFTS));
    if (snap.empty) {
      // Create default standard shifts if empty
      const defaultShifts: Omit<Shift, 'id' | 'createdAt'>[] = [
        {
          name: 'Morning Shift',
          type: 'morning',
          startTime: '08:00',
          endTime: '16:00',
          workingHours: 8,
          department: 'Operations',
          assignedEmployeeIds: [],
          status: 'active'
        },
        {
          name: 'Evening Shift',
          type: 'evening',
          startTime: '16:00',
          endTime: '00:00',
          workingHours: 8,
          department: 'Kitchen & Dining',
          assignedEmployeeIds: [],
          status: 'active'
        },
        {
          name: 'Night Shift',
          type: 'night',
          startTime: '00:00',
          endTime: '08:00',
          workingHours: 8,
          department: 'Security & Sanitation',
          assignedEmployeeIds: [],
          status: 'active'
        }
      ];

      const created: Shift[] = [];
      for (const s of defaultShifts) {
        const item = await this.createShift(s);
        created.push(item);
      }
      return created;
    }

    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    } as Shift));
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
    const snap = await getDocs(collection(db, COLLECTIONS.HRM_PAYROLL));
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

  async generateMonthlyPayroll(month: string): Promise<PayrollRecord[]> {
    const employees = await this.getAllEmployees();
    const attendance = await this.getAttendanceRecords({ month });
    const generated: PayrollRecord[] = [];

    for (const emp of employees) {
      // Calculate total overtime hours worked in month
      const empAttendance = attendance.filter((a) => a.employeeId === emp.id);
      const totalOvertimeHours = empAttendance.reduce((acc, a) => acc + (a.overtimeHours || 0), 0);

      const hourlyRate = (emp.salary || 500) / 160;
      const overtimePay = Number((totalOvertimeHours * hourlyRate * 1.5).toFixed(2));
      const bonuses = 0;
      const deductions = 0;
      const advances = 0;

      const netSalary = Number((emp.salary + overtimePay + bonuses - deductions - advances).toFixed(2));

      const payrollNumber = `PAY-${month}-${emp.employeeId || emp.id.substring(0, 5)}`;
      const docRef = doc(db, COLLECTIONS.HRM_PAYROLL, `${month}_${emp.id}`);

      const effectiveBranchId = getEffectiveBranchId(emp.branchId || emp.branch);
      const record: PayrollRecord = {
        id: docRef.id,
        payrollNumber,
        employeeId: emp.id,
        employeeName: emp.fullName,
        jobTitle: emp.jobTitle,
        department: emp.department,
        branchId: effectiveBranchId,
        branch: emp.branch || effectiveBranchId,
        month,
        basicSalary: emp.salary,
        overtimePay,
        bonuses,
        deductions,
        advances,
        netSalary,
        paymentStatus: 'pending',
        createdAt: new Date().toISOString()
      };

      await setDoc(docRef, record, { merge: true });
      generated.push(record);
    }

    return generated;
  }

  async updatePayrollRecord(id: string, data: Partial<PayrollRecord>): Promise<PayrollRecord> {
    const ref = doc(db, COLLECTIONS.HRM_PAYROLL, id);
    await setDoc(ref, data, { merge: true });
    const snap = await getDoc(ref);
    return { id: snap.id, ...snap.data() } as PayrollRecord;
  }

  async markPayrollPaid(id: string, paymentMethod: string): Promise<PayrollRecord> {
    const now = new Date().toISOString();
    const updated = await this.updatePayrollRecord(id, {
      paymentStatus: 'paid',
      paymentMethod,
      paymentDate: now
    });

    try {
      const token = await getAuthToken();
      await fetch(getApiUrl('/api/salaries'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          salaryData: {
            employeeId: updated.employeeId,
            employeeName: updated.employeeName,
            period: updated.month,
            netPaid: updated.netSalary,
            paymentMethod,
            branchId: updated.branchId || (updated as any).branch || ''
          }
        })
      });
    } catch (e) {
      console.warn('Salary disbursement backend log note:', e);
    }

    return updated;
  }

  // ==========================================
  // LEAVE MANAGEMENT
  // ==========================================

  async getLeaveRequests(filter?: { employeeId?: string; status?: string }): Promise<LeaveRequest[]> {
    const snap = await getDocs(collection(db, COLLECTIONS.HRM_LEAVE_REQUESTS));
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
      workflowStatus: 'HR Approval',
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
    const snap = await getDocs(collection(db, COLLECTIONS.HRM_PERFORMANCE));
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
    const snap = await getDocs(collection(db, COLLECTIONS.HRM_EMPLOYEE_DOCUMENTS));
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
    const snap = await getDocs(collection(db, COLLECTIONS.HRM_EMPLOYEE_NOTIFICATIONS));
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
