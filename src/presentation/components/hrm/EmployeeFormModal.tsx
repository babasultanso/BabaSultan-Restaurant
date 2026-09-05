import { translateRawUi } from '../../../i18n';
import React, { useState, useEffect } from 'react';
import { Employee, EmployeeRole, EmploymentStatus, GenderType, PayFrequency } from '../../../domain/entities/hrm';
import { HRMRepositoryImpl } from '../../../data/repositories/HRMRepositoryImpl';
import { getMogadishuDateString } from '../../../lib/dateUtils';
import { X, User, Phone, Mail, MapPin, Briefcase, Building, DollarSign, Calendar, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

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
  const { t } = useAuth();
  const ft = t.hrm.employeeForm;
  const [formData, setFormData] = useState<Partial<Employee>>({
    fullName: '',
    photo: '',
    nationalIdOrPassport: '',
    phone: '',
    email: '',
    address: '',
    dateOfBirth: '',
    gender: '',
    nationality: '',
    hireDate: getMogadishuDateString(),
    jobTitle: '',
    department: 'Operations',
    branch: '',
    employmentStatus: 'Active',
    role: 'Employee',
    salary: 0,
    payFrequency: 'monthly' as PayFrequency,
    bankAccount: {
      bankName: '',
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
        dateOfBirth: employee.dateOfBirth || '',
        gender: employee.gender || '',
        nationality: employee.nationality || '',
        hireDate: employee.hireDate || getMogadishuDateString(),
        jobTitle: employee.jobTitle || '',
        department: employee.department || 'Operations',
        branch: employee.branch || '',
        employmentStatus: employee.employmentStatus || 'Active',
        role: employee.role || 'Employee',
        salary: Number(employee.salary) || 0,
        payFrequency: employee.payFrequency || 'monthly',
        bankAccount: employee.bankAccount || { bankName: '', accountNumber: '' },
        emergencyContact: employee.emergencyContact || { name: '', relationship: '', phone: '' },
        notes: employee.notes || ''
      });
    } else {
      setFormData({
        fullName: '',
        photo: '',
        nationalIdOrPassport: '',
        phone: '',
        email: '',
        address: '',
        dateOfBirth: '',
        gender: '',
        nationality: '',
        hireDate: getMogadishuDateString(),
        jobTitle: '',
        department: '',
        branch: '',
        employmentStatus: 'Active',
        role: 'Employee',
        salary: 0,
    payFrequency: 'monthly' as PayFrequency,
        bankAccount: { bankName: '', accountNumber: '' },
        emergencyContact: { name: '', relationship: '', phone: '' },
        notes: ''
      });
    }
  }, [employee, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.phone) {
      alert(ft.requiredFields);
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
      alert(ft.saveError + ': ' + err.message);
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
                {employee ? ft.editTitle : ft.createTitle}
              </h2>
              <p className="text-xs text-slate-400">{ft.subtitle}</p>
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
              {ft.sectionBasic}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">{ft.fullName}</label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder={ft.fullNamePlaceholder}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">{ft.nationalId}</label>
                <input
                  type="text"
                  value={formData.nationalIdOrPassport}
                  onChange={(e) => setFormData({ ...formData, nationalIdOrPassport: e.target.value })}
                  placeholder={ft.nationalIdPlaceholder}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">{ft.photoUrl}</label>
                <input
                  type="url"
                  value={formData.photo}
                  onChange={(e) => setFormData({ ...formData, photo: e.target.value })}
                  placeholder={translateRawUi('https://...')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">{ft.gender}</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as GenderType })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                  >
                    <option value="Male">{ft.male}</option>
                    <option value="Female">{ft.female}</option>
                    <option value="Other">{ft.other}</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">{ft.nationality}</label>
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
              {ft.sectionContact}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">{ft.phone}</label>
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder={ft.phonePlaceholder}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">{ft.email}</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder={ft.emailPlaceholder}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">{ft.dateOfBirth}</label>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">{ft.address}</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder={ft.addressPlaceholder}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Job Position & Compensation */}
          <div className="space-y-4">
            <h3 className="font-bold text-white uppercase text-[11px] tracking-wider text-emerald-400 border-b border-slate-800 pb-1">
              {ft.sectionJob}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">{ft.systemRole}</label>
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
                <label className="text-slate-300 font-semibold block mb-1">{ft.department}</label>
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
                <label className="text-slate-300 font-semibold block mb-1">{ft.jobTitle}</label>
                <input
                  type="text"
                  value={formData.jobTitle}
                  onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                  placeholder={ft.jobTitlePlaceholder}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">{ft.branch}</label>
                <input
                  type="text"
                  value={formData.branch}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">{ft.employmentStatus}</label>
                <select
                  value={formData.employmentStatus}
                  onChange={(e) => setFormData({ ...formData, employmentStatus: e.target.value as EmploymentStatus })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                >
                  <option value="Active">{ft.active}</option>
                  <option value="On Leave">{ft.onLeave}</option>
                  <option value="Probation">{ft.probation}</option>
                  <option value="Terminated">{ft.terminated}</option>
                  <option value="Suspended">{ft.suspended}</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">{ft.salary}</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.salary}
                  onChange={(e) => setFormData({ ...formData, salary: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-emerald-400 font-bold text-sm"
                />
              </div>
              <div>
                <label className="text-slate-300 font-semibold block mb-1">{ft.payFrequency}</label>
                <select
                  value={formData.payFrequency || 'monthly'}
                  onChange={(e) => setFormData({ ...formData, payFrequency: e.target.value as PayFrequency })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                >
                  <option value="daily">{ft.daily}</option>
                  <option value="weekly">{ft.weekly}</option>
                  <option value="monthly">{ft.monthly}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 4: Bank Account & Emergency */}
          <div className="space-y-4">
            <h3 className="font-bold text-white uppercase text-[11px] tracking-wider text-emerald-400 border-b border-slate-800 pb-1">
              {ft.sectionBanking}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">{ft.bankName}</label>
                <input
                  type="text"
                  value={formData.bankAccount?.bankName || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bankAccount: { ...formData.bankAccount!, bankName: e.target.value }
                    })
                  }
                  placeholder={ft.bankPlaceholder}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">{ft.bankAccount}</label>
                <input
                  type="text"
                  value={formData.bankAccount?.accountNumber || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bankAccount: { ...formData.bankAccount!, accountNumber: e.target.value }
                    })
                  }
                  placeholder={ft.bankAccount}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">{ft.emergencyName}</label>
                <input
                  type="text"
                  value={formData.emergencyContact?.name || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      emergencyContact: { ...formData.emergencyContact!, name: e.target.value }
                    })
                  }
                  placeholder={ft.emergencyNamePlaceholder}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">{ft.emergencyPhone}</label>
                <input
                  type="text"
                  value={formData.emergencyContact?.phone || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      emergencyContact: { ...formData.emergencyContact!, phone: e.target.value }
                    })
                  }
                  placeholder={ft.phonePlaceholder}
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
              {translateRawUi('Cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              {loading ? ft.saving : employee ? ft.updateEmployee : ft.createEmployee}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
