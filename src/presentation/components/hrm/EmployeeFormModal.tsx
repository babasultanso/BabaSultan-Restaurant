import React, { useState, useEffect } from 'react';
import { Employee, EmployeeRole, EmploymentStatus, GenderType } from '../../../domain/entities/hrm';
import { HRMRepositoryImpl } from '../../../data/repositories/HRMRepositoryImpl';
import { getMogadishuDateString } from '../../../lib/dateUtils';
import { X, User, Phone, Mail, MapPin, Briefcase, Building, DollarSign, Calendar, ShieldCheck } from 'lucide-react';

interface Props {
  employee?: Employee | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ROLES: EmployeeRole[] = [
  'Owner',
  'Admin',
  'Manager',
  'HR Manager',
  'Accountant',
  'Cashier',
  'Kitchen Staff',
  'Chef',
  'Waiter',
  'Delivery Driver',
  'Store Keeper',
  'Purchasing Officer',
  'Employee'
];

const DEPARTMENTS = [
  'General Management',
  'Operations',
  'Finance & Accounting',
  'Human Resources',
  'Kitchen & Culinary',
  'Service & Dining',
  'Delivery & Logistics',
  'Inventory & Purchasing'
];

export const EmployeeFormModal: React.FC<Props> = ({ employee, isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState<Partial<Employee>>({
    fullName: '',
    photo: '',
    nationalIdOrPassport: '',
    phone: '',
    email: '',
    address: '',
    dateOfBirth: '1995-01-01',
    gender: 'Male',
    nationality: 'Somali',
    hireDate: getMogadishuDateString(),
    jobTitle: 'Staff Member',
    department: 'Operations',
    branch: 'Main Flagship Branch',
    employmentStatus: 'Active',
    role: 'Employee',
    salary: 500,
    bankAccount: {
      bankName: 'IBSA Bank',
      accountNumber: ''
    },
    emergencyContact: {
      name: '',
      relationship: 'Family',
      phone: ''
    },
    notes: ''
  });

  const [loading, setLoading] = useState(false);
  const repository = new HRMRepositoryImpl();

  useEffect(() => {
    if (employee) {
      setFormData({
        fullName: employee.fullName,
        photo: employee.photo || '',
        nationalIdOrPassport: employee.nationalIdOrPassport || '',
        phone: employee.phone || '',
        email: employee.email || '',
        address: employee.address || '',
        dateOfBirth: employee.dateOfBirth || '1995-01-01',
        gender: employee.gender || 'Male',
        nationality: employee.nationality || 'Somali',
        hireDate: employee.hireDate || getMogadishuDateString(),
        jobTitle: employee.jobTitle || 'Staff Member',
        department: employee.department || 'Operations',
        branch: employee.branch || 'Main Flagship Branch',
        employmentStatus: employee.employmentStatus || 'Active',
        role: employee.role || 'Employee',
        salary: employee.salary || 500,
        bankAccount: employee.bankAccount || { bankName: 'IBSA Bank', accountNumber: '' },
        emergencyContact: employee.emergencyContact || { name: '', relationship: 'Family', phone: '' },
        notes: employee.notes || ''
      });
    } else {
      setFormData({
        fullName: '',
        photo: '',
        nationalIdOrPassport: '',
        phone: '',
        email: '',
        address: 'Mogadishu, Somalia',
        dateOfBirth: '1995-01-01',
        gender: 'Male',
        nationality: 'Somali',
        hireDate: getMogadishuDateString(),
        jobTitle: 'Cashier',
        department: 'Operations',
        branch: 'Main Flagship Branch',
        employmentStatus: 'Active',
        role: 'Cashier',
        salary: 600,
        bankAccount: { bankName: 'Premier Bank', accountNumber: '' },
        emergencyContact: { name: '', relationship: 'Parent/Spouse', phone: '' },
        notes: ''
      });
    }
  }, [employee, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.phone) {
      alert('Please fill in Full Name and Phone Number');
      return;
    }

    setLoading(true);
    try {
      if (employee?.id) {
        await repository.updateEmployee(employee.id, formData);
      } else {
        await repository.createEmployee(formData as any);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      alert('Error saving employee record: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {employee ? 'Edit Employee Record' : 'Register New Employee'}
              </h2>
              <p className="text-xs text-slate-400">Complete employee identity, role, compensation & emergency info</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-6 text-xs">
          {/* Section 1: Basic Identity */}
          <div className="space-y-4">
            <h3 className="font-bold text-white uppercase text-[11px] tracking-wider text-emerald-400 border-b border-slate-800 pb-1">
              1. Basic Information & Photo
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="e.g. Abdirahman Hassan Jama"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">National ID / Passport Number</label>
                <input
                  type="text"
                  value={formData.nationalIdOrPassport}
                  onChange={(e) => setFormData({ ...formData, nationalIdOrPassport: e.target.value })}
                  placeholder="e.g. SOM-8899201"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Photo URL (Optional)</label>
                <input
                  type="url"
                  value={formData.photo}
                  onChange={(e) => setFormData({ ...formData, photo: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as GenderType })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Nationality</label>
                  <input
                    type="text"
                    value={formData.nationality}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Contact & Address */}
          <div className="space-y-4">
            <h3 className="font-bold text-white uppercase text-[11px] tracking-wider text-emerald-400 border-b border-slate-800 pb-1">
              2. Contact & Address
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+252 61 500 0000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="employee@restaurant.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Residential Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Mogadishu, Hodan District"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Job Position & Compensation */}
          <div className="space-y-4">
            <h3 className="font-bold text-white uppercase text-[11px] tracking-wider text-emerald-400 border-b border-slate-800 pb-1">
              3. Position, Department & Salary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">System Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as EmployeeRole })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-semibold"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Department</label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Job Title</label>
                <input
                  type="text"
                  value={formData.jobTitle}
                  onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                  placeholder="e.g. Senior Line Chef"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Branch</label>
                <input
                  type="text"
                  value={formData.branch}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Employment Status</label>
                <select
                  value={formData.employmentStatus}
                  onChange={(e) => setFormData({ ...formData, employmentStatus: e.target.value as EmploymentStatus })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                >
                  <option value="Active">Active</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Probation">Probation</option>
                  <option value="Terminated">Terminated</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Monthly Base Salary ($)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.salary}
                  onChange={(e) => setFormData({ ...formData, salary: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-emerald-400 font-bold text-sm"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Bank Account & Emergency */}
          <div className="space-y-4">
            <h3 className="font-bold text-white uppercase text-[11px] tracking-wider text-emerald-400 border-b border-slate-800 pb-1">
              4. Banking & Emergency Contact
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Bank Name</label>
                <input
                  type="text"
                  value={formData.bankAccount?.bankName || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bankAccount: { ...formData.bankAccount!, bankName: e.target.value }
                    })
                  }
                  placeholder="e.g. Premier Bank / Dahabshiil Bank"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Bank Account Number / IBAN</label>
                <input
                  type="text"
                  value={formData.bankAccount?.accountNumber || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bankAccount: { ...formData.bankAccount!, accountNumber: e.target.value }
                    })
                  }
                  placeholder="001-998822-01"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Emergency Contact Person</label>
                <input
                  type="text"
                  value={formData.emergencyContact?.name || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      emergencyContact: { ...formData.emergencyContact!, name: e.target.value }
                    })
                  }
                  placeholder="e.g. Maryam Ali (Spouse)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Emergency Phone Number</label>
                <input
                  type="text"
                  value={formData.emergencyContact?.phone || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      emergencyContact: { ...formData.emergencyContact!, phone: e.target.value }
                    })
                  }
                  placeholder="+252 61 999 8877"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              {loading ? 'Saving...' : employee ? 'Update Employee' : 'Create Employee Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
