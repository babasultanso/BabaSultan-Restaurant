import React, { useState, useEffect } from 'react';
import { Customer } from '../../../types';
import { fetchCustomersFirestore, addCustomerFirestore } from '../../../lib/firebase';
import { X, Search, UserPlus, UserCheck, Phone, Mail, MapPin } from 'lucide-react';

interface CustomerModalProps {
  onClose: () => void;
  onSelectCustomer: (customer: Customer) => void;
}

export const CustomerModal: React.FC<CustomerModalProps> = ({
  onClose,
  onSelectCustomer
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);

  // New Customer Form
  const [newName, setNewName] = useState<string>('');
  const [newPhone, setNewPhone] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newAddress, setNewAddress] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    fetchCustomersFirestore()
      .then(res => setCustomers(res))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const filteredCustomers = customers.filter(c => {
    const nameStr = (c.name || '').toLowerCase();
    const phoneStr = c.phone || '';
    const q = (searchQuery || '').toLowerCase();
    return nameStr.includes(q) || phoneStr.includes(searchQuery);
  });

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPhone) return;
    setIsSubmitting(true);

    try {
      const created = await addCustomerFirestore({
        name: newName,
        phone: newPhone,
        email: newEmail,
        address: newAddress,
        totalOrders: 0,
        totalSpent: 0,
        createdAt: new Date().toISOString()
      });

      onSelectCustomer(created);
      onClose();
    } catch (err: any) {
      alert(`Failed to add customer: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative text-slate-100 max-h-[85vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-emerald-400" />
              Customer Selection & Directory
            </h3>
            <p className="text-xs text-slate-400">Select customer for order history & loyalty tracking</p>
          </div>

          <button
            onClick={() => setIsAddingNew(!isAddingNew)}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold hover:bg-emerald-500 hover:text-slate-950 transition cursor-pointer flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" />
            <span>{isAddingNew ? 'Back to List' : 'Add New'}</span>
          </button>
        </div>

        {isAddingNew ? (
          /* Add New Customer Form */
          <form onSubmit={handleCreateCustomer} className="space-y-4 text-xs">
            <div>
              <label className="text-slate-300 font-bold block mb-1">Customer Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Ahmed Ali / Hodan Hassan"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-bold block mb-1">Phone Number *</label>
              <input
                type="text"
                required
                placeholder="e.g. +252615000000 / +254712000000"
                value={newPhone}
                onChange={e => setNewPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-bold block mb-1">Email Address (Optional)</label>
              <input
                type="email"
                placeholder="e.g. ahmed@example.com"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-bold block mb-1">Delivery Address (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Hodan District, Maka Al Mukarama St, Mogadishu"
                value={newAddress}
                onChange={e => setNewAddress(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-extrabold py-3 rounded-2xl transition cursor-pointer shadow-lg shadow-emerald-500/20 text-xs flex items-center justify-center gap-2 mt-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving Customer...' : 'Save & Select Customer'}</span>
            </button>
          </form>
        ) : (
          /* Customer List & Search */
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search by customer name or phone..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar pr-1">
              {isLoading ? (
                <div className="py-8 text-center text-xs text-slate-500">Loading customer database...</div>
              ) : filteredCustomers.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No customers found. Click &quot;Add New&quot; to register a customer.
                </div>
              ) : (
                filteredCustomers.map(cust => (
                  <div
                    key={cust.id}
                    onClick={() => {
                      onSelectCustomer(cust);
                      onClose();
                    }}
                    className="p-3.5 bg-slate-950 hover:bg-slate-800/80 rounded-2xl border border-slate-800/80 transition cursor-pointer flex items-center justify-between group"
                  >
                    <div>
                      <h4 className="font-bold text-white group-hover:text-emerald-400 transition text-xs">
                        {cust.name}
                      </h4>
                      <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-emerald-400" /> {cust.phone}
                        </span>
                        <span>Orders: <strong>{cust.totalOrders || 0}</strong></span>
                        <span>Spent: <strong>${(cust.totalSpent || 0).toFixed(2)}</strong></span>
                      </div>
                    </div>

                    <button className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 group-hover:bg-emerald-500 group-hover:text-slate-950 font-bold text-[10px] transition">
                      Select
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
