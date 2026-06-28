"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAppStore, useTranslation } from "@/lib/store";
import {
  IconUsers,
  IconBriefcase,
  IconAlert,
  IconTarget,
  IconClock,
  IconCheck,
} from "@/components/ui/Icons";

export default function ClientManagerDashboard() {
  const router = useRouter();
  const data = useAppStore((state) => state.data);
  const { t } = useTranslation();

  // Calculate Metrics from Store Data
  const totalClients = data.clients?.length || 0;
  const activeClients = data.clients?.filter(c => c.status === 'Active').length || 0;
  const openRequirements = data.requirements?.filter(r => r.status === 'Submitted' || r.status === 'Review' || r.status === 'In Progress').length || 0;
  
  const pendingFollowUps = data.followUps?.filter(f => f.status === 'Pending').length || 0;
  const overdueFollowUps = data.followUps?.filter(f => f.status === 'Overdue').length || 0;
  
  const callsThisWeek = data.clientCalls?.length || 0; // Simplified for mockup
  const activeProjects = data.projects?.filter(p => p.status === 'active').length || 0;
  
  return (
    <div className="page-container" style={{ animation: "fadeIn 0.5s ease-out", padding: "24px" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("Client Manager Dashboard")}</h1>
          <p className="page-subtitle">{t("Overview of client relationships, requirements, and communication.")}</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn btn-primary" onClick={() => router.push("/clients")}>
            <IconUsers /> {t("View Clients")}
          </button>
        </div>
      </div>

      {/* High Level KPI Cards */}
      <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "24px", marginBottom: "32px" }}>
        
        {/* Clients KPI */}
        <div className="card kpi-card">
          <div className="kpi-header">
            <h3 className="kpi-title">{t("Total Clients")}</h3>
            <div className="kpi-icon" style={{ background: "rgba(30, 73, 118, 0.1)", color: "var(--brand-600)" }}>
              <IconUsers />
            </div>
          </div>
          <div className="kpi-value">{totalClients}</div>
          <div className="kpi-trend positive">
            <span>{activeClients} {t("Active")}</span>
          </div>
        </div>

        {/* Requirements KPI */}
        <div className="card kpi-card">
          <div className="kpi-header">
            <h3 className="kpi-title">{t("Open Requirements")}</h3>
            <div className="kpi-icon" style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981" }}>
              <IconBriefcase />
            </div>
          </div>
          <div className="kpi-value">{openRequirements}</div>
          <div className="kpi-trend neutral">
            <span>{t("Awaiting Processing")}</span>
          </div>
        </div>

        {/* Follow Ups KPI */}
        <div className="card kpi-card">
          <div className="kpi-header">
            <h3 className="kpi-title">{t("Pending Follow Ups")}</h3>
            <div className="kpi-icon" style={{ background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b" }}>
              <IconClock />
            </div>
          </div>
          <div className="kpi-value">{pendingFollowUps}</div>
          <div className={`kpi-trend ${overdueFollowUps > 0 ? 'negative' : 'neutral'}`}>
            <span>{overdueFollowUps} {t("Overdue")}</span>
          </div>
        </div>

        {/* Calls & Meetings KPI */}
        <div className="card kpi-card">
          <div className="kpi-header">
            <h3 className="kpi-title">{t("Calls This Week")}</h3>
            <div className="kpi-icon" style={{ background: "rgba(139, 92, 246, 0.1)", color: "#8b5cf6" }}>
              <IconTarget />
            </div>
          </div>
          <div className="kpi-value">{callsThisWeek}</div>
          <div className="kpi-trend positive">
            <span>{t("Active Communication")}</span>
          </div>
        </div>

      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px" }}>
        {/* Requirements Pipeline */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">{t("Recent Functional Requirements")}</h2>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {data.requirements && data.requirements.length > 0 ? (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("REQ ID")}</th>
                      <th>{t("Title")}</th>
                      <th>{t("Status")}</th>
                      <th>{t("Priority")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.requirements.slice(0, 5).map(req => (
                      <tr key={req.id}>
                        <td style={{ fontWeight: 500 }}>{req.reqNumber}</td>
                        <td>{req.title}</td>
                        <td>
                          <span className={`badge ${
                            req.status === 'Approved' ? 'badge-success' : 
                            req.status === 'Rejected' ? 'badge-danger' : 
                            'badge-warning'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td>{req.priority}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: "32px", textAlign: "center", color: "var(--text-tertiary)" }}>
                <IconAlert style={{ width: 48, height: 48, margin: "0 auto 16px", opacity: 0.2 }} />
                <p>{t("No requirements found.")}</p>
                <button className="btn btn-outline btn-sm" style={{ marginTop: "12px" }} onClick={() => router.push("/requirements")}>
                  {t("Create Requirement")}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Quick Action & Notifications */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">{t("Client Manager Actions")}</h2>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <button className="btn btn-outline" style={{ justifyContent: "flex-start" }} onClick={() => router.push("/calls")}>
                <IconTarget style={{ marginRight: 8 }} /> {t("Log a Call")}
              </button>
              <button className="btn btn-outline" style={{ justifyContent: "flex-start" }} onClick={() => router.push("/meetings")}>
                <IconClock style={{ marginRight: 8 }} /> {t("Schedule Meeting")}
              </button>
              <button className="btn btn-outline" style={{ justifyContent: "flex-start" }} onClick={() => router.push("/requirements")}>
                <IconBriefcase style={{ marginRight: 8 }} /> {t("Draft Requirement")}
              </button>
            </div>
          </div>
          
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">{t("Project Visibility")}</h2>
            </div>
            <div className="card-body">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ color: "var(--text-secondary)" }}>{t("Active Projects")}</span>
                <span style={{ fontWeight: 600 }}>{activeProjects}</span>
              </div>
              <p style={{ fontSize: "13px", color: "var(--text-tertiary)" }}>
                {t("Client Managers have read-only visibility into projects to monitor progress.")}
              </p>
              <button className="btn btn-secondary btn-sm" style={{ width: "100%", marginTop: 12 }} onClick={() => router.push("/projects")}>
                {t("View Portfolio")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
