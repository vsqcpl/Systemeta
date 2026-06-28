import { create } from 'zustand';
import { VSQCData, Project, Task, TaskComment, LeaveRequest, Expense, Notification, Timesheet, Invoice, User, Consultant, Client, ClientContact, ClientCall, ClientMeeting, FollowUp, Requirement, Opportunity, RequirementStatus } from './data/types';
import { INITIAL_VSQC_DATA } from './data/mockData';
import { formatCurrency, setGlobalCurrencyFormat, setGlobalCurrencySymbol } from './utils';

export const NAVIGATION_TRANSLATIONS: Record<string, Record<string, string>> = {
  "English (US)": {
    dashboard: "Executive Dashboard",
    projects: "Project Portfolio",
    project: "Project Dashboard",
    tasks: "Task Management",
    resources: "Resource Planning",
    timesheets: "Timesheets",
    leave: "Leave Management",
    expenses: "Travel & Expenses",
    billing: "Billing & Finance",
    analytics: "Consultant Analytics",
    ai: "AI Center",
    admin: "Admin Panel",
    systemAdmin: "System administration",
    saveChanges: "Save Changes",
    exportCsv: "Export CSV",
    cancel: "Cancel",
    search: "Search",
    generalSettings: "General Settings",
    notificationsSettings: "Notifications Settings",
    securitySettings: "Security Settings",
    integrationsSettings: "Integrations Settings"
  },
  "English (UK)": {
    dashboard: "Executive Dashboard",
    projects: "Project Portfolio",
    project: "Project Dashboard",
    tasks: "Task Management",
    resources: "Resource Planning",
    timesheets: "Timesheets",
    leave: "Leave Management",
    expenses: "Travel & Expenses",
    billing: "Billing & Finance",
    analytics: "Consultant Analytics",
    ai: "AI Center",
    admin: "Admin Panel",
    systemAdmin: "System administration",
    saveChanges: "Save Changes",
    exportCsv: "Export CSV",
    cancel: "Cancel",
    search: "Search",
    generalSettings: "General Settings",
    notificationsSettings: "Notifications Settings",
    securitySettings: "Security Settings",
    integrationsSettings: "Integrations Settings"
  },
  "Hindi (हिंदी)": {
    dashboard: "कार्यकारी डैशबोर्ड",
    projects: "परियोजना पोर्टफोलियो",
    project: "परियोजना डैशबोर्ड",
    tasks: "कार्य प्रबंधन",
    resources: "संसाधन योजना",
    timesheets: "समय पत्रक",
    leave: "अवकाश प्रबंधन",
    expenses: "यात्रा और व्यय",
    billing: "बिलिंग और वित्त",
    analytics: "सलाहकार विश्लेषिकी",
    ai: "एआई केंद्र",
    admin: "व्यवस्थापक पैनल",
    systemAdmin: "सिस्टम प्रशासन",
    saveChanges: "बदलाव सहेजें",
    exportCsv: "सीएसवी निर्यात",
    cancel: "रद्द करें",
    search: "खोजें",
    generalSettings: "सामान्य सेटिंग्स",
    notificationsSettings: "अधिसूचना सेटिंग्स",
    securitySettings: "सुरक्षा सेटिंग्स",
    integrationsSettings: "एकीकरण सेटिंग्स"
  },
  "Arabic (عربي)": {
    dashboard: "لوحة القيادة التنفيذية",
    projects: "محفظة المشاريع",
    project: "لوحة القيادة للمشروع",
    tasks: "إدارة المهام",
    resources: "تخطيط الموارد",
    timesheets: "الجداول الزمنية",
    leave: "إدارة الإجازات",
    expenses: "السفر والمصاريف",
    billing: "الفواتير والتمويل",
    analytics: "تحليلات المستشار",
    ai: "مركز الذكاء الاصطناعي",
    admin: "لوحة التحكم",
    systemAdmin: "إدارة النظام",
    saveChanges: "حفظ التغييرات",
    exportCsv: "تصدير CSV",
    cancel: "إلغاء",
    search: "بحث",
    generalSettings: "الإعدادات العامة",
    notificationsSettings: "إعدادات الإشعارات",
    securitySettings: "الإعدادات الأمنية",
    integrationsSettings: "إعدادات التكامل"
  },
  "French (Français)": {
    dashboard: "Tableau de Bord Exécutif",
    projects: "Portefeuille de Projets",
    project: "Tableau de Bord du Projet",
    tasks: "Gestion des Tâches",
    resources: "Planification des Ressources",
    timesheets: "Feuilles de Temps",
    leave: "Gestion des Congés",
    expenses: "Voyages & Dépenses",
    billing: "Facturation & Finance",
    analytics: "Analyses des Consultants",
    ai: "Centre IA",
    admin: "Panneau d'Administration",
    systemAdmin: "Administration système",
    saveChanges: "Enregistrer",
    exportCsv: "Exporter CSV",
    cancel: "Annuler",
    search: "Rechercher",
    generalSettings: "Paramètres Généraux",
    notificationsSettings: "Paramètres de Notification",
    securitySettings: "Paramètres de Sécurité",
    integrationsSettings: "Paramètres d'Intégration"
  },
  "German (Deutsch)": {
    dashboard: "Executive Dashboard",
    projects: "Projektportfolio",
    project: "Projekt-Dashboard",
    tasks: "Aufgabenverwaltung",
    resources: "Ressourcenplanung",
    timesheets: "Zeiterfassung",
    leave: "Urlaubsverwaltung",
    expenses: "Reisekosten",
    billing: "Abrechnung & Finanzen",
    analytics: "Berateranalysen",
    ai: "KI-Zentrum",
    admin: "Admin-Bereich",
    systemAdmin: "Systemverwaltung",
    saveChanges: "Speichern",
    exportCsv: "CSV exportieren",
    cancel: "Abbrechen",
    search: "Suchen",
    generalSettings: "Allgemeine Einstellungen",
    notificationsSettings: "Benachrichtigungseinstellungen",
    securitySettings: "Sicherheitseinstellungen",
    integrationsSettings: "Integrationseinstellungen"
  },
  "Spanish (Español)": {
    dashboard: "Panel Ejecutivo",
    projects: "Portafolio de Proyectos",
    project: "Panel del Proyecto",
    tasks: "Gestión de Tareas",
    resources: "Planificación de Recursos",
    timesheets: "Hojas de Tiempo",
    leave: "Gestión de Licencias",
    expenses: "Viajes y Gastos",
    billing: "Facturación y Finanzas",
    analytics: "Análisis de Consultores",
    ai: "Centro de IA",
    admin: "Panel de Administración",
    systemAdmin: "Administración del sistema",
    saveChanges: "Guardar Cambios",
    exportCsv: "Exportar CSV",
    cancel: "Cancelar",
    search: "Buscar",
    generalSettings: "Configuración General",
    notificationsSettings: "Configuración de Notificaciones",
    securitySettings: "Configuración de Seguridad",
    integrationsSettings: "Configuración de Integraciones"
  },
  "Portuguese (Português)": {
    dashboard: "Painel Executivo",
    projects: "Portfólio de Projetos",
    project: "Painel do Projeto",
    tasks: "Gestão de Tarefas",
    resources: "Planejamento de Recursos",
    timesheets: "Planilhas de Horas",
    leave: "Gestão de Licenças",
    expenses: "Viagens & Despesas",
    billing: "Faturamento & Finanças",
    analytics: "Análise de Consultores",
    ai: "Centro de IA",
    admin: "Painel de Administração",
    systemAdmin: "Administração do sistema",
    saveChanges: "Salvar Alterações",
    exportCsv: "Exportar CSV",
    cancel: "Cancelar",
    search: "Buscar",
    generalSettings: "Configurações Gerais",
    notificationsSettings: "Configurações de Notificações",
    securitySettings: "Configurações de Segurança",
    integrationsSettings: "Configurações de Integrações"
  },
  "Japanese (日本語)": {
    dashboard: "エグゼクティブ ダッシュボード",
    projects: "プロジェクト ポートフォリオ",
    project: "プロジェクト ダッシュボード",
    tasks: "タスク管理",
    resources: "リソース計画",
    timesheets: "タイムシート",
    leave: "休暇管理",
    expenses: "出張と経費",
    billing: "請求と財務",
    analytics: "コンサルタント分析",
    ai: "AI センター",
    admin: "管理者パネル",
    systemAdmin: "システム管理",
    saveChanges: "変更を保存",
    exportCsv: "CSVエクスポート",
    cancel: "キャンセル",
    search: "検索",
    generalSettings: "一般設定",
    notificationsSettings: "通知設定",
    securitySettings: "セキュリティ設定",
    integrationsSettings: "統合設定"
  },
  "Chinese Simplified (中文)": {
    dashboard: "执行仪表板",
    projects: "项目组合",
    project: "项目仪表板",
    tasks: "任务管理",
    resources: "资源计划",
    timesheets: "工时表",
    leave: "请假管理",
    expenses: "差旅与报销",
    billing: "计费与财务",
    analytics: "顾问分析",
    ai: "AI 中心",
    admin: "管理面板",
    systemAdmin: "系统管理",
    saveChanges: "保存更改",
    exportCsv: "导出 CSV",
    cancel: "取消",
    search: "搜索",
    generalSettings: "常规设置",
    notificationsSettings: "通知设置",
    securitySettings: "安全设置",
    integrationsSettings: "集成设置"
  }
};

interface ToastState {
  message: string;
  type: 'info' | 'success' | 'warning' | 'danger';
}

export interface PermissionOverride {
  id: string;
  userId: string;
  userName?: string;
  permissionKey: string;
  granted: boolean;
  grantedBy: string;
  grantedByName?: string;
  reason: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  status?: 'pending' | 'approved' | 'revoked' | 'expired';
  createdAt: string;
  updatedAt: string;
}

interface AppStore {
  // --- UI State ---
  user: User | null;
  setUser: (user: User | null) => void;
  fetchInitialData: () => Promise<void>;
  activeModule: 'projects' | 'timesheets' | 'crm' | null;
  sidebarCollapsed: boolean;
  darkMode: boolean;
  notifOpen: boolean;
  searchOpen: boolean;
  activeProjectId: string;
  taskView: 'kanban' | 'list' | 'tree';
  projectView: 'cards' | 'table';
  projectFilterStatus: string;
  projectFilterType: string;
  projectSearch: string;
  toast: ToastState | null;

  // --- Punch Clock State ---
  punchedIn: boolean;
  punchStartTime: string | null;
  punchHoursToday: number;
  punchHoursWeek: number;

  // --- Data State ---
  data: VSQCData;

  // --- UI Actions ---
  setActiveModule: (module: 'projects' | 'timesheets' | 'crm' | null) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setDarkMode: (darkMode: boolean) => void;
  setNotifOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setActiveProjectId: (id: string) => void;
  setTaskView: (view: 'kanban' | 'list' | 'tree') => void;
  setProjectView: (view: 'cards' | 'table') => void;
  setProjectFilterStatus: (status: string) => void;
  setProjectFilterType: (type: string) => void;
  setProjectSearch: (search: string) => void;
  showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'danger') => void;
  clearToast: () => void;

  // --- Punch Clock Actions ---
  togglePunch: () => void;
  updatePunchStats: (today: number, week: number) => void;

  // --- Data CRUD Actions ---
  addProject: (project: Omit<Project, "id" | "health" | "progress" | "spent" | "team">) => void;
  addTask: (task: Omit<Task, "id" | "comments"> & { col?: "todo" | "inprogress" | "review" | "done" }) => void;
  addExpense: (expense: Omit<Expense, "id" | "status" | "receipt"> & { receiptUrl?: string }) => void;
  moveTask: (taskId: string, targetCol: "todo" | "inprogress" | "review" | "done", actualCompletionDate?: string) => void;
  addTaskComment: (taskId: string, text: string) => void;
  addSubtaskToTask: (taskId: string, subtask: { title: string; dueDate: string; description?: string; isMilestone?: boolean; status?: string }) => void;
  approveLeaveRequest: (id: string) => void;
  rejectLeaveRequest: (id: string) => void;
  addLeaveRequest: (req: Omit<LeaveRequest, "id" | "status">) => void;
  deleteLeaveRequest: (id: string) => Promise<boolean>;
  approveExpense: (id: string) => void;
  rejectExpense: (id: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  updateUserMFA: (id: string, mfa: boolean) => void;
  updateUserStatus: (id: string, status: 'active' | 'inactive') => void;
  addInvoice: (invoice: Omit<Invoice, "id" | "status">) => void;
  updateMilestone: (id: string, updates: any) => void;
  inviteUser: (user: Omit<User, "id" | "status" | "mfa" | "lastLogin">) => void;
  deleteProject: (id: string) => Promise<boolean>;
  deleteUser: (id: string) => Promise<boolean>;
  
  // --- CRM Actions ---
  addClient: (client: Omit<Client, "id" | "createdAt">) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deactivateClient: (id: string) => void;
  addContact: (contact: Omit<ClientContact, "id">) => void;
  addCall: (call: Omit<ClientCall, "id">) => void;
  addMeeting: (meeting: Omit<ClientMeeting, "id">) => void;
  addFollowUp: (followUp: Omit<FollowUp, "id">) => void;
  addRequirement: (req: Omit<Requirement, "id" | "reqNumber" | "createdAt">) => void;
  updateRequirementStatus: (id: string, status: RequirementStatus) => void;
  addOpportunity: (opp: Omit<Opportunity, "id">) => void;

  updateTimesheetHours: (
    project: string,
    task: string,
    day: number,
    hours: number,
    billable: boolean
  ) => void;
  currencyFormat: 'indian' | 'intl';
  setCurrencyFormat: (format: 'indian' | 'intl') => void;
  currencySymbol: string;
  setCurrencySymbol: (symbol: string) => void;
  timezone: string;
  setTimezone: (timezone: string) => void;
  language: string;
  setLanguage: (language: string, silent?: boolean) => void;

  // --- Permission Override State & Actions ---
  permissionOverrides: PermissionOverride[];
  fetchOverrides: () => Promise<void>;
  createOverride: (data: {
    userId: string;
    permissionKey: string;
    granted: boolean;
    reason: string;
    startDate: string;
    endDate: string;
  }) => Promise<void>;
  updateOverride: (id: string, update: {
    action: 'approve' | 'revoke' | 'extend';
    endDate?: string;
    reason?: string;
  }) => Promise<void>;
}

