import React, { useState, useEffect } from 'react';
import {
  Employee,
  AttendanceRecord,
  PayrollRecord,
  LeaveRequest,
  PerformanceRecord,
  EmployeeDocument
} from '../../../domain/entities/hrm';
import { HRMRepositoryImpl } from '../../../data/repositories/HRMRepositoryImpl';
import {
  X,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Briefcase,
  Building,
  DollarSign,
  FileText,
  Clock,
  Award,
  TrendingUp,
  ShieldAlert,
  CreditCard,
  Heart,
  Plus,
  Trash2,
  Upload,
  CheckCircle2,
  Download
} from 'lucide-react';

interface Props {
  employee: Employee;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export const EmployeeProfileModal: React.FC<Props> = ({ employee, isOpen, onClose, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'attendance' | 'payroll' | 'performance' | 'leave'>('overview');
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [performance, setPerformance] = useState<PerformanceRecord[]>([]);

  // Doc upload form state
  const [showDocModal, setShowDocModal] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState<any>('Employment Contract');
  const [docUrl, setDocUrl] = useState('');
  const [docIssueDate, setDocIssueDate] = useState('');
  const [docExpiryDate, setDocExpiryDate] = useState('');

  const repository = new HRMRepositoryImpl();

  useEffect(() => {
    if (isOpen && employee?.id) {
      loadEmployeeData();
    }
  }, [isOpen, employee?.id]);

  const loadEmployeeData = async () => {
    try {
      const [docsData, attData, payData, leaveData, perfData] = await Promise.all([
        repository.getEmployeeDocuments(employee.id),
        repository.getAttendanceRecords({ employeeId: employee.id }),
        repository.getPayrollRecords({ employeeId: employee.id }),
        repository.getLeaveRequests({ employeeId: employee.id }),
        repository.getPerformanceRecords({ employeeId: employee.id })
      ]);

      setDocuments(docsData);
      setAttendance(attData);
      setPayroll(payData);
      setLeaveRequests(leaveData);
      setPerformance(perfData);
    } catch (e) {
      console.error('Error loading employee profile details:', e);
    }
  };

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle) return;

    try {
      await repository.addEmployeeDocument({
        employeeId: employee.id,
        employeeName: employee.fullName,
        title: docTitle,
        documentType: docType,
        fileUrl: docUrl || 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=500',
        fileName: `${docTitle.toLowerCase().replace(/\s+/g, '_')}.pdf`,
        issueDate: docIssueDate,
        expiryDate: docExpiryDate
      });

      setShowDocModal(false);
      setDocTitle('');
      setDocUrl('');
      loadEmployeeData();
    } catch (err: any) {
      alert('Error adding document: ' + err.message);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (confirm('Are you sure you want to delete this document?')) {
      await repository.deleteEmployeeDocument(id);
      loadEmployeeData();
    }
  };

  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header Banner */}
        <div className="p-6 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 overflow-hidden flex items-center justify-center text-emerald-400 font-extrabold text-2xl">
              {employee.photo ? (
                <img src={employee.photo} alt={employee.fullName} className="w-full h-full object-cover" />
              ) : (
                employee.fullName.charAt(0)
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">{employee.fullName}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {employee.employeeId}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  employee.employmentStatus === 'Active'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {employee.employmentStatus}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{employee.jobTitle} • {employee.department} • {employee.branch}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-800 px-6 bg-slate-950/40 overflow-x-auto">
          {[
            { id: 'overview', label: '360° Overview', icon: User },
            { id: 'documents', label: `Documents (${documents.length})`, icon: FileText },
            { id: 'attendance', label: `Attendance (${attendance.length})`, icon: Clock },
            { id: 'payroll', label: `Payroll (${payroll.length})`, icon: DollarSign },
            { id: 'leave', label: `Leaves (${leaveRequests.length})`, icon: Calendar },
            { id: 'performance', label: 'Performance', icon: TrendingUp }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'border-emerald-400 text-emerald-400 bg-emerald-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              {/* Personal Details */}
              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
                  <User className="w-4 h-4 text-emerald-400" />
                  Personal & Identifiers
                </h3>
                <div className="grid grid-cols-2 gap-3 text-slate-300">
                  <div>
                    <span className="text-slate-500 block">National ID / Passport</span>
                    <span className="font-semibold text-white">{employee.nationalIdOrPassport || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Gender</span>
                    <span className="font-semibold text-white">{employee.gender}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Date of Birth</span>
                    <span className="font-semibold text-white">{employee.dateOfBirth}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Nationality</span>
                    <span className="font-semibold text-white">{employee.nationality}</span>
                  </div>
                </div>
              </div>

              {/* Employment & Role */}
              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
                  <Briefcase className="w-4 h-4 text-emerald-400" />
                  Job Position & Compensation
                </h3>
                <div className="grid grid-cols-2 gap-3 text-slate-300">
                  <div>
                    <span className="text-slate-500 block">Job Title</span>
                    <span className="font-semibold text-white">{employee.jobTitle}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Role</span>
                    <span className="font-semibold text-white">{employee.role}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Department</span>
                    <span className="font-semibold text-white">{employee.department}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Branch</span>
                    <span className="font-semibold text-white">{employee.branch}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Hire Date</span>
                    <span className="font-semibold text-white">{employee.hireDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Monthly Base Salary</span>
                    <span className="font-bold text-emerald-400 text-sm">${employee.salary.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
                  <Phone className="w-4 h-4 text-emerald-400" />
                  Contact & Address
                </h3>
                <div className="space-y-2 text-slate-300">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span>{employee.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span>{employee.email || 'No email registered'}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 mt-0.5" />
                    <span>{employee.address || 'Mogadishu, Somalia'}</span>
                  </div>
                </div>
              </div>

              {/* Emergency Contact & Bank Details */}
              <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
                  <Heart className="w-4 h-4 text-emerald-400" />
                  Emergency Contact & Banking
                </h3>
                <div className="space-y-2 text-slate-300">
                  <div>
                    <span className="text-slate-500 block">Emergency Contact Name</span>
                    <span className="font-semibold text-white">{employee.emergencyContact?.name || 'N/A'} ({employee.emergencyContact?.relationship || 'Family'})</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Emergency Phone</span>
                    <span className="font-semibold text-white">{employee.emergencyContact?.phone || 'N/A'}</span>
                  </div>
                  {employee.bankAccount && (
                    <div className="pt-2 border-t border-slate-800/60">
                      <span className="text-slate-500 block">Bank Account ({employee.bankAccount.bankName})</span>
                      <span className="font-mono text-emerald-400">{employee.bankAccount.accountNumber}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DOCUMENTS */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Employee Documents & Storage</h3>
                  <p className="text-xs text-slate-400">Contracts, National IDs, Passports, Licenses & Certificates</p>
                </div>
                <button
                  onClick={() => setShowDocModal(true)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Upload Document</span>
                </button>
              </div>

              {documents.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 border border-slate-800/80 rounded-2xl text-slate-400 text-xs">
                  No stored documents for this employee. Click "Upload Document" to attach contracts, passport, or ID.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {documents.map((doc) => (
                    <div key={doc.id} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-white">{doc.title}</h4>
                          <span className="text-[10px] text-emerald-400 font-semibold">{doc.documentType}</span>
                          <div className="text-[10px] text-slate-400 mt-1">
                            Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}
                            {doc.expiryDate && ` • Expires: ${doc.expiryDate}`}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ATTENDANCE */}
          {activeTab === 'attendance' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Attendance & Clock Logs</h3>
                  <p className="text-xs text-slate-400">Clock in/out history, working hours & overtime</p>
                </div>
              </div>

              {attendance.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 border border-slate-800/80 rounded-2xl text-slate-400 text-xs">
                  No attendance records logged for this employee.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-800">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Clock In</th>
                        <th className="p-3">Clock Out</th>
                        <th className="p-3">Hours</th>
                        <th className="p-3">Overtime</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
                      {attendance.map((att) => (
                        <tr key={att.id} className="hover:bg-slate-800/40 transition">
                          <td className="p-3 font-semibold text-white">{att.date}</td>
                          <td className="p-3">
                            {att.clockIn ? new Date(att.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                            {att.isLate && <span className="ml-1.5 text-[9px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded">Late</span>}
                          </td>
                          <td className="p-3">
                            {att.clockOut ? new Date(att.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active'}
                          </td>
                          <td className="p-3 font-bold text-white">{att.workingHours || 0} hrs</td>
                          <td className="p-3 text-emerald-400 font-semibold">{att.overtimeHours || 0} hrs</td>
                          <td className="p-3">
                            <span className="capitalize px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                              {att.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PAYROLL */}
          {activeTab === 'payroll' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Payroll & Salary Slips</h3>
                  <p className="text-xs text-slate-400">Monthly payout receipts and salary calculations</p>
                </div>
              </div>

              {payroll.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 border border-slate-800/80 rounded-2xl text-slate-400 text-xs">
                  No payroll slips recorded.
                </div>
              ) : (
                <div className="space-y-3">
                  {payroll.map((pay) => (
                    <div key={pay.id} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">{pay.month} Payroll Slip</h4>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            pay.paymentStatus === 'paid' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {(pay.paymentStatus || 'paid').toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Base: ${pay.basicSalary} • Overtime: +${pay.overtimePay} • Deductions: -${pay.deductions}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">Net Salary Payout</span>
                        <span className="text-lg font-black text-emerald-400">${pay.netSalary.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: LEAVES */}
          {activeTab === 'leave' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white">Leave Requests & Approvals</h3>

              {leaveRequests.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 border border-slate-800/80 rounded-2xl text-slate-400 text-xs">
                  No leave requests submitted for this employee.
                </div>
              ) : (
                <div className="space-y-3">
                  {leaveRequests.map((l) => (
                    <div key={l.id} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{l.leaveType} ({l.daysCount} days)</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          l.workflowStatus === 'Completed' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {l.workflowStatus}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">{l.startDate} to {l.endDate}</p>
                      <p className="text-xs text-slate-400 italic">"{l.reason}"</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: PERFORMANCE */}
          {activeTab === 'performance' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white">Performance Metrics</h3>

              {performance.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 border border-slate-800/80 rounded-2xl text-slate-400 text-xs">
                  No performance evaluation records logged for this employee.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {performance.map((perf) => (
                    <div key={perf.id} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-xs font-bold text-white">Period: {perf.period}</span>
                        <span className="text-[10px] text-emerald-400 font-bold">Evaluated by {perf.evaluatedBy}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-slate-500 block">Attendance Rate</span>
                          <span className="font-bold text-emerald-400">{perf.attendanceRate}%</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Customer Rating</span>
                          <span className="font-bold text-amber-400">★ {perf.customerRatings} / 5</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Productivity Score</span>
                          <span className="font-bold text-blue-400">{perf.productivity}%</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Completed Orders</span>
                          <span className="font-bold text-white">{perf.completedOrders}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Upload Document Modal */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleAddDocument} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Upload Employee Document</h3>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Document Title</label>
              <input
                type="text"
                required
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="e.g. Signed Employment Contract 2026"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Document Type</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="Employment Contract">Employment Contract</option>
                <option value="National ID">National ID</option>
                <option value="Passport">Passport</option>
                <option value="Driving License">Driving License</option>
                <option value="Certificates">Certificates</option>
                <option value="Other Documents">Other Documents</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Document File URL</label>
              <input
                type="url"
                value={docUrl}
                onChange={(e) => setDocUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Issue Date</label>
                <input
                  type="date"
                  value={docIssueDate}
                  onChange={(e) => setDocIssueDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={docExpiryDate}
                  onChange={(e) => setDocExpiryDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDocModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold"
              >
                Save Document
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
