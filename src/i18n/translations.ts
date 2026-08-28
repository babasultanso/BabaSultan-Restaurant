import { SupportedLanguage } from '../constants';

export interface TranslationDictionary {
  [key: string]: any;
  appName: string;
  appDescription: string;
  language: string;
  roles: {
    Owner: string;
    Admin: string;
    Manager: string;
    Accountant: string;
    Cashier: string;
    Kitchen: string;
    Waiter: string;
    DeliveryDriver: string;
  };
  navigation: {
    dashboard: string;
    products: string;
    adminPanel: string;
    pos: string;
    orders: string;
    kitchen: string;
    inventory: string;
    financials: string;
    staff: string;
    reports: string;
    aiAdvisor: string;
    aiOperations: string;
    aiCEO: string;
    settings: string;
    users: string;
    customers: string;
    profile: string;
    roleMatrix: string;
    branches?: string;
    recipeEngine?: string;
    delivery?: string;
  };
  status: {
    active: string;
    pending: string;
    completed: string;
    cancelled: string;
    preparing: string;
    ready: string;
    inTransit: string;
    lowStock: string;
    outOfStock: string;
    suspended: string;
  };
  actions: {
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    create: string;
    search: string;
    filter: string;
    exportPdf: string;
    exportExcel: string;
    refresh: string;
    switchRole: string;
    logout: string;
    login: string;
  };
  messages: {
    accessDenied: string;
    accessDeniedDesc: string;
    loading: string;
    syncSuccess: string;
    syncError: string;
  };
  auth: {
    welcomeBack: string;
    signInToAccount: string;
    emailAddress: string;
    password: string;
    rememberMe: string;
    forgotPassword: string;
    signInButton: string;
    signInWithGoogle: string;
    quickPresetLogin: string;
    quickPresetDesc: string;
    resetPasswordTitle: string;
    resetPasswordDesc: string;
    sendResetLink: string;
    resetEmailSent: string;
    invalidCredentials: string;
    logoutConfirm: string;
    sessionActive: string;
  };
  profile: {
    title: string;
    subtitle: string;
    personalDetails: string;
    displayName: string;
    email: string;
    role: string;
    branch: string;
    emailVerification: string;
    emailVerified: string;
    emailNotVerified: string;
    sendVerificationLink: string;
    verificationSent: string;
    changePassword: string;
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
    updatePasswordBtn: string;
    passwordUpdated: string;
    passwordMismatch: string;
    updateProfileBtn: string;
    profileUpdated: string;
    recentActivity: string;
  };
  userManagement: {
    title: string;
    subtitle: string;
    addUser: string;
    editUser: string;
    userName: string;
    userEmail: string;
    assignedRole: string;
    branchOffice: string;
    accountStatus: string;
    lastLogin: string;
    actions: string;
    statusActive: string;
    statusSuspended: string;
    statusPending: string;
    triggerResetEmail: string;
    resetEmailTriggered: string;
    userCreated: string;
    userUpdated: string;
    searchUsers: string;
  };
  rolePermissions: {
    title: string;
    subtitle: string;
    capability: string;
    adminPanel: string;
    posTerminal: string;
    kitchenDisplay: string;
    rawInventory: string;
    financialLedger: string;
    staffManagement: string;
    auditReports: string;
    aiFinancialAdvisor: string;
    manageBranchSettings: string;
    manageUserAccounts: string;
  };
  activityLogs: {
    title: string;
    user: string;
    role: string;
    action: string;
    details: string;
    timestamp: string;
    noLogs: string;
  };
  pos: {
    title: string;
    subtitle: string;
    heldOrders: string;
    cashier: string;
    searchPlaceholder: string;
    allCategories: string;
    outOfStock: string;
    leftInStock: string;
    currentCart: string;
    itemsCount: string;
    dineIn: string;
    takeout: string;
    delivery: string;
    online: string;
    reserve: string;
    customerLabel: string;
    walkInGuest: string;
    tableLabel: string;
    noTableNeeded: string;
    cartEmpty: string;
    selectDishes: string;
    applyDiscount: string;
    subtotal: string;
    vat: string;
    discount: string;
    grandTotal: string;
    holdButton: string;
    payButton: string;
  };
  orders: {
    title: string;
    subtitle: string;
    pipeline: string;
    kds: string;
    tables: string;
    customerLog: string;
    allOrders: string;
    orderDetails: string;
    editOrder: string;
    completed: string;
    inKitchen: string;
    ready: string;
    onDelivery: string;
    cancelled: string;
    received: string;
  };
  accounting: {
    title: string;
    subtitle: string;
    newJournal: string;
    recordExpense: string;
    dashboard: string;
    chartOfAccounts: string;
    journalEntries: string;
    generalLedger: string;
    receivables: string;
    payables: string;
    expenses: string;
    cashBank: string;
    taxes: string;
    reports: string;
  };
  hrm: {
    title: string;
    subtitle: string;
    addEmployee: string;
    dashboard: string;
    directory: string;
    attendance: string;
    shifts: string;
    payroll: string;
    leave: string;
    performance: string;
  };
  crm: {
    title: string;
    subtitle: string;
    addCustomer: string;
    customersList: string;
    wallet: string;
    coupons: string;
    loyalty: string;
    analytics: string;
  };
  settings: {
    title: string;
    subtitle: string;
    general: string;
    posAndPrint: string;
    taxesAndCurrency: string;
    notifications: string;
    backupAndSync: string;
    saveSettings: string;
  };
  ai: {
    title: string;
    subtitle: string;
    financialAdvisor: string;
    operationsManager: string;
    ceoCommand: string;
    askAI: string;
  };
  dashboard: {
    [key: string]: any;
    ownerTitle: string;
    executiveSuite: string;
    enterpriseVisibility: string;
    ownerSubtitle: string;
    healthScore: string;
    netProfitMargin: string;
    foodCogs: string;
    totalSales: string;
    todayRevenue: string;
    todayProfit: string;
    monthlyProfit: string;
    totalExpenses: string;
    cashFlow: string;
    totalOrders: string;
    customerGrowth: string;
    inventoryStatus: string;
    manageInventory: string;
    totalItems: string;
    healthyStock: string;
    lowStockAlerts: string;
    employeeLeaderboard: string;
    staffPortal: string;
    managerTitle: string;
    shiftOperations: string;
    managerControlRoom: string;
    managerSubtitle: string;
    openPos: string;
    activeOrdersQueue: string;
    dailyRevenue: string;
    kitchenPrepItems: string;
    deliveryOrders: string;
    accountantTitle: string;
    financialControl: string;
    generalLedgerAudit: string;
    accountantSubtitle: string;
    fullLedger: string;
    netRevenue: string;
    grossProfit: string;
    netOperatingProfit: string;
    operatingExpenses: string;
    estVatPayable: string;
    cashierTitle: string;
    terminalActive: string;
    shiftCashierCounter: string;
    cashierSubtitle: string;
    launchPos: string;
    newOrdersQueue: string;
    completedOrdersToday: string;
    dailySalesTotal: string;
    kitchenTitle: string;
    lineChefKds: string;
    kitchenDisplayScreen: string;
    kitchenSubtitle: string;
    stationsActive: string;
    preparingOnStove: string;
    readyForPickup: string;
    delayedAlerts: string;
    adminTitle: string;
    systemAdmin: string;
    fullRbac: string;
    adminSubtitle: string;
    openAdminControl: string;
    waiterTitle: string;
    floorStaff: string;
    waiterSubtitle: string;
    createTableOrder: string;
  };
}