export const translations = {
  'en-US': {
    // Navigation
    'Executive Dashboard': 'Executive Dashboard',
    'Project Portfolio': 'Project Portfolio',
    'Project Dashboard': 'Project Dashboard',
    'Task Management': 'Task Management',
    'Resource Planning': 'Resource Planning',
    'Billing & Finance': 'Billing & Finance',
    'AI Insights Center': 'AI Insights Center',
    'Admin Panel': 'Admin Panel',
    'Timesheets': 'Timesheets',
    'Leave Management': 'Leave Management',
    'Travel & Expenses': 'Travel & Expenses',
    'Consultant Analytics': 'Consultant Analytics',
    'Gantt / Timeline': 'Gantt / Timeline',
    // Common / Admin
    'Search': 'Search',
    'Export': 'Export',
    'Save Changes': 'Save Changes',
    'Cancel': 'Cancel',
    'Export CSV': 'Export CSV',
    'Export PDF': 'Export PDF',
    'Quick Add': 'Quick Add',
    'Invite User': 'Invite User',
    'Generate Invoice': 'Generate Invoice',
    'Maintenance Mode': 'Maintenance Mode',
    'System administration': 'System administration',
    'Users': 'Users',
    'Roles & Permissions': 'Roles & Permissions',
    'Audit Log': 'Audit Log',
    'System Settings': 'System Settings',
    // Settings
    'General Settings': 'General Settings',
    'Security Settings': 'Security Settings',
    'Notifications Settings': 'Notifications Settings',
    'Integrations Settings': 'Integrations Settings',
    'Platform Name': 'Platform Name',
    'Default Currency': 'Default Currency',
    'Fiscal Year Start': 'Fiscal Year Start',
    'Timezone': 'Timezone',
    'Language / Locale': 'Language / Locale',
    'Numbering System': 'Numbering System',
    // Dashboard
    'Active Projects': 'Active Projects',
    'Delayed Tasks': 'Delayed Tasks',
    'Milestones Due': 'Milestones Due',
    'Revenue Pipeline': 'Revenue Pipeline',
    'Team Utilization': 'Team Utilization',
    'Billable Hours': 'Billable Hours',
    'Team Members': 'Team Members',
    'Client Satisfaction': 'Client Satisfaction',
    'Submit for Approval': 'Submit for Approval',
    'Submitted': 'Submitted',
    'Submit Expense': 'Submit Expense',
    'Configure AI': 'Configure AI',
    'Generate Weekly Summary': 'Generate Weekly Summary',
    'Request Leave': 'Request Leave',
  },
  'en-GB': {
    // Navigation
    'Executive Dashboard': 'Executive Dashboard',
    'Project Portfolio': 'Project Portfolio',
    'Project Dashboard': 'Project Dashboard',
    'Task Management': 'Task Management',
    'Resource Planning': 'Resource Planning',
    'Billing & Finance': 'Billing & Finance',
    'AI Insights Center': 'AI Insights Centre',
    'Admin Panel': 'Admin Panel',
    'Timesheets': 'Timesheets',
    'Leave Management': 'Leave Management',
    'Travel & Expenses': 'Travel & Expenses',
    'Consultant Analytics': 'Consultant Analytics',
    'Gantt / Timeline': 'Gantt / Timeline',
    // Common / Admin
    'Search': 'Search',
    'Export': 'Export',
    'Save Changes': 'Save Changes',
    'Cancel': 'Cancel',
    'Export CSV': 'Export CSV',
    'Export PDF': 'Export PDF',
    'Quick Add': 'Quick Add',
    'Invite User': 'Invite User',
    'Generate Invoice': 'Generate Invoice',
    'Maintenance Mode': 'Maintenance Mode',
    'System administration': 'System administration',
    'Users': 'Users',
    'Roles & Permissions': 'Roles & Permissions',
    'Audit Log': 'Audit Log',
    'System Settings': 'System Settings',
    // Settings
    'General Settings': 'General Settings',
    'Security Settings': 'Security Settings',
    'Notifications Settings': 'Notifications Settings',
    'Integrations Settings': 'Integrations Settings',
    'Platform Name': 'Platform Name',
    'Default Currency': 'Default Currency',
    'Fiscal Year Start': 'Fiscal Year Start',
    'Timezone': 'Timezone',
    'Language / Locale': 'Language / Locale',
    'Numbering System': 'Numbering System',
    // Dashboard
    'Active Projects': 'Active Projects',
    'Delayed Tasks': 'Delayed Tasks',
    'Milestones Due': 'Milestones Due',
    'Revenue Pipeline': 'Revenue Pipeline',
    'Team Utilization': 'Team Utilisation',
    'Billable Hours': 'Billable Hours',
    'Team Members': 'Team Members',
    'Client Satisfaction': 'Client Satisfaction',
    'Submit for Approval': 'Submit for Approval',
    'Submitted': 'Submitted',
    'Submit Expense': 'Submit Expense',
    'Configure AI': 'Configure AI',
    'Generate Weekly Summary': 'Generate Weekly Summary',
    'Request Leave': 'Request Leave',
  },
  'hi': {
    // Navigation
    'Executive Dashboard': 'कार्यकारी डैशबोर्ड',
    'Project Portfolio': 'प्रोजेक्ट पोर्टफोलियो',
    'Project Dashboard': 'प्रोजेक्ट डैशबोर्ड',
    'Task Management': 'कार्य प्रबंधन',
    'Resource Planning': 'संसाधन योजना',
    'Billing & Finance': 'बिलिंग और वित्त',
    'AI Insights Center': 'AI अंतर्दृष्टि केंद्र',
    'Admin Panel': 'व्यवस्थापक पैनल',
    'Timesheets': 'समय पत्रक',
    'Leave Management': 'अवकाश प्रबंधन',
    'Travel & Expenses': 'यात्रा और व्यय',
    'Consultant Analytics': 'सलाहकार विश्लेषिकी',
    'Gantt / Timeline': 'गैंट / समयरेखा',
    // Common / Admin
    'Search': 'खोजें',
    'Export': 'निर्यात',
    'Save Changes': 'परिवर्तन सहेजें',
    'Cancel': 'रद्द करें',
    'Export CSV': 'सीएसवी निर्यात',
    'Export PDF': 'पीडीएफ निर्यात',
    'Quick Add': 'त्वरित जोड़ें',
    'Invite User': 'उपयोगकर्ता को आमंत्रित करें',
    'Generate Invoice': 'चालान उत्पन्न करें',
    'Maintenance Mode': 'रखरखाव मोड',
    'System administration': 'सिस्टम प्रशासन',
    'Users': 'उपयोगकर्ता',
    'Roles & Permissions': 'भूमिकाएं और अनुमतियां',
    'Audit Log': 'ऑडिट लॉग',
    'System Settings': 'सिस्टम सेटिंग्स',
    // Settings
    'General Settings': 'सामान्य सेटिंग्स',
    'Security Settings': 'सुरक्षा सेटिंग्स',
    'Notifications Settings': 'अधिसूचना सेटिंग्स',
    'Integrations Settings': 'एकीकरण सेटिंग्स',
    'Platform Name': 'प्लेटफ़ॉर्म नाम',
    'Default Currency': 'डिफ़ॉल्ट मुद्रा',
    'Fiscal Year Start': 'वित्त वर्ष की शुरुआत',
    'Timezone': 'समय क्षेत्र',
    'Language / Locale': 'भाषा / स्थानीय',
    'Numbering System': 'नंबरिंग प्रणाली',
    // Dashboard
    'Active Projects': 'सक्रिय प्रोजेक्ट',
    'Delayed Tasks': 'विलंबित कार्य',
    'Milestones Due': 'देय मील के पत्थर',
    'Revenue Pipeline': 'राजस्व पाइपलाइन',
    'Team Utilization': 'टीम का उपयोग',
    'Billable Hours': 'बिल करने योग्य घंटे',
    'Team Members': 'टीम सदस्य',
    'Client Satisfaction': 'ग्राहक संतुष्टि',
    'Submit for Approval': 'अनुमोदन के लिए भेजें',
    'Submitted': 'प्रस्तुत किया गया',
    'Submit Expense': 'व्यय जमा करें',
    'Configure AI': 'एआई कॉन्फ़िगर करें',
    'Generate Weekly Summary': 'साप्ताहिक सारांश उत्पन्न करें',
    'Request Leave': 'छुट्टी का अनुरोध करें',
  },
  'ar': {
    // Navigation
    'Executive Dashboard': 'لوحة التحكم التنفيذية',
    'Project Portfolio': 'محفظة المشاريع',
    'Project Dashboard': 'لوحة المشروع',
    'Task Management': 'إدارة المهام',
    'Resource Planning': 'تخطيط الموارد',
    'Billing & Finance': 'الفواتير والمالية',
    'AI Insights Center': 'مركز رؤى الذكاء الاصطناعي',
    'Admin Panel': 'لوحة الإدارة',
    'Timesheets': 'الجداول الزمنية',
    'Leave Management': 'إدارة الإجازات',
    'Travel & Expenses': 'السفر والمصاريف',
    'Consultant Analytics': 'تحليلات المستشار',
    'Gantt / Timeline': 'مخطط غانت / الجدول الزمني',
    // Common / Admin
    'Search': 'بحث',
    'Export': 'تصدير',
    'Save Changes': 'حفظ التغييرات',
    'Cancel': 'إلغاء',
    'Export CSV': 'تصدير CSV',
    'Export PDF': 'تصدير PDF',
    'Quick Add': 'إضافة سريعة',
    'Invite User': 'دعوة مستخدم',
    'Generate Invoice': 'إنشاء فاتورة',
    'Maintenance Mode': 'وضع الصيانة',
    'System administration': 'إدارة النظام',
    'Users': 'المستخدمين',
    'Roles & Permissions': 'الأدوار والأذونات',
    'Audit Log': 'سجل التدقيق',
    'System Settings': 'إعدادات النظام',
    // Settings
    'General Settings': 'الإعدادات العامة',
    'Security Settings': 'الإعدادات الأمنية',
    'Notifications Settings': 'إعدادات الإشعارات',
    'Integrations Settings': 'إعدادات التكامل',
    'Platform Name': 'اسم المنصة',
    'Default Currency': 'العملة الافتراضية',
    'Fiscal Year Start': 'بداية السنة المالية',
    'Timezone': 'المنطقة الزمنية',
    'Language / Locale': 'اللغة / المنطقة المحلية',
    'Numbering System': 'نظام الترقيم',
    // Dashboard
    'Active Projects': 'المشاريع النشطة',
    'Delayed Tasks': 'المهام المتأخرة',
    'Milestones Due': 'المعالم المستحقة',
    'Revenue Pipeline': 'خط أنابيب الإيرادات',
    'Team Utilization': 'استخدام الفريق',
    'Billable Hours': 'الساعات القابلة للفوترة',
    'Team Members': 'أعضاء الفريق',
    'Client Satisfaction': 'رضا العملاء',
    'Submit for Approval': 'تقديم للموافقة',
    'Submitted': 'تم التقديم',
    'Submit Expense': 'تقديم المصاريف',
    'Configure AI': 'تكوين الذكاء الاصطناعي',
    'Generate Weekly Summary': 'توليد ملخص أسبوعي',
    'Request Leave': 'طلب إجازة',
  },
  'fr': {
    // Navigation
    'Executive Dashboard': 'Tableau de bord exécutif',
    'Project Portfolio': 'Portefeuille de projets',
    'Project Dashboard': 'Tableau de bord du projet',
    'Task Management': 'Gestion des tâches',
    'Resource Planning': 'Planification des ressources',
    'Timesheets': 'Feuilles de temps',
    'Leave Management': 'Gestion des congés',
    'Travel & Expenses': 'Déplacements et dépenses',
    'Billing & Finance': 'Facturation et finances',
    'Consultant Analytics': 'Analyses des consultants',
    'AI Insights Center': 'Centre de perspectives IA',
    'Admin Panel': 'Panneau d\'administration',
    'Gantt / Timeline': 'Gantt / Calendrier',
    // Common / Admin
    'Search': 'Rechercher',
    'Export': 'Exporter',
    'Save Changes': 'Enregistrer',
    'Cancel': 'Annuler',
    'Export CSV': 'Exporter CSV',
    'Export PDF': 'Exporter PDF',
    'Quick Add': 'Ajout rapide',
    'Invite User': 'Inviter un utilisateur',
    'Generate Invoice': 'Générer une facture',
    'Maintenance Mode': 'Mode maintenance',
    'System administration': 'Administration du système',
    'Users': 'Utilisateurs',
    'Roles & Permissions': 'Rôles et autorisations',
    'Audit Log': 'Journal d\'audit',
    'System Settings': 'Paramètres du système',
    // Settings
    'General Settings': 'Paramètres généraux',
    'Security Settings': 'Paramètres de sécurité',
    'Notifications Settings': 'Paramètres de notification',
    'Integrations Settings': 'Paramètres d\'intégration',
    'Platform Name': 'Nom de la plateforme',
    'Default Currency': 'Devise par défaut',
    'Fiscal Year Start': 'Début de l\'année fiscale',
    'Timezone': 'Fuseau horaire',
    'Language / Locale': 'Langue / Paramètres régionaux',
    'Numbering System': 'Système de numérotation',
    // Dashboard
    'Active Projects': 'Projets actifs',
    'Delayed Tasks': 'Tâches retardées',
    'Milestones Due': 'Jalons dus',
    'Revenue Pipeline': 'Pipeline de revenus',
    'Team Utilization': 'Utilisation de l\'équipe',
    'Billable Hours': 'Heures facturables',
    'Team Members': 'Membres de l\'équipe',
    'Client Satisfaction': 'Satisfaction client',
    'Submit for Approval': 'Soumettre pour approbation',
    'Submitted': 'Soumis',
    'Submit Expense': 'Soumettre la dépense',
    'Configure AI': 'Configurer l\'IA',
    'Generate Weekly Summary': 'Générer le résumé hebdomadaire',
    'Request Leave': 'Demander un congé',
  },
  'de': {
    // Navigation
    'Executive Dashboard': 'Führungs-Dashboard',
    'Project Portfolio': 'Projektportfolio',
    'Project Dashboard': 'Projekt-Dashboard',
    'Task Management': 'Aufgabenverwaltung',
    'Resource Planning': 'Ressourcenplanung',
    'Timesheets': 'Zeiterfassung',
    'Leave Management': 'Urlaubsverwaltung',
    'Travel & Expenses': 'Reisen & Spesen',
    'Billing & Finance': 'Abrechnung und Finanzen',
    'Consultant Analytics': 'Berateranalysen',
    'AI Insights Center': 'KI-Erkenntniszentrum',
    'Admin Panel': 'Verwaltungskonsole',
    'Gantt / Timeline': 'Gantt / Zeitachse',
    // Common / Admin
    'Search': 'Suchen',
    'Export': 'Exportieren',
    'Save Changes': 'Änderungen speichern',
    'Cancel': 'Abbrechen',
    'Export CSV': 'CSV exportieren',
    'Export PDF': 'PDF exportieren',
    'Quick Add': 'Schnell hinzufügen',
    'Invite User': 'Benutzer einladen',
    'Generate Invoice': 'Rechnung erstellen',
    'Maintenance Mode': 'Wartungsmodus',
    'System administration': 'Systemverwaltung',
    'Users': 'Benutzer',
    'Roles & Permissions': 'Rollen & Berechtigungen',
    'Audit Log': 'Audit-Protokoll',
    'System Settings': 'Systemeinstellungen',
    // Settings
    'General Settings': 'Allgemeine Einstellungen',
    'Security Settings': 'Sicherheitseinstellungen',
    'Notifications Settings': 'Benachrichtigungseinstellungen',
    'Integrations Settings': 'Integrationseinstellungen',
    'Platform Name': 'Plattformname',
    'Default Currency': 'Standardwährung',
    'Fiscal Year Start': 'Beginn des Geschäftsjahres',
    'Timezone': 'Zeitzone',
    'Language / Locale': 'Sprache / Gebietsschema',
    'Numbering System': 'Nummerierungssystem',
    // Dashboard
    'Active Projects': 'Aktive Projekte',
    'Delayed Tasks': 'Verzögerte Aufgaben',
    'Milestones Due': 'Fällige Meilensteine',
    'Revenue Pipeline': 'Umsatzpipeline',
    'Team Utilization': 'Teamauslastung',
    'Billable Hours': 'Abrechenbare Stunden',
    'Team Members': 'Teammitglieder',
    'Client Satisfaction': 'Kundenzufriedenheit',
    'Submit for Approval': 'Zur Genehmigung vorlegen',
    'Submitted': 'Eingereicht',
    'Submit Expense': 'Spesen einreichen',
    'Configure AI': 'KI konfigurieren',
    'Generate Weekly Summary': 'Wöchentliche Zusammenfassung erstellen',
    'Request Leave': 'Urlaub beantragen',
  },
  'es': {
    // Navigation
    'Executive Dashboard': 'Panel ejecutivo',
    'Project Portfolio': 'Cartera de proyectos',
    'Project Dashboard': 'Panel de control del proyecto',
    'Task Management': 'Gestión de tareas',
    'Resource Planning': 'Planificación de recursos',
    'Timesheets': 'Hojas de horas',
    'Leave Management': 'Gestión de permisos',
    'Travel & Expenses': 'Viajes y gastos',
    'Billing & Finance': 'Facturación y finanzas',
    'Consultant Analytics': 'Análisis de consultores',
    'AI Insights Center': 'Centro de información de IA',
    'Admin Panel': 'Panel de administración',
    'Gantt / Timeline': 'Gantt / Línea de tiempo',
    // Common / Admin
    'Search': 'Buscar',
    'Export': 'Exportar',
    'Save Changes': 'Guardar cambios',
    'Cancel': 'Cancelar',
    'Export CSV': 'Exportar CSV',
    'Export PDF': 'Exportar PDF',
    'Quick Add': 'Agregar rápido',
    'Invite User': 'Invitar usuario',
    'Generate Invoice': 'Generar factura',
    'Maintenance Mode': 'Modo de mantenimiento',
    'System administration': 'Administración del sistema',
    'Users': 'Usuarios',
    'Roles & Permissions': 'Roles y permisos',
    'Audit Log': 'Registro de auditoría',
    'System Settings': 'Configuración del sistema',
    // Settings
    'General Settings': 'Configuración general',
    'Security Settings': 'Configuración de seguridad',
    'Notifications Settings': 'Configuración de notificaciones',
    'Integrations Settings': 'Configuración de integraciones',
    'Platform Name': 'Nombre de la plataforma',
    'Default Currency': 'Moneda predeterminada',
    'Fiscal Year Start': 'Inicio del año fiscal',
    'Timezone': 'Zona horaria',
    'Language / Locale': 'Idioma / Región',
    'Numbering System': 'Sistema de numeración',
    // Dashboard
    'Active Projects': 'Proyectos activos',
    'Delayed Tasks': 'Tareas retrasadas',
    'Milestones Due': 'Hitos vencidos',
    'Revenue Pipeline': 'Flujo de ingresos',
    'Team Utilization': 'Utilización del equipo',
    'Billable Hours': 'Horas facturables',
    'Team Members': 'Miembros del equipo',
    'Client Satisfaction': 'Satisfacción del cliente',
    'Submit for Approval': 'Enviar para aprobación',
    'Submitted': 'Enviado',
    'Submit Expense': 'Presentar gasto',
    'Configure AI': 'Configurar IA',
    'Generate Weekly Summary': 'Generar resumen semanal',
    'Request Leave': 'Solicitar permiso',
  },
  'pt': {
    // Navigation
    'Executive Dashboard': 'Painel Executivo',
    'Project Portfolio': 'Portfólio de Projetos',
    'Project Dashboard': 'Painel do Projeto',
    'Task Management': 'Gestão de Tarefas',
    'Resource Planning': 'Planeamento de Recursos',
    'Billing & Finance': 'Faturação e Finanças',
    'AI Insights Center': 'Centro de Insights de IA',
    'Admin Panel': 'Painel de Administração',
    'Timesheets': 'Folhas de Horas',
    'Leave Management': 'Gestão de Ausências',
    'Travel & Expenses': 'Viagens e Despesas',
    'Consultant Analytics': 'Análise de Consultores',
    'Gantt / Timeline': 'Gantt / Cronograma',
    // Common / Admin
    'Search': 'Pesquisar',
    'Export': 'Exportar',
    'Save Changes': 'Guardar Alterações',
    'Cancel': 'Cancelar',
    'Export CSV': 'Exportar CSV',
    'Export PDF': 'Exportar PDF',
    'Quick Add': 'Adicionar',
    'Invite User': 'Convidar Utilizador',
    'Generate Invoice': 'Gerar Fatura',
    'Maintenance Mode': 'Modo de Manutenção',
    'System administration': 'Administração do Sistema',
    'Users': 'Utilizadores',
    'Roles & Permissions': 'Funções e Permissões',
    'Audit Log': 'Registo de Auditoria',
    'System Settings': 'Definições do Sistema',
    // Settings
    'General Settings': 'Definições Gerais',
    'Security Settings': 'Definições de Segurança',
    'Notifications Settings': 'Definições de Notificações',
    'Integrations Settings': 'Definições de Integrações',
    'Platform Name': 'Nome da Plataforma',
    'Default Currency': 'Moeda Predefinida',
    'Fiscal Year Start': 'Início do Ano Fiscal',
    'Timezone': 'Fuso Horário',
    'Language / Locale': 'Idioma / Região',
    'Numbering System': 'Sistema de Numeração',
    // Dashboard
    'Active Projects': 'Projetos Ativos',
    'Delayed Tasks': 'Tarefas Atrasadas',
    'Milestones Due': 'Marcos a Vencer',
    'Revenue Pipeline': 'Pipeline de Receita',
    'Team Utilization': 'Utilização da Equipa',
    'Billable Hours': 'Horas Faturáveis',
    'Team Members': 'Membros da Equipa',
    'Client Satisfaction': 'Satisfação do Cliente',
    'Submit for Approval': 'Submeter para Aprovação',
    'Submitted': 'Submetido',
    'Submit Expense': 'Submeter Despesa',
    'Configure AI': 'Configurar IA',
    'Generate Weekly Summary': 'Gerar Resumo Semanal',
    'Request Leave': 'Pedir Licença',
  },
  'ja': {
    // Navigation
    'Executive Dashboard': 'エグゼクティブダッシュボード',
    'Project Portfolio': 'プロジェクトポートフォリオ',
    'Project Dashboard': 'プロジェクトダッシュボード',
    'Task Management': 'タスク管理',
    'Resource Planning': 'リソース計画',
    'Billing & Finance': '請求と財務',
    'AI Insights Center': 'AIインサイトセンター',
    'Admin Panel': '管理パネル',
    'Timesheets': 'タイムシート',
    'Leave Management': '休暇管理',
    'Travel & Expenses': '出張と経費',
    'Consultant Analytics': 'コンサルタント分析',
    'Gantt / Timeline': 'ガント / タイムライン',
    // Common / Admin
    'Search': '検索',
    'Export': 'エクスポート',
    'Save Changes': '変更を保存',
    'Cancel': 'キャンセル',
    'Export CSV': 'CSVエクスポート',
    'Export PDF': 'PDFエクスポート',
    'Quick Add': 'クイック追加',
    'Invite User': 'ユーザーを招待',
    'Generate Invoice': '請求書を生成',
    'Maintenance Mode': 'メンテナンスモード',
    'System administration': 'システム管理',
    'Users': 'ユーザー',
    'Roles & Permissions': 'ロールと権限',
    'Audit Log': '監査ログ',
    'System Settings': 'システム設定',
    // Settings
    'General Settings': '一般設定',
    'Security Settings': 'セキュリティ設定',
    'Notifications Settings': '通知設定',
    'Integrations Settings': '統合設定',
    'Platform Name': 'プラットフォーム名',
    'Default Currency': 'デフォルト通貨',
    'Fiscal Year Start': '会計年度開始',
    'Timezone': 'タイムゾーン',
    'Language / Locale': '言語 / ロケール',
    'Numbering System': '数値システム',
    // Dashboard
    'Active Projects': 'アクティブプロジェクト',
    'Delayed Tasks': '遅延タスク',
    'Milestones Due': '期限マイルストーン',
    'Revenue Pipeline': '収益パイプライン',
    'Team Utilization': 'チーム稼働率',
    'Billable Hours': '請求可能時間',
    'Team Members': 'チームメンバー',
    'Client Satisfaction': '顧客満足度',
    'Submit for Approval': '承認申請',
    'Submitted': '提出済み',
    'Submit Expense': '経費提出',
    'Configure AI': 'AI設定',
    'Generate Weekly Summary': '週次サマリー生成',
    'Request Leave': '休暇申請',
  },
  'zh': {
    // Navigation
    'Executive Dashboard': '执行仪表板',
    'Project Portfolio': '项目组合',
    'Project Dashboard': '项目仪表板',
    'Task Management': '任务管理',
    'Resource Planning': '资源规划',
    'Billing & Finance': '账单与财务',
    'AI Insights Center': 'AI洞察中心',
    'Admin Panel': '管理面板',
    'Timesheets': '工时表',
    'Leave Management': '假期管理',
    'Travel & Expenses': '差旅与费用',
    'Consultant Analytics': '顾问分析',
    'Gantt / Timeline': '甘特图 / 时间线',
    // Common / Admin
    'Search': '搜索',
    'Export': '导出',
    'Save Changes': '保存更改',
    'Cancel': '取消',
    'Export CSV': '导出 CSV',
    'Export PDF': '导出 PDF',
    'Quick Add': '快速添加',
    'Invite User': '邀请用户',
    'Generate Invoice': '生成发票',
    'Maintenance Mode': '维护模式',
    'System administration': '系统管理',
    'Users': '用户',
    'Roles & Permissions': '角色与权限',
    'Audit Log': '审计日志',
    'System Settings': '系统设置',
    // Settings
    'General Settings': '常规设置',
    'Security Settings': '安全设置',
    'Notifications Settings': '通知设置',
    'Integrations Settings': '集成设置',
    'Platform Name': '平台名称',
    'Default Currency': '默认货币',
    'Fiscal Year Start': '财年开始',
    'Timezone': '时区',
    'Language / Locale': '语言 / 区域',
    'Numbering System': '数字系统',
    // Dashboard
    'Active Projects': '活跃项目',
    'Delayed Tasks': '延误任务',
    'Milestones Due': '到期里程碑',
    'Revenue Pipeline': '收入管道',
    'Team Utilization': '团队利用率',
    'Billable Hours': '计费工时',
    'Team Members': '团队成员',
    'Client Satisfaction': '客户满意度',
    'Submit for Approval': '提交审批',
    'Submitted': '已提交',
    'Submit Expense': '提交费用',
    'Configure AI': '配置 AI',
    'Generate Weekly Summary': '生成周报',
    'Request Leave': '申请假期',
  }
};

