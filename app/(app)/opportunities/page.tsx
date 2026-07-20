"use client";

import React, { useState } from "react";
import { useAppStore, useTranslation } from "@/lib/store";
import ModalPortal from "@/components/ui/ModalPortal";
import { IconChart, IconClose, IconSearch, IconBriefcase, IconCalendar } from "@/components/ui/Icons";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

export default function OpportunitiesPage() {
  const data = useAppStore((state) => state.data);
  const addOpportunity = useAppStore((state) => state.addOpportunity);
  const { t } = useTranslation();

  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [stage, setStage] = useState<"Lead" | "Qualified" | "Discussion" | "Proposal" | "Negotiation" | "Won" | "Lost">("Lead");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");

  const opportunities = data.opportunities || [];
  const clients = data.clients || [];

  const filtered = opportunities.filter((o) =>
    o.opportunityName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !title) return;

    addOpportunity({
      clientId,
      opportunityName: title,
      expectedRevenue: Number(estimatedValue) || 0,
      stage,
      expectedClosureDate: expectedCloseDate,
      probability: 50,
      competitor: "",
      notes: description,
    });

    setClientId("");
    setTitle("");
    setDescription("");
    setEstimatedValue("");
    setStage("Lead");
    setExpectedCloseDate("");
    setShowAddModal(false);
  };

  return (
    <div className="page-container" style={{ animation: "fadeIn 0.5s ease-out", padding: "24px" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("Opportunities")}</h1>
          <p className="page-subtitle">{t("Track potential deals and sales pipeline.")}</p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div className="search-bar" style={{ position: "relative", width: "240px" }}>
            <IconSearch style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} size={16} />
            <input
              type="text"
              className="login-input"
              placeholder={t("Search opportunities...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: "36px", height: "36px", margin: 0 }}
            />
          </div>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <IconChart /> {t("Add Opportunity")}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>{t("Title")}</th>
                <th>{t("Client")}</th>
                <th>{t("Stage")}</th>
                <th>{t("Estimated Value")}</th>
                <th>{t("Close Date")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((o) => {
                  const client = clients.find(cl => cl.id === o.clientId);
                  return (
                    <tr key={o.id}>
                      <td style={{ fontWeight: 600 }}>{o.opportunityName}</td>
                      <td>{client ? client.companyName : "-"}</td>
                      <td>
                        <span className={`badge ${
                          o.stage === 'Won' ? 'badge-success' : 
                          o.stage === 'Lost' ? 'badge-danger' : 
                          'badge-neutral'
                        }`}>
                          {o.stage}
                        </span>
                      </td>
                      <td>{o.expectedRevenue ? `$${o.expectedRevenue.toLocaleString()}` : "-"}</td>
                      <td>
                        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <IconCalendar size={14} style={{ color: "var(--text-tertiary)" }} /> {o.expectedClosureDate || "-"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "var(--text-tertiary)" }}>
                    {t("No opportunities found.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <ModalPortal>
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(4px)",
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowAddModal(false);
            }}
          >
            <div
              className="card"
              style={{
                width: "100%",
                maxWidth: "480px",
                margin: "24px",
                animation: "cardEntrance 0.3s ease",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="card-header" style={{ padding: "20px 24px" }}>
                <span className="card-title">{t("Add Opportunity")}</span>
                <button
                  className="topbar-btn"
                  onClick={() => setShowAddModal(false)}
                  style={{ width: "32px", height: "32px", minWidth: "32px", borderRadius: "8px" }}
                >
                  <IconClose size={14} />
                </button>
              </div>
              <div className="card-body" style={{ padding: "20px 24px" }}>
                <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div className="login-field">
                    <label className="login-label">{t("Title")}*</label>
                    <input className="login-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
                  </div>
                  <div className="login-field">
                    <label className="login-label">{t("Client")}*</label>
                    <SearchableSelect 
                      className="login-input" 
                      value={clientId} 
                      onChange={(val) => setClientId(val)} 
                      required
                      placeholder={t("-- Select Client --")}
                      options={clients.map(c => ({ label: c.companyName, value: c.id }))}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div className="login-field">
                      <label className="login-label">{t("Est. Value")}</label>
                      <input className="login-input" type="number" value={estimatedValue} onChange={(e) => setEstimatedValue(e.target.value)} />
                    </div>
                    <div className="login-field">
                      <label className="login-label">{t("Stage")}</label>
                      <select className="login-input" value={stage} onChange={(e) => setStage(e.target.value as any)}>
                        <option value="Lead">{t("Lead")}</option>
                        <option value="Qualified">{t("Qualified")}</option>
                        <option value="Discussion">{t("Discussion")}</option>
                        <option value="Proposal">{t("Proposal")}</option>
                        <option value="Negotiation">{t("Negotiation")}</option>
                        <option value="Won">{t("Won")}</option>
                        <option value="Lost">{t("Lost")}</option>
                      </select>
                    </div>
                  </div>
                  <div className="login-field">
                    <label className="login-label">{t("Expected Close Date")}</label>
                    <input className="login-input" type="date" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} />
                  </div>
                  <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "16px" }}>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => setShowAddModal(false)}>
                      {t("Cancel")}
                    </button>
                    <button type="submit" className="btn btn-primary btn-sm" style={{ padding: "8px 20px" }}>
                      {t("Save Opportunity")}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
