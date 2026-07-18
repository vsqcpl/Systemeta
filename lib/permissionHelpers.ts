import { SCREEN_ACCESS, ACTION_PERMISSIONS, AccessLevel } from "./permissions";
import { UserRole } from "./roles";
import { useAppStore } from "./store";

// Map user roles to column indices in the Permissions Matrix vals array
const ROLE_TO_INDEX: Record<string, number> = {
  super_admin: 0,
  client_manager: 1,
  project_manager: 2,
  senior_consultant: 3,
  consultant: 4,
  accounts: 5,
  client_contact: 6,
};

// Map screens and actions to matrix row permission names
const MATRIX_PERMISSION_MAPPING: Record<string, string> = {
  // Screens -> Matrix row name
  portfolio_dashboard: "View Projects",
  project_dashboard: "View Projects",
  task_list: "View Projects",
  task_detail_create: "View Projects",
  resource_calendar: "View Projects",
  client_project_status: "View Projects",
  client_milestone_tracker: "View Projects",
  
  project_setup_edit: "Create Projects",
  
  timesheet_team_view: "Approve Timesheets",
  
  leave_approval_queue: "Approve Leave",
  
  user_management: "Admin Panel Access",
  system_configuration: "Admin Panel Access",
  audit_log: "Admin Panel Access",
  
  ai_task_estimation: "View AI Insights",
  ai_delay_analysis: "View AI Insights",
  ai_weekly_summary: "View AI Insights",
  ai_assignment_suggest: "View AI Insights",
  ai_efficiency_metrics: "View AI Insights",
  ai_co2_report: "View AI Insights",
  ai_milestone_insights: "View AI Insights",
  
  plan_change_approval: "Unlock Project Plans",
  
  my_tasks_cross_project: "Cross-Project Visibility",

  // CRM Screens -> Matrix row name
  crm_dashboard: "CRM Access",
  crm_clients: "CRM Access",
  crm_contacts: "CRM Access",
  crm_calls: "CRM Access",
  crm_meetings: "CRM Access",
  crm_follow_ups: "CRM Access",
  crm_requirements: "CRM Access",
  crm_opportunities: "CRM Access",
  crm_escalations: "CRM Access",
  crm_reports: "CRM Access",

  // Actions -> Matrix row name
  create_project: "Create Projects",
  edit_project: "Create Projects",
  delete_project: "Create Projects",
  assign_resource_to_task: "Create Projects",
  approve_plan_change: "Create Projects",
  assign_resources: "Create Projects",
  
  view_team_timesheets: "Approve Timesheets",
  
  approve_leave: "Approve Leave",
  
  view_all_expenses: "Approve Expenses",
  
  create_edit_users: "Admin Panel Access",
  change_user_roles: "Admin Panel Access",
  deactivate_users: "Admin Panel Access",
  delete_user: "Admin Panel Access",
  view_audit_log: "Admin Panel Access",
  configure_system: "Admin Panel Access",
  
  use_ai_task_estimation: "View AI Insights",
  use_ai_delay_analysis: "View AI Insights",
  use_ai_weekly_summary: "View AI Insights",
  use_ai_assignment_suggest: "View AI Insights",
  view_ai_efficiency: "View AI Insights",
  use_ai_co2_report: "View AI Insights",
  view_ai_milestone_insights: "View AI Insights",
  
  lock_unlock_plan: "Unlock Project Plans",
  unlock_any_plan: "Unlock Project Plans",
  
  override_any_approval: "Emergency Project Access",
};

// Sensible access level fallbacks when a role gains view access to a screen
const SCREEN_DEFAULT_LEVELS: Record<string, AccessLevel> = {
  portfolio_dashboard: "view",
  project_dashboard: "view",
  project_setup_edit: "full",
  task_list: "own",
  task_detail_create: "own",
  resource_calendar: "view",
  plan_change_approval: "full",
  timesheet_daily_log: "own",
  timesheet_team_view: "view",
  my_tasks_cross_project: "full",
  leave_submit_track: "own",
  leave_approval_queue: "full",
  travel_expenses: "own",
  billing_milestones: "view",
  monthly_billing_summary: "view",
  user_management: "full",
  system_configuration: "full",
  audit_log: "full",
  ai_task_estimation: "full",
  ai_delay_analysis: "full",
  ai_weekly_summary: "full",
  ai_assignment_suggest: "full",
  ai_efficiency_metrics: "view",
  ai_co2_report: "full",
  ai_milestone_insights: "view",
  client_project_status: "limited",
  client_milestone_tracker: "limited",

  // CRM screens
  crm_dashboard: "full",
  crm_clients: "full",
  crm_contacts: "full",
  crm_calls: "full",
  crm_meetings: "full",
  crm_follow_ups: "full",
  crm_requirements: "full",
  crm_opportunities: "full",
  crm_escalations: "full",
  crm_reports: "full",
};