export const extraTranslations: Record<string, Record<string, string>> = {
  'en-US': {
    'Project Management': 'Project Management',
    'Timesheet': 'Timesheet',
    'AI Center': 'AI Center',
    'User Management': 'User Management',
    'To Do': 'To Do',
    'In Progress': 'In Progress',
    'In Review': 'In Review',
    'Done': 'Done',
    'Critical': 'Critical',
    'High': 'High',
    'Medium': 'Medium',
    'Low': 'Low',
    'Task': 'Task',
    'Project': 'Project',
    'Assignee': 'Assignee',
    'Priority': 'Priority',
    'Status': 'Status',
    'Due': 'Due',
    'Estimate': 'Estimate',
    'Progress': 'Progress',
    'Consultant': 'Consultant',
    'Role': 'Role',
    'Department': 'Department',
    'Current Projects': 'Current Projects',
    'Utilization': 'Utilization',
    'Availability': 'Availability',
    'Bill Rate': 'Bill Rate',
    'Client': 'Client',
    'Health': 'Health',
    'Budget': 'Budget',
    'Due Date': 'Due Date',
    'Manager': 'Manager',
    'Annual Entitlement': 'Annual Entitlement',
    'Used': 'Used',
    'Pending': 'Pending',
    'Remaining': 'Remaining',
    'Balance Status': 'Balance Status',
    'Amount': 'Amount',
    'Issued': 'Issued',
    'Email': 'Email',
    'MFA': 'MFA',
    'Last Login': 'Last Login',
    'Actions': 'Actions',
    'Timestamp': 'Timestamp',
    'Action': 'Action',
    'Resource': 'Resource',
    'Details': 'Details',
    'IP': 'IP',
    'Project Notifications': 'Project Notifications',
    'Timesheet Notifications': 'Timesheet Notifications',
    'Notifications': 'Notifications',
    'new': 'new',
    'Mark all read': 'Mark all read',
    'No notifications': 'No notifications',
    'Saving...': 'Saving...',
    'Save All Changes': 'Save All Changes',
    'Force MFA': 'Force MFA',
    'Session timeout (mins)': 'Session timeout (mins)',
    'Password policy': 'Password policy',
    'IP whitelist': 'IP whitelist',
    'Strong': 'Strong',
    'Basic': 'Basic',
    'Email notifications': 'Email notifications',
    'Slack integration': 'Slack integration',
    'AI alert emails': 'AI alert emails',
    'Weekly digest': 'Weekly digest',
    'Microsoft 365': 'Microsoft 365',
    'Salesforce CRM': 'Salesforce CRM',
    'Jira Sync': 'Jira Sync',
    'SAP Integration': 'SAP Integration'
  },
  'en-GB': {
    'Project Management': 'Project Management',
    'Timesheet': 'Timesheet',
    'AI Center': 'AI Centre',
    'User Management': 'User Management',
    'To Do': 'To Do',
    'In Progress': 'In Progress',
    'In Review': 'In Review',
    'Done': 'Done',
    'Critical': 'Critical',
    'High': 'High',
    'Medium': 'Medium',
    'Low': 'Low',
    'Task': 'Task',
    'Project': 'Project',
    'Assignee': 'Assignee',
    'Priority': 'Priority',
    'Status': 'Status',
    'Due': 'Due',
    'Estimate': 'Estimate',
    'Progress': 'Progress',
    'Consultant': 'Consultant',
    'Role': 'Role',
    'Department': 'Department',
    'Current Projects': 'Current Projects',
    'Utilization': 'Utilisation',
    'Availability': 'Availability',
    'Bill Rate': 'Bill Rate',
    'Client': 'Client',
    'Health': 'Health',
    'Budget': 'Budget',
    'Due Date': 'Due Date',
    'Manager': 'Manager',
    'Annual Entitlement': 'Annual Entitlement',
    'Used': 'Used',
    'Pending': 'Pending',
    'Remaining': 'Remaining',
    'Balance Status': 'Balance Status',
    'Amount': 'Amount',
    'Issued': 'Issued',
    'Email': 'Email',
    'MFA': 'MFA',
    'Last Login': 'Last Login',
    'Actions': 'Actions',
    'Timestamp': 'Timestamp',
    'Action': 'Action',
    'Resource': 'Resource',
    'Details': 'Details',
    'IP': 'IP',
    'Project Notifications': 'Project Notifications',
    'Timesheet Notifications': 'Timesheet Notifications',
    'Notifications': 'Notifications',
    'new': 'new',
    'Mark all read': 'Mark all read',
    'No notifications': 'No notifications',
    'Saving...': 'Saving...',
    'Save All Changes': 'Save All Changes',
    'Force MFA': 'Force MFA',
    'Session timeout (mins)': 'Session timeout (mins)',
    'Password policy': 'Password policy',
    'IP whitelist': 'IP whitelist',
    'Strong': 'Strong',
    'Basic': 'Basic',
    'Email notifications': 'Email notifications',
    'Slack integration': 'Slack integration',
    'AI alert emails': 'AI alert emails',
    'Weekly digest': 'Weekly digest',
    'Microsoft 365': 'Microsoft 365',
    'Salesforce CRM': 'Salesforce CRM',
    'Jira Sync': 'Jira Sync',
    'SAP Integration': 'SAP Integration'
  },
  'hi': {
    'Project Management': 'परियोजना प्रबंधन',
    'Timesheet': 'समय पत्रक',
    'AI Center': 'एआई केंद्र',
    'User Management': 'उपयोगकर्ता प्रबंधन',
    'To Do': 'करने के लिए',
    'In Progress': 'प्रगति पर',
    'In Review': 'समीक्षा में',
    'Done': 'पूर्ण',
    'Critical': 'महत्वपूर्ण',
    'High': 'उच्च',
    'Medium': 'मध्यम',
    'Low': 'कम',
    'Task': 'कार्य',
    'Project': 'परियोजना',
    'Assignee': 'सौंपा गया',
    'Priority': 'प्राथमिकता',
    'Status': 'स्थिति',
    'Due': 'देय',
    'Estimate': 'अनुमान',
    'Progress': 'प्रगति',
    'Consultant': 'सलाहकार',
    'Role': 'भूमिका',
    'Department': 'विभाग',
    'Current Projects': 'वर्तमान परियोजनाएं',
    'Utilization': 'उपयोग',
    'Availability': 'उपलब्धता',
    'Bill Rate': 'बिल दर',
    'Client': 'ग्राहक',
    'Health': 'स्वास्थ्य',
    'Budget': 'बजट',
    'Due Date': 'नियत तारीख',
    'Manager': 'प्रबंधक',
    'Annual Entitlement': 'वार्षिक पात्रता',
    'Used': 'प्रयुक्त',
    'Pending': 'लंबित',
    'Remaining': 'शेष',
    'Balance Status': 'संतुलन स्थिति',
    'Amount': 'राशि',
    'Issued': 'जारी किया गया',
    'Email': 'ईमेल',
    'MFA': 'एमएफए',
    'Last Login': 'अंतिम लॉगिन',
    'Actions': 'कार्रवाई',
    'Timestamp': 'समय-टिकट',
    'Action': 'कार्रवाई',
    'Resource': 'संसाधन',
    'Details': 'विवरण',
    'IP': 'आईपी',
    'Project Notifications': 'परियोजना सूचनाएं',
    'Timesheet Notifications': 'समय पत्रक सूचनाएं',
    'Notifications': 'सूचनाएं',
    'new': 'नया',
    'Mark all read': 'सभी को पढ़ा हुआ चिह्नित करें',
    'No notifications': 'कोई सूचना नहीं',
    'Saving...': 'सहेज रहा है...',
    'Save All Changes': 'परिवर्तन सहेजें',
    'Force MFA': 'एमएफए बाध्य करें',
    'Session timeout (mins)': 'सत्र समाप्ति (मिनट)',
    'Password policy': 'पासवर्ड नीति',
    'IP whitelist': 'आईपी श्वेतसूची',
    'Strong': 'मजबूत',
    'Basic': 'बुनियादी',
    'Email notifications': 'ईमेल सूचनाएं',
    'Slack integration': 'स्लैक एकीकरण',
    'AI alert emails': 'एआई अलर्ट ईमेल',
    'Weekly digest': 'साप्ताहिक डाइजेस्ट',
    'Microsoft 365': 'माइक्रोसॉफ्ट 365',
    'Salesforce CRM': 'सेल्सफोर्स सीआरएम',
    'Jira Sync': 'जीरा सिंक',
    'SAP Integration': 'एसएपी एकीकरण'
  },
  'ar': {
    'Project Management': 'إدارة المشاريع',
    'Timesheet': 'ورقة الوقت',
    'AI Center': 'مركز الذكاء الاصطناعي',
    'User Management': 'إدارة المستخدمين',
    'To Do': 'المهام المطلوبة',
    'In Progress': 'قيد التنفيذ',
    'In Review': 'قيد المراجعة',
    'Done': 'مكتمل',
    'Critical': 'حرج',
    'High': 'مرتفع',
    'Medium': 'متوسط',
    'Low': 'منخفض',
    'Task': 'المهمة',
    'Project': 'المشروع',
    'Assignee': 'المسؤول',
    'Priority': 'الأولوية',
    'Status': 'الحالة',
    'Due': 'تاريخ الاستحقاق',
    'Estimate': 'التقدير',
    'Progress': 'التقدم',
    'Consultant': 'المستشار',
    'Role': 'الدور',
    'Department': 'القسم',
    'Current Projects': 'المشاريع الحالية',
    'Utilization': 'الاستخدام',
    'Availability': 'الإتاحية',
    'Bill Rate': 'معدل الفوترة',
    'Client': 'العميل',
    'Health': 'الحالة الصحية',
    'Budget': 'الميزانية',
    'Due Date': 'تاريخ الاستحقاق',
    'Manager': 'المدير',
    'Annual Entitlement': 'الاستحقاق السنوي',
    'Used': 'المستخدم',
    'Pending': 'معلق',
    'Remaining': 'المتبقي',
    'Balance Status': 'حالة الرصيد',
    'Amount': 'المبلغ',
    'Issued': 'صادر',
    'Email': 'البريد الإلكتروني',
    'MFA': 'المصادقة الثنائية',
    'Last Login': 'آخر تسجيل دخول',
    'Actions': 'الإجراءات',
    'Timestamp': 'الطابع الزمني',
    'Action': 'الإجراء',
    'Resource': 'المورد',
    'Details': 'التفاصيل',
    'IP': 'عنوان IP',
    'Project Notifications': 'إشعارات المشروع',
    'Timesheet Notifications': 'إشعارات ورقة الوقت',
    'Notifications': 'الإشعارات',
    'new': 'جديد',
    'Mark all read': 'تحديد الكل كمقروء',
    'No notifications': 'لا توجد إشعارات',
    'Saving...': 'جاري الحفظ...',
    'Save All Changes': 'حفظ التغييرات',
    'Force MFA': 'فرض المصادقة الثنائية',
    'Session timeout (mins)': 'مهلة الجلسة (دقائق)',
    'Password policy': 'سياسة كلمة المرور',
    'IP whitelist': 'القائمة البيضاء لعناوين IP',
    'Strong': 'قوي',
    'Basic': 'أساسي',
    'Email notifications': 'إشعارات البريد الإلكتروني',
    'Slack integration': 'تكامل Slack',
    'AI alert emails': 'رسائل البريد الإلكتروني لتنبيهات الذكاء الاصطناعي',
    'Weekly digest': 'الملخص الأسبوعي',
    'Microsoft 365': 'مايكروسوفت 365',
    'Salesforce CRM': 'سيلز فورس CRM',
    'Jira Sync': 'مزامنة Jira',
    'SAP Integration': 'تكامل SAP'
  },
  'fr': {
    'Project Management': 'Gestion des projets',
    'Timesheet': 'Feuille de temps',
    'AI Center': 'Centre d\'IA',
    'User Management': 'Gestion des utilisateurs',
    'To Do': 'À faire',
    'In Progress': 'En cours',
    'In Review': 'En révision',
    'Done': 'Terminé',
    'Critical': 'Critique',
    'High': 'Haute',
    'Medium': 'Moyenne',
    'Low': 'Basse',
    'Task': 'Tâche',
    'Project': 'Projet',
    'Assignee': 'Assigné',
    'Priority': 'Priorité',
    'Status': 'Statut',
    'Due': 'Échéance',
    'Estimate': 'Estimation',
    'Progress': 'Progrès',
    'Consultant': 'Consultant',
    'Role': 'Rôle',
    'Department': 'Département',
    'Current Projects': 'Projets actuels',
    'Utilization': 'Utilisation',
    'Availability': 'Disponibilité',
    'Bill Rate': 'Taux facturable',
    'Client': 'Client',
    'Health': 'Santé',
    'Budget': 'Budget',
    'Due Date': 'Date d\'échéance',
    'Manager': 'Directeur',
    'Annual Entitlement': 'Droit annuel',
    'Used': 'Utilisé',
    'Pending': 'En attente',
    'Remaining': 'Restant',
    'Balance Status': 'Statut du solde',
    'Amount': 'Montant',
    'Issued': 'Émis',
    'Email': 'E-mail',
    'MFA': 'MFA',
    'Last Login': 'Dernière connexion',
    'Actions': 'Actions',
    'Timestamp': 'Horodatage',
    'Action': 'Action',
    'Resource': 'Ressource',
    'Details': 'Détails',
    'IP': 'IP',
    'Project Notifications': 'Notifications du projet',
    'Timesheet Notifications': 'Notifications de feuilles de temps',
    'Notifications': 'Notifications',
    'new': 'nouveau',
    'Mark all read': 'Tout marquer comme lu',
    'No notifications': 'Aucune notification',
    'Saving...': 'Enregistrement...',
    'Save All Changes': 'Enregistrer',
    'Force MFA': 'Forcer la MFA',
    'Session timeout (mins)': 'Expiration de session (min)',
    'Password policy': 'Politique de mot de passe',
    'IP whitelist': 'Liste blanche IP',
    'Strong': 'Fort',
    'Basic': 'De base',
    'Email notifications': 'Notifications par e-mail',
    'Slack integration': 'Intégration Slack',
    'AI alert emails': 'E-mails d\'alerte IA',
    'Weekly digest': 'Résumé hebdomadaire',
    'Microsoft 365': 'Microsoft 365',
    'Salesforce CRM': 'Salesforce CRM',
    'Jira Sync': 'Synchronisation Jira',
    'SAP Integration': 'Intégration SAP'
  },
  'de': {
    'Project Management': 'Projektmanagement',
    'Timesheet': 'Zeiterfassung',
    'AI Center': 'KI-Zentrum',
    'User Management': 'Benutzerverwaltung',
    'To Do': 'Zu erledigen',
    'In Progress': 'In Bearbeitung',
    'In Review': 'In Prüfung',
    'Done': 'Erledigt',
    'Critical': 'Kritisch',
    'High': 'Hoch',
    'Medium': 'Mittel',
    'Low': 'Niedrig',
    'Task': 'Aufgabe',
    'Project': 'Projekt',
    'Assignee': 'Zugewiesen an',
    'Priority': 'Priorität',
    'Status': 'Status',
    'Due': 'Fällig',
    'Estimate': 'Schätzung',
    'Progress': 'Fortschritt',
    'Consultant': 'Berater',
    'Role': 'Rolle',
    'Department': 'Abteilung',
    'Current Projects': 'Aktuelle Projekte',
    'Utilization': 'Auslastung',
    'Availability': 'Verfügbarkeit',
    'Bill Rate': 'Stundensatz',
    'Client': 'Kunde',
    'Health': 'Zustand',
    'Budget': 'Budget',
    'Due Date': 'Fälligkeitsdatum',
    'Manager': 'Manager',
    'Annual Entitlement': 'Jahresanspruch',
    'Used': 'Genutzt',
    'Pending': 'Ausstehend',
    'Remaining': 'Verbleibend',
    'Balance Status': 'Kontostand',
    'Amount': 'Betrag',
    'Issued': 'Ausgestellt',
    'Email': 'E-Mail',
    'MFA': 'MFA',
    'Last Login': 'Letzter Login',
    'Actions': 'Aktionen',
    'Timestamp': 'Zeitstempel',
    'Action': 'Aktion',
    'Resource': 'Ressource',
    'Details': 'Details',
    'IP': 'IP',
    'Project Notifications': 'Projektbenachrichtigungen',
    'Timesheet Notifications': 'Zeiterfassungsbenachrichtigungen',
    'Notifications': 'Benachrichtigungen',
    'new': 'neu',
    'Mark all read': 'Alle als gelesen markieren',
    'No notifications': 'Keine Benachrichtigungen',
    'Saving...': 'Wird gespeichert...',
    'Save All Changes': 'Änderungen speichern',
    'Force MFA': 'MFA erzwingen',
    'Session timeout (mins)': 'Sitzungstimeout (Min.)',
    'Password policy': 'Passwortrichtlinie',
    'IP whitelist': 'IP-Whitelist',
    'Strong': 'Stark',
    'Basic': 'Einfach',
    'Email notifications': 'E-Mail-Benachrichtigungen',
    'Slack integration': 'Slack-Integration',
    'AI alert emails': 'KI-Warn-E-Mails',
    'Weekly digest': 'Wöchentliche Zusammenfassung',
    'Microsoft 365': 'Microsoft 365',
    'Salesforce CRM': 'Salesforce CRM',
    'Jira Sync': 'Jira-Synchronisierung',
    'SAP Integration': 'SAP-Integration'
  },
  'es': {
    'Project Management': 'Gestión de proyectos',
    'Timesheet': 'Hoja de horas',
    'AI Center': 'Centro de IA',
    'User Management': 'Gestión de usuarios',
    'To Do': 'Por hacer',
    'In Progress': 'En progreso',
    'In Review': 'En revisión',
    'Done': 'Hecho',
    'Critical': 'Crítica',
    'High': 'Alta',
    'Medium': 'Media',
    'Low': 'Baja',
    'Task': 'Tarea',
    'Project': 'Proyecto',
    'Assignee': 'Asignado',
    'Priority': 'Prioridad',
    'Status': 'Estado',
    'Due': 'Vencimiento',
    'Estimate': 'Estimación',
    'Progress': 'Progreso',
    'Consultant': 'Consultor',
    'Role': 'Rol',
    'Department': 'Departamento',
    'Current Projects': 'Proyectos actuales',
    'Utilization': 'Utilización',
    'Availability': 'Disponibilidad',
    'Bill Rate': 'Tarifa de facturación',
    'Client': 'Cliente',
    'Health': 'Salud',
    'Budget': 'Presupuesto',
    'Due Date': 'Fecha de vencimiento',
    'Manager': 'Gerente',
    'Annual Entitlement': 'Derecho anual',
    'Used': 'Usado',
    'Pending': 'Pendiente',
    'Remaining': 'Restante',
    'Balance Status': 'Estado del saldo',
    'Amount': 'Cantidad',
    'Issued': 'Emitido',
    'Email': 'Correo electrónico',
    'MFA': 'MFA',
    'Last Login': 'Último inicio de sesión',
    'Actions': 'Acciones',
    'Timestamp': 'Marca de tiempo',
    'Action': 'Acción',
    'Resource': 'Recurso',
    'Details': 'Detalles',
    'IP': 'IP',
    'Project Notifications': 'Notificaciones del proyecto',
    'Timesheet Notifications': 'Notificaciones de la hoja de horas',
    'Notifications': 'Notificaciones',
    'new': 'nuevo',
    'Mark all read': 'Marcar todo como leído',
    'No notifications': 'Sin notificaciones',
    'Export CSV': 'Exportar CSV',
    'Saving...': 'Guardando...',
    'Save All Changes': 'Guardar cambios',
    'Force MFA': 'Forzar MFA',
    'Session timeout (mins)': 'Tiempo de espera de sesión (min)',
    'Password policy': 'Política de contraseñas',
    'IP whitelist': 'Lista blanca de IP',
    'Strong': 'Fuerte',
    'Basic': 'Básico',
    'Email notifications': 'Notificaciones por correo',
    'Slack integration': 'Integración con Slack',
    'AI alert emails': 'Correos de alerta de IA',
    'Weekly digest': 'Resumen semanal',
    'Microsoft 365': 'Microsoft 365',
    'Salesforce CRM': 'Salesforce CRM',
    'Jira Sync': 'Sincronización con Jira',
    'SAP Integration': 'Integración con SAP'
  },
  'pt': {
    'Project Management': 'Gestão de Projetos',
    'Timesheet': 'Folha de Horas',
    'AI Center': 'Centro de IA',
    'User Management': 'Gestão de Utilizadores',
    'To Do': 'A Fazer',
    'In Progress': 'Em Progresso',
    'In Review': 'Em Revisão',
    'Done': 'Concluído',
    'Critical': 'Crítica',
    'High': 'Alta',
    'Medium': 'Média',
    'Low': 'Baixa',
    'Task': 'Tarefa',
    'Project': 'Projeto',
    'Assignee': 'Responsável',
    'Priority': 'Prioridade',
    'Status': 'Estado',
    'Due': 'Prazo',
    'Estimate': 'Estimativa',
    'Progress': 'Progresso',
    'Consultant': 'Consultor',
    'Role': 'Função',
    'Department': 'Departamento',
    'Current Projects': 'Projetos Atuais',
    'Utilization': 'Utilização',
    'Availability': 'Disponibilidade',
    'Bill Rate': 'Taxa de Faturação',
    'Client': 'Cliente',
    'Health': 'Saúde',
    'Budget': 'Orçamento',
    'Due Date': 'Data de Vencimento',
    'Manager': 'Gestor',
    'Annual Entitlement': 'Direito Anual',
    'Used': 'Usado',
    'Pending': 'Pendente',
    'Remaining': 'Restante',
    'Balance Status': 'Estado do Saldo',
    'Amount': 'Valor',
    'Issued': 'Emitido',
    'Email': 'E-mail',
    'MFA': 'MFA',
    'Last Login': 'Último Acesso',
    'Actions': 'Ações',
    'Timestamp': 'Carimbo de Data/Hora',
    'Action': 'Ação',
    'Resource': 'Recurso',
    'Details': 'Detalhes',
    'IP': 'IP',
    'Project Notifications': 'Notificações do Projeto',
    'Timesheet Notifications': 'Notificações da Folha de Horas',
    'Notifications': 'Notificações',
    'new': 'novo',
    'Mark all read': 'Marcar tudo como lido',
    'No notifications': 'Sem notificações',
    'Export CSV': 'Exportar CSV',
    'Saving...': 'A guardar...',
    'Save All Changes': 'Guardar Alterações',
    'Force MFA': 'Forçar MFA',
    'Session timeout (mins)': 'Tempo limite da sessão (min)',
    'Password policy': 'Política de passwords',
    'IP whitelist': 'Lista branca de IP',
    'Strong': 'Forte',
    'Basic': 'Básico',
    'Email notifications': 'Notificações por e-mail',
    'Slack integration': 'Integração com Slack',
    'AI alert emails': 'E-mails de alerta de IA',
    'Weekly digest': 'Resumo semanal',
    'Microsoft 365': 'Microsoft 365',
    'Salesforce CRM': 'Salesforce CRM',
    'Jira Sync': 'Sincronização com Jira',
    'SAP Integration': 'Integração com SAP'
  },
  'ja': {
    'Project Management': 'プロジェクト管理',
    'Timesheet': 'タイムシート',
    'AI Center': 'AIセンター',
    'User Management': 'ユーザー管理',
    'To Do': '未着手',
    'In Progress': '進行中',
    'In Review': 'レビュー中',
    'Done': '完了',
    'Critical': '致命的',
    'High': '高',
    'Medium': '中',
    'Low': '低',
    'Task': 'タスク',
    'Project': 'プロジェクト',
    'Assignee': '担当者',
    'Priority': '優先度',
    'Status': 'ステータス',
    'Due': '期限',
    'Estimate': '見積',
    'Progress': '進捗',
    'Consultant': 'コンサルタント',
    'Role': '役割',
    'Department': '部署',
    'Current Projects': '現在のプロジェクト',
    'Utilization': '稼働率',
    'Availability': '空き状況',
    'Bill Rate': '請求レート',
    'Client': 'クライアント',
    'Health': '健全性',
    'Budget': '予算',
    'Due Date': '期日',
    'Manager': 'マネージャー',
    'Annual Entitlement': '年間有給日数',
    'Used': '消化済み',
    'Pending': '申請中',
    'Remaining': '残日数',
    'Balance Status': '残高ステータス',
    'Amount': '金額',
    'Issued': '発行日',
    'Email': 'メール',
    'MFA': 'MFA',
    'Last Login': '最終ログイン',
    'Actions': '操作',
    'Timestamp': 'タイムスタンプ',
    'Action': 'アクション',
    'Resource': 'リソース',
    'Details': '詳細',
    'IP': 'IPアドレス',
    'Project Notifications': 'プロジェクト通知',
    'Timesheet Notifications': 'タイムシート通知',
    'Notifications': '通知',
    'new': '新規',
    'Mark all read': 'すべて既読にする',
    'No notifications': '通知はありません',
    'Export CSV': 'CSVエクスポート',
    'Saving...': '保存中...',
    'Save All Changes': '変更を保存',
    'Force MFA': 'MFAの強制',
    'Session timeout (mins)': 'セッションタイムアウト（分）',
    'Password policy': 'パスワードポリシー',
    'IP whitelist': 'IPホワイトリスト',
    'Strong': '強力',
    'Basic': '基本',
    'Email notifications': 'メール通知',
    'Slack integration': 'Slack連携',
    'AI alert emails': 'AIアラートメール',
    'Weekly digest': '週次サマリー',
    'Microsoft 365': 'Microsoft 365',
    'Salesforce CRM': 'Salesforce CRM',
    'Jira Sync': 'Jira同期',
    'SAP Integration': 'SAP連携'
  },
  'zh': {
    'Project Management': '项目管理',
    'Timesheet': '工时表',
    'AI Center': 'AI中心',
    'User Management': '用户管理',
    'To Do': '待办',
    'In Progress': '进行中',
    'In Review': '评审中',
    'Done': '已完成',
    'Critical': '紧急',
    'High': '高',
    'Medium': '中',
    'Low': '低',
    'Task': '任务',
    'Project': '项目',
    'Assignee': '负责人',
    'Priority': '优先级',
    'Status': '状态',
    'Due': '截止',
    'Estimate': '预估',
    'Progress': '进度',
    'Consultant': '顾问',
    'Role': '角色',
    'Department': '部门',
    'Current Projects': '当前项目',
    'Utilization': '利用率',
    'Availability': '可用性',
    'Bill Rate': '计费率',
    'Client': '客户',
    'Health': '健康度',
    'Budget': '预算',
    'Due Date': '截止日期',
    'Manager': '经理',
    'Annual Entitlement': '年假额度',
    'Used': '已用',
    'Pending': '待定',
    'Remaining': '剩余',
    'Balance Status': '余额状态',
    'Amount': '金额',
    'Issued': '已发行',
    'Email': '电子邮件',
    'MFA': '多因素认证',
    'Last Login': '最后登录',
    'Actions': '操作',
    'Timestamp': '时间戳',
    'Action': '操作',
    'Resource': '资源',
    'Details': '详情',
    'IP': 'IP',
    'Project Notifications': '项目通知',
    'Timesheet Notifications': '工时表通知',
    'Notifications': '通知',
    'new': '新',
    'Mark all read': '标记全部已读',
    'No notifications': '没有通知',
    'Export CSV': '导出 CSV',
    'Saving...': '保存中...',
    'Save All Changes': '保存更改',
    'Force MFA': '强制 MFA',
    'Session timeout (mins)': '会话超时 (分钟)',
    'Password policy': '密码策略',
    'IP whitelist': 'IP 白名单',
    'Strong': '强',
    'Basic': '基础',
    'Email notifications': '邮件通知',
    'Slack integration': 'Slack 集成',
    'AI alert emails': 'AI 告警邮件',
    'Weekly digest': '每周摘要',
    'Microsoft 365': '微软 365',
    'Salesforce CRM': 'Salesforce CRM',
    'Jira Sync': 'Jira 同步',
    'SAP Integration': 'SAP 集成'
  }
};

