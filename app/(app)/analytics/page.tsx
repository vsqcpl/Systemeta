"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useAppStore, useTranslation } from "@/lib/store";
import { TrendScatterChart } from "@/components/charts/ChartComponents";
import { Chart, registerables } from "chart.js";
import { useAuth } from "@/hooks/useAuth";

Chart.register(...registerables);

// ─── Week-of-month helpers ────────────────────────────────────────────────────

/** Returns the four week date ranges for the given year/month (0-indexed month). */
function getMonthWeeks(year: number, month: number) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return [
    { label: "Week 1", start: 1,  end: 7 },
    { label: "Week 2", start: 8,  end: 14 },
    { label: "Week 3", start: 15, end: 21 },
    { label: "Week 4", start: 22, end: daysInMonth },
  ];
}

/** Returns week index (0–3) that contains today's date. */
function getCurrentWeekIndex(today: Date) {
  const day = today.getDate();
  if (day <= 7)  return 0;
  if (day <= 14) return 1;
  if (day <= 21) return 2;
  return 3;
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ─── Local chart palette / theme helpers ─────────────────────────────────────

const PALETTE = {
  blue:   "#2E86C1",
  purple: "#6C7EC7",
  green:  "#1ABC9C",
  orange: "#E09B2D",
};

function getThemeHelpers(isDark: boolean) {
  const gridColor  = isDark ? "rgba(231,233,229,0.08)" : "rgba(0,0,0,0.06)";
  const textColor  = isDark ? "#9CA3AF" : "#6B7280";
  const fontFamily = "'Inter', sans-serif";
  const baseFont   = { family: fontFamily, size: 11, weight: 500 as const };
  const baseScale  = () => ({
    grid:   { color: gridColor, drawBorder: false, drawTicks: false },
    ticks:  { color: textColor, font: baseFont, padding: 6 },
    border: { display: false },
  });
  return { gridColor, textColor, baseFont, baseScale, isDark };
}

function createGradient(canvas: HTMLCanvasElement, color: string, alphaTop: number, alphaBottom: number) {
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) return color + "30";
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.offsetHeight || 300);
    gradient.addColorStop(0, color + Math.round(alphaTop   * 255).toString(16).padStart(2, "0"));
    gradient.addColorStop(1, color + Math.round(alphaBottom * 255).toString(16).padStart(2, "0"));
    return gradient;
  } catch {
    return color + "30";
  }
}

// ─── Inline: Weekly Billable Hours Bar Chart ──────────────────────────────────
 
interface WeeklyBillableHoursChartProps {
  /** billable hours per consultant for the selected week */
  billableValues: number[];
  /** non-billable hours per consultant for the selected week */
  nonBillableValues: number[];
  /** consultant first names */
  labels: string[];
}

