import { translations } from '../../../i18n/translations';
import { translateRawUi } from '../../../i18n/rawUi';
import React, { useState } from 'react';
import { Supplier, SupplierPayment } from '../../../domain/entities/inventory';
import { InventoryLang, inventoryDict } from '../../../i18n';
import {
  Users,
  Plus,
  Phone,
  Mail,
  MapPin,
  FileText,
  DollarSign,
  Star,
  Edit2,
  Trash2,
  X,
  CreditCard,
  Building,
  CheckCircle2
} from 'lucide-react';

interface SupplierListViewProps {
  suppliers: Supplier[];
  lang: InventoryLang;
  userRole?: string;
  onAddSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateSupplier: (id: string, supplier: Partial<Supplier>) => Promise<void>;
  onDeleteSupplier: (id: string) => Promise<void>;
  onRecordPayment: (payment: Omit<SupplierPayment, 'id' | 'createdAt'>) => Promise<void>;
}

export const SupplierListView: React.FC<SupplierListViewProps> = ({
  suppliers,
  lang,
  userRole,
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
  onRecordPayment
}) => {
  const t = { ...(inventoryDict[lang] || inventoryDict.en), legacyUi: translations[lang].legacyUi };
  const isReadOnly = userRole === 'Kitchen' || userRole === 'Cashier';

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [payingSupplier, setPayingSupplier] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<string>('Bank Transfer');
  const [payRef, setPayRef] = useState<string>('');

  const [detailsSupplier, setDetailsSupplier] = useState<Supplier | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    companyName: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    taxNumber: '',
    paymentTerms: '',
    outstandingBalance: 0,
    rating: 0,
    notes: '',
    productsSupplied: [] as string[]
  });

  // Handle Add Open
  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setFormData({
      companyName: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      taxNumber: '',
      paymentTerms: '',
      outstandingBalance: 0,
      rating: 0,
      notes: '',
      productsSupplied: []
    });
    setIsFormOpen(true);
  };

  // Handle Edit Open
  const handleOpenEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setFormData({
      companyName: s.companyName,
      contactPerson: s.contactPerson,
      phone: s.phone,
      email: s.email || '',
      address: s.address || '',
      taxNumber: s.taxNumber || '',
      paymentTerms: s.paymentTerms || '',
      outstandingBalance: s.outstandingBalance || 0,
      rating: typeof s.rating === 'number' ? s.rating : 0,
      notes: s.notes || '',
      productsSupplied: s.productsSupplied || []
    });
    setIsFormOpen(true);
  };

  // Submit Supplier Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName || !formData.phone) return;

    if (editingSupplier) {
      await onUpdateSupplier(editingSupplier.id, formData);
    } else {
      await onAddSupplier(formData);
    }

    setIsFormOpen(false);
  };

  // Submit Payment
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingSupplier || payAmount <= 0) return;

    const methodMap: Record<string, 'bank_transfer' | 'cash' | 'check' | 'card' | 'evc_plus'> = {
      'Bank Transfer': 'bank_transfer',
      'EVC Plus': 'evc_plus',
      'Cash': 'cash',
      'Check': 'check'
    };

    await onRecordPayment({
      supplierId: payingSupplier.id,
      supplierName: payingSupplier.companyName,
      amount: payAmount,
      paymentMethod: methodMap[payMethod] || 'bank_transfer',
      referenceNumber: payRef || `PAY-${Date.now().toString().slice(-6)}`,
      paymentDate: new Date().toISOString(),
      status: 'completed',
      createdBy: 'Finance Manager'
    });

    setPayingSupplier(null);
    alert('Supplier payment recorded successfully!');
  };

  return (
    <div className="space-y-6 text-white font-sans">
      
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl flex items-center justify-between">
        <div>
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Building className="w-5 h-5 text-amber-400" /> {translateRawUi('Suppliers & Vendor Management')}
          </h3>
          <p className="text-xs text-slate-400">{t.legacyUi.approvedSupplierDirectory}</p>
        </div>

        {!isReadOnly && (
          <button
            onClick={handleOpenAdd}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-4 py-2.5 rounded-2xl transition cursor-pointer text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" /> {t.addSupplier}
          </button>
        )}
      </div>

      {/* Supplier Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {suppliers.length === 0 ? (
          <div className="col-span-full bg-slate-900 border border-slate-800 p-12 rounded-3xl text-center text-slate-500 text-xs">
            <Users className="w-10 h-10 mx-auto text-slate-700 mb-2" />
            {translateRawUi('No suppliers registered yet. Click "Add Supplier" to register one.')}
          </div>
        ) : (
          suppliers.map((s) => {
            const hasBalance = s.outstandingBalance > 0;

            return (
              <div
                key={s.id}
                className="bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl space-y-4 hover:border-slate-700 transition flex flex-col justify-between"
              >
                
                {/* Header */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-extrabold text-white text-base">{s.companyName}</h4>
                      <p className="text-xs text-slate-400 font-semibold">{s.contactPerson}</p>
                    </div>

                    {/* Star Rating */}
                    <div className="flex items-center gap-0.5 text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i < (typeof s.rating === 'number' ? s.rating : 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-700'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Contact Details */}
                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="font-mono">{s.phone}</span>
                    </div>

                    {s.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{s.email}</span>
                      </div>
                    )}

                    {s.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">{s.address}</span>
                      </div>
                    )}
                  </div>

                  {/* Payment Terms & Balance */}
                  <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block">{t.legacyUi.paymentTerms}</span>
                      <span className="font-semibold text-slate-300">{s.paymentTerms}</span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 font-bold block">{t.legacyUi.payableBalance}</span>
                      <span className={`font-mono font-black ${hasBalance ? 'text-rose-400' : 'text-emerald-400'}`}>
                        ${(s.outstandingBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Dock */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                  
                  {hasBalance && !isReadOnly && (
                    <button
                      onClick={() => {
                        setPayingSupplier(s);
                        setPayAmount(s.outstandingBalance);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5" /> {translateRawUi('Pay Supplier')}
                    </button>
                  )}

                  <button
                    onClick={() => setDetailsSupplier(s)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                  >
                    {translateRawUi('Details')}
                  </button>

                  {!isReadOnly && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(s)}
                        className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {userRole === 'Owner' && (
                        <button
                          onClick={async () => {
                            if (confirm(`Delete supplier ${s.companyName}?`)) {
                              await onDeleteSupplier(s.id);
                            }
                          }}
                          className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-950 text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                </div>

              </div>
            );
          })
        )}
      </div>

      {/* MODAL 1: Add/Edit Supplier */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white">
                {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4 text-xs">
              
              <div>
                <label className="block text-slate-400 font-bold mb-1">{t.legacyUi.companyNameRequired}</label>
                <input
                  type="text"
                  required
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white focus:border-amber-500 focus:outline-none"
                  placeholder={translateRawUi('e.g., Prime Meat & Poultry Distributors')}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">{t.legacyUi.contactPersonRequired}</label>
                  <input
                    type="text"
                    required
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">{t.legacyUi.phoneNumberRequired}</label>
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-2.5 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">{t.legacyUi.emailLabel}</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">{t.legacyUi.paymentTerms}</label>
                  <select
                    value={formData.paymentTerms}
                    onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-2.5 text-white"
                  >
                    <option value="Cash on Delivery">{t.legacyUi.cashOnDelivery}</option>
                    <option value="Net 15">{t.legacyUi.net15Days}</option>
                    <option value="Net 30">{t.legacyUi.net30Days}</option>
                    <option value="Net 60">{t.legacyUi.net60Days}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">{translateRawUi('Address')}</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-2.5 text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-2xl bg-slate-800 text-slate-300 font-bold"
                >
                  {translateRawUi('Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  {editingSupplier ? 'Update Supplier' : 'Save Supplier'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Supplier Payment Modal */}
      {payingSupplier && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold text-white">Record Payment to {payingSupplier.companyName}</h3>
              <button onClick={() => setPayingSupplier(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">
                  {translateRawUi('Outstanding Balance:')} <span className="text-rose-400 font-mono font-bold">${payingSupplier.outstandingBalance}</span>
                </label>
                <label className="block text-slate-400 font-bold mb-1">{t.legacyUi.paymentAmountRequired}</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  max={payingSupplier.outstandingBalance}
                  value={payAmount}
                  onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white text-base font-mono font-black focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">{t.legacyUi.paymentMethod}</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white"
                >
                  <option value="Bank Transfer">{t.legacyUi.bankWireTransfer}</option>
                  <option value="EVC Plus">{t.legacyUi.evcPlusMobileMoney}</option>
                  <option value="Cash">{translateRawUi('Cash')}</option>
                  <option value="Check">{t.legacyUi.companyCheck}</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPayingSupplier(null)}
                  className="px-4 py-2 rounded-2xl bg-slate-800 text-slate-300 font-bold"
                >
                  {translateRawUi('Cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-2xl bg-emerald-500 text-slate-950 font-black"
                >
                  {translateRawUi('Confirm Payment')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
