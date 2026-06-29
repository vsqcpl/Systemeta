"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, useTranslation } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";
import {
  RevenueChart,
  ProjectStatusChart,
  UtilizationChart,
  KpiSparklineChart,
} from "@/components/charts/ChartComponents";
import {
  IconBriefcase,
  IconAlert,
  IconTarget,
  IconWallet,
  IconTrendingUp,
  IconTimer,
  IconUsers,
  IconStar,
} from "@/components/ui/Icons";

import QuickAddModal from "@/components/QuickAddModal";

export default function DashboardPage() {
  const router = useRouter();
  const data = useAppStore((state) => state.data);
  const { t } = useTranslation();
  // Modal visibility state
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const showToast = useAppStore((state) => state.showToast);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const container = document.getElementById("pdf-dashboard-container");
      if (!container) throw new Error("Dashboard container not found");

      const jsPDF = (await import("jspdf")).default;
      const html2canvas = (await import("html2canvas")).default;

      // Elements to hide
      const hideActions = document.getElementById("pdf-hide-header-actions");
      if (hideActions) hideActions.style.visibility = "hidden";

      // Add temporary footer
      const footer = document.createElement("div");
      footer.id = "pdf-temp-footer";
      footer.style.display = "flex";
      footer.style.justifyContent = "space-between";
      footer.style.alignItems = "center";
      footer.style.marginTop = "32px";
      footer.style.paddingTop = "12px";
      footer.style.borderTop = "1px solid var(--border-subtle)";
      footer.style.color = "var(--text-tertiary)";
      footer.style.fontSize = "11px";
      
      const nowStr = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) || new Date().toLocaleString();
      footer.innerHTML = `
        <span>VSQC Platform — Executive Dashboard Export</span>
        <span>Generated on: ${nowStr}</span>
      `;
      container.appendChild(footer);

      const originalHeight = container.style.height;
      const originalOverflow = container.style.overflow;
      container.style.height = "max-content";
      container.style.overflow = "visible";

      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      const bgColor = isDark ? "#0f172a" : "#ffffff";

      // Generate canvas
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
            // Fix washed out / faded colors caused by CSS fadeIn animations triggering on clone
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

      // Restore elements
      container.style.height = originalHeight;
      container.style.overflow = originalOverflow;
      if (hideActions) hideActions.style.visibility = "visible";
      footer.remove();

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
      pdf.save(`VSQC_Executive_Dashboard_${dateStr}.pdf`);
      showToast("Export downloaded successfully", "success");
    } catch (err) {
      console.error(err);
      showToast("Export failed, please try again", "danger");
    } finally {
      setIsExporting(false);
    }
  };

  const handleQuickAdd = () => {
    // Open Quick Add modal
    setShowQuickAdd(true);
  };

  const currentMonth = "June 2026";


  // Top 4 consultants for utilization list
  const topConsultants = data.consultants.slice(0, 4);

  return (
    <div id="pdf-dashboard-container" style={{ animation: "fadeIn 0.5s ease-out" }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("Executive Dashboard")}</h1>
          <p className="page-subtitle">{t("Firm-wide operations performance overview")} · {t(currentMonth)}</p>
        </div>
        <div id="pdf-hide-header-actions" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={handleExportPdf}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "6px", animation: "spin 1s linear infinite" }}>
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
                  <path d="M4 12a8 8 0 0 1 8-8" />
                </svg>
                {t("Exporting...")}
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "6px" }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                {t("Export PDF")}
              </>
            )}
          </button>

          <button className="btn btn-primary btn-sm" onClick={handleQuickAdd}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "6px" }}>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {t("Quick Add")}
          </button>
        </div>
      </div>

      <QuickAddModal open={showQuickAdd} onClose={() => setShowQuickAdd(false)} />

      {/* KPI Cards Grid */}
      <div className="kpi-grid mb-4">
        {/* Card 1: Active Projects */}
        <div className="kpi-card">
          <span className="kpi-label">{t("Active Projects")}</span>
          <div className="kpi-icon"><IconBriefcase size={16} /></div>
          <span className="kpi-value">{data.kpis.activeProjects}</span>
          <div className="kpi-sparkline">
            <KpiSparklineChart sparkData={[18, 19, 21, 20, 22, data.kpis.activeProjects]} color="#2E86C1" />
          </div>
          <div className="kpi-footer">
            <span className="kpi-change positive">↑ 9.1%</span>
            <span className="kpi-trend">{t("vs last month")}</span>
          </div>
        </div>

        {/* Card 2: Delayed Tasks */}
        <div className="kpi-card">
          <span className="kpi-label">{t("Delayed Tasks")}</span>
          <div className="kpi-icon"><IconAlert size={16} /></div>
          <span className="kpi-value">{data.kpis.delayedTasks}</span>
          <div className="kpi-sparkline">
            <KpiSparklineChart sparkData={[4, 5, 8, 7, 6, data.kpis.delayedTasks]} color="#E05A5A" />
          </div>
          <div className="kpi-footer">
            <span className="kpi-change negative">↑ 14.2%</span>
            <span className="kpi-trend">{t("at risk of milestone delay")}</span>
          </div>
        </div>

        {/* Card 3: Milestones Due */}
        <div className="kpi-card">
          <span className="kpi-label">{t("Milestones Due")}</span>
          <div className="kpi-icon"><IconTarget size={16} /></div>
          <span className="kpi-value">{data.kpis.upcomingMilestones}</span>
          <div className="kpi-sparkline">
            <KpiSparklineChart sparkData={[8, 10, 9, 11, 12, data.kpis.upcomingMilestones]} color="#E09B2D" />
          </div>
          <div className="kpi-footer">
            <span className="kpi-change positive">↑ 16.6%</span>
            <span className="kpi-trend">{t("this quarter")}</span>
          </div>
        </div>

        {/* Card 4: Revenue Pipeline */}
        <div className="kpi-card">
          <span className="kpi-label">{t("Revenue Pipeline")}</span>
          <div className="kpi-icon"><IconWallet size={16} /></div>
          <span className="kpi-value">
            {formatCurrency(data.kpis.revenuePipeline)}
          </span>
          <div className="kpi-sparkline">
            <KpiSparklineChart sparkData={[3.5, 3.8, 4.0, 3.9, 4.1, data.kpis.revenuePipeline / 1000000]} color="#17A5C8" />
          </div>
          <div className="kpi-footer">
            <span className="kpi-change positive">↑ 4.3%</span>
            <span className="kpi-trend">{t("weighted probability")}</span>
          </div>
        </div>

        {/* Card 5: Team Utilization */}
        <div className="kpi-card">
          <span className="kpi-label">{t("Team Utilization")}</span>
          <div className="kpi-icon"><IconTrendingUp size={16} /></div>
          <span className="kpi-value">{data.kpis.resourceUtilization}%</span>
          <div className="kpi-sparkline">
            <KpiSparklineChart sparkData={[74, 76, 78, 75, 77, data.kpis.resourceUtilization]} color="#6C7EC7" />
          </div>
          <div className="kpi-footer">
            <span className="kpi-change positive">↑ 1.4%</span>
            <span className="kpi-trend">{t("vs 80% target limit")}</span>
          </div>
        </div>

        {/* Card 6: Billable Hours */}
        <div className="kpi-card">
          <span className="kpi-label">{t("Billable Hours")}</span>
          <div className="kpi-icon"><IconTimer size={16} /></div>
          <span className="kpi-value">{data.kpis.billableHours.toLocaleString()}</span>
          <div className="kpi-sparkline">
            <KpiSparklineChart sparkData={[1500, 1620, 1780, 1690, 1750, data.kpis.billableHours]} color="#1ABC9C" />
          </div>
          <div className="kpi-footer">
            <span className="kpi-change positive">↑ 5.2%</span>
            <span className="kpi-trend">{t("this month")}</span>
          </div>
        </div>

        {/* Card 7: Team Members */}
        <div className="kpi-card">
          <span className="kpi-label">{t("Team Members")}</span>
          <div className="kpi-icon"><IconUsers size={16} /></div>
          <span className="kpi-value">{data.kpis.teamMembers}</span>
          <div className="kpi-sparkline">
            <KpiSparklineChart sparkData={[42, 44, 45, 45, 47, data.kpis.teamMembers]} color="#6C7EC7" />
          </div>
          <div className="kpi-footer">
            <span className="kpi-change positive">↑ 2.1%</span>
            <span className="kpi-trend">{t("active consultants")}</span>
          </div>
        </div>

        {/* Card 8: Client Satisfaction */}
        <div className="kpi-card">
          <span className="kpi-label">{t("Client Satisfaction")}</span>
          <div className="kpi-icon"><IconStar size={16} /></div>
          <span className="kpi-value">{data.kpis.clientSatisfaction}%</span>
          <div className="kpi-sparkline">
            <KpiSparklineChart sparkData={[92, 93, 93, 94, 94, data.kpis.clientSatisfaction]} color="#E09B2D" />
          </div>
          <div className="kpi-footer">
            <span className="kpi-change positive">↑ 0.2%</span>
            <span className="kpi-trend">{t("NPS survey rating")}</span>
          </div>
        </div>
      </div>


      {/* Row 2: Revenue Performance & Portfolio Status Charts */}
      <div className="grid-3-2 mb-4">
        <div className="card">
          <div className="card-header">
            <span className="card-title">{t("Revenue Performance (2026)")}</span>
            <span style={{ fontSize: "11.5px", color: "var(--text-tertiary)" }}>{t("Actual vs Forecast vs Target (₹)")}</span>
          </div>
          <div className="card-body" style={{ height: "300px", position: "relative" }}>
            <RevenueChart />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">{t("Portfolio Status")}</span>
            <span className="badge badge-brand">{data.projects.length} {t("Total Projects")}</span>
          </div>
          <div className="card-body" style={{ height: "300px", position: "relative" }}>
            <ProjectStatusChart />
          </div>
        </div>
      </div>

      {/* Row 3: Team Utilization & Consultant Allocation */}
      <div id="pdf-hide-row3" className="grid-2 mb-4">
        <div className="card">
          <div className="card-header">
            <span className="card-title">{t("Weekly Team Utilization")}</span>
            <span style={{ fontSize: "11.5px", color: "var(--text-tertiary)" }}>{t("Billable hours ratio")}</span>
          </div>
          <div className="card-body" style={{ height: "300px", position: "relative" }}>
            <UtilizationChart />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">{t("Top Consultant Allocation")}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => router.push("/resources")}>
              {t("View Resources")} →
            </button>
          </div>
          <div className="card-body">
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {topConsultants.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-tertiary)", fontSize: "13px" }}>
                  {t("No consultant allocation data available")}
                </div>
              ) : (
                topConsultants.map((c) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      className="avatar avatar-lg"
                      style={{
                        background: c.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontSize: "12px",
                        fontWeight: "bold",
                      }}
                    >
                      {c.avatar}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-primary)" }}>
                          {c.name}
                        </span>
                        <span
                          style={{
                            fontSize: "12.5px",
                            fontWeight: 700,
                            color: c.utilization > 90 ? "var(--danger-600)" : c.utilization > 80 ? "var(--warning-600)" : "var(--success-600)",
                          }}
                        >
                          {c.utilization}% {t("Utilized")}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", color: "var(--text-secondary)", marginBottom: "4px" }}>
                        <span>{t(c.role)} · {t(c.dept)}</span>
                        <span>{t("Rate")}: {formatCurrency(c.billRate)}/{t("hr")}</span>
                      </div>
                      <div className="progress-bar" style={{ height: "6px" }}>
                        <div
                          className={`progress-fill ${
                            c.utilization > 90 ? "danger" : c.utilization > 80 ? "warning" : "success"
                          }`}
                          style={{ width: `${c.utilization}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: AI Insights, Upcoming Milestones */}
      <div id="pdf-hide-row4" className="grid-2" style={{ gap: "24px", alignItems: "start" }}>
          {/* AI Insights Card */}
          <div className="card">
            <div className="card-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "var(--brand-500)",
                    animation: "pulse 2s infinite",
                  }}
                ></div>
                <span className="card-title">{t("AI Insights")}</span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => router.push("/ai")}>
                {t("View All")} →
              </button>
            </div>
            <div className="card-body">
              {data.aiInsights.length === 0 ? (
                <div style={{ padding: "16px", textAlign: "center", color: "var(--text-tertiary)", fontSize: "12.5px" }}>
                  {t("No data available to compute")}
                </div>
              ) : (
                data.aiInsights.slice(0, 3).map((insight, index) => (
                  <div
                    key={index}
                    className="ai-card"
                    style={{
                      marginBottom: index === 2 ? 0 : "12px",
                      padding: "12px",
                      borderRadius: "8px",
                      background: "var(--bg-surface-2)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                      <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-primary)" }}>
                        {t(insight.title)}
                      </span>
                      <span
                        className={`badge ${
                          insight.severity === "high"
                            ? "badge-danger"
                            : insight.severity === "medium"
                            ? "badge-warning"
                            : "badge-gray"
                        }`}
                        style={{ fontSize: "9px", padding: "2px 6px" }}
                      >
                        {t(insight.severity)}
                      </span>
                    </div>
                    <p style={{ fontSize: "11.5px", color: "var(--text-secondary)", marginBottom: "8px", lineHeight: "1.4" }}>
                      {t(insight.description)}
                    </p>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: 0, fontSize: "11.5px", color: "var(--brand-500)", height: "auto" }}
                      onClick={() => router.push("/ai")}
                    >
                      {t("Action")}: {t(insight.action)} →
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Upcoming Milestones Card */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">{t("Upcoming Milestones")}</span>
              {data.milestones.filter(m => m.status === "at-risk" || m.status === "delayed").length > 0 && (
                <span className="badge badge-warning">
                  {data.milestones.filter(m => m.status === "at-risk" || m.status === "delayed").length} {t("at risk")}
                </span>
              )}
            </div>
            <div className="card-body">
              {data.milestones.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-tertiary)", fontSize: "13px" }}>
                  {t("No milestones scheduled")}
                </div>
              ) : (
                data.milestones.map((m) => {
                  const project = data.projects.find((p) => p.id === m.project);
                  const statusBadge =
                    {
                      upcoming: "badge-brand",
                      "at-risk": "badge-warning",
                      delayed: "badge-danger",
                      completed: "badge-success",
                    }[m.status] || "badge-gray";

                  return (
                    <div
                      key={m.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "11px 0",
                        borderBottom: "1px solid var(--border-subtle)",
                      }}
                    >
                      <div
                        style={{
                          width: "4px",
                          height: "44px",
                          borderRadius: "4px",
                          background:
                            m.status === "delayed"
                              ? "#ef4444"
                              : m.status === "at-risk"
                              ? "#f59e0b"
                              : m.status === "completed"
                              ? "#10b981"
                              : "var(--brand-600)",
                          flexShrink: 0,
                        }}
                      ></div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: 500,
                            color: "var(--text-primary)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {t(m.title)}
                        </div>
                        <div style={{ fontSize: "11.5px", color: "var(--text-secondary)" }}>
                          {project?.client} · {m.date}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
                          {(m.amount / 1000).toFixed(0)}K
                        </div>
                        <span className={`badge ${statusBadge}`} style={{ fontSize: "10px" }}>
                          {t(m.status.replace("-", " "))}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
  );
}
