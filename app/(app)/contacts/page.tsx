"use client";

import React, { useState } from "react";
import { useAppStore, useTranslation } from "@/lib/store";
import ModalPortal from "@/components/ui/ModalPortal";
import { IconUsers, IconClose, IconSearch } from "@/components/ui/Icons";

export default function ContactsPage() {
  const data = useAppStore((state) => state.data);
  const addContact = useAppStore((state) => state.addContact);
  const { t } = useTranslation();

  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [clientId, setClientId] = useState("");

  const contacts = data.clientContacts || [];
  const clients = data.clients || [];

  const filtered = contacts.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.designation?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !clientId) return;

    addContact({
      clientId,
      name,
      designation: title,
      department: "",
      email,
      phone,
      whatsapp: "",
      preferredContactMethod: "Email",
      decisionMaker: false,
      status: "Active",
    });

    setName("");
    setTitle("");
    setEmail("");
    setPhone("");
    setClientId("");
    setShowAddModal(false);
  };

  return (
    <div className="page-container" style={{ animation: "fadeIn 0.5s ease-out", padding: "24px" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("Contacts")}</h1>
          <p className="page-subtitle">{t("Manage key client stakeholders.")}</p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div className="search-bar" style={{ position: "relative", width: "240px" }}>
            <IconSearch style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} size={16} />
            <input
              type="text"
              className="login-input"
              placeholder={t("Search contacts...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: "36px", height: "36px", margin: 0 }}
            />
          </div>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <IconUsers /> {t("Add Contact")}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>{t("Name")}</th>
                <th>{t("Title")}</th>
                <th>{t("Client")}</th>
                <th>{t("Email")}</th>
                <th>{t("Phone")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((c) => {
                  const client = clients.find(cl => cl.id === c.clientId);
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td>{c.designation || "-"}</td>
                      <td>{client ? client.companyName : "-"}</td>
                      <td>{c.email || "-"}</td>
                      <td>{c.phone || "-"}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "var(--text-tertiary)" }}>
                    {t("No contacts found.")}
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
                <span className="card-title">{t("Add Contact")}</span>
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
                    <label className="login-label">{t("Name")}*</label>
                    <input className="login-input" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="login-field">
                    <label className="login-label">{t("Client")}*</label>
                    <select className="login-input" value={clientId} onChange={(e) => setClientId(e.target.value)} required>
                      <option value="">{t("-- Select Client --")}</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
                    </select>
                  </div>
                  <div className="login-field">
                    <label className="login-label">{t("Title")}</label>
                    <input className="login-input" value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div className="login-field">
                      <label className="login-label">{t("Email")}</label>
                      <input className="login-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="login-field">
                      <label className="login-label">{t("Phone")}</label>
                      <input className="login-input" type="text" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "16px" }}>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => setShowAddModal(false)}>
                      {t("Cancel")}
                    </button>
                    <button type="submit" className="btn btn-primary btn-sm" style={{ padding: "8px 20px" }}>
                      {t("Save Contact")}
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
