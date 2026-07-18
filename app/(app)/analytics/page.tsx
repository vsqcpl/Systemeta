"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
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

// ─── Deterministic score formula (unchanged from original) ────────────────────

function getDeterministicScore(utilization: number, name: string) {
  return Math.min(100, Math.round(utilization));
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const data      = useAppStore((state) => state.data);
  const { t }     = useTranslation();
  const showToast = useAppStore((state) => state.showToast);
  const { user }  = useAuth();
  const router    = useRouter();

  useEffect(() => {
    if (user && (user.role === "accounts" || user.role === "client_contact")) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  if (user && (user.role === "accounts" || user.role === "client_contact")) {
    return null;
  }

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
        if (ts.entries && Array.isArray(ts.entries)) {
          for (const entry of ts.entries) {
            if (isDayInWeek(ts.week, entry.day)) {
              let hours = 0;
              if (entry.punchInTime && entry.punchOutTime) {
                const inTime = new Date(entry.punchInTime).getTime();
                const outTime = new Date(entry.punchOutTime).getTime();
                if (!isNaN(inTime) && !isNaN(outTime) && outTime >= inTime) {
                  hours = (outTime - inTime) / (1000 * 60 * 60);
                }
              } else if (typeof entry.hours === 'number') {
                hours = entry.hours;
              }
              
              if (hours > 0) {
                if (entry.billable) {
                  billableHours += hours;
                } else {
                  nonBillableHours += hours;
                }
              }
            }
          }
        }
      }

      // 1. Calculate Utilization (Weekly)
      const totalHours   = billableHours + nonBillableHours;
      const utilization  = totalHours > 0
        ? Math.min(100, Math.round((totalHours / MAX_WEEKLY_HOURS) * 100))
        : 0; 

      // 1b. Calculate Global Utilization (To sync with timesheet-ai)
      const allUserTimesheets = data.timesheets.filter((ts) => ts.consultant === c.id);
      let totalAllHours = 0;
      allUserTimesheets.forEach((ts: any) => {
        if (ts.entries && Array.isArray(ts.entries)) {
          ts.entries.forEach((entry: any) => {
            if (entry.punchInTime && entry.punchOutTime) {
              const inTime = new Date(entry.punchInTime).getTime();
              const outTime = new Date(entry.punchOutTime).getTime();
              if (!isNaN(inTime) && !isNaN(outTime) && outTime >= inTime) {
                totalAllHours += (outTime - inTime) / (1000 * 60 * 60);
              }
            } else if (typeof entry.hours === 'number') {
              totalAllHours += entry.hours;
            }
          });
        }
      });
      const capacity = allUserTimesheets.length * 40;
      let globalUtilization = 0;
      if (allUserTimesheets.length > 0 && capacity > 0) {
        globalUtilization = Math.min(100, Math.round((totalAllHours / capacity) * 100));
      }
      
      // 2. Calculate Efficiency using logic from timesheet-ai
      let calculatedEfficiency: number | null = null;
      
      const getFlatTasksLocal = (tasksState: any) => {
        if (!tasksState) return [];
        if (Array.isArray(tasksState)) return tasksState;
        const flat: any[] = [];
        if (Array.isArray(tasksState.todo)) flat.push(...tasksState.todo);
        if (Array.isArray(tasksState.inprogress)) flat.push(...tasksState.inprogress);
        if (Array.isArray(tasksState.review)) flat.push(...tasksState.review);
        if (Array.isArray(tasksState.done)) flat.push(...tasksState.done);
        return flat;
      };

      if (data.tasks) {
        let totalPlannedHours = 0;
        let totalActualTaskHours = 0;
        const allTasks = getFlatTasksLocal(data.tasks);

        allTasks.forEach((task: any) => {
          let isAssigned = false;
          let assignedUsersArray: any[] = [];
          
          try {
            if (typeof task.assignee === 'string' && task.assignee.trim().startsWith('[')) {
              assignedUsersArray = JSON.parse(task.assignee);
              isAssigned = assignedUsersArray.some((u: any) => u.userId === c.id || u.name === c.name);
            } else if (Array.isArray(task.assignee)) {
              assignedUsersArray = task.assignee;
              isAssigned = assignedUsersArray.some((u: any) => u.userId === c.id || u.name === c.name);
            } else if (task.assignee === c.name || task.assignee === c.id || (typeof task.assignee === 'string' && task.assignee.includes(c.name))) {
              isAssigned = true;
            }
          } catch (e) {
            if (task.assignee === c.name || task.assignee === c.id) {
              isAssigned = true;
            }
          }

          if (isAssigned) {
            let plannedHours = 0;
            if (assignedUsersArray.length > 0) {
              const userAssignment = assignedUsersArray.find((u: any) => u.userId === c.id || u.name === c.name);
              if (userAssignment && typeof userAssignment.hours === 'number') {
                plannedHours = userAssignment.hours;
              } else {
                plannedHours = (task.estimate || 0) / assignedUsersArray.length;
              }
            } else {
              let numAssignees = 1;
              if (typeof task.assignee === 'string' && task.assignee.includes(',')) {
                numAssignees = task.assignee.split(',').filter(Boolean).length || 1;
              } else if (Array.isArray(task.assignee)) {
                numAssignees = task.assignee.length || 1;
              }
              plannedHours = (task.estimate || 0) / numAssignees;
            }
            
            let actualHours = 0;
            const allUserTimesheets = data.timesheets.filter((ts) => ts.consultant === c.id);
            allUserTimesheets.forEach((ts: any) => {
              if (ts.entries && Array.isArray(ts.entries)) {
                ts.entries.forEach((entry: any) => {
                  if (entry.task === task.title || entry.task === task.id) {
                    if (entry.punchInTime && entry.punchOutTime) {
                      const inTime = new Date(entry.punchInTime).getTime();
                      const outTime = new Date(entry.punchOutTime).getTime();
                      if (!isNaN(inTime) && !isNaN(outTime) && outTime >= inTime) {
                        actualHours += (outTime - inTime) / (1000 * 60 * 60);
                      }
                    } else if (typeof entry.hours === 'number') {
                      actualHours += entry.hours;
                    }
                  }
                });
              }
            });

            totalPlannedHours += plannedHours;
            totalActualTaskHours += actualHours;
          }
        });

        if (totalActualTaskHours > 0 && totalPlannedHours > 0) {
          calculatedEfficiency = Math.min(100, Math.round((totalPlannedHours / totalActualTaskHours) * 100));
        }
      }

      // 3. Calculate Productivity
      let productivity = utilization; // Default to utilization if no efficiency data
      if (calculatedEfficiency !== null) {
        // Average the global utilization and efficiency to perfectly sync with Performance Metrics Dashboard
        productivity = Math.min(100, Math.round((globalUtilization + calculatedEfficiency) / 2));
      } else if (utilization === 0) {
        productivity = Math.min(100, c.utilization || 0); // ultimate fallback to base data
      }

      const score = getDeterministicScore(productivity, c.name);

      // --- Attendance Metric Calculation ---
      let calculatedAttendance: number | "N/A" = "N/A";
      const today = new Date();
      const attYear = today.getFullYear();
      const attMonth = today.getMonth();
      const currentDateInt = today.getDate();
      let totalWorkingDays = 0;
      let presentDays = 0;

      for (let d = 1; d <= currentDateInt; d++) {
        const date = new Date(attYear, attMonth, d);
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        if (!isWeekend) {
          totalWorkingDays++;
          const targetDateStr = `${attYear}-${String(attMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          let attTotalHours = 0;
          allUserTimesheets.forEach((ts: any) => {
            ts.entries?.forEach((e: any) => {
              if (e.punchInTime) {
                const pDate = new Date(e.punchInTime);
                const pStr = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}-${String(pDate.getDate()).padStart(2, '0')}`;
                if (pStr === targetDateStr) {
                  attTotalHours += (e.hours || 0);
                }
              } else {
                const weekStart = new Date(ts.week);
                weekStart.setDate(weekStart.getDate() + (e.day || 0));
                const wStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
                if (wStr === targetDateStr) {
                  attTotalHours += (e.hours || 0);
                }
              }
            });
          });
          if (attTotalHours >= 8) {
            presentDays += 1;
          } else if (attTotalHours > 5) {
            presentDays += 0.5;
          }
        }
      }
      
      if (totalWorkingDays > 0) {
        calculatedAttendance = Math.round((presentDays / totalWorkingDays) * 100);
      }
      // -------------------------------------

      return {
        ...c,
        weeklyBillable:    billableHours,
        weeklyNonBillable: nonBillableHours,
        weeklyUtilization: productivity, // Re-use the existing field but map to productivity
        efficiency:        calculatedEfficiency !== null ? calculatedEfficiency : 0,
        attendance:        calculatedAttendance !== "N/A" ? calculatedAttendance : 0,
        score,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.consultants, data.timesheets, selectedWeekIdx, year, month, selectedConsultantId]);

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
                {t("Productivity")}
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

      {/* Performance Trend Chart */}
      <div className="card" style={{ marginBottom: "24px", padding: "20px" }}>
        <span className="card-title" style={{ marginBottom: "16px", display: "block" }}>{t("Performance vs Productivity Trend")}</span>
        <div style={{ height: "350px", position: "relative" }}>
          <TrendScatterChart customConsultants={consultantMetrics} />
        </div>
      </div>

      {/* Expanded Consultant Performance Details Sub-Card */}
      {expandedConsultantId && (() => {
        const c = consultantMetrics.find(x => x.id === expandedConsultantId);
        if (!c) return null;
        
        const perfStatus = c.score >= 90 ? "High Performer" : c.score >= 70 ? "Meeting Expectations" : "Needs Improvement";
        const trendText = c.weeklyUtilization >= c.utilization 
          ? `Productivity improved by ${c.weeklyUtilization - c.utilization}% compared to baseline.` 
          : `Productivity dropped by ${c.utilization - c.weeklyUtilization}% compared to baseline.`;
        
        const totalHours = c.weeklyBillable + c.weeklyNonBillable;

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
            
            <div style={{ gap: "16px", marginBottom: "24px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
              <div style={{ textAlign: "center", padding: "16px", background: "var(--bg-secondary)", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Overall Productivity</div>
                <div style={{ fontSize: "28px", fontWeight: "bold", color: "var(--text-primary)" }}>{c.weeklyUtilization}%</div>
                <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "4px" }}>Target Baseline: {c.utilization}%</div>
              </div>
              <div style={{ background: "rgba(0,0,0,0.02)", padding: "16px", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Efficiency</div>
                <div style={{ fontSize: "28px", fontWeight: "bold", color: "var(--text-primary)" }}>{c.efficiency}%</div>
                <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "4px" }}>Syncs with Performance Module</div>
              </div>
              <div style={{ background: "rgba(0,0,0,0.02)", padding: "16px", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "4px" }}>Monthly Attendance</div>
                <div style={{ fontSize: "28px", fontWeight: "bold", color: "var(--text-primary)" }}>{c.attendance}%</div>
                <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "4px" }}>Actual calendar sync</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "24px", alignItems: "stretch", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "250px", background: "rgba(37,99,235,0.05)", padding: "16px", borderRadius: "8px", border: "1px solid rgba(37,99,235,0.15)" }}>
                 <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#2563eb", display: "flex", alignItems: "center", gap: "6px" }}>
                   <span style={{ fontSize: "16px" }}>📈</span> Performance Insight & Trend
                 </h4>
                 <div style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    {trendText} Current efficiency sits at {c.efficiency}%. 
                    <br/><br/>
                    <strong>Current Week Focus:</strong> {c.weeklyNonBillable > 0 ? `The consultant has accumulated ${c.weeklyNonBillable} non-billable hours, which impacts overall profitability despite a score of ${c.score}.` : `The consultant is operating at optimal billable efficiency with zero non-billable drag.`}
                 </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Productivity Insights Panel */}
      <div className="card" style={{ marginBottom: "24px", padding: "20px" }}>
        <span className="card-title" style={{ marginBottom: "16px", display: "block" }}>{t("Performance Insights")}</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          <div style={{ padding: "16px", background: "var(--bg-success, rgba(34,197,94,0.1))", borderRadius: "8px", border: "1px solid var(--border-success, rgba(34,197,94,0.2))" }}>
            <h4 style={{ margin: "0 0 8px 0", color: "var(--text-success, #166534)", fontSize: "14px" }}>Highest Productivity</h4>
            {(() => {
              const top = [...consultantMetrics].sort((a, b) => b.weeklyUtilization - a.weeklyUtilization)[0];
              return top ? (
                <div>
                  <strong style={{ fontSize: "18px", color: "var(--text-primary)" }}>{top.name}</strong>
                  <div style={{ color: "var(--text-secondary)", fontSize: "13px" }}>{top.weeklyUtilization}% Productivity</div>
                </div>
              ) : <div style={{ color: "var(--text-secondary)" }}>No data available</div>;
            })()}
          </div>
          
          <div style={{ padding: "16px", background: "var(--bg-danger, rgba(239,68,68,0.1))", borderRadius: "8px", border: "1px solid var(--border-danger, rgba(239,68,68,0.2))" }}>
            <h4 style={{ margin: "0 0 8px 0", color: "var(--text-danger, #991b1b)", fontSize: "14px" }}>Lowest Productivity</h4>
            {(() => {
              const lowest = [...consultantMetrics].sort((a, b) => a.weeklyUtilization - b.weeklyUtilization)[0];
              return lowest ? (
                <div>
                  <strong style={{ fontSize: "18px", color: "var(--text-primary)" }}>{lowest.name}</strong>
                  <div style={{ color: "var(--text-secondary)", fontSize: "13px" }}>{lowest.weeklyUtilization}% Productivity</div>
                </div>
              ) : <div style={{ color: "var(--text-secondary)" }}>No data available</div>;
            })()}
          </div>

          <div style={{ padding: "16px", background: "rgba(16, 185, 129, 0.05)", borderRadius: "8px", border: "1px solid rgba(16, 185, 129, 0.15)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1.45.62 2.84 1.5 3.5.76.75 1.23 1.51 1.41 2.5"/></svg>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#10b981" }}>AI Insight</span>
            </div>
            {(() => {
              const sorted = [...consultantMetrics].sort((a, b) => a.weeklyUtilization - b.weeklyUtilization);
              const lowest = sorted[0];
              const highest = sorted[sorted.length - 1];
              if (!lowest || !highest) return <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>Insufficient data for insights.</div>;
              
              if (lowest.weeklyUtilization === 0) {
                return (
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    "{lowest.name}" has no logged hours this week. Consider a follow-up to ensure timesheets are up to date.
                  </div>
                );
              }
              
              return (
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  Resource allocation gap detected: <strong>{highest.name}</strong> is operating at {highest.weeklyUtilization}% while <strong>{lowest.name}</strong> is at {lowest.weeklyUtilization}%. Rebalancing tasks could improve overall team output.
                </div>
              );
            })()}
          </div>
        </div>
      </div>


    </div>
  );
}
