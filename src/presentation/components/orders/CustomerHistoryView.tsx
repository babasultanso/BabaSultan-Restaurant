import React, { useState, useEffect } from 'react';
import { Customer, Order } from '../../../types';
import { fetchCustomersFirestore } from '../../../lib/firebase';
import { Users, Phone, Mail, MapPin, Search, Calendar, DollarSign, ShoppingBag } from 'lucide-react';

interface CustomerHistoryViewProps {
  orders: Order[];
}

export const CustomerHistoryView: React.FC<CustomerHistoryViewProps> = ({ orders }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchCustomersFirestore()
      .then(res => {
        setCustomers(res);
        if (res.length > 0) setSelectedCustomer(res[0]);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const filteredCustomers = customers.filter(c =>
    (c.name || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
    (c.phone || '').includes(searchQuery || '')
  );

  const customerOrders = selectedCustomer
    ? orders.filter(
        o =>
          (o.customerId && o.customerId === selectedCustomer.id) ||
          (o.customerName && (o.customerName || '').toLowerCase() === (selectedCustomer.name || '').toLowerCase()) ||
          (o.customerPhone && o.customerPhone === selectedCustomer.phone)
      )
    : [];

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-xl flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            Customer Directory & Order History
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Track customer profiles, phone contacts, total spend & past order logs
          </p>
        </div>
      </div>

      {/* Grid: Left Customer List, Right Customer Details & Order History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Customer List */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search customer name or phone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto no-scrollbar pr-1">
            {isLoading ? (
              <div className="py-8 text-center text-xs text-slate-500">Loading customer profiles...</div>
            ) : filteredCustomers.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">No customers found.</div>
            ) : (
              filteredCustomers.map(cust => {
                const isSel = selectedCustomer?.id === cust.id;
                return (
                  <div
                    key={cust.id}
                    onClick={() => setSelectedCustomer(cust)}
                    className={`p-4 rounded-2xl border transition cursor-pointer space-y-1.5 ${
                      isSel
                        ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-extrabold text-sm text-white">{cust.name}</h4>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        {cust.totalOrders || 0} Orders
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-emerald-400" /> {cust.phone}
                      </span>
                      <span className="font-extrabold text-white">${(cust.totalSpent || 0).toFixed(2)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right 2 Columns: Selected Customer Details & Past Orders */}
        <div className="lg:col-span-2 space-y-6">
          {selectedCustomer ? (
            <>
              {/* Customer Profile Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <h3 className="text-xl font-extrabold text-white">{selectedCustomer.name}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-emerald-400" /> {selectedCustomer.phone}
                      </span>
                      {selectedCustomer.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-emerald-400" /> {selectedCustomer.email}
                        </span>
                      )}
                      {selectedCustomer.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400" /> {selectedCustomer.address}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-2xl border border-slate-800">
                    <div className="text-center px-2">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Total Orders</span>
                      <span className="text-base font-extrabold text-white">{customerOrders.length}</span>
                    </div>
                    <div className="w-px h-8 bg-slate-800" />
                    <div className="text-center px-2">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Lifetime Value</span>
                      <span className="text-base font-extrabold text-emerald-400">
                        ${customerOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Customer Orders History Table */}
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-emerald-400" />
                    Customer Order History
                  </h4>

                  {customerOrders.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500 bg-slate-950 rounded-2xl border border-slate-800">
                      No order records found for this customer.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto no-scrollbar">
                      {customerOrders.map(order => (
                        <div
                          key={order.id}
                          className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2 font-mono font-bold text-emerald-400">
                              <span>#{order.orderNumber}</span>
                              <span className="text-[10px] uppercase font-sans font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                                {order.orderType?.replace('_', ' ') || 'dine_in'}
                              </span>
                              <span className="text-[10px] text-slate-500 font-sans font-normal">
                                {new Date(order.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-slate-300 text-[11px] mt-1">
                              {order.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-extrabold text-white text-sm">${(order.totalAmount || 0).toFixed(2)}</span>
                            <span className="text-[10px] uppercase font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {order.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-500">
              Select a customer from the left directory to view full profile & order history.
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
