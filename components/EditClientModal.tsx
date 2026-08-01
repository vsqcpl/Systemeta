"use client";

import React, { useState, useEffect } from "react";
import ModalPortal from "@/components/ui/ModalPortal";
import { IconClose } from "@/components/ui/Icons";
import { Client, ClientStatus } from "@/lib/data/types";
import { useTranslation, useAppStore } from "@/lib/store";

interface EditClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
  onSave: (id: string, updates: Partial<Client>) => Promise<void>;
}

export default function EditClientModal({
  isOpen,
  onClose,
  client,
  onSave,
}: EditClientModalProps) {
  const { t } = useTranslation();
  const users = useAppStore((state) => state.data.users || []);
  const managers = users.filter(
    (u) => u.role === "client_manager" || u.role === "super_admin" || u.role === "director"
  );

  const [companyName, setCompanyName] = useState(client.companyName || "");
  const [company, setCompany] = useState(client.company || client.companyName || "");
  const [contactPerson, setContactPerson] = useState(client.contactPerson || "");
  const [email, setEmail] = useState(client.email || "");
  const [phone, setPhone] = useState(client.phone || "");
  const [address, setAddress] = useState(client.address || "");
  const [gstNumber, setGstNumber] = useState(client.gstNumber || client.gst || "");
  const [industry, setIndustry] = useState(client.industry || "");
  const [status, setStatus] = useState<ClientStatus>(client.status || "Active");
  const [accountOwner, setAccountOwner] = useState(client.accountOwner || "");
  const [selectedManagerIds, setSelectedManagerIds] = useState<string[]>(() => {
    if (Array.isArray(client.assignedManagerIds)) return client.assignedManagerIds.filter(Boolean);
    if (typeof client.assignedManagerIds === "string" && client.assignedManagerIds) {
      return client.assignedManagerIds.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return client.accountOwner ? [client.accountOwner] : [];
  });
  const [notes, setNotes] = useState(client.notes || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setCompanyName(client.companyName || "");
    setCompany(client.company || client.companyName || "");
    setContactPerson(client.contactPerson || "");
    setEmail(client.email || "");
    setPhone(client.phone || "");
    setAddress(client.address || "");
    setGstNumber(client.gstNumber || client.gst || "");
    setIndustry(client.industry || "");
    setStatus(client.status || "Active");
    setAccountOwner(client.accountOwner || "");
    setNotes(client.notes || "");

    let initialManagers: string[] = [];
    if (Array.isArray(client.assignedManagerIds)) {
      initialManagers = client.assignedManagerIds.filter(Boolean);
    } else if (typeof client.assignedManagerIds === "string" && client.assignedManagerIds) {
      initialManagers = client.assignedManagerIds.split(",").map((s) => s.trim()).filter(Boolean);
    } else if (client.accountOwner) {
      initialManagers = [client.accountOwner];
    }
    setSelectedManagerIds(initialManagers);
  }, [client]);

  if (!isOpen) return null;

  const toggleManagerSelection = (managerNameOrId: string) => {
    setSelectedManagerIds((prev) =>
      prev.includes(managerNameOrId)
        ? prev.filter((id) => id !== managerNameOrId)
        : [...prev, managerNameOrId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const primaryOwner = selectedManagerIds[0] || accountOwner || "";
      await onSave(client.id, {
        companyName: companyName || company,
        company: company || companyName,
        contactPerson,
        email,
        phone,
        address,
        gstNumber,
        gst: gstNumber,
        industry,
        status,
        accountOwner: primaryOwner,
        assignedManagerIds: selectedManagerIds.length > 0 ? selectedManagerIds : [primaryOwner],
        notes,
      });
      onClose();
    } catch (err) {
      console.error("Failed to save client updates:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
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
          if (e.target === e.currentTarget) onClose();
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
            <span className="card-title">{t("Edit Client")}</span>
            <button
              className="topbar-btn"
              onClick={onClose}
              style={{ width: "32px", height: "32px", minWidth: "32px", borderRadius: "8px" }}
            >
              <IconClose size={14} />
            </button>
          </div>

          <div className="card-body" style={{ padding: "20px 24px" }}>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div className="login-field">
                  <label className="login-label">{t("Client Name")}</label>
                  <input
                    className="login-input"
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                  />
                </div>
                <div className="login-field">
                  <label className="login-label">{t("Company")}</label>
                  <input
                    className="login-input"
                    type="text"
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
                    placeholder="e.g. client@company.com"
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
                  <label className="login-label">{t("GST / Tax Identifier")}</label>
                  <input
                    className="login-input"
                    type="text"
                    placeholder="e.g. 22AAAAA0000A1Z5"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div className="login-field">
                  <label className="login-label">{t("Industry")}</label>
                  <input
                    className="login-input"
                    type="text"
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
                    <option value="Closed">{t("Closed")}</option>
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
                  {managers.length > 0 ? (
                    managers.map((m) => {
                      const isChecked = selectedManagerIds.includes(m.name) || selectedManagerIds.includes(m.id);
                      return (
                        <label
                          key={m.id}
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
                            onChange={() => toggleManagerSelection(m.name)}
                            style={{ width: "16px", height: "16px", cursor: "pointer" }}
                          />
                          <span>
                            {m.name} <span style={{ fontSize: "12px", opacity: 0.7 }}>({m.role})</span>
                          </span>
                        </label>
                      );
                    })
                  ) : (
                    <div style={{ fontSize: "13px", color: "var(--text-tertiary)" }}>
                      {t("No managers available")}
                    </div>
                  )}
                </div>
              </div>

              <div className="login-field">
                <label className="login-label">{t("Address")}</label>
                <input
                  className="login-input"
                  type="text"
                  placeholder="e.g. 100 Main Street, Suite 400"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div className="login-field">
                <label className="login-label">{t("Notes")}</label>
                <textarea
                  className="login-input"
                  style={{ height: "80px", resize: "vertical" }}
                  placeholder="Internal notes regarding client relationship..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "16px" }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
                  {t("Cancel")}
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={loading} style={{ padding: "8px 20px" }}>
                  {loading ? t("Saving...") : t("Save Changes")}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
