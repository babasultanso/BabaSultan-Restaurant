import { NewEmployeePayload, NewSupplierPayload, SalaryPaymentPayload } from '../entities/staff';
import { Employee, Supplier, Salary } from '../../types';

export interface IStaffRepository {
  fetchEmployees(branchId?: string): Promise<Employee[]>;
  fetchSuppliers(): Promise<Supplier[]>;
  fetchSalaries(branchId?: string): Promise<Salary[]>;
  createEmployee(payload: NewEmployeePayload): Promise<Employee>;
  createSupplier(payload: NewSupplierPayload): Promise<Supplier>;
  processSalaryPayment(payload: SalaryPaymentPayload): Promise<Salary>;
}