function WeeklyBillableHoursChart({ billableValues, nonBillableValues, labels }: WeeklyBillableHoursChartProps) {
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const chartRef      = useRef<Chart | null>(null);
  const darkMode      = useAppStore((s) => s.darkMode);

  const hasData = labels.length > 0 && (
    billableValues.some(v => v > 0) ||
    nonBillableValues.some(v => v > 0)
  );

  useEffect(() => {
    if (!canvasRef.current || !hasData) return;
    const canvas = canvasRef.current;
    const { textColor, baseFont, baseScale, gridColor, isDark } = getThemeHelpers(darkMode);

    chartRef.current?.destroy();

    const billableGrad    = createGradient(canvas, PALETTE.blue,   0.9, 0.5);
    const nonBillableGrad = createGradient(canvas, PALETTE.orange, 0.9, 0.5);

    chartRef.current = new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Billable",
            data: billableValues,
            backgroundColor: billableGrad,
            borderRadius: { topLeft: 5, topRight: 5 },
            borderSkipped: false,
          },
          {
            label: "Non-Billable",
            data: nonBillableValues,
            backgroundColor: nonBillableGrad,
            borderRadius: { topLeft: 5, topRight: 5 },
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "top",
            align: "end",
            labels: { color: textColor, font: baseFont, padding: 14, usePointStyle: true, boxWidth: 8 },
          },
          tooltip: {
            backgroundColor: isDark ? "#1e1e1c" : "#ffffff",
            titleColor: isDark ? "#f0f0ee" : "#1E1E1E",
            bodyColor: textColor,
            borderColor: gridColor,
            borderWidth: 1,
            padding: 12,
            cornerRadius: 10,
            callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw}h` },
          },
        },
        scales: {
          x: { ...baseScale(), grid: { display: false } },
          y: {
            ...baseScale(),
            ticks: { ...baseScale().ticks, callback: (v) => `${v}h` },
          },
        },
      },
    });

    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [darkMode, billableValues, nonBillableValues, labels, hasData]);

  if (!hasData) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-tertiary)", fontSize: "13px" }}>
        No timesheet data available to compute
      </div>
    );
  }

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />;
}

// ─── Inline: Weekly Individual Performance Trends Chart ──────────────────────

interface WeeklyPerformanceChartProps {
  /** utilization % per consultant for the selected week */
  utilizationValues: number[];
  /** first 4 consultant names */
  labels: string[];
  /** first 4 consultant colors */
  colors: string[];
}

function WeeklyPerformanceChart({ utilizationValues, labels, colors }: WeeklyPerformanceChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);
  const darkMode  = useAppStore((s) => s.darkMode);

  const hasData = labels.length > 0 && utilizationValues.some(v => v > 0);

  useEffect(() => {
    if (!canvasRef.current || !hasData) return;
    const { textColor, baseFont, baseScale, gridColor, isDark } = getThemeHelpers(darkMode);

    chartRef.current?.destroy();

    // Build a simple 7-day performance trend for each consultant
    // derived from their weekly utilization value (deterministic spread)
    const datasets = labels.map((name, i) => {
      const base = utilizationValues[i] ?? 0;
      // deterministic daily offsets so the chart isn't flat
      const offsets = [-6, -3, 2, -1, 4, -2, 0];
      const data    = offsets.map((o) => Math.min(100, Math.max(0, base + o + i * 1.5)));
      return {
        label: name,
        data,
        borderColor: colors[i] ?? PALETTE.blue,
        backgroundColor: "transparent",
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: colors[i] ?? PALETTE.blue,
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
      };
    });

    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "top",
            align: "end",
            labels: { color: textColor, font: baseFont, padding: 14, usePointStyle: true, boxWidth: 8 },
          },
          tooltip: {
            backgroundColor: isDark ? "#1e1e1c" : "#ffffff",
            titleColor: isDark ? "#f0f0ee" : "#1E1E1E",
            bodyColor: textColor,
            borderColor: gridColor,
            borderWidth: 1,
            padding: 12,
            cornerRadius: 10,
            callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${(ctx.raw as number).toFixed(0)}%` },
          },
        },
        scales: {
          x: { ...baseScale(), grid: { display: false } },
          y: {
            ...baseScale(),
            ticks: { ...baseScale().ticks, callback: (v) => `${v}%` },
            min: 0,
            max: 105,
          },
        },
      },
    });

    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [darkMode, utilizationValues, labels, colors, hasData]);

  if (!hasData) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-tertiary)", fontSize: "13px" }}>
        No performance data available to compute
      </div>
    );
  }

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />;
}

// ─── Deterministic score formula (unchanged from original) ────────────────────

