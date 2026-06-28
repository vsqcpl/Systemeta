"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAppStore, useTranslation } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";
import { usePermission } from "@/hooks/usePermission";
import { hasAnyAiAccess } from "@/lib/featureFlags";
import { UserRole } from "@/lib/roles";
import {
  IconGrid,
  IconFolder,
  IconTarget,
  IconCheck,
  IconUsers,
  IconClock,
  IconUmbrella,
  IconReceipt,
  IconChart,
  IconCpu,
  IconReportMoney,
  IconSettings,
} from "@/components/ui/Icons";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { canAccess, role } = usePermission();

  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useAppStore((state) => state.setSidebarCollapsed);
  const activeModule = useAppStore((state) => state.activeModule);
  const activeProjectId = useAppStore((state) => state.activeProjectId);
  const data = useAppStore((state) => state.data);

  // Determine project link — prefer activeProjectId, fallback to first visible project
  const projectLinkId = activeProjectId || data.projects[0]?.id || "";

  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);

  // Module → allowed screen IDs
  const MODULE_SCREENS: Record<string, string[]> = {
    projects: ["dashboard", "projects", "project", "tasks", "resources", "billing", "ai", "admin"],
    timesheets: role === "client_manager"
      ? ["timesheets", "leave", "expenses", "timesheet-ai"]
      : ["timesheets", "leave", "expenses", "analytics", "timesheet-ai"],
    crm: ["crm_dashboard", "crm_clients", "crm_contacts", "crm_calls", "crm_meetings", "crm_follow_ups", "crm_requirements", "crm_opportunities", "crm_escalations", "crm_reports"],
  };
  const allowed = activeModule ? MODULE_SCREENS[activeModule] ?? [] : [];

  const { t } = useTranslation();

  // Screen mapping to permissions
  const itemPermissionKeys: Record<string, string[]> = {
    dashboard: ["portfolio_dashboard"],
    projects: ["portfolio_dashboard"],
    project: ["project_dashboard"],
    tasks: ["task_list", "my_tasks_cross_project"],
    resources: ["resource_calendar"],
    timesheets: ["timesheet_daily_log"],
    leave: ["leave_submit_track", "leave_approval_queue"],
    expenses: ["travel_expenses"],
    billing: ["billing_milestones", "monthly_billing_summary"],
    analytics: ["ai_efficiency_metrics"],
    ai: ["ai_task_estimation", "ai_delay_analysis", "ai_weekly_summary", "ai_assignment_suggest"],
    "timesheet-ai": ["ai_efficiency_metrics", "ai_co2_report", "ai_milestone_insights"],
    admin: ["user_management", "system_configuration", "audit_log"],
    crm_dashboard: ["crm_dashboard"],
    crm_clients: ["crm_clients"],
    crm_contacts: ["crm_contacts"],
    crm_calls: ["crm_calls"],
    crm_meetings: ["crm_meetings"],
    crm_follow_ups: ["crm_follow_ups"],
    crm_requirements: ["crm_requirements"],
    crm_opportunities: ["crm_opportunities"],
    crm_escalations: ["crm_escalations"],
    crm_reports: ["crm_reports"],
  };

  // Nav groups — each group separated by a divider
  const navGroups = [
    {
      id: "overview",
      items: [
        { id: "dashboard",  label: t("Executive Dashboard"),  icon: <IconGrid />,         route: "/dashboard" },
        { id: "projects",   label: t("Project Portfolio"),    icon: <IconFolder />,       route: "/projects" },
      ],
    },
    {
      id: "delivery",
      items: [
        { id: "project",    label: t("Project Dashboard"),    icon: <IconTarget />,       route: projectLinkId ? `/projects/${projectLinkId}` : "/projects" },
        { id: "tasks",      label: t("Task Management"),      icon: <IconCheck />,        route: "/tasks" },
      ],
    },
    {
      id: "people",
      items: [
        { id: "resources",  label: t("Resource Planning"),    icon: <IconUsers />,        route: "/resources" },
        { id: "timesheets", label: t("Timesheets"),           icon: <IconClock />,        route: "/timesheets" },
        { id: "leave",      label: t("Leave Management"),     icon: <IconUmbrella />,     route: "/leave" },
      ],
    },
    {
      id: "finance",
      items: [
        { id: "expenses",   label: t("Travel & Expenses"),    icon: <IconReceipt />,      route: "/expenses" },
        { id: "billing",    label: t("Billing & Finance"),    icon: <IconReportMoney />,  route: "/billing" },
      ],
    },
    {
      id: "intelligence",
      items: [
        { id: "analytics",     label: t("Consultant Analytics"), icon: <IconChart />,    route: "/analytics" },
        { id: "ai",            label: t("AI Insights Center"),   icon: <IconCpu />,      route: "/ai" },
        { id: "timesheet-ai",  label: t("AI Center"),            icon: <IconCpu />,      route: "/timesheet-ai" },
      ],
    },
    {
      id: "system",
      items: [
        { id: "admin",     label: t("Admin Panel"), icon: <IconSettings />, route: "/admin" },
      ],
    },
    {
      id: "crm",
      items: [
        { id: "crm_dashboard",     label: "CRM Dashboard",   icon: <IconGrid />,         route: "/cm-dashboard" },
        { id: "crm_clients",       label: "Clients",         icon: <IconUsers />,        route: "/clients" },
        { id: "crm_contacts",      label: "Contacts",        icon: <IconUsers />,        route: "/contacts" },
        { id: "crm_calls",         label: "Calls",           icon: <IconTarget />,       route: "/calls" },
        { id: "crm_meetings",      label: "Meetings",        icon: <IconClock />,        route: "/meetings" },
        { id: "crm_follow_ups",    label: "Follow Ups",      icon: <IconCheck />,        route: "/follow-ups" },
        { id: "crm_requirements",   label: "Requirements",    icon: <IconFolder />,       route: "/requirements" },
        { id: "crm_opportunities",  label: "Opportunities",   icon: <IconChart />,        route: "/opportunities" },
        { id: "crm_escalations",    label: "Escalations",     icon: <IconTarget />,       route: "/escalations" },
        { id: "crm_reports",       label: "CRM Reports",     icon: <IconReportMoney />,  route: "/reports/cm" },
      ],
    },
  ];

  // Helper to check if user has access to a nav item
  const isNavAllowed = (itemId: string): boolean => {
    // 1. Check if allowed in the active module list
    if (!allowed.includes(itemId)) return false;

    // 2. Check AI gating
    if ((itemId === "ai" || itemId === "timesheet-ai") && role) {
      if (!hasAnyAiAccess(role as UserRole)) return false;
    }

    // 3. Check role-based permission
    const keys = itemPermissionKeys[itemId];
    if (keys) {
      return keys.some(key => canAccess(key));
    }

    return true;
  };

  // Filter to only items allowed by activeModule and Role Permissions
  const filteredGroups = navGroups
    .map((g) => ({ ...g, items: g.items.filter((item) => isNavAllowed(item.id)) }))
    .filter((g) => g.items.length > 0);

  const isExpanded = !sidebarCollapsed;

  const initials = user
    ? user.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()
    : "TK";

  const displayRole = user
    ? user.role.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())
    : "Director";

  return (
    <aside
      className={`sidebar ${isExpanded ? "expanded" : "collapsed"}`}
      id="sidebar"
    >
      <div className="sidebar-inner">
        {/* Top Header Row — logo & toggle */}
        <div className="sidebar-header-row">
          <Link
            href="/dashboard"
            className="sidebar-logo"
            id="sidebar-logo"
            title="Executive Dashboard"
            style={{ textDecoration: "none" }}
          >
            VS
          </Link>

          <button
            className="sidebar-toggle-btn"
            onClick={toggleSidebar}
            title={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
            id="sidebar-toggle"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {isExpanded ? (
                // Chevron left when expanded
                <polyline points="15 18 9 12 15 6" />
              ) : (
                // Hamburger when collapsed
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>

        {/* Nav groups */}
        <div className="sidebar-nav-container">
          <div className="sidebar-nav-section">
            {filteredGroups.map((group, groupIdx) => (
              <React.Fragment key={group.id}>
                {groupIdx > 0 && <div className="sidebar-divider" />}
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.route ||
                    (item.route.length > 1 && pathname.startsWith(item.route + "/"));
                  return (
                    <Link
                      key={item.id}
                      href={item.route}
                      className={`sidebar-nav-item${isActive ? " active" : ""}`}
                      id={`nav-${item.id}`}
                      style={{ textDecoration: "none" }}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      {item.icon}
                      <span className="sidebar-nav-label sidebar-label">{item.label}</span>
                    </Link>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* User profile row pinned to bottom */}
        <div
          className="sidebar-user"
          onClick={() => {
            if (role !== "client_contact") router.push("/select-module");
          }}
          title={role !== "client_contact" ? "Switch module" : undefined}
          id="sidebar-user"
          style={{ cursor: role !== "client_contact" ? "pointer" : "default" }}
        >
          <div
            className="sidebar-user-avatar"
            style={{
              background: "var(--brand-100, #dbeafe)",
              color: "var(--brand-700, #1e4976)",
            }}
          >
            {initials}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user ? user.name : "Tom Keller"}</span>
            <span className="sidebar-user-role">{displayRole}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
