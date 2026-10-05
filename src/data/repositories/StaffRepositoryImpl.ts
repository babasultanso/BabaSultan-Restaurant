import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db, COLLECTIONS, addSalaryFirestore, getEffectiveBranchId, getEffectiveBranchScope } from '../../lib/firebase';
import { getMogadishuDateString } from '../../lib/dateUtils';
import { IStaffRepository } from '../../domain/repositories/IStaffRepository';
import { NewEmployeePayload, NewSupplierPayload, SalaryPaymentPayload } from '../../domain/entities/staff';
import { Employee, Supplier, Salary } from '../../types';

export class StaffRepositoryImpl implements IStaffRepository {
  async fetchEmployees(branchId?: string): Promise<Employee[]> {
    try {
      const effectiveBranch = branchId && branchId !== 'all' ? branchId : getEffectiveBranchScope();
      const q = effectiveBranch === 'all'
        ? collection(db, COLLECTIONS.EMPLOYEES)
        : query(collection(db, COLLECTIONS.EMPLOYEES), where('branchId', '==', effectiveBranch));
      const snap = await getDocs(q);
      const list: Employee[] = [];
      let isPrivilegedViewer = true;
      let viewerUid = '';
      let viewerEmpId = '';
      let viewerEmail = '';
      if (typeof localStorage !== 'undefined') {
        try {
          const stored = localStorage.getItem('user_profile');
          if (stored) {
            const u = JSON.parse(stored);
            const role = String(u?.role || '').trim().toLowerCase();
            isPrivilegedViewer = ['owner', 'admin', 'manager', 'accountant'].includes(role) || u?.isOwner === true || u?.isAdmin === true;
            viewerUid = String(u?.id || u?.uid || '').trim();
            viewerEmpId = String(u?.employeeId || '').trim();
            viewerEmail = String(u?.email || '').trim().toLowerCase();
          }
        } catch {}
      }
      snap.forEach(d => {
        const data = d.data();
        if (data.isDeleted || data.isArchived || data.status === 'deleted') return;
        const empName = data.fullName || data.name || 'Unnamed Employee';
        const empRole = data.role || data.jobTitle || (data as any).position || 'Staff';
        const canViewSensitive = isPrivilegedViewer ||
          (viewerUid !== '' && (d.id === viewerUid || data.userId === viewerUid || data.uid === viewerUid)) ||
          (viewerEmpId !== '' && d.id === viewerEmpId) ||
          (viewerEmail !== '' && String(data.email || '').trim().toLowerCase() === viewerEmail);
        const normalizedFreq = ['daily', 'weekly', 'monthly'].includes(String(data.payFrequency || '').toLowerCase())
          ? String(data.payFrequency).toLowerCase()
          : 'monthly';
        list.push({
          ...data,
          id: d.id,
          employeeId: data.employeeId || d.id,
          fullName: empName,
          name: empName,
          email: data.email || '',
          phone: data.phone || '',
          role: empRole as any,
          jobTitle: empRole,
          position: empRole,
          salary: canViewSensitive ? (Number(data.salary) || 0) : 0,
          payFrequency: normalizedFreq,
          status: data.status || 'active',
          employmentStatus: data.employmentStatus || 'Active',
          department: data.department || 'Operations',
          branch: data.branch || data.branchId || '',
          branchId: data.branchId || data.branch || '',
          nationalIdOrPassport: canViewSensitive ? (data.nationalIdOrPassport || data.nationalId || '') : '',
          bankAccount: canViewSensitive ? data.bankAccount : undefined,
          address: data.address || '',
          dateOfBirth: data.dateOfBirth || '',
          gender: data.gender || '',
          nationality: data.nationality || '',
          hireDate: data.hireDate || getMogadishuDateString(),
          emergencyContact: data.emergencyContact || { name: '', relationship: '', phone: '' },
          createdAt: data.createdAt || new Date().toISOString()
        } as Employee);
      });
      return list;
    } catch (err) {
      console.error('Error fetching employees from Firestore:', err);
      throw err;
    }
  }

