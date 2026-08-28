export interface NewEmployeePayload {
  name: string;
  email: string;
  role: string;
  salary: number;
}

export interface NewSupplierPayload {
  name: string;
  contactPerson: string;
  phone: string;
  itemsSupplied: string;
  pendingAmount: number;
}

export interface SalaryPaymentPayload {
  employeeId: string;
  employeeName: string;
  amount: number;
  period: string;
}
