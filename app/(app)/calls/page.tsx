"use client";

import React, { useState } from "react";
import { useAppStore, useTranslation } from "@/lib/store";
import ModalPortal from "@/components/ui/ModalPortal";
import { IconTarget, IconClose, IconSearch } from "@/components/ui/Icons";

export default function CallsPage() {
  const data = useAppStore((state) => state.data);
  const addCall = useAppStore((state) => state.addCall);
  const { t } = useTranslation();

  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form
  const [clientId, setClientId] = useState("");
  const [contactId, setContactId] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");

  const calls = data.clientCalls || [];
  const clients = data.clients || [];
  const contacts = data.clientContacts || [];

  const filtered = calls.filter((c) =>
    c.discussionSummary?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.callType?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !date) return;

    addCall({
      clientId,
      contactId,
      date,
      discussionSummary: notes,
      callType: "General",
      callDirection: "Outbound",
      time: "10:00",
      duration: 30,
      outcome: "Interested",
      nextAction: "",
      followUpDate: null,
    });

    setClientId("");
    setContactId("");
    setDate("");
    setNotes("");
    setShowAddModal(false);
  };

  return (
    <div className="page-container" style={{ animation: "fadeIn 0.5s ease-out", padding: "24px" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("Calls")}</h1>
          <p className="page-subtitle">{t("Log and track client communication.")}</p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div className="search-bar" style={{ position: "relative", width: "240px" }}>
            <IconSearch style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} size={16} />
            <input
              type="text"
              className="login-input"
              placeholder={t("Search calls...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: "36px", height: "36px", margin: 0 }}
            />
          </div>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <IconTarget /> {t("Log Call")}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>{t("Date")}</th>
                <th>{t("Client")}</th>
                <th>{t("Contact")}</th>
                <th>{t("Call Type")}</th>
                <th>{t("Notes")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((c) => {
                  const client = clients.find(cl => cl.id === c.clientId);
                  const contact = contacts.find(co => co.id === c.contactId);
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.date}</td>
                      <td>{client ? client.companyName : "-"}</td>
                      <td>{contact ? contact.name : "-"}</td>
                      <td>{c.callType}</td>
                      <td style={{ maxWidth: 300, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {c.discussionSummary || "-"}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "var(--text-tertiary)" }}>
                    {t("No calls logged.")}
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
                <span className="card-title">{t("Log Call")}</span>
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
                    <label className="login-label">{t("Client")}*</label>
                    <select className="login-input" value={clientId} onChange={(e) => setClientId(e.target.value)} required>
                      <option value="">{t("-- Select Client --")}</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                    </select>
                  </div>
                  <div className="login-field">
                    <label className="login-label">{t("Contact")}</label>
                    <select className="login-input" value={contactId} onChange={(e) => setContactId(e.target.value)}>
                      <option value="">{t("-- Select Contact --")}</option>
                      {contacts.filter(c => !clientId || c.clientId === clientId).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="login-field">
                    <label className="login-label">{t("Date")}*</label>
                    <input className="login-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                  </div>
                  <div className="login-field">
                    <label className="login-label">{t("Notes")}</label>
                    <textarea 
                      className="login-input" 
                      style={{ height: "80px", resize: "none" }} 
                      value={notes} 
                      onChange={(e) => setNotes(e.target.value)} 
                    />
                  </div>
                  <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "16px" }}>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => setShowAddModal(false)}>
                      {t("Cancel")}
                    </button>
                    <button type="submit" className="btn btn-primary btn-sm" style={{ padding: "8px 20px" }}>
                      {t("Log Call")}
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
