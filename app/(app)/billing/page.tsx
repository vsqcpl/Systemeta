"use client";

import React, { useState } from "react";
import { useAppStore, useTranslation } from "@/lib/store";
import { InvoicesChart } from "@/components/charts/ChartComponents";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { filterProjects } from "@/lib/dataFilters";
import ActionGuard from "@/components/guards/ActionGuard";

export default function BillingPage() {
  const data = useAppStore((state) => state.data);
  const showToast = useAppStore((state) => state.showToast);
  const addInvoice = useAppStore((state) => state.addInvoice);
  const currencyFormat = useAppStore((state) => state.currencyFormat);
  const { t } = useTranslation();
  const { user } = useAuth();

  const visibleProjects = user ? filterProjects(data.projects, user) : [];
  const visibleProjectIds = visibleProjects.map((p) => p.id);

  const visibleInvoices = user?.role === "super_admin" || user?.role === "Super Admin" || user?.role === "accounts" || user?.role === "Accounts"
    ? data.invoices
    : data.invoices.filter((inv) => visibleProjectIds.includes(inv.project));

  const [statusFilter, setStatusFilter] = useState("All Status");
  const [activeTab, setActiveTab] = useState<"invoices" | "milestones">("invoices");

  const visibleMilestones = user?.role === "super_admin" || user?.role === "Super Admin" || user?.role === "accounts" || user?.role === "Accounts"
    ? data.milestones
    : data.milestones.filter((m) => visibleProjectIds.includes(m.project));

  // Modal State
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [clientName, setClientName] = useState("");
  const [project, setProject] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<{ clientName?: string; project?: string; invoiceDate?: string; dueDate?: string; amount?: string }>({});

  // Auto-select first project
  React.useEffect(() => {
    if (visibleProjects.length > 0 && !project) {
      setProject(visibleProjects[0].id);
    }
  }, [visibleProjects, project]);

  // Handle Escape key to close modal
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowInvoiceModal(false);
      }
    };
    if (showInvoiceModal) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showInvoiceModal]);

  const handleGenerateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: typeof errors = {};

    if (!clientName.trim()) {
      nextErrors.clientName = "Client Name is required";
    }
    if (!project) {
      nextErrors.project = "Project is required";
    }
    if (!invoiceDate) {
      nextErrors.invoiceDate = "Invoice Date is required";
    }
    if (!dueDate) {
      nextErrors.dueDate = "Due Date is required";
    }
    if (!amount || parseFloat(amount) <= 0) {
      nextErrors.amount = "Amount must be greater than 0";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    addInvoice({
      client: clientName,
      project: project,
      issued: invoiceDate,
      due: dueDate,
      amount: parseFloat(amount),
    });

    // Reset form & close
    setClientName("");
    setInvoiceDate(new Date().toISOString().split("T")[0]);
    setDueDate("");
    setAmount("");
    setNotes("");
    setErrors({});
    setShowInvoiceModal(false);
  };

  const handleExportCSV = () => {
    if (data.invoices.length === 0) {
      showToast("No invoices to export", "danger");
      return;
    }

    // Helper for Indian Lakhs/Crore format export
    const formatCsvAmount = (v: number): string => {
      const absValue = Math.abs(v);
      const isNegative = v < 0;
      let formatted = "";
      if (absValue >= 10000000) { // 1 Crore
        formatted = (absValue / 10000000).toFixed(2) + "Cr";
      } else if (absValue >= 100000) { // 1 Lakh
        formatted = (absValue / 100000).toFixed(2) + "L";
      } else {
        formatted = absValue.toLocaleString("en-IN");
      }
      return (isNegative ? "-" : "") + "₹" + formatted;
    };

    const headers = ["Invoice ID", "Client", "Project", "Date", "Due Date", "Amount", "Status"];
    const rows = data.invoices.map((inv) => [
      inv.id,
      inv.client,
      inv.project,
      inv.issued,
      inv.due || "—",
      formatCsvAmount(inv.amount),
      inv.status,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().split("T")[0];
    
    link.setAttribute("href", url);
    link.setAttribute("download", `VSQC_Invoices_${dateStr}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("CSV exported successfully", "success");
  };

  const handleDownloadInvoice = async (inv: any) => {
    showToast(`Downloading invoice ${inv.id}...`, "info");
    try {
      const jsPDF = (await import("jspdf")).default;
      const doc = new jsPDF("p", "mm", "a4");

      // Brand colors: deep blue (#1e3a5f)
      // Primary header
      doc.setFillColor(30, 58, 95); 
      doc.rect(0, 0, 210, 40, "F");

      // White text for header
      doc.setTextColor(255, 255, 255);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(22);
      doc.text("VSQC ENTERPRISE PLATFORM", 20, 25);

      doc.setFontSize(10);
      doc.setFont("Helvetica", "normal");
      doc.text("Invoice Statement", 190, 25, { align: "right" });

      // Section: Details
      doc.setTextColor(30, 41, 59); // Slate dark
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Invoice Details", 20, 55);
      doc.setDrawColor(226, 232, 240);
      doc.line(20, 58, 190, 58);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(100, 116, 139);

      // Left column details
      doc.setFont("Helvetica", "bold");
      doc.text("Invoice #:", 20, 68);
      doc.setFont("Helvetica", "normal");
      doc.text(inv.id, 60, 68);

      doc.setFont("Helvetica", "bold");
      doc.text("Client:", 20, 76);
      doc.setFont("Helvetica", "normal");
      doc.text(inv.client, 60, 76);

      doc.setFont("Helvetica", "bold");
      doc.text("Project ID:", 20, 84);
      doc.setFont("Helvetica", "normal");
      doc.text(inv.project, 60, 84);

      // Right column details
      doc.setFont("Helvetica", "bold");
      doc.text("Issue Date:", 110, 68);
      doc.setFont("Helvetica", "normal");
      doc.text(inv.issued, 150, 68);

      doc.setFont("Helvetica", "bold");
      doc.text("Due Date:", 110, 76);
      doc.setFont("Helvetica", "normal");
      doc.text(inv.due || "—", 150, 76);

      doc.setFont("Helvetica", "bold");
      doc.text("Status:", 110, 84);
      doc.setFont("Helvetica", "normal");
      doc.text(inv.status.toUpperCase(), 150, 84);

      // Section: Line items
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text("Billing Summary", 20, 105);
      doc.line(20, 108, 190, 108);

      // Table Header
      doc.setFillColor(248, 250, 252);
      doc.rect(20, 114, 170, 10, "F");
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text("Description", 25, 120);
      doc.text("Amount", 185, 120, { align: "right" });

      // Table Row
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text(`Professional Consulting Services - Project ${inv.project}`, 25, 134);
      doc.text(formatCurrency(inv.amount), 185, 134, { align: "right" });
      doc.line(20, 140, 190, 140);

      // Total section
      doc.setFont("Helvetica", "bold");
      doc.text("Total Due:", 130, 152);
      doc.text(formatCurrency(inv.amount), 185, 152, { align: "right" });

      // Footer
      doc.setDrawColor(226, 232, 240);
      doc.line(20, 265, 190, 265);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text("VSQC Enterprise Performance Platform · Confidential", 20, 272);
      doc.text("Page 1 of 1", 190, 272, { align: "right" });

      doc.save(`Invoice_${inv.id}.pdf`);
      showToast("Invoice downloaded successfully", "success");
    } catch (err) {
      console.error(err);
      showToast("Download failed, please try again", "danger");
    }
  };

  const filteredInvoices = visibleInvoices.filter((inv) => {
    return statusFilter === "All Status" || inv.status.toLowerCase() === statusFilter.toLowerCase();
  });

  const totalOutstanding = visibleInvoices
    .filter((i) => i.status === "outstanding")
    .reduce((s, i) => s + i.amount, 0);

  const totalInvoiced = visibleInvoices.reduce((s, i) => s + i.amount, 0);
  const totalCollected = visibleInvoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.amount, 0);
  const totalOverdue = visibleInvoices
    .filter((i) => i.status === "overdue")
    .reduce((s, i) => s + i.amount, 0);

  const formatShortAmount = formatCurrency;
  const updateMilestone = useAppStore((state) => state.updateMilestone);

  const handleMarkMilestoneAchieved = (milestoneId: string) => {
    updateMilestone(milestoneId, { status: "completed" });
  };

  return (
    <div style={{ animation: "fadeIn 0.5s ease-out" }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("Billing & Finance")}</h1>
          <p className="page-subtitle">
            {formatCurrency(totalOutstanding)} {t("outstanding")} · {visibleInvoices.length} {t("invoices")}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <ActionGuard action="export_billing_csv">
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleExportCSV}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              {t("Export CSV")}
            </button>
          </ActionGuard>
          <ActionGuard action="generate_billing_summary">
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowInvoiceModal(true)}
            >
              {t("Generate Invoice")}
            </button>
          </ActionGuard>
        </div>
      </div>

      {/* Financial KPI Scorecards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        {/* Total Invoiced */}
        <div className="kpi-card" style={{ padding: "16px", borderLeft: "4px solid var(--brand-600)" }}>
          <div style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "4px" }}>
            {t("Total Invoiced")}
          </div>
          <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)" }}>
            {formatShortAmount(totalInvoiced)}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px" }}>{t("Cumulative billed")}</div>
        </div>

        {/* Collected */}
        <div className="kpi-card" style={{ padding: "16px", borderLeft: "4px solid var(--success-600)" }}>
          <div style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "4px" }}>
            {t("Collected")}
          </div>
          <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)" }}>
            {formatShortAmount(totalCollected)}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px" }}>{t("Paid invoices")}</div>
        </div>

        {/* Outstanding */}
        <div className="kpi-card" style={{ padding: "16px", borderLeft: "4px solid var(--warning-600)" }}>
          <div style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "4px" }}>
            {t("Outstanding")}
          </div>
          <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)" }}>
            {formatShortAmount(totalOutstanding)}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px" }}>{t("Pending client payment")}</div>
        </div>

        {/* Overdue */}
        <div className="kpi-card" style={{ padding: "16px", borderLeft: "4px solid var(--danger-600)" }}>
          <div style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "4px" }}>
            {t("Overdue")}
          </div>
          <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)" }}>
            {formatShortAmount(totalOverdue)}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "4px" }}>{t("Past payment deadline")}</div>
        </div>
      </div>

      {/* Revenue & Collections Chart Card */}
      <div className="card mb-4">
        <div className="card-header" style={{ marginBottom: 0 }}>
          <span className="card-title">{t("Quarterly Revenue & Collections")}</span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => showToast("Exporting PDF Report...", "success")}
          >
            {t("PDF Report")}
          </button>
        </div>
        <div className="card-body">
          <div className="chart-container" style={{ height: "240px" }}>
            <InvoicesChart />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "24px", borderBottom: "1px solid var(--border-default)", marginBottom: "20px" }}>
        <button 
          onClick={() => setActiveTab("invoices")} 
          style={{ padding: "8px 0", borderBottom: activeTab === "invoices" ? "2px solid var(--brand-500)" : "2px solid transparent", background: "none", border: "none", cursor: "pointer", fontWeight: activeTab === "invoices" ? 600 : 400, color: activeTab === "invoices" ? "var(--brand-600)" : "var(--text-secondary)", fontSize: "14px" }}
        >
          {t("Invoices")}
        </button>
        <button 
          onClick={() => setActiveTab("milestones")} 
          style={{ padding: "8px 0", borderBottom: activeTab === "milestones" ? "2px solid var(--brand-500)" : "2px solid transparent", background: "none", border: "none", cursor: "pointer", fontWeight: activeTab === "milestones" ? 600 : 400, color: activeTab === "milestones" ? "var(--brand-600)" : "var(--text-secondary)", fontSize: "14px" }}
        >
          {t("Milestones")}
        </button>
      </div>

      {/* Invoice Register Table Card */}
      {activeTab === "invoices" && (
      <div className="card">
        <div className="card-header" style={{ marginBottom: 0 }}>
          <span className="card-title">{t("Invoice Register")}</span>
          <div>
            <select
              className="select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ fontSize: "12px", padding: "4px 8px" }}
            >
              <option value="All Status">{t("All Status")}</option>
              <option value="Outstanding">{t("Outstanding")}</option>
              <option value="Paid">{t("Paid")}</option>
              <option value="Overdue">{t("Overdue")}</option>
            </select>
          </div>
        </div>
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>{t("Invoice #")}</th>
                <th>{t("Client")}</th>
                <th>{t("Project")}</th>
                <th>{t("Amount")}</th>
                <th>{t("Issued")}</th>
                <th>{t("Due")}</th>
                <th>{t("Status")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--text-tertiary)", fontSize: "13px" }}>
                    {t("No invoices found")}
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const statusBadge = {
                    paid: "badge-success",
                    outstanding: "badge-brand",
                    overdue: "badge-danger",
                    draft: "badge-gray",
                  }[inv.status] || "badge-gray";

                  const isOverdue = inv.status === "overdue";

                  return (
                    <tr
                      key={inv.id}
                      style={{
                        background: isOverdue ? "var(--danger-50)" : undefined,
                      }}
                    >
                      <td style={{ fontWeight: 600, fontFamily: "monospace", color: "var(--text-primary)" }}>
                        {inv.id}
                      </td>
                      <td style={{ fontSize: "13px", color: "var(--text-primary)" }}>{inv.client}</td>
                      <td>
                        <span className="badge badge-brand" style={{ fontSize: "10.5px" }}>
                          {inv.project}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, fontSize: "13px", color: "var(--text-primary)" }}>
                        {formatCurrency(inv.amount)}
                      </td>
                      <td style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{inv.issued}</td>
                      <td style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{inv.due || "—"}</td>
                      <td>
                        <span className={`badge ${statusBadge}`} style={{ fontSize: "11px" }}>
                          {t(inv.status.charAt(0).toUpperCase() + inv.status.slice(1))}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn btn-ghost btn-icon btn-sm"
                          onClick={() => handleDownloadInvoice(inv)}
                          title={t("Download invoice")}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Milestones Table Card */}
      {activeTab === "milestones" && (
      <div className="card">
        <div className="card-header" style={{ marginBottom: 0 }}>
          <span className="card-title">{t("Billing Milestones")}</span>
        </div>
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>{t("Milestone ID")}</th>
                <th>{t("Project")}</th>
                <th>{t("Title")}</th>
                <th>{t("Amount")}</th>
                <th>{t("Date")}</th>
                <th>{t("Status")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleMilestones.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "var(--text-tertiary)", fontSize: "13px" }}>
                    {t("No milestones found")}
                  </td>
                </tr>
              ) : (
                visibleMilestones.map((m) => {
                  const statusBadge = {
                    completed: "badge-success",
                    upcoming: "badge-brand",
                    delayed: "badge-danger",
                    "at-risk": "badge-warning",
                  }[m.status] || "badge-gray";

                  return (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 600, fontFamily: "monospace", color: "var(--text-primary)" }}>
                        {m.id}
                      </td>
                      <td>
                        <span className="badge badge-brand" style={{ fontSize: "10.5px" }}>
                          {m.project}
                        </span>
                      </td>
                      <td style={{ fontSize: "13px", color: "var(--text-primary)" }}>{m.title}</td>
                      <td style={{ fontWeight: 700, fontSize: "13px", color: "var(--text-primary)" }}>
                        {formatCurrency(m.amount)}
                      </td>
                      <td style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{m.date || "—"}</td>
                      <td>
                        <span className={`badge ${statusBadge}`} style={{ fontSize: "11px" }}>
                          {t(m.status.charAt(0).toUpperCase() + m.status.slice(1))}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {m.status !== "completed" && (
                          <ActionGuard action="mark_milestone_achieved">
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ color: "var(--success-600)" }}
                              onClick={() => handleMarkMilestoneAchieved(m.id)}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: "4px" }}>
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                              {t("Mark Achieved")}
                            </button>
                          </ActionGuard>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Generate Invoice Modal */}
      {showInvoiceModal && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowInvoiceModal(false)}
        >
          <div
            className="modal-content"
            style={{
              background: "var(--bg-surface)",
              borderRadius: "12px",
              padding: "24px",
              width: "min(520px, 95%)",
              boxShadow: "var(--shadow-xl)",
              border: "1px solid var(--border-default)",
              animation: "slideDown 0.2s cubic-bezier(0.4,0,0.2,1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: "16px", fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>
              {t("Generate Invoice")}
            </h2>
            <form onSubmit={handleGenerateInvoice} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              
              {/* Client Name */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>
                  {t("Client Name")} <span style={{ color: "red" }}>*</span>
                </label>
                <select
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="select"
                  style={{ borderColor: errors.clientName ? "red" : undefined }}
                >
                  <option value="" disabled>{t("Select Client")}</option>
                  {Array.from(new Set(data.projects.map((p) => p.client))).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {errors.clientName && (
                  <span style={{ fontSize: "11px", color: "red" }}>{t(errors.clientName)}</span>
                )}
              </div>

              {/* Project select */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>
                  {t("Project")} <span style={{ color: "red" }}>*</span>
                </label>
                <select
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  className="select"
                  style={{ borderColor: errors.project ? "red" : undefined }}
                >
                  {data.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.id})
                    </option>
                  ))}
                </select>
                {errors.project && (
                  <span style={{ fontSize: "11px", color: "red" }}>{t(errors.project)}</span>
                )}
              </div>

              {/* Date pickers */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>
                    {t("Invoice Date")} <span style={{ color: "red" }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="input"
                    style={{ borderColor: errors.invoiceDate ? "red" : undefined }}
                  />
                  {errors.invoiceDate && (
                    <span style={{ fontSize: "11px", color: "red" }}>{t(errors.invoiceDate)}</span>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>
                    {t("Due Date")} <span style={{ color: "red" }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="input"
                    style={{ borderColor: errors.dueDate ? "red" : undefined }}
                  />
                  {errors.dueDate && (
                    <span style={{ fontSize: "11px", color: "red" }}>{t(errors.dueDate)}</span>
                  )}
                </div>
              </div>

              {/* Amount */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>
                  {t("Amount")} <span style={{ color: "red" }}>*</span>
                </label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <span style={{ position: "absolute", left: "10px", fontSize: "13px", fontWeight: 600, color: "var(--text-tertiary)" }}>
                    ₹
                  </span>
                  <input
                    type="number"
                    placeholder="200000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="input"
                    style={{ paddingLeft: "24px", width: "100%", borderColor: errors.amount ? "red" : undefined }}
                  />
                </div>
                {errors.amount && (
                  <span style={{ fontSize: "11px", color: "red" }}>{t(errors.amount)}</span>
                )}
              </div>

              {/* Notes */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>
                  {t("Notes (Optional)")}
                </label>
                <textarea
                  placeholder={t("Additional invoice notes or terms...")}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input"
                  style={{ minHeight: "60px", resize: "vertical" }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowInvoiceModal(false)}
                >
                  {t("Cancel")}
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  {t("Generate Invoice")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
