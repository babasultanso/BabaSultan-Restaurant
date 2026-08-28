import React, { useState, useEffect } from 'react';
import { CustomerReward, MembershipLevel } from '../../../domain/entities/customer';
import { CustomerRepositoryImpl } from '../../../data/repositories/CustomerRepositoryImpl';
import {
  Award,
  Crown,
  Plus,
  Edit2,
  Gift,
  Zap,
  Sparkles,
  CheckCircle2,
  X,
  RefreshCw,
  Tag,
  AlertCircle
} from 'lucide-react';

const repo = new CustomerRepositoryImpl();

export const LoyaltyProgramView: React.FC = () => {
  const [rewards, setRewards] = useState<CustomerReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingReward, setEditingReward] = useState<CustomerReward | null>(null);

  const [formData, setFormData] = useState({
    rewardName: '',
    rewardNameAr: '',
    rewardNameSo: '',
    description: '',
    pointsRequired: 100,
    discountType: 'fixed_amount' as 'percentage' | 'fixed_amount',
    discountValue: 5,
    isActive: true
  });
  const [submitting, setSubmitting] = useState(false);

  const loadRewards = async () => {
    setLoading(true);
    try {
      const list = await repo.fetchRewards();
      setRewards(list);
    } catch (err) {
      console.error('Error loading rewards:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRewards();
  }, []);

  const openAddModal = () => {
    setEditingReward(null);
    setFormData({
      rewardName: '',
      rewardNameAr: '',
      rewardNameSo: '',
      description: '',
      pointsRequired: 100,
      discountType: 'fixed_amount',
      discountValue: 5,
      isActive: true
    });
    setShowModal(true);
  };

  const openEditModal = (r: CustomerReward) => {
    setEditingReward(r);
    setFormData({
      rewardName: r.rewardName,
      rewardNameAr: r.rewardNameAr || '',
      rewardNameSo: r.rewardNameSo || '',
      description: r.description || '',
      pointsRequired: r.pointsRequired,
      discountType: r.discountType,
      discountValue: r.discountValue,
      isActive: r.isActive
    });
    setShowModal(true);
  };

  const handleSaveReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.rewardName.trim() || formData.pointsRequired <= 0) return;

    setSubmitting(true);
    try {
      if (editingReward) {
        await repo.updateReward(editingReward.id, formData);
      } else {
        await repo.createReward(formData);
      }
      setShowModal(false);
      loadRewards();
    } catch (err) {
      console.error('Error saving reward:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const tiers: { level: MembershipLevel; threshold: number; colorClass: string; desc: string; multiplier: string }[] = [
    { level: 'Bronze', threshold: 0, colorClass: 'text-amber-700 bg-amber-900/10 border-amber-800/30', desc: 'Entry level upon registration', multiplier: '1.0x Points' },
    { level: 'Silver', threshold: 200, colorClass: 'text-slate-300 bg-slate-500/10 border-slate-500/30', desc: 'Reached after 200 pts earned', multiplier: '1.2x Points Bonus' },
    { level: 'Gold', threshold: 500, colorClass: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30', desc: 'Reached after 500 pts earned', multiplier: '1.5x Points Bonus' },
    { level: 'Platinum', threshold: 1200, colorClass: 'text-purple-400 bg-purple-500/10 border-purple-500/30', desc: 'Reached after 1,200 pts earned', multiplier: '2.0x Points Bonus' },
    { level: 'VIP', threshold: 3000, colorClass: 'text-amber-400 bg-amber-500/10 border-amber-500/30', desc: 'Exclusive VIP tier at 3,000+ pts', multiplier: '2.5x Points Bonus' }
  ];

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-3xl">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2.5">
            <Award className="w-6 h-6 text-purple-400" />
            <span>Loyalty & Membership Program</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure tier progression levels, point multipliers, and redeemable rewards catalog
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="px-4 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-purple-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Create Reward Voucher</span>
        </button>
      </div>

      {/* 5 Membership Levels Row */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-400" />
          <span>Membership Level Tiers & Earning Multipliers</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {tiers.map((t) => (
            <div
              key={t.level}
              className={`p-4 rounded-2xl border ${t.colorClass} space-y-2 relative overflow-hidden`}
            >
              <div className="flex items-center justify-between">
                <span className="font-black text-sm uppercase tracking-wide">{t.level}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-950/60 border border-current">
                  {t.threshold}+ pts
                </span>
              </div>
              <p className="text-[11px] opacity-80">{t.desc}</p>
              <span className="text-xs font-extrabold block text-emerald-400 pt-1">{t.multiplier}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Redeemable Rewards Catalog */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Gift className="w-4 h-4 text-emerald-400" />
            <span>Redeemable Rewards Catalog</span>
          </h3>
          <button onClick={loadRewards} className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 bg-slate-900/50 rounded-2xl border border-slate-800 text-xs">
            Loading rewards catalog...
          </div>
        ) : rewards.length === 0 ? (
          <div className="p-8 text-center text-slate-400 bg-slate-900/50 rounded-2xl border border-slate-800 text-xs">
            No rewards in catalog yet. Click "Create Reward Voucher" to add one.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rewards.map((reward) => (
              <div
                key={reward.id}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3 relative flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                        <Gift className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{reward.rewardName}</h4>
                        <span className="text-[10px] text-purple-400 font-bold block">
                          {reward.pointsRequired} Points Required
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => openEditModal(reward)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">{reward.description || 'No description provided.'}</p>

                  <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
                    <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                      Value: {reward.discountType === 'percentage' ? `${reward.discountValue}% Off` : `$${(reward.discountValue || 0).toFixed(2)} Off`}
                    </span>
                    <span className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                      Claimed: {reward.currentRedemptions || 0} times
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className={`font-semibold ${reward.isActive ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {reward.isActive ? 'Active Reward' : 'Disabled'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal for Creating / Editing Reward */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Gift className="w-5 h-5 text-purple-400" />
                <span>{editingReward ? 'Edit Reward Item' : 'Add New Reward Item'}</span>
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveReward} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Reward Title (English) *</label>
                <input
                  type="text"
                  value={formData.rewardName}
                  onChange={(e) => setFormData({ ...formData, rewardName: e.target.value })}
                  placeholder="e.g. Free Suqaar Dish"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Points Required *</label>
                  <input
                    type="number"
                    value={formData.pointsRequired}
                    onChange={(e) => setFormData({ ...formData, pointsRequired: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Discount Type</label>
                  <select
                    value={formData.discountType}
                    onChange={(e: any) => setFormData({ ...formData, discountType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-purple-500"
                  >
                    <option value="fixed_amount">Fixed Amount ($)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Discount Value *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.discountValue}
                  onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  placeholder="Reward details..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded text-purple-500 bg-slate-950 border-slate-800"
                />
                <label htmlFor="isActive" className="text-xs font-medium text-slate-300 cursor-pointer">
                  Active in Customer Loyalty Catalog
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
                  className="px-5 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Reward'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
