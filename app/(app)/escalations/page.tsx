"use client";

import React, { useEffect, useState } from "react";
import { useAppStore, useTranslation } from "@/lib/store";
import ModalPortal from "@/components/ui/ModalPortal";
import {
  IconAlert,
  IconClose,
  IconPlus,
  IconCheckCircle,
  IconSearch,
} from "@/components/ui/Icons";

interface Escalation {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  raisedBy: string;
  assignedTo: string | null;
  clientId: string;
  resolvedAt: string | null;
  createdAt: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  low: "#6b7280",
  medium: "#f59e0b",
  high: "#ef4444",
  critical: "#7f1d1d",
};

const STATUS_COLORS: Record<string, string> = {
  open: "#ef4444",
  "in-progress": "#f59e0b",
  resolved: "#10b981",
  closed: "#6b7280",
};

export default function CMEscalationsPage() {
  const data = useAppStore((state) => state.data);
  const { t } = useTranslation();
  const [items, setItems] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Escalation | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState({
    clientId: "",
    title: "",
    description: "",
    severity: "medium",
    assignedTo: "",
  });

  const clients = data.clients || [];

  const load = () => {
    setLoading(true);
    fetch("/api/client-manager/escalations", { credentials: "include" })
      .then((r) => r.json())
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  
  useEffect(load, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientId || !form.title || !form.description) return;

    const url = editItem
      ? `/api/client-manager/escalations/${editItem.id}`
      : "/api/client-manager/escalations";
    
    await fetch(url, {
      method: editItem ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(form),
    });
    
    setShowForm(false);
    setEditItem(null);
    setForm({
      clientId: "",
      title: "",
      description: "",
      severity: "medium",
      assignedTo: "",
    });
    load();
  };

  const quickUpdate = async (id: string, status: string) => {
    await fetch(`/api/client-manager/escalations/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        status,
        resolvedAt: status === "resolved" ? new Date().toISOString() : null,
      }),
    });
    load();
  };

  const filtered = items.filter(
    (esc) =>
      esc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      esc.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page-container" style={{ animation: "fadeIn 0.5s ease-out", padding: "24px" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("Escalations")}</h1>
          <p className="page-subtitle">
            {items.filter((i) => i.status === "open").length} open ·{" "}
            {items.filter((i) => i.severity === "critical").length} critical
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
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
              placeholder={t("Search escalations...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: "36px", height: "36px", margin: 0 }}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={() => {
              setShowForm(true);
              setEditItem(null);
              setForm({
                clientId: "",
                title: "",
                description: "",
                severity: "medium",
                assignedTo: "",
              });
            }}
          >
            <IconPlus size={14} style={{ marginRight: "4px" }} />
            {t("Raise Escalation")}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1rem" }}>
        {loading ? (
          <div style={{ color: "var(--text-secondary)", padding: "16px" }}>{t("Loading...")}</div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "48px",
              background: "var(--surface)",
              borderRadius: "12px",
              border: "1px dashed var(--border-color)",
              color: "var(--text-tertiary)",
            }}
          >
            <IconCheckCircle size={48} style={{ color: "#10b981", marginBottom: "16px" }} />
            <p style={{ margin: 0, fontWeight: 500 }}>{t("No escalations found.")}</p>
          </div>
        ) : (
          filtered.map((esc) => {
            const client = clients.find((c) => c.id === esc.clientId);
            return (
              <div
                key={esc.id}
                className="card"
                style={{
                  padding: "1.25rem",
                  borderLeft: `4px solid ${SEVERITY_COLORS[esc.severity] || "#6b7280"}`,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "0.5rem",
                      gap: "8px",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)" }}>
                      {esc.title}
                    </div>
                    <div style={{ display: "flex", gap: "0.35rem", flexShrink: 0 }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "12px",
                          fontSize: "0.65rem",
                          fontWeight: 700,
                          background: `${SEVERITY_COLORS[esc.severity]}22`,
                          color: SEVERITY_COLORS[esc.severity],
                          textTransform: "uppercase",
                        }}
                      >
                        {esc.severity}
                      </span>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "12px",
                          fontSize: "0.65rem",
                          fontWeight: 700,
                          background: `${STATUS_COLORS[esc.status]}22`,
                          color: STATUS_COLORS[esc.status],
                          textTransform: "uppercase",
                        }}
                      >
                        {esc.status}
                      </span>
                    </div>
                  </div>
                  <p
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--text-secondary)",
                      margin: "0 0 1rem",
                      lineHeight: "1.4",
                    }}
                  >
                    {esc.description}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.78rem", color: "var(--text-tertiary)" }}>
                    <div>
                      <span style={{ fontWeight: 500 }}>Client:</span> {client ? client.companyName : esc.clientId}
                    </div>
                    <div>
                      <span style={{ fontWeight: 500 }}>Raised by:</span> {esc.raisedBy}
                    </div>
                    {esc.assignedTo && (
                      <div>
                        <span style={{ fontWeight: 500 }}>Assigned to:</span> {esc.assignedTo}
                      </div>
                    )}
                    <div>
                      <span style={{ fontWeight: 500 }}>Created:</span> {new Date(esc.createdAt).toLocaleDateString()}
                    </div>
                    {esc.resolvedAt && (
                      <div style={{ color: "#10b981" }}>
                        <span style={{ fontWeight: 500 }}>Resolved:</span> {new Date(esc.resolvedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    marginTop: "1.25rem",
                    flexWrap: "wrap",
                    borderTop: "1px solid var(--border-color)",
                    paddingTop: "0.75rem",
                  }}
                >
                  {esc.status !== "in-progress" && esc.status !== "resolved" && esc.status !== "closed" && (
                    <button
                      onClick={() => quickUpdate(esc.id, "in-progress")}
                      className="btn btn-outline btn-sm"
                      style={{ padding: "4px 8px", fontSize: "0.75rem", color: "#f59e0b", borderColor: "#f59e0b" }}
                    >
                      {t("Start")}
                    </button>
                  )}
                  {esc.status !== "resolved" && esc.status !== "closed" && (
                    <button
                      onClick={() => quickUpdate(esc.id, "resolved")}
                      className="btn btn-outline btn-sm"
                      style={{ padding: "4px 8px", fontSize: "0.75rem", color: "#10b981", borderColor: "#10b981" }}
                    >
                      {t("Resolve")}
                    </button>
                  )}
                  {esc.status !== "closed" && (
                    <button
                      onClick={() => quickUpdate(esc.id, "closed")}
                      className="btn btn-outline btn-sm"
                      style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                    >
                      {t("Close")}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditItem(esc);
                      setForm({
                        clientId: esc.clientId,
                        title: esc.title,
                        description: esc.description,
                        severity: esc.severity,
                        assignedTo: esc.assignedTo ?? "",
                      });
                      setShowForm(true);
                    }}
                    className="btn btn-outline btn-sm"
                    style={{ padding: "4px 8px", fontSize: "0.75rem", marginLeft: "auto" }}
                  >
                    {t("Edit")}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showForm && (
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
              if (e.target === e.currentTarget) {
                setShowForm(false);
                setEditItem(null);
              }
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
                <span className="card-title">
                  {editItem ? t("Edit Escalation") : t("Raise Escalation")}
                </span>
                <button
                  className="topbar-btn"
                  onClick={() => {
                    setShowForm(false);
                    setEditItem(null);
                  }}
                  style={{ width: "32px", height: "32px", minWidth: "32px", borderRadius: "8px" }}
                >
                  <IconClose size={14} />
                </button>
              </div>

              <div className="card-body" style={{ padding: "20px 24px" }}>
                <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div className="login-field">
                    <label className="login-label">{t("Client")}*</label>
                    <select
                      className="login-input"
                      value={form.clientId}
                      onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                      required
                    >
                      <option value="">{t("-- Select Client --")}</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.companyName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="login-field">
                    <label className="login-label">{t("Title")}*</label>
                    <input
                      className="login-input"
                      type="text"
                      placeholder={t("Short summary of issue")}
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      required
                    />
                  </div>

                  <div className="login-field">
                    <label className="login-label">{t("Description")}*</label>
                    <textarea
                      className="login-input"
                      placeholder={t("Describe the escalation details...")}
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      rows={3}
                      style={{ resize: "none", height: "80px" }}
                      required
                    />
                  </div>

                  <div className="login-field">
                    <label className="login-label">{t("Assigned To")}</label>
                    <input
                      className="login-input"
                      type="text"
                      placeholder={t("Owner name")}
                      value={form.assignedTo}
                      onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                    />
                  </div>

                  <div className="login-field">
                    <label className="login-label">{t("Severity")}</label>
                    <select
                      className="login-input"
                      value={form.severity}
                      onChange={(e) => setForm({ ...form, severity: e.target.value })}
                    >
                      <option value="low">{t("Low")}</option>
                      <option value="medium">{t("Medium")}</option>
                      <option value="high">{t("High")}</option>
                      <option value="critical">{t("Critical")}</option>
                    </select>
                  </div>

                  <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "16px" }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => {
                        setShowForm(false);
                        setEditItem(null);
                      }}
                    >
                      {t("Cancel")}
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      style={{ padding: "8px 20px" }}
                      disabled={!form.title || !form.description || !form.clientId}
                    >
                      {editItem ? t("Save Changes") : t("Raise")}
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
