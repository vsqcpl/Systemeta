"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore, useTranslation } from "@/lib/store";
import {
  IconUsers,
  IconBriefcase,
  IconTarget,
  IconClock,
  IconFolder,
} from "@/components/ui/Icons";

export default function ClientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;
  
  const { t } = useTranslation();
  const data = useAppStore((state) => state.data);
  const deactivateClient = useAppStore((state) => state.deactivateClient);

  const client = data.clients?.find(c => c.id === clientId);

  const [activeTab, setActiveTab] = useState<"contacts" | "opportunities" | "requirements" | "communication" | "projects">("contacts");

  if (!client) {
    return (
      <div className="page-container" style={{ padding: "48px", textAlign: "center" }}>
        <h2>{t("Client not found")}</h2>
        <button className="btn btn-primary" onClick={() => router.push("/clients")}>{t("Back to Clients")}</button>
      </div>
    );
  }

  const contacts = data.clientContacts?.filter(c => c.clientId === clientId) || [];
  const opportunities = data.opportunities?.filter(o => o.clientId === clientId) || [];
  const requirements = data.requirements?.filter(r => r.clientId === clientId) || [];
  const calls = data.clientCalls?.filter(c => c.clientId === clientId) || [];
  const meetings = data.clientMeetings?.filter(m => m.clientId === clientId) || [];
  // Match projects by client field (may hold clientId or company name)
  const clientProjects = data.projects?.filter(
    p => p.client === clientId || p.client === client.companyName
  ) || [];

  return (
    <div className="page-container" style={{ animation: "fadeIn 0.5s ease-out", padding: "24px" }}>
      {/* Header */}
      <div className="page-header" style={{ alignItems: "flex-start" }}>
        <div>
          <button className="btn btn-secondary btn-sm" style={{ marginBottom: "16px" }} onClick={() => router.push("/clients")}>
            ← {t("Back to Clients")}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: 48, height: 48, borderRadius: 8, background: "var(--brand-100)", color: "var(--brand-700)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700 }}>
              {client.companyName.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="page-title" style={{ margin: 0 }}>{client.companyName}</h1>
              <p className="page-subtitle" style={{ margin: 0 }}>
                {client.industry || t("No Industry")} · {t("Manager")}: {client.accountOwner || t("Unassigned")}
              </p>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <span className={`badge ${client.status === 'Active' ? 'badge-success' : 'badge-neutral'}`} style={{ height: "fit-content", padding: "6px 12px" }}>
            {client.status}
          </span>
          {client.status === 'Active' && (
            <button className="btn btn-outline" onClick={() => {
              if (confirm("Deactivate this client?")) deactivateClient(client.id);
            }}>
              {t("Deactivate")}
            </button>
          )}
        </div>
      </div>

      {/* KPI Row */}
      <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", marginBottom: "32px" }}>
        <div className="card kpi-card" style={{ padding: "20px" }}>
          <div className="kpi-title">{t("Total Contacts")}</div>
          <div className="kpi-value">{contacts.length}</div>
        </div>
        <div className="card kpi-card" style={{ padding: "20px" }}>
          <div className="kpi-title">{t("Open Opportunities")}</div>
          <div className="kpi-value">{opportunities.filter(o => o.stage !== 'Won' && o.stage !== 'Lost').length}</div>
        </div>
        <div className="card kpi-card" style={{ padding: "20px" }}>
          <div className="kpi-title">{t("Requirements")}</div>
          <div className="kpi-value">{requirements.length}</div>
        </div>
        <div className="card kpi-card" style={{ padding: "20px" }}>
          <div className="kpi-title">{t("Communications")}</div>
          <div className="kpi-value">{calls.length + meetings.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "24px", borderBottom: "1px solid var(--border-subtle)", marginBottom: "24px" }}>
        {(["contacts", "opportunities", "requirements", "communication", "projects"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "12px 0",
              border: "none",
              background: "transparent",
              color: activeTab === tab ? "var(--brand-600)" : "var(--text-secondary)",
              fontWeight: activeTab === tab ? 600 : 500,
              borderBottom: activeTab === tab ? "2px solid var(--brand-600)" : "2px solid transparent",
              cursor: "pointer",
              textTransform: "capitalize"
            }}
          >
            {t(tab)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          
          {activeTab === "contacts" && (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("Name")}</th>
                    <th>{t("Title")}</th>
                    <th>{t("Email")}</th>
                    <th>{t("Phone")}</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.length > 0 ? contacts.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 500 }}>{c.name}</td>
                      <td>{c.designation || "-"}</td>
                      <td>{c.email || "-"}</td>
                      <td>{c.phone || "-"}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} style={{ textAlign: "center", padding: "32px", color: "var(--text-tertiary)" }}>{t("No contacts found.")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "opportunities" && (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("Title")}</th>
                    <th>{t("Stage")}</th>
                    <th>{t("Est. Value")}</th>
                    <th>{t("Close Date")}</th>
                  </tr>
                </thead>
                <tbody>
                  {opportunities.length > 0 ? opportunities.map(o => (
                    <tr key={o.id}>
                      <td style={{ fontWeight: 500 }}>{o.opportunityName}</td>
                      <td><span className="badge badge-neutral">{o.stage}</span></td>
                      <td>{o.expectedRevenue ? `$${o.expectedRevenue.toLocaleString()}` : "-"}</td>
                      <td>{o.expectedClosureDate || "-"}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} style={{ textAlign: "center", padding: "32px", color: "var(--text-tertiary)" }}>{t("No opportunities found.")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "requirements" && (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("ID")}</th>
                    <th>{t("Title")}</th>
                    <th>{t("Status")}</th>
                    <th>{t("Priority")}</th>
                  </tr>
                </thead>
                <tbody>
                  {requirements.length > 0 ? requirements.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 500 }}>{r.reqNumber}</td>
                      <td>{r.title}</td>
                      <td><span className="badge badge-neutral">{r.status}</span></td>
                      <td>{r.priority}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} style={{ textAlign: "center", padding: "32px", color: "var(--text-tertiary)" }}>{t("No requirements found.")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "communication" && (
            <div style={{ padding: "24px" }}>
              <h3 style={{ fontSize: "16px", marginBottom: "16px" }}>{t("Recent Activity")}</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {calls.map(c => (
                  <div key={c.id} style={{ display: "flex", gap: "16px", paddingBottom: "16px", borderBottom: "1px solid var(--border-subtle)" }}>
                    <div style={{ color: "var(--text-secondary)" }}><IconTarget size={20} /></div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{t("Call logged by")} {c.callType}</div>
                      <div style={{ fontSize: "13px", color: "var(--text-tertiary)" }}>{c.date}</div>
                      <p style={{ marginTop: "8px", fontSize: "14px", color: "var(--text-secondary)" }}>{c.discussionSummary || t("No notes.")}</p>
                    </div>
                  </div>
                ))}
                {meetings.map(m => (
                  <div key={m.id} style={{ display: "flex", gap: "16px", paddingBottom: "16px", borderBottom: "1px solid var(--border-subtle)" }}>
                    <div style={{ color: "var(--text-secondary)" }}><IconClock size={20} /></div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{t("Meeting")}: {m.meetingType}</div>
                      <div style={{ fontSize: "13px", color: "var(--text-tertiary)" }}>{m.date} - {t("Participants")}: {m.participants?.join(", ") || "-"}</div>
                      <p style={{ marginTop: "8px", fontSize: "14px", color: "var(--text-secondary)" }}>{m.outcome || t("No outcome recorded.")}</p>
                    </div>
                  </div>
                ))}
                {calls.length === 0 && meetings.length === 0 && (
                  <div style={{ color: "var(--text-tertiary)" }}>{t("No communication history.")}</div>
                )}
              </div>
            </div>
          )}

          {activeTab === "projects" && (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("ID")}</th>
                    <th>{t("Name")}</th>
                    <th>{t("Status")}</th>
                    <th>{t("Health")}</th>
                    <th>{t("Progress")}</th>
                    <th>{t("Due Date")}</th>
                  </tr>
                </thead>
                <tbody>
                  {clientProjects.length > 0 ? clientProjects.map(pr => (
                    <tr key={pr.id} style={{ cursor: "pointer" }} onClick={() => router.push(`/projects/${pr.id}`)}>
                      <td><span className="badge badge-brand">{pr.id}</span></td>
                      <td style={{ fontWeight: 500 }}>{pr.name}</td>
                      <td><span className="badge badge-neutral">{pr.status}</span></td>
                      <td>
                        <span className={`badge ${
                          pr.health === 'on-track' ? 'badge-success' :
                          pr.health === 'at-risk' ? 'badge-warning' : 'badge-danger'
                        }`}>{pr.health}</span>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div className="progress-bar" style={{ height: "6px", width: "80px" }}>
                            <div style={{ height: "100%", width: `${pr.progress}%`, background: "var(--brand-600)", borderRadius: "9999px" }} />
                          </div>
                          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{pr.progress}%</span>
                        </div>
                      </td>
                      <td>{pr.dueDate || "-"}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "var(--text-tertiary)" }}>{t("No projects found for this client.")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