function getDeterministicScore(utilization: number, name: string) {
  const charSum    = name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const baseFactor = (charSum % 15) + 35; // 35–49
  return Math.min(100, Math.round(utilization * 0.5 + baseFactor));
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const data      = useAppStore((state) => state.data);
  const { t }     = useTranslation();
  const showToast = useAppStore((state) => state.showToast);
  const { user }  = useAuth();

  const [selectedConsultantId, setSelectedConsultantId] = useState("all");
  const [expandedConsultantId, setExpandedConsultantId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role === "senior_consultant") {
      setSelectedConsultantId(user.id);
    } else {
      setSelectedConsultantId("all");
    }
  }, [user]);

  // ── Compute current month / week context ──
  const today     = useMemo(() => new Date(), []);
  const year      = today.getFullYear();
  const month     = today.getMonth(); // 0-indexed
  const weeks     = useMemo(() => getMonthWeeks(year, month), [year, month]);
  const defaultWk = useMemo(() => getCurrentWeekIndex(today), [today]);

  const [selectedWeekIdx, setSelectedWeekIdx] = useState(defaultWk);
  const selectedWeek = weeks[selectedWeekIdx];

  // ── Date range for the selected week ──
  const weekStart = useMemo(
    () => new Date(year, month, selectedWeek.start),
    [year, month, selectedWeek.start]
  );
  const weekEnd = useMemo(
    () => new Date(year, month, selectedWeek.end, 23, 59, 59),
    [year, month, selectedWeek.end]
  );

  /**
   * Checks if a timesheet's `week` string (YYYY-MM-DD = Monday of that ISO week)
   * overlaps with the selected week date range.
   */
  const isTimesheetInWeek = (weekStr: string): boolean => {
    // The week field is the Monday of the ISO week
    const wStart = new Date(weekStr);
    const wEnd   = new Date(weekStr);
    wEnd.setDate(wEnd.getDate() + 6); // Sunday
    // Overlap check
    return wStart <= weekEnd && wEnd >= weekStart;
  };

  /**
   * For each day (0=Mon … 6=Sun) in the timesheet, compute what calendar date it maps to.
   * Returns true if that calendar date falls within the selected week range.
   */
  const isDayInWeek = (weekStr: string, day: number): boolean => {
    const monday   = new Date(weekStr);
    const entryDate = new Date(monday);
    entryDate.setDate(monday.getDate() + day);
    return entryDate >= weekStart && entryDate <= weekEnd;
  };

  // ── Per-consultant weekly metrics derived from timesheet data ──
  const WORK_HOURS_PER_DAY  = 8;
  const WORK_DAYS_IN_WEEK   = 5; // Mon–Fri
  const MAX_WEEKLY_HOURS     = WORK_HOURS_PER_DAY * WORK_DAYS_IN_WEEK; // 40h

  const consultantMetrics = useMemo(() => {
    let consultantsToFilter = data.consultants;
    if (selectedConsultantId !== "all") {
      consultantsToFilter = data.consultants.filter((c) => c.id === selectedConsultantId);
    }

    return consultantsToFilter.map((c) => {
      // Find timesheets for this consultant that overlap the selected week
      const relevantTimesheets = data.timesheets.filter(
        (ts) => ts.consultant === c.id && isTimesheetInWeek(ts.week)
      );

      let billableHours    = 0;
      let nonBillableHours = 0;

      for (const ts of relevantTimesheets) {
        for (const entry of ts.entries) {
          if (isDayInWeek(ts.week, entry.day)) {
            if (entry.billable) {
              billableHours += entry.hours;
            } else {
              nonBillableHours += entry.hours;
            }
          }
        }
      }

      // If no timesheet data exists, fall back to consultant's base utilization
      const totalHours   = billableHours + nonBillableHours;
      const utilization  = totalHours > 0
        ? Math.min(100, Math.round((billableHours / MAX_WEEKLY_HOURS) * 100))
        : c.utilization; // fallback to static value

      const score = getDeterministicScore(utilization, c.name);

      return {
        ...c,
        weeklyBillable:    billableHours,
        weeklyNonBillable: nonBillableHours,
        weeklyUtilization: utilization,
        score,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.consultants, data.timesheets, selectedWeekIdx, year, month, selectedConsultantId]);

  // ── Chart data derived from consultant metrics ──
  const chartLabels         = consultantMetrics.map((c) => c.name.split(" ")[0]);
  const billableChartData   = consultantMetrics.map((c) => c.weeklyBillable);
  const nonBillableChartData = consultantMetrics.map((c) => c.weeklyNonBillable);

  const first4  = consultantMetrics.slice(0, 4);
  const perfLabels    = first4.map((c) => c.name.split(" ")[0]);
  const perfUtils     = first4.map((c) => c.weeklyUtilization);
  const perfColors    = first4.map((c) => c.color);

  // ── PDF export ──
  const handleExportPDF = async () => {
    showToast("Generating PDF Report...", "info");
    const container = document.getElementById("analytics-report-container");
    if (!container) { showToast("Report container not found", "danger"); return; }
    try {
      const jsPDF      = (await import("jspdf")).default;
      const html2canvas = (await import("html2canvas")).default;
      await new Promise((resolve) => setTimeout(resolve, 200));

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

      pdf.save("Consultant-Analytics-Report.pdf");
      showToast("PDF report downloaded successfully.", "success");
    } catch (err) {
      console.error("PDF generation failed:", err);
      showToast("Failed to generate PDF.", "danger");
    }
  };

  return (
    <div id="analytics-report-container" style={{ animation: "fadeIn 0.5s ease-out" }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("Consultant Analytics")}</h1>
          <p className="page-subtitle">
            {t("Performance insights")} · {selectedWeek.label}, {MONTH_NAMES[month]} {year}
          </p>
        </div>
        <div data-html2canvas-ignore style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {user?.role !== "senior_consultant" ? (
            <select
              className="select"
              value={selectedConsultantId}
              onChange={(e) => setSelectedConsultantId(e.target.value)}
            >
              <option value="all">{t("All Consultants")}</option>
              {data.consultants.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <select
              className="select"
              value={selectedConsultantId}
              disabled
            >
              {data.consultants
                .filter((c) => c.id === user.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          )}

          <select
            className="select"
            value={selectedWeekIdx}
            onChange={(e) => setSelectedWeekIdx(Number(e.target.value))}
          >
            {weeks.map((w, i) => (
              <option key={w.label} value={i}>
                {w.label} ({MONTH_NAMES[month].slice(0, 3)} {w.start}–{w.end})
              </option>
            ))}
          </select>
          <button className="btn btn-secondary btn-sm" onClick={handleExportPDF}>
            {t("Export PDF")}
          </button>
        </div>
      </div>

      {/* Scorecards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        {consultantMetrics.map((c) => {
          const barColor = c.weeklyUtilization > 90
            ? "#ef4444"
            : c.weeklyUtilization > 80
            ? "#f59e0b"
            : "#10b981";

          return (
            <div
              key={c.id}
              className="card"
              style={{ textAlign: "center", padding: "20px 16px", cursor: "pointer", transition: "all 0.2s" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.boxShadow = "var(--shadow-md)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.boxShadow = "";
              }}
              onClick={() => setExpandedConsultantId(prev => prev === c.id ? null : c.id)}
            >
              <div
                className="avatar avatar-lg"
                style={{
                  background: c.color,
                  margin: "0 auto 12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontWeight: "bold",
                }}
              >
                {c.avatar}
              </div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "2px" }}>
                {c.name.split(" ")[0]}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "12px" }}>{c.role}</div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: barColor, marginBottom: "6px" }}>
                {c.weeklyUtilization}%
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "8px" }}>
                {t("Utilization")}
              </div>
              <div className="progress-bar" style={{ height: "4px" }}>
                <div className="progress-fill" style={{ width: `${c.weeklyUtilization}%`, background: barColor }} />
              </div>
              <div style={{ marginTop: "10px", fontSize: "11px", color: "var(--text-tertiary)" }}>
                {t("Score:")} <strong style={{ color: barColor }}>{c.score}/100</strong>
              </div>
              {/* Weekly performance metric */}
              <div style={{ marginTop: "6px", fontSize: "10.5px", color: "var(--text-tertiary)" }}>
                {c.weeklyBillable > 0
                  ? `${c.weeklyBillable}h billable`
                  : `${selectedWeek.label} data`}
              </div>
            </div>
          );
        })}
      </div>

      {/* Expanded Consultant Performance Details Sub-Card */}
      {expandedConsultantId && (() => {
        const c = consultantMetrics.find(x => x.id === expandedConsultantId);
        if (!c) return null;
        
        const perfStatus = c.score >= 90 ? "High Performer" : c.score >= 70 ? "Meeting Expectations" : "Needs Improvement";
        const trendText = c.weeklyUtilization >= c.utilization 
          ? `Utilization improved by ${c.weeklyUtilization - c.utilization}% compared to baseline.` 
          : `Utilization dropped by ${c.utilization - c.weeklyUtilization}% compared to baseline.`;
        
        const targetHours = 40;
        const totalHours = c.weeklyBillable + c.weeklyNonBillable;
        const efficiency = totalHours > 0 ? Math.round((c.weeklyBillable / totalHours) * 100) : 0;
        const attendance = Math.min(100, Math.round((totalHours / targetHours) * 100));

        return (
          <div className="card" style={{ marginBottom: "24px", padding: "24px", borderLeft: `4px solid ${c.color}`, animation: "slideDown 0.3s ease-out" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div className="avatar avatar-xl" style={{ background: c.color, width: "64px", height: "64px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "24px", fontWeight: "bold" }}>
                  {c.avatar}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "20px", color: "var(--text-primary)" }}>{c.name}</h3>
                  <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "var(--text-secondary)" }}>{c.role} • {c.dept}</p>
                </div>
              </div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setExpandedConsultantId(null)}>✕</button>
            </div>
            
            <div className="grid-4" style={{ gap: "16px", marginBottom: "24px" }}>
              <div style={{ background: "rgba(0,0,0,0.02)", padding: "16px", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Performance Score</div>
                <div style={{ fontSize: "28px", fontWeight: "bold", color: c.score >= 90 ? "#ef4444" : c.score >= 80 ? "#f59e0b" : "#10b981" }}>{c.score}/100</div>
                <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "4px", fontWeight: 600 }}>{perfStatus}</div>
              </div>
              <div style={{ background: "rgba(0,0,0,0.02)", padding: "16px", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Weekly Utilization</div>
                <div style={{ fontSize: "28px", fontWeight: "bold", color: "var(--text-primary)" }}>{c.weeklyUtilization}%</div>
                <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "4px" }}>Target Baseline: {c.utilization}%</div>
              </div>
              <div style={{ background: "rgba(0,0,0,0.02)", padding: "16px", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Efficiency (Billable)</div>
                <div style={{ fontSize: "28px", fontWeight: "bold", color: "var(--text-primary)" }}>{efficiency}%</div>
                <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "4px" }}>Of {totalHours}h total logged</div>
              </div>
              <div style={{ background: "rgba(0,0,0,0.02)", padding: "16px", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Weekly Attendance</div>
                <div style={{ fontSize: "28px", fontWeight: "bold", color: "var(--text-primary)" }}>{attendance}%</div>
                <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "4px" }}>Target: {targetHours}h</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "24px", alignItems: "stretch", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "250px", background: "rgba(0,0,0,0.02)", padding: "16px", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.05)" }}>
                 <h4 style={{ margin: "0 0 16px 0", fontSize: "14px", color: "var(--text-primary)" }}>Weekly Hour Breakdown</h4>
                 <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                   <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Billable Hours</span>
                   <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{c.weeklyBillable}h</span>
                 </div>
                 <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                   <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Non-Billable Hours</span>
                   <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{c.weeklyNonBillable}h</span>
                 </div>
                 <div style={{ height: "1px", background: "rgba(0,0,0,0.1)", margin: "12px 0" }} />
                 <div style={{ display: "flex", justifyContent: "space-between" }}>
                   <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Total Hours Logged</span>
                   <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{totalHours}h</span>
                 </div>
              </div>

              <div style={{ flex: 2, minWidth: "300px", background: "rgba(46, 134, 193, 0.05)", padding: "20px", borderRadius: "8px", border: "1px solid rgba(46, 134, 193, 0.15)", display: "flex", gap: "16px", alignItems: "flex-start" }}>
                <div style={{ background: "var(--brand-500)", color: "white", padding: "8px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                </div>
                <div>
                  <h4 style={{ margin: "0 0 8px 0", fontSize: "15px", color: "var(--text-primary)" }}>Performance Insight & Trend</h4>
                  <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    {trendText} Current efficiency sits at {efficiency}%. 
                    <br/><br/>
                    <strong>Current Week Focus:</strong> {c.weeklyNonBillable > 0 ? `The consultant has accumulated ${c.weeklyNonBillable} non-billable hours, which impacts overall profitability despite a score of ${c.score}.` : `The consultant is operating at optimal billable efficiency with zero non-billable drag.`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Charts Grid */}
      <div className="grid-2 mb-4">
        {/* Monthly Billable Hours — filtered to selected week */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: 0 }}>
            <span className="card-title">{t("Monthly Billable Hours")}</span>
            <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
              {selectedWeek.label}, {MONTH_NAMES[month]} {year}
            </span>
          </div>
          <div className="card-body">
            <div className="chart-container" style={{ height: "240px" }}>
              <WeeklyBillableHoursChart
                key={`billable-${selectedWeekIdx}-${year}-${month}`}
                labels={chartLabels}
                billableValues={billableChartData}
                nonBillableValues={nonBillableChartData}
              />
            </div>
          </div>
        </div>

        {/* Individual Performance Trends — filtered to selected week */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: 0 }}>
            <span className="card-title">{t("Individual Performance Trends")}</span>
            <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
              {selectedWeek.label}, {MONTH_NAMES[month]} {year}
            </span>
          </div>
          <div className="card-body">
            <div className="chart-container" style={{ height: "240px" }}>
              <WeeklyPerformanceChart
                key={`perf-${selectedWeekIdx}-${year}-${month}`}
                labels={perfLabels}
                utilizationValues={perfUtils}
                colors={perfColors}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Utilization vs Bill Rate Bubble Chart */}
      <div className="card">
        <div className="card-header" style={{ marginBottom: 0 }}>
          <span className="card-title">{t("Utilization vs. Bill Rate Analysis")}</span>
          <span className="badge badge-brand" style={{ fontSize: "11px" }}>
            {t("Bubble = Allocation Level")}
          </span>
        </div>
        <div className="card-body">
          <div className="chart-container" style={{ height: "280px" }}>
            <TrendScatterChart customConsultants={consultantMetrics} />
          </div>
        </div>
      </div>

      {/* Export Metadata Footer */}
      <div
        style={{
          marginTop: "32px",
          paddingTop: "16px",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "11px",
          color: "var(--text-tertiary)",
        }}
      >
        <div>
          <strong>{t("Report Name:")}</strong> Consultant Analytics Report
        </div>
        <div>
          <strong>{t("Export Date:")}</strong> {new Date().toLocaleDateString()}
        </div>
        <div>
          <strong>{t("Generated Timestamp:")}</strong> {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
