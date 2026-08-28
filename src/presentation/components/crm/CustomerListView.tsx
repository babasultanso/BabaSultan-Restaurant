import React, { useState, useEffect } from 'react';
import { Customer, CustomerGender, CustomerStatus } from '../../../domain/entities/customer';
import { CustomerRepositoryImpl } from '../../../data/repositories/CustomerRepositoryImpl';
import {
  Users,
  Search,
  Plus,
  Filter,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Award,
  Wallet,
  MessageSquare,
  Eye,
  Edit2,
  Trash2,
  Crown,
  RefreshCw,
  X,
  AlertCircle
} from 'lucide-react';
import { validateCustomerInput } from '../../../domain/validation/customerValidation';

interface CustomerListViewProps {
  onSelectCustomer: (customer: Customer) => void;
  onOpenWallet: (customerId: string) => void;
  onOpenMessage: (customer: Customer) => void;
}

const repo = new CustomerRepositoryImpl();

export const CustomerListView: React.FC<CustomerListViewProps> = ({
  onSelectCustomer,
  onOpenWallet,
  onOpenMessage
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    gender: 'other' as CustomerGender,
    dateOfBirth: '',
    profilePhoto: '',
    preferredLanguage: 'so' as 'en' | 'ar' | 'so',
    address: '',
    city: 'Mogadishu',
    notes: '',
    status: 'active' as CustomerStatus
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await repo.fetchCustomers();
      setCustomers(list);
    } catch (err) {
      console.error('Error loading customer list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setEditingCustomer(null);
    setFormData({
      fullName: '',
      phone: '',
      email: '',
      gender: 'other',
      dateOfBirth: '',
      profilePhoto: '',
      preferredLanguage: 'so',
      address: '',
      city: 'Mogadishu',
      notes: '',
      status: 'active'
    });
    setFormErrors({});
    setShowAddModal(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setFormData({
      fullName: c.fullName || c.name || '',
      phone: c.phone || '',
      email: c.email || '',
      gender: c.gender || 'other',
      dateOfBirth: c.dateOfBirth || '',
      profilePhoto: c.profilePhoto || '',
      preferredLanguage: c.preferredLanguage || 'so',
      address: c.address || '',
      city: c.city || 'Mogadishu',
      notes: c.notes || '',
      status: c.status || 'active'
    });
    setFormErrors({});
    setShowAddModal(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateCustomerInput({
      fullName: formData.fullName,
      phone: formData.phone,
      email: formData.email
    });

    if (!validation.isValid) {
      setFormErrors(validation.errors);
      return;
    }

    setSubmitting(true);
    try {
      if (editingCustomer) {
        await repo.updateCustomer(editingCustomer.id, {
          fullName: formData.fullName,
          name: formData.fullName,
          phone: formData.phone,
          email: formData.email,
          gender: formData.gender,
          dateOfBirth: formData.dateOfBirth,
          profilePhoto: formData.profilePhoto,
          preferredLanguage: formData.preferredLanguage,
          address: formData.address,
          city: formData.city,
          notes: formData.notes,
          status: formData.status
        });
      } else {
        await repo.addCustomer({
          fullName: formData.fullName,
          name: formData.fullName,
          phone: formData.phone,
          email: formData.email,
          gender: formData.gender,
          dateOfBirth: formData.dateOfBirth,
          profilePhoto: formData.profilePhoto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80',
          preferredLanguage: formData.preferredLanguage,
          address: formData.address,
          city: formData.city,
          notes: formData.notes,
          status: formData.status,
          membershipLevel: 'Bronze',
          totalOrders: 0,
          totalSpending: 0,
          totalSpent: 0,
          averageOrderValue: 0
        });
      }

      setShowAddModal(false);
      loadData();
    } catch (err) {
      console.error('Error saving customer:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCustomer = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete customer "${name}"?`)) {
      try {
        await repo.deleteCustomer(id);
        loadData();
      } catch (err) {
        console.error('Error deleting customer:', err);
      }
    }
  };

  // Filtered list
  const filteredCustomers = customers.filter(c => {
    const query = (searchQuery || '').toLowerCase();
    const matchesSearch =
      !query ||
      ((c.fullName || '').toLowerCase().includes(query)) ||
      ((c.phone || '').toLowerCase().includes(query)) ||
      ((c.email || '').toLowerCase().includes(query)) ||
      ((c.city || '').toLowerCase().includes(query));

    const matchesTier = selectedTier === 'all' || ((c.membershipLevel || '').toLowerCase() === (selectedTier || '').toLowerCase());
    const matchesStatus = selectedStatus === 'all' || ((c.status || '').toLowerCase() === (selectedStatus || '').toLowerCase());

    return matchesSearch && matchesTier && matchesStatus;
  });

  const getTierColor = (level?: string) => {
    switch (level) {
      case 'VIP': return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'Platinum': return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'Gold': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
      case 'Silver': return 'bg-slate-500/10 text-slate-300 border-slate-500/30';
      default: return 'bg-amber-900/10 text-amber-600 border-amber-800/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 p-5 rounded-3xl backdrop-blur-md">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-emerald-400" />
            <span>Customer Relationship Directory</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage profiles, lifetime spending histories, communication preferences, and wallet accounts
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={openAddModal}
            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Customer</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer by name, phone, email or city..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Loyalty Tiers</option>
            <option value="bronze">Bronze Tier</option>
            <option value="silver">Silver Tier</option>
            <option value="gold">Gold Tier</option>
            <option value="platinum">Platinum Tier</option>
            <option value="vip">VIP Tier</option>
          </select>
        </div>

        <div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Account Statuses</option>
            <option value="active">Active Members</option>
            <option value="vip">VIP Priority</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Customer Directory Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 bg-slate-900/50 rounded-3xl border border-slate-800">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-400" />
          <p className="text-xs">Loading customer directory from Firestore...</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="p-12 text-center text-slate-400 bg-slate-900/50 rounded-3xl border border-slate-800 space-y-3">
          <Users className="w-10 h-10 mx-auto text-slate-600" />
          <h3 className="text-sm font-bold text-white">No Customers Found</h3>
          <p className="text-xs text-slate-500">Try adjusting your search criteria or register a new customer profile.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl p-5 space-y-4 transition-all hover:shadow-xl relative group flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Header Profile Tag */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={
                        customer.profilePhoto ||
                        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80'
                      }
                      alt={customer.fullName}
                      className="w-12 h-12 rounded-2xl object-cover border border-slate-700"
                    />
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition">
                        {customer.fullName}
                      </h3>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-500" />
                        <span>{customer.phone || 'No Phone'}</span>
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getTierColor(
                      customer.membershipLevel
                    )}`}
                  >
                    {customer.membershipLevel || 'Bronze'}
                  </span>
                </div>

                {/* Details Breakdown */}
                <div className="bg-slate-950/70 rounded-2xl p-3 border border-slate-800/80 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Total Spending</span>
                    <span className="font-black text-emerald-400 text-xs">
                      ${(customer.totalSpending || customer.totalSpent || 0).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Total Orders</span>
                    <span className="font-bold text-slate-200">{customer.totalOrders || 0} orders</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Avg Order Value</span>
                    <span className="font-semibold text-slate-300">
                      ${(customer.averageOrderValue || 0).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">City / Branch</span>
                    <span className="font-semibold text-slate-300 truncate block">{customer.city || 'Mogadishu'}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between gap-2">
                <button
                  onClick={() => onSelectCustomer(customer)}
                  className="flex-1 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>360° Profile</span>
                </button>

                <button
                  onClick={() => onOpenWallet(customer.id)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition cursor-pointer"
                  title="Manage Wallet"
                >
                  <Wallet className="w-4 h-4 text-amber-400" />
                </button>

                <button
                  onClick={() => onOpenMessage(customer)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition cursor-pointer"
                  title="Send Message"
                >
                  <MessageSquare className="w-4 h-4 text-blue-400" />
                </button>

                <button
                  onClick={() => openEditModal(customer)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition cursor-pointer"
                  title="Edit Customer"
                >
                  <Edit2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleDeleteCustomer(customer.id, customer.fullName)}
                  className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs transition cursor-pointer"
                  title="Delete Customer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal for Creating / Editing Customer */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                <span>{editingCustomer ? 'Edit Customer Profile' : 'Register New Customer'}</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Full Name */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Full Name *</label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="e.g. Amina Sheikh Duale"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  {formErrors.fullName && <p className="text-[10px] text-rose-400 mt-1">{formErrors.fullName}</p>}
                </div>

                {/* Phone */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Phone Number *</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. +252 61 555 7788"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  {formErrors.phone && <p className="text-[10px] text-rose-400 mt-1">{formErrors.phone}</p>}
                </div>

                {/* Email */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. amina@example.so"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                  {formErrors.email && <p className="text-[10px] text-rose-400 mt-1">{formErrors.email}</p>}
                </div>

                {/* City */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">City / Branch Location</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. Mogadishu"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Gender */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e: any) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="unspecified">Unspecified</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>

                {/* Preferred Language */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Preferred Language</label>
                  <select
                    value={formData.preferredLanguage}
                    onChange={(e: any) => setFormData({ ...formData, preferredLanguage: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="so">Somali (Soomaali)</option>
                    <option value="ar">Arabic (العربية)</option>
                    <option value="en">English</option>
                  </select>
                </div>

                {/* Date of Birth */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Account Status</label>
                  <select
                    value={formData.status}
                    onChange={(e: any) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="active">Active</option>
                    <option value="vip">VIP Priority</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Delivery Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street name, villa number, district..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Customer Notes & Dietary Preferences</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  placeholder="Special instructions, favorite dishes, spice level..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingCustomer ? 'Update Profile' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