extraTranslations['en-US']['Timesheet intelligence — efficiency, performance & expense automation'] = 'Timesheet intelligence — efficiency, performance & expense automation';
extraTranslations['en-GB']['Timesheet intelligence — efficiency, performance & expense automation'] = 'Timesheet intelligence — efficiency, performance & expense automation';
extraTranslations['hi']['Timesheet intelligence — efficiency, performance & expense automation'] = 'समय पत्रक खुफिया — दक्षता, प्रदर्शन और व्यय स्वचालन';
extraTranslations['ar']['Timesheet intelligence — efficiency, performance & expense automation'] = 'ذكاء ورقة الوقت - الكفاءة والأداء وأتمتة النفقات';
extraTranslations['fr']['Timesheet intelligence — efficiency, performance & expense automation'] = 'Intelligence des feuilles de temps — efficacité, performance et automatisation des dépenses';
extraTranslations['de']['Timesheet intelligence — efficiency, performance & expense automation'] = 'Zeiterfassungs-Intelligenz — Effizienz, Leistung & Spesen-Automatisierung';
extraTranslations['es']['Timesheet intelligence — efficiency, performance & expense automation'] = 'Inteligencia de hojas de horas: eficiencia, rendimiento y automatización de gastos';
extraTranslations['pt']['Timesheet intelligence — efficiency, performance & expense automation'] = 'Inteligência de folhas de horas — eficiência, desempenho e automação de despesas';
extraTranslations['ja']['Timesheet intelligence — efficiency, performance & expense automation'] = 'タイムシートインテリジェンス — 効率、パフォーマンス、経費自動化';
extraTranslations['zh']['Timesheet intelligence — efficiency, performance & expense automation'] = '工时表智能 — 效率、绩效与费用自动化';

extraTranslations['en-US']['Firm-wide operations performance overview'] = 'Firm-wide operations performance overview';
extraTranslations['en-GB']['Firm-wide operations performance overview'] = 'Firm-wide operations performance overview';
extraTranslations['hi']['Firm-wide operations performance overview'] = 'फर्म-व्यापी संचालन प्रदर्शन अवलोकन';
extraTranslations['ar']['Firm-wide operations performance overview'] = 'نظرة عامة على أداء العمليات على مستوى الشركة';
extraTranslations['fr']['Firm-wide operations performance overview'] = 'Aperçu des performances opérationnelles de l\'entreprise';
extraTranslations['de']['Firm-wide operations performance overview'] = 'Unternehmensweiter Überblick über die Betriebsleistung';
extraTranslations['es']['Firm-wide operations performance overview'] = 'Resumen del rendimiento operativo de toda la empresa';
extraTranslations['pt']['Firm-wide operations performance overview'] = 'Visão geral do desempenho das operações de toda a empresa';
extraTranslations['ja']['Firm-wide operations performance overview'] = '全社的な業務パフォーマンスの概要';
extraTranslations['zh']['Firm-wide operations performance overview'] = '公司范围内的运营绩效概述';

extraTranslations['en-US']['vs last month'] = 'vs last month';
extraTranslations['en-GB']['vs last month'] = 'vs last month';
extraTranslations['hi']['vs last month'] = 'पिछले महीने की तुलना में';
extraTranslations['ar']['vs last month'] = 'مقارنة بالشهر الماضي';
extraTranslations['fr']['vs last month'] = 'par rapport au mois dernier';
extraTranslations['de']['vs last month'] = 'im Vergleich zum Vormonat';
extraTranslations['es']['vs last month'] = 'frente al mes anterior';
extraTranslations['pt']['vs last month'] = 'em relação ao mês passado';
extraTranslations['ja']['vs last month'] = '先月比';
extraTranslations['zh']['vs last month'] = '与上月相比';

extraTranslations['en-US']['at risk of milestone delay'] = 'at risk of milestone delay';
extraTranslations['en-GB']['at risk of milestone delay'] = 'at risk of milestone delay';
extraTranslations['hi']['at risk of milestone delay'] = 'मील के पत्थर में देरी का जोखिम';
extraTranslations['ar']['at risk of milestone delay'] = 'معرض لخطر تأخير المعالم';
extraTranslations['fr']['at risk of milestone delay'] = 'risque de retard de jalon';
extraTranslations['de']['at risk of milestone delay'] = 'Gefahr von Meilensteinverzögerungen';
extraTranslations['es']['at risk of milestone delay'] = 'en riesgo de retraso de hitos';
extraTranslations['pt']['at risk of milestone delay'] = 'em risco de atraso de marcos';
extraTranslations['ja']['at risk of milestone delay'] = 'マイルストーン遅延リスク';
extraTranslations['zh']['at risk of milestone delay'] = '面临里程碑延期风险';

extraTranslations['en-US']['this quarter'] = 'this quarter';
extraTranslations['en-GB']['this quarter'] = 'this quarter';
extraTranslations['hi']['this quarter'] = 'इस तिमाही';
extraTranslations['ar']['this quarter'] = 'هذا الربع';
extraTranslations['fr']['this quarter'] = 'ce trimestre';
extraTranslations['de']['this quarter'] = 'dieses Quartal';
extraTranslations['es']['this quarter'] = 'este trimestre';
extraTranslations['pt']['this quarter'] = 'este trimestre';
extraTranslations['ja']['this quarter'] = '今四半期';
extraTranslations['zh']['this quarter'] = '本季度';

extraTranslations['en-US']['weighted probability'] = 'weighted probability';
extraTranslations['en-GB']['weighted probability'] = 'weighted probability';
extraTranslations['hi']['weighted probability'] = 'भारित संभावना';
extraTranslations['ar']['weighted probability'] = 'الاحتمالية المرجحة';
extraTranslations['fr']['weighted probability'] = 'probabilité pondérée';
extraTranslations['de']['weighted probability'] = 'gewichtete Wahrscheinlichkeit';
extraTranslations['es']['weighted probability'] = 'probabilidad ponderada';
extraTranslations['pt']['weighted probability'] = 'probabilidade ponderada';
extraTranslations['ja']['weighted probability'] = '加重確率';
extraTranslations['zh']['weighted probability'] = '加权概率';

extraTranslations['en-US']['vs 80% target limit'] = 'vs 80% target limit';
extraTranslations['en-GB']['vs 80% target limit'] = 'vs 80% target limit';
extraTranslations['hi']['vs 80% target limit'] = 'बनाम 80% लक्ष्य सीमा';
extraTranslations['ar']['vs 80% target limit'] = 'مقارنة بحد الهدف 80%';
extraTranslations['fr']['vs 80% target limit'] = 'par rapport à la limite cible de 80%';
extraTranslations['de']['vs 80% target limit'] = 'im Vergleich zum 80%-Zielwert';
extraTranslations['es']['vs 80% target limit'] = 'frente al límite objetivo del 80%';
extraTranslations['pt']['vs 80% target limit'] = 'em relação ao limite de meta de 80%';
extraTranslations['ja']['vs 80% target limit'] = '目標制限80%比';
extraTranslations['zh']['vs 80% target limit'] = '对比80%的目标上限';

extraTranslations['en-US']['this month'] = 'this month';
extraTranslations['en-GB']['this month'] = 'this month';
extraTranslations['hi']['this month'] = 'इस महीने';
extraTranslations['ar']['this month'] = 'هذا الشهر';
extraTranslations['fr']['this month'] = 'ce mois-ci';
extraTranslations['de']['this month'] = 'diesen Monat';
extraTranslations['es']['this month'] = 'este mes';
extraTranslations['pt']['this month'] = 'este mês';
extraTranslations['ja']['this month'] = '今月';
extraTranslations['zh']['this month'] = '本月';

extraTranslations['en-US']['active consultants'] = 'active consultants';
extraTranslations['en-GB']['active consultants'] = 'active consultants';
extraTranslations['hi']['active consultants'] = 'सक्रिय सलाहकार';
extraTranslations['ar']['active consultants'] = 'المستشارين النشطين';
extraTranslations['fr']['active consultants'] = 'consultants actifs';
extraTranslations['de']['active consultants'] = 'aktive Berater';
extraTranslations['es']['active consultants'] = 'consultores activos';
extraTranslations['pt']['active consultants'] = 'consultores ativos';
extraTranslations['ja']['active consultants'] = 'アクティブなコンサルタント';
extraTranslations['zh']['active consultants'] = '活跃顾问';

extraTranslations['en-US']['NPS survey rating'] = 'NPS survey rating';
extraTranslations['en-GB']['NPS survey rating'] = 'NPS survey rating';
extraTranslations['hi']['NPS survey rating'] = 'एनपीएस सर्वेक्षण रेटिंग';
extraTranslations['ar']['NPS survey rating'] = 'تقييم استطلاع NPS';
extraTranslations['fr']['NPS survey rating'] = 'évaluation de l\'enquête NPS';
extraTranslations['de']['NPS survey rating'] = 'NPS-Umfragebewertung';
extraTranslations['es']['NPS survey rating'] = 'calificación de la encuesta NPS';
extraTranslations['pt']['NPS survey rating'] = 'classificação da pesquisa NPS';
extraTranslations['ja']['NPS survey rating'] = 'NPS調査評価';
extraTranslations['zh']['NPS survey rating'] = 'NPS调查评分';

extraTranslations['en-US']['Revenue Performance (2026)'] = 'Revenue Performance (2026)';
extraTranslations['en-GB']['Revenue Performance (2026)'] = 'Revenue Performance (2026)';
extraTranslations['hi']['Revenue Performance (2026)'] = 'राजस्व प्रदर्शन (2026)';
extraTranslations['ar']['Revenue Performance (2026)'] = 'أداء الإيرادات (2026)';
extraTranslations['fr']['Revenue Performance (2026)'] = 'Performance des revenus (2026)';
extraTranslations['de']['Revenue Performance (2026)'] = 'Umsatzentwicklung (2026)';
extraTranslations['es']['Revenue Performance (2026)'] = 'Rendimiento de ingresos (2026)';
extraTranslations['pt']['Revenue Performance (2026)'] = 'Desempenho de Receita (2026)';
extraTranslations['ja']['Revenue Performance (2026)'] = '収益パフォーマンス (2026)';
extraTranslations['zh']['Revenue Performance (2026)'] = '收入业绩 (2026)';

extraTranslations['en-US']['Actual vs Forecast vs Target (₹)'] = 'Actual vs Forecast vs Target (₹)';
extraTranslations['en-GB']['Actual vs Forecast vs Target (₹)'] = 'Actual vs Forecast vs Target (£)';
extraTranslations['hi']['Actual vs Forecast vs Target (₹)'] = 'वास्तविक बनाम पूर्वानुमान बनाम लक्ष्य (₹)';
extraTranslations['ar']['Actual vs Forecast vs Target (₹)'] = 'الفعلي مقابل المتوقع مقابل المستهدف (₹)';
extraTranslations['fr']['Actual vs Forecast vs Target (₹)'] = 'Réel vs Prévision vs Cible (₹)';
extraTranslations['de']['Actual vs Forecast vs Target (₹)'] = 'Ist vs Prognose vs Ziel (₹)';
extraTranslations['es']['Actual vs Forecast vs Target (₹)'] = 'Real frente a previsión frente a objetivo (₹)';
extraTranslations['pt']['Actual vs Forecast vs Target (₹)'] = 'Real vs Previsto vs Meta (₹)';
extraTranslations['ja']['Actual vs Forecast vs Target (₹)'] = '実績 vs 予測 vs 目標 (₹)';
extraTranslations['zh']['Actual vs Forecast vs Target (₹)'] = '实际 vs 预测 vs 目标 (₹)';

extraTranslations['en-US']['Total Projects'] = 'Total Projects';
extraTranslations['en-GB']['Total Projects'] = 'Total Projects';
extraTranslations['hi']['Total Projects'] = 'कुल प्रोजेक्ट';
extraTranslations['ar']['Total Projects'] = 'إجمالي المشاريع';
extraTranslations['fr']['Total Projects'] = 'Total des projets';
extraTranslations['de']['Total Projects'] = 'Projekte insgesamt';
extraTranslations['es']['Total Projects'] = 'Proyectos totales';
extraTranslations['pt']['Total Projects'] = 'Total de Projetos';
extraTranslations['ja']['Total Projects'] = '総プロジェクト数';
extraTranslations['zh']['Total Projects'] = '总项目数';

extraTranslations['en-US']['Weekly Team Utilization'] = 'Weekly Team Utilization';
extraTranslations['en-GB']['Weekly Team Utilization'] = 'Weekly Team Utilization';
extraTranslations['hi']['Weekly Team Utilization'] = 'साप्ताहिक टीम उपयोग';
extraTranslations['ar']['Weekly Team Utilization'] = 'استخدام الفريق الأسبوعي';
extraTranslations['fr']['Weekly Team Utilization'] = 'Utilisation hebdomadaire de l\'équipe';
extraTranslations['de']['Weekly Team Utilization'] = 'Wöchentliche Teamauslastung';
extraTranslations['es']['Weekly Team Utilization'] = 'Utilización semanal del equipo';
extraTranslations['pt']['Weekly Team Utilization'] = 'Utilização Semanal da Equipa';
extraTranslations['ja']['Weekly Team Utilization'] = '週次チーム稼働率';
extraTranslations['zh']['Weekly Team Utilization'] = '每周团队利用率';

extraTranslations['en-US']['Billable hours ratio'] = 'Billable hours ratio';
extraTranslations['en-GB']['Billable hours ratio'] = 'Billable hours ratio';
extraTranslations['hi']['Billable hours ratio'] = 'बिल करने योग्य घंटों का अनुपात';
extraTranslations['ar']['Billable hours ratio'] = 'نسبة الساعات القابلة للفوترة';
extraTranslations['fr']['Billable hours ratio'] = 'Ratio d\'heures facturables';
extraTranslations['de']['Billable hours ratio'] = 'Verhältnis abrechenbarer Stunden';
extraTranslations['es']['Billable hours ratio'] = 'Proporción de horas facturables';
extraTranslations['pt']['Billable hours ratio'] = 'Rácio de horas faturáveis';
extraTranslations['ja']['Billable hours ratio'] = '請求可能時間比率';
extraTranslations['zh']['Billable hours ratio'] = '计费工时占比';

extraTranslations['en-US']['Top Consultant Allocation'] = 'Top Consultant Allocation';
extraTranslations['en-GB']['Top Consultant Allocation'] = 'Top Consultant Allocation';
extraTranslations['hi']['Top Consultant Allocation'] = 'शीर्ष सलाहकार आवंटन';
extraTranslations['ar']['Top Consultant Allocation'] = 'تخصيص كبار المستشارين';
extraTranslations['fr']['Top Consultant Allocation'] = 'Allocation des meilleurs consultants';
extraTranslations['de']['Top Consultant Allocation'] = 'Zuweisung der Top-Berater';
extraTranslations['es']['Top Consultant Allocation'] = 'Asignación de consultores principales';
extraTranslations['pt']['Top Consultant Allocation'] = 'Alocação de Consultores Principais';
extraTranslations['ja']['Top Consultant Allocation'] = '上位コンサルタントの配置';
extraTranslations['zh']['Top Consultant Allocation'] = '顶尖顾问分配';

extraTranslations['en-US']['View Resources'] = 'View Resources';
extraTranslations['en-GB']['View Resources'] = 'View Resources';
extraTranslations['hi']['View Resources'] = 'संसाधन देखें';
extraTranslations['ar']['View Resources'] = 'عرض الموارد';
extraTranslations['fr']['View Resources'] = 'Voir les ressources';
extraTranslations['de']['View Resources'] = 'Ressourcen anzeigen';
extraTranslations['es']['View Resources'] = 'Ver recursos';
extraTranslations['pt']['View Resources'] = 'Ver Recursos';
extraTranslations['ja']['View Resources'] = 'リソースを表示';
extraTranslations['zh']['View Resources'] = '查看资源';

extraTranslations['en-US']['Utilized'] = 'Utilized';
extraTranslations['en-GB']['Utilised'] = 'Utilised';
extraTranslations['hi']['Utilized'] = 'उपयोग किया गया';
extraTranslations['ar']['Utilized'] = 'مستغل';
extraTranslations['fr']['Utilized'] = 'utilisé';
extraTranslations['de']['Utilized'] = 'ausgelastet';
extraTranslations['es']['Utilized'] = 'utilizado';
extraTranslations['pt']['Utilized'] = 'utilizado';
extraTranslations['ja']['Utilized'] = '稼働中';
extraTranslations['zh']['Utilized'] = '已利用';

extraTranslations['en-US']['Rate'] = 'Rate';
extraTranslations['en-GB']['Rate'] = 'Rate';
extraTranslations['hi']['Rate'] = 'दर';
extraTranslations['ar']['Rate'] = 'السعر';
extraTranslations['fr']['Rate'] = 'Taux';
extraTranslations['de']['Rate'] = 'Satz';
extraTranslations['es']['Rate'] = 'Tarifa';
extraTranslations['pt']['Rate'] = 'Taxa';
extraTranslations['ja']['Rate'] = 'レート';
extraTranslations['zh']['Rate'] = '费率';

extraTranslations['en-US']['hr'] = 'hr';
extraTranslations['en-GB']['hr'] = 'hr';
extraTranslations['hi']['hr'] = 'घंटा';
extraTranslations['ar']['hr'] = 'ساعة';
extraTranslations['fr']['hr'] = 'h';
extraTranslations['de']['hr'] = 'Std.';
extraTranslations['es']['hr'] = 'h';
extraTranslations['pt']['hr'] = 'h';
extraTranslations['ja']['hr'] = '時間';
extraTranslations['zh']['hr'] = '小时';

