"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";
import { getModuleEntryPage } from "@/lib/redirectMap";
import { UserRole } from "@/lib/roles";
import { CheckCircle } from "lucide-react";

export default function SelectModulePage() {
  const router = useRouter();
  const darkMode = useAppStore((state) => state.darkMode);
  const setDarkMode = useAppStore((state) => state.setDarkMode);
  const setActiveModule = useAppStore((state) => state.setActiveModule);

  const { user } = useAuth();
  const [hoveredCard, setHoveredCard] = useState<"timesheets" | "crm" | "projects" | null>(null);

  React.useEffect(() => {
    document.documentElement.classList.add("landing-page-route");
    document.body.classList.add("landing-page-route");
    return () => {
      document.documentElement.classList.remove("landing-page-route");
      document.body.classList.remove("landing-page-route");
    };
  }, []);

  React.useEffect(() => {
    if (!user) return;
    // client_contact goes straight to their portal
    if (user.role === "client_contact") {
      try { localStorage.setItem("vsqc_active_module", "projects"); } catch (_) {}
      const destination = getModuleEntryPage(user.role as UserRole, "projects");
      router.replace(destination);
    }
    // client_manager still sees module picker (Timesheet + CRM)
  }, [user, router]);

  const handleSelectModule = (module: "timesheets" | "crm" | "projects") => {
    try { localStorage.setItem("vsqc_active_module", module); } catch (_) {}
    if (module === "crm") {
      // CRM goes to the CM dashboard
      setActiveModule("crm" as any);
      router.push("/cm-dashboard");
      return;
    }
    setActiveModule(module as any);
    const destination = user ? getModuleEntryPage(user.role as UserRole, module) : "/403";
    router.push(destination);
  };

  const handleSignOut = () => {
    setActiveModule(null);
    router.push("/login");
  };

  const moonIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );

  const sunIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

  // Determine which cards to show based on role
  const showTimesheet = user?.role !== "client_contact" && user?.role !== "Client Contact";
  const showCRM = user?.role === "client_manager" || user?.role === "Client Manager";
  const showProjects = user?.role !== "client_contact" && user?.role !== "Client Contact";

  return (
    <div className="ms-page">
      {/* Background orbs */}
      <div className="login-orb login-orb-1"></div>
      <div className="login-orb login-orb-2"></div>

      {/* Top bar */}
      <div className="ms-topbar">
        <div className="brand-logo-container" style={{ display: "flex", alignItems: "center", gap: "12px", background: "transparent", boxShadow: "none", padding: 0 }}>
          <div className="sidebar-logo" style={{ background: "transparent", minWidth: "34px", width: "34px", height: "34px", padding: 0 }}>
            <img src="/logo.png" alt="Logo" style={{ width: "34px", height: "34px", borderRadius: "8px", objectFit: "cover" }} />
          </div>
          <img src="/systemata.jpg" alt="Systemata" style={{ height: "26px", objectFit: "contain", transform: "translateY(2px)" }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            className="topbar-btn"
            onClick={() => setDarkMode(!darkMode)}
            style={{ borderRadius: "50%", width: "34px", height: "34px", minWidth: "34px" }}
            title={darkMode ? "Light mode" : "Dark mode"}
          >
            {darkMode ? sunIcon : moonIcon}
          </button>
          <div className="ms-user-pill">
            <div
              className="avatar"
              style={{
                background: "var(--brand-100)",
                width: "28px",
                height: "28px",
                minWidth: "28px",
                fontSize: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--brand-700)",
              }}
            >
              {user?.name ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "TK"}
            </div>
            <span>{user?.name || "Tom Keller"}</span>
            <span className="ms-user-role">
              {user?.role
                ? user.role === "super_admin"
                  ? "Super Admin"
                  : user.role === "client_manager"
                  ? "Client Manager"
                  : user.role === "project_manager"
                  ? "Project Manager"
                  : user.role === "senior_consultant"
                  ? "Senior Consultant"
                  : user.role === "consultant"
                  ? "Consultant"
                  : user.role === "accounts"
                  ? "Accounts"
                  : "Client Contact"
                : "Director"}
            </span>
          </div>
          <button className="ms-signout" onClick={handleSignOut}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
        </div>
      </div>

      {/* Hero */}
      <div className="ms-hero">
        <div className="ms-badge" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <CheckCircle size={14} color="var(--success-500)" /> Signed in successfully
        </div>
        <h1 className="ms-title">Welcome to Systemeta</h1>
        <p className="ms-subtitle">Select a module to get started</p>
      </div>

      {/* Module Cards */}
      <div className="ms-cards">

        {/* ── Project Management Module ── */}
        {showProjects && (
          <div
            className={`ms-card ${hoveredCard === "projects" ? "ms-card-hovered" : ""}`}
            id="ms-card-pm"
            onClick={() => handleSelectModule("projects")}
            onMouseEnter={() => setHoveredCard("projects")}
            onMouseLeave={() => setHoveredCard(null)}
            style={{ cursor: "pointer" }}
          >
            <div className="ms-card-inner">
              <div className="ms-card-header">
                <div className="ms-icon ms-icon-blue">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                </div>
                <span className="ms-module-tag" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  </svg>
                  {" "}Module
                </span>
              </div>
              <div className="ms-card-body">
                <h2 className="ms-card-title">Project Management</h2>
                <p className="ms-card-desc">
                  Manage projects, tasks, resources, consultants, milestones, billing, and project progress.
                </p>
                <ul className="ms-feature-list">
                  <li><span className="ms-dot ms-dot-blue"></span>Project hierarchy &amp; tasks</li>
                  <li><span className="ms-dot ms-dot-blue"></span>Resource calendar &amp; capacity</li>
                  <li><span className="ms-dot ms-dot-blue"></span>Client billing &amp; milestones</li>
                  <li><span className="ms-dot ms-dot-blue"></span>AI insights &amp; forecasts</li>
                </ul>
              </div>
              <div className="ms-card-footer">
                <span className="ms-enter-link ms-enter-blue">Enter Project Management</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="ms-arrow">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
            </div>
            <div className="ms-card-glow ms-glow-blue"></div>
          </div>
        )}

        {/* ── Timesheet Module ── */}
        {showTimesheet && (
          <div
            className={`ms-card ${hoveredCard === "timesheets" ? "ms-card-hovered" : ""}`}
            id="ms-card-ts"
            onClick={() => handleSelectModule("timesheets")}
            onMouseEnter={() => setHoveredCard("timesheets")}
            onMouseLeave={() => setHoveredCard(null)}
            style={{ cursor: "pointer" }}
          >
            <div className="ms-card-inner">
              <div className="ms-card-header">
                {/* Purple clock icon — matches img 3 */}
                <div className="ms-icon ms-icon-teal">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <span className="ms-module-tag" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                  {" "}Module
                </span>
              </div>
              <div className="ms-card-body">
                <h2 className="ms-card-title">Timesheet</h2>
                <p className="ms-card-desc">
                  Submit timesheets, manage leave requests, track attendance, approvals, and utilization.
                </p>
                <ul className="ms-feature-list">
                  <li><span className="ms-dot ms-dot-teal"></span>Daily / weekly entry</li>
                  <li><span className="ms-dot ms-dot-teal"></span>Leave management</li>
                  <li><span className="ms-dot ms-dot-teal"></span>Approval workflows</li>
                  <li><span className="ms-dot ms-dot-teal"></span>Utilization reports</li>
                </ul>
              </div>
              <div className="ms-card-footer">
                <span className="ms-enter-link ms-enter-teal">Enter Timesheet Module</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="ms-arrow ms-arrow-teal">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
            </div>
            <div className="ms-card-glow ms-glow-teal"></div>
          </div>
        )}

        {/* ── CRM Module ── */}
        {showCRM && (
          <div
            className={`ms-card ${hoveredCard === "crm" ? "ms-card-hovered" : ""}`}
            id="ms-card-crm"
            onClick={() => handleSelectModule("crm")}
            onMouseEnter={() => setHoveredCard("crm")}
            onMouseLeave={() => setHoveredCard(null)}
            style={{ cursor: "pointer" }}
          >
            <div className="ms-card-inner">
              <div className="ms-card-header">
                {/* Purple people icon — matches img 3 */}
                <div className="ms-icon ms-icon-crm">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <span className="ms-module-tag" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  </svg>
                  {" "}Module
                </span>
              </div>
              <div className="ms-card-body">
                <h2 className="ms-card-title">CRM</h2>
                <p className="ms-card-desc">
                  Manage assigned clients, track communication history, log meetings and calls, and follow up.
                </p>
                <ul className="ms-feature-list">
                  <li><span className="ms-dot ms-dot-crm"></span>Client details &amp; history</li>
                  <li><span className="ms-dot ms-dot-crm"></span>Log calls &amp; meetings</li>
                  <li><span className="ms-dot ms-dot-crm"></span>Assigned projects access</li>
                  <li><span className="ms-dot ms-dot-crm"></span>Follow-ups &amp; reminders</li>
                </ul>
              </div>
              <div className="ms-card-footer">
                <span className="ms-enter-link ms-enter-crm">Enter CRM Module</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="ms-arrow ms-arrow-crm">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
            </div>
            <div className="ms-card-glow ms-glow-crm"></div>
          </div>
        )}
      </div>

      <p className="ms-footer-note">
        Your access is governed by role-based permissions. Need a different role?{" "}
        <a href="#" onClick={(e) => e.preventDefault()}>
          Request access
        </a>
      </p>
    </div>
  );
}
