"use client";

import React, { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { Task } from "@/lib/data/types";

interface GanttChartProps {
  projectId?: string; // If provided, shows only this project and its tasks
  zoom?: "month" | "quarter" | "year";
}

export function GanttChart({ projectId, zoom = "month" }: GanttChartProps) {
  const data = useAppStore((state) => state.data);

  const projectsToRender = projectId
    ? data.projects.filter((p) => p.id === projectId)
    : data.projects;

  // ── Compute zoom-aware timeline bounds ──────────────────────────────────
  const { timelineStart, timelineEnd, headerCols } = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let start: Date;
    let end: Date;
    let cols: { label: string; flex?: number }[] = [];

    if (zoom === "month") {
      // 3-month rolling window: previous month, current, next
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth() + 2, 0); // last day of next month
      cols = [0, 1, 2].map((offset) => {
        const d = new Date(start.getFullYear(), start.getMonth() + offset, 1);
        return {
          label: d.toLocaleString("default", { month: "short", year: "numeric" }),
          flex: 1,
        };
      });
    } else if (zoom === "quarter") {
      // Full current year, 4 quarters
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
      cols = [
        { label: "Q1 · Jan–Mar", flex: 3 },
        { label: "Q2 · Apr–Jun", flex: 3 },
        { label: "Q3 · Jul–Sep", flex: 3 },
        { label: "Q4 · Oct–Dec", flex: 3 },
      ];
    } else {
      // Full current year as one column
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
      cols = [{ label: `${now.getFullYear()} — Full Year`, flex: 12 }];
    }

    return { timelineStart: start, timelineEnd: end, headerCols: cols };
  }, [zoom]);

  const totalMs = timelineEnd.getTime() - timelineStart.getTime();

  const dateToPercent = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 0;
    return Math.max(0, Math.min(100, ((d.getTime() - timelineStart.getTime()) / totalMs) * 100));
  };

  const durationPercent = (startStr: string, endStr: string) => {
    const s = new Date(startStr);
    const e = new Date(endStr);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 5;
    return Math.max(2, ((e.getTime() - s.getTime()) / totalMs) * 100);
  };

  const todayPct = (() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.max(0, Math.min(100, ((now.getTime() - timelineStart.getTime()) / totalMs) * 100));
  })();

  // ── Build rows ────────────────────────────────────────────────────────────
  interface GanttRow {
    id: string;
    label: string;
    sub: string;
    start: string;
    end: string;
    color: string;
    progress: number;
    isSubPhase: boolean;
    isMilestone?: boolean;
  }

  const colorPalette = ["#0EA5E9", "#38BDF8", "#818CF8", "#6366F1", "#CDB9F4", "#0284C7", "#bae6fd", "#F4C27A"];

  // Map taskId -> kanban column
  const taskColMap = new Map<string, string>();
  Object.entries(data.tasks).forEach(([col, tasks]) => {
    (tasks as Task[]).forEach((t) => taskColMap.set(t.id, col));
  });

  const rows: GanttRow[] = [];

  projectsToRender.forEach((p, idx) => {
    const color = colorPalette[idx % colorPalette.length];

    // Project bar: 6 months before due date to due date
    const projEndMs = p.dueDate ? new Date(p.dueDate).getTime() : Date.now() + 90 * 86400000;
    const projStart = new Date(projEndMs - 180 * 86400000).toISOString().split("T")[0];
    const projEnd = p.dueDate || new Date(projEndMs).toISOString().split("T")[0];

    rows.push({
      id: p.id,
      label: p.name,
      sub: p.client,
      start: projStart,
      end: projEnd,
      color,
      progress: p.progress,
      isSubPhase: false,
    });

    // Task sub-rows
    const projectTasks = Object.values(data.tasks).flat().filter((t: any) => t.project === p.id);
    projectTasks.forEach((t: any) => {
      const taskEndMs = t.dueDate ? new Date(t.dueDate).getTime() : projEndMs;
      const taskStart = new Date(taskEndMs - 14 * 86400000).toISOString().split("T")[0];
      const taskEnd = t.dueDate || new Date(taskEndMs).toISOString().split("T")[0];
      const col = taskColMap.get(t.id) || "todo";

      rows.push({
        id: `${p.id}-${t.id}`,
        label: `  ${t.title}`,
        sub: "",
        start: taskStart,
        end: taskEnd,
        color: `${color}a0`,
        progress: t.progress || (col === "done" ? 100 : col === "inprogress" ? 50 : 0),
        isSubPhase: true,
        isMilestone: t.isMilestone,
      });
    });
  });

  return (
    <div className="gantt-wrapper" style={{ overflowX: "auto" }}>
      {/* Header */}
      <div className="gantt-header" style={{ minWidth: "800px" }}>
        <div className="gantt-label-col">Project / Phase</div>
        <div className="gantt-months">
          {headerCols.map((col, i) => (
            <div
              key={i}
              className="gantt-month"
              style={{ flex: col.flex ?? 1, textAlign: "center" }}
            >
              {col.label}
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ minWidth: "800px" }}>
        {rows.map((row) => {
          const rowProjectId = row.id.split("-")[0];
          const milestones = data.milestones.filter((m) => m.project === rowProjectId);

          return (
            <div key={row.id} className="gantt-row">
              <div className="gantt-row-label">
                <div
                  className="gantt-row-name"
                  style={
                    row.isSubPhase
                      ? { paddingLeft: "16px", fontSize: "12px", color: "var(--text-secondary)" }
                      : { fontWeight: 600 }
                  }
                >
                  {row.label}
                </div>
                {row.sub && <div className="gantt-row-sub">{row.sub}</div>}
              </div>

              <div className="gantt-timeline" style={{ position: "relative" }}>
                {/* Today line */}
                {todayPct >= 0 && todayPct <= 100 && (
                  <div className="gantt-today-line" style={{ left: `${todayPct}%`, zIndex: 3 }} />
                )}

                {/* Milestone diamond task or bar */}
                {row.isMilestone ? (
                  <div
                    style={{
                      position: "absolute",
                      left: `${dateToPercent(row.end)}%`,
                      top: "50%",
                      transform: "translate(-50%, -50%) rotate(45deg)",
                      width: "12px",
                      height: "12px",
                      background: row.color,
                      border: "2px solid var(--bg-surface)",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                      cursor: "pointer",
                      zIndex: 4,
                    }}
                    title={`Milestone: ${row.label.trim()} (Due: ${row.end})`}
                  />
                ) : (
                  <div
                    className="gantt-bar"
                    style={{
                      left: `${dateToPercent(row.start)}%`,
                      width: `${durationPercent(row.start, row.end)}%`,
                      background: row.color,
                      opacity: 0.9,
                      position: "absolute",
                      top: "50%",
                      transform: "translateY(-50%)",
                    }}
                    title={`${row.label.trim()}: ${row.start} → ${row.end}`}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${row.progress}%`,
                        background: "rgba(255,255,255,0.25)",
                        borderRadius: "6px",
                      }}
                    />
                    <span style={{ position: "relative", zIndex: 1, fontSize: "10px", fontWeight: 700, paddingLeft: "6px" }}>
                      {row.progress > 0 ? `${row.progress}%` : ""}
                    </span>
                  </div>
                )}

                {/* Project-level milestone diamonds */}
                {!row.isSubPhase &&
                  milestones.map((m) => {
                    const mColor =
                      m.status === "delayed"
                        ? "#ef4444"
                        : m.status === "at-risk"
                        ? "#f59e0b"
                        : "#10b981";
                    return (
                      <div
                        key={m.id}
                        style={{
                          position: "absolute",
                          left: `${dateToPercent(m.date)}%`,
                          top: "50%",
                          transform: "translate(-50%, -50%) rotate(45deg)",
                          width: "10px",
                          height: "10px",
                          background: mColor,
                          border: "2px solid white",
                          borderRadius: "2px",
                          cursor: "pointer",
                          zIndex: 2,
                        }}
                        title={`Milestone: ${m.title} (${m.date})`}
                      />
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