extraTranslations['en-US']['Recent Activity Feed'] = 'Recent Activity Feed';
extraTranslations['en-GB']['Recent Activity Feed'] = 'Recent Activity Feed';
extraTranslations['hi']['Recent Activity Feed'] = 'हाल की गतिविधि फ़ीड';
extraTranslations['ar']['Recent Activity Feed'] = 'موجز النشاط الأخير';
extraTranslations['fr']['Recent Activity Feed'] = 'Flux d\'activité récent';
extraTranslations['de']['Recent Activity Feed'] = 'Aktueller Aktivitäts-Feed';
extraTranslations['es']['Recent Activity Feed'] = 'Flujo de actividad reciente';
extraTranslations['pt']['Recent Activity Feed'] = 'Fluxo de Atividades Recentes';
extraTranslations['ja']['Recent Activity Feed'] = '最近のアクティビティフィード';
extraTranslations['zh']['Recent Activity Feed'] = '最新活动动态';

extraTranslations['en-US']['AI Insights'] = 'AI Insights';
extraTranslations['en-GB']['AI Insights'] = 'AI Insights';
extraTranslations['hi']['AI Insights'] = 'एआई अंतर्दृष्टि';
extraTranslations['ar']['AI Insights'] = 'رؤى الذكاء الاصطناعي';
extraTranslations['fr']['AI Insights'] = 'Perspectives IA';
extraTranslations['de']['AI Insights'] = 'KI-Erkenntnisse';
extraTranslations['es']['AI Insights'] = 'Información de IA';
extraTranslations['pt']['AI Insights'] = 'Insights de IA';
extraTranslations['ja']['AI Insights'] = 'AIインサイト';
extraTranslations['zh']['AI Insights'] = 'AI 洞察';

extraTranslations['en-US']['View All'] = 'View All';
extraTranslations['en-GB']['View All'] = 'View All';
extraTranslations['hi']['View All'] = 'सभी देखें';
extraTranslations['ar']['View All'] = 'عرض الكل';
extraTranslations['fr']['View All'] = 'Voir tout';
extraTranslations['de']['View All'] = 'Alle anzeigen';
extraTranslations['es']['View All'] = 'Ver todo';
extraTranslations['pt']['View All'] = 'Ver Tudo';
extraTranslations['ja']['View All'] = 'すべて表示';
extraTranslations['zh']['View All'] = '查看全部';

extraTranslations['en-US']['Upcoming Milestones'] = 'Upcoming Milestones';
extraTranslations['en-GB']['Upcoming Milestones'] = 'Upcoming Milestones';
extraTranslations['hi']['Upcoming Milestones'] = 'आगामी मील के पत्थर';
extraTranslations['ar']['Upcoming Milestones'] = 'المعالم القادمة';
extraTranslations['fr']['Upcoming Milestones'] = 'Jalons à venir';
extraTranslations['de']['Upcoming Milestones'] = 'Anstehende Meilensteine';
extraTranslations['es']['Upcoming Milestones'] = 'Próximos hitos';
extraTranslations['pt']['Upcoming Milestones'] = 'Próximos Marcos';
extraTranslations['ja']['Upcoming Milestones'] = '今後のマイルストーン';
extraTranslations['zh']['Upcoming Milestones'] = '即将到来的里程碑';

extraTranslations['en-US']['at risk'] = 'at risk';
extraTranslations['en-GB']['at risk'] = 'at risk';
extraTranslations['hi']['at risk'] = 'जोखिम में';
extraTranslations['ar']['at risk'] = 'في خطر';
extraTranslations['fr']['at risk'] = 'à risque';
extraTranslations['de']['at risk'] = 'gefährdet';
extraTranslations['es']['at risk'] = 'en riesgo';
extraTranslations['pt']['at risk'] = 'em risco';
extraTranslations['ja']['at risk'] = 'リスクあり';
extraTranslations['zh']['at risk'] = '存在风险';

extraTranslations['en-US']['Exporting...'] = 'Exporting...';
extraTranslations['en-GB']['Exporting...'] = 'Exporting...';
extraTranslations['hi']['Exporting...'] = 'निर्यात किया जा रहा है...';
extraTranslations['ar']['Exporting...'] = 'جاري التصدير...';
extraTranslations['fr']['Exporting...'] = 'Exportation...';
extraTranslations['de']['Exporting...'] = 'Exportieren...';
extraTranslations['es']['Exporting...'] = 'Exportando...';
extraTranslations['pt']['Exporting...'] = 'A exportar...';
extraTranslations['ja']['Exporting...'] = 'エクスポート中...';
extraTranslations['zh']['Exporting...'] = '正在导出...';

extraTranslations['en-US']['Project'] = 'Project';
extraTranslations['en-GB']['Project'] = 'Project';
extraTranslations['hi']['Project'] = 'प्रोजेक्ट';
extraTranslations['ar']['Project'] = 'المشروع';
extraTranslations['fr']['Project'] = 'Projet';
extraTranslations['de']['Project'] = 'Projekt';
extraTranslations['es']['Project'] = 'Proyecto';
extraTranslations['pt']['Project'] = 'Projeto';
extraTranslations['ja']['Project'] = 'プロジェクト';
extraTranslations['zh']['Project'] = '项目';

extraTranslations['en-US']['Action'] = 'Action';
extraTranslations['en-GB']['Action'] = 'Action';
extraTranslations['hi']['Action'] = 'कार्रवाई';
extraTranslations['ar']['Action'] = 'الإجراء';
extraTranslations['fr']['Action'] = 'Action';
extraTranslations['de']['Action'] = 'Aktion';
extraTranslations['es']['Action'] = 'Acción';
extraTranslations['pt']['Action'] = 'Ação';
extraTranslations['ja']['Action'] = 'アクション';
extraTranslations['zh']['Action'] = '操作';

extraTranslations['en-US']['June 2026'] = 'June 2026';
extraTranslations['en-GB']['June 2026'] = 'June 2026';
extraTranslations['hi']['June 2026'] = 'जून 2026';
extraTranslations['ar']['June 2026'] = 'يونيو 2026';
extraTranslations['fr']['June 2026'] = 'Juin 2026';
extraTranslations['de']['June 2026'] = 'Juni 2026';
extraTranslations['es']['June 2026'] = 'Junio 2026';
extraTranslations['pt']['June 2026'] = 'Junho 2026';
extraTranslations['ja']['June 2026'] = '2026年6月';
extraTranslations['zh']['June 2026'] = '2026年6月';

extraTranslations['en-US']['upcoming'] = 'upcoming';
extraTranslations['en-GB']['upcoming'] = 'upcoming';
extraTranslations['hi']['upcoming'] = 'आगामी';
extraTranslations['ar']['upcoming'] = 'قادم';
extraTranslations['fr']['upcoming'] = 'à venir';
extraTranslations['de']['upcoming'] = 'bevorstehend';
extraTranslations['es']['upcoming'] = 'próximo';
extraTranslations['pt']['upcoming'] = 'próximo';
extraTranslations['ja']['upcoming'] = '今後';
extraTranslations['zh']['upcoming'] = '即将到来';

extraTranslations['en-US']['delayed'] = 'delayed';
extraTranslations['en-GB']['delayed'] = 'delayed';
extraTranslations['hi']['delayed'] = 'विलंबित';
extraTranslations['ar']['delayed'] = 'متأخر';
extraTranslations['fr']['delayed'] = 'retardé';
extraTranslations['de']['delayed'] = 'verzögert';
extraTranslations['es']['delayed'] = 'retrasado';
extraTranslations['pt']['delayed'] = 'atrasado';
extraTranslations['ja']['delayed'] = '遅延';
extraTranslations['zh']['delayed'] = '已延期';

extraTranslations['en-US']['completed'] = 'completed';
extraTranslations['en-GB']['completed'] = 'completed';
extraTranslations['hi']['completed'] = 'पूरा हो गया';
extraTranslations['ar']['completed'] = 'مكتمل';
extraTranslations['fr']['completed'] = 'terminé';
extraTranslations['de']['completed'] = 'abgeschlossen';
extraTranslations['es']['completed'] = 'completado';
extraTranslations['pt']['completed'] = 'concluído';
extraTranslations['ja']['completed'] = '完了';
extraTranslations['zh']['completed'] = '已完成';

extraTranslations['en-US']['Completed task'] = 'Completed task';
extraTranslations['en-GB']['Completed task'] = 'Completed task';
extraTranslations['hi']['Completed task'] = 'कार्य पूरा किया';
extraTranslations['ar']['Completed task'] = 'أكمل المهمة';
extraTranslations['fr']['Completed task'] = 'Tâche terminée';
extraTranslations['de']['Completed task'] = 'Aufgabe abgeschlossen';
extraTranslations['es']['Completed task'] = 'Tarea completada';
extraTranslations['pt']['Completed task'] = 'Tarefa concluída';
extraTranslations['ja']['Completed task'] = 'タスクを完了';
extraTranslations['zh']['Completed task'] = '已完成任务';

extraTranslations['en-US']['Uploaded document'] = 'Uploaded document';
extraTranslations['en-GB']['Uploaded document'] = 'Uploaded document';
extraTranslations['hi']['Uploaded document'] = 'दस्तावेज़ अपलोड किया';
extraTranslations['ar']['Uploaded document'] = 'تحميل مستند';
extraTranslations['fr']['Uploaded document'] = 'Document téléchargé';
extraTranslations['de']['Uploaded document'] = 'Dokument hochgeladen';
extraTranslations['es']['Uploaded document'] = 'Documento subido';
extraTranslations['pt']['Uploaded document'] = 'Documento carregado';
extraTranslations['ja']['Uploaded document'] = 'ドキュメントをアップロード';
extraTranslations['zh']['Uploaded document'] = '已上传文件';

extraTranslations['en-US']['Flagged risk'] = 'Flagged risk';
extraTranslations['en-GB']['Flagged risk'] = 'Flagged risk';
extraTranslations['hi']['Flagged risk'] = 'जोखिम चिह्नित किया';
extraTranslations['ar']['Flagged risk'] = 'وضع علامة خطر';
extraTranslations['fr']['Flagged risk'] = 'Risque signalé';
extraTranslations['de']['Flagged risk'] = 'Risiko gemeldet';
extraTranslations['es']['Flagged risk'] = 'Riesgo marcado';
extraTranslations['pt']['Flagged risk'] = 'Risco sinalizado';
extraTranslations['ja']['Flagged risk'] = 'リスクを報告';
extraTranslations['zh']['Flagged risk'] = '已标记风险';

extraTranslations['en-US']['Submitted timesheet'] = 'Submitted timesheet';
extraTranslations['en-GB']['Submitted timesheet'] = 'Submitted timesheet';
extraTranslations['hi']['Submitted timesheet'] = 'समय पत्रक प्रस्तुत किया';
extraTranslations['ar']['Submitted timesheet'] = 'تقديم ورقة الوقت';
extraTranslations['fr']['Submitted timesheet'] = 'Feuille de temps soumise';
extraTranslations['de']['Submitted timesheet'] = 'Zeiterfassung eingereicht';
extraTranslations['es']['Submitted timesheet'] = 'Hoja de horas enviada';
extraTranslations['pt']['Submitted timesheet'] = 'Folha de horas submetida';
extraTranslations['ja']['Submitted timesheet'] = 'タイムシートを提出';
extraTranslations['zh']['Submitted timesheet'] = '已提交工时表';

extraTranslations['en-US']['Added comment'] = 'Added comment';
extraTranslations['en-GB']['Added comment'] = 'Added comment';
extraTranslations['hi']['Added comment'] = 'टिप्पणी जोड़ी';
extraTranslations['ar']['Added comment'] = 'أضاف تعليقاً';
extraTranslations['fr']['Added comment'] = 'Commentaire ajouté';
extraTranslations['de']['Added comment'] = 'Kommentar hinzugefügt';
extraTranslations['es']['Added comment'] = 'Comentario añadido';
extraTranslations['pt']['Added comment'] = 'Comentário adicionado';
extraTranslations['ja']['Added comment'] = 'コメントを追加';
extraTranslations['zh']['Added comment'] = '已添加备注';

extraTranslations['en-US']['Approved invoice'] = 'Approved invoice';
extraTranslations['en-GB']['Approved invoice'] = 'Approved invoice';
extraTranslations['hi']['Approved invoice'] = 'चालान स्वीकृत किया';
extraTranslations['ar']['Approved invoice'] = 'فاتورة معتمدة';
extraTranslations['fr']['Approved invoice'] = 'Facture approuvée';
extraTranslations['de']['Approved invoice'] = 'Rechnung genehmigt';
extraTranslations['es']['Approved invoice'] = 'Factura aprobada';
extraTranslations['pt']['Approved invoice'] = 'Fatura aprovada';
extraTranslations['ja']['Approved invoice'] = '請求書を承認';
extraTranslations['zh']['Approved invoice'] = '已批准发票';

extraTranslations['en-US']['Submitted leave request'] = 'Submitted leave request';
extraTranslations['en-GB']['Submitted leave request'] = 'Submitted leave request';
extraTranslations['hi']['Submitted leave request'] = 'छुट्टी का अनुरोध प्रस्तुत किया';
extraTranslations['ar']['Submitted leave request'] = 'تقديم طلب الإجازة';
extraTranslations['fr']['Submitted leave request'] = 'Demande de congé soumise';
extraTranslations['de']['Submitted leave request'] = 'Urlaubsantrag eingereicht';
extraTranslations['es']['Submitted leave request'] = 'Solicitud de permiso enviada';
extraTranslations['pt']['Submitted leave request'] = 'Pedido de licença submetido';
extraTranslations['ja']['Submitted leave request'] = '休暇申請を提出';
extraTranslations['zh']['Submitted leave request'] = '已提交请假申请';

extraTranslations['en-US']['AI alert generated'] = 'AI alert generated';
extraTranslations['en-GB']['AI alert generated'] = 'AI alert generated';
extraTranslations['hi']['AI alert generated'] = 'एआई चेतावनी उत्पन्न हुई';
extraTranslations['ar']['AI alert generated'] = 'تم إنشاء تنبيه الذكاء الاصطناعي';
extraTranslations['fr']['AI alert generated'] = 'Alerte IA générée';
extraTranslations['de']['AI alert generated'] = 'KI-Warnung generiert';
extraTranslations['es']['AI alert generated'] = 'Alerta de IA generada';
extraTranslations['pt']['AI alert generated'] = 'Alerta de IA gerado';
extraTranslations['ja']['AI alert generated'] = 'AIアラートが生成されました';
extraTranslations['zh']['AI alert generated'] = '已生成 AI 告警';

extraTranslations['en-US']['Reallocate resource'] = 'Reallocate resource';
extraTranslations['en-GB']['Reallocate resource'] = 'Reallocate resource';
extraTranslations['hi']['Reallocate resource'] = 'संसाधन पुन: आवंटित करें';
extraTranslations['ar']['Reallocate resource'] = 'إعادة تخصيص الموارد';
extraTranslations['fr']['Reallocate resource'] = 'Réaffecter la ressource';
extraTranslations['de']['Reallocate resource'] = 'Ressource neu zuweisen';
extraTranslations['es']['Reallocate resource'] = 'Reasignar recurso';
extraTranslations['pt']['Reallocate resource'] = 'Realocar recurso';
extraTranslations['ja']['Reallocate resource'] = 'リソースを再配分';
extraTranslations['zh']['Reallocate resource'] = '重新分配资源';

extraTranslations['en-US']['Rebalance'] = 'Rebalance';
extraTranslations['en-GB']['Rebalance'] = 'Rebalance';
extraTranslations['hi']['Rebalance'] = 'पुनः संतुलित करें';
extraTranslations['ar']['Rebalance'] = 'إعادة التوازن';
extraTranslations['fr']['Rebalance'] = 'Rééquilibrer';
extraTranslations['de']['Rebalance'] = 'Umschichten';
extraTranslations['es']['Rebalance'] = 'Reequilibrar';
extraTranslations['pt']['Rebalance'] = 'Reequilibrar';
extraTranslations['ja']['Rebalance'] = '再調整';
extraTranslations['zh']['Rebalance'] = '重新平衡';

extraTranslations['en-US']['View invoice'] = 'View invoice';
extraTranslations['en-GB']['View invoice'] = 'View invoice';
extraTranslations['hi']['View invoice'] = 'चालान देखें';
extraTranslations['ar']['View invoice'] = 'عرض الفاتورة';
extraTranslations['fr']['View invoice'] = 'Voir la facture';
extraTranslations['de']['View invoice'] = 'Rechnung anzeigen';
extraTranslations['es']['View invoice'] = 'Ver factura';
extraTranslations['pt']['View invoice'] = 'Ver fatura';
extraTranslations['ja']['View invoice'] = '請求書を表示';
extraTranslations['zh']['View invoice'] = '查看发票';

extraTranslations['en-US']['View Gantt'] = 'View Gantt';
extraTranslations['en-GB']['View Gantt'] = 'View Gantt';
extraTranslations['hi']['View Gantt'] = 'गैंट देखें';
extraTranslations['ar']['View Gantt'] = 'عرض مخطط غانت';
extraTranslations['fr']['View Gantt'] = 'Voir le Gantt';
extraTranslations['de']['View Gantt'] = 'Gantt-Diagramm anzeigen';
extraTranslations['es']['View Gantt'] = 'Ver diagrama de Gantt';
extraTranslations['pt']['View Gantt'] = 'Ver Gantt';
extraTranslations['ja']['View Gantt'] = 'ガントチャートを表示';
extraTranslations['zh']['View Gantt'] = '查看甘特图';

extraTranslations['en-US']['View resources'] = 'View resources';
extraTranslations['en-GB']['View resources'] = 'View resources';
extraTranslations['hi']['View resources'] = 'संसाधन देखें';
extraTranslations['ar']['View resources'] = 'عرض الموارد';
extraTranslations['fr']['View resources'] = 'Voir les ressources';
extraTranslations['de']['View resources'] = 'Ressourcen anzeigen';
extraTranslations['es']['View resources'] = 'Ver recursos';
extraTranslations['pt']['View resources'] = 'Ver recursos';
extraTranslations['ja']['View resources'] = 'リソースを表示';
extraTranslations['zh']['View resources'] = '查看资源';

extraTranslations['en-US']['P003 delay risk detected'] = 'P003 delay risk detected';
extraTranslations['en-GB']['P003 delay risk detected'] = 'P003 delay risk detected';
extraTranslations['hi']['P003 delay risk detected'] = 'P003 देरी का जोखिम पाया गया';
extraTranslations['ar']['P003 delay risk detected'] = 'تم الكشف عن خطر تأخير P003';
extraTranslations['fr']['P003 delay risk detected'] = 'Risque de retard P003 détecté';
extraTranslations['de']['P003 delay risk detected'] = 'P003-Verzögerungsrisiko erkannt';
extraTranslations['es']['P003 delay risk detected'] = 'Riesgo de retraso detectado en P003';
extraTranslations['pt']['P003 delay risk detected'] = 'Risco de atraso detectado no P003';
extraTranslations['ja']['P003 delay risk detected'] = 'P003の遅延リスクが検出されました';
extraTranslations['zh']['P003 delay risk detected'] = '检测到 P003 延期风险';

extraTranslations['en-US']['Sarah over-allocated next week'] = 'Sarah over-allocated next week';
extraTranslations['en-GB']['Sarah over-allocated next week'] = 'Sarah over-allocated next week';
extraTranslations['hi']['Sarah over-allocated next week'] = 'अगले सप्ताह सारा का अधिक आवंटन है';
extraTranslations['ar']['Sarah over-allocated next week'] = 'تم تخصيص سارة بشكل زائد الأسبوع المقبل';
extraTranslations['fr']['Sarah over-allocated next week'] = 'Sarah sur-allouée la semaine prochaine';
extraTranslations['de']['Sarah over-allocated next week'] = 'Sarah nächste Woche überlastet';
extraTranslations['es']['Sarah over-allocated next week'] = 'Sarah superó su asignación la próxima semana';
extraTranslations['pt']['Sarah over-allocated next week'] = 'Sarah sobre-alocada na próxima semana';
extraTranslations['ja']['Sarah over-allocated next week'] = 'サラは来週、過剰に割り当てられています';
extraTranslations['zh']['Sarah over-allocated next week'] = 'Sarah 下周过度分配';

extraTranslations['en-US']['Revenue forecast exceeds target'] = 'Revenue forecast exceeds target';
extraTranslations['en-GB']['Revenue forecast exceeds target'] = 'Revenue forecast exceeds target';
extraTranslations['hi']['Revenue forecast exceeds target'] = 'राजस्व पूर्वानुमान लक्ष्य से अधिक है';
extraTranslations['ar']['Revenue forecast exceeds target'] = 'توقعات الإيرادات تتجاوز المستهدف';
extraTranslations['fr']['Revenue forecast exceeds target'] = 'La prévision de revenus dépasse la cible';
extraTranslations['de']['Revenue forecast exceeds target'] = 'Umsatzprognose übersteigt Zielwert';
extraTranslations['es']['Revenue forecast exceeds target'] = 'La previsión de ingresos supera el objetivo';
extraTranslations['pt']['Revenue forecast exceeds target'] = 'A previsão de receita excede a meta';
extraTranslations['ja']['Revenue forecast exceeds target'] = '収益予測が目標を上回っています';
extraTranslations['zh']['Revenue forecast exceeds target'] = '收入预测超出目标';

extraTranslations['en-US']['P002 ERP go-live at risk'] = 'P002 ERP go-live at risk';
extraTranslations['en-GB']['P002 ERP go-live at risk'] = 'P002 ERP go-live at risk';
extraTranslations['hi']['P002 ERP go-live at risk'] = 'P002 ईआरपी गो-लाइव जोखिम में है';
extraTranslations['ar']['P002 ERP go-live at risk'] = 'تشغيل P002 ERP في خطر';
extraTranslations['fr']['P002 ERP go-live at risk'] = 'Lancement de l\'ERP P002 à risque';
extraTranslations['de']['P002 ERP go-live at risk'] = 'P002 ERP-Inbetriebnahme gefährdet';
extraTranslations['es']['P002 ERP go-live at risk'] = 'Lanzamiento de ERP P002 en riesgo';
extraTranslations['pt']['P002 ERP go-live at risk'] = 'Lançamento do ERP P002 em risco';
extraTranslations['ja']['P002 ERP go-live at risk'] = 'P002 ERP本番稼働リスク';
extraTranslations['zh']['P002 ERP go-live at risk'] = 'P002 ERP 上线面临风险';

