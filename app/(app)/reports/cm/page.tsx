"use client";

import React, { useState } from "react";
import { useAppStore, useTranslation } from "@/lib/store";
import { IconReportMoney, IconDownload, IconChart, IconClock, IconUsers } from "@/components/ui/Icons";

export default function ClientManagerReportsPage() {
  const data = useAppStore((state) => state.data);
  const { t } = useTranslation();

  const [activeReport, setActiveReport] = useState<"client_health" | "pipeline" | "activities">("client_health");
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      useAppStore.getState().showToast(t("Report exported to CSV successfully."), "success");
      setIsExporting(false);
    }, 800);
  };

  return (
    <div className="page-container" style={{ animation: "fadeIn 0.5s ease-out", padding: "24px" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("Client Manager Reports")}</h1>
          <p className="page-subtitle">{t("Analytics and reporting for client relationships and pipeline.")}</p>
        </div>
        <div>
          <button className="btn btn-secondary" onClick={handleExport} disabled={isExporting}>
            {isExporting ? t("Exporting...") : <><IconDownload size={16} /> {t("Export to CSV")}</>}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "24px", marginBottom: "24px" }}>
        <div 
          className={`card ${activeReport === 'client_health' ? 'active-card' : ''}`}
          style={{ flex: 1, padding: "24px", cursor: "pointer", border: activeReport === 'client_health' ? "2px solid var(--brand-500)" : "" }}
          onClick={() => setActiveReport("client_health")}
        >
          <IconUsers size={32} style={{ color: "var(--brand-600)", marginBottom: "12px" }} />
          <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>{t("Client Health")}</h3>
          <p style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>{t("Overview of client status and engagement.")}</p>
        </div>
        <div 
          className={`card ${activeReport === 'pipeline' ? 'active-card' : ''}`}
          style={{ flex: 1, padding: "24px", cursor: "pointer", border: activeReport === 'pipeline' ? "2px solid var(--brand-500)" : "" }}
          onClick={() => setActiveReport("pipeline")}
        >
          <IconChart size={32} style={{ color: "var(--brand-600)", marginBottom: "12px" }} />
          <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>{t("Opportunity Pipeline")}</h3>
          <p style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>{t("Sales pipeline by stage and estimated value.")}</p>
        </div>
        <div 
          className={`card ${activeReport === 'activities' ? 'active-card' : ''}`}
          style={{ flex: 1, padding: "24px", cursor: "pointer", border: activeReport === 'activities' ? "2px solid var(--brand-500)" : "" }}
          onClick={() => setActiveReport("activities")}
        >
          <IconClock size={32} style={{ color: "var(--brand-600)", marginBottom: "12px" }} />
          <h3 style={{ fontSize: "16px", marginBottom: "8px" }}>{t("Activity Tracking")}</h3>
          <p style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>{t("Log of calls, meetings, and follow ups.")}</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            {activeReport === 'client_health' && t("Client Health Report")}
            {activeReport === 'pipeline' && t("Opportunity Pipeline Report")}
            {activeReport === 'activities' && t("Activity Log Report")}
          </h2>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          
          {activeReport === 'client_health' && (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("Client Name")}</th>
                    <th>{t("Industry")}</th>
                    <th>{t("Status")}</th>
                    <th>{t("Total Contacts")}</th>
                    <th>{t("Open Opps")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.clients && data.clients.length > 0 ? data.clients.map(c => {
                    const contactsCount = data.clientContacts?.filter(con => con.clientId === c.id).length || 0;
                    const oppsCount = data.opportunities?.filter(o => o.clientId === c.id && o.stage !== 'Won' && o.stage !== 'Lost').length || 0;
                    return (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 500 }}>{c.companyName}</td>
                        <td>{c.industry || "-"}</td>
                        <td>{c.status}</td>
                        <td>{contactsCount}</td>
                        <td>{oppsCount}</td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "var(--text-tertiary)" }}>{t("No data available.")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeReport === 'pipeline' && (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("Opportunity")}</th>
                    <th>{t("Client")}</th>
                    <th>{t("Stage")}</th>
                    <th>{t("Est. Value")}</th>
                    <th>{t("Close Date")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.opportunities && data.opportunities.length > 0 ? data.opportunities.map(o => {
                    const client = data.clients?.find(c => c.id === o.clientId);
                    return (
                      <tr key={o.id}>
                        <td style={{ fontWeight: 500 }}>{o.opportunityName}</td>
                        <td>{client ? client.companyName : "-"}</td>
                        <td>{o.stage}</td>
                        <td>{o.expectedRevenue ? `$${o.expectedRevenue.toLocaleString()}` : "-"}</td>
                        <td>{o.expectedClosureDate || "-"}</td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "var(--text-tertiary)" }}>{t("No data available.")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeReport === 'activities' && (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("Type")}</th>
                    <th>{t("Date")}</th>
                    <th>{t("Client")}</th>
                    <th>{t("Subject")}</th>
                    <th>{t("Logged By")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.clientCalls?.map(c => {
                    const client = data.clients?.find(cl => cl.id === c.clientId);
                    return (
                      <tr key={`call-${c.id}`}>
                        <td><span className="badge badge-neutral">{t("Call")}</span></td>
                        <td>{c.date}</td>
                        <td>{client ? client.companyName : "-"}</td>
                        <td>{t("Call Notes")}</td>
                        <td>{c.callType}</td>
                      </tr>
                    );
                  })}
                  {data.clientMeetings?.map(m => {
                    const client = data.clients?.find(cl => cl.id === m.clientId);
                    return (
                      <tr key={`mtg-${m.id}`}>
                        <td><span className="badge badge-warning">{t("Meeting")}</span></td>
                        <td>{m.date}</td>
                        <td>{client ? client.companyName : "-"}</td>
                        <td>{m.meetingType}</td>
                        <td>{m.participants?.join(", ") || "-"}</td>
                      </tr>
                    );
                  })}
                  {(!data.clientCalls?.length && !data.clientMeetings?.length) && (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "var(--text-tertiary)" }}>{t("No activity data available.")}</td></tr>
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
