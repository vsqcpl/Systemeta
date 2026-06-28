"use client";

import React, { useState } from "react";
import { useAppStore, useTranslation } from "@/lib/store";
import ModalPortal from "@/components/ui/ModalPortal";
import { IconCheck, IconClose, IconSearch, IconClock } from "@/components/ui/Icons";

export default function FollowUpsPage() {
  const data = useAppStore((state) => state.data);
  const addFollowUp = useAppStore((state) => state.addFollowUp);
  const { t } = useTranslation();

  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form
  const [clientId, setClientId] = useState("");
  const [contactId, setContactId] = useState("");
  const [actionItem, setActionItem] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<"Pending" | "Completed" | "Overdue">("Pending");

  const followUps = data.followUps || [];
  const clients = data.clients || [];

  const filtered = followUps.filter((f) =>
    f.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !actionItem || !dueDate) return;

    addFollowUp({
      clientId,
      contactId,
      title: actionItem,
      description: "",
      priority: "Medium",
      dueDate,
      assignedTo: useAppStore.getState().user?.name || "Tom Keller",
      status: "Pending",
    });

    setClientId("");
    setContactId("");
    setActionItem("");
    setDueDate("");
    setStatus("Pending");
    setShowAddModal(false);
  };

  return (
    <div className="page-container" style={{ animation: "fadeIn 0.5s ease-out", padding: "24px" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("Follow Ups")}</h1>
          <p className="page-subtitle">{t("Track pending action items and tasks.")}</p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div className="search-bar" style={{ position: "relative", width: "240px" }}>
            <IconSearch style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} size={16} />
            <input
              type="text"
              className="login-input"
              placeholder={t("Search follow ups...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: "36px", height: "36px", margin: 0 }}
            />
          </div>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <IconCheck /> {t("Add Follow Up")}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>{t("Action Item")}</th>
                <th>{t("Client")}</th>
                <th>{t("Due Date")}</th>
                <th>{t("Assigned To")}</th>
                <th>{t("Status")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((f) => {
                  const client = clients.find(cl => cl.id === f.clientId);
                  return (
                    <tr key={f.id}>
                      <td style={{ fontWeight: 600 }}>{f.title}</td>
                      <td>{client ? client.companyName : "-"}</td>
                      <td>
                        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <IconClock size={14} style={{ color: "var(--text-tertiary)" }} /> {f.dueDate}
                        </span>
                      </td>
                      <td>{f.assignedTo}</td>
                      <td>
                        <span className={`badge ${f.status === 'Completed' ? 'badge-success' : f.status === 'Overdue' ? 'badge-danger' : 'badge-warning'}`}>
                          {f.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "var(--text-tertiary)" }}>
                    {t("No pending follow ups.")}
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
                <span className="card-title">{t("Add Follow Up")}</span>
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
                    <label className="login-label">{t("Action Item")}*</label>
                    <input className="login-input" value={actionItem} onChange={(e) => setActionItem(e.target.value)} required />
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
                      <label className="login-label">{t("Due Date")}*</label>
                      <input className="login-input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
                    </div>
                    <div className="login-field">
                      <label className="login-label">{t("Status")}</label>
                      <select className="login-input" value={status} onChange={(e) => setStatus(e.target.value as any)}>
                        <option value="Pending">{t("Pending")}</option>
                        <option value="Completed">{t("Completed")}</option>
                        <option value="Overdue">{t("Overdue")}</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "16px" }}>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => setShowAddModal(false)}>
                      {t("Cancel")}
                    </button>
                    <button type="submit" className="btn btn-primary btn-sm" style={{ padding: "8px 20px" }}>
                      {t("Save Follow Up")}
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
