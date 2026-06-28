"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAppStore, useTranslation } from "@/lib/store";
import { TeamRadarChart } from "@/components/charts/ChartComponents";
import { formatCurrency } from "@/lib/utils";
import { Consultant } from "@/lib/data/types";

export default function ResourcesPage() {
  const data = useAppStore((state) => state.data);
  const { t } = useTranslation();
  const showToast = useAppStore((state) => state.showToast);
  const currencyFormat = useAppStore((state) => state.currencyFormat);

  const [selectedMonth, setSelectedMonth] = useState("Jun 2026");

  // Options Menu States
  const user = useAppStore((state) => state.user);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<'details' | 'projects' | 'utilization' | 'allocation' | null>(null);
  const [selectedConsultant, setSelectedConsultant] = useState<Consultant | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuId(null);
      }
    };
    if (activeMenuId) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("click", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [activeMenuId]);

  const canAccessMenu = (consultant: Consultant) => {
    if (!user) return false;
    if (user.role === "super_admin" || user.role === "Super Admin") return true;
    
    if (user.role === "project_manager" || user.role === "Project Manager" || user.role === "senior_consultant" || user.role === "Senior Consultant") {
      const userProjects = data.projects.filter(p => p.manager === user.id || p.team.includes(user.id) || p.manager === user.name);
      return userProjects.some(p => p.team.includes(consultant.id) || p.manager === consultant.id || p.manager === consultant.name);
    }
    
    return false; // consultant, accounts, client_contact
  };

  const canViewAdvancedOptions = () => {
    return user?.role === "super_admin" || user?.role === "Super Admin" || user?.role === "project_manager" || user?.role === "Project Manager";
  };

  const weeks = ["W1 Jun", "W2 Jun", "W3 Jun", "W4 Jun", "W1 Jul"];

  const exportBtnStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: "6px",
    padding: "7px 14px", fontSize: "13px", fontWeight: 500,
    color: "#1e3a5f", background: "transparent",
    border: "1px solid rgba(0,0,0,0.15)", borderRadius: "7px",
    cursor: "pointer", transition: "background 150ms ease, border-color 150ms ease",
  };

  const handleExportCSV = () => {
    if (data.consultants.length === 0) {
      showToast("No data to export", "warning");
      return;
    }
    const dateStr = new Date().toISOString().split("T")[0];
    const headers = ["Name", "Role", "Utilization %", "Allocated Hours", "Available Hours", "Projects Assigned"];
    const rows = data.consultants.map((c) => {
      const assignedProjects = data.projects.filter((p) => p.team.includes(c.id));
      const allocatedHours = Math.round(c.utilization * 40 / 100);
      const availableHours = 40 - allocatedHours;
      return [
        `"${c.name}"`,
        `"${c.role}"`,
        c.utilization,
        allocatedHours,
        availableHours,
        `"${assignedProjects.map((p) => p.id).join("; ")}"`,
      ];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `VSQC_Resources_${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Export downloaded successfully", "success");
  };

  const handleExportSchedule = () => {
    if (data.consultants.length === 0) {
      showToast("No data to export", "warning");
      return;
    }
    const dateStr = new Date().toISOString().split("T")[0];
    const headers = [
      t("Consultant Name"),
      t("Role"),
      t("Department"),
      t("Current Projects"),
      t("Utilization Percentage"),
      t("Availability Percentage"),
      t("Bill Rate"),
      t("Status")
    ];
    const rows = data.consultants.map((c) => {
      const assignedProjects = data.projects.filter((p) => p.team.includes(c.id));
      const statusStr = c.utilization > 90 
        ? t("Over-allocated") 
        : c.utilization > 80 
          ? t("Near limit") 
          : t("Available");
      const billRateStr = `${formatCurrency(c.billRate)}/${t("hr")}`;
      const availStr = `${c.availability}% ${t("free")}`;
      
      return [
        `"${c.name}"`,
        `"${c.role}"`,
        `"${c.dept}"`,
        `"${assignedProjects.map((p) => p.id).join("; ")}"`,
        `"${c.utilization}%"`,
        `"${availStr}"`,
        `"${billRateStr}"`,
        `"${statusStr}"`
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `VSQC_Consultant_Availability_${dateStr}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Schedule exported successfully", "success");
  };

  // Deterministic utilization formula to replace Math.random() (resolves Bug #1)
  const getDeterministicUtil = (cId: string, wIdx: number) => {
    const codeSum = (cId.charCodeAt(0) || 0) + (cId.charCodeAt(1) || 0) * 5;
    const variation = ((codeSum + wIdx * 11) % 31) - 15; // -15% to +15%
    const consultant = data.consultants.find((x) => x.id === cId);
    const base = consultant ? consultant.utilization : 75;
    return Math.min(100, Math.max(20, base + variation));
  };

  return (
    <div style={{ animation: "fadeIn 0.5s ease-out" }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("Resource Planning")}</h1>
          <p className="page-subtitle">
            {data.consultants.length} {t("consultants")} · {t("Week of Jun 9–13, 2026")}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            id="resources-export-csv"
            style={exportBtnStyle}
            onClick={handleExportCSV}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.04)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,0,0,0.25)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,0,0,0.15)"; }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {t("Export CSV")}
          </button>
        </div>
      </div>

      {/* Heatmap & Radar Section */}
      <div className="grid-2 mb-4">
        {/* Heatmap Card */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: "16px" }}>
            <span className="card-title">{t("Utilization Heatmap")}</span>
            <div
              style={{
                display: "flex",
                gap: "4px",
                alignItems: "center",
                fontSize: "11px",
                color: "var(--text-tertiary)",
              }}
            >
              <span style={{ width: "12px", height: "12px", background: "#dbeafe", borderRadius: "2px", display: "inline-block" }} />
              {t("Low")}
              <span style={{ width: "12px", height: "12px", background: "#2563eb", borderRadius: "2px", display: "inline-block", marginLeft: "4px" }} />
              {t("High")}
            </div>
          </div>
          <div className="card-body">
            <div style={{ overflowX: "auto" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px repeat(5, 1fr)",
                  gap: "4px",
                  minWidth: "400px",
                }}
              >
                <div />
                {weeks.map((w) => (
                  <div
                    key={w}
                    style={{
                      textAlign: "center",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--text-tertiary)",
                      padding: "4px",
                    }}
                  >
                    {w}
                  </div>
                ))}

                {data.consultants.map((c) => (
                  <React.Fragment key={c.id}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "2px 0" }}>
                      <div
                        className="avatar"
                        style={{
                          background: c.color,
                          width: "22px",
                          height: "22px",
                          minWidth: "22px",
                          fontSize: "8px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "white",
                          fontWeight: "bold",
                        }}
                      >
                        {c.avatar}
                      </div>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--text-secondary)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={c.name}
                      >
                        {c.name.split(" ")[0]}
                      </span>
                    </div>

                    {weeks.map((_, wIdx) => {
                      const v = getDeterministicUtil(c.id, wIdx);
                      const opacity = v / 100;
                      const bg = v > 90 ? "#ef4444" : v > 80 ? "#f59e0b" : "#2563eb";
                      return (
                        <div
                          key={wIdx}
                          className="heatmap-cell"
                          style={{
                            height: "28px",
                            background: bg,
                            opacity: Math.max(0.15, opacity),
                            borderRadius: "4px",
                            transition: "all 0.2s",
                          }}
                          title={`${c.name}: ${v}% utilization`}
                        />
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Radar Card */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: 0 }}>
            <span className="card-title">{t("Team Utilization Radar")}</span>
          </div>
          <div className="card-body">
            <div className="chart-container" style={{ height: "260px" }}>
              <TeamRadarChart />
            </div>
          </div>
        </div>
      </div>

      {/* Consultant Availability Table */}
      <div className="card">
        <div className="card-header" style={{ marginBottom: 0 }}>
          <span className="card-title">{t("Consultant Availability")}</span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleExportSchedule}
          >
            {t("Export Schedule")}
          </button>
        </div>
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>{t("Consultant")}</th>
                <th>{t("Role")}</th>
                <th>{t("Department")}</th>
                <th>{t("Current Projects")}</th>
                <th>{t("Utilization")}</th>
                <th>{t("Availability")}</th>
                <th>{t("Bill Rate")}</th>
                <th>{t("Status")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.consultants.map((c) => {
                const barColor = c.utilization > 90 ? "#ef4444" : c.utilization > 80 ? "#f59e0b" : "#10b981";
                const assignedProjects = data.projects.filter((p) => p.team.includes(c.id));
                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                        <div
                          className="avatar"
                          style={{
                            background: c.color,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontWeight: "bold",
                          }}
                        >
                          {c.avatar}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary)" }}>
                            {c.name}
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                            {c.skills.slice(0, 2).join(", ")}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: "13px", color: "var(--text-primary)" }}>{c.role}</td>
                    <td style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{c.dept}</td>
                    <td>
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {assignedProjects.slice(0, 2).map((p) => (
                          <span key={p.id} className="badge badge-gray" style={{ fontSize: "10px" }}>
                            {p.id}
                          </span>
                        ))}
                        {assignedProjects.length > 2 && (
                          <span className="badge badge-gray" style={{ fontSize: "10px" }}>
                            +{assignedProjects.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div className="progress-bar" style={{ width: "70px", height: "6px" }}>
                          <div
                            className="progress-fill"
                            style={{ width: `${c.utilization}%`, background: barColor }}
                          />
                        </div>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: barColor }}>
                          {c.utilization}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-success" style={{ fontSize: "11px" }}>
                        {c.availability}% {t("free")}
                      </span>
                    </td>
                    <td style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                      {formatCurrency(c.billRate)}/{t("hr")}
                    </td>
                    <td>
                      <span className="status-indicator" style={{ color: barColor, fontSize: "12px" }}>
                        <span className="status-dot-pulse" style={{ background: barColor }} />
                        {c.utilization > 90 ? t("Over-allocated") : c.utilization > 80 ? t("Near limit") : t("Available")}
                      </span>
                    </td>
                    <td style={{ position: "relative" }}>
                      <div ref={activeMenuId === c.id ? menuRef : null}>
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (canAccessMenu(c)) {
                              setActiveMenuId(activeMenuId === c.id ? null : c.id);
                            }
                          }}
                          disabled={!canAccessMenu(c)}
                          style={{ 
                            background: activeMenuId === c.id ? "rgba(0,0,0,0.05)" : "transparent",
                            opacity: canAccessMenu(c) ? 1 : 0.3,
                            cursor: canAccessMenu(c) ? "pointer" : "not-allowed"
                          }}
                        >
                          ⋯
                        </button>

                        {canAccessMenu(c) && activeMenuId === c.id && (
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
                              minWidth: "220px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "2px"
                            }}
                          >
                            <button
                              style={{ padding: "8px 12px", textAlign: "left", fontSize: "13px", background: "transparent", border: "none", cursor: "pointer", borderRadius: "4px", color: "var(--text-primary)" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                              onClick={() => { setActiveModal('details'); setSelectedConsultant(c); setActiveMenuId(null); }}
                            >
                              View Details
                            </button>
                            <button
                              style={{ padding: "8px 12px", textAlign: "left", fontSize: "13px", background: "transparent", border: "none", cursor: "pointer", borderRadius: "4px", color: "var(--text-primary)" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                              onClick={() => { setActiveModal('projects'); setSelectedConsultant(c); setActiveMenuId(null); }}
                            >
                              View Assigned Projects
                            </button>
                            
                            {canViewAdvancedOptions() && (
                              <>
                                <button
                                  style={{ padding: "8px 12px", textAlign: "left", fontSize: "13px", background: "transparent", border: "none", cursor: "pointer", borderRadius: "4px", color: "var(--text-primary)" }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                                  onClick={() => { setActiveModal('utilization'); setSelectedConsultant(c); setActiveMenuId(null); }}
                                >
                                  View Utilization History
                                </button>
                                <button
                                  style={{ padding: "8px 12px", textAlign: "left", fontSize: "13px", background: "transparent", border: "none", cursor: "pointer", borderRadius: "4px", color: "var(--text-primary)" }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                                  onClick={() => { setActiveModal('allocation'); setSelectedConsultant(c); setActiveMenuId(null); }}
                                >
                                  Resource Allocation Summary
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Consultant Options Modals --- */}
      {activeModal && selectedConsultant && (
        <div 
          className="modal-overlay" 
          onClick={() => setActiveModal(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
        >
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-surface, #ffffff)",
              borderRadius: "12px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              width: "100%",
              maxWidth: "500px",
              maxHeight: "90vh",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              border: "1px solid var(--border-subtle, rgba(0,0,0,0.1))"
            }}
          >
            <div className="modal-header" style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 className="modal-title">
                {activeModal === 'details' && `${selectedConsultant.name} - Details`}
                {activeModal === 'projects' && `${selectedConsultant.name} - Assigned Projects`}
                {activeModal === 'utilization' && `${selectedConsultant.name} - Utilization History`}
                {activeModal === 'allocation' && `${selectedConsultant.name} - Allocation Summary`}
              </h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setActiveModal(null)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            
            <div className="modal-body" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {activeModal === 'details' && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                    <div className="avatar" style={{ background: selectedConsultant.color, width: "48px", height: "48px", fontSize: "18px", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
                      {selectedConsultant.avatar}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "16px", color: "var(--text-primary)" }}>{selectedConsultant.name}</h3>
                      <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)" }}>{selectedConsultant.role} • {selectedConsultant.dept}</p>
                    </div>
                  </div>
                  
                  <div className="grid-2">
                    <div style={{ background: "rgba(0,0,0,0.02)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.05)" }}>
                      <span style={{ display: "block", fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "4px" }}>Status</span>
                      <strong style={{ fontSize: "13px", color: selectedConsultant.utilization > 90 ? "#ef4444" : selectedConsultant.utilization > 80 ? "#f59e0b" : "#10b981" }}>
                        {selectedConsultant.utilization > 90 ? t("Over-allocated") : selectedConsultant.utilization > 80 ? t("Near limit") : t("Available")}
                      </strong>
                    </div>
                    <div style={{ background: "rgba(0,0,0,0.02)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.05)" }}>
                      <span style={{ display: "block", fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "4px" }}>Bill Rate</span>
                      <strong style={{ fontSize: "13px", color: "var(--text-primary)" }}>{formatCurrency(selectedConsultant.billRate)}/hr</strong>
                    </div>
                    <div style={{ background: "rgba(0,0,0,0.02)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.05)" }}>
                      <span style={{ display: "block", fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "4px" }}>Utilization</span>
                      <strong style={{ fontSize: "13px", color: "var(--text-primary)" }}>{selectedConsultant.utilization}%</strong>
                    </div>
                    <div style={{ background: "rgba(0,0,0,0.02)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.05)" }}>
                      <span style={{ display: "block", fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "4px" }}>Availability</span>
                      <strong style={{ fontSize: "13px", color: "var(--text-primary)" }}>{selectedConsultant.availability}%</strong>
                    </div>
                  </div>
                  <div>
                    <h4 style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "8px" }}>Key Skills</h4>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      {selectedConsultant.skills.map((s, idx) => (
                        <span key={idx} className="badge badge-gray">{s}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeModal === 'projects' && (() => {
                const projects = data.projects.filter((p) => p.team.includes(selectedConsultant.id));
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {projects.length === 0 ? (
                      <p style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>No active projects assigned.</p>
                    ) : (
                      projects.map(p => (
                        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "rgba(0,0,0,0.02)", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.05)" }}>
                          <div>
                            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>{p.name} <span style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: "normal", marginLeft: "6px" }}>{p.id}</span></div>
                            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>Client: {p.client}</div>
                          </div>
                          <div className={`badge ${p.health === 'on-track' ? 'badge-success' : p.health === 'at-risk' ? 'badge-warning' : 'badge-danger'}`}>
                            {p.health.replace('-', ' ')}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                );
              })()}

              {activeModal === 'utilization' && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}>
                    Historical utilization over the trailing 4 weeks.
                  </p>
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", height: "160px", padding: "16px", background: "rgba(0,0,0,0.02)", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.05)" }}>
                    {weeks.map((w, idx) => {
                      const util = getDeterministicUtil(selectedConsultant.id, idx);
                      const barColor = util > 90 ? "#ef4444" : util > 80 ? "#f59e0b" : "#2563eb";
                      return (
                        <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                          <div style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 600 }}>{util}%</div>
                          <div style={{ width: "100%", flex: 1, background: "rgba(0,0,0,0.05)", borderRadius: "4px", position: "relative", display: "flex", alignItems: "flex-end" }}>
                            <div style={{ width: "100%", height: `${util}%`, background: barColor, borderRadius: "4px", transition: "height 0.3s ease" }} />
                          </div>
                          <div style={{ fontSize: "10px", color: "var(--text-tertiary)", textAlign: "center", whiteSpace: "nowrap" }}>{w}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeModal === 'allocation' && (() => {
                const projects = data.projects.filter((p) => p.team.includes(selectedConsultant.id));
                const allocatedHours = Math.round((selectedConsultant.utilization / 100) * 40);
                const availableHours = 40 - allocatedHours;
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", background: "rgba(46, 134, 193, 0.05)", borderRadius: "8px", border: "1px solid rgba(46, 134, 193, 0.15)" }}>
                      <div>
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>Weekly Allocation</div>
                        <div style={{ fontSize: "24px", color: "#2E86C1", fontWeight: "bold" }}>{selectedConsultant.utilization}%</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase" }}>Active Projects</div>
                        <div style={{ fontSize: "24px", color: "var(--text-primary)", fontWeight: "bold" }}>{projects.length}</div>
                      </div>
                    </div>
                    
                    <div className="grid-2">
                      <div style={{ background: "rgba(0,0,0,0.02)", padding: "16px", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.05)", textAlign: "center" }}>
                        <div style={{ fontSize: "28px", fontWeight: "bold", color: "var(--text-primary)", marginBottom: "4px" }}>{allocatedHours}h</div>
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Capacity Used</div>
                      </div>
                      <div style={{ background: "rgba(0,0,0,0.02)", padding: "16px", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.05)", textAlign: "center" }}>
                        <div style={{ fontSize: "28px", fontWeight: "bold", color: "#10b981", marginBottom: "4px" }}>{availableHours}h</div>
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Available Capacity</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            
            <div className="modal-footer" style={{ padding: "20px 24px", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end", background: "var(--bg-surface-2, #f8fafc)" }}>
              <button className="btn btn-secondary" onClick={() => setActiveModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
