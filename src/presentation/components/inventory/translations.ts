export type InventoryLang = 'en' | 'ar' | 'so';

export const inventoryDict = {
  en: {
    inventoryTitle: 'Inventory & Stock Management',
    inventorySubtitle: 'Raw materials, finished goods, stock movements, purchasing & suppliers',
    dashboardTab: 'Overview Dashboard',
    inventoryListTab: 'Inventory Catalog',
    stockMovementTab: 'Stock Movements',
    purchaseOrdersTab: 'Purchasing & POs',
    goodsReceivingTab: 'Goods Receiving',
    suppliersTab: 'Suppliers Directory',
    reportsTab: 'Inventory Reports',

    // Overview Cards
    totalItems: 'Total Items',
    stockValuation: 'Stock Valuation',
    lowStockAlerts: 'Low Stock Alerts',
    outOfStockCount: 'Out of Stock',
    expiredItemsCount: 'Expired Items',
    pendingPOs: 'Pending POs',
    totalSuppliers: 'Total Suppliers',
    outstandingPayables: 'Outstanding Payables',

    // Quick Actions
    quickStockIn: 'Quick Stock In',
    quickStockOut: 'Quick Stock Out',
    quickAdjustment: 'Stock Adjustment',
    quickTransfer: 'Stock Transfer',
    addNewItem: 'Add Inventory Item',
    createPO: 'New Purchase Order',
    addSupplier: 'Add Supplier',

    // Item Fields
    itemName: 'Item Name',
    itemCode: 'Item Code',
    barcode: 'Barcode',
    category: 'Category',
    unit: 'Unit',
    purchaseCost: 'Purchase Cost ($)',
    sellingCost: 'Selling Cost ($)',
    currentQuantity: 'Current Quantity',
    minimumQuantity: 'Min Quantity',
    maximumQuantity: 'Max Quantity',
    reorderLevel: 'Reorder Level',
    storageLocation: 'Storage Location',
    supplier: 'Supplier',
    expirationDate: 'Expiration Date',
    batchNumber: 'Batch Number',
    status: 'Status',
    actions: 'Actions',

    // Categories
    catRawMaterials: 'Raw Materials',
    catFinishedProducts: 'Finished Products',
    catPackagingMaterials: 'Packaging Materials',
    catBeverages: 'Beverages',
    catCleaningSupplies: 'Cleaning Supplies',

    // Statuses
    statusInStock: 'In Stock',
    statusLowStock: 'Low Stock',
    statusOutOfStock: 'Out of Stock',
    statusExpired: 'Expired',
    statusOverstock: 'Overstock',

    // Movement Types
    moveStockIn: 'Stock In',
    moveStockOut: 'Stock Out',
    moveAdjustment: 'Adjustment',
    moveTransfer: 'Transfer',
    moveWaste: 'Waste',
    moveExpired: 'Expired Disposal',
    moveCount: 'Cycle Count',

    // Purchase Order Statuses
    poDraft: 'Draft',
    poPendingApproval: 'Pending Approval',
    poApproved: 'Approved',
    poOrdered: 'Ordered',
    poPartiallyReceived: 'Partially Received',
    poReceived: 'Completed',
    poCancelled: 'Cancelled',

    // Dialogs & Forms
    saveItem: 'Save Item',
    cancel: 'Cancel',
    approvePO: 'Approve PO',
    receiveItems: 'Receive Selected Items',
    recordPayment: 'Record Supplier Payment',
    exportPdf: 'Export PDF',
    exportExcel: 'Export Excel (CSV)',
    searchPlaceholder: 'Search by item name, code, barcode...',
    filterCategory: 'All Categories',
    filterStatus: 'All Statuses',

    // Alerts Banner
    alertsHeader: 'Critical Inventory Alerts',
    noAlerts: 'All inventory levels normal. No critical alerts detected.',
    dismissAlert: 'Dismiss'
  },
  ar: {
    inventoryTitle: 'إدارة المخزون والتوريدات',
    inventorySubtitle: 'المواد الخام، المنتجات المصنعة، حركة المخزون، المشتريات والموردين',
    dashboardTab: 'لوحة التحكم',
    inventoryListTab: 'دليل المخزون',
    stockMovementTab: 'حركة المخزون',
    purchaseOrdersTab: 'أوامر الشراء',
    goodsReceivingTab: 'استلام البضائع',
    suppliersTab: 'دليل الموردين',
    reportsTab: 'تقارير المخزون',

    // Overview Cards
    totalItems: 'إجمالي الأصناف',
    stockValuation: 'تقييم المخزون',
    lowStockAlerts: 'تنبيهات انخفاض المخزون',
    outOfStockCount: 'الأصناف المنتهية',
    expiredItemsCount: 'الأصناف المنتهية الصلاحية',
    pendingPOs: 'طلبات الشراء المعلقة',
    totalSuppliers: 'إجمالي الموردين',
    outstandingPayables: 'المستحقات للموردين',

    // Quick Actions
    quickStockIn: 'إدخال مخزون',
    quickStockOut: 'إخراج مخزون',
    quickAdjustment: 'تسوية مخزون',
    quickTransfer: 'نقل مخزون',
    addNewItem: 'إضافة صنف جديد',
    createPO: 'أمر شراء جديد',
    addSupplier: 'إضافة مورد',

    // Item Fields
    itemName: 'اسم الصنف',
    itemCode: 'رمز الصنف',
    barcode: 'الباركود',
    category: 'الفئة',
    unit: 'وحدة القياس',
    purchaseCost: 'تكلفة الشراء ($)',
    sellingCost: 'سعر البيع ($)',
    currentQuantity: 'الكمية الحالية',
    minimumQuantity: 'الحد الأدنى',
    maximumQuantity: 'الحد الأقصى',
    reorderLevel: 'مستوى إعادة الطلب',
    storageLocation: 'موقع التخزين',
    supplier: 'المورد',
    expirationDate: 'تاريخ الصلاحية',
    batchNumber: 'رقم الدفعة',
    status: 'الحالة',
    actions: 'الإجراءات',

    // Categories
    catRawMaterials: 'المواد الخام',
    catFinishedProducts: 'المنتجات الجاهزة',
    catPackagingMaterials: 'مواد التغليف',
    catBeverages: 'المشروبات',
    catCleaningSupplies: 'مواد النظافة',

    // Statuses
    statusInStock: 'متوفر',
    statusLowStock: 'منخفض',
    statusOutOfStock: 'غير متوفر',
    statusExpired: 'منتهي الصلاحية',
    statusOverstock: 'مخزون زائد',

    // Movement Types
    moveStockIn: 'إدخال مخزني',
    moveStockOut: 'صرف مخزني',
    moveAdjustment: 'تسوية جردية',
    moveTransfer: 'تحويل داخلي',
    moveWaste: 'تالف / هدر',
    moveExpired: 'إتلاف منتهي الصلاحية',
    moveCount: 'جرد دوري',

    // Purchase Order Statuses
    poDraft: 'مسودة',
    poPendingApproval: 'بانتظار الموافقة',
    poApproved: 'موافق عليه',
    poOrdered: 'مطلوب من المورد',
    poPartiallyReceived: 'مستلم جزئياً',
    poReceived: 'مكتمل الاستلام',
    poCancelled: 'ملغى',

    // Dialogs & Forms
    saveItem: 'حفظ الصنف',
    cancel: 'إلغاء',
    approvePO: 'اعتماد أمر الشراء',
    receiveItems: 'تأكيد استلام البضائع',
    recordPayment: 'تسجيل دفعة للمورد',
    exportPdf: 'تصدير PDF',
    exportExcel: 'تصدير Excel (CSV)',
    searchPlaceholder: 'ابحث باسم الصنف، الكود، الباركود...',
    filterCategory: 'جميع الفئات',
    filterStatus: 'جميع الحالات',

    // Alerts Banner
    alertsHeader: 'تنبيهات المخزون الحرجة',
    noAlerts: 'جميع مستويات المخزون طبيعية. لا توجد تنبيهات حرجة.',
    dismissAlert: 'تجاهل'
  },
  so: {
    inventoryTitle: 'Maamulka Alaabta & Kaydka',
    inventorySubtitle: 'Cuntada ceeriin, alaabta diyaarsan, dhaqdhaqaaqa kaydka, iibsiga & alaab-qeybiyaasha',
    dashboardTab: 'Xarunta Kooban',
    inventoryListTab: 'Buugga Kaydka',
    stockMovementTab: 'Dhaqdhaqaaqa Kaydka',
    purchaseOrdersTab: 'Dalabaadka Iibsiga',
    goodsReceivingTab: 'Qabashada Alaabta',
    suppliersTab: 'Ganacsatada Alaabta',
    reportsTab: 'Warbixinnada Kaydka',

    // Overview Cards
    totalItems: 'Warta Alaabta',
    stockValuation: 'Qiimaha Kaydka',
    lowStockAlerts: 'Alaabta Yar',
    outOfStockCount: 'Alaabta Dhamaatay',
    expiredItemsCount: 'Alaabta Dhacday',
    pendingPOs: 'Dalabaadka Sugaya',
    totalSuppliers: 'Warta Alaab-qeybiyaasha',
    outstandingPayables: 'Lacaagta Lagu Leeyahay',

    // Quick Actions
    quickStockIn: 'Geli Kayd',
    quickStockOut: 'Bixi Kayd',
    quickAdjustment: 'Saxeex Kaydka',
    quickTransfer: 'U wareeji Kayd',
    addNewItem: 'Kudar Alaab Mp cusub',
    createPO: 'Dalab Iibsi Cusub',
    addSupplier: 'Kudar Alaab-qeybiye',

    // Item Fields
    itemName: 'Magaca Alaabta',
    itemCode: 'Koodhka Alaabta',
    barcode: 'Baarkoodka',
    category: 'Qaybta',
    unit: 'Halbeegga',
    purchaseCost: 'Lahaanshaha ($)',
    sellingCost: 'Qiimaha Beeca ($)',
    currentQuantity: 'Khadka Hadda',
    minimumQuantity: 'Khadka Ugu Ch yar',
    maximumQuantity: 'Khadka Ugu Dheer',
    reorderLevel: 'Heerka Dalabka',
    storageLocation: 'Muuqaalka Kaydinta',
    supplier: 'Alaab-qeybiye',
    expirationDate: 'Taariikhda Dhicitaanka',
    batchNumber: 'Lamberka Batch-ka',
    status: 'Xaaladda',
    actions: 'Tallaabooyinka',

    // Categories
    catRawMaterials: 'Mawaddada Ceeriin',
    catFinishedProducts: 'Alaabta Diyaarsan',
    catPackagingMaterials: 'Alaabta Duubista',
    catBeverages: 'Cabitaannada',
    catCleaningSupplies: 'Alaabta Nadaafadda',

    // Statuses
    statusInStock: 'Waa Hadaf',
    statusLowStock: 'Waa Yar tahay',
    statusOutOfStock: 'Waa Dhamaatay',
    statusExpired: 'Waa Dhacday',
    statusOverstock: 'Kayd Baddan',

    // Movement Types
    moveStockIn: 'Gasho Kaydka',
    moveStockOut: 'Bixi Kaydka',
    moveAdjustment: 'Saxeexa Kaydka',
    moveTransfer: 'Wareejin Kayd',
    moveWaste: 'Khasaare / Qashin',
    moveExpired: 'Bixinta Dhacday',
    moveCount: 'Tirada Kaydka',

    // Purchase Order Statuses
    poDraft: 'Qabyo',
    poPendingApproval: 'Sugi ogolaansho',
    poApproved: 'Waa la ogolaaday',
    poOrdered: 'Waa la dalbaday',
    poPartiallyReceived: 'Seera la helay',
    poReceived: 'Dhameystiran',
    poCancelled: 'Waa la baajiyay',

    // Dialogs & Forms
    saveItem: 'Kaydi Alaabta',
    cancel: 'Ka noqo',
    approvePO: 'Ogolow Dalabka',
    receiveItems: 'Hagaji Helitaanka Alaabta',
    recordPayment: 'Qor Bixinta Lacagta',
    exportPdf: 'Dhoofi PDF',
    exportExcel: 'Dhoofi Excel (CSV)',
    searchPlaceholder: 'Rai magaca alaabta, koodhka...',
    filterCategory: 'Dhamaan Qaybaha',
    filterStatus: 'Dhamaan Xaaladaha',

    // Alerts Banner
    alertsHeader: 'Bawada Kaydka Degdegga ah',
    noAlerts: 'Hadafka kaydka waa caadi. Ma jiraan digniino.',
    dismissAlert: 'Ka saar'
  }
};