function normalizeRole(role: string): UserRole {
  if (!role) return "consultant";
  const mapping: Record<string, UserRole> = {
    "Super Admin": "super_admin",
    "Client Manager": "client_manager",
    "Project Manager": "project_manager",
    "Senior Consultant": "senior_consultant",
    "Consultant": "consultant",
    "Accounts": "accounts",
    "Client Contact": "client_contact"
  };
  return mapping[role] || (role as UserRole);
}

/** Checks active override permissions for the currently logged-in user. */
function getActiveOverride(permissionKey: string): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const state = useAppStore.getState();
    const currentUser = state.user;
    if (!currentUser) return null;
    
    const now = new Date();
    const overrides = state.permissionOverrides || [];
    const active = overrides.find(o => 
      o.userId === currentUser.id && 
      o.permissionKey === permissionKey &&
      o.isActive &&
      new Date(o.startDate) <= now &&
      new Date(o.endDate) >= now &&
      (o.status === "approved" || o.status === undefined)
    );
    if (active) {
      return active.granted;
    }
  } catch (_) {}
  return null;
}

/** Looks up matrix value in local storage. */
function getMatrixPermission(permissionKey: string, role: string): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem("vsqc_permissions_matrix");
    if (!saved) return null;
    const matrix: { name: string; vals: boolean[] }[] = JSON.parse(saved);
    const row = matrix.find(r => r.name === permissionKey);
    if (!row) return null;
    const normRole = normalizeRole(role);
    const roleIdx = ROLE_TO_INDEX[normRole];
    if (roleIdx === undefined) return null;
    return row.vals[roleIdx] ?? null;
  } catch (_) {}
  return null;
}

/**
 * Returns the access level for a screen+role pair.
 * "full" | "view" | "own" | "limited" | null
 */
export function getScreenAccess(screen: string, role: UserRole): AccessLevel {
  const normRole = normalizeRole(role);
  
  // Timesheet AI Center (ai_co2_report) should always be accessible to project_manager by default (no permission matrix check)
  if (screen === "ai_co2_report" && normRole === "project_manager") {
    return "full";
  }

  // Consultant Analytics (ai_efficiency_metrics) should not be accessible to consultant or senior_consultant
  if (screen === "ai_efficiency_metrics" && (normRole === "consultant" || normRole === "senior_consultant")) {
    return null;
  }
  
  // CRM screens are strictly client_manager only, or allowed via override
  if (screen.startsWith("crm_") && normRole !== "client_manager") {
    const override = getActiveOverride("CRM Access");
    if (override !== true) {
      return null;
    }
  }

  // Client Manager cannot access Project Management, Admin, or Consultant Analytics screens
  if (normRole === "client_manager") {
    const blockedScreens = [
      "project_setup_edit",
      "task_detail_create",
      "resource_calendar",
      "plan_change_approval",
      "billing_milestones",
      "monthly_billing_summary",
      "user_management",
      "system_configuration",
      "audit_log",
      "ai_efficiency_metrics"
    ];
    if (blockedScreens.includes(screen)) {
      return null;
    }
  }

  if (normRole === "super_admin") return "full";
  const permKey = MATRIX_PERMISSION_MAPPING[screen];
  if (permKey) {
    if (typeof window !== "undefined") {
      const state = useAppStore.getState();
      const currentUser = state.user;
      if (currentUser && normalizeRole(currentUser.role) === normRole) {
        const override = getActiveOverride(permKey);
        if (override !== null) {
          return override ? (SCREEN_DEFAULT_LEVELS[screen] ?? "full") : null;
        }
      }
    }
    const matrixVal = getMatrixPermission(permKey, normRole);
    if (matrixVal !== null) {
      if (!matrixVal) return null;
      return SCREEN_ACCESS[screen]?.[normRole] ?? SCREEN_DEFAULT_LEVELS[screen] ?? "full";
    }
  }
  return SCREEN_ACCESS[screen]?.[normRole] ?? null;
}

