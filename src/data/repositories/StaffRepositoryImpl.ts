import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db, COLLECTIONS, addSalaryFirestore, getEffectiveBranchId } from '../../lib/firebase';
import { getMogadishuDateString } from '../../lib/dateUtils';
import { IStaffRepository } from '../../domain/repositories/IStaffRepository';
import { NewEmployeePayload, NewSupplierPayload, SalaryPaymentPayload } from '../../domain/entities/staff';
import { Employee, Supplier, Salary } from '../../types';

export class StaffRepositoryImpl implements IStaffRepository {
  async fetchEmployees(branchId?: string): Promise<Employee[]> {
    try {
      const effectiveBranch = branchId && branchId !== 'all' ? branchId : getEffectiveBranchId();
      const q = effectiveBranch === 'all'
        ? collection(db, COLLECTIONS.EMPLOYEES)
        : query(collection(db, COLLECTIONS.EMPLOYEES), where('branchId', '==', effectiveBranch));
      const snap = await getDocs(q);
      const list: Employee[] = [];
      snap.forEach(d => {
        const data = d.data();
        const empName = data.fullName || data.name || 'Unnamed Employee';
        const empRole = data.role || data.jobTitle || 'Staff';
        list.push({
          id: d.id,
          employeeId: data.employeeId || d.id,
          fullName: empName,
          name: empName,
          email: data.email || '',
          phone: data.phone || '',
          role: empRole as any,
          jobTitle: empRole,
          salary: Number(data.salary) || 0,
          payFrequency: ['daily', 'weekly', 'monthly'].includes(String(data.payFrequency || '').toLowerCase()) ? String(data.payFrequency).toLowerCase() : 'monthly',
          status: data.status || 'active',
          employmentStatus: data.employmentStatus || 'Active',
          department: data.department || 'Operations',
          branch: data.branch || data.branchId || '',
          branchId: data.branchId || data.branch || '',
          nationalIdOrPassport: data.nationalIdOrPassport || '',
          address: data.address || '',
          dateOfBirth: data.dateOfBirth || '',
          gender: data.gender || '',
          nationality: data.nationality || '',
          hireDate: data.hireDate || getMogadishuDateString(),
          emergencyContact: data.emergencyContact || { name: '', relationship: '', phone: '' },
          createdAt: data.createdAt || new Date().toISOString(),
          ...data
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
      const branchId = getEffectiveBranchId();
      const suppliersQuery = branchId === 'all'
        ? collection(db, COLLECTIONS.SUPPLIERS)
        : query(collection(db, COLLECTIONS.SUPPLIERS), where('branchId', '==', branchId));
      const snap = await getDocs(suppliersQuery);
      const list: Supplier[] = [];
      snap.forEach(d => {
        const data = d.data();
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
      const effectiveBranch = branchId || getEffectiveBranchId();
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
    const data = {
      fullName: payload.name,
      name: payload.name,
      employeeId: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
      email: payload.email || '',
      phone: '',
      address: '',
      nationalIdOrPassport: '',
      dateOfBirth: '',
      gender: '' as const,
      nationality: '',
      hireDate: now.split('T')[0],
      jobTitle: payload.role || 'Staff',
      department: 'Operations',
      branch: getEffectiveBranchId(),
      branchId: getEffectiveBranchId(),
      employmentStatus: 'Active' as const,
      status: 'active',
      role: (payload.role as any) || 'Employee',
      salary: Number(payload.salary) || 0,
      payFrequency: payload.payFrequency || 'monthly',
      totalSales: 0,
      ordersCount: 0,
      emergencyContact: { name: '', relationship: '', phone: '' },
      createdAt: now
    };
    const docRef = await addDoc(collection(db, COLLECTIONS.EMPLOYEES), data);
    return { id: docRef.id, ...data };
  }

  async createSupplier(payload: NewSupplierPayload): Promise<Supplier> {
    const branchId = getEffectiveBranchId(payload.branchId || (payload as any).branch);
    const data = {
      // Supplier balances are server-derived from purchases/payments, never client-provided.
      name: payload.name,
      contactPerson: payload.contactPerson,
      phone: payload.phone,
      itemsSupplied: payload.itemsSupplied,
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
