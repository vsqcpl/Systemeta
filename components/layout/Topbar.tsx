"use client";

import React, { useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppStore, useTranslation } from "@/lib/store";
import NotificationPanel from "./NotificationPanel";
import { useAuth } from "@/hooks/useAuth";
import { ROLES, UserRole } from "@/lib/roles";
import { getModuleEntryPage } from "@/lib/redirectMap";
import { IconBriefcase, IconClock } from "@/components/ui/Icons";

export default function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const darkMode = useAppStore((state) => state.darkMode);
  const setDarkMode = useAppStore((state) => state.setDarkMode);
  const notifOpen = useAppStore((state) => state.notifOpen);
  const setNotifOpen = useAppStore((state) => state.setNotifOpen);
  const setSearchOpen = useAppStore((state) => state.setSearchOpen);
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useAppStore((state) => state.setSidebarCollapsed);
  const notifications = useAppStore((state) => state.data.notifications);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const notifButtonRef = useRef<HTMLButtonElement>(null);

  const activeModule = useAppStore((state) => state.activeModule);
  const setActiveModule = useAppStore((state) => state.setActiveModule);

  const { t } = useTranslation();

  // Restore module selection from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("vsqc_active_module") as "projects" | "timesheets" | null;
    if (saved && saved !== activeModule) {
      setActiveModule(saved);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleModuleSwitch = (module: "projects" | "timesheets" | "crm") => {
    if (module === activeModule) return;
    localStorage.setItem("vsqc_active_module", module);
    setActiveModule(module as any);
    const destination = user 
      ? getModuleEntryPage(user.role as UserRole, module)
      : "/403";
    router.push(destination);
  };

  // Derive notification filter category from the active route
  const getNotifFilterCategory = (): "project" | "timesheet" | undefined => {
    if (pathname.startsWith("/projects") || pathname.startsWith("/tasks") || pathname.startsWith("/gantt")) {
      return "project";
    }
    if (pathname.startsWith("/timesheets")) {
      return "timesheet";
    }
    return undefined;
  };

  // Map route paths to screen labels
  const getScreenLabel = () => {
    if (pathname.startsWith("/projects/")) {
      // Individual project view
      return t("Project Dashboard");
    }
    const labels: Record<string, string> = {
      "/dashboard": t("Executive Dashboard"),
      "/projects": t("Project Portfolio"),
      "/tasks": t("Task Management"),
      "/gantt": t("Gantt / Timeline"),
      "/resources": t("Resource Planning"),
      "/timesheets": t("Timesheets"),
      "/leave": t("Leave Management"),
      "/expenses": t("Travel & Expenses"),
      "/billing": t("Billing & Finance"),
      "/analytics": t("Consultant Analytics"),
      "/ai": t("AI Insights Center"),
      "/admin": t("Admin Panel"),
      "/cm-dashboard": "CRM Dashboard",
      "/clients": "Clients",
      "/contacts": "Contacts",
      "/calls": "Calls",
      "/meetings": "Meetings",
      "/follow-ups": "Follow Ups",
      "/requirements": "Requirements",
      "/opportunities": "Opportunities",
      "/escalations": "Escalations",
      "/reports/cm": "CRM Reports",
    };
    return labels[pathname] || "Dashboard";
  };

  // Show back button on sub-pages (anything other than landing screens)
  const showBackButton = pathname !== "/dashboard" && pathname !== "/timesheets";

  const handleBack = () => {
    router.back();
  };

  const moonIcon = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );

  const sunIcon = (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );

  const initials = user
    ? user.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()
    : "TK";

  const userRole = user
    ? user.role.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())
    : "Director";

  const isClientContact = user?.role === ROLES.CLIENT_CONTACT;
  const isClientManager = user?.role === ROLES.CLIENT_MANAGER || user?.role === "client_manager";

  return (
    <header className="topbar" style={{ position: "relative" }}>
      <div className="topbar-breadcrumb" id="breadcrumb" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {showBackButton && (
          <button
            id="back-btn"
            onClick={handleBack}
            title="Go back"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "30px",
              height: "30px",
              border: "none",
              borderRadius: "8px",
              background: "var(--gray-100)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              transition: "background 0.15s, color 0.15s",
              flexShrink: 0,
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}
        <span
          className="breadcrumb-item"
          style={{ cursor: "pointer" }}
          onClick={() => router.push(isClientContact ? "/portal" : "/select-module")}
        >
          VSQC
        </span>

        <span className="breadcrumb-sep" style={{ marginLeft: "4.5px" }}>›</span>
        <span className="breadcrumb-item active" id="bc-current">
          {getScreenLabel()}
        </span>

        {/* Module Switcher - Positioned inline near the breadcrumb */}
        {!isClientContact && !isClientManager && (
          <div className="topbar-module-switcher" id="module-switcher">
            <div className={`switcher-indicator ${activeModule === "projects" ? "projects-active" : "timesheets-active"}`} />
            <button
              id="module-btn-projects"
              className={`switcher-btn ${activeModule === "projects" ? "active" : ""}`}
              onClick={() => handleModuleSwitch("projects")}
              title={t("Project Management")}
            >
              <IconBriefcase size={13} style={{ marginRight: "4px" }} />
              <span>{t("Project Management")}</span>
            </button>
            <button
              id="module-btn-timesheets"
              className={`switcher-btn ${activeModule === "timesheets" ? "active" : ""}`}
              onClick={() => handleModuleSwitch("timesheets")}
              title={t("Timesheet")}
            >
              <IconClock size={13} style={{ marginRight: "4px" }} />
              <span>{t("Timesheet")}</span>
            </button>
          </div>
        )}
        {isClientManager && (
          <div className="topbar-module-switcher" id="module-switcher">
            <div className={`switcher-indicator ${activeModule === "crm" ? "projects-active" : "timesheets-active"}`} />
            <button
              id="module-btn-crm"
              className={`switcher-btn ${activeModule === "crm" ? "active" : ""}`}
              onClick={() => handleModuleSwitch("crm")}
              title={t("CRM")}
            >
              <IconBriefcase size={13} style={{ marginRight: "4px" }} />
              <span>{t("CRM") || "CRM"}</span>
            </button>
            <button
              id="module-btn-timesheets"
              className={`switcher-btn ${activeModule === "timesheets" ? "active" : ""}`}
              onClick={() => handleModuleSwitch("timesheets")}
              title={t("Timesheet")}
            >
              <IconClock size={13} style={{ marginRight: "4px" }} />
              <span>{t("Timesheet")}</span>
            </button>
          </div>
        )}
      </div>

      <div className="topbar-actions">
        {/* Search button */}
        <button className="btn btn-secondary btn-sm" onClick={() => setSearchOpen(true)} style={{ gap: "8px" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          {t("Search")}
        </button>

        <div className="divider-v"></div>

        {/* Theme Toggle */}
        <button
          className="topbar-btn"
          onClick={() => setDarkMode(!darkMode)}
          title={darkMode ? "Light mode" : "Dark mode"}
        >
          {darkMode ? sunIcon : moonIcon}
        </button>

        {/* Notifications Panel Trigger - Hidden for Client Contact */}
        {!isClientContact && (
          <>
            <div className="divider-v"></div>
            <div style={{ position: "relative" }}>
              <button
                ref={notifButtonRef}
                className="topbar-btn"
                onClick={(e) => { e.stopPropagation(); setNotifOpen(!notifOpen); }}
                id="notif-btn"
                title="Notifications"
                style={{ position: "relative" }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: "-3px",
                      right: "-3px",
                      background: "#ef4444",
                      color: "white",
                      borderRadius: "999px",
                      fontSize: "9px",
                      fontWeight: 700,
                      minWidth: "14px",
                      height: "14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0 3px",
                      lineHeight: 1,
                      pointerEvents: "none",
                    }}
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              <NotificationPanel buttonRef={notifButtonRef} filterCategory={getNotifFilterCategory()} />
            </div>
          </>
        )}

        <div className="divider-v"></div>

        {/* User Card */}
        <div
          className="avatar avatar-lg"
          style={{
            background: "var(--brand-100)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--brand-700)",
            fontSize: "11px",
            fontWeight: "bold",
          }}
          onClick={() => router.push(isClientContact ? "/portal" : "/select-module")}
          title={`${user ? user.name : "Tom Keller"} — ${userRole} (Click to switch module)`}
        >
          {initials}
        </div>
      </div>
    </header>
  );
}
