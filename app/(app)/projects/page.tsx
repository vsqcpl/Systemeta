"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, useTranslation } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";
import { filterProjects } from "@/lib/dataFilters";
import ActionGuard from "@/components/guards/ActionGuard";
import { formatCurrency } from "@/lib/utils";
import { ProjectBudgetChart } from "@/components/charts/ChartComponents";
import { Project, ProjectStatus, ProjectPriority } from "@/lib/data/types";
import { FolderOpen, MoreHorizontal, FolderPlus } from "lucide-react";
import AIPageComponent from "@/components/layout/AIPageComponent";

export default function ProjectsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  
  // Zustand State & Actions
  const projects = useAppStore((state) => state.data.projects);
  const consultants = useAppStore((state) => state.data.consultants);
  const users = useAppStore((state) => state.data.users || []);
  const clients = useAppStore((state) => state.data.clients || []);
  const addProject = useAppStore((state) => state.addProject);
  const showToast = useAppStore((state) => state.showToast);
  const currencyFormat = useAppStore((state) => state.currencyFormat);

  const visibleProjects = user ? filterProjects(projects, user) : [];

  // Consolidate unique client names from projects and CRM clients (no hardcoded names)
  const clientNames = Array.from(
    new Set([
      ...projects.map((p) => p.client),
      ...clients.map((c) => c.companyName),
    ])
  ).filter(Boolean) as string[];

  // Local filter preferences (prevents recursive renders/input focus loss -> Bug #11 Fix)
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [embeddedAiView, setEmbeddedAiView] = useState<"wbs-center" | null>(null);
  const [embeddedAiProjId, setEmbeddedAiProjId] = useState<string | null>(null);
  const setSidebarCollapsed = useAppStore((state) => state.setSidebarCollapsed);
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);
  const [prevSidebarState, setPrevSidebarState] = useState<boolean | null>(null);

  useEffect(() => {
    if (embeddedAiView) {
      if (prevSidebarState === null) {
        setPrevSidebarState(sidebarCollapsed);
      }
      setSidebarCollapsed(true);
      document.body.style.overflow = "hidden";
    } else if (embeddedAiView === null && prevSidebarState !== null) {
      setSidebarCollapsed(prevSidebarState);
      setPrevSidebarState(null);
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [embeddedAiView, setSidebarCollapsed, sidebarCollapsed, prevSidebarState]);

  const [filterType, setFilterType] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [showModal, setShowModal] = useState(false);

  // New Project Form state
  const [npName, setNpName] = useState("");
  const [npClient, setNpClient] = useState("");
  const [npType, setNpType] = useState("Transformation");
  const [npBudget, setNpBudget] = useState("");
  const [npDue, setNpDue] = useState("");
  const [npManager, setNpManager] = useState("Super Admin");
  const [npPriority, setNpPriority] = useState<ProjectPriority>("medium");

  useEffect(() => {
    if (clientNames.length > 0 && !npClient) {
      setNpClient(clientNames[0]);
    }
  }, [clientNames, npClient]);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'close-ai-modal') {
        setEmbeddedAiView(null);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const projectTypes = Array.from(new Set(visibleProjects.map((p) => p.type)));
  const managerNames = Array.from(
    new Set([
      "Super Admin",
      ...consultants.map((c) => c.name)
    ])
  );

  // Filter project logic
  const filteredProjects = visibleProjects.filter((p) => {
    const statusMatch = filterStatus === "all" || p.status === filterStatus;
    const typeMatch = filterType === "all" || p.type === filterType;
    
    const q = searchQuery.toLowerCase().trim();
    const searchMatch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.client.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      p.manager.toLowerCase().includes(q);

    return statusMatch && typeMatch && searchMatch;
  });

  // KPI summary statistics
  const totalBudget = filteredProjects.reduce((sum, p) => sum + p.budget, 0);
  const spent = filteredProjects.reduce((sum, p) => sum + p.spent, 0);
  const avgProgress = filteredProjects.length
    ? Math.round(filteredProjects.reduce((sum, p) => sum + p.progress, 0) / filteredProjects.length)
    : 0;
  const atRiskCount = filteredProjects.filter(
    (p) => p.health === "at-risk" || p.health === "delayed"
  ).length;

  const totalBudgetStr = formatCurrency(totalBudget);
  const spentStr = formatCurrency(spent);
  const avgProgressStr = `${avgProgress}%`;
  const atRiskStr = `${atRiskCount} ${t(atRiskCount !== 1 ? "projects" : "project")}`;

  // Mini stat renderer
  const renderMiniStat = (label: string, value: string, color: string) => (
    <div className="card" style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: "4px" }}>
      <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {t(label)}
      </span>
      <span className="quick-num" style={{ color }}>
        {value}
      </span>
    </div>
  );

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!npName || !npClient || !npBudget || !npDue) return;

    addProject({
      name: npName,
      client: npClient,
      type: npType,
      budget: parseFloat(npBudget),
      dueDate: npDue,
      manager: npManager,
      priority: npPriority,
      status: "active",
    });

    // Reset state & close modal
    setNpName("");
    setNpClient(clientNames[0] || "");
    setNpType("Transformation");
    setNpBudget("");
    setNpDue("");
    setNpManager("Super Admin");
    setNpPriority("medium");
    setShowModal(false);
  };

  const handleRowClick = (id: string) => {
    router.push(`/projects/${id}`);
  };

  // Download icon SVG (inline, reused by both buttons)
  const DownloadIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );

  const exportBtnStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "7px 14px",
    fontSize: "13px",
    fontWeight: 500,
    color: "#1e3a5f",
    background: "transparent",
    border: "1px solid rgba(0,0,0,0.15)",
    borderRadius: "7px",
    cursor: "pointer",
    transition: "background 150ms ease, border-color 150ms ease",
  };

  const handleExportCSV = () => {
    if (filteredProjects.length === 0) {
      showToast("No data to export", "warning");
      return;
    }
    const dateStr = new Date().toISOString().split("T")[0];
    const headers = ["Project Name", "Client", "Type", "Status", "Progress %", "Budget Used %", "Total Budget", "Due Date", "Manager", "Team Size"];
    const rows = filteredProjects.map((p) => [
      `"${p.name}"`,
      `"${p.client}"`,
      `"${p.type}"`,
      `"${p.status}"`,
      p.progress,
      Math.round((p.spent / p.budget) * 100),
      `"${formatCurrency(p.budget)}"`,
      p.dueDate,
      `"${p.manager}"`,
      p.team.length,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `VSQC_Portfolio_${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Export downloaded successfully", "success");
  };

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const portfolioRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = async () => {
    setIsExportingPdf(true);
    try {
      const jsPDF = (await import("jspdf")).default;
      const html2canvas = (await import("html2canvas")).default;
      const container = portfolioRef.current;
      if (!container) throw new Error("Container not found");

      const originalHeight = container.style.height;
      const originalOverflow = container.style.overflow;
      container.style.height = "max-content";
      container.style.overflow = "visible";

      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      const bgColor = isDark ? "#0f172a" : "#ffffff";

      const canvas = await html2canvas(container, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: bgColor,
        logging: false,
        windowWidth: container.scrollWidth,
        windowHeight: container.scrollHeight,
        onclone: (clonedDoc, clonedElement) => {
          const theme = document.documentElement.getAttribute("data-theme");
          if (theme) {
            clonedDoc.documentElement.setAttribute("data-theme", theme);
          }
          clonedDoc.body.className = document.body.className;

          if (clonedElement) {
            clonedElement.style.animation = "none";
            clonedElement.style.opacity = "1";
            clonedElement.style.transform = "none";
            
            const allEls = clonedElement.querySelectorAll("*");
            allEls.forEach((el: any) => {
              el.style.animation = "none";
              el.style.transition = "none";
            });

            clonedElement.style.height = "max-content";
            clonedElement.style.maxHeight = "none";
            clonedElement.style.overflow = "visible";

            const scrollContainers = clonedElement.querySelectorAll(".table-wrapper, .table-container, [style*='overflow']");
            scrollContainers.forEach((el: any) => {
              el.style.height = "max-content";
              el.style.maxHeight = "none";
              el.style.overflow = "visible";
            });
          }
        }
      });

      container.style.height = originalHeight;
      container.style.overflow = originalOverflow;

      const imgData = canvas.toDataURL("image/jpeg", 1.0);
      
      const pdf = new jsPDF({
        orientation: "p",
        unit: "pt",
        format: "a4"
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const ratio = canvas.width / canvas.height;
      const scaledHeight = pdfWidth / ratio;

      let heightLeft = scaledHeight;
      let position = 0;

      pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, scaledHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position -= pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, scaledHeight);
        heightLeft -= pdfHeight;
      }

      const dateStr = new Date().toISOString().split("T")[0];
      pdf.save(`VSQC_Portfolio_${dateStr}.pdf`);
      showToast("Export downloaded successfully", "success");
    } catch (err) {
      console.error(err);
      showToast("Export failed, please try again", "danger");
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div ref={portfolioRef}>
    <div style={{ animation: "fadeIn 0.5s ease-out" }}>
      {embeddedAiView ? (
        <div style={{ background: "var(--bg-surface)", minHeight: "100%", padding: "12px 0" }}>
          <AIPageComponent 
            embeddedView={embeddedAiView}
            embeddedProjectId={embeddedAiProjId}
            onCloseEmbedded={() => setEmbeddedAiView(null)}
          />
        </div>
      ) : (
        <>
          {/* Header */}
      <div className="page-header" style={{ flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 className="page-title">
            {user?.role === "client_contact" ? t("Client Portal") : t("Project Portfolio")}
          </h1>
          <p className="page-subtitle">
            {filteredProjects.length} {t("of")} {visibleProjects.length} {t("projects")} · {totalBudgetStr} {t("total budget")}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <button
            id="portfolio-export-csv"
            style={exportBtnStyle}
            onClick={handleExportCSV}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.04)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,0,0,0.25)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,0,0,0.15)"; }}
          >
            <DownloadIcon /> {t("Export CSV")}
          </button>
          <button
            id="portfolio-export-pdf"
            style={exportBtnStyle}
            onClick={handleExportPDF}
            disabled={isExportingPdf}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.04)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,0,0,0.25)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,0,0,0.15)"; }}
          >
            {isExportingPdf ? (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 1s linear infinite" }}><circle cx="12" cy="12" r="10" stroke="rgba(0,0,0,0.1)" strokeWidth="4" /><path d="M4 12a8 8 0 0 1 8-8" /></svg> {t("Exporting...")}</>
            ) : (
              <><DownloadIcon /> {t("Export PDF")}</>
            )}
          </button>
          {/* Search bar input - local state binding resolves Bug #11 */}
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-tertiary)"
              strokeWidth="2.5"
              style={{ position: "absolute", left: "10px", pointerEvents: "none" }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              id="portfolio-search"
              type="text"
              placeholder={t("Search projects...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: "7px 12px 7px 32px",
                border: "1px solid var(--border-subtle)",
                borderRadius: "8px",
                backgroundColor: "var(--bg-surface)",
                color: "var(--text-primary)",
                fontSize: "13px",
                width: "200px",
                outline: "none",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                title={t("Clear search")}
                style={{
                  position: "absolute",
                  right: "8px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-tertiary)",
                  padding: "2px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Cards/Table tabs */}
          <div className="tabs">
            <button className={`tab ${viewMode === "cards" ? "active" : ""}`} onClick={() => setViewMode("cards")}>
              {t("Cards")}
            </button>
            <button className={`tab ${viewMode === "table" ? "active" : ""}`} onClick={() => setViewMode("table")}>
              {t("Table")}
            </button>
          </div>

          {/* Filter selectors */}
          <select
            className="select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: "8px", fontSize: "13px" }}
          >
            <option value="all">{t("All Status")}</option>
            <option value="active">{t("Active")}</option>
            <option value="planning">{t("Planning")}</option>
            <option value="completed">{t("Completed")}</option>
          </select>

          <select
            className="select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: "8px", fontSize: "13px" }}
          >
            <option value="all">{t("All Types")}</option>
            {projectTypes.map((tVal) => (
              <option key={tVal} value={tVal}>
                {t(tVal)}
              </option>
            ))}
          </select>

          <ActionGuard action="create_project">
            <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "4px" }}>
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {t("New Project")}
            </button>
          </ActionGuard>
        </div>
      </div>

      {/* Stats summary row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
        {renderMiniStat("Total Budget", totalBudgetStr, "#2E86C1")}
        {renderMiniStat("Spent to Date", spentStr, "#2E86C1")}
        {renderMiniStat("Avg. Progress", avgProgressStr, "var(--text-primary)")}
        {renderMiniStat("At Risk", atRiskStr, "#E24B4A")}
      </div>

      {/* AI WBS Builder Recommendation Widget */}
      {user && ["super_admin", "project_manager"].includes(user.role) && (
        <div style={{
          background: "linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(20, 184, 166, 0.05) 100%)",
          border: "1px solid rgba(37, 99, 235, 0.15)",
          borderRadius: "12px",
          padding: "16px",
          marginBottom: "24px",
          boxShadow: "0 4px 20px -2px rgba(37, 99, 235, 0.05)",
          backdropFilter: "blur(8px)",
          animation: "slideDown 0.3s ease-out"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "24px", height: "24px", borderRadius: "6px", background: "linear-gradient(135deg, #2563eb, #14b8a6)", color: "white" }}>
              <FolderPlus size={14} />
            </span>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>{t("Generate Work Breakdown Structure using AI")}</span>
            <span className="badge badge-brand" style={{ fontSize: "10px", padding: "2px 6px" }}>{t("Recommended")}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0, flex: 1, minWidth: "280px", lineHeight: "1.4" }}>
              {t("Create a clean, standards-aligned WBS structure, optimize dependencies, and re-sequence paths instantly using planning models.")}
            </p>
            <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
              <button 
                className="btn btn-primary btn-sm" 
                onClick={() => setEmbeddedAiView("wbs-center")}
                style={{ fontSize: "12px", padding: "6px 12px" }}
              >
                {t("Open AI WBS Builder")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project content */}
      {filteredProjects.length === 0 ? (
        <div className="card" style={{ padding: "48px", textAlign: "center" }}>
          <div style={{ marginBottom: "12px", display: "flex", justifyContent: "center", color: "var(--text-tertiary)" }}>
            <FolderOpen size={40} strokeWidth={1.5} />
          </div>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>
            {t("No projects found")}
          </div>
          <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            {t("Try adjusting your filters or create a new project.")}
          </div>
        </div>
      ) : viewMode === "cards" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {filteredProjects.map((p) => {
            const healthColor = (({
              "on-track": "#10b981",
              "at-risk": "#f59e0b",
              "delayed": "#ef4444",
            } as Record<string, string>)[p.health]) || "#64748b";
            const healthBadge = (({
              "on-track": "badge-success",
              "at-risk": "badge-warning",
              "delayed": "badge-danger",
            } as Record<string, string>)[p.health]) || "badge-gray";
            const spentPct = Math.round((p.spent / p.budget) * 100);

            return (
              <div
                key={p.id}
                className="card"
                style={{ cursor: "pointer", transition: "all 0.2s" }}
                onClick={() => handleRowClick(p.id)}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-3px)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
              >
                <div style={{ padding: "18px 18px 0" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "10px" }}>
                    <div>
                      <span className="badge badge-gray" style={{ fontSize: "10px", marginBottom: "6px" }}>
                        {t(p.type)}
                      </span>
                      {/* Fixed name truncation bug to support full name auto wrapping/ellipsis inside UI card -> Bug #6 Fix */}
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: 700,
                          color: "var(--text-primary)",
                          lineHeight: 1.3,
                          textOverflow: "ellipsis",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                          maxWidth: "180px",
                        }}
                        title={p.name}
                      >
                        {p.name}
                      </div>
                    </div>
                    <span className={`badge ${healthBadge}`}>{t(p.health === "on-track" ? "On Track" : p.health === "at-risk" ? "At Risk" : "Delayed")}</span>
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "14px" }}>
                    {p.client}
                  </div>
                </div>
                <div style={{ padding: "0 18px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{t("Progress")}</span>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>{p.progress}%</span>
                  </div>
                  <div className="progress-bar" style={{ height: "7px", marginBottom: "14px" }}>
                    <div
                      className={`progress-fill ${p.progress >= 75 ? "success" : ""}`}
                      style={{ width: `${p.progress}%`, backgroundColor: healthColor }}
                    ></div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div>
                      <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{t("Budget Used")}</div>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{spentPct}%</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{t("Due")}</div>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{p.dueDate.slice(0, 7)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{t("Manager")}</div>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>{p.manager.split(" ")[0]}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div className="avatar-group">
                      {p.team.map((t: string) => {
                        const c = consultants.find((x) => x.id === t);
                        return c ? (
                          <div
                            key={c.id}
                            className="avatar"
                            style={{
                              backgroundColor: c.color,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "white",
                            }}
                            title={c.name}
                          >
                            {c.avatar}
                          </div>
                        ) : null;
                      })}
                    </div>
                    <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{p.team.length} {t("members")}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>{t("Project")}</th>
                <th>{t("Client")}</th>
                <th>{t("Status")}</th>
                <th>{t("Health")}</th>
                <th>{t("Progress")}</th>
                <th>{t("Budget")}</th>
                <th>{t("Due Date")}</th>
                <th>{t("Manager")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((p) => {
                const healthBadge = (({
                  "on-track": "badge-success",
                  "at-risk": "badge-warning",
                  "delayed": "badge-danger",
                } as Record<string, string>)[p.health]) || "badge-gray";
                const statusBadge = (({
                  active: "badge-brand",
                  planning: "badge-gray",
                  completed: "badge-success",
                } as Record<string, string>)[p.status]) || "badge-gray";

                return (
                  <tr key={p.id} onClick={() => handleRowClick(p.id)} style={{ cursor: "pointer" }}>
                    <td>
                      {/* Fixed name truncation bug using CSS ellipsis instead of hard substring -> Bug #6 Fix */}
                      <div
                        style={{
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          textOverflow: "ellipsis",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                          maxWidth: "240px",
                        }}
                        title={p.name}
                      >
                        {p.name}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                        {p.id} · {p.type}
                      </div>
                    </td>
                    <td style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{p.client}</td>
                    <td>
                      <span className={`badge ${statusBadge}`}>{t(p.status.charAt(0).toUpperCase() + p.status.slice(1))}</span>
                    </td>
                    <td>
                      <span className={`badge ${healthBadge}`}>{t(p.health === "on-track" ? "On Track" : p.health === "at-risk" ? "At Risk" : "Delayed")}</span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div className="progress-bar" style={{ width: "80px" }}>
                          <div className="progress-fill" style={{ width: `${p.progress}%` }}></div>
                        </div>
                        <span style={{ fontSize: "12px", fontWeight: 600 }}>{p.progress}%</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: "13px", fontWeight: 600 }}>
                        {formatCurrency(p.budget)}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                        {Math.round((p.spent / p.budget) * 100)}% {t("used")}
                      </div>
                    </td>
                    <td style={{ fontSize: "12.5px" }}>{p.dueDate}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {(() => {
                          const c = consultants.find((x) => x.name === p.manager);
                          return c ? (
                            <div
                              className="avatar"
                              style={{
                                backgroundColor: c.color,
                                width: "24px",
                                height: "24px",
                                minWidth: "24px",
                                fontSize: "9px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "white",
                              }}
                            >
                              {c.avatar}
                            </div>
                          ) : null;
                        })()}
                        <span style={{ fontSize: "12.5px" }}>{p.manager.split(" ")[0]}</span>
                      </div>
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm btn-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          showToast("Actions panel coming soon", "info");
                        }}
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Horizontal bar budget consumption chart */}
      <div className="card mt-4">
        <div className="card-header">
          <span className="card-title">{t("Budget Consumption by Project")}</span>
          <span className="badge badge-gray">{t("Top 5")}</span>
        </div>
        <div className="card-body">
          <div className="chart-container" style={{ height: "200px", position: "relative" }}>
            <ProjectBudgetChart customProjects={filteredProjects} />
          </div>
        </div>
      </div>

      {/* Modal - New Project Form */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "fadeIn 0.2s ease",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "560px",
              margin: "24px",
              maxHeight: "85vh",
              overflowY: "auto",
              animation: "cardEntrance 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            }}
          >
            <div className="card-header" style={{ padding: "20px 24px" }}>
              <span className="card-title" style={{ fontSize: "18px" }}>
                {t("Create New Project")}
              </span>
              <button
                className="topbar-btn"
                onClick={() => setShowModal(false)}
                style={{ width: "32px", height: "32px", minWidth: "32px", borderRadius: "8px" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="card-body" style={{ padding: "20px 24px" }}>
              <form onSubmit={handleCreateProject} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="login-field">
                  <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                    {t("Project Name")}
                  </label>
                  <input
                    className="login-input"
                    type="text"
                    placeholder={t("e.g. Digital Transformation – Client")}
                    value={npName}
                    onChange={(e) => setNpName(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      {t("Client")}
                    </label>
                    {clientNames.length > 0 ? (
                      <select
                        className="login-input"
                        value={npClient}
                        onChange={(e) => setNpClient(e.target.value)}
                        required
                      >
                        <option value="">{t("-- Select Client --")}</option>
                        {clientNames.map((cName) => (
                          <option key={cName} value={cName}>
                            {cName}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="login-input"
                        type="text"
                        placeholder={t("e.g. Acme Corp")}
                        value={npClient}
                        onChange={(e) => setNpClient(e.target.value)}
                        required
                      />
                    )}
                  </div>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      {t("Type")}
                    </label>
                    <select
                      className="login-input"
                      value={npType}
                      onChange={(e) => setNpType(e.target.value)}
                      required
                    >
                      {projectTypes.map((typeVal) => (
                        <option key={typeVal} value={typeVal}>
                          {t(typeVal)}
                        </option>
                      ))}
                      <option value="Other">{t("Other")}</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      {t("Budget")}
                    </label>
                    <input
                      className="login-input"
                      type="number"
                      placeholder="500000"
                      value={npBudget}
                      onChange={(e) => setNpBudget(e.target.value)}
                      required
                    />
                  </div>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      {t("Due Date")}
                    </label>
                    <input
                      className="login-input"
                      type="date"
                      value={npDue}
                      onChange={(e) => setNpDue(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      {t("Manager")}
                    </label>
                    <select
                      className="login-input"
                      value={npManager}
                      onChange={(e) => setNpManager(e.target.value)}
                      required
                    >
                      {managerNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      {t("Priority")}
                    </label>
                    <select
                      className="login-input"
                      value={npPriority}
                      onChange={(e) => setNpPriority(e.target.value as ProjectPriority)}
                      required
                    >
                      <option value="low">{t("Low")}</option>
                      <option value="medium">{t("Medium")}</option>
                      <option value="high">{t("High")}</option>
                      <option value="critical">{t("Critical")}</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "8px" }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{
                      background: "var(--bg-surface-2)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border-default)",
                    }}
                    onClick={() => setShowModal(false)}
                  >
                    {t("Cancel")}
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" style={{ padding: "10px 28px" }}>
                    {t("Create Project")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
    </div>
  );
}