extraTranslations['en-US']['Team utilization healthy'] = 'Team utilization healthy';
extraTranslations['en-GB']['Team utilization healthy'] = 'Team utilization healthy';
extraTranslations['hi']['Team utilization healthy'] = 'टीम का उपयोग स्वस्थ है';
extraTranslations['ar']['Team utilization healthy'] = 'استخدام الفريق سليم';
extraTranslations['fr']['Team utilization healthy'] = 'Utilisation de l\'équipe saine';
extraTranslations['de']['Team utilization healthy'] = 'Teamauslastung im grünen Bereich';
extraTranslations['es']['Team utilization healthy'] = 'Utilización del equipo en buen estado';
extraTranslations['pt']['Team utilization healthy'] = 'Utilização da equipa saudável';
extraTranslations['ja']['Team utilization healthy'] = 'チーム稼働率は健全です';
extraTranslations['zh']['Team utilization healthy'] = '团队利用率健康';

extraTranslations['en-US']['2 min ago'] = '2 min ago';
extraTranslations['en-GB']['2 min ago'] = '2 min ago';
extraTranslations['hi']['2 min ago'] = '2 मिनट पहले';
extraTranslations['ar']['2 min ago'] = 'قبل دقيقتين';
extraTranslations['fr']['2 min ago'] = 'il y a 2 min';
extraTranslations['de']['2 min ago'] = 'vor 2 Min.';
extraTranslations['es']['2 min ago'] = 'hace 2 min';
extraTranslations['pt']['2 min ago'] = 'há 2 min';
extraTranslations['ja']['2 min ago'] = '2分前';
extraTranslations['zh']['2 min ago'] = '2分钟前';

extraTranslations['en-US']['15 min ago'] = '15 min ago';
extraTranslations['en-GB']['15 min ago'] = '15 min ago';
extraTranslations['hi']['15 min ago'] = '15 मिनट पहले';
extraTranslations['ar']['15 min ago'] = 'قبل 15 دقيقة';
extraTranslations['fr']['15 min ago'] = 'il y a 15 min';
extraTranslations['de']['15 min ago'] = 'vor 15 Min.';
extraTranslations['es']['15 min ago'] = 'hace 15 min';
extraTranslations['pt']['15 min ago'] = 'há 15 min';
extraTranslations['ja']['15 min ago'] = '15分前';
extraTranslations['zh']['15 min ago'] = '15分钟前';

extraTranslations['en-US']['1 hr ago'] = '1 hr ago';
extraTranslations['en-GB']['1 hr ago'] = '1 hr ago';
extraTranslations['hi']['1 hr ago'] = '1 घंटा पहले';
extraTranslations['ar']['15 min ago'] = 'قبل ساعة';
extraTranslations['fr']['15 min ago'] = 'il y a 1 h';
extraTranslations['de']['15 min ago'] = 'vor 1 Std.';
extraTranslations['es']['15 min ago'] = 'hace 1 h';
extraTranslations['pt']['15 min ago'] = 'há 1 h';
extraTranslations['ja']['15 min ago'] = '1時間前';
extraTranslations['zh']['15 min ago'] = '1小时前';

extraTranslations['en-US']['2 hrs ago'] = '2 hrs ago';
extraTranslations['en-GB']['2 hrs ago'] = '2 hrs ago';
extraTranslations['hi']['2 hrs ago'] = '2 घंटे पहले';
extraTranslations['ar']['2 hrs ago'] = 'قبل ساعتين';
extraTranslations['fr']['2 hrs ago'] = 'il y a 2 h';
extraTranslations['de']['2 hrs ago'] = 'vor 2 Std.';
extraTranslations['es']['2 hrs ago'] = 'hace 2 h';
extraTranslations['pt']['2 hrs ago'] = 'há 2 h';
extraTranslations['ja']['2 hrs ago'] = '2時間前';
extraTranslations['zh']['2 hrs ago'] = '2小时前';

extraTranslations['en-US']['3 hrs ago'] = '3 hrs ago';
extraTranslations['en-GB']['3 hrs ago'] = '3 hrs ago';
extraTranslations['hi']['3 hrs ago'] = '3 घंटे पहले';
extraTranslations['ar']['3 hrs ago'] = 'قبل 3 ساعات';
extraTranslations['fr']['3 hrs ago'] = 'il y a 3 h';
extraTranslations['de']['3 hrs ago'] = 'vor 3 Std.';
extraTranslations['es']['3 hrs ago'] = 'hace 3 h';
extraTranslations['pt']['3 hrs ago'] = 'há 3 h';
extraTranslations['ja']['3 hrs ago'] = '3時間前';
extraTranslations['zh']['3 hrs ago'] = '3小时前';

extraTranslations['en-US']['5 hrs ago'] = '5 hrs ago';
extraTranslations['en-GB']['5 hrs ago'] = '5 hrs ago';
extraTranslations['hi']['5 hrs ago'] = '5 घंटे पहले';
extraTranslations['ar']['5 hrs ago'] = 'قبل 5 ساعات';
extraTranslations['fr']['5 hrs ago'] = 'il y a 5 h';
extraTranslations['de']['5 hrs ago'] = 'vor 5 Std.';
extraTranslations['es']['5 hrs ago'] = 'hace 5 h';
extraTranslations['pt']['5 hrs ago'] = 'há 5 h';
extraTranslations['ja']['5 hrs ago'] = '5時間前';
extraTranslations['zh']['5 hrs ago'] = '5小时前';

extraTranslations['en-US']['Yesterday'] = 'Yesterday';
extraTranslations['en-GB']['Yesterday'] = 'Yesterday';
extraTranslations['hi']['Yesterday'] = 'कल';
extraTranslations['ar']['Yesterday'] = 'أمس';
extraTranslations['fr']['Yesterday'] = 'Hier';
extraTranslations['de']['Yesterday'] = 'Gestern';
extraTranslations['es']['Yesterday'] = 'Ayer';
extraTranslations['pt']['Yesterday'] = 'Ontem';
extraTranslations['ja']['Yesterday'] = '昨日';
extraTranslations['zh']['Yesterday'] = '昨天';

extraTranslations['en-US']['Week of'] = 'Week of';
extraTranslations['en-GB']['Week of'] = 'Week of';
extraTranslations['hi']['Week of'] = 'सप्ताह';
extraTranslations['ar']['Week of'] = 'أسبوع';
extraTranslations['fr']['Week of'] = 'Semaine du';
extraTranslations['de']['Week of'] = 'Woche vom';
extraTranslations['es']['Week of'] = 'Semana del';
extraTranslations['pt']['Week of'] = 'Semana de';
extraTranslations['ja']['Week of'] = '週';
extraTranslations['zh']['Week of'] = '当周';

extraTranslations['en-US']['Mon'] = 'Mon';
extraTranslations['en-GB']['Mon'] = 'Mon';
extraTranslations['hi']['Mon'] = 'सोम';
extraTranslations['ar']['Mon'] = 'الاثنين';
extraTranslations['fr']['Mon'] = 'lun.';
extraTranslations['de']['Mon'] = 'Mo.';
extraTranslations['es']['Mon'] = 'lun';
extraTranslations['pt']['Mon'] = 'seg';
extraTranslations['ja']['Mon'] = '月';
extraTranslations['zh']['Mon'] = '周一';

extraTranslations['en-US']['Tue'] = 'Tue';
extraTranslations['en-GB']['Tue'] = 'Tue';
extraTranslations['hi']['Tue'] = 'मंगल';
extraTranslations['ar']['Tue'] = 'الثلاثاء';
extraTranslations['fr']['Tue'] = 'mar.';
extraTranslations['de']['Tue'] = 'Di.';
extraTranslations['es']['Tue'] = 'mar';
extraTranslations['pt']['Tue'] = 'ter';
extraTranslations['ja']['Tue'] = '火';
extraTranslations['zh']['Tue'] = '周二';

extraTranslations['en-US']['Wed'] = 'Wed';
extraTranslations['en-GB']['Wed'] = 'Wed';
extraTranslations['hi']['Wed'] = 'बुध';
extraTranslations['ar']['Wed'] = 'الأربعاء';
extraTranslations['fr']['Wed'] = 'mer.';
extraTranslations['de']['Wed'] = 'Mi.';
extraTranslations['es']['Wed'] = 'mié';
extraTranslations['pt']['Wed'] = 'qua';
extraTranslations['ja']['Wed'] = '水';
extraTranslations['zh']['Wed'] = '周三';

extraTranslations['en-US']['Thu'] = 'Thu';
extraTranslations['en-GB']['Thu'] = 'Thu';
extraTranslations['hi']['Thu'] = 'गुरु';
extraTranslations['ar']['Thu'] = 'الخميس';
extraTranslations['fr']['Thu'] = 'jeu.';
extraTranslations['de']['Thu'] = 'Do.';
extraTranslations['es']['Thu'] = 'jue';
extraTranslations['pt']['Thu'] = 'qui';
extraTranslations['ja']['Thu'] = '木';
extraTranslations['zh']['Thu'] = '周四';

extraTranslations['en-US']['Fri'] = 'Fri';
extraTranslations['en-GB']['Fri'] = 'Fri';
extraTranslations['hi']['Fri'] = 'शुक्र';
extraTranslations['ar']['Fri'] = 'الجمعة';
extraTranslations['fr']['Fri'] = 'ven.';
extraTranslations['de']['Fri'] = 'Fr.';
extraTranslations['es']['Fri'] = 'vie';
extraTranslations['pt']['Fri'] = 'sex';
extraTranslations['ja']['Fri'] = '金';
extraTranslations['zh']['Fri'] = '周五';

extraTranslations['en-US']['Sat'] = 'Sat';
extraTranslations['en-GB']['Sat'] = 'Sat';
extraTranslations['hi']['Sat'] = 'शनि';
extraTranslations['ar']['Sat'] = 'السبت';
extraTranslations['fr']['Sat'] = 'sam.';
extraTranslations['de']['Sat'] = 'Sa.';
extraTranslations['es']['Sat'] = 'sáb';
extraTranslations['pt']['Sat'] = 'sáb';
extraTranslations['ja']['Sat'] = '土';
extraTranslations['zh']['Sat'] = '周六';

extraTranslations['en-US']['Sun'] = 'Sun';
extraTranslations['en-GB']['Sun'] = 'Sun';
extraTranslations['hi']['Sun'] = 'रवि';
extraTranslations['ar']['Sun'] = 'الأحد';
extraTranslations['fr']['Sun'] = 'dim.';
extraTranslations['de']['Sun'] = 'So.';
extraTranslations['es']['Sun'] = 'dom';
extraTranslations['pt']['Sun'] = 'dom';
extraTranslations['ja']['Sun'] = '日';
extraTranslations['zh']['Sun'] = '周日';

extraTranslations['en-US']['Prev Week'] = 'Prev Week';
extraTranslations['en-GB']['Prev Week'] = 'Prev Week';
extraTranslations['hi']['Prev Week'] = 'पिछला सप्ताह';
extraTranslations['ar']['Prev Week'] = 'الأسبوع السابق';
extraTranslations['fr']['Prev Week'] = 'Semaine précédente';
extraTranslations['de']['Prev Week'] = 'Vorherige Woche';
extraTranslations['es']['Prev Week'] = 'Semana anterior';
extraTranslations['pt']['Prev Week'] = 'Semana anterior';
extraTranslations['ja']['Prev Week'] = '前週';
extraTranslations['zh']['Prev Week'] = '前一周';

extraTranslations['en-US']['Next Week'] = 'Next Week';
extraTranslations['en-GB']['Next Week'] = 'Next Week';
extraTranslations['hi']['Next Week'] = 'अगला सप्ताह';
extraTranslations['ar']['Next Week'] = 'الأسبوع القادم';
extraTranslations['fr']['Next Week'] = 'Semaine suivante';
extraTranslations['de']['Next Week'] = 'Nächste Woche';
extraTranslations['es']['Next Week'] = 'Semana siguiente';
extraTranslations['pt']['Next Week'] = 'Próxima semana';
extraTranslations['ja']['Next Week'] = '翌週';
extraTranslations['zh']['Next Week'] = '后一周';

extraTranslations['en-US']['Clocked In'] = 'Clocked In';
extraTranslations['en-GB']['Clocked In'] = 'Clocked In';
extraTranslations['hi']['Clocked In'] = 'सत्र प्रारंभ';
extraTranslations['ar']['Clocked In'] = 'تم تسجيل الدخول';
extraTranslations['fr']['Clocked In'] = 'Pointé';
extraTranslations['de']['Clocked In'] = 'Eingestempelt';
extraTranslations['es']['Clocked In'] = 'Fichado entrada';
extraTranslations['pt']['Clocked In'] = 'Entrada registada';
extraTranslations['ja']['Clocked In'] = '勤務中';
extraTranslations['zh']['Clocked In'] = '已打卡上班';

extraTranslations['en-US']['Not Clocked In'] = 'Not Clocked In';
extraTranslations['en-GB']['Not Clocked In'] = 'Not Clocked In';
extraTranslations['hi']['Not Clocked In'] = 'सत्र प्रारंभ नहीं';
extraTranslations['ar']['Not Clocked In'] = 'لم يتم تسجيل الدخول';
extraTranslations['fr']['Not Clocked In'] = 'Non pointé';
extraTranslations['de']['Not Clocked In'] = 'Nicht eingestempelt';
extraTranslations['es']['Not Clocked In'] = 'No fichado';
extraTranslations['pt']['Not Clocked In'] = 'Entrada não registada';
extraTranslations['ja']['Not Clocked In'] = '未勤務';
extraTranslations['zh']['Not Clocked In'] = '未打卡';

extraTranslations['en-US']['Punch In'] = 'Punch In';
extraTranslations['en-GB']['Punch In'] = 'Punch In';
extraTranslations['hi']['Punch In'] = 'समय दर्ज करें';
extraTranslations['ar']['Punch In'] = 'تسجيل الدخول';
extraTranslations['fr']['Punch In'] = 'Pointer';
extraTranslations['de']['Punch In'] = 'Einstempeln';
extraTranslations['es']['Punch In'] = 'Fichar entrada';
extraTranslations['pt']['Punch In'] = 'Registar entrada';
extraTranslations['ja']['Punch In'] = '出勤打刻';
extraTranslations['zh']['Punch In'] = '打卡上班';

extraTranslations['en-US']['Punch Out'] = 'Punch Out';
extraTranslations['en-GB']['Punch Out'] = 'Punch Out';
extraTranslations['hi']['Punch Out'] = 'समय समाप्त करें';
extraTranslations['ar']['Punch Out'] = 'تسجيل الخروج';
extraTranslations['fr']['Punch Out'] = 'Dépointer';
extraTranslations['de']['Punch Out'] = 'Ausstempeln';
extraTranslations['es']['Punch Out'] = 'Fichar saída';
extraTranslations['pt']['Punch Out'] = 'Registar saída';
extraTranslations['ja']['Punch Out'] = '退勤打刻';
extraTranslations['zh']['Punch Out'] = '打卡下班';

extraTranslations['en-US']['Today'] = 'Today';
extraTranslations['en-GB']['Today'] = 'Today';
extraTranslations['hi']['Today'] = 'आज';
extraTranslations['ar']['Today'] = 'اليوم';
extraTranslations['fr']['Today'] = 'Aujourd\'hui';
extraTranslations['de']['Today'] = 'Heute';
extraTranslations['es']['Today'] = 'Hoy';
extraTranslations['pt']['Today'] = 'Hoje';
extraTranslations['ja']['Today'] = '本日';
extraTranslations['zh']['Today'] = '今天';

extraTranslations['en-US']['This Week'] = 'This Week';
extraTranslations['en-GB']['This Week'] = 'This Week';
extraTranslations['hi']['This Week'] = 'इस सप्ताह';
extraTranslations['ar']['This Week'] = 'هذا الأسبوع';
extraTranslations['fr']['This Week'] = 'Cette semaine';
extraTranslations['de']['This Week'] = 'Diese Woche';
extraTranslations['es']['This Week'] = 'Esta semana';
extraTranslations['pt']['This Week'] = 'Esta semana';
extraTranslations['ja']['This Week'] = '今週';
extraTranslations['zh']['This Week'] = '本周';

extraTranslations['en-US']['Billable'] = 'Billable';
extraTranslations['en-GB']['Billable'] = 'Billable';
extraTranslations['hi']['Billable'] = 'बिल करने योग्य';
extraTranslations['ar']['Billable'] = 'قابل للفوترة';
extraTranslations['fr']['Billable'] = 'Facturable';
extraTranslations['de']['Billable'] = 'Abrechenbar';
extraTranslations['es']['Billable'] = 'Facturable';
extraTranslations['pt']['Billable'] = 'Faturável';
extraTranslations['ja']['Billable'] = '請求可能';
extraTranslations['zh']['Billable'] = '可计费';

extraTranslations['en-US']['Non-Billable'] = 'Non-Billable';
extraTranslations['en-GB']['Non-Billable'] = 'Non-Billable';
extraTranslations['hi']['Non-Billable'] = 'बिल न करने योग्य';
extraTranslations['ar']['Non-Billable'] = 'غير قابل للفوترة';
extraTranslations['fr']['Non-Billable'] = 'Non facturable';
extraTranslations['de']['Non-Billable'] = 'Nicht abrechenbar';
extraTranslations['es']['Non-Billable'] = 'No facturable';
extraTranslations['pt']['Non-Billable'] = 'Não faturável';
extraTranslations['ja']['Non-Billable'] = '請求不可';
extraTranslations['zh']['Non-Billable'] = '不可计费';

extraTranslations['en-US']['Week Summary'] = 'Week Summary';
extraTranslations['en-GB']['Week Summary'] = 'Week Summary';
extraTranslations['hi']['Week Summary'] = 'सप्ताह सारांश';
extraTranslations['ar']['Week Summary'] = 'ملخص الأسبوع';
extraTranslations['fr']['Week Summary'] = 'Résumé de la semaine';
extraTranslations['de']['Week Summary'] = 'Wochenzusammenfassung';
extraTranslations['es']['Week Summary'] = 'Resumen semanal';
extraTranslations['pt']['Week Summary'] = 'Resumo da semana';
extraTranslations['ja']['Week Summary'] = '週次サマリー';
extraTranslations['zh']['Week Summary'] = '周摘要';

extraTranslations['en-US']['Total Hours'] = 'Total Hours';
extraTranslations['en-GB']['Total Hours'] = 'Total Hours';
extraTranslations['hi']['Total Hours'] = 'कुल घंटे';
extraTranslations['ar']['Total Hours'] = 'إجمالي الساعات';
extraTranslations['fr']['Total Hours'] = 'Heures totales';
extraTranslations['de']['Total Hours'] = 'Gesamtstunden';
extraTranslations['es']['Total Hours'] = 'Horas totales';
extraTranslations['pt']['Total Hours'] = 'Total de Horas';
extraTranslations['ja']['Total Hours'] = '合計時間';
extraTranslations['zh']['Total Hours'] = '总工时';

extraTranslations['en-US']['Billable Hours'] = 'Billable Hours';
extraTranslations['en-GB']['Billable Hours'] = 'Billable Hours';
extraTranslations['hi']['Billable Hours'] = 'बिल योग्य घंटे';
extraTranslations['ar']['Billable Hours'] = 'الساعات القابلة للفوترة';
extraTranslations['fr']['Billable Hours'] = 'Heures facturables';
extraTranslations['de']['Billable Hours'] = 'Abrechenbare Stunden';
extraTranslations['es']['Billable Hours'] = 'Horas facturables';
extraTranslations['pt']['Billable Hours'] = 'Horas faturáveis';
extraTranslations['ja']['Billable Hours'] = '請求可能時間';
extraTranslations['zh']['Billable Hours'] = '计费工时';

extraTranslations['en-US']['Non-Billable Hours'] = 'Non-Billable Hours';
extraTranslations['en-GB']['Non-Billable Hours'] = 'Non-Billable Hours';
extraTranslations['hi']['Non-Billable Hours'] = 'गैर-बिल योग्य घंटे';
extraTranslations['ar']['Non-Billable Hours'] = 'الساعات غير القابلة للفوترة';
extraTranslations['fr']['Non-Billable Hours'] = 'Heures non facturables';
extraTranslations['de']['Non-Billable Hours'] = 'Nicht abrechenbar';
extraTranslations['es']['Non-Billable Hours'] = 'Horas no facturables';
extraTranslations['pt']['Non-Billable Hours'] = 'Horas não faturáveis';
extraTranslations['ja']['Non-Billable Hours'] = '請求不可時間';
extraTranslations['zh']['Non-Billable Hours'] = '非计费工时';

extraTranslations['en-US']['Target Hours'] = 'Target Hours';
extraTranslations['en-GB']['Target Hours'] = 'Target Hours';
extraTranslations['hi']['Target Hours'] = 'लक्ष्य घंटे';
extraTranslations['ar']['Target Hours'] = 'الساعات المستهدفة';
extraTranslations['fr']['Target Hours'] = 'Heures cibles';
extraTranslations['de']['Target Hours'] = 'Zielstunden';
extraTranslations['es']['Target Hours'] = 'Horas objetivo';
extraTranslations['pt']['Target Hours'] = 'Horas Meta';
extraTranslations['ja']['Target Hours'] = '目標時間';
extraTranslations['zh']['Target Hours'] = '目标工时';

