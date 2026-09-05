import { translateRawUi } from '../../../i18n/rawUi';
import React, { useState, useEffect } from 'react';
import {
  Employee,
  AttendanceRecord,
  Shift,
  PayrollRecord,
  LeaveRequest,
  PerformanceRecord,
  EmployeeDocument,
  HRNotification,
  HRMAnalyticsData,
  EmployeeRole,
  PayFrequency
} from '../../../domain/entities/hrm';
import { HRMRepositoryImpl } from '../../../data/repositories/HRMRepositoryImpl';
import { EmployeeProfileModal } from './EmployeeProfileModal';
import { EmployeeFormModal } from './EmployeeFormModal';
import { useAuth } from '../../context/AuthContext';
import { getMogadishuDateString } from '../../../lib/dateUtils';
import {
  Users,
  Clock,
  Calendar,
  DollarSign,
  TrendingUp,
  FileText,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  Printer,
  ChevronRight,
  UserCheck,
  Building,
  ShieldCheck,
  Bell,
  Play,
  Square,
  Award,
  Trash2,
  Edit3
} from 'lucide-react';

export const HRMManagementView: React.FC = () => {
  const { user, userRecord, role, t } = useAuth();
  const pt = t.hrm.payrollManagement;
  const repository = new HRMRepositoryImpl();

  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'employees' | 'attendance' | 'shifts' | 'payroll' | 'leave' | 'performance' | 'documents'>('dashboard');

  // Data States
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [performance, setPerformance] = useState<PerformanceRecord[]>([]);
  const [notifications, setNotifications] = useState<HRNotification[]>([]);
  const [analytics, setAnalytics] = useState<HRMAnalyticsData | null>(null);

  const [loading, setLoading] = useState(true);

  // Modals
  const [selectedEmployeeForProfile, setSelectedEmployeeForProfile] = useState<Employee | null>(null);
  const [selectedEmployeeForEdit, setSelectedEmployeeForEdit] = useState<Employee | null>(null);
  const [showEmployeeFormModal, setShowEmployeeFormModal] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const todayDate = getMogadishuDateString();
  const todayDateObj = new Date(`${todayDate}T00:00:00Z`);
  const mondayDateObj = new Date(todayDateObj.getTime() - ((todayDateObj.getUTCDay() + 6) % 7) * 86400000);
  const mondayDate = mondayDateObj.toISOString().substring(0, 10);
  const [selectedMonth, setSelectedMonth] = useState(todayDate.substring(0, 7));
  const [payrollFrequency, setPayrollFrequency] = useState<PayFrequency>('monthly');
  const [payrollDailyDate, setPayrollDailyDate] = useState(todayDate);
  const [payrollWeeklyStart, setPayrollWeeklyStart] = useState(mondayDate);

  // Clock In/Out state for active user
  const [myAttendanceToday, setMyAttendanceToday] = useState<AttendanceRecord | null>(null);
  const [clockNotes, setClockNotes] = useState('');

  // Shift Form Modal
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [newShiftName, setNewShiftName] = useState('');
  const [newShiftType, setNewShiftType] = useState<any>('custom');
  const [newShiftStart, setNewShiftStart] = useState('09:00');
  const [newShiftEnd, setNewShiftEnd] = useState('17:00');
  const [newShiftDepartment, setNewShiftDepartment] = useState('Operations');

  // Leave Form Modal
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveType, setLeaveType] = useState<any>('Annual Leave');
  const [leaveStartDate, setLeaveStartDate] = useState(getMogadishuDateString());
  const [leaveEndDate, setLeaveEndDate] = useState(getMogadishuDateString());
  const [leaveReason, setLeaveReason] = useState('');

  // Performance Form Modal
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [perfEmpId, setPerfEmpId] = useState('');
  const [perfAttendanceRate, setPerfAttendanceRate] = useState(0);
  const [perfSales, setPerfSales] = useState(0);
  const [perfRating, setPerfRating] = useState(0);
  const [perfProductivity, setPerfProductivity] = useState(0);
  const [perfOrders, setPerfOrders] = useState(0);
  const [perfServiceTime, setPerfServiceTime] = useState(0);

  useEffect(() => {
    loadHRMData();
  }, [selectedMonth]);

  const loadHRMData = async () => {
    setLoading(true);
    try {
      const [
        empList,
        attList,
        shiftList,
        payList,
        leaveList,
        perfList,
        notifList,
        stats
      ] = await Promise.all([
        repository.getAllEmployees(),
        repository.getAttendanceRecords({ month: selectedMonth }),
        repository.getAllShifts(),
        repository.getPayrollRecords({ month: selectedMonth }),
        repository.getLeaveRequests(),
        repository.getPerformanceRecords({ period: selectedMonth }),
        repository.getNotifications(),
        repository.getHRMAnalytics()
      ]);

      setEmployees(empList);
      setAttendance(attList);
      setShifts(shiftList);
      setPayroll(payList);
      setLeaveRequests(leaveList);
      setPerformance(perfList);
      setNotifications(notifList);
      setAnalytics(stats);

      // Check current user attendance for today
      const today = getMogadishuDateString();
      const meEmp = empList.find((e) => e.email === user?.email || e.fullName === userRecord?.displayName) || empList[0];
      if (meEmp) {
        const myTodayAtt = attList.find((a) => a.employeeId === meEmp.id && a.date === today);
        setMyAttendanceToday(myTodayAtt || null);
      }
    } catch (e: any) {
      console.warn('Note loading HRM data:', e?.message || e);
    } finally {
      setLoading(false);
    }
  };

  // Clock In / Clock Out Handlers
  const handleClockIn = async () => {
    const meEmp = employees.find((e) => e.email === user?.email || e.fullName === userRecord?.displayName) || employees[0];
    if (!meEmp) {
      alert('No employee record linked to current user account.');
      return;
    }

    try {
      const att = await repository.clockIn(meEmp.id, meEmp.fullName, clockNotes);
      setMyAttendanceToday(att);
      setClockNotes('');
      loadHRMData();
    } catch (err: any) {
      alert('Clock In Error: ' + err.message);
    }
  };

  const handleClockOut = async () => {
    if (!myAttendanceToday) return;
    try {
      await repository.clockOut(myAttendanceToday.id, clockNotes);
      setMyAttendanceToday(null);
      setClockNotes('');
      loadHRMData();
    } catch (err: any) {
      alert('Clock Out Error: ' + err.message);
    }
  };

  // Generate Payroll Handler
  const handleGeneratePayroll = async () => {
    try {
      const period = payrollFrequency === 'monthly' ? selectedMonth : payrollFrequency === 'weekly' ? payrollWeeklyStart : payrollDailyDate;
      if (payrollFrequency === 'weekly' && new Date(`${period}T00:00:00Z`).getUTCDay() !== 1) {
        throw new Error(pt.invalidWeekly);
      }
      const generated = await repository.generatePayroll(payrollFrequency, period);
      alert(`${payrollFrequency} payroll generated: ${generated.length} record(s).`);
      loadHRMData();
    } catch (err: any) {
      alert('Error generating payroll: ' + err.message);
    }
  };

  // Create Custom Shift Handler
  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShiftName) return;

    try {
      await repository.createShift({
        name: newShiftName,
        type: newShiftType,
        startTime: newShiftStart,
        endTime: newShiftEnd,
        workingHours: 8,
        department: newShiftDepartment,
        assignedEmployeeIds: [],
        status: 'active'
      });
      setShowShiftModal(false);
      setNewShiftName('');
      loadHRMData();
    } catch (err: any) {
      alert('Error creating shift: ' + err.message);
    }
  };

  // Submit Leave Request Handler
  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    const meEmp = employees.find((e) => e.email === user?.email || e.fullName === userRecord?.displayName) || employees[0];
    if (!meEmp) {
      alert('Employee profile required to submit leave.');
      return;
    }

    try {
      await repository.createLeaveRequest({
        employeeId: meEmp.id,
        employeeName: meEmp.fullName,
        department: meEmp.department,
        leaveType,
        startDate: leaveStartDate,
        endDate: leaveEndDate,
        daysCount: 1,
        reason: leaveReason || 'Personal Leave'
      });
      setShowLeaveModal(false);
      setLeaveReason('');
      loadHRMData();
    } catch (err: any) {
      alert('Error submitting leave request: ' + err.message);
    }
  };

  // Leave Approvals
  const handleApproveLeaveManager = async (id: string) => {
    await repository.approveLeaveByManager(id, userRecord?.displayName || 'Manager');
    loadHRMData();
  };

  const handleApproveLeaveHR = async (id: string) => {
    await repository.approveLeaveByHR(id, userRecord?.displayName || 'HR Manager');
    loadHRMData();
  };

  const handleRejectLeave = async (id: string) => {
    await repository.rejectLeaveRequest(id, userRecord?.displayName || 'HR Manager');
    loadHRMData();
  };

  // Upsert Performance Review
  const handleSavePerformance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!perfEmpId) return;
    const emp = employees.find((e) => e.id === perfEmpId);

    try {
      await repository.upsertPerformanceRecord({
        employeeId: perfEmpId,
        employeeName: emp?.fullName || 'Employee',
        jobTitle: emp?.jobTitle,
        department: emp?.department,
        period: selectedMonth,
        attendanceRate: perfAttendanceRate,
        salesPerformance: perfSales,
        customerRatings: perfRating,
        productivity: perfProductivity,
        completedOrders: perfOrders,
        averageServiceTimeMinutes: perfServiceTime,
        evaluatedBy: userRecord?.displayName || 'HR Manager'
      });
      setShowPerformanceModal(false);
      loadHRMData();
    } catch (err: any) {
      alert('Error saving performance review: ' + err.message);
    }
  };

  // Export Payroll Slips to CSV / Excel
  const handleExportPayrollExcel = () => {
    if (payroll.length === 0) {
      alert('No payroll data to export.');
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Payroll Number,Employee Name,Job Title,Department,Month,Basic Salary,Overtime Pay,Bonuses,Deductions,Net Salary,Payment Status\n';

    payroll.forEach((p) => {
      csvContent += `"${p.payrollNumber}","${p.employeeName}","${p.jobTitle || ''}","${p.department || ''}","${p.month}",${p.basicSalary},${p.overtimePay},${p.bonuses},${p.deductions},${p.netSalary},"${p.paymentStatus}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Monthly_Payroll_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Salary Slip PDF/Print Window
  const handlePrintSalarySlip = (pay: PayrollRecord) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Salary Slip - ${pay.employeeName} (${pay.periodStart || pay.month})</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #000; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
            .section { margin-bottom: 20px; }
            .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .table th, .table td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            .total { font-weight: bold; font-size: 16px; color: #059669; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>{t.legacyUi.commercialRestaurantEnterprise}</h2>
            <h3>{translateRawUi('OFFICIAL SALARY SLIP')}</h3>
            <p>${pay.payFrequency ? pay.payFrequency.toUpperCase() : 'MONTHLY'}: ${pay.periodStart || pay.month} | Payroll Ref: ${pay.payrollNumber}</p>
          </div>
          <div class="section">
            <p><strong>{t.legacyUi.employeeNameColon}</strong> ${pay.employeeName}</p>
            <p><strong>{t.legacyUi.jobTitleColon}</strong> ${pay.jobTitle || 'N/A'}</p>
            <p><strong>{translateRawUi('Department:')}</strong> ${pay.department || 'N/A'}</p>
            <p><strong>{translateRawUi('Payment Status:')}</strong> ${(pay.paymentStatus || 'PAID').toUpperCase()}</p>
          </div>
          <table class="table">
            <thead>
              <tr><th>{translateRawUi('Component')}</th><th>{t.legacyUi.amountUsd}</th></tr>
            </thead>
            <tbody>
              <tr><td>{t.legacyUi.basicSalaryCycle}</td><td>$${pay.basicSalary.toLocaleString()}</td></tr>
              <tr><td>{translateRawUi('Overtime Pay')}</td><td>+$${pay.overtimePay.toLocaleString()}</td></tr>
              <tr><td>{translateRawUi('Bonuses')}</td><td>+$${pay.bonuses.toLocaleString()}</td></tr>
              <tr><td>{t.legacyUi.deductionsAdvances}</td><td>-$${pay.deductions + pay.advances}</td></tr>
              <tr class="total"><td>{translateRawUi('Net Salary Payout')}</td><td>$${pay.netSalary.toLocaleString()}</td></tr>
            </tbody>
          </table>
          <br/><br/>
          <p>{t.legacyUi.authorizedSignature}</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Filtered employees
  const filteredEmployees = employees.filter((e) => {
    const q = (searchQuery || '').toLowerCase();
    const matchesSearch =
      (e.fullName || '').toLowerCase().includes(q) ||
      (e.employeeId || '').toLowerCase().includes(q) ||
      (e.jobTitle || '').toLowerCase().includes(q);

    const matchesDept = departmentFilter === 'all' || e.department === departmentFilter;
    const matchesRole = roleFilter === 'all' || e.role === roleFilter;

    return matchesSearch && matchesDept && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner / Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500/10 text-emerald-400 font-extrabold px-3 py-1 rounded-full text-xs border border-emerald-500/20">
              {translateRawUi('PHASE 9 HRM SYSTEM')}
            </span>
            <span className="text-xs text-slate-400">{translateRawUi('• Real-Time Firestore Synced')}</span>
          </div>
          <h1 className="text-xl font-extrabold text-white mt-1">{t.hrm?.title || 'Human Resources & Employee Management'}</h1>
          <p className="text-xs text-slate-400">
            {t.hrm?.subtitle || 'Attendance, Custom Shifts, Daily/Weekly/Monthly Payroll, Leave Workflows & 360° Employee Profiles'}
          </p>
        </div>

        {/* Quick Month Selector & Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white shadow-inner"
          />

          <button
            onClick={() => setShowEmployeeFormModal(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>{t.hrm?.addEmployee || 'Add Employee'}</span>
          </button>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-2 rounded-2xl overflow-x-auto">
        {[
          { id: 'dashboard', label: t.hrm?.dashboard || 'HR Dashboard', icon: Users },
          { id: 'employees', label: `${t.hrm?.directory || 'Directory'} (${employees.length})`, icon: UserCheck },
          { id: 'attendance', label: `${t.hrm?.attendance || 'Attendance'} (${attendance.length})`, icon: Clock },
          { id: 'shifts', label: `${t.hrm?.shifts || 'Shifts'} (${shifts.length})`, icon: Building },
          { id: 'payroll', label: `${t.hrm?.payroll || 'Payroll'} (${payroll.length})`, icon: DollarSign },
          { id: 'leave', label: `${t.hrm?.leave || 'Leaves'} (${leaveRequests.filter(l => l.workflowStatus !== 'Completed').length})`, icon: Calendar },
          { id: 'performance', label: t.hrm?.performance || 'Performance', icon: TrendingUp }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: HR DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 shadow-lg">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{translateRawUi('Total Staff')}</span>
              <p className="text-2xl font-black text-white">{analytics?.totalEmployees || employees.length}</p>
              <span className="text-[10px] text-emerald-400 font-semibold">{analytics?.activeEmployees || 0} Active</span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 shadow-lg">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t.legacyUi.attendanceRate}</span>
              <p className="text-2xl font-black text-emerald-400">{analytics?.todayAttendanceRate ?? 0}%</p>
              <span className="text-[10px] text-slate-400 font-semibold">{translateRawUi('Today\'s Clocked In')}</span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 shadow-lg">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{translateRawUi('Pending Leave Req.')}</span>
              <p className="text-2xl font-black text-amber-400">{analytics?.pendingLeaveRequests || 0}</p>
              <span className="text-[10px] text-slate-400 font-semibold">{translateRawUi('Requires Approval')}</span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 shadow-lg">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{t.legacyUi.activeShifts}</span>
              <p className="text-2xl font-black text-blue-400">{shifts.filter(s => s.status === 'active').length}</p>
              <span className="text-[10px] text-slate-400 font-semibold">{translateRawUi('Roster Active')}</span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 shadow-lg">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{translateRawUi('Monthly Payroll Equivalent')}</span>
              <p className="text-2xl font-black text-emerald-400">${(analytics?.monthlyPayrollTotal || 0).toLocaleString()}</p>
              <span className="text-[10px] text-slate-400 font-semibold">{t.legacyUi.estimatedMonthNetPayout}</span>
            </div>
          </div>

          {/* Quick Clock In/Out Widget for Active User */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{t.legacyUi.employeeLiveClocking}</h3>
                  <p className="text-xs text-slate-400">{t.legacyUi.clockInBreaksFirestore}</p>
                </div>
              </div>

              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                myAttendanceToday && !myAttendanceToday.clockOut
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                STATUS: {myAttendanceToday && !myAttendanceToday.clockOut ? 'CLOCKED IN' : 'CLOCKED OUT'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">{translateRawUi('Optional Notes / Remarks')}</label>
                <input
                  type="text"
                  value={clockNotes}
                  onChange={(e) => setClockNotes(e.target.value)}
                  placeholder={translateRawUi('e.g. On-site morning prep...')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="md:col-span-2 flex items-center gap-3">
                {!myAttendanceToday || myAttendanceToday.clockOut ? (
                  <button
                    onClick={handleClockIn}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20"
                  >
                    <Play className="w-4 h-4 fill-slate-950" />
                    <span>{t.legacyUi.clockInNow}</span>
                  </button>
                ) : (
                  <button
                    onClick={handleClockOut}
                    className="flex-1 bg-rose-500 hover:bg-rose-400 text-slate-950 font-black py-3 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-rose-500/20"
                  >
                    <Square className="w-4 h-4 fill-slate-950" />
                    <span>{t.legacyUi.clockOutNow}</span>
                  </button>
                )}

                <button
                  onClick={() => setShowLeaveModal(true)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3 px-4 rounded-xl text-xs flex items-center gap-2 transition cursor-pointer"
                >
                  <Calendar className="w-4 h-4" />
                  <span>{translateRawUi('Request Leave')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Department Breakdown & Quick Lists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Department Staff Distribution */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Building className="w-4 h-4 text-emerald-400" />
                {translateRawUi('Department Headcount Distribution')}
              </h3>

              <div className="space-y-3 text-xs">
                {analytics?.departmentDistribution &&
                  Object.entries(analytics.departmentDistribution).map(([dept, count]) => (
                    <div key={dept} className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
                      <span className="font-semibold text-white">{dept}</span>
                      <span className="font-extrabold text-emerald-400">{count} staff</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Pending Leave Requests Widget */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-400" />
                  {translateRawUi('Leave Approval Workflow Queue')}
                </h3>
                <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                  {leaveRequests.filter(l => l.workflowStatus !== 'Completed' && l.workflowStatus !== 'Rejected').length} Pending
                </span>
              </div>

              <div className="space-y-3 text-xs max-h-64 overflow-y-auto">
                {leaveRequests.filter(l => l.workflowStatus !== 'Completed').length === 0 ? (
                  <p className="text-slate-400 text-center py-6">{translateRawUi('No pending leave requests requiring action.')}</p>
                ) : (
                  leaveRequests
                    .filter(l => l.workflowStatus !== 'Completed')
                    .map((l) => (
                      <div key={l.id} className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white">{l.employeeName}</span>
                          <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                            {l.workflowStatus}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300">{l.leaveType} ({l.daysCount} days: {l.startDate} - {l.endDate})</p>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          {l.workflowStatus === 'Request' && (
                            <button
                              onClick={() => handleApproveLeaveManager(l.id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10px]"
                            >
                              {translateRawUi('Manager Approve')}
                            </button>
                          )}
                          {l.workflowStatus === 'Manager Approval' && (
                            <button
                              onClick={() => handleApproveLeaveHR(l.id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-[10px]"
                            >
                              {translateRawUi('Final HR Approve')}
                            </button>
                          )}
                          <button
                            onClick={() => handleRejectLeave(l.id)}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white font-bold text-[10px]"
                          >
                            {translateRawUi('Reject')}
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EMPLOYEE DIRECTORY */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
          {/* Controls & Search */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={translateRawUi('Search staff by name, ID, title...')}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white"
              />
            </div>

            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
            >
              <option value="all">{t.legacyUi.allDepartments}</option>
              {Array.from(new Set(employees.map(e => e.department))).map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
            >
              <option value="all">{t.legacyUi.allRoles}</option>
              {Array.from(new Set(employees.map(e => e.role))).map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Directory Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEmployees.map((emp) => (
              <div
                key={emp.id}
                className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 hover:border-emerald-500/40 transition shadow-lg group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 overflow-hidden flex items-center justify-center font-bold text-emerald-400 text-lg">
                      {emp.photo ? (
                        <img src={emp.photo} alt={emp.fullName} className="w-full h-full object-cover" />
                      ) : (
                        emp.fullName.charAt(0)
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition">{emp.fullName}</h3>
                      <span className="text-[10px] font-bold text-slate-400 block">{emp.employeeId} • {emp.jobTitle}</span>
                    </div>
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    emp.employmentStatus === 'Active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {emp.employmentStatus}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                  <div>
                    <span className="text-slate-500 block">{translateRawUi('Department')}</span>
                    <span className="font-semibold text-white">{emp.department}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">{translateRawUi('Salary / Cycle')}</span>
                    <span className="font-bold text-emerald-400">${emp.salary.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">{t.legacyUi.phoneLabel}</span>
                    <span className="font-mono text-slate-200">{emp.phone}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">{t.legacyUi.hireDate}</span>
                    <span className="text-slate-200">{emp.hireDate}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    onClick={() => setSelectedEmployeeForProfile(emp)}
                    className="text-emerald-400 hover:text-emerald-300 font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <span>{translateRawUi('View 360° Profile')}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => {
                      setSelectedEmployeeForEdit(emp);
                      setShowEmployeeFormModal(true);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: ATTENDANCE & LOGS */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">{t.legacyUi.attendanceOvertimeTracker}</h3>
              <p className="text-xs text-slate-400">{t.legacyUi.clockRecordsBreaksDuration}</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900 shadow-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="p-4">{pt.employee}</th>
                  <th className="p-4">{t.legacyUi.dateLabel}</th>
                  <th className="p-4">{t.legacyUi.clockIn}</th>
                  <th className="p-4">{t.legacyUi.clockOut}</th>
                  <th className="p-4">{translateRawUi('Hours')}</th>
                  <th className="p-4">{translateRawUi('Overtime')}</th>
                  <th className="p-4">{pt.status}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {attendance.map((att) => (
                  <tr key={att.id} className="hover:bg-slate-800/30 transition">
                    <td className="p-4 font-bold text-white">{att.employeeName}</td>
                    <td className="p-4 text-slate-300">{att.date}</td>
                    <td className="p-4 font-mono text-emerald-400">
                      {att.clockIn ? new Date(att.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                      {att.isLate && <span className="ml-1.5 text-[9px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-bold">{translateRawUi('LATE')}</span>}
                    </td>
                    <td className="p-4 font-mono text-slate-300">
                      {att.clockOut ? new Date(att.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active'}
                    </td>
                    <td className="p-4 font-bold text-white">{att.workingHours || 0} hrs</td>
                    <td className="p-4 text-emerald-400 font-bold">{att.overtimeHours || 0} hrs</td>
                    <td className="p-4">
                      <span className="capitalize px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                        {att.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: SHIFT MANAGEMENT */}
      {activeTab === 'shifts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">{translateRawUi('Roster & Shift Roster Management')}</h3>
              <p className="text-xs text-slate-400">{translateRawUi('Morning, Evening, Night & Custom shift allocations')}</p>
            </div>
            <button
              onClick={() => setShowShiftModal(true)}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>{t.legacyUi.createCustomShift}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {shifts.map((s) => (
              <div key={s.id} className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h4 className="text-sm font-bold text-white">{s.name}</h4>
                  <span className="uppercase text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                    {s.type}
                  </span>
                </div>

                <div className="text-xs space-y-1 text-slate-300">
                  <p><strong>{translateRawUi('Timing:')}</strong> {s.startTime} - {s.endTime} ({s.workingHours} hrs)</p>
                  <p><strong>{translateRawUi('Department:')}</strong> {s.department || 'Operations'}</p>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-semibold">{s.assignedEmployeeIds?.length || 0} Staff Assigned</span>
                  <button
                    onClick={() => alert(`Assigned staff IDs for ${s.name}: ${s.assignedEmployeeIds.join(', ') || 'None'}`)}
                    className="text-emerald-400 hover:underline font-bold"
                  >
                    {translateRawUi('Manage Roster')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: PAYROLL & SALARY SLIPS */}
      {activeTab === 'payroll' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">{pt.title}</h3>
                <p className="text-xs text-slate-400">{pt.subtitle}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select
                value={payrollFrequency}
                onChange={(e) => setPayrollFrequency(e.target.value as PayFrequency)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="daily">{pt.daily}</option>
                <option value="weekly">{pt.weekly}</option>
                <option value="monthly">{pt.monthly}</option>
              </select>

              {payrollFrequency === 'monthly' ? (
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              ) : payrollFrequency === 'weekly' ? (
                <input
                  type="date"
                  value={payrollWeeklyStart}
                  onChange={(e) => setPayrollWeeklyStart(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              ) : (
                <input
                  type="date"
                  value={payrollDailyDate}
                  onChange={(e) => setPayrollDailyDate(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              )}

              <div className="flex items-center text-[10px] text-slate-400 px-2">
                {payrollFrequency === 'weekly' ? pt.weeklyMondayHint : payrollFrequency === 'daily' ? pt.dailyHint : pt.monthlyHint.replace('{{period}}', selectedMonth)}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleGeneratePayroll}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>{pt.generate}</span>
              </button>

              <button
                onClick={handleExportPayrollExcel}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{pt.export}</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900 shadow-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="p-4">{pt.referenceNumber}</th>
                  <th className="p-4">{pt.employee}</th>
                  <th className="p-4">{pt.salaryPerCycle}</th>
                  <th className="p-4">{pt.overtimePay}</th>
                  <th className="p-4">{pt.netPayout}</th>
                  <th className="p-4">{pt.status}</th>
                  <th className="p-4 text-right">{pt.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {payroll.map((pay) => (
                  <tr key={pay.id} className="hover:bg-slate-800/30 transition">
                    <td className="p-4 font-mono text-emerald-400 font-bold">{pay.payrollNumber}</td>
                    <td className="p-4 font-bold text-white">
                      {pay.employeeName}
                      <span className="block text-[10px] text-slate-400 font-normal">{pay.jobTitle}</span>
                    </td>
                    <td className="p-4">${pay.basicSalary.toLocaleString()}</td>
                    <td className="p-4 text-emerald-400 font-semibold">+${pay.overtimePay.toLocaleString()}</td>
                    <td className="p-4 font-black text-emerald-400 text-sm">${pay.netSalary.toLocaleString()}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        pay.paymentStatus === 'paid' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {(pay.paymentStatus || 'PAID').toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      {pay.paymentStatus !== 'paid' && (
                        <button
                          onClick={async () => {
                            await repository.markPayrollPaid(pay.id, 'Bank Transfer');
                            loadHRMData();
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 font-bold text-[10px]"
                        >
                          {translateRawUi('Mark Paid')}
                        </button>
                      )}
                      <button
                        onClick={() => handlePrintSalarySlip(pay)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 font-bold text-[10px] inline-flex items-center gap-1"
                      >
                        <Printer className="w-3 h-3" />
                        <span>{pt.slip}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: LEAVE MANAGEMENT */}
      {activeTab === 'leave' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">{t.legacyUi.leaveMultiStepApprovals}</h3>
              <p className="text-xs text-slate-400">{translateRawUi('Request -&gt; Manager Approval -&gt; HR Approval -&gt; Completed')}</p>
            </div>
            <button
              onClick={() => setShowLeaveModal(true)}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>{t.legacyUi.submitLeaveRequest}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {leaveRequests.map((l) => (
              <div key={l.id} className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="text-sm font-bold text-white">{l.employeeName} ({l.leaveType})</h4>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    l.workflowStatus === 'Completed'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : l.workflowStatus === 'Rejected'
                      ? 'bg-rose-500/20 text-rose-300'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {l.workflowStatus}
                  </span>
                </div>

                <div className="text-xs space-y-1 text-slate-300">
                  <p><strong>{translateRawUi('Duration:')}</strong> {l.startDate} to {l.endDate} ({l.daysCount} days)</p>
                  <p><strong>{translateRawUi('Reason:')}</strong> "{l.reason}"</p>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-mono text-[10px]">{l.leaveNumber}</span>

                  <div className="flex items-center gap-2">
                    {l.workflowStatus === 'Request' && (
                      <button
                        onClick={() => handleApproveLeaveManager(l.id)}
                        className="px-3 py-1 rounded-xl bg-emerald-500 text-slate-950 font-bold text-[10px]"
                      >
                        {translateRawUi('Manager Approve')}
                      </button>
                    )}
                    {l.workflowStatus === 'Manager Approval' && (
                      <button
                        onClick={() => handleApproveLeaveHR(l.id)}
                        className="px-3 py-1 rounded-xl bg-emerald-500 text-slate-950 font-bold text-[10px]"
                      >
                        {translateRawUi('Final HR Approve')}
                      </button>
                    )}
                    {l.workflowStatus !== 'Completed' && l.workflowStatus !== 'Rejected' && (
                      <button
                        onClick={() => handleRejectLeave(l.id)}
                        className="px-2.5 py-1 rounded-xl bg-rose-500/20 text-rose-300 text-[10px] font-bold"
                      >
                        {translateRawUi('Reject')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: PERFORMANCE DASHBOARD */}
      {activeTab === 'performance' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">{t.legacyUi.employeePerformanceReviews}</h3>
              <p className="text-xs text-slate-400">{t.legacyUi.attendanceSalesRatings}</p>
            </div>

            <button
              onClick={() => setShowPerformanceModal(true)}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              <Award className="w-4 h-4" />
              <span>{t.legacyUi.logPerformanceReview}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {performance.map((p) => (
              <div key={p.id} className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-3 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="text-sm font-bold text-white">{p.employeeName}</h4>
                  <span className="text-xs font-bold text-amber-400">★ {p.customerRatings} / 5</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">{t.legacyUi.attendanceRate}</span>
                    <span className="font-extrabold text-emerald-400">{p.attendanceRate}%</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">{translateRawUi('Productivity')}</span>
                    <span className="font-extrabold text-blue-400">{p.productivity}%</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">{translateRawUi('Sales Contribution')}</span>
                    <span className="font-extrabold text-emerald-400">${p.salesPerformance.toLocaleString()}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">{t.legacyUi.avgServiceTime}</span>
                    <span className="font-extrabold text-white">{p.averageServiceTimeMinutes} mins</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Employee Profile Modal */}
      {selectedEmployeeForProfile && (
        <EmployeeProfileModal
          employee={selectedEmployeeForProfile}
          isOpen={!!selectedEmployeeForProfile}
          onClose={() => setSelectedEmployeeForProfile(null)}
          onUpdate={loadHRMData}
        />
      )}

      {/* Employee Form Modal */}
      {showEmployeeFormModal && (
        <EmployeeFormModal
          employee={selectedEmployeeForEdit}
          isOpen={showEmployeeFormModal}
          onClose={() => {
            setShowEmployeeFormModal(false);
            setSelectedEmployeeForEdit(null);
          }}
          onSuccess={loadHRMData}
        />
      )}

      {/* Shift Form Modal */}
      {showShiftModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateShift} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl text-xs">
            <h3 className="text-base font-bold text-white">{t.legacyUi.createCustomShift}</h3>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">{translateRawUi('Shift Name')}</label>
              <input
                type="text"
                required
                value={newShiftName}
                onChange={(e) => setNewShiftName(e.target.value)}
                placeholder={translateRawUi('e.g. Weekend Rush Shift')}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">{t.legacyUi.startTime}</label>
                <input
                  type="time"
                  value={newShiftStart}
                  onChange={(e) => setNewShiftStart(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="text-slate-300 font-semibold block mb-1">{t.legacyUi.endTime}</label>
                <input
                  type="time"
                  value={newShiftEnd}
                  onChange={(e) => setNewShiftEnd(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">{translateRawUi('Department')}</label>
              <input
                type="text"
                value={newShiftDepartment}
                onChange={(e) => setNewShiftDepartment(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowShiftModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
              >
                {translateRawUi('Cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
              >
                {translateRawUi('Save Shift')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Leave Request Form Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSubmitLeave} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl text-xs">
            <h3 className="text-base font-bold text-white">{t.legacyUi.submitLeaveRequest}</h3>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">{t.legacyUi.leaveType}</label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
              >
                <option value="Annual Leave">{t.legacyUi.annualLeave}</option>
                <option value="Sick Leave">{translateRawUi('Sick Leave')}</option>
                <option value="Emergency Leave">{t.legacyUi.emergencyLeave}</option>
                <option value="Unpaid Leave">{translateRawUi('Unpaid Leave')}</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">{t.legacyUi.startDate}</label>
                <input
                  type="date"
                  value={leaveStartDate}
                  onChange={(e) => setLeaveStartDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="text-slate-300 font-semibold block mb-1">{t.legacyUi.endDate}</label>
                <input
                  type="date"
                  value={leaveEndDate}
                  onChange={(e) => setLeaveEndDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">{translateRawUi('Reason / Justification')}</label>
              <textarea
                required
                rows={3}
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                placeholder={translateRawUi('Provide justification for leave request...')}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
              >
                {translateRawUi('Cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
              >
                {translateRawUi('Submit Request')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Performance Review Modal */}
      {showPerformanceModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleSavePerformance} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl text-xs">
            <h3 className="text-base font-bold text-white">{t.legacyUi.logPerformanceEvaluation}</h3>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">{translateRawUi('Select Employee')}</label>
              <select
                required
                value={perfEmpId}
                onChange={(e) => setPerfEmpId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
              >
                <option value="">{t.legacyUi.chooseEmployee}</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.fullName} ({e.jobTitle})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">{t.legacyUi.attendanceRatePercent}</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={perfAttendanceRate}
                  onChange={(e) => setPerfAttendanceRate(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">{t.legacyUi.customerRatingFive}</label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="5"
                  value={perfRating}
                  onChange={(e) => setPerfRating(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">{translateRawUi('Sales Generated ($)')}</label>
                <input
                  type="number"
                  value={perfSales}
                  onChange={(e) => setPerfSales(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">{translateRawUi('Productivity Score (%)')}</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={perfProductivity}
                  onChange={(e) => setPerfProductivity(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPerformanceModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
              >
                {translateRawUi('Cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
              >
                {translateRawUi('Save Evaluation')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
