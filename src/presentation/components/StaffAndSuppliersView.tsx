import React, { useState, useEffect } from 'react';
import { Employee, Supplier, Salary } from '../../types';
import { StaffRepositoryImpl } from '../../data/repositories/StaffRepositoryImpl';
import {
  Users,
  Truck,
  PlusCircle,
  X,
  DollarSign,
  Briefcase,
  CheckCircle2,
  Mail,
  Phone,
  ShieldAlert,
  Search,
  Building2
} from 'lucide-react';

interface StaffAndSuppliersViewProps {
  employees: Employee[];
  suppliers: Supplier[];
  salaries: Salary[];
  onRefresh?: () => void;
}

const staffRepo = new StaffRepositoryImpl();

export const StaffAndSuppliersView: React.FC<StaffAndSuppliersViewProps> = ({
  employees: propEmployees,
  suppliers: propSuppliers,
  salaries: propSalaries,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'employees' | 'suppliers' | 'payroll'>('employees');

  // Separate State Hooks for Each Resource
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [salariesList, setSalariesList] = useState<Salary[]>([]);

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Modals
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState<boolean>(false);
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState<boolean>(false);
  const [paySalaryEmp, setPaySalaryEmp] = useState<Employee | null>(null);

  // Forms
  const [empName, setEmpName] = useState<string>('');
  const [empEmail, setEmpEmail] = useState<string>('');
  const [empRole, setEmpRole] = useState<string>('cashier');
  const [empSalary, setEmpSalary] = useState<number>(2500);

  const [supName, setSupName] = useState<string>('');
  const [supContact, setSupContact] = useState<string>('');
  const [supPhone, setSupPhone] = useState<string>('');
  const [supItems, setSupItems] = useState<string>('Meat & Meat Products');
  const [supPending, setSupPending] = useState<number>(0);

  const [payPeriod, setPayPeriod] = useState<string>('Current Month');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Load Data for Employees, Suppliers, and Payroll
  const loadData = async () => {
    try {
      const emps = await staffRepo.fetchEmployees();
      setEmployeesList(emps.length > 0 ? emps : (propEmployees || []));
    } catch {
      setEmployeesList(propEmployees || []);
    }

    try {
      const sups = await staffRepo.fetchSuppliers();
      setSuppliersList(sups.length > 0 ? sups : (propSuppliers || []));
    } catch {
      setSuppliersList(propSuppliers || []);
    }

    try {
      const sals = await staffRepo.fetchSalaries();
      setSalariesList(sals.length > 0 ? sals : (propSalaries || []));
    } catch {
      setSalariesList(propSalaries || []);
    }
  };

  useEffect(() => {
    loadData();
  }, [propEmployees, propSuppliers, propSalaries]);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await staffRepo.createEmployee({
        name: empName,
        email: empEmail,
        role: empRole,
        salary: empSalary
      });
      setIsAddEmployeeOpen(false);
      setEmpName('');
      setEmpEmail('');
      await loadData();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(`Error creating staff member: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await staffRepo.createSupplier({
        name: supName,
        contactPerson: supContact,
        phone: supPhone,
        itemsSupplied: supItems,
        pendingAmount: supPending
      });
      setIsAddSupplierOpen(false);
      setSupName('');
      setSupContact('');
      await loadData();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(`Error creating supplier: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProcessPayroll = async () => {
    if (!paySalaryEmp) return;
    setIsSubmitting(true);
    try {
      await staffRepo.processSalaryPayment({
        employeeId: paySalaryEmp.id,
        employeeName: paySalaryEmp.name || paySalaryEmp.fullName || 'Employee',
        amount: paySalaryEmp.salary || 500,
        period: payPeriod
      });
      setPaySalaryEmp(null);
      await loadData();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(`Error processing payroll: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered lists
  const filteredEmployees = employeesList.filter(emp => {
    const nameStr = (emp.fullName || emp.name || '').toLowerCase();
    const emailStr = (emp.email || '').toLowerCase();
    const roleStr = (emp.role || emp.jobTitle || '').toLowerCase();
    const sq = (searchQuery || '').toLowerCase();
    const matchesSearch = !searchQuery || nameStr.includes(sq) || emailStr.includes(sq);
    const matchesRole = roleFilter === 'all' || roleStr.includes((roleFilter || '').toLowerCase());
    return matchesSearch && matchesRole;
  });

  const filteredSuppliers = suppliersList.filter(s => {
    const nameStr = (s.name || s.companyName || '').toLowerCase();
    const contactStr = (s.contactPerson || '').toLowerCase();
    const itemsStr = (s.itemsSupplied || '').toLowerCase();
    const sq = (searchQuery || '').toLowerCase();
    return !searchQuery || nameStr.includes(sq) || contactStr.includes(sq) || itemsStr.includes(sq);
  });

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-400" />
            Human Resources, Payroll & Vendor Management
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Restaurant staff roster, monthly payroll processing & supplier directory
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddEmployeeOpen(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3.5 py-2 rounded-2xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            Hire Staff Member
          </button>
          <button
            onClick={() => setIsAddSupplierOpen(true)}
            className="bg-teal-600 hover:bg-teal-500 text-white font-bold px-3.5 py-2 rounded-2xl text-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Add Supplier
          </button>
        </div>
      </div>

      {/* Controls & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-800 text-xs w-fit">
          <button
            onClick={() => setActiveTab('employees')}
            className={`px-4 py-2 rounded-xl transition font-bold cursor-pointer ${
              activeTab === 'employees' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Staff Roster ({employeesList.length})
          </button>
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`px-4 py-2 rounded-xl transition font-bold cursor-pointer ${
              activeTab === 'suppliers' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Suppliers Directory ({suppliersList.length})
          </button>
          <button
            onClick={() => setActiveTab('payroll')}
            className={`px-4 py-2 rounded-xl transition font-bold cursor-pointer ${
              activeTab === 'payroll' ? 'bg-emerald-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Payroll History ({salariesList.length})
          </button>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={activeTab === 'employees' ? 'Search employees...' : 'Search suppliers...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-2xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 w-48 sm:w-64"
            />
          </div>
          {activeTab === 'employees' && (
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-2xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Roles</option>
              <option value="cashier">Cashier</option>
              <option value="chef">Chef</option>
              <option value="manager">Manager</option>
              <option value="driver">Driver</option>
            </select>
          )}
        </div>
      </div>

      {/* Staff Roster Tab */}
      {activeTab === 'employees' && (
        <>
          {filteredEmployees.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-slate-400 text-xs">
              No employee records found matching criteria.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEmployees.map(emp => {
                const displayName = emp.fullName || emp.name || 'Unnamed Employee';
                const displayRole = emp.role || emp.jobTitle || 'Staff';
                const displaySalary = Number(emp.salary) || 500;
                return (
                  <div key={emp.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-base font-bold text-white">{displayName}</h4>
                          <span className="text-[10px] uppercase font-extrabold tracking-wider bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            {displayRole}
                          </span>
                        </div>
                        <span className="text-sm font-extrabold text-white">${displaySalary}/mo</span>
                      </div>

                      <div className="mt-4 space-y-1 text-xs text-slate-400">
                        <p className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-500" /> {emp.email || 'staff@restaurant-erp.internal'}</p>
                        {emp.phone && <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-500" /> {emp.phone}</p>}
                        {emp.branch && <p className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-slate-500" /> {emp.branch}</p>}
                      </div>
                    </div>

                    <button
                      onClick={() => setPaySalaryEmp(emp)}
                      className="w-full bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 font-bold py-2 rounded-xl transition text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <DollarSign className="w-4 h-4" />
                      Disburse Monthly Salary
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Suppliers Tab */}
      {activeTab === 'suppliers' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          {filteredSuppliers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No supplier records found matching criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-4 px-6">Vendor / Supplier Name</th>
                    <th className="py-4 px-6">Contact Person</th>
                    <th className="py-4 px-6">Phone Number</th>
                    <th className="py-4 px-6">Goods Supplied</th>
                    <th className="py-4 px-6 text-right">Pending Payables</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {filteredSuppliers.map(s => {
                    const sName = s.name || s.companyName || 'Unnamed Supplier';
                    return (
                      <tr key={s.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-4 px-6 font-bold text-white">{sName}</td>
                        <td className="py-4 px-6 text-slate-300">{s.contactPerson || 'N/A'}</td>
                        <td className="py-4 px-6 font-mono text-slate-400">{s.phone || 'N/A'}</td>
                        <td className="py-4 px-6 text-slate-400">{s.itemsSupplied || 'General Supplies'}</td>
                        <td className="py-4 px-6 text-right font-extrabold text-amber-400">
                          ${(Number(s.pendingAmount) || 0).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Payroll History Tab */}
      {activeTab === 'payroll' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          {salariesList.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No payroll records recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-4 px-6">Employee Name</th>
                    <th className="py-4 px-6">Disbursed Amount</th>
                    <th className="py-4 px-6">Pay Period</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6 text-right">Payment Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {salariesList.map(sal => (
                    <tr key={sal.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-4 px-6 font-bold text-white">{sal.employeeName}</td>
                      <td className="py-4 px-6 font-extrabold text-emerald-400">${(Number(sal.amount) || 0).toFixed(2)}</td>
                      <td className="py-4 px-6 text-slate-400">{sal.period}</td>
                      <td className="py-4 px-6">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold uppercase text-[10px]">
                          {sal.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right text-slate-500">
                        {sal.paidDate ? new Date(sal.paidDate).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Hire Staff Modal */}
      {isAddEmployeeOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateEmployee} className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative text-xs">
            <button type="button" onClick={() => setIsAddEmployeeOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-white">Hire Staff Member</h3>

            <div className="space-y-3">
              <div>
                <label className="text-slate-400 font-bold block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan"
                  value={empName}
                  onChange={e => setEmpName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="alex@restaurant.com"
                  value={empEmail}
                  onChange={e => setEmpEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Role / Position</label>
                  <select
                    value={empRole}
                    onChange={e => setEmpRole(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="cashier">Cashier (POS)</option>
                    <option value="chef">Chef / Kitchen</option>
                    <option value="manager">Branch Manager</option>
                    <option value="driver">Delivery Driver</option>
                    <option value="accountant">Accountant</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Monthly Salary ($)</label>
                  <input
                    type="number"
                    value={empSalary}
                    onChange={e => setEmpSalary(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-3 rounded-xl transition cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : 'Add Employee to Roster'}
            </button>
          </form>
        </div>
      )}

      {/* Add Supplier Modal */}
      {isAddSupplierOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateSupplier} className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative text-xs">
            <button type="button" onClick={() => setIsAddSupplierOpen(false)} className="absolute right-4 top-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-white">Add Supplier / Vendor</h3>

            <div className="space-y-3">
              <div>
                <label className="text-slate-400 font-bold block mb-1">Company / Vendor Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mogadishu Meat Supplies"
                  value={supName}
                  onChange={e => setSupName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Contact Person</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Hassan Farah"
                    value={supContact}
                    onChange={e => setSupContact(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-bold block mb-1">Phone Number</label>
                  <input
                    type="text"
                    required
                    placeholder="+252 61 000 0000"
                    value={supPhone}
                    onChange={e => setSupPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Goods / Items Supplied</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Meat & Meat Products"
                  value={supItems}
                  onChange={e => setSupItems(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1">Pending Balance / Payable ($)</label>
                <input
                  type="number"
                  value={supPending}
                  onChange={e => setSupPending(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-teal-600 hover:bg-teal-500 text-white font-extrabold py-3 rounded-xl transition cursor-pointer"
            >
              {isSubmitting ? 'Saving...' : 'Add Vendor to Directory'}
            </button>
          </form>
        </div>
      )}

      {/* Disburse Salary Modal */}
      {paySalaryEmp && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative text-xs">
            <button onClick={() => setPaySalaryEmp(null)} className="absolute right-4 top-4 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-white">Process Payroll Disbursal</h3>
            <p className="text-slate-400">{paySalaryEmp.fullName || paySalaryEmp.name} ({paySalaryEmp.role || paySalaryEmp.jobTitle})</p>

            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Monthly Base Salary</span>
              <div className="text-2xl font-extrabold text-emerald-400">${(paySalaryEmp.salary || 500).toFixed(2)}</div>
            </div>

            <button
              disabled={isSubmitting}
              onClick={handleProcessPayroll}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-3 rounded-xl transition cursor-pointer"
            >
              {isSubmitting ? 'Processing Payout...' : 'Confirm Disbursal & Log Expense'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