extraTranslations['en-US']['Billable Ratio'] = 'Billable Ratio';
extraTranslations['en-GB']['Billable Ratio'] = 'Billable Ratio';
extraTranslations['hi']['Billable Ratio'] = 'बिल योग्य अनुपात';
extraTranslations['ar']['Billable Ratio'] = 'نسبة الساعات القابلة للفوترة';
extraTranslations['fr']['Billable Ratio'] = 'Ratio facturable';
extraTranslations['de']['Billable Ratio'] = 'Verhältnis abrechenbarer Stunden';
extraTranslations['es']['Billable Ratio'] = 'Proporción de facturación';
extraTranslations['pt']['Billable Ratio'] = 'Rácio de faturáveis';
extraTranslations['ja']['Billable Ratio'] = '請求可能比率';
extraTranslations['zh']['Billable Ratio'] = '计费率';

extraTranslations['en-US']['Project / Task'] = 'Project / Task';
extraTranslations['en-GB']['Project / Task'] = 'Project / Task';
extraTranslations['hi']['Project / Task'] = 'प्रोजेक्ट / कार्य';
extraTranslations['ar']['Project / Task'] = 'المشروع / المهمة';
extraTranslations['fr']['Project / Task'] = 'Projet / Tâche';
extraTranslations['de']['Project / Task'] = 'Projekt / Aufgabe';
extraTranslations['es']['Project / Task'] = 'Proyecto / Tarea';
extraTranslations['pt']['Project / Task'] = 'Projeto / Tarefa';
extraTranslations['ja']['Project / Task'] = 'プロジェクト / タスク';
extraTranslations['zh']['Project / Task'] = '项目 / 任务';

extraTranslations['en-US']['Total'] = 'Total';
extraTranslations['en-GB']['Total'] = 'Total';
extraTranslations['hi']['Total'] = 'कुल';
extraTranslations['ar']['Total'] = 'الإجمالي';
extraTranslations['fr']['Total'] = 'Total';
extraTranslations['de']['Total'] = 'Gesamt';
extraTranslations['es']['Total'] = 'Total';
extraTranslations['pt']['Total'] = 'Total';
extraTranslations['ja']['Total'] = '合計';
extraTranslations['zh']['Total'] = '总计';

extraTranslations['en-US']['Daily Total'] = 'Daily Total';
extraTranslations['en-GB']['Daily Total'] = 'Daily Total';
extraTranslations['hi']['Daily Total'] = 'दैनिक कुल';
extraTranslations['ar']['Daily Total'] = 'إجمالي اليوم';
extraTranslations['fr']['Daily Total'] = 'Total quotidien';
extraTranslations['de']['Daily Total'] = 'Tagesgesamt';
extraTranslations['es']['Daily Total'] = 'Total diario';
extraTranslations['pt']['Daily Total'] = 'Total diário';
extraTranslations['ja']['Daily Total'] = '日次合計';
extraTranslations['zh']['Daily Total'] = '每日总计';


export function getLangCode(language: string): string {
  const langCodes: Record<string, string> = {
    "English (US)": "en-US",
    "English (UK)": "en-GB",
    "English (India)": "en-IN",
    "Hindi (हिंदी)": "hi",
    "Arabic (عربي)": "ar",
    "French (Français)": "fr",
    "German (Deutsch)": "de",
    "Spanish (Español)": "es",
    "Portuguese (Português)": "pt",
    "Japanese (日本語)": "ja",
    "Chinese Simplified (中文)": "zh"
  };
  return langCodes[language] || "en-US";
}

export function useTranslation() {
  const language = useAppStore((state) => state.language);
  const langCode = getLangCode(language);
  const t = (key: string) => {
    // Look up in extraTranslations first
    const extraLangDict = (extraTranslations as any)[langCode];
    if (extraLangDict && key in extraLangDict) {
      return extraLangDict[key];
    }
    const langDict = translations[langCode as keyof typeof translations];
    if (langDict && key in langDict) {
      return langDict[key as keyof typeof langDict];
    }
    // Fallback to extraTranslations en-US
    const extraEnDict = extraTranslations['en-US'];
    if (extraEnDict && key in extraEnDict) {
      return extraEnDict[key];
    }
    // Fallback to en-US translation if it exists
    const enDict = translations['en-US'];
    if (enDict && key in enDict) {
      return enDict[key as keyof typeof enDict];
    }
    return key;
  };
  return { t, language, langCode };
}

const mapUserToUser = (user: any): User => {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status || "active",
    lastLogin: user.lastLogin || "—",
    mfa: user.mfa || false,
    clientId: user.clientId || undefined,
  };
};

const mapUserToConsultant = (user: any, timesheets?: any[]): Consultant => {
  const roleName = user.role;
  let dept = "Technology";
  let color = "#6366f1";
  let billRate = 240;
  let skills = ["Technology"];
  
  if (roleName === "super_admin" || roleName === "Super Admin") {
    dept = "Administration";
    color = "#ef4444";
    billRate = 500;
    skills = ["Administration", "Security"];
  } else if (roleName === "accounts" || roleName === "Accounts") {
    dept = "Finance";
    color = "#ef4444";
    billRate = 480;
    skills = ["Finance", "Strategy"];
  } else if (roleName === "project_manager" || roleName === "Project Manager") {
    dept = "Strategy";
    color = "#6366f1";
    billRate = 350;
    skills = ["Strategy", "Change Mgmt", "ERP"];
  } else if (roleName === "senior_consultant" || roleName === "Senior Consultant") {
    dept = "Operations";
    color = "#10b981";
    billRate = 280;
    skills = ["Security", "Audit", "Compliance"];
  } else if (roleName === "consultant" || roleName === "Consultant") {
    dept = "Analytics";
    color = "#ec4899";
    billRate = 240;
    skills = ["Data", "BI", "Python"];
  }

  const avatar = user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  // Dynamic utilization calculation based on timesheet hours
  let utilization = 0;
  if (timesheets && timesheets.length > 0) {
    const userTimesheets = timesheets.filter((t: any) => t.consultant === user.id);
    if (userTimesheets.length > 0) {
      let totalHours = 0;
      userTimesheets.forEach((ts: any) => {
        if (ts.entries && Array.isArray(ts.entries)) {
          ts.entries.forEach((e: any) => {
            totalHours += e.hours;
          });
        }
      });
      utilization = Math.min(100, Math.round((totalHours / (userTimesheets.length * 40)) * 100));
    }
  }

  const availability = 100 - utilization;

  return {
    id: user.id,
    name: user.name,
    role: user.role === "super_admin" ? "Super Admin" : user.role === "client_manager" ? "Client Manager" : user.role === "project_manager" ? "Project Manager" : user.role === "senior_consultant" ? "Senior Consultant" : user.role === "consultant" ? "Consultant" : user.role === "accounts" ? "Accounts" : user.role === "client_contact" ? "Client Contact" : user.role,
    dept,
    utilization,
    availability,
    avatar,
    color,
    billRate,
    skills,
  };
};

