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

import { isManagerAssignedToClient } from "@/lib/permissionHelpers";

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
  const [selectedManagerIds, setSelectedManagerIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const clients = data.clients || [];

  // Available Client Managers
  const availableManagers = useMemo(() => {
    return (data.users || []).filter(
      (u) => u.role === "client_manager" || u.role === "super_admin" || u.role === "director"
    );
  }, [data.users]);

  // Helper to extract array of assigned manager names/IDs
  const getAssignedManagers = (c: Client) => {
    if (Array.isArray(c.assignedManagerIds)) {
      return c.assignedManagerIds.filter(Boolean);
    }
    if (typeof c.assignedManagerIds === "string" && c.assignedManagerIds) {
      return c.assignedManagerIds.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return c.accountOwner ? [c.accountOwner] : [];
  };

  // Check RBAC Authorization
  const canManageClients =
    !currentUser ||
    currentUser.role === "super_admin" ||
    currentUser.role === "client_manager" ||
    currentUser.role === "director" ||
    (currentUser as any).permissions?.crm;

  // Multi-field search, manager permission check, and status filter
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      // Exclude soft-deleted items
      if (c.deletedAt) return false;

      // Access control check: super_admin sees all; Client Manager sees assigned clients only
      if (!isManagerAssignedToClient(c, currentUser)) return false;

      const managersList = getAssignedManagers(c).join(" ").toLowerCase();

      const matchesSearch =
        c.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.industry?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.accountOwner?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        managersList.includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === "All" ||
        c.status?.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [clients, currentUser, searchTerm, statusFilter]);

  // Pagination logic
  const totalPages = Math.ceil(filteredClients.length / itemsPerPage) || 1;
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredClients.slice(start, start + itemsPerPage);
  }, [filteredClients, currentPage]);

  const toggleManagerSelection = (managerNameOrId: string) => {
    setSelectedManagerIds((prev) =>
      prev.includes(managerNameOrId)
        ? prev.filter((id) => id !== managerNameOrId)
        : [...prev, managerNameOrId]
    );
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name && !company) return;

    const clientName = name || company;
    const primaryOwner = selectedManagerIds[0] || (currentUser ? currentUser.name : "");

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
      accountOwner: primaryOwner,
      assignedManagerIds: selectedManagerIds.length > 0 ? selectedManagerIds : [primaryOwner],
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
    setSelectedManagerIds([]);
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
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {getAssignedManagers(client).length > 0 ? (
                          getAssignedManagers(client).map((m, idx) => (
                            <span
                              key={idx}
                              style={{
                                padding: "2px 8px",
                                borderRadius: "12px",
                                fontSize: "0.75rem",
                                fontWeight: 500,
                                background: "rgba(99, 102, 241, 0.12)",
                                color: "var(--primary-color, #4f46e5)",
                                border: "1px solid rgba(99, 102, 241, 0.2)",
                              }}
                            >
                              {m}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: "var(--text-tertiary)" }}>-</span>
                        )}
                      </div>
                    </td>
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
              className="card-classic"
              style={{
                width: "100%",
                maxWidth: "640px",
                maxHeight: "90vh",
                overflowY: "auto",
                borderRadius: "16px",
                padding: "28px",
                background: "var(--bg-primary, #ffffff)",
                boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "20px",
                }}
              >
                <div>
                  <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>
                    {t("Add New Client")}
                  </h2>
                  <p style={{ fontSize: "13px", color: "var(--text-tertiary)", margin: "4px 0 0 0" }}>
                    {t("Create a new client record and assign Client Managers.")}
                  </p>
                </div>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setShowAddModal(false)}
                  style={{ padding: "6px" }}
                >
                  <IconClose size={16} />
                </button>
              </div>

              <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div className="login-field">
                    <label className="login-label">{t("Client Name *")}</label>
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
                  <label className="login-label">{t("Assigned Client Managers (Multi-Select)")}</label>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      padding: "12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border-color, #e2e8f0)",
                      background: "var(--bg-secondary, #f8fafc)",
                      maxHeight: "150px",
                      overflowY: "auto",
                    }}
                  >
                    {data.users
                      ?.filter(
                        (u) =>
                          u.role === "client_manager" ||
                          u.role === "super_admin" ||
                          u.role === "director"
                      )
                      .map((u) => {
                        const isChecked = selectedManagerIds.includes(u.name) || selectedManagerIds.includes(u.id);
                        return (
                          <label
                            key={u.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              fontSize: "14px",
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleManagerSelection(u.name)}
                              style={{ width: "16px", height: "16px", cursor: "pointer" }}
                            />
                            <span>
                              {u.name} <span style={{ fontSize: "12px", opacity: 0.7 }}>({u.role})</span>
                            </span>
                          </label>
                        );
                      })}
                  </div>
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
