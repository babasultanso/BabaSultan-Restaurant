import { Language } from '../types';

export function detectLanguage(text: string): 'ar' | 'so' | 'en' {
  if (!text || text.trim().length === 0) return 'en';
  
  // Arabic character detection (Unicode range \u0600-\u06FF)
  const arabicPattern = /[\u0600-\u06FF]/;
  if (arabicPattern.test(text)) {
    return 'ar';
  }

  // Common Somali keywords
  const somaliWords = [
    'maanta', 'sabti', 'axad', 'isniin', 'talaado', 'arbaa', 'khamiis', 'jimco',
    'imisa', 'faaiido', 'faa\'iido', 'kharash', 'qaali', 'alaab', 'shaqaale',
    'dalab', 'bixiyay', 'sahay', 'hilib', 'bariis', 'baasto', 'shaah', 'soomaali',
    'liiska', 'warbixin', 'dakhli', 'dhimis', 'dalbado', 'kayd', 'suuq'
  ];
  
  const lower = (text || '').toLowerCase();
  const matchedSomaliWord = somaliWords.some(word => lower.includes(word));
  if (matchedSomaliWord) {
    return 'so';
  }

  return 'en';
}

export const translations = {
  en: {
    appName: "Restaurant AI Business Assistant",
    tagline: "ERP & Intelligent Financial Advisor",
    dashboard: "Dashboard",
    orders: "Orders & Sales",
    inventory: "Inventory & Kitchen",
    financials: "Financials & Expenses",
    staffAndSuppliers: "Staff & Suppliers",
    reports: "Reports & Export",
    aiAssistant: "AI Business Assistant",
    askAI: "Ask AI Manager...",
    todayProfit: "Today's Net Profit",
    todayOrders: "Today's Orders",
    todayExpenses: "Today's Expenses",
    lowStockAlerts: "Low Stock Alerts",
    overduePayments: "Overdue Payments",
    topProduct: "Top Selling Product",
    quickPrompts: "Quick AI Queries",
    profitToday: "How much profit did I make today?",
    completedOrdersToday: "How many orders were completed today?",
    todayExpensesQuery: "What are today's expenses?",
    topProductsQuery: "Which products sell the most?",
    lowIngredientsQuery: "Which ingredients are running low?",
    topEmployeeQuery: "Which employee has the highest sales?",
    supplierReorderQuery: "Which supplier should I reorder from?",
    financialReportQuery: "Show me today's financial report.",
    monthProfitQuery: "Show this month's profit.",
    predictSalesQuery: "Predict next week's sales.",
    detectAbnormalExpenses: "Detect abnormal expenses.",
    suggestIncreaseProfit: "Suggest ways to increase profit.",
    suggestReduceCosts: "Suggest ways to reduce costs.",
    actions: {
      addExpense: "Add Expense",
      registerPurchase: "Register Purchase",
      registerSalary: "Register Salary",
      recordMovement: "Record Inventory Movement",
      updateStock: "Update Product Stock",
      generateInvoice: "Generate Invoice",
      exportExcel: "Export Excel",
      downloadPDF: "Download PDF Report"
    }
  },
  ar: {
    appName: "مساعد إدارة المطعم بالذكاء الاصطناعي",
    tagline: "نظام إدارة موارد المطاعم والاستشارات المالية",
    dashboard: "لوحة التحكم",
    orders: "الطلبات والمبيعات",
    inventory: "المخزون والمطبخ",
    financials: "المالية والمصروفات",
    staffAndSuppliers: "الموظفون والموردون",
    reports: "التقارير والتصدير",
    aiAssistant: "المساعد التجاري الذكي",
    askAI: "اسأل المدير الذكي...",
    todayProfit: "صافي أرباح اليوم",
    todayOrders: "طلبات اليوم المكتملة",
    todayExpenses: "مصروفات اليوم",
    lowStockAlerts: "تنبيهات انخفاض المخزون",
    overduePayments: "مدفوعات مستحقة متأخرة",
    topProduct: "المنتج الأكثر مبيعاً",
    quickPrompts: "أسئلة سريعة للمساعد الذكي",
    profitToday: "كم بلغت أرباحي اليوم؟",
    completedOrdersToday: "كم عدد الطلبات المكتملة اليوم؟",
    todayExpensesQuery: "ما هي مصروفات اليوم؟",
    topProductsQuery: "ما هي المنتجات الأكثر مبيعاً؟",
    lowIngredientsQuery: "ما هي المكونات المنخفضة في المخزون؟",
    topEmployeeQuery: "من هو الموظف الأكثر تحقيقاً للمبيعات؟",
    supplierReorderQuery: "من أي مورد يجب أن أعيد الطلب؟",
    financialReportQuery: "اعرض لي التقرير المالي لليوم.",
    monthProfitQuery: "اعرض لي أرباح هذا الشهر.",
    predictSalesQuery: "توقع مبيعات الأسبوع القادم.",
    detectAbnormalExpenses: "اكتشف المصروفات غير الطبيعية.",
    suggestIncreaseProfit: "اقترح طرقاً لزيادة الأرباح.",
    suggestReduceCosts: "اقترح طرقاً لتقليل التكاليف.",
    actions: {
      addExpense: "إضافة مصروف",
      registerPurchase: "تسجيل شراء",
      registerSalary: "تسجيل راتب",
      recordMovement: "تسجيل حركة مخزون",
      updateStock: "تحديث مخزون المنتج",
      generateInvoice: "إنشاء فاتورة",
      exportExcel: "تصدير إلى إكسل",
      downloadPDF: "تحميل تقرير PDF"
    }
  },
  so: {
    appName: "Kaaliyaha Ganacsiga AI ee Maqaayadda",
    tagline: "Nidaamka ERP iyo La-taliyaha Maaliyadda AI",
    dashboard: "Hagaha Guud (Dashboard)",
    orders: "Dalabsiga & Mideynta Sales",
    inventory: "Kaydka & Jikada",
    financials: "Maaliyadda & Kharashyada",
    staffAndSuppliers: "Shaqaalaha & Ganacsatada Sahayda",
    reports: "Warbixinada & Dhoofinta",
    aiAssistant: "Menejerka AI Ganacsiga",
    askAI: "Waydiiso AI Menejerka...",
    todayProfit: "Faaiidada Safiga ah ee Maanta",
    todayOrders: "Dalabyada Maanta Dhameystirmay",
    todayExpenses: "Kharashyada Maanta",
    lowStockAlerts: "Digniinta Alaabta Go'aysa",
    overduePayments: "Bixinnada Daahay ee Sahayda",
    topProduct: "Cuntada Ugu Iibka Badan",
    quickPrompts: "Su'aalaha Degdegga ah ee AI",
    profitToday: "Imisa faa'iido ah ayaan sameeyay maanta?",
    completedOrdersToday: "Imisa dalab ayaa maanta dhameystirmay?",
    todayExpensesQuery: "Maxay yihiin kharashyada maanta?",
    topProductsQuery: "Waa kuwee cuntooyinka ugu iibka badan?",
    lowIngredientsQuery: "Waa kuwee agabka jikada ee gabaabsiga ah?",
    topEmployeeQuery: "Kee shaqaale ah ayaa ugu iib badan?",
    supplierReorderQuery: "Kee ganacsade sahay ah ayaa oo aan ka dalbadaa alaabta?",
    financialReportQuery: "I tus warbixinta maaliyadeed ee maanta.",
    monthProfitQuery: "I tus faa'iidada bishan.",
    predictSalesQuery: "U saadaali iibka toddobaadka soo socda.",
    detectAbnormalExpenses: "Ogaaw kharashyada aan caadiga ahayn.",
    suggestIncreaseProfit: "Bixi soo-jeedino lagu kordhinayo faa'iidada.",
    suggestReduceCosts: "Bixi soo-jeedino lagu dhimayo kharashyada.",
    actions: {
      addExpense: "Kudar Kharash",
      registerPurchase: "Dangal Rasiidka Sahayda",
      registerSalary: "Dangal Mushaharka Shaqaalaha",
      recordMovement: "Dangal Dhaqdhaqaaqa Kaydka",
      updateStock: "Cusbooneysii Kaydka Cuntada",
      generateInvoice: "Joorali/Invois Samee",
      exportExcel: "Dhoofi Excel Sheet",
      downloadPDF: "Dhoofi Warbixinta PDF"
    }
  }
};