/** True if the role can access the screen at all (any level). */
export function canAccessScreen(screen: string, role: UserRole): boolean {
  return getScreenAccess(screen, role) !== null;
}

/** True if the role can perform a specific action. */
export function canDo(action: string, role: UserRole): boolean {
  const normRole = normalizeRole(role);

  // Timesheet AI Center action should always be allowed for project_manager by default (no permission matrix check)
  if (action === "use_ai_co2_report" && normRole === "project_manager") {
    return true;
  }

  // Consultant Analytics (view_ai_efficiency) should not be allowed for consultant or senior_consultant
  if (action === "view_ai_efficiency" && (normRole === "consultant" || normRole === "senior_consultant")) {
    return false;
  }

  // CRM actions are strictly client_manager only
  const crmActions = [
    "manage_clients",
    "manage_contacts",
    "manage_calls",
    "manage_meetings",
    "manage_follow_ups",
    "manage_requirements",
    "manage_opportunities",
    "manage_escalations",
    "generate_crm_reports",
    "view_client_analytics"
  ];
  // CRM actions are strictly client_manager only, or allowed via override
  if (crmActions.includes(action) && normRole !== "client_manager") {
    const override = getActiveOverride("CRM Access");
    if (override !== true) {
      return false;
    }
  }

  if (normRole === "super_admin") return true;
  const permKey = MATRIX_PERMISSION_MAPPING[action];
  if (permKey) {
    if (typeof window !== "undefined") {
      const state = useAppStore.getState();
      const currentUser = state.user;
      if (currentUser && normalizeRole(currentUser.role) === normRole) {
        const override = getActiveOverride(permKey);
        if (override !== null) {
          return override;
        }
      }
    }
    const matrixVal = getMatrixPermission(permKey, normRole);
    if (matrixVal !== null) {
      return matrixVal;
    }
  }
  return ACTION_PERMISSIONS[action]?.includes(normRole) ?? false;
}

/** True if the role has full access (not read-only, not own-only). */
export function hasFullAccess(screen: string, role: UserRole): boolean {
  return getScreenAccess(screen, role) === "full";
}

/** True if the role's access is read-only ("view" or "limited"). */
export function isReadOnly(screen: string, role: UserRole): boolean {
  const level = getScreenAccess(screen, role);
  return level === "view" || level === "limited";
}

/** True if the role can only see/edit their own records on this screen. */
export function isOwnOnly(screen: string, role: UserRole): boolean {
  return getScreenAccess(screen, role) === "own";
}

/** True if the role's access is "limited" (field-level hiding required). */
export function isLimitedAccess(screen: string, role: UserRole): boolean {
  return getScreenAccess(screen, role) === "limited";
}

export function getScreenKey(path: string): string {
  if (path === "/dashboard") return "portfolio_dashboard";
  if (path === "/projects") return "portfolio_dashboard";
  if (path === "/portfolio") return "portfolio_dashboard";
  if (path === "/portal") return "client_project_status";
  if (path.startsWith("/projects/")) return "project_dashboard";
  if (path === "/tasks") return "task_list";
  if (path === "/my-tasks") return "task_list";
  if (path === "/resources") return "resource_calendar";
  if (path === "/timesheets") return "timesheet_daily_log";
  if (path === "/timesheet") return "timesheet_daily_log";
  if (path === "/leave") return "leave_submit_track";
  if (path === "/expenses") return "travel_expenses";
  if (path === "/billing") return "billing_milestones";
  if (path === "/billing/milestones") return "billing_milestones";
  if (path === "/analytics") return "ai_efficiency_metrics";
  if (path === "/ai") return "ai_task_estimation";
  if (path === "/admin") return "user_management";
  if (path === "/admin/users") return "user_management";
  if (path === "/cm-dashboard") return "crm_dashboard";
  if (path === "/clients") return "crm_clients";
  if (path.startsWith("/clients/")) return "crm_clients";
  if (path === "/contacts") return "crm_contacts";
  if (path === "/calls") return "crm_calls";
  if (path === "/meetings") return "crm_meetings";
  if (path === "/follow-ups") return "crm_follow_ups";
  if (path === "/requirements") return "crm_requirements";
  if (path === "/opportunities") return "crm_opportunities";
  if (path === "/escalations") return "crm_escalations";
  if (path === "/reports/cm") return "crm_reports";
  if (path === "/timesheet-ai") return "ai_co2_report";
  return "portfolio_dashboard";
}