export const translations: Record<SupportedLanguage, TranslationDictionary> = {
  en: {
    appName: 'Commercial Restaurant ERP',
    appDescription: 'Enterprise Multi-Branch Restaurant ERP & AI Decision System',
    language: 'Language',
    roles: {
      Owner: 'Owner',
      Admin: 'Admin',
      Manager: 'Manager',
      Accountant: 'Accountant',
      Cashier: 'Cashier',
      Kitchen: 'Kitchen Staff',
      Waiter: 'Waiter',
      DeliveryDriver: 'Delivery Driver'
    },
    navigation: {
      dashboard: 'Executive Dashboard',
      products: 'Products & Menu',
      adminPanel: 'Admin Control Panel',
      pos: 'POS Terminal',
      orders: 'Order Pipeline',
      kitchen: 'Kitchen Display (KDS)',
      inventory: 'Raw Stock Inventory',
      financials: 'Financial Ledger & Expenses',
      staff: 'Staff & Suppliers',
      reports: 'Audit Reports & Export',
      aiAdvisor: 'AI Financial Advisor',
      aiOperations: 'AI Operations Manager',
      aiCEO: 'AI CEO Command',
      settings: 'Branch Settings',
      users: 'User Management',
      customers: 'CRM & Loyalty System',
      profile: 'User Profile & Security',
      roleMatrix: 'Role Permissions Matrix',
      branches: 'Multi-Branch HQ',
      recipeEngine: 'Recipe & Food Costing',
      delivery: 'Delivery & Logistics'
    },
    status: {
      active: 'Active',
      pending: 'Pending',
      completed: 'Completed',
      cancelled: 'Cancelled',
      preparing: 'Preparing in Kitchen',
      ready: 'Ready for Pickup',
      inTransit: 'On Delivery',
      lowStock: 'Low Stock Alert',
      outOfStock: 'Out of Stock',
      suspended: 'Suspended'
    },
    actions: {
      save: 'Save Changes',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit Item',
      create: 'Add New Record',
      search: 'Search records...',
      filter: 'Filter',
      exportPdf: 'Export PDF Audit',
      exportExcel: 'Export Excel Master',
      refresh: 'Sync Firebase',
      switchRole: 'Switch Role View',
      logout: 'Sign Out',
      login: 'Sign In'
    },
    messages: {
      accessDenied: 'Access Restricted',
      accessDeniedDesc: 'Your current role does not have administrative permission to view this module.',
      loading: 'Synchronizing enterprise live database...',
      syncSuccess: 'Firestore synchronization complete!',
      syncError: 'Database sync error encountered.'
    },
    auth: {
      welcomeBack: 'Welcome Back',
      signInToAccount: 'Sign in to access your ERP portal',
      emailAddress: 'Email Address',
      password: 'Password',
      rememberMe: 'Remember Me',
      forgotPassword: 'Forgot Password?',
      signInButton: 'Sign In to ERP Portal',
      signInWithGoogle: 'Sign In with Google',
      quickPresetLogin: 'Phase 2 Test Preset Logins',
      quickPresetDesc: 'Select an authorized role account to immediately test RBAC access:',
      resetPasswordTitle: 'Reset Your Password',
      resetPasswordDesc: 'Enter your account email to receive a password reset link:',
      sendResetLink: 'Send Password Reset Link',
      resetEmailSent: 'Password reset link sent! Check your email inbox.',
      invalidCredentials: 'Invalid email or password. Please try again.',
      logoutConfirm: 'Are you sure you want to sign out?',
      sessionActive: 'Active Session'
    },
    profile: {
      title: 'User Profile & Security',
      subtitle: 'Manage your credentials, active session, and security preferences',
      personalDetails: 'Personal Profile Information',
      displayName: 'Display Name',
      email: 'Email Address',
      role: 'Assigned Role',
      branch: 'Primary Branch',
      emailVerification: 'Email Verification Status',
      emailVerified: 'Email Verified',
      emailNotVerified: 'Email Not Verified',
      sendVerificationLink: 'Send Verification Email',
      verificationSent: 'Verification link sent to your email!',
      changePassword: 'Change Password',
      currentPassword: 'Current Password',
      newPassword: 'New Password',
      confirmNewPassword: 'Confirm New Password',
      updatePasswordBtn: 'Update Password',
      passwordUpdated: 'Password changed successfully!',
      passwordMismatch: 'New password and confirmation do not match.',
      updateProfileBtn: 'Save Profile Updates',
      profileUpdated: 'Profile updated successfully!',
      recentActivity: 'Your Recent Activity Logs'
    },
    userManagement: {
      title: 'User Management & Role Assignment',
      subtitle: 'Manage system users, roles, account statuses, and credentials',
      addUser: 'Provision New User',
      editUser: 'Edit User Role & Status',
      userName: 'Full Name',
      userEmail: 'Email Address',
      assignedRole: 'Assigned Role',
      branchOffice: 'Branch Office',
      accountStatus: 'Account Status',
      lastLogin: 'Last Active',
      actions: 'Actions',
      statusActive: 'Active',
      statusSuspended: 'Suspended',
      statusPending: 'Pending',
      triggerResetEmail: 'Trigger Password Reset',
      resetEmailTriggered: 'Reset link triggered successfully!',
      userCreated: 'New user provisioned successfully!',
      userUpdated: 'User profile updated!',
      searchUsers: 'Search users by name or email...'
    },
    rolePermissions: {
      title: 'Role Permissions Matrix',
      subtitle: 'Comprehensive Attribute-Based Access Control (ABAC) capabilities across all 8 roles',
      capability: 'Capability / System Access',
      adminPanel: 'Executive Admin Panel',
      posTerminal: 'POS Terminal Access',
      kitchenDisplay: 'Kitchen Display System (KDS)',
      rawInventory: 'Raw Inventory Management',
      financialLedger: 'Financial Ledger & Expenses',
      staffManagement: 'Staff & Suppliers Management',
      auditReports: 'Audit Reports & Exports',
      aiFinancialAdvisor: 'AI Financial Advisor & CEO Command',
      manageBranchSettings: 'Manage Branch Settings',
      manageUserAccounts: 'Manage User Accounts & Roles'
    },
    activityLogs: {
      title: 'Audit & Activity Logs',
      user: 'User',
      role: 'Role',
      action: 'Action',
      details: 'Details',
      timestamp: 'Timestamp',
      noLogs: 'No activity logs recorded yet.'
    },
    pos: {
      title: 'Restaurant POS Terminal',
      subtitle: 'Real-time cashier checkout terminal connected directly to Firestore catalog & inventory',
      heldOrders: 'Held Orders',
      cashier: 'Cashier',
      searchPlaceholder: 'Search dish (EN / AR / SO), SKU, or barcode...',
      allCategories: 'All',
      outOfStock: 'Out of Stock',
      leftInStock: 'left',
      currentCart: 'Current Order Cart',
      itemsCount: 'items',
      dineIn: 'Dine In',
      takeout: 'Takeout',
      delivery: 'Delivery',
      online: 'Online',
      reserve: 'Reserve',
      customerLabel: 'Customer',
      walkInGuest: 'Walk-in Guest',
      tableLabel: 'Table',
      noTableNeeded: 'No Table Needed',
      cartEmpty: 'Cart is currently empty',
      selectDishes: 'Select dishes from the catalog to build an order',
      applyDiscount: 'Apply Discount',
      subtotal: 'Subtotal',
      vat: 'VAT',
      discount: 'Discount',
      grandTotal: 'Grand Total',
      holdButton: 'Hold',
      payButton: 'Pay'
    },
    orders: {
      title: 'Orders & Kitchen Operations Hub',
      subtitle: 'Real-time status tracking, Kitchen KDS, table management & customer histories',
      pipeline: 'Orders Pipeline',
      kds: 'Kitchen KDS',
      tables: 'Table Layout',
      customerLog: 'Customer Log',
      allOrders: 'All Orders',
      orderDetails: 'Order Details',
      editOrder: 'Edit Order',
      completed: 'Completed',
      inKitchen: 'In Kitchen',
      ready: 'Ready',
      onDelivery: 'On Delivery',
      cancelled: 'Cancelled',
      received: 'Received'
    },
    accounting: {
      title: 'Accounting & Finance System',
      subtitle: 'Double-entry ledger, journals, cash & bank, AR/AP, expenses & compliance reports',
      newJournal: 'New Journal Entry',
      recordExpense: 'Record Expense',
      dashboard: 'Dashboard',
      chartOfAccounts: 'Chart of Accounts',
      journalEntries: 'Journal Entries',
      generalLedger: 'General Ledger',
      receivables: 'Accounts Receivable',
      payables: 'Accounts Payable',
      expenses: 'Expenses',
      cashBank: 'Cash & Bank',
      taxes: 'Taxes',
      reports: 'Financial Reports'
    },
    hrm: {
      title: 'Human Resources & Employee Management',
      subtitle: 'Attendance, Custom Shifts, Monthly Payroll, Leave Workflows & 360° Employee Profiles',
      addEmployee: 'Add Employee',
      dashboard: 'HR Dashboard',
      directory: 'Directory',
      attendance: 'Attendance',
      shifts: 'Shifts',
      payroll: 'Payroll',
      leave: 'Leaves',
      performance: 'Performance'
    },
    crm: {
      title: 'CRM & Customer Loyalty System',
      subtitle: 'Customer profiles, wallet balances, reward points, coupons & broadcast messaging',
      addCustomer: 'Add Customer',
      customersList: 'Customers List',
      wallet: 'Digital Wallet',
      coupons: 'Coupons & Promos',
      loyalty: 'Loyalty Program',
      analytics: 'Customer Analytics'
    },
    settings: {
      title: 'System & Branch Settings',
      subtitle: 'Configure store parameters, receipt printers, tax rules, currency & backups',
      general: 'General Info',
      posAndPrint: 'POS & Printing',
      taxesAndCurrency: 'Tax & Currency',
      notifications: 'Alerts & Notifications',
      backupAndSync: 'Database Backup',
      saveSettings: 'Save Configuration'
    },
    ai: {
      title: 'AI Enterprise Intelligence Platform',
      subtitle: 'Real-time financial analytics, operational bottleneck detection & strategic CEO recommendations',
      financialAdvisor: 'Financial Advisor',
      operationsManager: 'Operations Manager',
      ceoCommand: 'CEO Command Center',
      askAI: 'Ask AI Manager'
    },
    dashboard: {
      ownerTitle: 'Owner & Executive Dashboard',
      executiveSuite: 'Executive Suite',
      enterpriseVisibility: 'Full Enterprise Visibility',
      ownerSubtitle: 'Real-time multi-branch financial intelligence, profit margins, stock valuation, and operational performance.',
      healthScore: 'Business Health Score',
      netProfitMargin: 'Net Profit Margin',
      foodCogs: 'Food COGS',
      totalSales: 'Total Sales',
      todayRevenue: "Today's Revenue",
      todayProfit: "Today's Profit",
      monthlyProfit: 'Monthly Profit',
      totalExpenses: 'Total Expenses',
      cashFlow: 'Cash Flow & Liquidity',
      totalOrders: 'Total Orders',
      customerGrowth: 'Customer Growth',
      inventoryStatus: 'Inventory Status Overview',
      manageInventory: 'Manage Inventory →',
      totalItems: 'Total Items',
      healthyStock: 'Healthy Stock',
      lowStockAlerts: 'Low Stock Alerts',
      employeeLeaderboard: 'Employee Performance Leaderboard',
      staffPortal: 'Staff Portal →',
      managerTitle: 'Restaurant Operations & Manager Dashboard',
      shiftOperations: 'Shift Operations',
      managerControlRoom: 'Manager Control Room',
      managerSubtitle: 'Real-time kitchen order queue, line chef station load, delivery status, staff attendance, and stock alerts.',
      openPos: 'Open POS Terminal',
      activeOrdersQueue: 'Active Orders Queue',
      dailyRevenue: 'Daily Revenue',
      kitchenPrepItems: 'Kitchen Prep Items',
      deliveryOrders: 'Delivery Orders',
      accountantTitle: 'Accounting & Financial Performance Dashboard',
      financialControl: 'Financial Control & CPA Suite',
      generalLedgerAudit: 'General Ledger & Audit Trail',
      accountantSubtitle: 'Audit P&L Statements, revenue recognition, supplier accounts payable, bank reconciliation, and estimated tax liabilities.',
      fullLedger: 'Full Financial Ledger',
      netRevenue: 'Net Revenue',
      grossProfit: 'Gross Profit',
      netOperatingProfit: 'Net Operating Profit',
      operatingExpenses: 'Operating Expenses',
      estVatPayable: 'Est. VAT / Sales Tax Payable',
      cashierTitle: 'Front Counter Cashier & POS Terminal',
      terminalActive: 'Terminal Active',
      shiftCashierCounter: 'Shift Cashier Counter',
      cashierSubtitle: 'Monitor real-time customer settlement queue, payment method totals, and shift register totals.',
      launchPos: 'Launch POS Checkout',
      newOrdersQueue: 'New Orders Queue',
      completedOrdersToday: 'Completed Orders Today',
      dailySalesTotal: 'Daily Sales Total',
      kitchenTitle: 'Kitchen Preparation Station Display',
      lineChefKds: 'Line Chef KDS',
      kitchenDisplayScreen: 'Kitchen Display Screen',
      kitchenSubtitle: 'Real-time ticket queue for line chefs, station load balancing, and preparation time tracking.',
      stationsActive: 'STATIONS ACTIVE',
      preparingOnStove: 'Preparing on Stove/Grill',
      readyForPickup: 'Ready for Pickup',
      delayedAlerts: 'Delayed Prep Alerts',
      adminTitle: 'System Administration Dashboard',
      systemAdmin: 'System Admin',
      fullRbac: 'Full RBAC Architecture Access',
      adminSubtitle: 'Manage enterprise access control, user accounts, security rules, and database collections.',
      openAdminControl: 'Open Admin Control Panel →',
      waiterTitle: 'Dining Room Waiter Station',
      floorStaff: 'Floor Staff',
      waiterSubtitle: 'Track active dining tables, ready dishes from kitchen, and floor service requests.',
      createTableOrder: '+ Create Table Order'
    }
  },
  ar: {
    appName: 'نظام إدارة المطاعم الشامل ERP',
    appDescription: 'نظام تخطيط موارد المطاعم متعدد الفروع والذكاء الاصطناعي',
    language: 'اللغة',
    roles: {
      Owner: 'المالك',
      Admin: 'مدير النظام',
      Manager: 'مدير الفرع',
      Accountant: 'المحاسب',
      Cashier: 'أمين الصندوق',
      Kitchen: 'طاقم المطبخ',
      Waiter: 'النادل',
      DeliveryDriver: 'سائق التوصيل'
    },
    navigation: {
      dashboard: 'لوحة التحكم التنفيذية',
      products: 'إدارة المنتجات وقائمة الطعام',
      adminPanel: 'لوحة الإدارة العليا',
      pos: 'نقطة البيع (POS)',
      orders: 'متابعة الطلبات',
      kitchen: 'شاشة المطبخ (KDS)',
      inventory: 'إدارة المخزون والمواد الخام',
      financials: 'السجل المالي والمصروفات',
      staff: 'الموظفون والموردون',
      reports: 'التقارير والتصدير',
      aiAdvisor: 'المستشار المالي الذكي',
      aiOperations: 'مدير العمليات الذكي',
      aiCEO: 'الرئيس التنفيذي الذكي',
      settings: 'إعدادات الفرع',
      users: 'إدارة المستخدمين',
      customers: 'إدارة العملاء والولاء (CRM)',
      profile: 'الملف الشخصي والأمان',
      roleMatrix: 'مصفوفة صلاحيات الأدوار',
      branches: 'إدارة الفروع المتعددة',
      recipeEngine: 'الوصفات وتكلفة الأطعمة',
      delivery: 'التوصيل واللوجستيات'
    },
    status: {
      active: 'نشط',
      pending: 'قيد الانتظار',
      completed: 'مكتمل',
      cancelled: 'ملغى',
      preparing: 'جاري التحضير بالمطبخ',
      ready: 'جاهز للتسليم',
      inTransit: 'جاري التوصيل',
      lowStock: 'تنبيه مخزون منخفض',
      outOfStock: 'نفد من المخزون',
      suspended: 'معلق'
    },
    actions: {
      save: 'حفظ التغييرات',
      cancel: 'إلغاء',
      delete: 'حذف',
      edit: 'تعديل',
      create: 'إضافة سجل جديد',
      search: 'البحث في السجلات...',
      filter: 'تصفية',
      exportPdf: 'تصدير تقرير PDF',
      exportExcel: 'تصدير ملف Excel',
      refresh: 'تحديث البيانات',
      switchRole: 'تبديل الدور الحسابي',
      logout: 'تسجيل الخروج',
      login: 'تسجيل الدخول'
    },
    messages: {
      accessDenied: 'الوصول محظور',
      accessDeniedDesc: 'الدور الحسابي الحالي لا يملك الصلاحية للوصول إلى هذه الشاشة.',
      loading: 'جاري مزامنة قاعدة البيانات التفاعلية...',
      syncSuccess: 'تمت المزامنة بنجاح!',
      syncError: 'حدث خطأ أثناء مزامنة البيانات.'
    },
    auth: {
      welcomeBack: 'مرحباً بك مجدداً',
      signInToAccount: 'سجل الدخول للوصول إلى نظام إدارة المطعم',
      emailAddress: 'البريد الإلكتروني',
      password: 'كلمة المرور',
      rememberMe: 'تذكرني',
      forgotPassword: 'نسيت كلمة المرور؟',
      signInButton: 'تسجيل الدخول للنظام',
      signInWithGoogle: 'تسجيل الدخول عبر Google',
      quickPresetLogin: 'تسجيل الدخول السريع لاختبار المرحلة الثانية',
      quickPresetDesc: 'اختر حساباً معتمداً للتحقق من الصلاحيات فوراً:',
      resetPasswordTitle: 'إعادة تعيين كلمة المرور',
      resetPasswordDesc: 'أدخل بريدك الإلكتروني لإرسال رابط إعادة التعيين:',
      sendResetLink: 'إرسال رابط إعادة التعيين',
      resetEmailSent: 'تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني!',
      invalidCredentials: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
      logoutConfirm: 'هل أنت تأكد من رغبتك في تسجيل الخروج؟',
      sessionActive: 'جلسة نشطة'
    },
    profile: {
      title: 'الملف الشخصي والأمان',
      subtitle: 'إدارة بياناتك الشخصية والجلسة النشطة وإعدادات الحماية',
      personalDetails: 'البيانات الشخصية',
      displayName: 'الاسم الظاهر',
      email: 'البريد الإلكتروني',
      role: 'الدور المخصص',
      branch: 'الفرع الرئيسي',
      emailVerification: 'حالة تأكيد البريد الإلكتروني',
      emailVerified: 'البريد مؤكد',
      emailNotVerified: 'البريد غير مؤكد',
      sendVerificationLink: 'إرسال رابط التأكيد',
      verificationSent: 'تم إرسال رابط التأكيد لبريدك الإلكتروني!',
      changePassword: 'تغيير كلمة المرور',
      currentPassword: 'كلمة المرور الحالية',
      newPassword: 'كلمة المرور الجديدة',
      confirmNewPassword: 'تأكيد كلمة المرور الجديدة',
      updatePasswordBtn: 'تحديث كلمة المرور',
      passwordUpdated: 'تم تغيير كلمة المرور بنجاح!',
      passwordMismatch: 'كلمة المرور الجديدة وتأكيدها غير متطابقين.',
      updateProfileBtn: 'حفظ التغييرات',
      profileUpdated: 'تم تحديث البيانات الشخصية بنجاح!',
      recentActivity: 'سجل نشاطاتك الأخيرة'
    },
    userManagement: {
      title: 'إدارة المستخدمين والأدوار',
      subtitle: 'إدارة حسابات النظام وتعيين الصلاحيات وإعادة ضبط الحسابات',
      addUser: 'إضافة مستخدم جديد',
      editUser: 'تعديل دور وحالة المستخدم',
      userName: 'الاسم الكامل',
      userEmail: 'البريد الإلكتروني',
      assignedRole: 'الدور المخصص',
      branchOffice: 'الفرع',
      accountStatus: 'حالة الحساب',
      lastLogin: 'آخر ظهور',
      actions: 'الإجراءات',
      statusActive: 'نشط',
      statusSuspended: 'معلق',
      statusPending: 'قيد الانتظار',
      triggerResetEmail: 'إرسال رابط استعادة المرور',
      resetEmailTriggered: 'تم إرسال رابط إعادة التعيين بنجاح!',
      userCreated: 'تم إنشاء الحساب الجديد بنجاح!',
      userUpdated: 'تم تحديث حساب المستخدم!',
      searchUsers: 'البحث عن مستخدم بالاسم أو البريد...'
    },
    rolePermissions: {
      title: 'مصفوفة صلاحيات الأدوار',
      subtitle: 'الصلاحيات الدقيقة لكل من الأدوار الثمانية بالنظام',
      capability: 'الصلاحية / الوصول للنظام',
      adminPanel: 'لوحة الإدارة العليا',
      posTerminal: 'نقطة البيع (POS)',
      kitchenDisplay: 'شاشة المطبخ (KDS)',
      rawInventory: 'إدارة المخزون والمواد الخام',
      financialLedger: 'السجل المالي والمصروفات',
      staffManagement: 'إدارة الموظفين والموردين',
      auditReports: 'التقارير المالية والتصدير',
      aiFinancialAdvisor: 'المستشار المالي الذكي والرئيس التنفيذي',
      manageBranchSettings: 'إدارة إعدادات الفرع',
      manageUserAccounts: 'إدارة حسابات المستخدمين'
    },
    activityLogs: {
      title: 'سجل النشاطات والمراجعة',
      user: 'المستخدم',
      role: 'الدور',
      action: 'الإجراء',
      details: 'التفاصيل',
      timestamp: 'الوقت والتاريخ',
      noLogs: 'لا توجد سجلات نشاط مسجلة حتى الآن.'
    },
    pos: {
      title: 'نقطة البيع الكاشير (POS)',
      subtitle: 'محطة البيع المباشرة المرتبطة بالمخزون والمطبخ وقاعدة البيانات',
      heldOrders: 'الطلبات المعلقة',
      cashier: 'الكاشير',
      searchPlaceholder: 'البحث عن وجبة، رمز SKU، أو الباركود...',
      allCategories: 'الكل',
      outOfStock: 'غير متوفر',
      leftInStock: 'المتبقي',
      currentCart: 'سلة الطلب الحالي',
      itemsCount: 'عناصر',
      dineIn: 'محلي',
      takeout: 'سفري',
      delivery: 'توصيل',
      online: 'أونلاين',
      reserve: 'حجز',
      customerLabel: 'العميل',
      walkInGuest: 'عميل عابر',
      tableLabel: 'الطاولة',
      noTableNeeded: 'بدون طاولة',
      cartEmpty: 'السلة فارغة حالياً',
      selectDishes: 'اختر الوجبات من القائمة لإضافتها للطلب',
      applyDiscount: 'تطبيق خصم',
      subtotal: 'المجموع الفرعي',
      vat: 'ضريبة القيمة المضافة',
      discount: 'الخصم',
      grandTotal: 'المبلغ الإجمالي',
      holdButton: 'تعليق',
      payButton: 'دفع'
    },
    orders: {
      title: 'مركز إدارة الطلبات والمطبخ',
      subtitle: 'متابعة الطلبات المباشرة وشاشة KDS وإدارة الطاولات',
      pipeline: 'سلسلة الطلبات',
      kds: 'شاشة المطبخ (KDS)',
      tables: 'مخطط الطاولات',
      customerLog: 'سجل العملاء',
      allOrders: 'جميع الطلبات',
      orderDetails: 'تفاصيل الطلب',
      editOrder: 'تعديل الطلب',
      completed: 'مكتمل',
      inKitchen: 'في المطبخ',
      ready: 'جاهز',
      onDelivery: 'قيد التوصيل',
      cancelled: 'ملغى',
      received: 'مستلم'
    },
    accounting: {
      title: 'النظام المحاسبي والمالي',
      subtitle: 'سجل القيد المزدوج، الدفاتر العامة، المقبوضات والمقيدين والمصروفات',
      newJournal: 'قيد يومية جديد',
      recordExpense: 'تسجيل مصروف',
      dashboard: 'لوحة التحكم المالية',
      chartOfAccounts: 'دليل الحسابات',
      journalEntries: 'قيود اليومية',
      generalLedger: 'دفتر الأستاذ العام',
      receivables: 'الحسابات المدينة',
      payables: 'الحسابات الدائنة',
      expenses: 'المصروفات',
      cashBank: 'النقد والبنوك',
      taxes: 'الضرائب والزكاة',
      reports: 'التقارير المالية'
    },
    hrm: {
      title: 'إدارة الموارد البشرية والموظفين',
      subtitle: 'الحضور والغياب، ورديات العمل، الرواتب الشهرية والإجازات',
      addEmployee: 'إضافة موظف جديد',
      dashboard: 'لوحة الموارد البشرية',
      directory: 'دليل الموظفين',
      attendance: 'سجل الحضور',
      shifts: 'ورديات العمل',
      payroll: 'مسير الرواتب',
      leave: 'طلبات الإجازات',
      performance: 'تقييم الأداء'
    },
    crm: {
      title: 'إدارة العملاء ونظام الولاء (CRM)',
      subtitle: 'ملفات العملاء، المحفظة الرقمية، نقاط المكافآت والكوبونات',
      addCustomer: 'إضافة عميل',
      customersList: 'قائمة العملاء',
      wallet: 'المحفظة الرقمية',
      coupons: 'الكوبونات والعروض',
      loyalty: 'برنامج الولاء',
      analytics: 'تحليلات سلوك العملاء'
    },
    settings: {
      title: 'إعدادات النظام والفرع',
      subtitle: 'إعداد بيانات المتجر، طابعات الفواتير، الضرائب والعملة والملاحظات',
      general: 'البيانات العامة',
      posAndPrint: 'نقطة البيع الطباعة',
      taxesAndCurrency: 'الضرائب والعملة',
      notifications: 'التنبيهات والرسائل',
      backupAndSync: 'النسخ الاحتياطي',
      saveSettings: 'حفظ الإعدادات'
    },
    ai: {
      title: 'منصة الذكاء الاصطناعي وإدارة القرار',
      subtitle: 'تحليلات مالية متقدمة، كشف اختناقات العمليات وتوصيات الرئيس التنفيذي',
      financialAdvisor: 'المستشار المالي',
      operationsManager: 'مدير العمليات',
      ceoCommand: 'مركز قيادة CEO',
      askAI: 'مساعد الذكاء الاصطناعي'
    },
    dashboard: {
      ownerTitle: 'لوحة تحكم المالك والإدارة العليا',
      executiveSuite: 'الجناح التنفيذي',
      enterpriseVisibility: 'رؤية شاملة للمؤسسة',
      ownerSubtitle: 'التحليلات المالية متعددة الفروع وهامش الربح وتقييم المخزون والأداء التشغيلي في الوقت الفعلي.',
      healthScore: 'مؤشر صحة الأعمال',
      netProfitMargin: 'هامش صافي الربح',
      foodCogs: 'تكلفة الأطعمة المباعة',
      totalSales: 'إجمالي المبيعات',
      todayRevenue: 'إيرادات اليوم',
      todayProfit: 'أرباح اليوم',
      monthlyProfit: 'أرباح الشهر',
      totalExpenses: 'إجمالي المصروفات',
      cashFlow: 'التدفق النقدي والسيولة',
      totalOrders: 'إجمالي الطلبات',
      customerGrowth: 'نمو قاعدة العملاء',
      inventoryStatus: 'نظرة عامة على حالة المخزون',
      manageInventory: 'إدارة المخزون →',
      totalItems: 'إجمالي العناصر',
      healthyStock: 'مخزون جيد',
      lowStockAlerts: 'تنبيهات نقص المخزون',
      employeeLeaderboard: 'لائحة متصدري أداء الموظفين',
      staffPortal: 'بوابة الموظفين →',
      managerTitle: 'لوحة تحكم مدير العمليات والمطعم',
      shiftOperations: 'عمليات المناوبة',
      managerControlRoom: 'غرفة تحكم المدير',
      managerSubtitle: 'متابعة طلبات المطبخ، ضغط المحطات، حالة التوصيل، حضور الموظفين وتنبيهات المخزون.',
      openPos: 'فتح نقطة البيع (POS)',
      activeOrdersQueue: 'قائمة الطلبات النشطة',
      dailyRevenue: 'الإيراد اليومي',
      kitchenPrepItems: 'عناصر التحضير بالمطبخ',
      deliveryOrders: 'طلبات التوصيل',
      accountantTitle: 'لوحة المحاسبة والأداء المالي',
      financialControl: 'جناح الرقابة المالية والمحاسبة',
      generalLedgerAudit: 'دفتر التدقيق والسجل العام',
      accountantSubtitle: 'مراجعة قوائم الأرباح والخسائر، ذمم الموردين، المطابقة المصرفية والالتزامات الضريبية.',
      fullLedger: 'السجل المالي الكامل',
      netRevenue: 'صافي الإيرادات',
      grossProfit: 'مجمل الربح',
      netOperatingProfit: 'صافي الربح التشغيلي',
      operatingExpenses: 'المصروفات التشغيلية',
      estVatPayable: 'ضريبة القيمة المضافة المقدرة',
      cashierTitle: 'لوحة الكاشير ونقطة البيع',
      terminalActive: 'المحطة نشطة',
      shiftCashierCounter: 'كاونتر الكاشير',
      cashierSubtitle: 'متابعة طلبات تحصيل العملاء، طرق الدفع وإجمالي صندوق المناوبة.',
      launchPos: 'فتح شاشة الدفع والبيع',
      newOrdersQueue: 'قائمة الطلبات الجديدة',
      completedOrdersToday: 'الطلبات المكتملة اليوم',
      dailySalesTotal: 'إجمالي مبيعات اليوم',
      kitchenTitle: 'شاشة المطبخ وإعداد الوجبات (KDS)',
      lineChefKds: 'شاشة الطهاة KDS',
      kitchenDisplayScreen: 'شاشة عرض المطبخ',
      kitchenSubtitle: 'تتبع تذاكر الطلبات للطهاة، توزيع الأحمال على المحطات وزمن التحضير.',
      stationsActive: 'المحطات نشطة',
      preparingOnStove: 'جاري التحضير على الموقد',
      readyForPickup: 'جاهز للتسليم',
      delayedAlerts: 'تنبيهات التأخير',
      adminTitle: 'لوحة إدارة النظام العليا',
      systemAdmin: 'مدير النظام',
      fullRbac: 'صلاحيات هيكلية كاملة',
      adminSubtitle: 'إدارة صلاحيات الوصول، حسابات المستخدمين، قواعد الأمان وقواعد البيانات.',
      openAdminControl: 'فتح لوحة الإدارة →',
      waiterTitle: 'محطة النادل وصالة الطعام',
      floorStaff: 'طاقم صالة الطعام',
      waiterSubtitle: 'متابعة الطاولات النشطة، الوجبات الجاهزة من المطبخ وطلبات الصالة.',
      createTableOrder: '+ إنشاء طلب طاولة'
    }
  },
  so: {
    appName: 'Nidaamka ERP Maqaayadaha',
    appDescription: 'Maamulka Maqaayadaha Qeybaha Badan & Caawiyaha Garaadka Artificial-ka',
    language: 'Luuqadda',
    roles: {
      Owner: 'Mulkiilaha',
      Admin: 'Maamulaha Guud',
      Manager: 'Maamulaha Faraca',
      Accountant: 'Xisaabiyaha',
      Cashier: 'Kaashiyaha',
      Kitchen: 'Shaqaalaha Jikada',
      Waiter: 'Adeegaha (Waiter)',
      DeliveryDriver: 'Wadaha Gaadhiga'
    },
    navigation: {
      dashboard: 'Bogga Muhiimka Ah',
      products: 'Cuntada & Menu-ga',
      adminPanel: 'Xarunta Maamulka',
      pos: 'Kombuyuutarka Bixinta (POS)',
      orders: 'Dalabaadka',
      kitchen: 'Shaashada Jikada (KDS)',
      inventory: 'Moofada & Alaabta Raw-ga',
      financials: 'Xisaabaadka & Kharashyada',
      staff: 'Shaqaalaha & Alaab-bixiyeyaasha',
      reports: 'Warbixinada & Export-ka',
      aiAdvisor: 'Garaadka Xisaabaadka (AI)',
      aiOperations: 'Garaadka Hawlaha (AI)',
      aiCEO: 'Madaxa AI CEO',
      settings: 'Dhabarka Nidaamka',
      users: 'Maamulka Isticmaalayaasha',
      customers: 'Macaamiisha & Loyalty (CRM)',
      profile: 'Xogtaada & Amniga',
      roleMatrix: 'Shaxda Ogolaanshaha Rooshinka',
      branches: 'Maamulka Laamaha (Branches)',
      recipeEngine: 'Karinta & Cost-ka Cuntada',
      delivery: 'Gaarsiinta & Saadka (Delivery)'
    },
    status: {
      active: 'Aktiv',
      pending: 'Pratsiin',
      completed: 'Dhameystiran',
      cancelled: 'La baajiyay',
      preparing: 'Jikada ayaa lagu diyaarinayaa',
      ready: 'Waa diyaar',
      inTransit: 'Waddo ayaa lagu jiraa',
      lowStock: 'Digiino Alaab Guranasa',
      outOfStock: 'Waa Dhamaatay',
      suspended: 'La Hakiyay'
    },
    actions: {
      save: 'Keydi',
      cancel: 'Kansal',
      delete: 'Tirtir',
      edit: 'Wax ka beddel',
      create: 'Kudar Mp',
      search: 'Raadi...',
      filter: 'Kala Saar',
      exportPdf: 'Shub PDF',
      exportExcel: 'Shub Excel',
      refresh: 'Cusbooneysii Firebase',
      switchRole: 'Baddal Roll-ka',
      logout: 'Ka bax',
      login: 'Geli'
    },
    messages: {
      accessDenied: 'Ogolaansho Ma Hexistid',
      accessDeniedDesc: 'Roll-kaaga hadda ma laha awood uu ku galo qaybtan.',
      loading: 'Loodinta xogta Firebase...',
      syncSuccess: 'Waa la cusbooneysiiyay!',
      syncError: 'Kutalagal ma jirin xilliga loodinta.'
    },
    auth: {
      welcomeBack: 'Kuso dhowaaw markale',
      signInToAccount: 'Geli xogtaada si aad u gashid nidaamka ERP',
      emailAddress: 'Email-ka',
      password: 'Password-ka',
      rememberMe: 'I xasuuso',
      forgotPassword: 'Ma harowday Password-ka?',
      signInButton: 'Geli Nidaamka ERP',
      signInWithGoogle: 'Ku geli Google',
      quickPresetLogin: 'Xisaabaadka Tijaabada Phase 2',
      quickPresetDesc: 'Dooray roll kasta si aad u tijaabiso ogolaanshaha si degdeg ah:',
      resetPasswordTitle: 'Cusbooneysii Password-ka',
      resetPasswordDesc: 'Geli email-kaaga si aan kuugu soo dirno link-ga cusbooneysiinta:',
      sendResetLink: 'Soo dir Link-ga Reset-ka',
      resetEmailSent: 'Link-ga reset-ka waa loo soo diray email-kaaga!',
      invalidCredentials: 'Email ama Password ma habboona. Fadlan dib u tijaabi.',
      logoutConfirm: 'Ma ziid dooneysaa inaad ka baxdo nidaamka?',
      sessionActive: 'Session-ka Aktiv-ka ah'
    },
    profile: {
      title: 'Xogta Isticmaalaha & Amniga',
      subtitle: 'Maamul xogtaada, session-kaaga aktiv-ka ah iyo habaynta amniga',
      personalDetails: 'Xogta Shaqsiga ah',
      displayName: 'Magaca',
      email: 'Email-ka',
      role: 'Roll-ka aad leedahay',
      branch: 'Faraca Koowaad',
      emailVerification: 'Xaaladda Email Verification-ka',
      emailVerified: 'Email-ka Waa La Xaqiijiyay',
      emailNotVerified: 'Email-ka Ma La Xaqiijin',
      sendVerificationLink: 'Soo dir Email Verification',
      verificationSent: 'Link-ga verification-ka waa loo soo diray email-kaaga!',
      changePassword: 'Baddal Password-ka',
      currentPassword: 'Password-ka Hadda',
      newPassword: 'Password-ka Cusub',
      confirmNewPassword: 'Xaqiiji Password-ka Cusub',
      updatePasswordBtn: 'Baddal Password-ka',
      passwordUpdated: 'Password-kii waa la baddalay!',
      passwordMismatch: 'Password-ka cusub iyo xaqiijintiisa way kala duwan yihiin.',
      updateProfileBtn: 'Keydi Xogta',
      profileUpdated: 'Xogtaada waa la cusbooneysiiyay!',
      recentActivity: 'Dhaqdhaqaaqii Ugu Dambeeyay'
    },
    userManagement: {
      title: 'Maamulka Isticmaalayaasha & Rooshinka',
      subtitle: 'Maamul dadka nidaamka adeegsada, rooshinkooda iyo status-kooda',
      addUser: 'Kudar Isticmaale Cusub',
      editUser: 'Beddel Roll-ka & Status-ka',
      userName: 'Magaca Buuxa',
      userEmail: 'Email-ka',
      assignedRole: 'Roll-ka',
      branchOffice: 'Faraca',
      accountStatus: 'Status-ka Account-ka',
      lastLogin: 'Aktiv-nimadii Ugu Dambaysay',
      actions: 'Tallaabooyinka',
      statusActive: 'Aktiv',
      statusSuspended: 'La Hakiyay',
      statusPending: 'Pratsiin',
      triggerResetEmail: 'Soo dir Password Reset',
      resetEmailTriggered: 'Link-ga Reset-ka waa la diray!',
      userCreated: 'Isticmaalaha cusub waa la kaddiyay!',
      userUpdated: 'Xogta isticmaalaha waa la cusbooneysiiyay!',
      searchUsers: 'Raadi isticmaale magac ama email...'
    },
    rolePermissions: {
      title: 'Shaxda Ogolaanshaha Rooshinka',
      subtitle: 'Dhammaan awoodaha 8-da rooshin ee nidaamka ERP',
      capability: 'Awoodda Nidaamka',
      adminPanel: 'Xarunta Maamulka Guud',
      posTerminal: 'Kombuyuutarka Bixinta (POS)',
      kitchenDisplay: 'Shaashada Jikada (KDS)',
      rawInventory: 'Moofada & Inventory-ga Raw-ga',
      financialLedger: 'Xisaabaadka & Kharashyada',
      staffManagement: 'Maamulka Shaqaalaha & Suppliers',
      auditReports: 'Warbixinada Xisaabaadka & Export-ka',
      aiFinancialAdvisor: 'Garaadka Xisaabaadka & AI CEO',
      manageBranchSettings: 'Maamul Habaynta Faraca',
      manageUserAccounts: 'Maamul Isticmaalayaasha & Rooshinka'
    },
    activityLogs: {
      title: 'Log-yada Dhaqdhaqaaqa',
      user: 'Isticmaalaha',
      role: 'Roll-ka',
      action: 'Tallaabada',
      details: 'Faahfaahinta',
      timestamp: 'Waqtiga',
      noLogs: 'Weli ma jiraan log-yo dhaqdhaqaaq.'
    },
    pos: {
      title: 'Kombuyuutarka Bixinta (POS)',
      subtitle: 'Bixinta tooska ah ee la xiriirta alaabta iyo jikada',
      heldOrders: 'Dalabaadka La Hakiyay',
      cashier: 'Kaashiyaha',
      searchPlaceholder: 'Raadi cunto, SKU ama barcode...',
      allCategories: 'Dhamaan',
      outOfStock: 'Waa Dhamaatay',
      leftInStock: 'Lagu Leeyahay',
      currentCart: 'Sallada Hadda',
      itemsCount: 'waxyaabood',
      dineIn: 'Halkan ku cun',
      takeout: 'Kaxayso',
      delivery: 'Kugu soo dir',
      online: 'Online',
      reserve: 'Boos qabso',
      customerLabel: 'Macaamilka',
      walkInGuest: 'Macaamil Caadi Ah',
      tableLabel: 'Miiska',
      noTableNeeded: 'Miis looma baahna',
      cartEmpty: 'Salladu waa faaruq',
      selectDishes: 'Ka dooro cuntada menu-ga si aad u samayso order',
      applyDiscount: 'Sii Dhimis',
      subtotal: 'Warta Hore',
      vat: 'Canshuur (VAT)',
      discount: 'Dhimis',
      grandTotal: 'Warta Guud',
      holdButton: 'Haki',
      payButton: 'Bixi'
    },
    orders: {
      title: 'Xarunta Dalabaadka & Jikada',
      subtitle: 'La socodka dalabaadka, shaashada KDS iyo miasada',
      pipeline: 'List-ga Dalabaadka',
      kds: 'Shaashada Jikada',
      tables: 'Miasada',
      customerLog: 'Macaamiisha',
      allOrders: 'Dhamaan Dalabaadka',
      orderDetails: 'Faahfaahinta Dalabka',
      editOrder: 'Baddal Dalabka',
      completed: 'Dhameystiran',
      inKitchen: 'Jikada',
      ready: 'Waa Diyaar',
      onDelivery: 'Waddada',
      cancelled: 'La Baajiyay',
      received: 'La Helay'
    },
    accounting: {
      title: 'Nidaamka Xisaabaadka & Maaliyadda',
      subtitle: 'Xisaabinta laba-geesoodka ah, warbixinada, bangiga iyo kharashyada',
      newJournal: 'Waraaq Xisaabeed Cusub',
      recordExpense: 'Qor Kharash',
      dashboard: 'Dashboard-ka Xisaabta',
      chartOfAccounts: 'Sallada Xisaabaadka',
      journalEntries: 'Waraaqaha Maalinlaha ah',
      generalLedger: 'Buugga Guud ee Xisaabta',
      receivables: 'Lagu leeyahay (AR)',
      payables: 'Lagu leeyahay (AP)',
      expenses: 'Kharashyada',
      cashBank: 'Lacagta & Bangiga',
      taxes: 'Canshuuraha',
      reports: 'Warbixinada Maaliyadda'
    },
    hrm: {
      title: 'Maamulka Shaqaalaha & HR',
      subtitle: 'Iimaanshada, shifts-ka, mushaaraadka, fasaxyada iyo profiles-ka',
      addEmployee: 'Kudar Shaqaale',
      dashboard: 'HR Dashboard',
      directory: 'Duhurta Shaqaalaha',
      attendance: 'Iimaanshada',
      shifts: 'Shifts-ka',
      payroll: 'Mushaaraadka',
      leave: 'Fasaxyada',
      performance: 'Qiimaynta'
    },
    crm: {
      title: 'CRM & Maamulka Macaamiisha',
      subtitle: 'Xogta macaamiisha, boorsada lacagta, dhibcaha iyo coupons-ka',
      addCustomer: 'Kudar Macaamil',
      customersList: 'List-ga Macaamiisha',
      wallet: 'Boorsada Lacagta',
      coupons: 'Coupons & Promos',
      loyalty: 'Program-ka Loyalty-ga',
      analytics: 'Analytics-ka Macaamiisha'
    },
    settings: {
      title: 'Habaynta Nidaamka & Faraca',
      subtitle: 'Habaynta maqaayada, risiidhada, canshuuraha iyo kaydka',
      general: 'Xogta Guud',
      posAndPrint: 'POS & Daabacaadda',
      taxesAndCurrency: 'Canshuuraha & Lacagta',
      notifications: 'Digiinaha',
      backupAndSync: 'Kaydka Firebase',
      saveSettings: 'Keydi Habaynta'
    },
    ai: {
      title: 'Garaadka Artificial-ka ee Ganacsiga',
      subtitle: 'Analytics-ka maaliyadda, bottleneck-yada iyo talooyinka CEO-ga',
      financialAdvisor: 'La-taliyaha Maaliyadda',
      operationsManager: 'Maamulaha Hawlaha',
      ceoCommand: 'Xarunta CEO Command',
      askAI: 'Waydiiso Garaadka AI'
    },
    dashboard: {
      ownerTitle: 'Dashboard-ka Mulkiilaha & Maamulka Guud',
      executiveSuite: 'Qaybta Maamulka',
      enterpriseVisibility: 'Muuqalka Buuxa ee Ganacsiga',
      ownerSubtitle: 'Falanqaynta maaliyadda, faa\'iidada, qiimaha stock-ka iyo waxqabadka waqtiga dhabta ah.',
      healthScore: 'Stooraha Caafimaadka Ganacsiga',
      netProfitMargin: 'Faa\'iidada Net-ka %',
      foodCogs: 'Qiimaha Cuntada (COGS)',
      totalSales: 'Wadarta Sales-ka',
      todayRevenue: 'Dakhliga Maanta',
      todayProfit: 'Faa\'iidada Maanta',
      monthlyProfit: 'Faa\'iidada Bisha',
      totalExpenses: 'Wadarta Kharashka',
      cashFlow: 'Cash Flow & Liquidity',
      totalOrders: 'Wadarta Dalabaadka',
      customerGrowth: 'Korriinka Macaamiisha',
      inventoryStatus: 'Nidaamka Stock-ka Overview',
      manageInventory: 'Maamul Inventory-ga →',
      totalItems: 'Wadarta Cuntooyinka',
      healthyStock: 'Stock Wacan',
      lowStockAlerts: 'Digiinaha Stock-ka Chiy',
      employeeLeaderboard: 'Kala Sarreynta Shaqaalaha',
      staffPortal: 'Portal-ka Shaqaalaha →',
      managerTitle: 'Dashboard-ka Maamulaha Maqaayada',
      shiftOperations: 'Shaqada Shift-ka',
      managerControlRoom: 'Qolka Control-ka Maamulaha',
      managerSubtitle: 'Qaybta dalabaadka jikada, habka delivery-ga, imaatinka shaqaalaha iyo stock-ka.',
      openPos: 'Fur POS Terminal-ka',
      activeOrdersQueue: 'Dalabaadka Safka Inoo Jira',
      dailyRevenue: 'Dakhliga Maanta',
      kitchenPrepItems: 'Cuntooyinka Jikada ku jira',
      deliveryOrders: 'Dalabaadka Delivery-ga',
      accountantTitle: 'Dashboard-ka Xisaabaadka & Maaliyadda',
      financialControl: 'Xakameynta Maaliyadda & CPA',
      generalLedgerAudit: 'Buugga Xisaabaadka & Audit-ka',
      accountantSubtitle: 'Baaritaanka P&L, xisaabaadka alaab-qeybiyeyaasha, bangiga iyo canshuuraha.',
      fullLedger: 'Buugga Xisaabaadka Buuxa',
      netRevenue: 'Dakhliga Net-ka',
      grossProfit: 'Faa\'iidada Gross-ka',
      netOperatingProfit: 'Faa\'iidada Hawlgalka',
      operatingExpenses: 'Kharashka Hawlgalka',
      estVatPayable: 'Canshuurta VAT-ka ee La Qiyaasay',
      cashierTitle: 'Dashboard-ka Cashier-ka & POS Terminal-ka',
      terminalActive: 'Terminal-ku waa Active',
      shiftCashierCounter: 'Counter-ka Cashier-ka',
      cashierSubtitle: 'Lasocodka safka macaamiisha, hababka lacag bixinta iyo register-ka.',
      launchPos: 'Fur POS Checkout-ka',
      newOrdersQueue: 'Dalabaadka Cusub',
      completedOrdersToday: 'Dalabaadka Maanta Dhameystirmay',
      dailySalesTotal: 'Wadarta Sales-ka Maanta',
      kitchenTitle: 'Dashboard-ka Jikada & Diyaarinta Cuntada (KDS)',
      lineChefKds: 'KDS-ka Jikada',
      kitchenDisplayScreen: 'Daaqada Jikada',
      kitchenSubtitle: 'Safka dalabaadka jikada, noocyada cuntada iyo waqtiga diyaarinta.',
      stationsActive: 'Jikadu waa Active',
      preparingOnStove: 'Diyaarinta Shooladda/Shiilka',
      readyForPickup: 'Diyaar u ah Qaadashada',
      delayedAlerts: 'Digiinaha Daaha',
      adminTitle: 'Dashboard-ka Maamulaha Guud ee System-ka',
      systemAdmin: 'Maamulaha System-ka',
      fullRbac: 'Access-ka Buuxa ee System-ka',
      adminSubtitle: 'Maamulida xuquuqda, akoonnada shaqaalaha iyo amaanka.',
      openAdminControl: 'Fur Admin Control Panel →',
      waiterTitle: 'Dashboard-ka Waiter-ka & Hoolka',
      floorStaff: 'Shaqaalaha Hoolka',
      waiterSubtitle: 'Lasocodka miisaska, cuntooyinka jikada ka soo baxay iyo adeegga hoolka.',
      createTableOrder: '+ Fur Dalab Miis'
    }
  }
};
