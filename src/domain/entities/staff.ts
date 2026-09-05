export interface NewEmployeePayload {
  name: string;
  email: string;
  role: string;
  salary: number;
  payFrequency?: 'daily' | 'weekly' | 'monthly';
}

export interface NewSupplierPayload {
  name: string;
  contactPerson: string;
  phone: string;
  itemsSupplied: string;
  pendingAmount: number;
  branchId?: string;
  branch?: string;
}

export interface SalaryPaymentPayload {
  employeeId: string;
  employeeName: string;
  amount: number;
  period: string;
}