  async fetchSuppliers(): Promise<Supplier[]> {
    try {
      const branchId = getEffectiveBranchScope();
      const suppliersQuery = branchId === 'all'
        ? collection(db, COLLECTIONS.SUPPLIERS)
        : query(collection(db, COLLECTIONS.SUPPLIERS), where('branchId', '==', branchId));
      const snap = await getDocs(suppliersQuery);
      const list: Supplier[] = [];
      snap.forEach(d => {
        const data = d.data();
        if (data.isDeleted || data.isArchived || data.isActive === false || data.status === 'deleted') return;
        const sName = data.name || data.companyName || 'Unnamed Supplier';
        list.push({
          id: d.id,
          name: sName,
          companyName: sName,
          contactPerson: data.contactPerson || data.contactName || data.name || 'N/A',
          phone: data.phone || '',
          itemsSupplied: data.itemsSupplied || data.category || (Array.isArray(data.productsSupplied) ? data.productsSupplied.join(', ') : 'General Supplies'),
          pendingAmount: Number(data.pendingAmount ?? data.outstandingBalance ?? 0),
          overdueAmount: Number(data.overdueAmount ?? 0),
          ...data
        } as Supplier);
      });
      return list;
    } catch (err) {
      console.error('Error fetching suppliers from Firestore:', err);
      throw err;
    }
  }

  async fetchSalaries(branchId?: string): Promise<Salary[]> {
    try {
      const effectiveBranch = branchId || getEffectiveBranchScope();
      const q = effectiveBranch === 'all'
        ? collection(db, COLLECTIONS.SALARIES)
        : query(collection(db, COLLECTIONS.SALARIES), where('branchId', '==', effectiveBranch));
      const snap = await getDocs(q);
      const list: Salary[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Salary));
      return list;
    } catch (err) {
      console.error('Error fetching salaries from Firestore:', err);
      throw err;
    }
  }

  async createEmployee(payload: NewEmployeePayload): Promise<Employee> {
    const now = new Date().toISOString();
    const entropy = `${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 4)}`.toUpperCase();
    const data = {
      fullName: payload.name,
      name: payload.name,
      employeeId: `EMP-${entropy}`,
      email: payload.email || '',
      phone: '',
      address: '',
      nationalIdOrPassport: '',
      dateOfBirth: '',
      gender: '' as const,
      nationality: '',
      hireDate: now.split('T')[0],
      jobTitle: payload.role || 'Staff',
      position: payload.role || 'Staff',
      department: 'Operations',
      branch: getEffectiveBranchId(),
      branchId: getEffectiveBranchId(),
      employmentStatus: 'Active' as const,
      status: 'active',
      role: (payload.role as any) || 'Employee',
      salary: Number(payload.salary) || 0,
      baseSalary: Number(payload.salary) || 0,
      payFrequency: payload.payFrequency || 'monthly',
      totalSales: 0,
      ordersCount: 0,
      emergencyContact: { name: '', relationship: '', phone: '' },
      createdAt: now,
      updatedAt: now,
      isDeleted: false
    };
    const docRef = await addDoc(collection(db, COLLECTIONS.EMPLOYEES), data);
    return { id: docRef.id, ...data };
  }

  async createSupplier(payload: NewSupplierPayload): Promise<Supplier> {
    const branchId = getEffectiveBranchId(payload.branchId || (payload as any).branch);
    const sName = payload.name || (payload as any).companyName || 'Supplier';
    const contact = payload.contactPerson || (payload as any).contactName || '';
    const data = {
      // Supplier balances are server-derived from purchases/payments, never client-provided.
      name: sName,
      companyName: (payload as any).companyName || sName,
      contactPerson: contact,
      contactName: contact,
      phone: payload.phone || '',
      itemsSupplied: payload.itemsSupplied || '',
      category: payload.itemsSupplied || (payload as any).category || 'General Supplies',
      branchId,
      branch: (payload as any).branch || branchId,
      pendingAmount: 0,
      overdueAmount: 0,
      createdAt: new Date().toISOString()
    };
    const docRef = await addDoc(collection(db, COLLECTIONS.SUPPLIERS), data);
    return { id: docRef.id, ...data };
  }

  async processSalaryPayment(payload: SalaryPaymentPayload): Promise<Salary> {
    const salaryId = await addSalaryFirestore({
      employeeId: payload.employeeId,
      employeeName: payload.employeeName,
      amount: payload.amount,
      period: payload.period,
      status: 'paid'
    } as any);

    return {
      id: salaryId,
      ...payload,
      status: 'paid',
      paidDate: new Date().toISOString()
    };
  }
}
