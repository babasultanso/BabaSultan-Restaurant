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
} from '../entities/hrm';

export interface IHRMRepository {
  // Employee Management
  getAllEmployees(branchId?: string): Promise<Employee[]>;
  getEmployeeById(id: string): Promise<Employee | null>;
  createEmployee(employee: Omit<Employee, 'id' | 'createdAt'>): Promise<Employee>;
  updateEmployee(id: string, employee: Partial<Employee>): Promise<Employee>;
  deleteEmployee(id: string): Promise<boolean>;

  // Attendance
  getAttendanceRecords(filter?: { employeeId?: string; date?: string; month?: string }): Promise<AttendanceRecord[]>;
  clockIn(employeeId: string, employeeName: string, notes?: string): Promise<AttendanceRecord>;
  clockOut(attendanceId: string, notes?: string): Promise<AttendanceRecord>;
  recordAttendanceManually(record: Omit<AttendanceRecord, 'id' | 'createdAt'>): Promise<AttendanceRecord>;

  // Shift Management
  getAllShifts(): Promise<Shift[]>;
  createShift(shift: Omit<Shift, 'id' | 'createdAt'>): Promise<Shift>;
  updateShift(id: string, shift: Partial<Shift>): Promise<Shift>;
  deleteShift(id: string): Promise<boolean>;
  assignEmployeesToShift(shiftId: string, employeeIds: string[]): Promise<Shift>;

  // Payroll
  getPayrollRecords(filter?: { month?: string; employeeId?: string; status?: string }): Promise<PayrollRecord[]>;
  generateMonthlyPayroll(month: string): Promise<PayrollRecord[]>;
  updatePayrollRecord(id: string, data: Partial<PayrollRecord>): Promise<PayrollRecord>;
  markPayrollPaid(id: string, paymentMethod: string): Promise<PayrollRecord>;

  // Leave Management
  getLeaveRequests(filter?: { employeeId?: string; status?: string }): Promise<LeaveRequest[]>;
  createLeaveRequest(request: Omit<LeaveRequest, 'id' | 'leaveNumber' | 'createdAt' | 'workflowStatus'>): Promise<LeaveRequest>;
  approveLeaveByManager(id: string, approvedBy: string, notes?: string): Promise<LeaveRequest>;
  approveLeaveByHR(id: string, approvedBy: string, notes?: string): Promise<LeaveRequest>;
  rejectLeaveRequest(id: string, rejectedBy: string, notes?: string): Promise<LeaveRequest>;

  // Performance
  getPerformanceRecords(filter?: { employeeId?: string; period?: string }): Promise<PerformanceRecord[]>;
  upsertPerformanceRecord(record: Omit<PerformanceRecord, 'id' | 'updatedAt'>): Promise<PerformanceRecord>;

  // Documents
  getEmployeeDocuments(employeeId: string): Promise<EmployeeDocument[]>;
  addEmployeeDocument(doc: Omit<EmployeeDocument, 'id' | 'uploadedAt'>): Promise<EmployeeDocument>;
  deleteEmployeeDocument(id: string): Promise<boolean>;

  // Notifications
  getNotifications(employeeId?: string): Promise<HRNotification[]>;
  createNotification(notification: Omit<HRNotification, 'id' | 'createdAt' | 'isRead'>): Promise<HRNotification>;
  markNotificationRead(id: string): Promise<boolean>;

  // Analytics
  getHRMAnalytics(): Promise<HRMAnalyticsData>;
}
