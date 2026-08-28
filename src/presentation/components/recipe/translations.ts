export type RecipeLang = 'en' | 'ar' | 'so';

export const recipeDict = {
  en: {
    title: 'Recipe & Ingredient Engine',
    subtitle: 'Phase 16 • Food Costing, Unit Conversion & Auto Inventory Deduction',
    tabs: {
      recipes: 'Recipe Builder',
      ingredients: 'Ingredient Manager',
      costCalculator: 'Cost Calculator',
      stockCount: 'Inventory Count',
      waste: 'Waste Dashboard',
      consumption: 'Consumption Analytics',
      forecasting: 'Forecasting & Reorder',
      conversions: 'Unit Conversions'
    },
    common: {
      search: 'Search...',
      add: 'Add New',
      edit: 'Edit',
      delete: 'Delete',
      save: 'Save',
      cancel: 'Cancel',
      actions: 'Actions',
      status: 'Status',
      version: 'Version',
      versionHistory: 'Version History',
      date: 'Date',
      notes: 'Notes',
      totalCost: 'Total Cost',
      sellingPrice: 'Selling Price',
      foodCostPct: 'Food Cost %',
      grossProfit: 'Gross Profit',
      netProfit: 'Net Profit',
      yield: 'Yield (Portions)',
      unit: 'Unit',
      quantity: 'Quantity',
      costPerUnit: 'Cost / Unit',
      category: 'Category',
      supplier: 'Supplier',
      location: 'Location',
      expiry: 'Expiry Date',
      batch: 'Batch #',
      confirmDelete: 'Are you sure you want to delete this record?'
    },
    recipes: {
      createTitle: 'Create New Recipe',
      editTitle: 'Edit Recipe',
      recipeName: 'Recipe Name',
      linkedProduct: 'Linked Menu Product',
      ingredientsList: 'Ingredients List',
      addIngredient: 'Add Ingredient to Recipe',
      costSummary: 'Recipe Financial Summary',
      idealFoodCostNote: 'Target Food Cost % is typically 28% - 35% for maximum profitability.',
      historyModalTitle: 'Recipe Version History'
    },
    ingredients: {
      createTitle: 'Create New Ingredient',
      editTitle: 'Edit Ingredient',
      code: 'Ingredient Code',
      name: 'Ingredient Name',
      purchaseUnit: 'Purchase Unit',
      usageUnit: 'Usage Unit',
      conversionFactor: 'Conversion Factor',
      conversionHelp: 'e.g. 1 Purchase Unit (Box) = 24 Usage Units (Pieces), or 1 kg = 1000 g',
      purchaseCost: 'Purchase Price',
      costPerUsageUnit: 'Cost per Usage Unit',
      stockLevel: 'Stock in Usage Units',
      minAlert: 'Low Stock Alert Level',
      mealsRemaining: 'Meals Remaining',
      costPerMeal: 'Cost per Meal'
    },
    calculator: {
      title: 'What-If Scenario Cost & Profit Margin Analysis',
      subtitle: 'Analyze potential ingredient inflation and selling price variations based on authoritative recipe data',
      scenarioPrice: 'What-If Selling Price',
      scenarioCost: 'Scenario Ingredient Cost',
      profitMargin: 'Profit Margin'
    },
    stockCount: {
      title: 'Physical Stock Count',
      newCount: 'New Stock Count',
      countNumber: 'Count #',
      expectedQty: 'Expected Stock',
      actualQty: 'Actual Physical Count',
      difference: 'Difference',
      lossValue: 'Discrepancy / Loss Value',
      applyAdjustment: 'Apply Inventory Adjustment',
      adjustedSuccess: 'Stock count adjustment applied to inventory successfully!'
    },
    waste: {
      title: 'Waste & Loss Tracker',
      recordWaste: 'Record Ingredient Waste',
      reason: 'Waste Reason',
      reasons: {
        expired: 'Expired',
        spoiled: 'Spoiled / Damaged',
        cooking_loss: 'Cooking Loss',
        preparation_waste: 'Preparation Waste',
        damage: 'Handling Damage',
        unknown: 'Unknown Loss'
      },
      wasteCost: 'Total Waste Value',
      wastePct: 'Waste % of Inventory'
    },
    consumption: {
      title: 'Ingredient Consumption Analytics',
      avgDaily: 'Avg Daily Usage',
      avgMonthly: 'Avg Monthly Usage',
      fastMoving: 'Fast Moving',
      slowMoving: 'Slow Moving',
      moderate: 'Moderate Usage'
    },
    forecasting: {
      title: 'Stock Forecasting & Smart Reorder',
      daysRemaining: 'Days Remaining',
      suggestedReorder: 'Suggested Reorder Quantity',
      expected30Days: '30-Day Expected Usage',
      recommendation: 'Purchase Recommendation'
    },
    conversions: {
      title: 'Unit Conversion Manager',
      addConversion: 'Add Custom Conversion Rule',
      fromUnit: 'From Unit',
      toUnit: 'To Unit',
      factor: 'Conversion Factor',
      example: 'e.g., 1 Box = 24 Pieces'
    }
  },
  ar: {
    title: 'محرك الوصفات والمكونات',
    subtitle: 'المرحلة 16 • تكلفة الأغذية، تحويل الوحدات والخصم الآلي للمخزون',
    tabs: {
      recipes: 'منشئ الوصفات',
      ingredients: 'إدارة المكونات',
      costCalculator: 'حاسبة التكاليف',
      stockCount: 'الجرد الفعلي',
      waste: 'لوحة الهدر',
      consumption: 'تحليلات الاستهلاك',
      forecasting: 'التنبؤ وإعادة الطلب',
      conversions: 'تحويل الوحدات'
    },
    common: {
      search: 'بحث...',
      add: 'إضافة جديد',
      edit: 'تعديل',
      delete: 'حذف',
      save: 'حفظ',
      cancel: 'إلغاء',
      actions: 'إجراءات',
      status: 'الحالة',
      version: 'النسخة',
      versionHistory: 'سجل النسخ',
      date: 'التاريخ',
      notes: 'ملاحظات',
      totalCost: 'التكلفة الإجمالية',
      sellingPrice: 'سعر البيع',
      foodCostPct: 'نسبة تكلفة الطعام %',
      grossProfit: 'إجمالي الربح',
      netProfit: 'صافي الربح',
      yield: 'الكمية المنتجة (وجبات)',
      unit: 'الوحدة',
      quantity: 'الكمية',
      costPerUnit: 'التكلفة / وحدة',
      category: 'الفئة',
      supplier: 'المورد',
      location: 'الموقع',
      expiry: 'تاريخ الانتهاء',
      batch: 'رقم الشحنة #',
      confirmDelete: 'هل أنت تأكد من حذف هذا السجل؟'
    },
    recipes: {
      createTitle: 'إنشاء وصفة جديدة',
      editTitle: 'تعديل الوصفة',
      recipeName: 'اسم الوصفة',
      linkedProduct: 'المنتج المرتبط بالمنيو',
      ingredientsList: 'قائمة المكونات',
      addIngredient: 'إضافة مكون للوصفة',
      costSummary: 'الملخص المالي للوصفة',
      idealFoodCostNote: 'نسبة تكلفة الطعام المثالية تتراوح بين 28% - 35% لأعلى ربحية.',
      historyModalTitle: 'سجل نسخ الوصفة'
    },
    ingredients: {
      createTitle: 'إنشاء مكون جديد',
      editTitle: 'تعديل المكون',
      code: 'رمز المكون',
      name: 'اسم المكون',
      purchaseUnit: 'وحدة الشراء',
      usageUnit: 'وحدة الاستخدام',
      conversionFactor: 'معامل التحويل',
      conversionHelp: 'مثال: 1 وحدة شراء (صندوق) = 24 وحدة استخدام (قطعة)، أو 1 كجم = 1000 جرام',
      purchaseCost: 'سعر الشراء',
      costPerUsageUnit: 'تكلفة وحدة الاستخدام',
      stockLevel: 'المخزون بوحدات الاستخدام',
      minAlert: 'حد التنبيه بانخفاض المخزون',
      mealsRemaining: 'الوجبات المتبقية',
      costPerMeal: 'التكلفة لكل وجبة'
    },
    calculator: {
      title: 'تحليل سيناريو التكاليف وهامش الربح الافتراضي',
      subtitle: 'تحليل أثر تغيرات أسعار الشراء والبيع على نسبة تكلفة الطعام وهامش الربح بناءً على البيانات الحقيقية',
      scenarioPrice: 'سعر البيع الافتراضي (What-If)',
      scenarioCost: 'تكلفة المكونات في السيناريو',
      profitMargin: 'هامش الربح'
    },
    stockCount: {
      title: 'الجرد المخزني الفعلي',
      newCount: 'جرد مخزني جديد',
      countNumber: 'رقم الجرد #',
      expectedQty: 'المخزون المتوقع',
      actualQty: 'العدد الفعلي والجرد',
      difference: 'الفرق',
      lossValue: 'قيمة العجز / الخسارة',
      applyAdjustment: 'تطبيق تسوية المخزون',
      adjustedSuccess: 'تم تطبيق تسوية الجرد الفعلي للمخزون بنجاح!'
    },
    waste: {
      title: 'متابع الهدر والتلف',
      recordWaste: 'تسجيل هدر المكونات',
      reason: 'سبب الهدر',
      reasons: {
        expired: 'منتهي الصلاحية',
        spoiled: 'تالف / فاسد',
        cooking_loss: 'خسارة أثناء الطهي',
        preparation_waste: 'هدر أثناء التحضير',
        damage: 'أضرار النقل والتحميل',
        unknown: 'خسارة غير معروفة'
      },
      wasteCost: 'إجمالي قيمة الهدر',
      wastePct: 'نسبة الهدر من المخزون'
    },
    consumption: {
      title: 'تحليلات استهلاك المكونات',
      avgDaily: 'متوسط الاستهلاك اليومي',
      avgMonthly: 'متوسط الاستهلاك الشهري',
      fastMoving: 'سريع الحركة',
      slowMoving: 'بطيء الحركة',
      moderate: 'متوسط الحركة'
    },
    forecasting: {
      title: 'التنبؤ بالمخزون وإعادة الطلب الذكي',
      daysRemaining: 'الأيام المتبقية',
      suggestedReorder: 'كمية إعادة الطلب المقترحة',
      expected30Days: 'الاستهلاك المتوقع لـ 30 يوماً',
      recommendation: 'توصية الشراء'
    },
    conversions: {
      title: 'مدير تحويل الوحدات',
      addConversion: 'إضافة قاعدة تحويل مخصصة',
      fromUnit: 'من وحدة',
      toUnit: 'إلى وحدة',
      factor: 'معامل التحويل',
      example: 'مثال: 1 صندوق = 24 قطعة'
    }
  },
  so: {
    title: 'Mishiinka Cunto-kariyaha & Walxaha',
    subtitle: 'Wajiga 16 • Qiimaynta Cuntada, Beddelidda Halbeegyada & Jarista Otomaatiga ah',
    tabs: {
      recipes: 'Dhisaha Cunno-fariinta',
      ingredients: 'Maamulaha Walxaha',
      costCalculator: 'Xisaabiyaha Qiimaha',
      stockCount: 'Tirinta Kaydka',
      waste: 'Maamulka Qasaaraha',
      consumption: 'Falanqaynta Isticmaalka',
      forecasting: 'Sadaalinta & Dalabka',
      conversions: 'Beddelka Halbeegyada'
    },
    common: {
      search: 'Raadi...',
      add: 'Kudhar Cusub',
      edit: 'Wax ka baddal',
      delete: 'Tirtir',
      save: 'Kelimad Kaydi',
      cancel: 'Jooji',
      actions: 'Fallada',
      status: 'Xaaladda',
      version: 'Nooca',
      versionHistory: 'Taariikhda Noocyada',
      date: 'Taariikhda',
      notes: 'Xusuusin',
      totalCost: 'Qiimaha Wadarta',
      sellingPrice: 'Qiimaha Iibka',
      foodCostPct: 'Boqolkiiba Qiimaha Cuntada %',
      grossProfit: 'Faa\'iidada Guud',
      netProfit: 'Faa\'iidada Saafi ah',
      yield: 'Saaridda (Cuntooyinka)',
      unit: 'Halbeegga',
      quantity: 'Xaddiga',
      costPerUnit: 'Qiimaha / Halbeeg',
      category: 'Qaybta',
      supplier: 'Alaab-qabaha',
      location: 'Goobta',
      expiry: 'Waqtiga Dhicitaanka',
      batch: 'Batch #',
      confirmDelete: 'Ma sigiir baad u leedahay in aad tirtirto diwaankan?'
    },
    recipes: {
      createTitle: 'Samayso Cunno-fariin Cusub',
      editTitle: 'Wax ka baddal Cunno-fariinta',
      recipeName: 'Magaca Cunno-fariinta',
      linkedProduct: 'Alaabta Cuntada ku xiran',
      ingredientsList: 'Liska Walxaha',
      addIngredient: 'Kudhar Wax ka tirsan Cunno-fariinta',
      costSummary: 'Koobidda Dhaqaalaha Cunno-fariinta',
      idealFoodCostNote: 'Ujeeddada boqolkiiba qiimaha cuntadu waa 28% - 35% si faa\'iido sare loo helo.',
      historyModalTitle: 'Taariikhda Noocyada Cunno-fariinta'
    },
    ingredients: {
      createTitle: 'Abuur Wax Cusub',
      editTitle: 'Wax ka baddal Waxa',
      code: 'Koodhka Waxa',
      name: 'Magaca Waxa',
      purchaseUnit: 'Halbeegga Ilaab-soogadashada',
      usageUnit: 'Halbeegga Isticmaalka',
      conversionFactor: 'Baddalida Isku-dhuftaha',
      conversionHelp: 'Tusaale: 1 Box = 24 Pieces, ama 1 kg = 1000 g',
      purchaseCost: 'Qiimaha Lagusoo gatay',
      costPerUsageUnit: 'Qiimaha Halbeegga Isticmaalka',
      stockLevel: 'Kaydka Halbeegyada Isticmaalka',
      minAlert: 'Xadka Barta Digniinta',
      mealsRemaining: 'Cuntooyinka Dhiman',
      costPerMeal: 'Qiimaha halkii Cunto'
    },
    calculator: {
      title: 'Falanqaynta Xaaladda Qiimaha & Faa\'iidada Cuntada',
      subtitle: 'Falanqaynta isbaddalka qiimaha suurtagalka ah ee ku salaysan xogta rasmiga ah',
      scenarioPrice: 'Qiimaha Iibka ee Tijaabada (What-If)',
      scenarioCost: 'Qiimaha Walxaha ee Tijaabada',
      profitMargin: 'Mugga Faa\'iidada'
    },
    stockCount: {
      title: 'Tirinta Rasmiga ah ee Kaydka',
      newCount: 'Tirin Cusub',
      countNumber: 'Tirada #',
      expectedQty: 'Kaydka Filanayay',
      actualQty: 'Tirada Rasmiga ah',
      difference: 'Farqiga',
      lossValue: 'Qasaaraha Dhiman',
      applyAdjustment: 'Dhaqangelin Wax ka baddalka Kaydka',
      adjustedSuccess: 'Wax ka baddalki kaydka si guul leh ayaa loo dhaqangaliyay!'
    },
    waste: {
      title: 'Daba-galka Qasaaraha',
      recordWaste: 'Qor Qasaaraha Walxaha',
      reason: 'Sababta Qasaaraha',
      reasons: {
        expired: 'Waqtigii Dhabay',
        spoiled: 'Haras / Qasaaray',
        cooking_loss: 'Khasaraha Karinta',
        preparation_waste: 'Khasaraha Diyaarinta',
        damage: 'Khasaraha Qaadista',
        unknown: 'Khasaro aan la aqoon'
      },
      wasteCost: 'Qiimaha Wadarta Qasaaraha',
      wastePct: 'Boqolkiiba Qasaaraha Kaydka'
    },
    consumption: {
      title: 'Falanqaynta Isticmaalka Walxaha',
      avgDaily: 'Celceliska Maalinta',
      avgMonthly: 'Celceliska Bisha',
      fastMoving: 'Xawaaraha Sare',
      slowMoving: 'Xawaaraha Hoose',
      moderate: 'Xawaaraha Dhexe'
    },
    forecasting: {
      title: 'Sadaalinta Kaydka & Re-order',
      daysRemaining: 'Maalmaha Dhiman',
      suggestedReorder: 'Xaddiga Dalabka ee La Tagaasay',
      expected30Days: 'Isticmaalka 30-ka Maalmood',
      recommendation: 'Talo-bixinta Ilaab-soogadashada'
    },
    conversions: {
      title: 'Maamulaha Beddelka Halbeegyada',
      addConversion: 'Kudhar Shuruud Cusub',
      fromUnit: 'Kutag Halbeegga',
      toUnit: 'Ugu tag Halbeegga',
      factor: 'Factor-ka Beddelka',
      example: 'Tusaale: 1 Box = 24 Pieces'
    }
  }
};
