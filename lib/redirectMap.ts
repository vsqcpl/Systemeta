import { ROLES, UserRole } from "./roles";

import { canAccessScreen } from "./permissionHelpers";

// Designated first screen per role after successful login (legacy — kept for reference)
export const ROLE_FIRST_SCREEN: Record<UserRole, string> = {
  [ROLES.SUPER_ADMIN]:       "/admin/users",
  [ROLES.CLIENT_MANAGER]:    "/cm-dashboard",
  [ROLES.PROJECT_MANAGER]:   "/portfolio",
  [ROLES.SENIOR_CONSULTANT]: "/timesheet",
  [ROLES.CONSULTANT]:        "/my-tasks",
  [ROLES.ACCOUNTS]:          "/billing/milestones",
  [ROLES.CLIENT_CONTACT]:    "/portal",
};

export function getPostLoginRedirect(role: UserRole): string {
  return ROLE_FIRST_SCREEN[role] ?? "/login";
}

/**
 * Returns the correct first route for a given role entering a module dynamically.
 * It checks if the role has access to any of the primary screens in the module.
 * If they do, it routes them to that screen.
 * If they have access to NO screens in the module, it returns "/403".
 */
const MODULE_ROUTES = {
  projects: [
    { screen: "portfolio_dashboard", route: "/dashboard" },
    { screen: "task_list", route: "/tasks" },
    { screen: "my_tasks_cross_project", route: "/tasks" },
    { screen: "billing_milestones", route: "/billing" },
    { screen: "monthly_billing_summary", route: "/billing" },
    { screen: "resource_calendar", route: "/resources" },
    { screen: "user_management", route: "/admin/users" },
    { screen: "client_project_status", route: "/portal" },
  ],
  timesheets: [
    { screen: "timesheet_daily_log", route: "/timesheets" },
    { screen: "timesheet_team_view", route: "/timesheets" },
    { screen: "leave_submit_track", route: "/leave" },
    { screen: "travel_expenses", route: "/expenses" },
  ]
};

export function getModuleEntryPage(role: UserRole, module: "projects" | "timesheets" | "crm"): string {
  if (module === "crm") {
    return "/cm-dashboard";
  }
  const possibleRoutes = MODULE_ROUTES[module as "projects" | "timesheets"] || [];
  
  for (const { screen, route } of possibleRoutes) {
    if (canAccessScreen(screen, role)) {
      return route;
    }
  }
  
  return "/403";
}
