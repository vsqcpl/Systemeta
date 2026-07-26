"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, useTranslation } from "@/lib/store";
import ModalPortal from "@/components/ui/ModalPortal";
import EditClientModal from "@/components/EditClientModal";
import DeleteClientModal from "@/components/DeleteClientModal";
import { Client, ClientStatus } from "@/lib/data/types";
import {
  IconUsers,
  IconClose,
  IconSearch,
  IconEdit,
  IconTrash,
} from "@/components/ui/Icons";

export default function ClientsPage() {
  const router = useRouter();
  const data = useAppStore((state) => state.data);
  const currentUser = useAppStore((state) => state.user);
  const addClient = useAppStore((state) => state.addClient);
  const updateClient = useAppStore((state) => state.updateClient);
  const deleteClient = useAppStore((state) => state.deleteClient);
  const { t } = useTranslation();

  // Search, Filters & Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);

  // Add Form state
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [gst, setGst] = useState("");
  const [address, setAddress] = useState("");
  const [industry, setIndustry] = useState("");
  const [status, setStatus] = useState<ClientStatus>("Active");
  const [accountManager, setAccountManager] = useState("");
  const [notes, setNotes] = useState("");

  const clients = data.clients || [];

  // Check RBAC Authorization
  const canManageClients =
    !currentUser ||
    currentUser.role === "super_admin" ||
    currentUser.role === "client_manager" ||
    currentUser.role === "director" ||
    (currentUser as any).permissions?.crm;

  // Multi-field search and status filter
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      // Exclude soft-deleted items if any exist in store
      if (c.deletedAt) return false;

      const matchesSearch =
        c.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.industry?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.accountOwner?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "All" ||
        c.status?.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [clients, searchTerm, statusFilter]);

  // Pagination logic
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage) || 1;
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredClients.slice(start, start + itemsPerPage);
  }, [filteredClients, currentPage]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name && !company) return;

    const clientName = name || company;
    addClient({
      companyName: clientName,
      company: company || clientName,
      contactPerson,
      clientType: "Direct",
      industry,
      website: "",
      gstNumber: gst,
      gst,
      panNumber: "",
      address,
      country: "",
      state: "",
      city: "",
      pincode: "",
      email,
      phone,
      status,
      clientCategory: "A",
      priority: "Medium",
      notes,
      accountOwner: accountManager,
      assignedManagerIds: accountManager,
    });

    setName("");
    setCompany("");
    setContactPerson("");
    setEmail("");
    setPhone("");
    setGst("");
    setAddress("");
    setIndustry("");
    setStatus("Active");
    setAccountManager("");
    setNotes("");
    setShowAddModal(false);
  };

  return (
    <div className="page-container" style={{ animation: "fadeIn 0.5s ease-out", padding: "24px" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("Clients")}</h1>
          <p className="page-subtitle">{t("Manage client organizations, edit contact details, and status.")}</p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          {/* Status Filter */}
          <select
            className="login-input"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            style={{ width: "140px", height: "36px", margin: 0 }}
          >
            <option value="All">{t("All Statuses")}</option>
            <option value="Active">{t("Active")}</option>
            <option value="Inactive">{t("Inactive")}</option>
            <option value="Prospect">{t("Prospect")}</option>
            <option value="On Hold">{t("On Hold")}</option>
            <option value="Closed">{t("Closed")}</option>
          </select>

          {/* Multi-field Search Bar */}
          <div className="search-bar" style={{ position: "relative", width: "240px" }}>
            <IconSearch
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-tertiary)",
              }}
              size={16}
            />
            <input
              type="text"
              className="login-input"
              placeholder={t("Search name, email, manager...")}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              style={{ paddingLeft: "36px", height: "36px", margin: 0 }}
            />
          </div>

          {canManageClients && (
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              <IconUsers /> {t("Add Client")}
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>{t("Client / Company")}</th>
                <th>{t("Contact Person")}</th>
                <th>{t("Email & Phone")}</th>
                <th>{t("Industry")}</th>
                <th>{t("Account Manager")}</th>
                <th>{t("Status")}</th>
                <th style={{ textAlign: "right" }}>{t("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedClients.length > 0 ? (
                paginatedClients.map((client) => (
                  <tr
                    key={client.id}
                    onClick={() => router.push(`/clients/${client.id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{client.companyName}</div>
                      {client.gstNumber || client.gst ? (
                        <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                          GST: {client.gstNumber || client.gst}
                        </div>
                      ) : null}
                    </td>
                    <td>{client.contactPerson || "-"}</td>
                    <td>
                      <div>{client.email || "-"}</div>
                      {client.phone && (
                        <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{client.phone}</div>
                      )}
                    </td>
                    <td>{client.industry || "-"}</td>
                    <td>{client.accountOwner || "-"}</td>
                    <td>
                      <span
                        className={`badge ${
                          client.status === "Active"
                            ? "badge-success"
                            : client.status === "Inactive"
                            ? "badge-danger"
                            : "badge-neutral"
                        }`}
                      >
                        {client.status}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div
                        style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => router.push(`/clients/${client.id}`)}
                        >
                          {t("View")}
                        </button>
                        {canManageClients && (
                          <>
                            <button
                              className="btn btn-secondary btn-sm"
                              title={t("Edit Client")}
                              onClick={() => setEditingClient(client)}
                              style={{ padding: "6px 10px" }}
                            >
                              <IconEdit size={14} />
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              title={t("Delete Client")}
                              onClick={() => setDeletingClient(client)}
                              style={{ padding: "6px 10px" }}
                            >
                              <IconTrash size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "var(--text-tertiary)" }}>
                    {t("No clients found matching your search or filters.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div
            style={{
              padding: "12px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              {t("Showing")} {(currentPage - 1) * itemsPerPage + 1} -{" "}
              {Math.min(currentPage * itemsPerPage, filteredClients.length)} {t("of")} {filteredClients.length}
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                {t("Previous")}
              </button>
              <span style={{ padding: "6px 12px", fontSize: "13px", color: "var(--text-primary)" }}>
                {currentPage} / {totalPages}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                {t("Next")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Client Modal */}
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
                maxWidth: "600px",
                maxHeight: "90vh",
                overflowY: "auto",
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
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
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
                      <label className="login-label">{t("Company Name")}</label>
                      <input
                        className="login-input"
                        type="text"
                        placeholder="e.g. Acme Holdings Inc."
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div className="login-field">
                      <label className="login-label">{t("Contact Person")}</label>
                      <input
                        className="login-input"
                        type="text"
                        placeholder="e.g. John Doe"
                        value={contactPerson}
                        onChange={(e) => setContactPerson(e.target.value)}
                      />
                    </div>
                    <div className="login-field">
                      <label className="login-label">{t("Email")}</label>
                      <input
                        className="login-input"
                        type="email"
                        placeholder="e.g. contact@acme.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div className="login-field">
                      <label className="login-label">{t("Phone")}</label>
                      <input
                        className="login-input"
                        type="text"
                        placeholder="e.g. +1 555 0192"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                    <div className="login-field">
                      <label className="login-label">{t("GST / Tax ID")}</label>
                      <input
                        className="login-input"
                        type="text"
                        placeholder="e.g. 22AAAAA0000A1Z5"
                        value={gst}
                        onChange={(e) => setGst(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
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
                      <label className="login-label">{t("Status")}</label>
                      <select
                        className="login-input"
                        value={status}
                        onChange={(e) => setStatus(e.target.value as ClientStatus)}
                      >
                        <option value="Active">{t("Active")}</option>
                        <option value="Inactive">{t("Inactive")}</option>
                        <option value="Prospect">{t("Prospect")}</option>
                        <option value="On Hold">{t("On Hold")}</option>
                      </select>
                    </div>
                  </div>

                  <div className="login-field">
                    <label className="login-label">{t("Account Manager")}</label>
                    <select
                      className="login-input"
                      value={accountManager}
                      onChange={(e) => setAccountManager(e.target.value)}
                    >
                      <option value="">{t("-- Select Manager --")}</option>
                      {data.users
                        ?.filter(
                          (u) =>
                            u.role === "client_manager" ||
                            u.role === "super_admin" ||
                            u.role === "director"
                        )
                        .map((u) => (
                          <option key={u.id} value={u.name}>
                            {u.name} ({u.role})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="login-field">
                    <label className="login-label">{t("Address")}</label>
                    <input
                      className="login-input"
                      type="text"
                      placeholder="e.g. 100 Main Street"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>

                  <div className="login-field">
                    <label className="login-label">{t("Notes")}</label>
                    <textarea
                      className="login-input"
                      style={{ height: "70px", resize: "vertical" }}
                      placeholder="Initial client notes..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
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

      {/* Edit Client Modal */}
      {editingClient && (
        <EditClientModal
          isOpen={!!editingClient}
          onClose={() => setEditingClient(null)}
          client={editingClient}
          onSave={updateClient}
        />
      )}

      {/* Delete Client Modal */}
      {deletingClient && (
        <DeleteClientModal
          isOpen={!!deletingClient}
          onClose={() => setDeletingClient(null)}
          client={deletingClient}
          onConfirm={deleteClient}
        />
      )}
    </div>
  );
}
