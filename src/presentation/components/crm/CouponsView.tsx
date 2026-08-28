import React, { useState, useEffect } from 'react';
import { CustomerCoupon, MembershipLevel } from '../../../domain/entities/customer';
import { CustomerRepositoryImpl } from '../../../data/repositories/CustomerRepositoryImpl';
import {
  Tag,
  Plus,
  Edit2,
  Calendar,
  Sparkles,
  Percent,
  DollarSign,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { validateCouponInput } from '../../../domain/validation/customerValidation';
import { getMogadishuDateString } from '../../../lib/dateUtils';

const repo = new CustomerRepositoryImpl();

export const CouponsView: React.FC = () => {
  const [coupons, setCoupons] = useState<CustomerCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CustomerCoupon | null>(null);

  const [formData, setFormData] = useState({
    code: '',
    title: '',
    description: '',
    discountType: 'percentage' as 'percentage' | 'fixed_amount',
    discountValue: 10,
    minOrderAmount: 20,
    maxDiscountAmount: 15,
    expiryDate: getMogadishuDateString(Date.now() + 30 * 24 * 60 * 60 * 1000),
    usageLimit: 100,
    targetLevel: '' as MembershipLevel | '',
    isBirthdayOffer: false,
    isActive: true
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const loadCoupons = async () => {
    setLoading(true);
    try {
      const list = await repo.fetchCoupons();
      setCoupons(list);
    } catch (err) {
      console.error('Error loading coupons:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, []);

  const openAddModal = () => {
    setEditingCoupon(null);
    setFormData({
      code: '',
      title: '',
      description: '',
      discountType: 'percentage',
      discountValue: 10,
      minOrderAmount: 20,
      maxDiscountAmount: 15,
      expiryDate: getMogadishuDateString(Date.now() + 30 * 24 * 60 * 60 * 1000),
      usageLimit: 100,
      targetLevel: '',
      isBirthdayOffer: false,
      isActive: true
    });
    setFormErrors({});
    setShowModal(true);
  };

  const openEditModal = (c: CustomerCoupon) => {
    setEditingCoupon(c);
    setFormData({
      code: c.code,
      title: c.title,
      description: c.description || '',
      discountType: c.discountType,
      discountValue: c.discountValue,
      minOrderAmount: c.minOrderAmount,
      maxDiscountAmount: c.maxDiscountAmount || 0,
      expiryDate: c.expiryDate,
      usageLimit: c.usageLimit || 0,
      targetLevel: c.targetLevel || '',
      isBirthdayOffer: !!c.isBirthdayOffer,
      isActive: c.isActive
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateCouponInput({
      code: formData.code,
      discountType: formData.discountType,
      discountValue: formData.discountValue,
      minOrderAmount: formData.minOrderAmount,
      expiryDate: formData.expiryDate
    });

    if (!validation.isValid) {
      setFormErrors(validation.errors);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        targetLevel: formData.targetLevel === '' ? undefined : (formData.targetLevel as MembershipLevel),
        maxDiscountAmount: formData.maxDiscountAmount > 0 ? formData.maxDiscountAmount : undefined,
        usageLimit: formData.usageLimit > 0 ? formData.usageLimit : undefined
      };

      if (editingCoupon) {
        await repo.updateCoupon(editingCoupon.id, payload);
      } else {
        await repo.createCoupon(payload);
      }
      setShowModal(false);
      loadCoupons();
    } catch (err) {
      console.error('Error saving coupon:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-3xl">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2.5">
            <Tag className="w-6 h-6 text-amber-400" />
            <span>Promotional Coupons & Offer Manager</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Create discount codes, minimum order thresholds, birthday specials, and tier-restricted vouchers
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>New Coupon Offer</span>
        </button>
      </div>

      {/* Coupons List Grid */}
      {loading ? (
        <div className="p-8 text-center text-slate-400 bg-slate-900/50 rounded-2xl border border-slate-800 text-xs">
          Loading promotional coupons...
        </div>
      ) : coupons.length === 0 ? (
        <div className="p-8 text-center text-slate-400 bg-slate-900/50 rounded-2xl border border-slate-800 text-xs">
          No coupons created yet. Click "New Coupon Offer" to create your first code.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coupons.map((coupon) => (
            <div
              key={coupon.id}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 relative flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block">
                      {coupon.title}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-white bg-slate-950 px-3 py-1 rounded-xl border border-slate-800 font-mono">
                        {coupon.code}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => openEditModal(coupon)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">{coupon.description || 'No description provided.'}</p>

                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950 p-3 rounded-2xl border border-slate-800/80">
                  <div>
                    <span className="text-slate-500 block">Discount</span>
                    <span className="font-bold text-emerald-400">
                      {coupon.discountType === 'percentage' ? `${coupon.discountValue}% Off` : `$${(coupon.discountValue || 0).toFixed(2)} Off`}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block">Min. Order</span>
                    <span className="font-bold text-white">${(coupon.minOrderAmount || 0).toFixed(2)}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 block">Usage Count</span>
                    <span className="font-semibold text-slate-300">
                      {coupon.usageCount} {coupon.usageLimit ? `/ ${coupon.usageLimit}` : 'uses'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 block">Expiry Date</span>
                    <span className="font-semibold text-slate-300">{coupon.expiryDate}</span>
                  </div>
                </div>

                {coupon.targetLevel && (
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    Target Tier: {coupon.targetLevel}
                  </span>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className={`font-semibold ${coupon.isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {coupon.isActive ? 'Active Promotion' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal for Creating / Editing Coupon */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-amber-400" />
                <span>{editingCoupon ? 'Edit Coupon Code' : 'Create New Coupon Code'}</span>
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCoupon} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Coupon Code *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. WELCOME10"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono uppercase focus:outline-none focus:border-amber-500"
                  />
                  {formErrors.code && <p className="text-[10px] text-rose-400 mt-1">{formErrors.code}</p>}
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Title / Campaign</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. 10% Welcome Discount"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Discount Type</label>
                  <select
                    value={formData.discountType}
                    onChange={(e: any) => setFormData({ ...formData, discountType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed_amount">Fixed Amount ($)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Discount Value *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.discountValue}
                    onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                  {formErrors.discountValue && <p className="text-[10px] text-rose-400 mt-1">{formErrors.discountValue}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Min Order Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.minOrderAmount}
                    onChange={(e) => setFormData({ ...formData, minOrderAmount: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Expiration Date *</label>
                  <input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                  {formErrors.expiryDate && <p className="text-[10px] text-rose-400 mt-1">{formErrors.expiryDate}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Target Tier (Optional)</label>
                  <select
                    value={formData.targetLevel}
                    onChange={(e: any) => setFormData({ ...formData, targetLevel: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">All Tiers</option>
                    <option value="Bronze">Bronze Only</option>
                    <option value="Silver">Silver Only</option>
                    <option value="Gold">Gold Only</option>
                    <option value="Platinum">Platinum Only</option>
                    <option value="VIP">VIP Only</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Total Usage Limit</label>
                  <input
                    type="number"
                    value={formData.usageLimit}
                    onChange={(e) => setFormData({ ...formData, usageLimit: Number(e.target.value) })}
                    placeholder="0 for unlimited"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActiveCoupon"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded text-amber-500 bg-slate-950 border-slate-800"
                />
                <label htmlFor="isActiveCoupon" className="text-xs font-medium text-slate-300 cursor-pointer">
                  Active for checkout validation
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
