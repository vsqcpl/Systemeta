"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, useTranslation } from "@/lib/store";
import ModalPortal from "@/components/ui/ModalPortal";
import {
  IconUsers,
  IconClose,
  IconBriefcase,
  IconSearch,
} from "@/components/ui/Icons";

export default function ClientsPage() {
  const router = useRouter();
  const data = useAppStore((state) => state.data);
  const addClient = useAppStore((state) => state.addClient);
  const { t } = useTranslation();

  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [accountManager, setAccountManager] = useState("");

  const clients = data.clients || [];

  const filteredClients = clients.filter((c) =>
    c.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.industry?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    addClient({
      companyName: name,
      clientType: "Direct",
      industry,
      website: "",
      gstNumber: "",
      panNumber: "",
      address: "",
      country: "",
      state: "",
      city: "",
      pincode: "",
      email: "",
      phone: "",
      status: "Active",
      clientCategory: "A",
      priority: "Medium",
      notes: "",
      accountOwner: accountManager,
    });

    setName("");
    setIndustry("");
    setAccountManager("");
    setShowAddModal(false);
  };

  return (
    <div className="page-container" style={{ animation: "fadeIn 0.5s ease-out", padding: "24px" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("Clients")}</h1>
          <p className="page-subtitle">{t("Manage client organizations and their status.")}</p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div className="search-bar" style={{ position: "relative", width: "240px" }}>
            <IconSearch style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }} size={16} />
            <input
              type="text"
              className="login-input"
              placeholder={t("Search clients...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: "36px", height: "36px", margin: 0 }}
            />
          </div>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <IconUsers /> {t("Add Client")}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>{t("Client Name")}</th>
                <th>{t("Industry")}</th>
                <th>{t("Account Manager")}</th>
                <th>{t("Status")}</th>
                <th style={{ textAlign: "right" }}>{t("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length > 0 ? (
                filteredClients.map((client) => (
                  <tr key={client.id} onClick={() => router.push(`/clients/${client.id}`)} style={{ cursor: "pointer" }}>
                    <td style={{ fontWeight: 600 }}>{client.companyName}</td>
                    <td>{client.industry || "-"}</td>
                    <td>{client.accountOwner || "-"}</td>
                    <td>
                      <span className={`badge ${client.status === 'Active' ? 'badge-success' : 'badge-neutral'}`}>
                        {client.status}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); router.push(`/clients/${client.id}`); }}>
                        {t("View Profile")}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "var(--text-tertiary)" }}>
                    {t("No clients found.")}
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
              animation: "fadeIn 0.2s ease",
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
                animation: "cardEntrance 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="card-header" style={{ padding: "20px 24px" }}>
                <span className="card-title">{t("Add New Client")}</span>
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
                    <label className="login-label">{t("Client Name")}</label>
                    <input
                      className="login-input"
                      type="text"
                      placeholder="e.g. Acme Corp"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="login-field">
                    <label className="login-label">{t("Industry")}</label>
                    <input
                      className="login-input"
                      type="text"
                      placeholder="e.g. Financial Services"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                    />
                  </div>
                  <div className="login-field">
                    <label className="login-label">{t("Account Manager")}</label>
                    <select
                      className="login-input"
                      value={accountManager}
                      onChange={(e) => setAccountManager(e.target.value)}
                    >
                      <option value="">{t("-- Select Manager --")}</option>
                      {data.users?.filter(u => u.role === "client_manager" || u.role === "director").map(u => (
                        <option key={u.id} value={u.name}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "16px" }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => setShowAddModal(false)}
                    >
                      {t("Cancel")}
                    </button>
                    <button type="submit" className="btn btn-primary btn-sm" style={{ padding: "8px 20px" }}>
                      {t("Create Client")}
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