export const useAppStore = create<AppStore>((set, get) => ({
  // --- UI State Defaults ---
  user: null,
  setUser: (user) => set({ user }),

  // --- Permission Override Defaults ---
  permissionOverrides: [],

  fetchInitialData: async () => {
    try {
      const [
        dashboardRes,
        projectsRes,
        tasksRes,
        timesheetsRes,
        leaveRes,
        expensesRes,
        billingRes,
        usersRes
      ] = await Promise.all([
        fetch("/api/dashboard"),
        fetch("/api/projects"),
        fetch("/api/tasks"),
        fetch("/api/timesheets"),
        fetch("/api/leave"),
        fetch("/api/expenses"),
        fetch("/api/billing"),
        fetch("/api/users").catch(() => null)
      ]);

      const handleResponse = async (res: Response, fallback: any) => {
        if (res.status === 401) {
          throw new Error("Unauthorized");
        }
        if (!res.ok) {
          return fallback;
        }
        return res.json();
      };

      const [
        dashboard,
        projects,
        tasks,
        timesheets,
        leaveRequests,
        expenses,
        billing,
        usersList
      ] = await Promise.all([
        handleResponse(dashboardRes, {
          kpis: {
            activeProjects: 0,
            delayedTasks: 0,
            upcomingMilestones: 0,
            revenuePipeline: 0,
            resourceUtilization: 0,
            billableHours: 0,
            teamMembers: 0,
            clientSatisfaction: 0,
          },
          revenueData: { labels: [], actual: [], forecast: [], target: [] },
          utilizationData: { labels: [], billable: [], nonBillable: [], available: [] },
          activities: [],
          aiInsights: [],
        }),
        handleResponse(projectsRes, []),
        handleResponse(tasksRes, { todo: [], inprogress: [], review: [], done: [] }),
        handleResponse(timesheetsRes, []),
        handleResponse(leaveRes, []),
        handleResponse(expensesRes, []),
        handleResponse(billingRes, { invoices: [], milestones: [] }),
        usersRes && usersRes.ok ? usersRes.json() : Promise.resolve([])
      ]);

      const users = (usersList || []).map(mapUserToUser);
      const consultants = (usersList || []).map((u: any) => mapUserToConsultant(u, timesheets));

      // Fetch CRM data from the API (best-effort — gracefully ignore failures for non-CM roles)
      const [clientsRes, contactsRes, callsRes, meetingsRes, opportunitiesRes, requirementsRes, followUpsRes] = await Promise.all([
        fetch("/api/client-manager/clients").catch(() => null),
        fetch("/api/client-manager/contacts").catch(() => null),
        fetch("/api/client-manager/calls").catch(() => null),
        fetch("/api/client-manager/meetings").catch(() => null),
        fetch("/api/client-manager/opportunities").catch(() => null),
        fetch("/api/client-manager/requirements").catch(() => null),
        fetch("/api/client-manager/follow-ups").catch(() => null),
      ]);

      const [crmClients, crmContacts, crmCalls, crmMeetings, crmOpportunities, crmRequirements, crmFollowUps] = await Promise.all([
        clientsRes && clientsRes.ok ? clientsRes.json() : Promise.resolve([]),
        contactsRes && contactsRes.ok ? contactsRes.json() : Promise.resolve([]),
        callsRes && callsRes.ok ? callsRes.json() : Promise.resolve([]),
        meetingsRes && meetingsRes.ok ? meetingsRes.json() : Promise.resolve([]),
        opportunitiesRes && opportunitiesRes.ok ? opportunitiesRes.json() : Promise.resolve([]),
        requirementsRes && requirementsRes.ok ? requirementsRes.json() : Promise.resolve([]),
        followUpsRes && followUpsRes.ok ? followUpsRes.json() : Promise.resolve([]),
      ]);

      // Map server CRM clients to the frontend Client type
      const mappedClients = (crmClients || []).map((c: any) => ({
        id: c.id,
        companyName: c.name || c.companyName || "",
        clientType: c.clientType || "Direct",
        industry: c.industry || "",
        website: c.website || "",
        gstNumber: c.gstNumber || "",
        panNumber: c.panNumber || "",
        address: c.address || "",
        country: c.country || "",
        state: c.state || "",
        city: c.city || "",
        pincode: c.pincode || "",
        email: c.email || "",
        phone: c.phone || "",
        status: c.status || "Active",
        clientCategory: c.clientCategory || "A",
        priority: c.priority || "Medium",
        notes: c.notes || "",
        accountOwner: c.accountOwner || "",
        createdAt: c.createdAt || new Date().toISOString(),
      }));

      set({
        data: {
          kpis: dashboard.kpis,
          projects,
          consultants: consultants.length > 0 ? consultants : INITIAL_VSQC_DATA.consultants,
          tasks,
          milestones: billing.milestones,
          revenueData: dashboard.revenueData,
          utilizationData: dashboard.utilizationData,
          timesheets,
          leaveRequests,
          expenses,
          invoices: billing.invoices,
          aiInsights: dashboard.aiInsights,
          activities: dashboard.activities,
          notifications: [],
          auditLogs: [],
          users: users.length > 0 ? users : INITIAL_VSQC_DATA.users,
          clients: mappedClients,
          clientContacts: crmContacts || [],
          clientCalls: crmCalls || [],
          clientMeetings: (crmMeetings || []).map((m: any) => ({
            id: m.id,
            clientId: m.clientId,
            participants: [],
            meetingType: m.title || "Meeting",
            date: m.scheduledAt ? m.scheduledAt.split("T")[0] : "",
            time: m.scheduledAt ? m.scheduledAt.split("T")[1]?.substring(0, 5) : "10:00",
            agenda: m.agenda || "",
            notes: m.notes || "",
            actionItems: "",
            outcome: m.status || "Pending",
            nextFollowUpDate: null,
            platform: m.platform || "Google Meet",
            meetingLink: m.meetLink || "",
            inviteSent: true
          })),
          opportunities: (crmOpportunities || []).map((o: any) => ({
            id: o.id,
            opportunityName: o.title || o.opportunityName || "",
            clientId: o.clientId,
            expectedRevenue: o.value !== undefined && o.value !== null ? o.value : (o.expectedRevenue || 0),
            probability: o.probability || 0,
            stage: o.stage || "Lead",
            expectedClosureDate: o.expectedClose ? o.expectedClose.split("T")[0] : (o.expectedClosureDate || ""),
            competitor: o.competitor || "",
            notes: o.notes || ""
          })),
          requirements: crmRequirements || [],
          followUps: crmFollowUps || []
        }
      });

      const [notifRes, auditRes] = await Promise.all([
        fetch("/api/notifications"),
        fetch("/api/audit").catch(() => null)
      ]);

      if (notifRes.ok) {
        const notifications = await notifRes.json();
        set((state) => ({ data: { ...state.data, notifications } }));
      }

      if (auditRes && auditRes.ok) {
        const auditLogs = await auditRes.json();
        set((state) => ({ data: { ...state.data, auditLogs } }));
      }

      const meRes = await fetch("/api/auth/me");
      if (meRes.ok) {
        const dbUser = await meRes.json();
        set({ user: mapUserToUser(dbUser) });
      }

      // Fetch permission overrides (non-critical, best effort)
      try {
        const overridesRes = await fetch("/api/overrides");
        if (overridesRes.ok) {
          const permissionOverrides = await overridesRes.json();
          set({ permissionOverrides });
        }
      } catch (_) { /* silently ignore override fetch errors */ }

    } catch (err: any) {
      console.error("fetchInitialData error:", err);
      set({ toast: { message: "Failed to sync workspace with database.", type: "danger" } });
    }
  },
  activeModule: null,
  sidebarCollapsed: false,
  darkMode: false,
  notifOpen: false,
  searchOpen: false,
  activeProjectId: '',
  taskView: 'kanban',
  projectView: 'cards',
  projectFilterStatus: 'all',
  projectFilterType: 'all',
  projectSearch: '',
  toast: null,
  currencyFormat: 'indian',
  currencySymbol: '₹',
  timezone: 'Asia/Kolkata (UTC+5:30)',
  language: 'English (India)',

  // --- Punch Clock Defaults ---
  punchedIn: false,
  punchStartTime: null,
  punchHoursToday: 0.0,
  punchHoursWeek: 0.0, // Initial billable hours

  // --- Data State Defaults ---
  data: INITIAL_VSQC_DATA,

  // --- UI Actions ---
  setActiveModule: (activeModule) => set({ activeModule }),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  setDarkMode: (darkMode) => set({ darkMode }),
  setNotifOpen: (notifOpen) => set({ notifOpen }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setActiveProjectId: (activeProjectId) => set({ activeProjectId }),
  setTaskView: (taskView) => set({ taskView }),
  setProjectView: (projectView) => set({ projectView }),
  setProjectFilterStatus: (projectFilterStatus) => set({ projectFilterStatus }),
  setProjectFilterType: (projectFilterType) => set({ projectFilterType }),
  setProjectSearch: (projectSearch) => set({ projectSearch }),
  showToast: (message, type = 'info') => {
    set({ toast: { message, type } });
  },
  clearToast: () => set({ toast: null }),
  setCurrencyFormat: (currencyFormat) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('currencyFormat', currencyFormat);
    }
    setGlobalCurrencyFormat(currencyFormat);
    set({ currencyFormat });
  },
  setCurrencySymbol: (symbol) => {
    setGlobalCurrencySymbol(symbol);
    set({ currencySymbol: symbol });
  },
  setTimezone: (timezone) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vsqc_timezone', timezone);
    }
    set({ timezone });
  },
  setLanguage: (language, silent?: boolean) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vsqc_language', language);
      const code = getLangCode(language);
      document.documentElement.lang = code;
      if (code === "ar") {
        document.documentElement.dir = "rtl";
      } else {
        document.documentElement.dir = "ltr";
      }
    }
    set({ language });
    if (!silent) {
      set({ toast: { message: "Language updated to " + language, type: "success" } });
    }
  },

  // --- Punch Clock Actions ---
  togglePunch: () =>
    set((state) => {
      const now = new Date();
      if (state.punchedIn) {
        // Clocking out
        const timeDiff = state.punchStartTime ? (now.getTime() - new Date(state.punchStartTime).getTime()) / 3600000 : 0;
        const additionalHours = parseFloat(timeDiff.toFixed(2));
        const updatedToday = parseFloat((state.punchHoursToday + additionalHours).toFixed(2));
        const updatedWeek = parseFloat((state.punchHoursWeek + additionalHours).toFixed(2));

        // Log an activity for clocking out
        const newActivity = {
          time: 'Just now',
          user: 'TK',
          action: 'Clocked out',
          subject: `Total session: ${timeDiff.toFixed(2)}h`,
          project: null,
          type: 'timesheet' as const,
        };

        return {
          punchedIn: false,
          punchStartTime: null,
          punchHoursToday: updatedToday,
          punchHoursWeek: updatedWeek,
          data: {
            ...state.data,
            activities: [newActivity, ...state.data.activities],
          },
          toast: { message: 'Successfully clocked out.', type: 'success' },
        };
      } else {
        // Clocking in
        const newActivity = {
          time: 'Just now',
          user: 'TK',
          action: 'Clocked in',
          subject: 'Started timesheet session',
          project: null,
          type: 'timesheet' as const,
        };

        return {
          punchedIn: true,
          punchStartTime: now.toISOString(),
          data: {
            ...state.data,
            activities: [newActivity, ...state.data.activities],
          },
          toast: { message: 'Successfully clocked in.', type: 'success' },
        };
      }
    }),

  updatePunchStats: (punchHoursToday, punchHoursWeek) =>
    set({ punchHoursToday, punchHoursWeek }),

  // --- Data CRUD Actions ---


  addTask: (newTask) => {
    const targetCol = (newTask as any).col || "todo";
    fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newTask, status: targetCol }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to create task");
        return res.json();
      })
      .then((task) => {
        useAppStore.getState().showToast(`Task "${task.title}" created successfully.`, "success");
        fetch("/api/tasks")
          .then((r) => r.json())
          .then((tasks) => {
            set((state) => ({
              data: {
                ...state.data,
                tasks,
              },
            }));
          });
      })
      .catch((err) => {
        useAppStore.getState().showToast("Error creating task: " + err.message, "danger");
      });
  },

  addExpense: (newExpense) => {
    fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newExpense),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to submit expense");
        return res.json();
      })
      .then((expense) => {
        useAppStore.getState().showToast(`Expense claim submitted.`, "success");
        fetch("/api/expenses")
          .then((r) => r.json())
          .then((expenses) => {
            set((state) => ({
              data: {
                ...state.data,
                expenses,
              },
            }));
          });
      })
      .catch((err) => {
        useAppStore.getState().showToast("Error submitting expense: " + err.message, "danger");
      });
  },

  moveTask: (taskId, targetCol, actualCompletionDate) => {
    fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: targetCol,
        progress: targetCol === "done" ? 100 : targetCol === "todo" ? 0 : undefined,
        actualCompletionDate,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to move task");
        return res.json();
      })
      .then(() => {
        useAppStore.getState().showToast(`Task moved successfully.`, "success");
        fetch("/api/tasks")
          .then((r) => r.json())
          .then((tasks) => {
            set((state) => ({
              data: {
                ...state.data,
                tasks,
              },
            }));
          });
      })
      .catch((err) => {
        useAppStore.getState().showToast("Error moving task: " + err.message, "danger");
      });
  },

  addProject: (newProj) => {
    fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newProj),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to create project");
        return res.json();
      })
      .then((project) => {
        useAppStore.getState().showToast(`Project ${project.name} created successfully.`, "success");
        Promise.all([
          fetch("/api/projects").then((r) => r.json()),
          fetch("/api/dashboard").then((r) => r.json()),
        ]).then(([projects, dashboard]) => {
          set((state) => ({
            data: {
              ...state.data,
              projects,
              kpis: dashboard.kpis,
              activities: dashboard.activities,
            },
          }));
        });
      })
      .catch((err) => {
        useAppStore.getState().showToast("Error creating project: " + err.message, "danger");
      });
  },

  addTaskComment: (taskId, text) => {
    fetch(`/api/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to add comment");
        return res.json();
      })
      .then(() => {
        fetch("/api/tasks")
          .then((r) => r.json())
          .then((tasks) => {
            set((state) => ({
              data: {
                ...state.data,
                tasks,
              },
            }));
          });
      })
      .catch((err) => {
        useAppStore.getState().showToast("Error adding comment: " + err.message, "danger");
      });
  },

  addSubtaskToTask: (taskId, subtask) => {
    // Find the existing task
    const state = get();
    let foundTask = Object.values(state.data.tasks).flat().find((x: any) => x.id === taskId);
    if (!foundTask) return;
    const updatedSubtasks = [...(foundTask.subtasks || []), subtask];
    // Update API
    fetch(`/api/tasks/${taskId}/subtasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subtask),
    })
      .then(() => {
        // Refresh tasks from server
        fetch("/api/tasks")
          .then((r) => r.json())
          .then((tasks) => {
            set((s) => ({ data: { ...s.data, tasks } }));
          });
      })
      .catch(() => {
        // Optimistic update on failure
        set((s) => {
          const tasksObj = s.data.tasks;
          const updatedTasks = {
            todo: tasksObj.todo?.map((t: any) => t.id === taskId ? { ...t, subtasks: updatedSubtasks } : t) || [],
            inprogress: tasksObj.inprogress?.map((t: any) => t.id === taskId ? { ...t, subtasks: updatedSubtasks } : t) || [],
            review: tasksObj.review?.map((t: any) => t.id === taskId ? { ...t, subtasks: updatedSubtasks } : t) || [],
            done: tasksObj.done?.map((t: any) => t.id === taskId ? { ...t, subtasks: updatedSubtasks } : t) || [],
          };
          return {
            data: {
              ...s.data,
              tasks: updatedTasks,
            },
          };
        });
      });
  },

  approveLeaveRequest: (id) => {
    fetch(`/api/leave/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to approve leave");
        return res.json();
      })
      .then(() => {
        useAppStore.getState().showToast("Leave request approved successfully.", "success");
        fetch("/api/leave")
          .then((r) => r.json())
          .then((leaveRequests) => {
            set((state) => ({
              data: {
                ...state.data,
                leaveRequests,
              },
            }));
          });
      })
      .catch((err) => {
        useAppStore.getState().showToast("Error approving leave: " + err.message, "danger");
      });
  },

  rejectLeaveRequest: (id) => {
    fetch(`/api/leave/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to reject leave");
        return res.json();
      })
      .then(() => {
        useAppStore.getState().showToast("Leave request rejected.", "warning");
        fetch("/api/leave")
          .then((r) => r.json())
          .then((leaveRequests) => {
            set((state) => ({
              data: {
                ...state.data,
                leaveRequests,
              },
            }));
          });
      })
      .catch((err) => {
        useAppStore.getState().showToast("Error rejecting leave: " + err.message, "danger");
      });
  },

  addLeaveRequest: (newReq) => {
    fetch("/api/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newReq),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to submit leave request");
        return res.json();
      })
      .then(() => {
        useAppStore.getState().showToast("Leave request submitted successfully.", "success");
        fetch("/api/leave")
          .then((r) => r.json())
          .then((leaveRequests) => {
            set((state) => ({
              data: {
                ...state.data,
                leaveRequests,
              },
            }));
          });
      })
      .catch((err) => {
        useAppStore.getState().showToast("Error submitting leave: " + err.message, "danger");
      });
  },

  deleteLeaveRequest: async (id) => {
    try {
      const res = await fetch(`/api/leave/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to withdraw leave request");
      }
      useAppStore.getState().showToast("Leave request withdrawn successfully.", "success");
      fetch("/api/leave")
        .then((r) => r.json())
        .then((leaveRequests) => {
          set((state) => ({
            data: {
              ...state.data,
              leaveRequests,
            },
          }));
        });
      return true;
    } catch (err: any) {
      useAppStore.getState().showToast("Error withdrawing leave request: " + err.message, "danger");
      return false;
    }
  },

  approveExpense: (id) => {
    fetch(`/api/expenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to approve expense");
        return res.json();
      })
      .then(() => {
        useAppStore.getState().showToast("Expense claim approved successfully.", "success");
        fetch("/api/expenses")
          .then((r) => r.json())
          .then((expenses) => {
            set((state) => ({
              data: {
                ...state.data,
                expenses,
              },
            }));
          });
      })
      .catch((err) => {
        useAppStore.getState().showToast("Error approving expense: " + err.message, "danger");
      });
  },

  rejectExpense: (id) => {
    fetch(`/api/expenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected" }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to reject expense");
        return res.json();
      })
      .then(() => {
        useAppStore.getState().showToast("Expense claim rejected.", "warning");
        fetch("/api/expenses")
          .then((r) => r.json())
          .then((expenses) => {
            set((state) => ({
              data: {
                ...state.data,
                expenses,
              },
            }));
          });
      })
      .catch((err) => {
        useAppStore.getState().showToast("Error rejecting expense: " + err.message, "danger");
      });
  },

  markNotificationRead: (id) => {
    fetch(`/api/notifications/${id}/read`, {
      method: "POST",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to mark notification as read");
        return res.json();
      })
      .then(() => {
        fetch("/api/notifications")
          .then((r) => r.json())
          .then((notifications) => {
            set((state) => ({
              data: {
                ...state.data,
                notifications,
              },
            }));
          });
      })
      .catch((err) => {
        console.error(err);
      });
  },

  markAllNotificationsRead: () => {
    const unread = useAppStore.getState().data.notifications.filter(n => !n.read);
    Promise.all(
      unread.map(n => fetch(`/api/notifications/${n.id}/read`, { method: "POST" }))
    ).then(() => {
      useAppStore.getState().showToast('All notifications marked as read.', 'success');
      fetch("/api/notifications")
        .then((r) => r.json())
        .then((notifications) => {
          set((state) => ({
            data: {
              ...state.data,
              notifications,
            },
          }));
        });
    });
  },

  updateUserMFA: (id, mfa) => {
    fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mfa }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to update MFA");
        return res.json();
      })
      .then(() => {
        useAppStore.getState().showToast(`MFA updated for user.`, 'success');
        fetch("/api/users")
          .then((r) => r.json())
          .then((usersList) => {
            const users = usersList.map(mapUserToUser);
            const consultants = usersList.map((u: any) => mapUserToConsultant(u, useAppStore.getState().data.timesheets));
            set((state) => ({
              data: {
                ...state.data,
                users,
                consultants,
              },
            }));
          });
      })
      .catch((err) => {
        useAppStore.getState().showToast("Error updating MFA: " + err.message, "danger");
      });
  },

  updateUserStatus: (id, status) => {
    fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to update status");
        return res.json();
      })
      .then(() => {
        useAppStore.getState().showToast(`User status changed to ${status}.`, 'success');
        fetch("/api/users")
          .then((r) => r.json())
          .then((usersList) => {
            const users = usersList.map(mapUserToUser);
            const consultants = usersList.map((u: any) => mapUserToConsultant(u, useAppStore.getState().data.timesheets));
            set((state) => ({
              data: {
                ...state.data,
                users,
                consultants,
              },
            }));
          });
      })
      .catch((err) => {
        useAppStore.getState().showToast("Error updating status: " + err.message, "danger");
      });
  },

  addInvoice: (newInvoice) => {
    fetch("/api/billing/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newInvoice),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to generate invoice");
        return res.json();
      })
      .then(() => {
        useAppStore.getState().showToast("Invoice generated successfully", "success");
        fetch("/api/billing")
          .then((r) => r.json())
          .then((billing) => {
            set((state) => ({
              data: {
                ...state.data,
                invoices: billing.invoices,
                milestones: billing.milestones,
              },
            }));
          });
      })
      .catch((err) => {
        useAppStore.getState().showToast("Error generating invoice: " + err.message, "danger");
      });
  },

  updateMilestone: (id, updates) => {
    fetch(`/api/billing/milestones/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to update milestone");
        return res.json();
      })
      .then(() => {
        useAppStore.getState().showToast("Milestone updated successfully", "success");
        fetch("/api/billing")
          .then((r) => r.json())
          .then((billing) => {
            set((state) => ({
              data: {
                ...state.data,
                invoices: billing.invoices,
                milestones: billing.milestones,
              },
            }));
          });
      })
      .catch((err) => {
        useAppStore.getState().showToast("Error updating milestone: " + err.message, "danger");
      });
  },

  inviteUser: (newUser) => {
    const tempPassword = "TempPassword123";
    fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newUser,
        password: tempPassword,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to invite user");
        return res.json();
      })
      .then((user) => {
        useAppStore.getState().showToast(`Invitation sent to ${user.email}. Temporary Password: ${tempPassword}`, "success");
        fetch("/api/users")
          .then((r) => r.json())
          .then((usersList) => {
            const users = usersList.map(mapUserToUser);
            const consultants = usersList.map((u: any) => mapUserToConsultant(u, useAppStore.getState().data.timesheets));
            set((state) => ({
              data: {
                ...state.data,
                users,
                consultants,
              },
            }));
          });
      })
      .catch((err) => {
        useAppStore.getState().showToast("Error inviting user: " + err.message, "danger");
      });
  },

  deleteProject: async (projectId) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to delete project");
      }
      useAppStore.getState().showToast("Project deleted successfully.", "success");
      
      const [projects, dashboard, tasks, billing] = await Promise.all([
        fetch("/api/projects").then((r) => r.json()),
        fetch("/api/dashboard").then((r) => r.json()),
        fetch("/api/tasks").then((r) => r.json()),
        fetch("/api/billing").then((r) => r.json()),
      ]);
      
      set((state) => ({
        data: {
          ...state.data,
          projects,
          kpis: dashboard.kpis,
          activities: dashboard.activities,
          tasks,
          milestones: billing.milestones,
          invoices: billing.invoices,
        },
      }));
      return true;
    } catch (err: any) {
      useAppStore.getState().showToast("Error deleting project: " + err.message, "danger");
      return false;
    }
  },

  deleteUser: async (userId) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to delete user");
      }
      useAppStore.getState().showToast("User deleted successfully.", "success");
      
      const [usersList, dashboard, projects] = await Promise.all([
        fetch("/api/users").then((r) => r.json()),
        fetch("/api/dashboard").then((r) => r.json()),
        fetch("/api/projects").then((r) => r.json()),
      ]);
      
      const users = (usersList || []).map(mapUserToUser);
      const consultants = (usersList || []).map((u: any) => mapUserToConsultant(u, useAppStore.getState().data.timesheets));
      
      set((state) => ({
        data: {
          ...state.data,
          users: users.length > 0 ? users : INITIAL_VSQC_DATA.users,
          consultants: consultants.length > 0 ? consultants : INITIAL_VSQC_DATA.consultants,
          kpis: dashboard.kpis,
          activities: dashboard.activities,
          projects,
        },
      }));
      return true;
    } catch (err: any) {
      useAppStore.getState().showToast("Error deleting user: " + err.message, "danger");
      return false;
    }
  },

  // --- CRM Implementations ---
  addClient: async (clientData) => {
    // POST to the server API first
    try {
      const res = await fetch("/api/client-manager/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: clientData.companyName,
          industry: clientData.industry,
          website: clientData.website,
          address: clientData.address,
          status: clientData.status || "Active",
          tier: clientData.clientCategory || "A",
        }),
      });
      if (res.ok) {
        const saved = await res.json();
        const mappedClient = {
          id: saved.id,
          companyName: saved.name || saved.companyName || clientData.companyName,
          clientType: clientData.clientType || "Direct",
          industry: saved.industry || clientData.industry || "",
          website: saved.website || clientData.website || "",
          gstNumber: clientData.gstNumber || "",
          panNumber: clientData.panNumber || "",
          address: saved.address || clientData.address || "",
          country: clientData.country || "",
          state: clientData.state || "",
          city: clientData.city || "",
          pincode: clientData.pincode || "",
          email: clientData.email || "",
          phone: clientData.phone || "",
          status: saved.status || clientData.status || "Active",
          clientCategory: saved.tier || clientData.clientCategory || "A",
          priority: clientData.priority || "Medium",
          notes: clientData.notes || "",
          accountOwner: clientData.accountOwner || "",
          createdAt: saved.createdAt || new Date().toISOString(),
        };
        set((state) => ({
          data: {
            ...state.data,
            clients: [...state.data.clients, mappedClient]
          }
        }));
      } else {
        // Fallback: add locally if API fails
        set((state) => ({
          data: {
            ...state.data,
            clients: [...state.data.clients, {
              ...clientData,
              id: `cli-${Date.now()}`,
              createdAt: new Date().toISOString()
            }]
          }
        }));
      }
    } catch {
      // Fallback: add locally on network error
      set((state) => ({
        data: {
          ...state.data,
          clients: [...state.data.clients, {
            ...clientData,
            id: `cli-${Date.now()}`,
            createdAt: new Date().toISOString()
          }]
        }
      }));
    }
  },

  updateClient: (id, updates) => set((state) => ({
    data: {
      ...state.data,
      clients: state.data.clients.map(c => 
        c.id === id ? { ...c, ...updates } : c
      )
    }
  })),

  deactivateClient: (id) => set((state) => ({
    data: {
      ...state.data,
      clients: state.data.clients.map(c => 
        c.id === id ? { ...c, status: 'Inactive' } : c
      )
    }
  })),

  addContact: async (contactData) => {
    try {
      const data = contactData as any;
      const res = await fetch("/api/client-manager/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: data.clientId,
          name: data.name,
          email: data.email,
          phone: data.phone,
          role: data.role || data.designation,
          isPrimary: data.isPrimary || data.decisionMaker || false,
        }),
      });
      if (res.ok) {
        const saved = await res.json();
        set((state) => ({
          data: {
            ...state.data,
            clientContacts: [...state.data.clientContacts, saved],
          },
        }));
      }
    } catch (err) {
      console.error("Error saving contact:", err);
      set((state) => ({
        data: {
          ...state.data,
          clientContacts: [...state.data.clientContacts, { ...contactData, id: `con-${Date.now()}` }],
        },
      }));
    }
  },

  addCall: async (callData) => {
    try {
      const data = callData as any;
      const res = await fetch("/api/client-manager/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: data.clientId,
          subject: data.subject || data.discussionSummary || "Client Call",
          notes: data.notes || data.discussionSummary,
          outcome: data.outcome,
          duration: data.duration,
          scheduledAt: data.scheduledAt || (data.date ? new Date(`${data.date}T${data.time || "10:00"}:00`).toISOString() : new Date().toISOString()),
        }),
      });
      if (res.ok) {
        const saved = await res.json();
        set((state) => ({
          data: {
            ...state.data,
            clientCalls: [...state.data.clientCalls, saved],
          },
        }));
      }
    } catch (err) {
      console.error("Error saving call:", err);
      set((state) => ({
        data: {
          ...state.data,
          clientCalls: [...state.data.clientCalls, { ...callData, id: `call-${Date.now()}` }],
        },
      }));
    }
  },

  addMeeting: async (meetingData) => {
    try {
      const res = await fetch("/api/client-manager/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: meetingData.clientId,
          title: meetingData.meetingType,
          agenda: meetingData.agenda,
          notes: meetingData.notes,
          platform: meetingData.platform,
          meetLink: meetingData.meetingLink,
          status: "scheduled",
          scheduledAt: new Date(`${meetingData.date}T${meetingData.time || "10:00"}:00`).toISOString()
        })
      });
      if (res.ok) {
        const saved = await res.json();
        set((state) => ({
          data: {
            ...state.data,
            clientMeetings: [...state.data.clientMeetings, {
              id: saved.id,
              clientId: saved.clientId,
              participants: [],
              meetingType: saved.title,
              date: saved.scheduledAt ? saved.scheduledAt.split("T")[0] : meetingData.date,
              time: saved.scheduledAt ? saved.scheduledAt.split("T")[1]?.substring(0, 5) : meetingData.time,
              agenda: saved.agenda || "",
              notes: saved.notes || "",
              actionItems: "",
              outcome: saved.status,
              nextFollowUpDate: null,
              platform: saved.platform,
              meetingLink: saved.meetLink || "",
              inviteSent: meetingData.inviteSent
            }]
          }
        }));
      }
    } catch (err) {
      console.error("Error saving meeting:", err);
      // fallback local save
      set((state) => ({
        data: {
          ...state.data,
          clientMeetings: [...state.data.clientMeetings, {
            ...meetingData,
            id: `mtg-${Date.now()}`
          }]
        }
      }));
    }
  },

  addFollowUp: async (followUpData) => {
    try {
      const res = await fetch("/api/client-manager/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: followUpData.clientId,
          description: followUpData.description,
          dueDate: followUpData.dueDate,
          priority: followUpData.priority,
          status: followUpData.status || "open",
        }),
      });
      if (res.ok) {
        const saved = await res.json();
        set((state) => ({
          data: {
            ...state.data,
            followUps: [...state.data.followUps, saved],
          },
        }));
      }
    } catch (err) {
      console.error("Error saving followUp:", err);
      set((state) => ({
        data: {
          ...state.data,
          followUps: [...state.data.followUps, { ...followUpData, id: `fu-${Date.now()}` }],
        },
      }));
    }
  },

  addRequirement: async (reqData) => {
    try {
      const data = reqData as any;
      const res = await fetch("/api/client-manager/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: data.clientId,
          title: data.title,
          description: data.description,
          category: data.category,
          priority: data.priority,
          status: data.status || "open",
          budget: data.budget,
        }),
      });
      if (res.ok) {
        const saved = await res.json();
        set((state) => ({
          data: {
            ...state.data,
            requirements: [...state.data.requirements, saved],
          },
        }));
      }
    } catch (err) {
      console.error("Error saving requirement:", err);
      set((state) => {
        const reqNumber = `REQ-${1000 + state.data.requirements.length + 1}`;
        return {
          data: {
            ...state.data,
            requirements: [...state.data.requirements, {
              ...reqData,
              id: `req-${Date.now()}`,
              reqNumber,
              createdAt: new Date().toISOString()
            }]
          }
        };
      });
    }
  },

  updateRequirementStatus: async (id, status) => {
    try {
      const existing = useAppStore.getState().data.requirements.find(r => r.id === id);
      if (existing) {
        const res = await fetch(`/api/client-manager/requirements/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...existing, status }),
        });
        if (res.ok) {
          const saved = await res.json();
          set((state) => ({
            data: {
              ...state.data,
              requirements: state.data.requirements.map(r => r.id === id ? saved : r)
            }
          }));
          return;
        }
      }
    } catch (err) {
      console.error(err);
    }
    set((state) => ({
      data: {
        ...state.data,
        requirements: state.data.requirements.map(r => r.id === id ? { ...r, status } : r)
      }
    }));
  },

  addOpportunity: async (oppData) => {
    try {
      const data = oppData as any;
      const res = await fetch("/api/client-manager/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: data.clientId,
          title: data.opportunityName || data.title,
          value: Number(data.expectedRevenue) || Number(data.value) || 0,
          stage: data.stage,
          probability: data.probability || 50,
          expectedClose: data.expectedClosureDate || data.expectedClose,
          notes: data.notes,
        }),
      });
      if (res.ok) {
        const saved = await res.json();
        const mappedSaved = {
          id: saved.id,
          opportunityName: saved.title || saved.opportunityName || "",
          clientId: saved.clientId,
          expectedRevenue: saved.value !== undefined && saved.value !== null ? saved.value : (saved.expectedRevenue || 0),
          probability: saved.probability || 0,
          stage: saved.stage || "Lead",
          expectedClosureDate: saved.expectedClose ? saved.expectedClose.split("T")[0] : (saved.expectedClosureDate || ""),
          competitor: saved.competitor || "",
          notes: saved.notes || ""
        };
        set((state) => ({
          data: {
            ...state.data,
            opportunities: [...state.data.opportunities, mappedSaved],
          },
        }));
      }
    } catch (err) {
      console.error("Error saving opportunity:", err);
      set((state) => ({
        data: {
          ...state.data,
          opportunities: [...state.data.opportunities, { ...oppData, id: `opp-${Date.now()}` }],
        },
      }));
    }
  },

  updateTimesheetHours: (project, task, day, hours, billable) => {
    const consultantId = useAppStore.getState().user?.id || 'TK';
    const week = '2026-06-09'; // Default active week

    set((state) => {
      const updatedTimesheets = [...state.data.timesheets];
      let tIdx = updatedTimesheets.findIndex(
        (ts) => ts.consultant === consultantId && ts.week === week
      );

      if (tIdx === -1) {
        updatedTimesheets.push({
          consultant: consultantId,
          week,
          entries: [{ day, project, task, hours, billable }],
        });
      } else {
        const entries = [...updatedTimesheets[tIdx].entries];
        const entryIdx = entries.findIndex(
          (e) => e.day === day && e.project === project && e.task === task
        );

        if (entryIdx === -1) {
          entries.push({ day, project, task, hours, billable });
        } else {
          if (hours === 0) {
            entries.splice(entryIdx, 1);
          } else {
            entries[entryIdx] = { ...entries[entryIdx], hours, billable };
          }
        }
        updatedTimesheets[tIdx] = {
          ...updatedTimesheets[tIdx],
          entries,
        };
      }

      const activeTimesheet = updatedTimesheets.find(
        (ts) => ts.consultant === consultantId && ts.week === week
      );
      if (activeTimesheet) {
        fetch("/api/timesheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consultant: consultantId,
            week,
            entries: activeTimesheet.entries,
          }),
        }).catch((err) => console.error("Error saving timesheet to backend:", err));
      }

      // Re-map consultants with updated timesheets to update utilization in UI
      const updatedConsultants = state.data.users.map((u: any) =>
        mapUserToConsultant(u, updatedTimesheets)
      );

      return {
        data: {
          ...state.data,
          timesheets: updatedTimesheets,
          consultants: updatedConsultants,
        },
      };
    });
  },

  // --- Permission Override Actions ---
  fetchOverrides: async () => {
    try {
      const res = await fetch("/api/overrides");
      if (!res.ok) throw new Error("Failed to fetch overrides");
      const permissionOverrides = await res.json();
      set({ permissionOverrides });
    } catch (err: any) {
      useAppStore.getState().showToast("Error fetching overrides: " + err.message, "danger");
    }
  },

  createOverride: async (data) => {
    try {
      const res = await fetch("/api/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create override");
      }
      useAppStore.getState().showToast("Permission override created successfully.", "success");
      await useAppStore.getState().fetchOverrides();
    } catch (err: any) {
      useAppStore.getState().showToast("Error creating override: " + err.message, "danger");
    }
  },

  updateOverride: async (id, update) => {
    try {
      const res = await fetch(`/api/overrides/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update override");
      }
      const actionLabel = update.action === "approve" ? "approved" : update.action === "revoke" ? "revoked" : "extended";
      useAppStore.getState().showToast(`Override ${actionLabel} successfully.`, "success");
      await useAppStore.getState().fetchOverrides();
    } catch (err: any) {
      useAppStore.getState().showToast("Error updating override: " + err.message, "danger");
    }
  },
}));
