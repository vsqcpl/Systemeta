"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useAppStore, useTranslation } from "@/lib/store";
import {
  getEmployeeResourceMetrics,
  getOverallResourceSummary,
  flattenTasks,
  EmployeeResourceMetrics,
} from "@/lib/resourcePlanningUtils";
import { Consultant, User } from "@/lib/data/types";

export default function ResourcesPage() {
  const data = useAppStore((state) => state.data);
  const { t } = useTranslation();
  const showToast = useAppStore((state) => state.showToast);
  const user = useAppStore((state) => state.user);

  // Filters State
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Modals & Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<
    "details" | "projects" | "utilization" | "allocation" | null
  >(null);
  const [selectedEmployeeMetrics, setSelectedEmployeeMetrics] =
    useState<EmployeeResourceMetrics | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    };
    if (activeMenuId) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeMenuId]);

  // Combine Consultants & Users for complete real employee roster
  const allEmployeesList = useMemo(() => {
    const map = new Map<string, any>();
    (data.consultants || []).forEach((c) => {
      const key = (c.id || c.name || "").toLowerCase();
      map.set(key, c);
    });

    (data.users || []).forEach((u) => {
      const key = (u.id || u.name || "").toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          id: u.id,
          name: u.name,
          role: u.role || "Team Member",
          dept: "Operations",
          utilization: 0,
          availability: 100,
          avatar: u.avatar || u.name.substring(0, 2).toUpperCase(),
          color: u.color || "#6366f1",
          skills: ["Consulting"],
        });
      }
    });
    return Array.from(map.values());
  }, [data.consultants, data.users]);

  // Extract Departments for Filter
  const departmentsList = useMemo(() => {
    const depts = new Set<string>();
    allEmployeesList.forEach((e) => {
      if (e.dept) depts.add(e.dept);
      if (e.department) depts.add(e.department);
    });
    return Array.from(depts).sort();
  }, [allEmployeesList]);

  // All Tasks
  const allTasks = useMemo(() => flattenTasks(data.tasks), [data.tasks]);

  // Filter Timesheets by Period if selected
  const filteredTimesheets = useMemo(() => {
    let timesheets = data.timesheets || [];
    if (selectedPeriod === "all") return timesheets;

    const now = new Date();
    return timesheets.filter((ts) => {
      if (!ts.week) return true;
      const tsDate = new Date(ts.week);
      if (isNaN(tsDate.getTime())) return true;

      if (selectedPeriod === "this_month") {
        return (
          tsDate.getMonth() === now.getMonth() &&
          tsDate.getFullYear() === now.getFullYear()
        );
      }
      if (selectedPeriod === "last_month") {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return (
          tsDate.getMonth() === lastMonth.getMonth() &&
          tsDate.getFullYear() === lastMonth.getFullYear()
        );
      }
      return true;
    });
  }, [data.timesheets, selectedPeriod]);

  // Calculate Metrics for All Employees
  const employeeMetricsList = useMemo(() => {
    return allEmployeesList.map((emp) =>
      getEmployeeResourceMetrics(
        emp,
        allTasks,
        filteredTimesheets,
        data.projects || [],
        selectedProject
      )
    );
  }, [allEmployeesList, allTasks, filteredTimesheets, data.projects, selectedProject]);

  // Filter Employee Metrics by UI Filters
  const filteredEmployeeMetrics = useMemo(() => {
    return employeeMetricsList.filter((m) => {
      if (selectedEmployee !== "all" && m.id !== selectedEmployee && m.name !== selectedEmployee) {
        return false;
      }
      if (selectedDepartment !== "all" && m.dept !== selectedDepartment) {
        return false;
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchName = m.name.toLowerCase().includes(term);
        const matchRole = m.role.toLowerCase().includes(term);
        const matchDept = m.dept.toLowerCase().includes(term);
        if (!matchName && !matchRole && !matchDept) return false;
      }
      return true;
    });
  }, [employeeMetricsList, selectedEmployee, selectedDepartment, searchTerm]);

  // Overall Summary Metrics
  const summary = useMemo(() => {
    return getOverallResourceSummary(filteredEmployeeMetrics);
  }, [filteredEmployeeMetrics]);

  // Extract Recent Submitted Weeks for Heatmap
  const recentWeeks = useMemo(() => {
    const weeksSet = new Set<string>();
    (data.timesheets || []).forEach((ts) => {
      if (ts.week) weeksSet.add(ts.week);
    });
    const sorted = Array.from(weeksSet).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );
    return sorted.slice(0, 5).reverse();
  }, [data.timesheets]);

  // Helper menu permissions
  const canAccessMenu = (m: EmployeeResourceMetrics) => {
    if (!user) return false;
    if (user.role === "super_admin" || user.role === "Super Admin" || user.role === "admin") {
      return true;
    }
    if (
      user.role === "project_manager" ||
      user.role === "Project Manager" ||
      user.role === "client_manager"
    ) {
      return true;
    }
    return user.id === m.id || user.name === m.name;
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    if (filteredEmployeeMetrics.length === 0) {
      showToast("No data to export", "warning");
      return;
    }
    const dateStr = new Date().toISOString().split("T")[0];
    const headers = [
      "Employee Name",
      "Role",
      "Department",
      "Planned Hours",
      "Actual Hours",
      "Logged Hours",
      "Capacity Hours",
      "Utilisation %",
      "Efficiency %",
      "Status",
      "Assigned Projects",
    ];

    const rows = filteredEmployeeMetrics.map((m) => [
      `"${m.name}"`,
      `"${m.role}"`,
      `"${m.dept}"`,
      m.plannedHours,
      m.actualHours,
      m.loggedHours,
      m.capacityHours,
      `${m.utilisationPercent}%`,
      `${m.efficiencyPercent}%`,
      `"${m.status}"`,
      `"${m.projects.join("; ")}"`,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Systemeta_Resource_Planning_${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Resource Planning CSV exported successfully", "success");
  };

  return (
    <div style={{ animation: "fadeIn 0.5s ease-out" }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("Resource Planning")}</h1>
          <p className="page-subtitle">
            {filteredEmployeeMetrics.length} {t("employees evaluated")} · {t("Live Real-Time Data")}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleExportCSV}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {t("Export CSV Report")}
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        className="card"
        style={{
          padding: "16px",
          marginBottom: "20px",
          display: "flex",
          flexWrap: "wrap",
          gap: "16px",
          alignItems: "center",
          background: "var(--bg-surface, #ffffff)",
        }}
      >
        <div style={{ flex: "1 1 200px" }}>
          <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
            {t("Filter Employee")}
          </label>
          <select
            className="login-input"
            style={{ padding: "8px 12px", fontSize: "13px" }}
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
          >
            <option value="all">{t("All Employees")}</option>
            {allEmployeesList.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} ({emp.role || "Consultant"})
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: "1 1 200px" }}>
          <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
            {t("Filter Project")}
          </label>
          <select
            className="login-input"
            style={{ padding: "8px 12px", fontSize: "13px" }}
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
          >
            <option value="all">{t("All Projects")}</option>
            {(data.projects || []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: "1 1 200px" }}>
          <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
            {t("Department")}
          </label>
          <select
            className="login-input"
            style={{ padding: "8px 12px", fontSize: "13px" }}
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
          >
            <option value="all">{t("All Departments")}</option>
            {departmentsList.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: "1 1 180px" }}>
          <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
            {t("Time Period")}
          </label>
          <select
            className="login-input"
            style={{ padding: "8px 12px", fontSize: "13px" }}
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
          >
            <option value="all">{t("All Time")}</option>
            <option value="this_month">{t("This Month")}</option>
            <option value="last_month">{t("Last Month")}</option>
          </select>
        </div>

        {(selectedEmployee !== "all" ||
          selectedProject !== "all" ||
          selectedDepartment !== "all" ||
          selectedPeriod !== "all") && (
          <div style={{ alignSelf: "flex-end" }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setSelectedEmployee("all");
                setSelectedProject("all");
                setSelectedDepartment("all");
                setSelectedPeriod("all");
              }}
            >
              {t("Reset Filters")}
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div
        className="kpi-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div className="card kpi-card" style={{ padding: "16px 20px" }}>
          <div className="kpi-title">{t("Total Capacity")}</div>
          <div className="kpi-value" style={{ fontSize: "24px", fontWeight: 700 }}>
            {summary.totalCapacity} <span style={{ fontSize: "14px", fontWeight: 500 }}>hrs</span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px" }}>
            {t("Submitted work weeks × 40h")}
          </div>
        </div>

        <div className="card kpi-card" style={{ padding: "16px 20px" }}>
          <div className="kpi-title">{t("Logged Hours")}</div>
          <div className="kpi-value" style={{ fontSize: "24px", fontWeight: 700, color: "var(--primary-color, #4f46e5)" }}>
            {summary.totalLogged} <span style={{ fontSize: "14px", fontWeight: 500 }}>hrs</span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px" }}>
            {t("Sum of approved timesheets")}
          </div>
        </div>

        <div className="card kpi-card" style={{ padding: "16px 20px" }}>
          <div className="kpi-title">{t("Planned Hours")}</div>
          <div className="kpi-value" style={{ fontSize: "24px", fontWeight: 700, color: "#0284c7" }}>
            {summary.totalPlanned} <span style={{ fontSize: "14px", fontWeight: 500 }}>hrs</span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px" }}>
            {t("Task estimated work")}
          </div>
        </div>

        <div className="card kpi-card" style={{ padding: "16px 20px" }}>
          <div className="kpi-title">{t("Actual Hours")}</div>
          <div className="kpi-value" style={{ fontSize: "24px", fontWeight: 700, color: "#0d9488" }}>
            {summary.totalActual} <span style={{ fontSize: "14px", fontWeight: 500 }}>hrs</span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px" }}>
            {t("Punched time logs")}
          </div>
        </div>

        <div className="card kpi-card" style={{ padding: "16px 20px" }}>
          <div className="kpi-title">{t("Utilisation %")}</div>
          <div
            className="kpi-value"
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: summary.overallUtilisation > 90 ? "#ef4444" : summary.overallUtilisation > 75 ? "#10b981" : "#3b82f6",
            }}
          >
            {summary.overallUtilisation}%
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px" }}>
            {t("(Logged / Capacity) × 100")}
          </div>
        </div>

        <div className="card kpi-card" style={{ padding: "16px 20px" }}>
          <div className="kpi-title">{t("Efficiency %")}</div>
          <div
            className="kpi-value"
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: summary.overallEfficiency >= 100 ? "#10b981" : summary.overallEfficiency >= 80 ? "#f59e0b" : "#ef4444",
            }}
          >
            {summary.overallEfficiency}%
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px" }}>
            {t("(Planned / Actual) × 100")}
          </div>
        </div>

        <div className="card kpi-card" style={{ padding: "16px 20px" }}>
          <div className="kpi-title">{t("Available Capacity")}</div>
          <div className="kpi-value" style={{ fontSize: "24px", fontWeight: 700, color: "#10b981" }}>
            {summary.availableCapacity} <span style={{ fontSize: "14px", fontWeight: 500 }}>hrs</span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px" }}>
            {t("Unallocated capacity")}
          </div>
        </div>

        <div className="card kpi-card" style={{ padding: "16px 20px" }}>
          <div className="kpi-title">{t("Overallocated")}</div>
          <div className="kpi-value" style={{ fontSize: "24px", fontWeight: 700, color: summary.overallocatedCount > 0 ? "#ef4444" : "var(--text-primary)" }}>
            {summary.overallocatedCount} <span style={{ fontSize: "14px", fontWeight: 500 }}>{t("employees")}</span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px" }}>
            {t("Utilisation > 100%")}
          </div>
        </div>
      </div>

      {/* Heatmap Section & Live Trends */}
      <div className="grid-2 mb-4">
        {/* Heatmap Card */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: "16px" }}>
            <span className="card-title">{t("Submitted Weeks Utilisation Heatmap")}</span>
            <div style={{ display: "flex", gap: "6px", alignItems: "center", fontSize: "11px", color: "var(--text-tertiary)" }}>
              <span style={{ width: "10px", height: "10px", background: "#e0f2fe", borderRadius: "2px" }} /> 0% (New)
              <span style={{ width: "10px", height: "10px", background: "#3b82f6", borderRadius: "2px", marginLeft: "4px" }} /> Optimal
              <span style={{ width: "10px", height: "10px", background: "#ef4444", borderRadius: "2px", marginLeft: "4px" }} /> Overallocated
            </div>
          </div>
          <div className="card-body">
            <div style={{ overflowX: "auto" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `140px repeat(${recentWeeks.length > 0 ? recentWeeks.length : 1}, 1fr)`,
                  gap: "8px",
                  minWidth: "420px",
                }}
              >
                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-tertiary)" }}>Employee</div>
                {recentWeeks.length > 0 ? (
                  recentWeeks.map((w) => (
                    <div key={w} style={{ textAlign: "center", fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)" }}>
                      {w}
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: "center", fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)" }}>
                    {t("No Weeks")}
                  </div>
                )}

                {filteredEmployeeMetrics.map((m) => (
                  <React.Fragment key={m.id}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "2px 0" }}>
                      <div
                        className="avatar"
                        style={{
                          background: m.color,
                          width: "22px",
                          height: "22px",
                          minWidth: "22px",
                          fontSize: "9px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontWeight: "bold",
                        }}
                      >
                        {m.avatar}
                      </div>
                      <span
                        style={{ fontSize: "12px", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                        title={m.name}
                      >
                        {m.name.split(" ")[0]}
                      </span>
                    </div>

                    {recentWeeks.length > 0 ? (
                      recentWeeks.map((wStr) => {
                        const empTimesheet = (data.timesheets || []).find(
                          (ts: any) =>
                            (ts.consultant === m.id || ts.consultant === m.name) &&
                            ts.week === wStr &&
                            ts.status !== "rejected" &&
                            ts.status !== "Rejected"
                        );

                        let weekLogged = 0;
                        if (empTimesheet && empTimesheet.entries) {
                          empTimesheet.entries.forEach((e: any) => {
                            if (selectedProject !== "all" && e.project !== selectedProject) return;
                            weekLogged += e.hours || 0;
                          });
                        }

                        const weekUtil = empTimesheet ? Math.min(100, Math.round((weekLogged / 40) * 100)) : 0;

                        let bg = "#3b82f6";
                        if (weekUtil === 0) bg = "#e0f2fe";
                        else if (weekUtil < 50) bg = "#93c5fd";
                        else if (weekUtil >= 85 && weekUtil <= 100) bg = "#f59e0b";
                        else if (weekUtil > 100) bg = "#ef4444";

                        return (
                          <div
                            key={wStr}
                            className="heatmap-cell"
                            style={{
                              height: "30px",
                              background: bg,
                              borderRadius: "6px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: weekUtil < 50 ? "#1e3a8a" : "white",
                              fontSize: "11px",
                              fontWeight: 600,
                            }}
                            title={`${m.name} (${wStr}): ${weekLogged}h logged (${weekUtil}%)`}
                          >
                            {weekUtil}%
                          </div>
                        );
                      })
                    ) : (
                      <div
                        style={{
                          height: "30px",
                          background: "#e0f2fe",
                          borderRadius: "6px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "11px",
                          color: "#1e3a8a",
                        }}
                      >
                        0%
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Project Hour Distribution Card */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-header">
            <span className="card-title">{t("Project Workload Allocation")}</span>
          </div>
          <div className="card-body" style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
            {(data.projects || []).length > 0 ? (
              (data.projects || []).slice(0, 5).map((p) => {
                let projectHours = 0;
                (data.timesheets || []).forEach((ts: any) => {
                  if (ts.status === "rejected" || ts.status === "Rejected") return;
                  if (ts.entries) {
                    ts.entries.forEach((e: any) => {
                      if (e.project === p.id || e.project === p.name) {
                        projectHours += e.hours || 0;
                      }
                    });
                  }
                });

                const pct = summary.totalLogged > 0 ? Math.round((projectHours / summary.totalLogged) * 100) : 0;

                return (
                  <div key={p.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{p.name}</span>
                      <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
                        {projectHours}h ({pct}%)
                      </span>
                    </div>
                    <div className="progress-bar" style={{ height: "8px", background: "var(--bg-secondary, #e2e8f0)" }}>
                      <div
                        className="progress-fill"
                        style={{
                          width: `${pct}%`,
                          background: "var(--primary-color, #4f46e5)",
                          borderRadius: "4px",
                        }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ color: "var(--text-tertiary)", fontSize: "13px", textAlign: "center", padding: "24px" }}>
                {t("No projects active")}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Employee Leaderboard Table */}
      <div className="card">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <span className="card-title">{t("Employee Resource Leaderboard")}</span>
          <div style={{ width: "240px" }}>
            <input
              type="text"
              className="login-input"
              style={{ padding: "6px 12px", fontSize: "13px" }}
              placeholder={t("Search employee or role...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>{t("Employee")}</th>
                <th>{t("Role / Dept")}</th>
                <th>{t("Planned")}</th>
                <th>{t("Actual")}</th>
                <th>{t("Logged")}</th>
                <th>{t("Capacity")}</th>
                <th>{t("Utilisation")}</th>
                <th>{t("Efficiency")}</th>
                <th>{t("Status")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredEmployeeMetrics.length > 0 ? (
                filteredEmployeeMetrics.map((m) => {
                  const utilColor =
                    m.utilisationPercent > 100
                      ? "#ef4444"
                      : m.utilisationPercent >= 75
                      ? "#10b981"
                      : m.utilisationPercent === 0
                      ? "var(--text-tertiary)"
                      : "#3b82f6";

                  const effColor =
                    m.efficiencyPercent >= 100
                      ? "#10b981"
                      : m.efficiencyPercent >= 80
                      ? "#f59e0b"
                      : m.efficiencyPercent === 0
                      ? "var(--text-tertiary)"
                      : "#ef4444";

                  return (
                    <tr key={m.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                          <div
                            className="avatar"
                            style={{
                              background: m.color,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "white",
                              fontWeight: "bold",
                            }}
                          >
                            {m.avatar}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary)" }}>
                              {m.name}
                            </div>
                            <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                              {m.skills.slice(0, 2).join(", ")}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={{ fontSize: "13px" }}>
                        <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>{m.role}</div>
                        <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{m.dept}</div>
                      </td>

                      <td style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                        {m.plannedHours}h
                      </td>

                      <td style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                        {m.actualHours}h
                      </td>

                      <td style={{ fontSize: "13px", fontWeight: 600, color: "var(--primary-color, #4f46e5)" }}>
                        {m.loggedHours}h
                      </td>

                      <td style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)" }}>
                        {m.capacityHours}h
                      </td>

                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div className="progress-bar" style={{ width: "60px", height: "6px" }}>
                            <div className="progress-fill" style={{ width: `${m.utilisationPercent}%`, background: utilColor }} />
                          </div>
                          <span style={{ fontSize: "12px", fontWeight: 700, color: utilColor }}>
                            {m.utilisationPercent}%
                          </span>
                        </div>
                      </td>

                      <td>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: effColor }}>
                          {m.efficiencyPercent}%
                        </span>
                      </td>

                      <td>
                        <span
                          className={`badge ${
                            m.status === "Over-allocated"
                              ? "badge-danger"
                              : m.status === "Optimal"
                              ? "badge-success"
                              : m.status === "Under-utilized"
                              ? "badge-warning"
                              : "badge-neutral"
                          }`}
                          style={{ fontSize: "11px" }}
                        >
                          {t(m.status)}
                        </span>
                      </td>

                      <td style={{ position: "relative" }}>
                        <div ref={activeMenuId === m.id ? menuRef : null}>
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (canAccessMenu(m)) {
                                setActiveMenuId(activeMenuId === m.id ? null : m.id);
                              }
                            }}
                            disabled={!canAccessMenu(m)}
                            style={{
                              background: activeMenuId === m.id ? "rgba(0,0,0,0.05)" : "transparent",
                              opacity: canAccessMenu(m) ? 1 : 0.3,
                              cursor: canAccessMenu(m) ? "pointer" : "not-allowed",
                            }}
                          >
                            ⋯
                          </button>

                          {canAccessMenu(m) && activeMenuId === m.id && (
                            <div
                              style={{
                                position: "absolute",
                                right: "100%",
                                top: "50%",
                                transform: "translateY(-50%)",
                                marginRight: "8px",
                                background: "var(--bg-surface, #ffffff)",
                                border: "1px solid rgba(0,0,0,0.1)",
                                borderRadius: "8px",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                                zIndex: 100,
                                padding: "4px",
                                minWidth: "200px",
                                display: "flex",
                                flexDirection: "column",
                                gap: "2px",
                              }}
                            >
                              <button
                                style={{ padding: "8px 12px", textAlign: "left", fontSize: "13px", background: "transparent", border: "none", cursor: "pointer", borderRadius: "4px" }}
                                onClick={() => { setActiveModal("details"); setSelectedEmployeeMetrics(m); setActiveMenuId(null); }}
                              >
                                {t("View Details")}
                              </button>
                              <button
                                style={{ padding: "8px 12px", textAlign: "left", fontSize: "13px", background: "transparent", border: "none", cursor: "pointer", borderRadius: "4px" }}
                                onClick={() => { setActiveModal("projects"); setSelectedEmployeeMetrics(m); setActiveMenuId(null); }}
                              >
                                {t("View Assigned Projects")}
                              </button>
                              <button
                                style={{ padding: "8px 12px", textAlign: "left", fontSize: "13px", background: "transparent", border: "none", cursor: "pointer", borderRadius: "4px" }}
                                onClick={() => { setActiveModal("utilization"); setSelectedEmployeeMetrics(m); setActiveMenuId(null); }}
                              >
                                {t("View Utilization History")}
                              </button>
                              <button
                                style={{ padding: "8px 12px", textAlign: "left", fontSize: "13px", background: "transparent", border: "none", cursor: "pointer", borderRadius: "4px" }}
                                onClick={() => { setActiveModal("allocation"); setSelectedEmployeeMetrics(m); setActiveMenuId(null); }}
                              >
                                {t("Resource Allocation Summary")}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} style={{ textAlign: "center", padding: "32px", color: "var(--text-tertiary)" }}>
                    {t("No employee resource records found matching current filters.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Options Modals --- */}
      {activeModal && selectedEmployeeMetrics && (
        <div
          className="modal-overlay"
          onClick={() => setActiveModal(null)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-surface, #ffffff)",
              borderRadius: "12px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
              width: "100%",
              maxWidth: "500px",
              maxHeight: "90vh",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className="modal-header" style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 className="modal-title" style={{ margin: 0, fontSize: "18px" }}>
                {activeModal === "details" && `${selectedEmployeeMetrics.name} - ${t("Details")}`}
                {activeModal === "projects" && `${selectedEmployeeMetrics.name} - ${t("Assigned Projects")}`}
                {activeModal === "utilization" && `${selectedEmployeeMetrics.name} - ${t("Utilization History")}`}
                {activeModal === "allocation" && `${selectedEmployeeMetrics.name} - ${t("Allocation Summary")}`}
              </h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setActiveModal(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {activeModal === "details" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div className="avatar" style={{ background: selectedEmployeeMetrics.color, width: "48px", height: "48px", fontSize: "18px", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
                      {selectedEmployeeMetrics.avatar}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text-primary)" }}>{selectedEmployeeMetrics.name}</h3>
                      <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)" }}>
                        {selectedEmployeeMetrics.role} • {selectedEmployeeMetrics.dept}
                      </p>
                    </div>
                  </div>

                  <div className="grid-2">
                    <div style={{ background: "rgba(0,0,0,0.02)", padding: "12px", borderRadius: "8px" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-tertiary)", display: "block" }}>{t("Status")}</span>
                      <strong style={{ fontSize: "14px" }}>{t(selectedEmployeeMetrics.status)}</strong>
                    </div>
                    <div style={{ background: "rgba(0,0,0,0.02)", padding: "12px", borderRadius: "8px" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-tertiary)", display: "block" }}>{t("Utilisation")}</span>
                      <strong style={{ fontSize: "14px" }}>{selectedEmployeeMetrics.utilisationPercent}%</strong>
                    </div>
                    <div style={{ background: "rgba(0,0,0,0.02)", padding: "12px", borderRadius: "8px" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-tertiary)", display: "block" }}>{t("Efficiency")}</span>
                      <strong style={{ fontSize: "14px" }}>{selectedEmployeeMetrics.efficiencyPercent}%</strong>
                    </div>
                    <div style={{ background: "rgba(0,0,0,0.02)", padding: "12px", borderRadius: "8px" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-tertiary)", display: "block" }}>{t("Total Capacity")}</span>
                      <strong style={{ fontSize: "14px" }}>{selectedEmployeeMetrics.capacityHours}h</strong>
                    </div>
                  </div>
                </div>
              )}

              {activeModal === "projects" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {selectedEmployeeMetrics.projects.length === 0 ? (
                    <p style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>{t("No active projects assigned.")}</p>
                  ) : (
                    selectedEmployeeMetrics.projects.map((projName, idx) => (
                      <div key={idx} style={{ padding: "12px", background: "rgba(0,0,0,0.02)", borderRadius: "8px", fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                        {projName}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeModal === "utilization" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                    {t("Logged vs Planned vs Capacity Breakdown")}
                  </div>
                  <div style={{ padding: "16px", background: "rgba(0,0,0,0.02)", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>{t("Planned Hours")}:</span> <strong>{selectedEmployeeMetrics.plannedHours}h</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>{t("Actual Hours")}:</span> <strong>{selectedEmployeeMetrics.actualHours}h</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>{t("Approved Logged Hours")}:</span> <strong>{selectedEmployeeMetrics.loggedHours}h</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>{t("Calculated Capacity")}:</span> <strong>{selectedEmployeeMetrics.capacityHours}h</strong>
                    </div>
                  </div>
                </div>
              )}

              {activeModal === "allocation" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div className="grid-2">
                    <div style={{ background: "rgba(0,0,0,0.02)", padding: "16px", borderRadius: "8px", textAlign: "center" }}>
                      <div style={{ fontSize: "24px", fontWeight: "bold", color: "var(--text-primary)" }}>{selectedEmployeeMetrics.loggedHours}h</div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{t("Capacity Used")}</div>
                    </div>
                    <div style={{ background: "rgba(0,0,0,0.02)", padding: "16px", borderRadius: "8px", textAlign: "center" }}>
                      <div style={{ fontSize: "24px", fontWeight: "bold", color: "#10b981" }}>
                        {Math.max(0, selectedEmployeeMetrics.capacityHours - selectedEmployeeMetrics.loggedHours)}h
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{t("Available Capacity")}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ padding: "16px 24px", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setActiveModal(null)}>
                {t("Close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
