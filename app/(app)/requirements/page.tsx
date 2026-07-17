"use client";

import React, { useState } from "react";
import { useAppStore, useTranslation } from "@/lib/store";
import ModalPortal from "@/components/ui/ModalPortal";
import { IconFolder, IconClose, IconSearch } from "@/components/ui/Icons";

export default function RequirementsPage() {
  const data = useAppStore((state) => state.data);
  const addRequirement = useAppStore((state) => state.addRequirement);
  const { t } = useTranslation();

  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"Draft" | "Review" | "Submitted" | "In Progress" | "Approved" | "Rejected">("Draft");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High" | "Critical">("Medium");

  const requirements = data.requirements || [];
  const clients = data.clients || [];

  const filtered = requirements.filter((r) =>
    (r.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.reqNumber || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !title) return;

    addRequirement({
      clientId,
      projectId: null,
      title,
      description,
      businessNeed: "",
      expectedOutcome: "",
      complexity: "Medium",
      targetDate: new Date().toISOString().split('T')[0],
      assignedTo: null,
      status,
      priority,
      requestedBy: useAppStore.getState().user?.name || "Tom Keller",
    });

    setClientId("");
    setTitle("");
    setDescription("");
    setStatus("Draft");
    setPriority("Medium");
    setShowAddModal(false);
  };

  return (
    <div className="page-container" style={{ animation: "fadeIn 0.5s ease-out", padding: "24px" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("Requirements")}</h1>
          <p className="page-subtitle">{t("Draft and manage functional requirements.")}</p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div className="search-bar" style={{ position: "relative", width: "240px" }}>
            <IconSearch style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} size={16} />
            <input
              type="text"
              className="login-input"
              placeholder={t("Search requirements...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: "36px", height: "36px", margin: 0 }}
            />
          </div>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <IconFolder /> {t("Draft Requirement")}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>{t("ID")}</th>
                <th>{t("Title")}</th>
                <th>{t("Client")}</th>
                <th>{t("Status")}</th>
                <th>{t("Priority")}</th>
                <th>{t("Requested By")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((r) => {
                  const client = clients.find(cl => cl.id === r.clientId);
                  return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{r.reqNumber || `REQ-${r.id.slice(0, 4).toUpperCase()}`}</td>
                      <td style={{ fontWeight: 500 }}>{r.title}</td>
                      <td>{client ? client.companyName : "-"}</td>
                      <td>
                        <span className={`badge ${
                          r.status === 'Approved' ? 'badge-success' : 
                          r.status === 'Rejected' ? 'badge-danger' : 
                          r.status === 'Draft' ? 'badge-neutral' :
                          'badge-warning'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td>{r.priority}</td>
                      <td>{r.requestedBy}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "var(--text-tertiary)" }}>
                    {t("No requirements found.")}
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
                <span className="card-title">{t("Draft Requirement")}</span>
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
                    <select className="login-input" value={clientId} onChange={(e) => setClientId(e.target.value)} required>
                      <option value="">{t("-- Select Client --")}</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div className="login-field">
                      <label className="login-label">{t("Status")}</label>
                      <select className="login-input" value={status} onChange={(e) => setStatus(e.target.value as any)}>
                        <option value="Draft">{t("Draft")}</option>
                        <option value="Review">{t("Review")}</option>
                        <option value="Submitted">{t("Submitted")}</option>
                        <option value="In Progress">{t("In Progress")}</option>
                        <option value="Approved">{t("Approved")}</option>
                        <option value="Rejected">{t("Rejected")}</option>
                      </select>
                    </div>
                    <div className="login-field">
                      <label className="login-label">{t("Priority")}</label>
                      <select className="login-input" value={priority} onChange={(e) => setPriority(e.target.value as any)}>
                        <option value="Low">{t("Low")}</option>
                        <option value="Medium">{t("Medium")}</option>
                        <option value="High">{t("High")}</option>
                        <option value="Critical">{t("Critical")}</option>
                      </select>
                    </div>
                  </div>
                  <div className="login-field">
                    <label className="login-label">{t("Description")}</label>
                    <textarea 
                      className="login-input" 
                      style={{ height: "80px", resize: "none" }} 
                      value={description} 
                      onChange={(e) => setDescription(e.target.value)} 
                    />
                  </div>
                  <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "16px" }}>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => setShowAddModal(false)}>
                      {t("Cancel")}
                    </button>
                    <button type="submit" className="btn btn-primary btn-sm" style={{ padding: "8px 20px" }}>
                      {t("Save Requirement")}
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
