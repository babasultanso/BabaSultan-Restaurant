import React, { useState } from 'react';
import {
  Wand2,
  Building2,
  Store,
  GitBranch,
  ShieldCheck,
  Users,
  Truck,
  Boxes,
  UtensilsCrossed,
  ChefHat,
  Percent,
  CreditCard,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  Plus,
  Trash2,
  Sparkles,
  RefreshCw,
  FileText,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { saveInitialSetupWizardData, InitialSetupData } from '../../../lib/firebase';

interface InitialSetupWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export const InitialSetupWizardModal: React.FC<InitialSetupWizardModalProps> = ({
  isOpen,
  onClose,
  onComplete
}) => {
  const { language, t } = useAuth();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveMode, setSaveMode] = useState<'firestore' | null>(null);
  const [showSummaryScreen, setShowSummaryScreen] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Restaurant Info State
  const [restaurant, setRestaurant] = useState({
    name: 'Somali Golden Feast',
    nameAr: 'مطعم الوليمة الذهبية',
    nameSo: 'Cunta-kariye Somali Golden Feast',
    slogan: 'Authentic Spiced Cuisine & Fine Dining',
    phone: '+252 61 555 0000',
    email: 'info@somaligoldenfeast.so',
    address: 'KM4 Junction, Maka Al Mukarama Road, Mogadishu',
    city: 'Mogadishu',
    currency: 'USD ($)',
    defaultLanguage: 'en',
    workingHours: '07:00 AM - 11:00 PM',
    logoUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=400&q=80',
    taxRegNumber: 'TRN-SO-994201'
  });

  // 2. Branch State
  const [branch, setBranch] = useState({
    name: 'Mogadishu Central HQ',
    code: 'HQ-MOG-01',
    city: 'Mogadishu',
    address: 'KM4 Junction, Maka Al Mukarama Road',
    managerName: 'Farah Abdi',
    managerPhone: '+252 61 555 1111',
    tableCount: 30,
    isPrimary: true
  });

  // 3. Admin Account State
  const [admin, setAdmin] = useState({
    name: 'System Admin',
    email: 'admin@somaligoldenfeast.so',
    role: 'Admin',
    phone: '+252 61 500 0000',
    pin: ''
  });

  // 4. Employees State
  const [employees, setEmployees] = useState([
    { name: 'Amina Mohamed', role: 'Cashier', email: 'amina@somaligoldenfeast.so', phone: '+252 61 555 2222', salary: 450, shift: 'Morning Shift' },
    { name: 'Hassan Jama', role: 'Head Chef', email: 'hassan@somaligoldenfeast.so', phone: '+252 61 555 3333', salary: 750, shift: 'All-Day' },
    { name: 'Khadra Ali', role: 'Waiter', email: 'khadra@somaligoldenfeast.so', phone: '+252 61 555 4444', salary: 380, shift: 'Evening Shift' },
    { name: 'Omar Yusuf', role: 'Accountant', email: 'omar@somaligoldenfeast.so', phone: '+252 61 555 5555', salary: 650, shift: 'Morning Shift' }
  ]);

  // 5. Suppliers State
  const [suppliers, setSuppliers] = useState([
    { name: 'Mogadishu Fresh Meat Co', contactName: 'Dahir Warsame', phone: '+252 61 700 1111', email: 'orders@mogmeat.so', category: 'Meat & Poultry' },
    { name: 'Somali Dairy & Produce', contactName: 'Fartun Ahmed', phone: '+252 61 700 2222', email: 'sales@somalidairy.so', category: 'Dairy & Milk' },
    { name: 'Banadir Spice Imports', contactName: 'Sheikh Ali', phone: '+252 61 700 3333', email: 'spices@banadir.so', category: 'Spices & Grains' }
  ]);

  // 6. Inventory Items State
  const [inventory, setInventory] = useState([
    { name: 'Chicken Breast', nameAr: 'صدر دجاج', nameSo: 'Sinaad Gallay', unit: 'kg', minAlertStock: 25, costPerUnit: 4.5, currentQuantity: 120, category: 'Meat' },
    { name: 'Basmati Rice', nameAr: 'أرز بسمتي', nameSo: 'Bariis Basaasati', unit: 'kg', minAlertStock: 50, costPerUnit: 1.8, currentQuantity: 300, category: 'Grains' },
    { name: 'Cooking Oil', nameAr: 'زيت طهي', nameSo: 'Saliid Cunto', unit: 'liters', minAlertStock: 20, costPerUnit: 2.2, currentQuantity: 100, category: 'Oils' },
    { name: 'Espresso Coffee Beans', nameAr: 'حبوب البن', nameSo: 'Buni Buuxa', unit: 'kg', minAlertStock: 10, costPerUnit: 12.0, currentQuantity: 45, category: 'Beverages' },
    { name: 'Fresh Whole Milk', nameAr: 'حليب طازج', nameSo: 'Caano Caadi ah', unit: 'liters', minAlertStock: 30, costPerUnit: 1.2, currentQuantity: 80, category: 'Dairy' }
  ]);

  // 7. Recipes State
  const [recipes, setRecipes] = useState([
    {
      productId: 'prod_1',
      productName: 'Somali Chicken Suqaar with Canjeero',
      ingredients: [
        { ingredientId: 'ing_1', ingredientName: 'Chicken Breast', quantityRequired: 0.25, unit: 'kg' },
        { ingredientId: 'ing_3', ingredientName: 'Cooking Oil', quantityRequired: 0.05, unit: 'liters' }
      ]
    },
    {
      productId: 'prod_2',
      productName: 'Traditional Somali Bariis Iskukaris',
      ingredients: [
        { ingredientId: 'ing_2', ingredientName: 'Basmati Rice', quantityRequired: 0.35, unit: 'kg' },
        { ingredientId: 'ing_3', ingredientName: 'Cooking Oil', quantityRequired: 0.04, unit: 'liters' }
      ]
    }
  ]);

  // 8. Products State
  const [products, setProducts] = useState([
    { name: 'Somali Chicken Suqaar with Canjeero', nameAr: 'صقار دجاج صومالي مع عنجيرو', nameSo: 'Suqaar Gallay ah iyo Canjeero', category: 'Main Course', price: 14.50, cost: 4.80, imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80', prepTimeMinutes: 15 },
    { name: 'Traditional Somali Bariis Iskukaris', nameAr: 'أرز صومالي اسكوكرس', nameSo: 'Bariis Iskukaris ah', category: 'Main Course', price: 16.00, cost: 5.20, imageUrl: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80', prepTimeMinutes: 20 },
    { name: 'Special Spiced Camel Milk Tea (Shaah Hawaash)', nameAr: 'شاي بحليب الإبل والبهارات', nameSo: 'Shaah Caanaha Geela & Hawaash', category: 'Beverages', price: 3.50, cost: 0.80, imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80', prepTimeMinutes: 5 },
    { name: 'Flame-Grilled Camel Steak Burger', nameAr: 'برجر لحم إبل مشوي', nameSo: 'Burger Hilib Geel Ah', category: 'Burgers & Sandwiches', price: 12.99, cost: 4.10, imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80', prepTimeMinutes: 12 }
  ]);

  // 9. Taxes State
  const [tax, setTax] = useState({
    taxName: 'VAT / Sales Tax',
    taxRate: 5.0,
    serviceCharge: 2.5,
    discountSettings: 'Standard Member & Promotional Discount Enabled',
    trnNumber: 'TRN-SO-994201',
    isInclusive: false
  });

  // 10. Payment Methods State
  const [payments, setPayments] = useState({
    cashEnabled: true,
    cardEnabled: true,
    evcPlusEnabled: true,
    zaadEnabled: true,
    sahalEnabled: true,
    eDahabEnabled: true,
    paypalEnabled: true,
    bankTransferEnabled: true,
    defaultPosMethod: 'cash',
    merchantId: 'MERCHANT-EVC-ZAAD-8842'
  });

  if (!isOpen) return null;

  const stepsList = [
    { num: 1, title: language === 'ar' ? 'معلومات المطعم' : language === 'so' ? 'Xogta Maqaayada' : 'Restaurant Info', icon: Building2 },
    { num: 2, title: language === 'ar' ? 'إنشاء الفرع' : language === 'so' ? 'Dhisidda Faraca' : 'First Branch', icon: Store },
    { num: 3, title: language === 'ar' ? 'حساب المدير' : language === 'so' ? 'Account-ka Admin-ka' : 'Admin Account', icon: ShieldCheck },
    { num: 4, title: language === 'ar' ? 'إضافة الموظفين' : language === 'so' ? 'Kudar Shaqaale' : 'Employees', icon: Users },
    { num: 5, title: language === 'ar' ? 'الموردين' : language === 'so' ? 'Muraaqibiinta' : 'Suppliers', icon: Truck },
    { num: 6, title: language === 'ar' ? 'المخزون الخام' : language === 'so' ? 'Stock-ka Alaabta' : 'Inventory Items', icon: Boxes },
    { num: 7, title: language === 'ar' ? 'الوصفات والتكلفة' : language === 'so' ? 'Cuntada & Qadarka' : 'Create Recipes', icon: ChefHat },
    { num: 8, title: language === 'ar' ? 'قائمة الطعام' : language === 'so' ? 'Cuntooyinka Menu-ga' : 'Add Products', icon: UtensilsCrossed },
    { num: 9, title: language === 'ar' ? 'الضرائب والرسوم' : language === 'so' ? 'Canshuuraha' : 'Configure Taxes', icon: Percent },
    { num: 10, title: language === 'ar' ? 'طرق الدفع' : language === 'so' ? 'Hababka Bixinta' : 'Payment Methods', icon: CreditCard }
  ];

  const handleNext = () => {
    if (currentStep < 10) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const fullSetupData: InitialSetupData = {
        restaurant,
        branch,
        admin,
        employees,
        suppliers,
        inventory,
        recipes,
        products,
        tax,
        payments
      };

      const result = await saveInitialSetupWizardData(fullSetupData);
      setSaveMode(result.mode);
      setSaveSuccess(true);
      setShowSummaryScreen(true);
    } catch (err: any) {
      console.error('Setup wizard save error:', err);
      setErrorMessage(err?.message || 'Failed to save configuration to Firestore. Please check your network and credentials.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-emerald-500/20">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-white">
                  {language === 'ar' ? 'معالج الإعداد الأولي للمؤسسة' : language === 'so' ? 'Tusaha Habaynta Hore ee Ganacsiga' : 'Initial Enterprise Setup Wizard'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                  Step {currentStep} of 10
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {language === 'ar' ? 'إعداد متكامل وموجه لشُعب النظام العشرة' : language === 'so' ? 'Hanuunin talaabo-talaabo ah oo loogu talagalay 10-ka qeybood' : 'Guided step-by-step launch configuration for all 10 core modules'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Stepper Progress Bar */}
        <div className="bg-slate-950/80 border-b border-slate-800/80 p-3 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 min-w-max">
            {stepsList.map(s => {
              const Icon = s.icon;
              const isActive = currentStep === s.num;
              const isDone = currentStep > s.num;

              return (
                <button
                  key={s.num}
                  onClick={() => setCurrentStep(s.num)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    isActive
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : isDone
                      ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{s.num}. {s.title}</span>
                  {isDone && <CheckCircle2 className="w-3.5 h-3.5 ml-0.5 text-emerald-400" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Wizard Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {errorMessage && (
            <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-2xl flex items-center gap-3 text-rose-400 text-xs">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {showSummaryScreen ? (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl flex items-center gap-3 text-sm font-bold border bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
                <CheckCircle2 className="w-6 h-6 shrink-0" />
                <span>Setup completed successfully. Data synchronized with Firestore.</span>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-emerald-400" />
                      ERP Initial Setup Summary
                    </h3>
                    <p className="text-xs text-slate-400">Review your configured modules before launching the operational dashboard.</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
                    System Ready
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                  {/* Restaurant */}
                  <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-emerald-400" /> 1. Restaurant</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    </span>
                    <p className="text-xs font-extrabold text-white truncate">{restaurant.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{restaurant.city || 'Mogadishu'} • {restaurant.currency}</p>
                  </div>

                  {/* Branches */}
                  <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><GitBranch className="w-3.5 h-3.5 text-blue-400" /> 2. Branch</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    </span>
                    <p className="text-xs font-extrabold text-white truncate">1 HQ Branch</p>
                    <p className="text-[11px] text-slate-400 truncate">{branch.name} ({branch.code})</p>
                  </div>

                  {/* Admin Account */}
                  <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-teal-400" /> 3. Admin User</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    </span>
                    <p className="text-xs font-extrabold text-white truncate">{admin.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">Role: {admin.role} (PIN: {admin.pin})</p>
                  </div>

                  {/* Employees */}
                  <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-purple-400" /> 4. Employees</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    </span>
                    <p className="text-xs font-extrabold text-white">{employees.length} Staff Records</p>
                    <p className="text-[11px] text-slate-400 truncate">Chefs, Cashiers, Waiters</p>
                  </div>

                  {/* Suppliers */}
                  <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><Truck className="w-3.5 h-3.5 text-amber-400" /> 5. Suppliers</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    </span>
                    <p className="text-xs font-extrabold text-white">{suppliers.length} Vendors</p>
                    <p className="text-[11px] text-slate-400 truncate">Meat, Dairy & Spices</p>
                  </div>

                  {/* Inventory items */}
                  <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><Boxes className="w-3.5 h-3.5 text-cyan-400" /> 6. Inventory</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    </span>
                    <p className="text-xs font-extrabold text-white">{inventory.length} Stock Items</p>
                    <p className="text-[11px] text-slate-400 truncate">Raw Ingredients Populated</p>
                  </div>

                  {/* Recipes */}
                  <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><UtensilsCrossed className="w-3.5 h-3.5 text-rose-400" /> 7. Recipes</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    </span>
                    <p className="text-xs font-extrabold text-white">{recipes.length} Recipe BOMs</p>
                    <p className="text-[11px] text-slate-400 truncate">Ingredient Costs Mapped</p>
                  </div>

                  {/* Products */}
                  <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><ChefHat className="w-3.5 h-3.5 text-orange-400" /> 8. Menu Products</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    </span>
                    <p className="text-xs font-extrabold text-white">{products.length} Menu Items</p>
                    <p className="text-[11px] text-slate-400 truncate">Ready for POS Terminal</p>
                  </div>

                  {/* Taxes */}
                  <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><Percent className="w-3.5 h-3.5 text-indigo-400" /> 9. Taxes & Fees</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    </span>
                    <p className="text-xs font-extrabold text-white">{tax.taxName} ({tax.taxRate}%)</p>
                    <p className="text-[11px] text-slate-400 truncate">Svc Charge: {tax.serviceCharge}%</p>
                  </div>

                  {/* Payment Methods */}
                  <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5 text-emerald-400" /> 10. Payments</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    </span>
                    <p className="text-xs font-extrabold text-white">
                      {[
                        payments.cashEnabled && 'Cash',
                        payments.cardEnabled && 'Card',
                        payments.evcPlusEnabled && 'EVC+',
                        payments.zaadEnabled && 'ZAAD',
                        payments.sahalEnabled && 'Sahal',
                        payments.eDahabEnabled && 'eDahab'
                      ].filter(Boolean).length} Gateways Active
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">EVC Plus, ZAAD & Cash</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex justify-end">
                  <button
                    onClick={() => {
                      if (onComplete) onComplete();
                      onClose();
                    }}
                    className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-2 shadow-xl shadow-emerald-500/20 transition cursor-pointer"
                  >
                    <span>Launch ERP System</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>

          {/* STEP 1: RESTAURANT INFORMATION */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
                <Building2 className="w-5 h-5" />
                <span>Step 1: Restaurant General & Brand Profile</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Restaurant Name (English)</label>
                  <input
                    type="text"
                    value={restaurant.name}
                    onChange={e => setRestaurant({ ...restaurant, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Restaurant Name (Arabic / اسم المطعم)</label>
                  <input
                    type="text"
                    value={restaurant.nameAr}
                    onChange={e => setRestaurant({ ...restaurant, nameAr: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                    dir="rtl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Tagline / Slogan</label>
                  <input
                    type="text"
                    value={restaurant.slogan}
                    onChange={e => setRestaurant({ ...restaurant, slogan: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Primary Phone Number</label>
                  <input
                    type="text"
                    value={restaurant.phone}
                    onChange={e => setRestaurant({ ...restaurant, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Official Contact Email</label>
                  <input
                    type="email"
                    value={restaurant.email}
                    onChange={e => setRestaurant({ ...restaurant, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Base Operational Currency</label>
                  <select
                    value={restaurant.currency}
                    onChange={e => setRestaurant({ ...restaurant, currency: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                  >
                    <option value="USD ($)">USD ($) - US Dollar</option>
                    <option value="SAR (ر.س)">SAR (ر.س) - Saudi Riyal</option>
                    <option value="SOS ($)">SOS / SLSH - Somali Shilling</option>
                    <option value="EUR (€)">EUR (€) - Euro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Default System Language</label>
                  <select
                    value={restaurant.defaultLanguage}
                    onChange={e => setRestaurant({ ...restaurant, defaultLanguage: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                  >
                    <option value="en">English (US/UK)</option>
                    <option value="ar">العربية (Arabic)</option>
                    <option value="so">Soomaali (Somali)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Working Hours</label>
                  <input
                    type="text"
                    value={restaurant.workingHours}
                    onChange={e => setRestaurant({ ...restaurant, workingHours: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                    placeholder="07:00 AM - 11:00 PM"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: CREATE FIRST BRANCH */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
                <Store className="w-5 h-5" />
                <span>Step 2: Setup First Headquarters Branch</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Branch Name</label>
                  <input
                    type="text"
                    value={branch.name}
                    onChange={e => setBranch({ ...branch, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Branch Code / SKU</label>
                  <input
                    type="text"
                    value={branch.code}
                    onChange={e => setBranch({ ...branch, code: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">City / Location</label>
                  <input
                    type="text"
                    value={branch.city}
                    onChange={e => setBranch({ ...branch, city: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Branch Manager Name</label>
                  <input
                    type="text"
                    value={branch.managerName}
                    onChange={e => setBranch({ ...branch, managerName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Seating Table Count</label>
                  <input
                    type="number"
                    value={branch.tableCount}
                    onChange={e => setBranch({ ...branch, tableCount: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="isPrimary"
                    checked={branch.isPrimary}
                    onChange={e => setBranch({ ...branch, isPrimary: e.target.checked })}
                    className="rounded border-slate-800 text-emerald-500 focus:ring-emerald-500"
                  />
                  <label htmlFor="isPrimary" className="text-xs font-bold text-slate-300">
                    Set as Primary Headquarters Flagship Branch
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: ADD ADMIN ACCOUNT */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
                <ShieldCheck className="w-5 h-5" />
                <span>Step 3: Add Master Admin Account Credentials</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Admin Full Name</label>
                  <input
                    type="text"
                    value={admin.name}
                    onChange={e => setAdmin({ ...admin, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Admin Email Address</label>
                  <input
                    type="email"
                    value={admin.email}
                    onChange={e => setAdmin({ ...admin, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Security PIN (4-Digits for POS Override)</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={admin.pin}
                    onChange={e => setAdmin({ ...admin, pin: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 outline-none font-mono tracking-widest text-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Role Type</label>
                  <select
                    value={admin.role}
                    onChange={e => setAdmin({ ...admin, role: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                  >
                    <option value="Admin">System Admin (Full Rights)</option>
                    <option value="Owner">Enterprise Owner</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: ADD EMPLOYEES */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
                  <Users className="w-5 h-5" />
                  <span>Step 4: Initial Staff & Employee Records ({employees.length})</span>
                </div>

                <button
                  onClick={() => setEmployees([...employees, { name: 'New Staff', role: 'Cashier', email: '', phone: '', salary: 400, shift: 'Morning Shift' }])}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Employee</span>
                </button>
              </div>

              <div className="space-y-2">
                {employees.map((emp, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 p-3 rounded-2xl grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Name"
                      value={emp.name}
                      onChange={e => {
                        const updated = [...employees];
                        updated[idx].name = e.target.value;
                        setEmployees(updated);
                      }}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />

                    <select
                      value={emp.role}
                      onChange={e => {
                        const updated = [...employees];
                        updated[idx].role = e.target.value;
                        setEmployees(updated);
                      }}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="Cashier">Cashier</option>
                      <option value="Head Chef">Head Chef</option>
                      <option value="Kitchen Staff">Kitchen Staff</option>
                      <option value="Waiter">Waiter</option>
                      <option value="Accountant">Accountant</option>
                      <option value="Delivery Driver">Delivery Driver</option>
                    </select>

                    <input
                      type="number"
                      placeholder="Salary $"
                      value={emp.salary}
                      onChange={e => {
                        const updated = [...employees];
                        updated[idx].salary = Number(e.target.value);
                        setEmployees(updated);
                      }}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />

                    <input
                      type="text"
                      placeholder="Shift"
                      value={emp.shift}
                      onChange={e => {
                        const updated = [...employees];
                        updated[idx].shift = e.target.value;
                        setEmployees(updated);
                      }}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />

                    <button
                      onClick={() => setEmployees(employees.filter((_, i) => i !== idx))}
                      className="p-1.5 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded-lg text-xs self-center justify-self-end flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 5: ADD SUPPLIERS */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
                  <Truck className="w-5 h-5" />
                  <span>Step 5: Food & Ingredient Suppliers ({suppliers.length})</span>
                </div>

                <button
                  onClick={() => setSuppliers([...suppliers, { name: 'New Supplier', contactName: '', phone: '', email: '', category: 'Produce' }])}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Supplier</span>
                </button>
              </div>

              <div className="space-y-2">
                {suppliers.map((sup, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 p-3 rounded-2xl grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Company Name"
                      value={sup.name}
                      onChange={e => {
                        const updated = [...suppliers];
                        updated[idx].name = e.target.value;
                        setSuppliers(updated);
                      }}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />

                    <input
                      type="text"
                      placeholder="Contact Person"
                      value={sup.contactName}
                      onChange={e => {
                        const updated = [...suppliers];
                        updated[idx].contactName = e.target.value;
                        setSuppliers(updated);
                      }}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />

                    <input
                      type="text"
                      placeholder="Category (e.g. Meat)"
                      value={sup.category}
                      onChange={e => {
                        const updated = [...suppliers];
                        updated[idx].category = e.target.value;
                        setSuppliers(updated);
                      }}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />

                    <button
                      onClick={() => setSuppliers(suppliers.filter((_, i) => i !== idx))}
                      className="p-1.5 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded-lg text-xs self-center justify-self-end flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 6: ADD INVENTORY ITEMS */}
          {currentStep === 6 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
                  <Boxes className="w-5 h-5" />
                  <span>Step 6: Raw Ingredients & Inventory Items ({inventory.length})</span>
                </div>

                <button
                  onClick={() => setInventory([...inventory, { name: 'New Ingredient', nameAr: '', nameSo: '', unit: 'kg', minAlertStock: 10, costPerUnit: 1.0, currentQuantity: 50, category: 'General' }])}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Item</span>
                </button>
              </div>

              <div className="space-y-2">
                {inventory.map((inv, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 p-3 rounded-2xl grid grid-cols-1 sm:grid-cols-6 gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Item Name"
                      value={inv.name}
                      onChange={e => {
                        const updated = [...inventory];
                        updated[idx].name = e.target.value;
                        setInventory(updated);
                      }}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />

                    <select
                      value={inv.unit}
                      onChange={e => {
                        const updated = [...inventory];
                        updated[idx].unit = e.target.value;
                        setInventory(updated);
                      }}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    >
                      <option value="kg">kg (Kilogram)</option>
                      <option value="g">g (Gram)</option>
                      <option value="liter">liter (Liter)</option>
                      <option value="ml">ml (Milliliter)</option>
                      <option value="piece">piece (Pcs)</option>
                      <option value="box">box (Box)</option>
                      <option value="carton">carton (Carton)</option>
                    </select>

                    <input
                      type="number"
                      placeholder="Cost $"
                      value={inv.costPerUnit}
                      onChange={e => {
                        const updated = [...inventory];
                        updated[idx].costPerUnit = Number(e.target.value);
                        setInventory(updated);
                      }}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />

                    <input
                      type="number"
                      placeholder="Opening Stock"
                      value={inv.currentQuantity}
                      onChange={e => {
                        const updated = [...inventory];
                        updated[idx].currentQuantity = Number(e.target.value);
                        setInventory(updated);
                      }}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />

                    <input
                      type="number"
                      placeholder="Min Alert"
                      value={inv.minAlertStock}
                      onChange={e => {
                        const updated = [...inventory];
                        updated[idx].minAlertStock = Number(e.target.value);
                        setInventory(updated);
                      }}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-rose-400"
                    />

                    <button
                      onClick={() => setInventory(inventory.filter((_, i) => i !== idx))}
                      className="p-1.5 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded-lg text-xs self-center justify-self-end flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 7: CREATE RECIPES */}
          {currentStep === 7 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
                  <ChefHat className="w-5 h-5" />
                  <span>Step 7: Automated Recipe & Ingredient Linkages</span>
                </div>
              </div>

              <div className="space-y-3">
                {recipes.map((rec, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 p-4 rounded-2xl space-y-2">
                    <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                      <UtensilsCrossed className="w-4 h-4" />
                      {rec.productName}
                    </h4>

                    <div className="space-y-1 pl-4 border-l-2 border-emerald-500/20">
                      {rec.ingredients.map((ing, iIdx) => (
                        <div key={iIdx} className="text-xs text-slate-300 flex items-center gap-2">
                          <span>• {ing.ingredientName}:</span>
                          <span className="font-mono text-emerald-400">{ing.quantityRequired} {ing.unit}</span>
                          <span className="text-slate-500">per portion</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 8: ADD PRODUCTS */}
          {currentStep === 8 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
                  <UtensilsCrossed className="w-5 h-5" />
                  <span>Step 8: Menu Dish Catalog ({products.length})</span>
                </div>

                <button
                  onClick={() => setProducts([...products, { name: 'New Dish', nameAr: '', nameSo: '', category: 'Main Course', price: 10.0, cost: 3.0, imageUrl: '', prepTimeMinutes: 15 }])}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Product</span>
                </button>
              </div>

              <div className="space-y-2">
                {products.map((prod, idx) => (
                  <div key={idx} className="bg-slate-950 border border-slate-800 p-3 rounded-2xl grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Dish Name"
                      value={prod.name}
                      onChange={e => {
                        const updated = [...products];
                        updated[idx].name = e.target.value;
                        setProducts(updated);
                      }}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />

                    <input
                      type="text"
                      placeholder="Category"
                      value={prod.category}
                      onChange={e => {
                        const updated = [...products];
                        updated[idx].category = e.target.value;
                        setProducts(updated);
                      }}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />

                    <input
                      type="number"
                      placeholder="Price $"
                      value={prod.price}
                      onChange={e => {
                        const updated = [...products];
                        updated[idx].price = Number(e.target.value);
                        setProducts(updated);
                      }}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono text-emerald-400"
                    />

                    <input
                      type="number"
                      placeholder="Cost $"
                      value={prod.cost}
                      onChange={e => {
                        const updated = [...products];
                        updated[idx].cost = Number(e.target.value);
                        setProducts(updated);
                      }}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                    />

                    <button
                      onClick={() => setProducts(products.filter((_, i) => i !== idx))}
                      className="p-1.5 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded-lg text-xs self-center justify-self-end flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 9: CONFIGURE TAXES */}
          {currentStep === 9 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
                <Percent className="w-5 h-5" />
                <span>Step 9: Tax Rules & Regional Compliance Configuration</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Tax Label / Title</label>
                  <input
                    type="text"
                    value={tax.taxName}
                    onChange={e => setTax({ ...tax, taxName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Standard Tax Rate (%)</label>
                  <input
                    type="number"
                    step={0.5}
                    value={tax.taxRate}
                    onChange={e => setTax({ ...tax, taxRate: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 outline-none font-mono text-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Service Charge Rate (%)</label>
                  <input
                    type="number"
                    step={0.5}
                    value={tax.serviceCharge}
                    onChange={e => setTax({ ...tax, serviceCharge: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 outline-none font-mono text-teal-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Discount Policy Settings</label>
                  <input
                    type="text"
                    value={tax.discountSettings}
                    onChange={e => setTax({ ...tax, discountSettings: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Tax Registration Number (TRN)</label>
                  <input
                    type="text"
                    value={tax.trnNumber}
                    onChange={e => setTax({ ...tax, trnNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="taxInclusive"
                    checked={tax.isInclusive}
                    onChange={e => setTax({ ...tax, isInclusive: e.target.checked })}
                    className="rounded border-slate-800 text-emerald-500 focus:ring-emerald-500"
                  />
                  <label htmlFor="taxInclusive" className="text-xs font-bold text-slate-300">
                    Product Selling Prices Are Tax Inclusive
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 10: CONFIGURE PAYMENT METHODS */}
          {currentStep === 10 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
                <CreditCard className="w-5 h-5" />
                <span>Step 10: Payment Gateways & Cashier Terminal Rules</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Cash Register</span>
                  <input
                    type="checkbox"
                    checked={payments.cashEnabled}
                    onChange={e => setPayments({ ...payments, cashEnabled: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-500"
                  />
                </div>

                <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Credit / Debit Card</span>
                  <input
                    type="checkbox"
                    checked={payments.cardEnabled}
                    onChange={e => setPayments({ ...payments, cardEnabled: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-500"
                  />
                </div>

                <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400">EVC Plus (Hormuud)</span>
                  <input
                    type="checkbox"
                    checked={payments.evcPlusEnabled}
                    onChange={e => setPayments({ ...payments, evcPlusEnabled: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-500"
                  />
                </div>

                <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400">ZAAD Services (Telesom)</span>
                  <input
                    type="checkbox"
                    checked={payments.zaadEnabled}
                    onChange={e => setPayments({ ...payments, zaadEnabled: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-500"
                  />
                </div>

                <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400">Sahal (Golis)</span>
                  <input
                    type="checkbox"
                    checked={payments.sahalEnabled}
                    onChange={e => setPayments({ ...payments, sahalEnabled: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-500"
                  />
                </div>

                <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400">eDahab (Somtel)</span>
                  <input
                    type="checkbox"
                    checked={payments.eDahabEnabled}
                    onChange={e => setPayments({ ...payments, eDahabEnabled: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-500"
                  />
                </div>

                <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-400">PayPal Gateway</span>
                  <input
                    type="checkbox"
                    checked={payments.paypalEnabled}
                    onChange={e => setPayments({ ...payments, paypalEnabled: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-500"
                  />
                </div>

                <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Bank Wire Transfer</span>
                  <input
                    type="checkbox"
                    checked={payments.bankTransferEnabled}
                    onChange={e => setPayments({ ...payments, bankTransferEnabled: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-500"
                  />
                </div>

                <div className="col-span-1 md:col-span-2 lg:col-span-3 mt-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1">Mobile Money Merchant ID / Shortcode</label>
                  <input
                    type="text"
                    value={payments.merchantId}
                    onChange={e => setPayments({ ...payments, merchantId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:border-emerald-500 outline-none font-mono text-emerald-400"
                  />
                </div>
              </div>
            </div>
          )}
          </>
          )}
        </div>

        {/* Footer Navigation Actions */}
        {!showSummaryScreen && (
          <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
            <button
              onClick={handleBack}
              disabled={currentStep === 1}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                currentStep === 1
                  ? 'opacity-40 cursor-not-allowed text-slate-500 bg-slate-900'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous Step</span>
            </button>

            <div className="flex items-center gap-2">
              {currentStep < 10 ? (
                <button
                  onClick={handleNext}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition cursor-pointer"
                >
                  <span>Next Step ({currentStep + 1}/10)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleSaveAll}
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-2 shadow-xl shadow-emerald-500/20 hover:scale-105 active:scale-95 transition cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Setup Data...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Complete & Launch ERP System</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
