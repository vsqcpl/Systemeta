"use client";

import React, { use, useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, useTranslation } from "@/lib/store";
import { GanttChart } from "@/components/charts/GanttChart";
import { Bot, RefreshCw } from "lucide-react";
import QuickAddModal from "@/components/QuickAddModal";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { filterProjects } from "@/lib/dataFilters";
import { ROLES } from "@/lib/roles";
import ActionGuard from "@/components/guards/ActionGuard";
import { canUseAiFeature } from "@/lib/featureFlags";
import AIPageComponent from "@/components/layout/AIPageComponent";

export default function ProjectDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { t } = useTranslation();
  const { user } = useAuth();

  const data = useAppStore((state) => state.data);
  const showToast = useAppStore((state) => state.showToast);
  const setActiveProjectId = useAppStore((state) => state.setActiveProjectId);
  const [showAddTask, setShowAddTask] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState({ title: "", date: "", amount: "", status: "upcoming" });
  const [isSavingMilestone, setIsSavingMilestone] = useState(false);
  const deleteProject = useAppStore((state) => state.deleteProject);
  const fetchInitialData = useAppStore((state) => state.fetchInitialData);
  const pageRef = useRef<HTMLDivElement>(null);
  const currencyFormat = useAppStore((state) => state.currencyFormat);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [embeddedAiView, setEmbeddedAiView] = useState<"wbs-center" | null>(null);
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

  const refreshAiInsights = useCallback(async () => {
    setIsLoadingInsights(true);
    try {
      const res = await fetch("/api/ai/insights/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (res.ok) {
        const insights = await res.json();
        useAppStore.setState((state) => ({
          data: { ...state.data, aiInsights: insights },
        }));
      }
    } catch (err) {
      console.warn("[AI Insights] Auto-refresh failed:", err);
    } finally {
      setIsLoadingInsights(false);
    }
  }, []);

  const visibleProjects = user ? filterProjects(data.projects, user) : [];
  const isClientContact = user?.role === ROLES.CLIENT_CONTACT;

  // Keep activeProjectId in sync so the sidebar link always works
  useEffect(() => {
    if (id) setActiveProjectId(id);
  }, [id, setActiveProjectId]);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'close-ai-modal') {
        setEmbeddedAiView(null);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Auto-fetch AI insights on mount if the store has none
  useEffect(() => {
    const state = useAppStore.getState();
    if (
      state.data.aiInsights.length === 0 &&
      (user?.role === ROLES.SUPER_ADMIN || user?.role === ROLES.PROJECT_MANAGER)
    ) {
      refreshAiInsights();
    }
  }, [user, refreshAiInsights]);

  useEffect(() => {
    // Only redirect to 403 if the user has visible projects AND the requested project
    // is not in their allowed list. An empty list means no data loaded yet — don't block.
    if (
      user &&
      data.projects.length > 0 &&  // data has loaded
      visibleProjects.length === 0 && // but user can't see any
      user.role !== "super_admin" && user.role !== "accounts"
    ) {
      router.replace("/403");
      return;
    }
    if (user && visibleProjects.length > 0 && !visibleProjects.some((pr) => pr.id === id)) {
      router.replace("/403");
    }
  }, [user, data.projects.length, visibleProjects, id, router]);

  const p = visibleProjects.find((x) => x.id === id) || visibleProjects[0] || data.projects[0];

  if (!p) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", animation: "fadeIn 0.5s ease-out" }}>
        <div style={{
          background: "var(--bg-surface)",
          borderRadius: "var(--radius-xl)",
          border: "1px solid var(--border-subtle)",
          padding: "48px 24px",
          maxWidth: "500px",
          margin: "0 auto",
          boxShadow: "var(--shadow-sm)"
        }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📁</div>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "8px" }}>
            No Projects Found
          </h2>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "24px", lineHeight: 1.5 }}>
            There are no active projects in your workspace. Get started by creating your first project in the Project Portfolio module.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => router.push("/projects")}>
              Go to Projects Portfolio
            </button>
          </div>
        </div>
      </div>
    );
  }

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

  const handleSwitchProject = (val: string) => {
    router.push(`/projects/${val}`);
  };

  const exportBtnStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: "6px",
    padding: "7px 14px", fontSize: "13px", fontWeight: 500,
    color: "#1e3a5f", background: "transparent",
    border: "1px solid rgba(0,0,0,0.15)", borderRadius: "7px",
    cursor: "pointer", transition: "background 150ms ease, border-color 150ms ease",
  };

  const handleExportPDF = async () => {
    setIsExportingPdf(true);
    try {
      const jsPDF = (await import("jspdf")).default;
      const html2canvas = (await import("html2canvas")).default;
      const container = pageRef.current;
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

      const safeName = p.name.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
      const dateStr = new Date().toISOString().split("T")[0];
      pdf.save(`VSQC_Project_${safeName}_${dateStr}.pdf`);
      showToast("Export downloaded successfully", "success");
    } catch (err) {
      console.error(err);
      showToast("Export failed, please try again", "danger");
    } finally {
      setIsExportingPdf(false);
    }
  };

  const projectMilestones = data.milestones.filter((m) => m.project === p.id || m.projectId === p.id);
  const paidMilestonesCount = projectMilestones.filter((m) => m.status === "upcoming").length;

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!milestoneForm.title || !milestoneForm.date || !milestoneForm.amount) return;
    setIsSavingMilestone(true);
    try {
      const res = await fetch(`/api/projects/${p.id}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(milestoneForm)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create milestone");
      }
      showToast("Milestone created successfully", "success");
      setMilestoneForm({ title: "", date: "", amount: "", status: "upcoming" });
      setShowAddMilestone(false);
      await fetchInitialData();
    } catch (err: any) {
      showToast(err.message || "Failed to save milestone", "danger");
    } finally {
      setIsSavingMilestone(false);
    }
  };

  return (
    <div ref={pageRef} style={{ animation: "fadeIn 0.5s ease-out" }}>
      {embeddedAiView ? (
        <div style={{ background: "var(--bg-surface)", minHeight: "100%", padding: "12px 0" }}>
          <AIPageComponent 
            embeddedView={embeddedAiView}
            embeddedProjectId={p.id}
            onCloseEmbedded={() => setEmbeddedAiView(null)}
          />
        </div>
      ) : (
        <>
          {/* Project Header Card */}
      <div
        style={{
          background: "var(--bg-surface)",
          borderRadius: "var(--radius-xl)",
          border: "1px solid var(--border-subtle)",
          padding: "24px",
          marginBottom: "20px",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <span className="badge badge-gray">{p.type}</span>
              <span className={`badge ${healthBadge}`}>{p.health.replace("-", " ")}</span>
              <span className="badge badge-brand">{p.id}</span>
            </div>
            <h1
              style={{
                fontSize: "20px",
                fontWeight: 800,
                color: "var(--text-primary)",
                marginBottom: "6px",
                letterSpacing: "-0.4px",
              }}
            >
              {p.name}
            </h1>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              {p.client} · Managed by <strong>{p.manager}</strong>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexShrink: 0, alignItems: "center" }}>
            <select
              className="select"
              value={p.id}
              onChange={(e) => handleSwitchProject(e.target.value)}
              style={{ minWidth: "160px" }}
            >
              {visibleProjects.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.id}: {pr.name.substring(0, 25)}...
                </option>
              ))}
            </select>
            <button
              id="project-export-pdf"
              style={exportBtnStyle}
              onClick={handleExportPDF}
              disabled={isExportingPdf}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.04)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              {isExportingPdf ? (
                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 1s linear infinite" }}><circle cx="12" cy="12" r="10" stroke="rgba(0,0,0,0.1)" strokeWidth="4"/><path d="M4 12a8 8 0 0 1 8-8"/></svg> Exporting...</>
              ) : (
                <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> {t("Export PDF")}</>
              )}
            </button>
            <ActionGuard action="configure_system">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => showToast("Project settings are editable in Admin Panel", "info")}
              >
                Settings
              </button>
            </ActionGuard>
            <ActionGuard action="delete_project">
              <button
                className="btn btn-sm"
                style={{ backgroundColor: "var(--danger-600, #dc2626)", color: "white", borderColor: "var(--danger-700, #b91c1c)" }}
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete Project
              </button>
            </ActionGuard>
            <ActionGuard action="create_edit_task">
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowAddTask(true)}
              >
                + Add Task
              </button>
            </ActionGuard>
          </div>
        </div>

        {/* Metrics Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "16px",
            marginTop: "20px",
            paddingTop: "20px",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          {/* Progress */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>
              Progress
            </div>
            <div style={{ fontSize: "22px", fontWeight: 800, color: healthColor, letterSpacing: "-0.5px", marginBottom: "6px" }}>
              {p.progress}%
            </div>
            <div className="progress-bar" style={{ height: "5px" }}>
              <div style={{ height: "100%", width: `${p.progress}%`, background: healthColor, borderRadius: "9999px" }} />
            </div>
          </div>

          {/* Budget */}
          {!isClientContact && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                Budget
              </div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "2px" }}>
                {formatCurrency(p.budget)}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                {Math.round((p.spent / p.budget) * 100)}% used
              </div>
            </div>
          )}

          {/* Timeline */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>
              Timeline
            </div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "2px" }}>
              {p.dueDate || "Not Set"}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Due Date</div>
          </div>

          {/* Team */}
          {!isClientContact && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                Team
              </div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "2px" }}>
                {p.team.length} members
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{p.team.length} assigned</div>
            </div>
          )}

          {/* Milestones */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>
              Milestones
            </div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "2px" }}>
              {projectMilestones.length}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>upcoming</div>
          </div>
        </div>
      </div>


      {/* project-specific AI WBS Builder recommendation */}
      {user && ["super_admin", "project_manager"].includes(user.role) && (
        <div style={{
          background: "linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(20, 184, 166, 0.05) 100%)",
          border: "1px solid rgba(37, 99, 235, 0.15)",
          borderRadius: "12px",
          padding: "16px",
          marginBottom: "20px",
          boxShadow: "0 4px 20px -2px rgba(37, 99, 235, 0.05)",
          backdropFilter: "blur(8px)",
          animation: "slideDown 0.3s ease-out"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "24px", height: "24px", borderRadius: "6px", background: "linear-gradient(135deg, #2563eb, #14b8a6)", color: "white" }}>
              <Bot size={14} />
            </span>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>{t("Generate Work Breakdown Structure using AI")}</span>
            <span className="badge badge-brand" style={{ fontSize: "10px", padding: "2px 6px" }}>{t("Recommended")}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0, flex: 1, minWidth: "280px", lineHeight: "1.4" }}>
              {t("Draft standard-aligned structures, analyze structural integrity, or re-sequence paths for this project.")}
            </p>
            <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
              <button 
                className="btn btn-primary btn-sm" 
                onClick={() => setEmbeddedAiView("wbs-center")}
                style={{ fontSize: "12px", padding: "6px 12px" }}
              >
                {t("Open WBS Builder")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Layout Grid */}
      <div className="grid-7-3">
        {/* Left Column (Gantt & Billing) */}
        <div>
          {/* Gantt Card */}
          <div className="card mb-4">
            <div className="card-header" style={{ marginBottom: "16px" }}>
              <span className="card-title">Project Gantt</span>
              <button className="btn btn-ghost btn-sm" onClick={() => router.push("/gantt")}>
                Full View →
              </button>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <GanttChart projectId={p.id} />
            </div>
          </div>

          {/* Billing Milestones Card */}
          <div className="card mb-4">
            <div className="card-header" style={{ marginBottom: 0 }}>
              <span className="card-title">Billing Milestones</span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="badge badge-success">{paidMilestonesCount} Upcoming</span>
                <ActionGuard action="create_edit_task">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowAddMilestone(true)}
                    style={{ fontSize: "12px", padding: "5px 10px" }}
                  >
                    + Add Milestone
                  </button>
                </ActionGuard>
              </div>
            </div>
            <div className="card-body">
              <div style={{ display: "flex", gap: 0, overflowX: "auto", paddingBottom: "4px", minHeight: "80px" }}>
                {projectMilestones.length === 0 ? (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", color: "var(--text-tertiary)", fontSize: "13px", padding: "20px" }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.4 }}><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
                    No milestones yet — click <strong style={{ color: "var(--brand-600)", margin: "0 4px" }}>+ Add Milestone</strong> to create one
                  </div>
                ) : (
                  projectMilestones.map((m, i) => {
                    const statusColor =
                      m.status === "delayed" ? "#ef4444" : m.status === "at-risk" ? "#f59e0b" : "var(--brand-600)";
                    return (
                      <div
                        key={m.id}
                        style={{
                          flex: 1,
                          minWidth: "140px",
                          textAlign: "center",
                          padding: "12px",
                          position: "relative",
                        }}
                      >
                        {i < projectMilestones.length - 1 && (
                          <div
                            style={{
                              position: "absolute",
                              top: "20px",
                              left: "50%",
                              right: "-50%",
                              height: "2px",
                              background: statusColor,
                              opacity: 0.3,
                              zIndex: 0,
                            }}
                          />
                        )}
                        <div
                          style={{
                            width: "20px",
                            height: "20px",
                            borderRadius: "50%",
                            background: statusColor,
                            margin: "0 auto 8px",
                            position: "relative",
                            zIndex: 1,
                            border: "3px solid var(--bg-surface)",
                            boxShadow: `0 0 0 2px ${statusColor}`,
                          }}
                        />
                        <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-primary)" }}>
                          {m.title.length > 18 ? `${m.title.substring(0, 18)}...` : m.title}
                        </div>
                        <div style={{ fontSize: "10px", color: "var(--text-tertiary)", margin: "2px 0" }}>{m.date}</div>
                        {!isClientContact && (
                          <div style={{ fontSize: "12px", fontWeight: 700, color: statusColor }}>
                            {formatCurrency(m.amount)}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (Team & AI Insights) */}
        <div>
          {/* Team Panel Card */}
          {!isClientContact && (
            <div className="card mb-4">
              <div className="card-header" style={{ marginBottom: 0 }}>
                <span className="card-title">Team Allocation</span>
              </div>
              <div className="card-body">
                {p.team.map((tid: string) => {
                  const c = data.consultants.find((x) => x.id === tid);
                  if (!c) return null;
                  const barColor = c.utilization > 90 ? "#ef4444" : c.utilization > 80 ? "#f59e0b" : "#10b981";
                  return (
                    <div key={tid} style={{ marginBottom: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "5px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                          <div
                            className="avatar"
                            style={{
                              background: c.color,
                              width: "26px",
                              height: "26px",
                              minWidth: "26px",
                              fontSize: "9px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "white",
                            }}
                          >
                            {c.avatar}
                          </div>
                          <div>
                            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
                              {c.name.split(" ")[0]}
                            </div>
                            <div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>{c.role}</div>
                          </div>
                        </div>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: barColor }}>{c.utilization}%</span>
                      </div>
                      <div className="progress-bar" style={{ height: "6px" }}>
                        <div
                          className="progress-fill"
                          style={{ width: `${c.utilization}%`, background: barColor }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}


        </div>
      </div>
      <QuickAddModal open={showAddTask} onClose={() => setShowAddTask(false)} />

      {/* Add Milestone Modal */}
      {showAddMilestone && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.2s ease" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddMilestone(false); }}
        >
          <div className="card" style={{ width: "100%", maxWidth: "440px", margin: "24px", padding: "24px", animation: "cardEntrance 0.3s cubic-bezier(0.175,0.885,0.32,1.275)" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "18px", display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
              Add Billing Milestone
            </h3>
            <form onSubmit={handleAddMilestone} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "5px" }}>Milestone Title *</label>
                <input
                  className="input"
                  placeholder="e.g. Phase 1 Delivery Sign-off"
                  value={milestoneForm.title}
                  onChange={(e) => setMilestoneForm(f => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "5px" }}>Target Date *</label>
                  <input
                    type="date"
                    className="input"
                    value={milestoneForm.date}
                    onChange={(e) => setMilestoneForm(f => ({ ...f, date: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "5px" }}>Billing Amount (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    placeholder="e.g. 250000"
                    value={milestoneForm.amount}
                    onChange={(e) => setMilestoneForm(f => ({ ...f, amount: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "5px" }}>Status</label>
                <select
                  className="select"
                  value={milestoneForm.status}
                  onChange={(e) => setMilestoneForm(f => ({ ...f, status: e.target.value }))}
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="at-risk">At Risk</option>
                  <option value="delayed">Delayed</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "4px" }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddMilestone(false)} disabled={isSavingMilestone}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={isSavingMilestone}>
                  {isSavingMilestone ? "Saving..." : "Save Milestone"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showDeleteConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 3000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "fadeIn 0.2s ease",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDeleteConfirm(false);
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "420px",
              margin: "24px",
              padding: "24px",
              animation: "cardEntrance 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            }}
          >
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>
              Delete Project
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px", lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>{p.name}</strong>? This action is permanent and will cascade delete all tasks, milestones, expenses, and invoices associated with this project.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger btn-sm"
                style={{ backgroundColor: "#dc2626", color: "white" }}
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  const success = await deleteProject(p.id);
                  setIsDeleting(false);
                  if (success) {
                    setShowDeleteConfirm(false);
                    router.replace("/projects");
                  }
                }}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
