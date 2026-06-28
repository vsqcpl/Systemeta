"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useAppStore, useTranslation } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";
import { Briefcase, Folder, Clock, SquarePen, MapPin } from "lucide-react";

interface CompanyTask {
  id: number;
  name: string;
  project: string;
  assignedBy: string;
}

export default function TimesheetsPage() {
  const { user } = useAuth();
  const data = useAppStore((state) => state.data);
  const showToast = useAppStore((state) => state.showToast);
  const punchedIn = useAppStore((state) => state.punchedIn);
  const punchStartTime = useAppStore((state) => state.punchStartTime);
  const punchHoursToday = useAppStore((state) => state.punchHoursToday);
  const punchHoursWeek = useAppStore((state) => state.punchHoursWeek);
  const togglePunch = useAppStore((state) => state.togglePunch);
  const updateTimesheetHours = useAppStore((state) => state.updateTimesheetHours);
  const { t } = useTranslation();

  const [weekOffset, setWeekOffset] = useState(0);
  const [currentTime, setCurrentTime] = useState("");
  const [runningTimer, setRunningTimer] = useState("00:00:00");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Form State for Log Work Details
  const [projectClient, setProjectClient] = useState("Internal Operations");
  const [timeLogged, setTimeLogged] = useState("8 Hours (Full Day)");
  const [workNotes, setWorkNotes] = useState("");
  const [currentLocation, setCurrentLocation] = useState("");

  const [selectedTasks, setSelectedTasks] = useState<number[]>([]);
  const [taskHours, setTaskHours] = useState<Record<number, string>>({});

  const handleTaskToggle = (taskId: number) => {
    setSelectedTasks((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleHoursChange = (taskId: number, value: string) => {
    setTaskHours((prev) => ({
      ...prev,
      [taskId]: value
    }));
  };

  const handleConfirmTasks = () => {
    showToast("Assigned tasks confirmed successfully.", "success");
  };

  // Dynamically compute assigned tasks from the store data
  const companyAssignedTasks = useMemo(() => {
    if (!user || !data.tasks) return [];
    
    const allTasksList = [
      ...(data.tasks.todo || []),
      ...(data.tasks.inprogress || []),
      ...(data.tasks.review || []),
      ...(data.tasks.done || []),
    ];
    
    const userTasks = allTasksList.filter((t: any) => t.assigneeId === user.id);
    
    return userTasks.map((t: any, idx: number) => {
      const projectObj = data.projects.find((p: any) => p.id === t.projectId);
      const projectName = projectObj ? projectObj.name : t.projectId;
      
      return {
        id: idx + 1,
        taskId: t.id,
        name: t.title,
        project: projectName,
        assignedBy: "Project Manager",
      };
    });
  }, [user, data.tasks, data.projects]);

  // Default timesheet rows generated dynamically from actual projects and tasks
  const DEFAULT_ROWS = useMemo(() => {
    if (!user || !data.projects) return [];
    
    const rows: { project: string; task: string; billable: boolean; defaultHours: number[] }[] = [];
    
    const allTasksList = [
      ...(data.tasks.todo || []),
      ...(data.tasks.inprogress || []),
      ...(data.tasks.review || []),
      ...(data.tasks.done || []),
    ];
    const userTasks = allTasksList.filter((t: any) => t.assigneeId === user.id);
    
    data.projects.forEach((proj: any) => {
      const projTasks = userTasks.filter((t: any) => t.projectId === proj.id);
      if (projTasks.length > 0) {
        projTasks.forEach((t: any) => {
          rows.push({
            project: proj.id,
            task: t.title,
            billable: true,
            defaultHours: [0, 0, 0, 0, 0, 0, 0],
          });
        });
      } else {
        rows.push({
          project: proj.id,
          task: "General Project Work",
          billable: true,
          defaultHours: [0, 0, 0, 0, 0, 0, 0],
        });
      }
    });
    
    // Always add an Internal Operations row
    rows.push({
      project: "Internal",
      task: "Team Meeting / Training",
      billable: false,
      defaultHours: [0, 0, 0, 0, 0, 0, 0],
    });
    
    return rows;
  }, [user, data.projects, data.tasks]);

  // 1. Clock effect (digital clock + timer logic)
  useEffect(() => {
    // Current date and time display format
    const formatTime = () => {
      const now = new Date();
      return now.toLocaleTimeString("en-US", { hour12: false });
    };
    setCurrentTime(formatTime());

    const timeInterval = setInterval(() => {
      setCurrentTime(formatTime());
    }, 1000);

    return () => clearInterval(timeInterval);
  }, []);

  // 2. Punch session elapsed timer
  useEffect(() => {
    if (punchedIn && punchStartTime) {
      const updateTimer = () => {
        const diffMs = Date.now() - new Date(punchStartTime).getTime();
        const diffSecs = Math.floor(diffMs / 1000);
        const hours = Math.floor(diffSecs / 3600);
        const minutes = Math.floor((diffSecs % 3600) / 60);
        const seconds = diffSecs % 60;
        setRunningTimer(
          `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
        );
      };
      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
    } else {
      setRunningTimer("00:00:00");
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [punchedIn, punchStartTime]);

  // Weeks definition
  const weekStart = new Date("2026-06-09");
  weekStart.setDate(weekStart.getDate() + weekOffset * 7);

  const getWeekRangeLabel = () => {
    const start = new Date(weekStart);
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return `${t("Week of")} ${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}–${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  };

  const daysLabel = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return `${t(dayNames[i])} ${d.getDate()}`;
  });

  const targetWeekKey = weekStart.toISOString().substring(0, 10);

  // Retrieve timesheet for current week & user from store
  const userTimesheet = data.timesheets.find(
    (t) => t.consultant === (user?.id || "TK") && t.week === targetWeekKey
  );

  // Helper to get hours value for cell
  const getCellHours = (project: string, task: string, day: number, defaultVal: number) => {
    if (userTimesheet) {
      const match = userTimesheet.entries.find(
        (e) => e.day === day && e.project === project && e.task === task
      );
      return match ? match.hours : 0;
    }
    // If no custom timesheet created yet, return original default week offset is 0
    return weekOffset === 0 ? defaultVal : 0;
  };

  // Build grid data
  const gridRows = DEFAULT_ROWS.map((row) => {
    const hours = Array.from({ length: 7 }, (_, dayIdx) =>
      getCellHours(row.project, row.task, dayIdx, row.defaultHours[dayIdx])
    );
    const total = hours.reduce((a, b) => a + b, 0);
    return {
      ...row,
      hours,
      total,
    };
  });

  // Calculate daily totals
  const dailyTotals = Array.from({ length: 7 }, (_, dayIdx) =>
    gridRows.reduce((sum, r) => sum + r.hours[dayIdx], 0)
  );
  const grandTotal = dailyTotals.reduce((a, b) => a + b, 0);

  // Billable vs non-billable calculations
  const totalBillable = gridRows
    .filter((r) => r.billable)
    .reduce((sum, r) => sum + r.total, 0);
  const totalNonBillable = gridRows
    .filter((r) => !r.billable)
    .reduce((sum, r) => sum + r.total, 0);

  const billableRatio = grandTotal > 0 ? (totalBillable / grandTotal) * 100 : 0;

  const handleHourChange = (project: string, task: string, dayIdx: number, val: string, billable: boolean) => {
    const hours = parseFloat(val);
    if (isNaN(hours) || hours < 0 || hours > 24) return;
    updateTimesheetHours(project, task, dayIdx, hours, billable);
    setIsSubmitted(false); // Reset submission status on edits
    showToast("Timesheet entry updated", "success");
  };

  const handleSubmit = () => {
    setIsSubmitted(true);
    showToast("Timesheet submitted for approval", "success");
  };

  const handleExport = () => {
    // Generate CSV headers
    const headers = ["Project", "Task", "Billable", ...daysLabel.map(label => label.replace(/\s+/g, " ")), "Total"];
    
    // Generate rows
    const rows = gridRows.map((row) => [
      row.project,
      row.task,
      row.billable ? "Yes" : "No",
      ...row.hours,
      row.total
    ]);
    
    // Add total row at the end
    const totalRow = [
      "Daily Total",
      "",
      "",
      ...dailyTotals,
      grandTotal
    ];
    
    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")),
      totalRow.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")
    ].join("\n");

    // Create a blob and trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `timesheet_${targetWeekKey}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast("Timesheet exported successfully", "success");
  };

  const formattedDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });


  return (
    <div style={{ animation: "fadeIn 0.5s ease-out" }}>
      <style>{`
        .premium-log-card {
          background: var(--bg-page) !important;
          border: none !important;
          border-radius: var(--radius-lg) !important;
          padding: 24px 28px !important;
          box-shadow: none !important;
          position: relative;
          overflow: hidden;
        }
        .premium-select, .premium-input, .premium-textarea {
          border-left: 3px solid #2E86C1 !important;
          transition: all 0.2s ease !important;
          background: var(--bg-surface-2) !important;
        }
        .premium-select:focus, .premium-input:focus, .premium-textarea:focus {
          border-color: #2E86C1 !important;
          box-shadow: 0 0 0 3px rgba(46, 134, 193, 0.15) !important;
        }
        .premium-input::placeholder, .premium-textarea::placeholder {
          color: var(--text-tertiary) !important;
          opacity: 0.8 !important;
        }
        [data-theme="dark"] .premium-input::placeholder,
        [data-theme="dark"] .premium-textarea::placeholder {
          color: rgba(255, 255, 255, 0.45) !important;
          opacity: 1 !important;
        }
        .premium-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        @media (max-width: 768px) {
          .premium-form-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }
      `}</style>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("Timesheets")}</h1>
          <p className="page-subtitle">
            {getWeekRangeLabel()} · {user?.name || "Tom Keller"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setWeekOffset(weekOffset - 1)}>
            ← {t("Prev Week")}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setWeekOffset(weekOffset + 1)}>
            {t("Next Week")} →
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleExport}
          >
            {t("Export")}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSubmit}
            disabled={isSubmitted}
            style={isSubmitted ? { opacity: 0.7, cursor: "not-allowed" } : {}}
          >
            {isSubmitted ? t("Submitted") : t("Submit for Approval")}
          </button>
        </div>
      </div>

      {/* Tabs - Only Weekly Timesheet */}
      <div
        className="tabs mb-4"
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: "1px solid var(--border-subtle)",
          paddingBottom: "12px",
          marginBottom: "20px",
        }}
      >
        <button
          type="button"
          style={{
            padding: "8px 16px",
            fontSize: "13.5px",
            fontWeight: 600,
            border: "none",
            background: "transparent",
            cursor: "default",
            borderBottom: "2px solid #2E86C1",
            color: "#2E86C1",
            transition: "all 0.15s ease",
          }}
        >
          {t("Weekly Timesheet")}
        </button>
      </div>

      <>
          {/* Summary Section */}
          <div className="grid-3-2 mb-4">
            {/* Punch Clock Card */}
            <div className="punch-clock">
              <div className="punch-status">
                <div
                  className="punch-status-dot"
                  style={{
                    background: punchedIn ? "#10b981" : "#64748b",
                    boxShadow: punchedIn ? "0 0 8px #10b981" : "none",
                    animation: punchedIn ? "pulse 2s infinite" : "none",
                  }}
                />
                <span style={{ fontSize: "12px", fontWeight: "bold" }}>
                  {punchedIn ? t("Clocked In") : t("Not Clocked In")}
                </span>
              </div>
              <div className="punch-time" style={{ fontFamily: "monospace", fontSize: "36px", fontWeight: 800 }}>
                {punchedIn ? runningTimer : currentTime}
              </div>
              <div className="punch-date" style={{ fontSize: "12px", opacity: 0.8, marginBottom: "16px" }}>
                {formattedDate}
              </div>
              <button
                className={`punch-btn ${punchedIn ? "punch-out" : "punch-in"}`}
                onClick={togglePunch}
                style={{
                  padding: "10px 24px",
                  borderRadius: "9999px",
                  fontWeight: "bold",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                }}
              >
                {punchedIn ? `⏹ ${t("Punch Out")}` : `▶ ${t("Punch In")}`}
              </button>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginTop: "20px", textAlign: "center" }}>
                <div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "white" }}>
                    {punchHoursToday > 0 ? `${punchHoursToday}h` : "—"}
                  </div>
                  <div style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.6)" }}>{t("Today")}</div>
                </div>
                <div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "white" }}>
                    {(punchHoursWeek + (punchedIn ? parseFloat(runningTimer.split(":")[0]) : 0)).toFixed(1)}h
                  </div>
                  <div style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.6)" }}>{t("This Week")}</div>
                </div>
                <div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "white" }}>
                    {(punchHoursWeek * 0.82).toFixed(1)}h
                  </div>
                  <div style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.6)" }}>{t("Billable")}</div>
                </div>
              </div>
            </div>

            {/* Weekly Summary Card */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">{t("Week Summary")}</span>
              </div>
              <div className="card-body">
                {[
                  { label: t("Total Hours"), val: `${grandTotal.toFixed(1)}h` },
                  { label: t("Billable Hours"), val: `${totalBillable.toFixed(1)}h` },
                  { label: t("Non-Billable Hours"), val: `${totalNonBillable.toFixed(1)}h` },
                  { label: t("Target Hours"), val: "40.0h" },
                ].map(({ label, val }) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "10px 0",
                      borderBottom: "1px solid var(--border-subtle)",
                      fontSize: "13px",
                    }}
                  >
                    <span style={{ color: "var(--text-secondary)" }}>{label}</span>
                    <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{val}</span>
                  </div>
                ))}
                <div style={{ marginTop: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{t("Billable Ratio")}</span>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--success-600)" }}>
                      {billableRatio.toFixed(1)}%
                    </span>
                  </div>
                  <div className="progress-bar" style={{ height: "8px" }}>
                    <div
                      className="progress-fill success"
                      style={{ width: `${billableRatio}%`, background: "var(--success-500)" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Daily Log Details Form */}
          <div className="premium-log-card mb-4">
            <div style={{ display: "flex", flexDirection: "column", borderLeft: "3px solid #2E86C1", paddingLeft: "12px", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Briefcase size={16} style={{ color: "#2E86C1" }} />
                <span className="card-title" style={{ fontSize: "16px", fontWeight: 700 }}>
                  {t("Log Work Details")}
                </span>
              </div>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
                {t("Record your project work, time logged, and activity notes for today")}
              </span>
            </div>
            <div style={{
              height: "1px",
              background: "linear-gradient(90deg, rgba(46, 134, 193, 0.3) 0%, rgba(46, 134, 193, 0.05) 100%)",
              marginBottom: "20px"
            }} />
            
            <div className="premium-form-grid">
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", fontWeight: 700, color: "#2E86C1" }}>
                  <Folder size={14} />
                  {t("Project / Client")}
                </label>
                <select
                  className="select premium-select"
                  value={projectClient}
                  onChange={(e) => setProjectClient(e.target.value)}
                  style={{ width: "100%", height: "38px" }}
                >
                  <option value="Internal Operations">{t("Internal Operations")}</option>
                  <option value="Client – Acme Corp">{t("Client – Acme Corp")}</option>
                  <option value="Client – Globex Ltd">{t("Client – Globex Ltd")}</option>
                  <option value="Client – Initech">{t("Client – Initech")}</option>
                  <option value="Client – Umbrella Inc">{t("Client – Umbrella Inc")}</option>
                  <option value="Training & Development">{t("Training & Development")}</option>
                  <option value="Non-Billable / Admin">{t("Non-Billable / Admin")}</option>
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", fontWeight: 700, color: "#2E86C1" }}>
                  <Clock size={14} />
                  {t("Time Logged")}
                </label>
                <select
                  className="select premium-select"
                  value={timeLogged}
                  onChange={(e) => setTimeLogged(e.target.value)}
                  style={{ width: "100%", height: "38px" }}
                >
                  <option value="30 Minutes">{t("30 Minutes")}</option>
                  <option value="1 Hour">{t("1 Hour")}</option>
                  <option value="2 Hours">25% • {t("2 Hours")}</option>
                  <option value="4 Hours">50% • {t("4 Hours")}</option>
                  <option value="6 Hours">75% • {t("6 Hours")}</option>
                  <option value="8 Hours (Full Day)">100% • {t("8 Hours (Full Day)")}</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "20px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", fontWeight: 700, color: "#2E86C1" }}>
                <MapPin size={14} />
                {t("Current Location")}
              </label>
              <input
                type="text"
                className="input premium-input"
                placeholder={t("Enter your current location...")}
                value={currentLocation}
                onChange={(e) => setCurrentLocation(e.target.value)}
                style={{ width: "100%", height: "38px" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "20px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", fontWeight: 700, color: "#2E86C1" }}>
                <SquarePen size={14} />
                {t("Work Notes / Remarks")}
              </label>
              <div style={{ position: "relative" }}>
                <textarea
                  className="input premium-textarea"
                  rows={4}
                  maxLength={500}
                  placeholder={t("Enter any notes or remarks about today's work...")}
                  value={workNotes}
                  onChange={(e) => setWorkNotes(e.target.value)}
                  style={{ resize: "vertical", width: "100%", paddingBottom: "24px" }}
                />
                <div style={{ position: "absolute", bottom: "8px", right: "12px", fontSize: "11px", color: "var(--text-tertiary)", pointerEvents: "none" }}>
                  {workNotes.length} / 500
                </div>
              </div>
            </div>
          </div>

          {/* Grid Card */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: 0 }}>
              <span className="card-title">{t("Weekly Timesheet")}</span>
              <div style={{ display: "flex", gap: "8px" }}>
                <span className="badge badge-brand" style={{ fontSize: "10px" }}>
                  ● {t("Billable")}
                </span>
                <span className="badge badge-warning" style={{ fontSize: "10px" }}>
                  ● {t("Non-Billable")}
                </span>
              </div>
            </div>
            <div style={{ padding: "16px", overflowX: "auto" }}>
              <div className="timesheet-grid" style={{ minWidth: "900px" }}>
                {/* Header row */}
                <div className="timesheet-header">
                  <div className="timesheet-header-cell">{t("Project / Task")}</div>
                  {daysLabel.map((d) => (
                    <div key={d} className="timesheet-header-cell">
                      {d}
                    </div>
                  ))}
                  <div className="timesheet-header-cell">{t("Total")}</div>
                </div>

                {/* Content rows */}
                {gridRows.map((row, rIdx) => (
                  <div key={rIdx} className="timesheet-row">
                    <div className="timesheet-row-label">
                      <div className="timesheet-row-project" style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-primary)" }}>
                        {row.project}
                      </div>
                      <div className="timesheet-row-task" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                        {row.task}
                      </div>
                    </div>

                    {row.hours.map((h, dayIdx) => {
                      const cellClass = h > 0 ? (row.billable ? "billable" : "non-billable") : "";
                      return (
                        <div key={dayIdx} className={`timesheet-cell ${cellClass}`}>
                          <input
                            type="number"
                            className="timesheet-hours-input"
                            value={h > 0 ? h : ""}
                            onChange={(e) => handleHourChange(row.project, row.task, dayIdx, e.target.value, row.billable)}
                            min="0"
                            max="24"
                            step="0.5"
                            placeholder="—"
                            style={{
                              width: "100%",
                              textAlign: "center",
                              border: "none",
                              background: "transparent",
                              color: "inherit",
                              fontWeight: h > 0 ? "bold" : "normal",
                            }}
                          />
                        </div>
                      );
                    })}

                    <div className="timesheet-cell" style={{ background: "var(--bg-surface-2)" }}>
                      <span className="timesheet-total" style={{ fontWeight: "bold" }}>
                        {row.total > 0 ? `${row.total.toFixed(1)}h` : "—"}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Total row */}
                <div className="timesheet-row" style={{ background: "var(--bg-surface-2)" }}>
                  <div className="timesheet-row-label" style={{ fontWeight: 700, color: "var(--text-primary)" }}>
                    {t("Daily Total")}
                  </div>
                  {dailyTotals.map((t, dayIdx) => (
                    <div key={dayIdx} className="timesheet-cell" style={{ background: "var(--bg-surface-2)" }}>
                      <span className="timesheet-total" style={{ fontWeight: "bold" }}>
                        {t > 0 ? `${t.toFixed(1)}h` : "—"}
                      </span>
                    </div>
                  ))}
                  <div className="timesheet-cell" style={{ background: "var(--brand-50)" }}>
                    <span className="timesheet-total" style={{ color: "var(--brand-700)", fontWeight: 800 }}>
                      {grandTotal.toFixed(1)}h
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Assigned Tasks Card */}
          <div className="card" style={{ marginTop: "24px" }}>
            <div className="card-header">
              <span className="card-title">{t("Assigned Tasks")}</span>
            </div>
            <div className="card-body" style={{ padding: "0 0 20px 0" }}>
              {/* Checklist header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px 2fr 1.5fr 1.5fr",
                  alignItems: "center",
                  padding: "10px 16px",
                  background: "var(--bg-surface-2)",
                  borderBottom: "1px solid var(--border-subtle)",
                  fontWeight: 600,
                  fontSize: "11px",
                  textTransform: "uppercase",
                  color: "var(--text-tertiary)"
                }}
              >
                <div></div>
                <div>{t("Task Name")}</div>
                <div>{t("Project Name")}</div>
                <div>{t("Assigned By")}</div>
              </div>

              {/* Checklist rows */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                {companyAssignedTasks.map((task) => {
                  const isChecked = selectedTasks.includes(task.id);
                  return (
                    <div
                      key={task.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "40px 2fr 1.5fr 1.5fr",
                        alignItems: "center",
                        padding: "12px 16px",
                        borderBottom: "1px solid var(--border-subtle)",
                        background: isChecked ? "rgba(46, 134, 193, 0.04)" : "transparent",
                        transition: "background 0.15s ease"
                      }}
                    >
                      <div>
                        <input
                          type="checkbox"
                          id={`task-check-${task.id}`}
                          checked={isChecked}
                          onChange={() => handleTaskToggle(task.id)}
                          style={{
                            width: "16px",
                            height: "16px",
                            cursor: "pointer"
                          }}
                        />
                      </div>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                        {task.name}
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                        {task.project}
                      </div>
                      <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                        {task.assignedBy}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Hours Spent per Task Section */}
              {selectedTasks.length > 0 && (
                <div style={{ marginTop: "24px", padding: "0 20px" }}>
                  <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>
                    {t("Hours Spent per Task")}
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "500px" }}>
                    {companyAssignedTasks.filter((t) => selectedTasks.includes(t.id)).map((task) => (
                      <div key={task.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
                        <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                          {task.name} ({task.project})
                        </div>
                        <input
                          type="number"
                          className="input"
                          placeholder="Hours spent..."
                          value={taskHours[task.id] || ""}
                          onChange={(e) => handleHoursChange(task.id, e.target.value)}
                          style={{ width: "160px" }}
                          min="0"
                          step="0.5"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Confirm button */}
              <div style={{ marginTop: "20px", padding: "0 20px" }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleConfirmTasks}
                >
                  {t("Confirm Assigned Tasks")}
                </button>
              </div>
            </div>
          </div>
      </>
    </div>
  );
}
