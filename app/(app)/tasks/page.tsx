"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, useTranslation } from "@/lib/store";
import { Task } from "@/lib/data/types";
import { useAuth } from "@/hooks/useAuth";
import { filterTasks, filterProjects } from "@/lib/dataFilters";
import ActionGuard from "@/components/guards/ActionGuard";
import {
  IconFolder,
  IconTimer,
  IconClose,
} from "@/components/ui/Icons";
import { Sparkles } from "lucide-react";
import AIPageComponent from "@/components/layout/AIPageComponent";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";

type TaskCol = "todo" | "inprogress" | "review" | "done";
const COL_LABELS: Record<TaskCol, string> = {
  todo: "To Do",
  inprogress: "In Progress",
  review: "In Review",
  done: "Done",
};
const COL_COLORS: Record<TaskCol, string> = {
  todo: "#64748b",
  inprogress: "#2563eb",
  review: "#f59e0b",
  done: "#10b981",
};
const COL_BADGE: Record<TaskCol, string> = {
  todo: "badge-gray",
  inprogress: "badge-brand",
  review: "badge-warning",
  done: "badge-success",
};
const PRIORITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#10b981",
};

const getCompletionStatus = (dueDate: string, actualCompletionDate?: string, t?: (key: string) => string) => {
  if (!actualCompletionDate) return null;
  const translate = t || ((s: string) => s);
  
  const due = new Date(dueDate);
  const comp = new Date(actualCompletionDate);
  
  due.setHours(0, 0, 0, 0);
  comp.setHours(0, 0, 0, 0);
  
  const diffTime = comp.getTime() - due.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    const daysVal = Math.abs(diffDays);
    return {
      status: "early" as const,
      label: `${daysVal} ${daysVal === 1 ? translate("day early") : translate("days early")}`,
      color: "#10b981", // green
      badge: "🟢",
    };
  } else if (diffDays === 0) {
    return {
      status: "on-time" as const,
      label: translate("On time"),
      color: "#64748b", // gray
      badge: "⚪",
    };
  } else {
    return {
      status: "delayed" as const,
      label: `${translate("Delayed by")} ${diffDays} ${diffDays === 1 ? translate("day") : translate("days")}`,
      color: "#ef4444", // red
      badge: "🔴",
    };
  }
};

function TaskCard({
  task,
  col,
  consultants,
  onOpen,
}: {
  task: Task;
  col: TaskCol;
  consultants: { id: string; name: string; avatar: string; color: string }[];
  onOpen: (t: Task, c: TaskCol) => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const data = useAppStore((state) => state.data);
  const project = data.projects.find((p) => p.id === task.project);
  
  const isAssignee = task.assignee === user?.id;
  const isManager = user?.role === "super_admin" || user?.role === "Super Admin" || user?.role === "project_manager" || user?.role === "Project Manager";
  const isSeniorConsultant = user?.role === "senior_consultant" || user?.role === "Senior Consultant";
  const canMove = (isAssignee || isManager || isSeniorConsultant) && !(!isManager && col === "done");

  const attributesAndListeners = useDraggable({
    id: task.id,
    disabled: !canMove,
  });
  const { attributes, listeners, setNodeRef, transform, isDragging } = attributesAndListeners;

  const c = consultants.find((x) => x.id === task.assignee) || {
    color: "#64748b",
    avatar: "?",
    name: task.assignee,
  };
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  const comp = col === "done" && task.actualCompletionDate ? getCompletionStatus(task.dueDate, task.actualCompletionDate, t) : null;

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        opacity: isDragging ? 0.4 : 1,
        cursor: canMove ? "grab" : "default",
      }}
      {...(canMove ? listeners : {})}
      {...attributes}
    >
      <div
        className="card"
        style={{
          marginBottom: "10px",
          padding: "14px",
          cursor: "pointer",
          transition: "all 0.2s",
          border: comp?.status === "early" ? "1px solid #10b981" : comp?.status === "delayed" ? "1px solid #ef4444" : undefined,
          borderLeft: `3px solid ${PRIORITY_COLORS[task.priority] || "#64748b"}`,
          ...(comp?.status === "early" ? { borderLeftColor: "#10b981" } : {}),
          ...(comp?.status === "delayed" ? { borderLeftColor: "#ef4444" } : {}),
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-lg)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ""; (e.currentTarget as HTMLElement).style.boxShadow = ""; }}
        onClick={(e) => {
          e.stopPropagation();
          onOpen(task, col);
        }}
      >
        {(Array.isArray(task.tags) ? task.tags : (typeof task.tags === "string" && task.tags ? (task.tags as string).split(",") : [])).length > 0 && (
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "8px" }}>
          {(Array.isArray(task.tags) ? task.tags : (typeof task.tags === "string" && task.tags ? (task.tags as string).split(",") : [])).map((tag, idx) => (
            <span key={idx} className="badge badge-gray" style={{ fontSize: "10px" }}>{typeof tag === 'string' ? tag.trim() : tag}</span>
          ))}
        </div>
      )}
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px", lineHeight: 1.4 }}>
          {task.title}
        </div>
        {project && (
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "4px" }}>
            <IconFolder size={12} /> {project.name}
          </div>
        )}
        {task.progress !== undefined && (
          <div style={{ marginBottom: "10px" }}>
            <div className="progress-bar" style={{ height: "4px" }}>
              <div className="progress-fill" style={{ width: `${task.progress}%` }} />
            </div>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <div className="avatar" style={{ background: c.color, width: "22px", height: "22px", minWidth: "22px", fontSize: "8px" }}>
              {c.avatar}
            </div>
            <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{c.name.split(" ")[0]}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {comp && (
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  color: comp.color,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "2px",
                  marginRight: "4px",
                }}
                title={t("Completion Status")}
              >
                <span>{comp.badge}</span>
                <span>{comp.label}</span>
              </span>
            )}
            <span style={{ fontSize: "10.5px", color: "var(--text-tertiary)", display: "inline-flex", alignItems: "center", gap: "3px" }}><IconTimer size={10} /> {task.estimate}h</span>
            <span style={{ fontSize: "10.5px", fontWeight: 700, color: PRIORITY_COLORS[task.priority] }}>
              {t(task.priority.charAt(0).toUpperCase() + task.priority.slice(1))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({
  col,
  tasks,
  consultants,
  onOpen,
}: {
  col: TaskCol;
  tasks: Task[];
  consultants: { id: string; name: string; avatar: string; color: string }[];
  onOpen: (t: Task, c: TaskCol) => void;
}) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: col });
  return (
    <div className="kanban-column" style={{ flex: 1, minWidth: 0 }}>
      <div className="kanban-column-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: COL_COLORS[col] }} />
          <span className="kanban-column-title">{t(COL_LABELS[col])}</span>
          <span className="badge badge-gray" style={{ fontSize: "10px" }}>{tasks.length}</span>
        </div>
        <button className="btn btn-ghost btn-icon btn-sm">+</button>
      </div>
      <div
        ref={setNodeRef}
        style={{
          minHeight: "200px",
          padding: "4px 0",
          borderRadius: "8px",
          background: isOver ? "var(--brand-50)" : "transparent",
          transition: "background 0.2s",
        }}
      >
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} col={col} consultants={consultants} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function TaskDrawer({
  task,
  col,
  consultants,
  onClose,
  onOpenAiInline,
}: {
  task: Task;
  col: TaskCol;
  consultants: { id: string; name: string; avatar: string; color: string }[];
  onClose: () => void;
  onOpenAiInline: (view: "delay-dashboard" | "assignment-dashboard" | "clash-dashboard" | null, modal: "estimate-tasks" | null, taskId?: string | null) => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const c = consultants.find((x) => x.id === task.assignee) || { color: "#64748b", avatar: "?", name: task.assignee };
  const addTaskComment = useAppStore((state) => state.addTaskComment);
  const addSubtaskToTask = useAppStore((state) => state.addSubtaskToTask);
  const moveTask = useAppStore((state) => state.moveTask);
  const showToast = useAppStore((state) => state.showToast);
  const deleteTaskComments = useAppStore((state) => state.deleteTaskComments);
  const data = useAppStore((state) => state.data);
  const { user } = useAuth();
  const projects = useAppStore((state) => state.data.projects);
  const projectName = projects.find((p) => p.id === task.project)?.name || task.project;

  const isManager = user?.role?.toLowerCase() === "super_admin" || user?.role?.toLowerCase() === "project_manager";
  const [showReviewModal, setShowReviewModal] = React.useState(col === "review" && isManager);

  const [manageCommentsMode, setManageCommentsMode] = React.useState(false);
  const [selectedCommentIds, setSelectedCommentIds] = React.useState<string[]>([]);

  const [commentText, setCommentText] = React.useState("");
  const [showAddSubtask, setShowAddSubtask] = React.useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = React.useState("");
  const [newSubtaskDue, setNewSubtaskDue] = React.useState("");

  // Rejection Form State
  const [showRejectForm, setShowRejectForm] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");
  const [rejectAssignee, setRejectAssignee] = React.useState(task.assignee);
  const [rejectEfficiency, setRejectEfficiency] = React.useState("5");
  const [rejectDue, setRejectDue] = React.useState(task.dueDate || "");

  const handleSatisfiedYes = () => {
    moveTask(task.id, "done", new Date().toISOString().split("T")[0]);
    showToast("Task moved to Done", "success");
    onClose();
  };

  const handleSatisfiedNo = () => {
    setShowRejectForm(true);
  };

  const handleSubmitRejection = () => {
    if (!rejectReason.trim()) {
      showToast("Please provide a reason", "danger");
      return;
    }
    
    // 1. Sync efficiency penalty via sessionStorage (Targeting Timesheet Module)
    if (rejectEfficiency && !isNaN(Number(rejectEfficiency))) {
      const currentPenaltyStr = sessionStorage.getItem(`efficiency_penalty_${c.name}`) || "0";
      const currentPenalty = parseInt(currentPenaltyStr, 10);
      sessionStorage.setItem(`efficiency_penalty_${c.name}`, (currentPenalty + parseInt(rejectEfficiency, 10)).toString());
    }

    if (rejectDue && rejectDue !== task.dueDate) {
      const today = new Date().toISOString().split("T")[0];
      if (rejectDue < today) {
        showToast("New due date cannot be set in the past", "danger");
        return;
      }
    }

    // 2. Local State Optimistic Update: Move to inprogress & update assignee
    useAppStore.setState((state) => {
      const newTasks = { ...state.data.tasks };
      let foundTask = null;

      // Remove from current column
      for (const column of Object.keys(newTasks)) {
        const list = newTasks[column as keyof typeof newTasks];
        const idx = list.findIndex(t => t.id === task.id);
        if (idx !== -1) {
          foundTask = { ...list[idx], assignee: rejectAssignee, dueDate: rejectDue };
          newTasks[column as keyof typeof newTasks] = list.filter(t => t.id !== task.id);
          break;
        }
      }

      // Add to inprogress
      if (foundTask) {
        newTasks.inprogress = [foundTask, ...(newTasks.inprogress || [])];
      }

      return { data: { ...state.data, tasks: newTasks } };
    });

    // 3. Add comment
    addTaskComment(task.id, `Task Rejected: ${rejectReason}`);

    // 4. Update Assignee and Status via API
    fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "inprogress",
        assigneeId: rejectAssignee,
        dueDate: rejectDue
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to update task");
        // Refetch with cache buster to ensure next reload is fully synced with DB
        return fetch(`/api/tasks?_t=${Date.now()}`, { cache: "no-store" });
      })
      .then((res) => res.json())
      .then((tasks) => {
        // Update with fresh un-cached DB data
        useAppStore.setState((state) => ({
          data: { ...state.data, tasks },
        }));
      })
      .catch((err) => {
        showToast("Error updating task: " + err.message, "danger");
      });
      
    showToast("Task rejected and moved to In Progress", "warning");
    onClose();
  };

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    addTaskComment(task.id, commentText);
    setCommentText("");
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim() || !newSubtaskDue) return;
    addSubtaskToTask(task.id, {
      title: newSubtaskTitle,
      dueDate: newSubtaskDue,
      status: "Not Started",
    });
    setNewSubtaskTitle("");
    setNewSubtaskDue("");
    setShowAddSubtask(false);
  };

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 498 }}
        onClick={onClose}
      />
      <div
        className="task-drawer open"
        style={{
          position: "fixed", top: 0, right: 0, width: "420px", height: "100vh",
          background: "var(--bg-surface)", borderLeft: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-xl)", zIndex: 499, overflowY: "auto", padding: "24px",
        }}
      >
        {showReviewModal && (
          <div style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 600,
            padding: "24px"
          }}>
            <div className="card" style={{
              background: "var(--bg-surface)",
              padding: "24px",
              borderRadius: "12px",
              border: "1px solid var(--border-default)",
              width: "100%",
              boxShadow: "var(--shadow-xl)",
              display: "flex",
              flexDirection: "column",
              gap: "16px"
            }}>
              {!showRejectForm ? (
                <>
                  <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                    {t("Are you satisfied with this work?")}
                  </h3>
                  <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.4, margin: 0 }}>
                    {t("This task is currently In Review. You can approve it to mark it Done, or reject it back to In Progress.")}
                  </p>
                  <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowReviewModal(false)}>{t("Dismiss")}</button>
                    <button className="btn btn-danger btn-sm" onClick={() => setShowRejectForm(true)}>{t("Reject")}</button>
                    <button className="btn btn-success btn-sm" onClick={handleSatisfiedYes}>{t("Approve")}</button>
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                    {t("Reject Work")}
                  </h3>
                  
                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>{t("Reason")}</label>
                    <textarea 
                      className="input" 
                      placeholder={t("Provide reason for rejecting...")}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      style={{ width: "100%", minHeight: "60px", resize: "vertical", fontSize: "12px" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>{t("New Assignee")}</label>
                    <SearchableSelect
                      className="select"
                      value={rejectAssignee}
                      onChange={(val) => setRejectAssignee(val)}
                      placeholder="Select Assignee"
                      options={consultants.map(cons => ({ label: cons.name, value: cons.id }))}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>{t("Reduce Efficiency (Current Assignee: {name})").replace("{name}", c.name)}</label>
                    <input 
                      type="number"
                      className="input" 
                      value={rejectEfficiency}
                      onChange={(e) => setRejectEfficiency(e.target.value)}
                      min="0"
                      max="100"
                      style={{ width: "100%", fontSize: "12px", padding: "6px" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>{t("New Due Date")}</label>
                    <input 
                      type="date"
                      className="input" 
                      value={rejectDue}
                      onChange={(e) => setRejectDue(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      style={{ width: "100%", fontSize: "12px", padding: "6px" }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px" }}>
                    <button className="btn btn-sm" style={{ background: "var(--bg-surface-3)" }} onClick={() => { setShowRejectForm(false); setShowReviewModal(false); }}>{t("Cancel")}</button>
                    <button className="btn btn-primary btn-sm" onClick={handleSubmitRejection}>{t("Submit")}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className={`badge ${COL_BADGE[col]}`}>{t(COL_LABELS[col])}</span>
            <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{projectName}</span>
          </div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><IconClose size={13} /></button>
        </div>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px", lineHeight: 1.4 }}>{task.title}</h2>

        {col === "review" && !isManager && (
          <div style={{ marginBottom: "20px", padding: "16px", border: "1px solid var(--border-default)", borderRadius: "10px", background: "var(--bg-surface-2)" }}>
            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              {t("This task is currently In Review. A Project Manager or Super Admin will approve or reject it.")}
            </span>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
          {[
            { label: t("Priority"), value: (<span style={{ fontWeight: 700, color: PRIORITY_COLORS[task.priority] }}>{t(task.priority.charAt(0).toUpperCase() + task.priority.slice(1))}</span>) },
            { label: t("Due Date"), value: task.dueDate },
            { label: t("Estimate"), value: `${task.estimate}h` },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: "10.5px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>{label}</div>
              <div style={{ fontSize: "13px", color: "var(--text-primary)" }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Multiple Assignees section */}
        {(() => {
          const project = data.projects.find((p) => p.id === task.project);
          const projectTeamIds = project?.team || [];
          const eligibleUsers = (data.users || []).filter((u: any) => projectTeamIds.includes(u.id));
          const currentAssignees = task.assignees && task.assignees.length > 0 ? task.assignees : [task.assignee];
          const unassignedProjectUsers = eligibleUsers.filter((u: any) => !currentAssignees.includes(u.id));

          return (
            <div style={{ marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ fontSize: "10.5px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {t("Assignees")}
                </div>
                
                {unassignedProjectUsers.length > 0 && (
                  <SearchableSelect
                    className="select"
                    value=""
                    onChange={(newUserId) => {
                      if (newUserId) {
                        const updated = Array.from(new Set([...currentAssignees, newUserId]));
                        useAppStore.getState().updateTask(task.id, { assignees: updated });
                      }
                    }}
                    placeholder={`+ ${t("Add Member")}`}
                    options={unassignedProjectUsers.map((u: any) => ({ label: u.name, value: u.id }))}
                  />
                )}
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {currentAssignees.map((userId) => {
                  const u = (data.users || []).find((x: any) => x.id === userId) || { name: userId, avatar: "?", color: "#64748b" };
                  const initial = u.name.split(" ").map((n: any) => n[0]).join("").toUpperCase().slice(0, 2);
                  return (
                    <div 
                      key={userId} 
                      style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        gap: "6px", 
                        padding: "4px 8px", 
                        background: "var(--bg-surface-2)", 
                        borderRadius: "20px", 
                        border: "1px solid var(--border-subtle)" 
                      }}
                    >
                      <div className="avatar" style={{ background: (u as any).color || "#64748b", width: "18px", height: "18px", fontSize: "7.5px" }}>
                        {initial}
                      </div>
                      <span style={{ fontSize: "12px", color: "var(--text-primary)" }}>{u.name}</span>
                      {currentAssignees.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = currentAssignees.filter((id) => id !== userId);
                            useAppStore.getState().updateTask(task.id, { 
                              assignees: updated,
                              assignee: userId === task.assignee ? updated[0] : undefined
                            });
                          }}
                          style={{ 
                            background: "none", 
                            border: "none", 
                            color: "var(--text-tertiary)", 
                            cursor: "pointer", 
                            padding: 0, 
                            fontSize: "13px",
                            lineHeight: 1,
                            marginLeft: "2px"
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
        {task.progress !== undefined && (
          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{t("Progress")}</span>
              <span style={{ fontSize: "12px", fontWeight: 700 }}>{task.progress}%</span>
            </div>
            <div className="progress-bar" style={{ height: "8px" }}>
              <div className="progress-fill" style={{ width: `${task.progress}%` }} />
            </div>
          </div>
        )}
        {(Array.isArray(task.tags) ? task.tags : (typeof task.tags === "string" && task.tags ? (task.tags as string).split(",") : [])).length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "10.5px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>{t("Tags")}</div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {(Array.isArray(task.tags) ? task.tags : (typeof task.tags === "string" && task.tags ? (task.tags as string).split(",") : [])).map((t, idx) => <span key={idx} className="badge badge-brand" style={{ fontSize: "11px" }}>{typeof t === 'string' ? t.trim() : t}</span>)}
            </div>
          </div>
        )}

        {/* Subtasks section with add button */}
        <div style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <div style={{ fontSize: "10.5px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {t("Subtasks")} {task.subtasks && task.subtasks.length > 0 ? `(${task.subtasks.length})` : ""}
            </div>
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: "11px", padding: "2px 8px" }}
              onClick={() => setShowAddSubtask(!showAddSubtask)}
            >
              + {t("Add")}
            </button>
          </div>

          {showAddSubtask && (
            <div style={{ padding: "12px", border: "1px solid var(--border-subtle)", borderRadius: "8px", background: "var(--bg-surface-2)", marginBottom: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <input
                className="login-input"
                type="text"
                placeholder={t("Subtask title")}
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                style={{ fontSize: "12px", height: "34px" }}
              />
              <input
                className="login-input"
                type="date"
                value={newSubtaskDue}
                onChange={(e) => setNewSubtaskDue(e.target.value)}
                style={{ fontSize: "12px", height: "34px" }}
              />
              <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                <button className="btn btn-sm" style={{ fontSize: "12px", padding: "4px 10px", background: "var(--bg-surface-3)" }} onClick={() => setShowAddSubtask(false)}>{t("Cancel")}</button>
                <button className="btn btn-primary btn-sm" style={{ fontSize: "12px", padding: "4px 10px" }} onClick={handleAddSubtask}>{t("Add Subtask")}</button>
              </div>
            </div>
          )}

          {task.subtasks && task.subtasks.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {task.subtasks.map((sub, sIdx) => (
                <div key={sIdx} style={{ padding: "10px 12px", border: "1px solid var(--border-subtle)", borderRadius: "6px", background: "var(--bg-surface-2)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                      {sub.isMilestone && (
                        <span
                          style={{
                            width: "8px",
                            height: "8px",
                            background: sub.status === "Completed" ? "#10b981" : sub.status === "In Progress" ? "#f59e0b" : "#94a3b8",
                            transform: "rotate(45deg)",
                            borderRadius: "1px",
                            display: "inline-block",
                          }}
                          title={`Milestone: ${sub.status}`}
                        />
                      )}
                      {sub.title}
                    </span>
                    <span style={{ fontSize: "11px", color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      {sub.dueDate}
                    </span>
                  </div>
                  {sub.description && (
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>{sub.description}</div>
                  )}
                </div>
              ))}
            </div>
          ) : !showAddSubtask ? (
            <div style={{ fontSize: "12px", color: "var(--text-tertiary)", fontStyle: "italic" }}>{t("No subtasks yet. Click + Add to create one.")}</div>
          ) : null}
        </div>

        {task.comments && task.comments.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div style={{ fontSize: "10.5px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {t("Comments")} ({task.comments.length})
              </div>
              {task.comments.some((c) => c.user === user?.name) && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: "11px", padding: "2px 8px", color: manageCommentsMode ? "var(--text-primary)" : "var(--text-secondary)" }}
                  onClick={() => {
                    if (manageCommentsMode) {
                      setManageCommentsMode(false);
                      setSelectedCommentIds([]);
                    } else {
                      setManageCommentsMode(true);
                    }
                  }}
                >
                  {manageCommentsMode ? t("Cancel") : t("Manage")}
                </button>
              )}
            </div>

            {manageCommentsMode && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", padding: "8px", background: "var(--bg-surface-2)", borderRadius: "6px" }}>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: "11px", padding: "2px 8px" }}
                  onClick={() => {
                    const userCommentIds = task.comments!.filter(c => c.user === user?.name).map(c => c.id);
                    if (selectedCommentIds.length === userCommentIds.length) {
                      setSelectedCommentIds([]);
                    } else {
                      setSelectedCommentIds(userCommentIds);
                    }
                  }}
                >
                  {selectedCommentIds.length === task.comments!.filter(c => c.user === user?.name).length && selectedCommentIds.length > 0 ? "Deselect All" : "Select All"}
                </button>
                {selectedCommentIds.length > 0 && (
                  <button
                    className="btn btn-sm"
                    style={{ fontSize: "11px", padding: "2px 8px", background: "#ef4444", color: "white", border: "none" }}
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to delete ${selectedCommentIds.length} comment(s)?`)) {
                        deleteTaskComments(task.id, selectedCommentIds);
                        setManageCommentsMode(false);
                        setSelectedCommentIds([]);
                      }
                    }}
                  >
                    {t("Delete Selected")} ({selectedCommentIds.length})
                  </button>
                )}
              </div>
            )}

            {task.comments.map((cm) => (
              <div key={cm.id} style={{ display: "flex", gap: "10px", marginBottom: "14px", alignItems: "flex-start" }}>
                {manageCommentsMode && cm.user === user?.name && (
                  <input
                    type="checkbox"
                    checked={selectedCommentIds.includes(cm.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedCommentIds([...selectedCommentIds, cm.id]);
                      else setSelectedCommentIds(selectedCommentIds.filter(id => id !== cm.id));
                    }}
                    style={{ marginTop: "6px" }}
                  />
                )}
                <div className="avatar" style={{ background: cm.color, width: "28px", height: "28px", minWidth: "28px", fontSize: "9px" }}>{cm.avatar}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600 }}>{cm.user}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{cm.time}</span>
                      {!manageCommentsMode && cm.user === user?.name && (
                        <button
                          style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", display: "flex", alignItems: "center", color: "var(--text-tertiary)" }}
                          title="Delete comment"
                          onClick={() => {
                            if (window.confirm("Are you sure you want to delete this comment?")) {
                              deleteTaskComments(task.id, [cm.id]);
                            }
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.5 }}>{cm.text}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Contextual AI recommendations */}
        {user && ["super_admin", "project_manager"].includes(user.role) && (
          <div style={{ 
            marginTop: "24px", 
            paddingTop: "16px", 
            borderTop: "1px solid var(--border-subtle)", 
            display: "flex", 
            flexDirection: "column", 
            gap: "12px" 
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Sparkles size={13} style={{ color: "#2563eb" }} />
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {t("AI Suggestions & Copilot")}
              </span>
            </div>

            {/* Recommendation 1: Time Estimation */}
            <div style={{
              background: "linear-gradient(135deg, rgba(37, 99, 235, 0.04) 0%, rgba(20, 184, 166, 0.04) 100%)",
              border: "1px solid rgba(37, 99, 235, 0.12)",
              borderRadius: "8px",
              padding: "12px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>
                  {t("Need help estimating this task?")}
                </span>
                <span className="badge badge-brand" style={{ fontSize: "9px", padding: "1px 4px" }}>{t("AI Est")}</span>
              </div>
              <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: "0 0 10px 0", lineHeight: "1.3" }}>
                {t("Estimate task duration, view confidence level, and predict completion dates using central models.")}
              </p>
              <div style={{ display: "flex", gap: "6px" }}>
                <button 
                  className="btn btn-primary btn-sm" 
                  onClick={() => {
                    onClose();
                    onOpenAiInline(null, "estimate-tasks", task.id);
                  }}
                  style={{ flex: 1, fontSize: "10px", padding: "3px 6px", height: "26px", justifyContent: "center" }}
                >
                  {t("Estimate Task Duration")}
                </button>
              </div>
            </div>

            {/* Recommendation 2: Delay Analysis */}
            <div style={{
              background: "linear-gradient(135deg, rgba(224, 155, 45, 0.04) 0%, rgba(20, 184, 166, 0.04) 100%)",
              border: "1px solid rgba(224, 155, 45, 0.12)",
              borderRadius: "8px",
              padding: "12px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>
                  {t("Analyze Delay Risk")}
                </span>
                <span className="badge badge-warning" style={{ fontSize: "9px", padding: "1px 4px" }}>{t("AI Risk")}</span>
              </div>
              <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: "0 0 10px 0", lineHeight: "1.3" }}>
                {t("Scan delay risk level, isolate dependency root causes, and view suggested fixes.")}
              </p>
              <div style={{ display: "flex", gap: "6px" }}>
                <button 
                  className="btn btn-primary btn-sm" 
                  onClick={() => {
                    onClose();
                    onOpenAiInline("delay-dashboard", null, task.id);
                  }}
                  style={{ flex: 1, fontSize: "10px", padding: "3px 6px", height: "26px", justifyContent: "center" }}
                >
                  {t("Analyze Delay Risk")}
                </button>
              </div>
            </div>

            {/* Recommendation 3: Resource Assigner */}
            <div style={{
              background: "linear-gradient(135deg, rgba(99, 102, 241, 0.04) 0%, rgba(20, 184, 166, 0.04) 100%)",
              border: "1px solid rgba(99, 102, 241, 0.12)",
              borderRadius: "8px",
              padding: "12px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>
                  {t("Assign Best Resource using AI")}
                </span>
                <span className="badge badge-success" style={{ fontSize: "9px", padding: "1px 4px" }}>{t("AI Match")}</span>
              </div>
              <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: "0 0 10px 0", lineHeight: "1.3" }}>
                {t("Recommend optimal assignee based on skills profile, workload balance, and reasoning.")}
              </p>
              <div style={{ display: "flex", gap: "6px" }}>
                <button 
                  className="btn btn-primary btn-sm" 
                  onClick={() => {
                    onClose();
                    onOpenAiInline("assignment-dashboard", null, task.id);
                  }}
                  style={{ flex: 1, fontSize: "10px", padding: "3px 6px", height: "26px", justifyContent: "center" }}
                >
                  {t("Assign Best Resource")}
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--border-subtle)" }}>
          <textarea
            className="input"
            placeholder={t("Add a comment...")}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            style={{ width: "100%", minHeight: "80px", resize: "vertical", marginBottom: "8px" }}
          />
          <button className="btn btn-primary btn-sm" onClick={handleAddComment}>{t("Add Comment")}</button>
        </div>
      </div>
    </>
  );
}

export default function TasksPage() {
  const router = useRouter();
  const [showAiCopilot, setShowAiCopilot] = useState(true);
  const data = useAppStore((state) => state.data);

  const allEligibleAssignees = React.useMemo(() => {
    const list: { id: string; name: string; avatar: string; color: string; role?: string }[] = [];
    
    // 1. Add all from data.users
    if (data.users && Array.isArray(data.users)) {
      for (const u of data.users) {
        const existingConsultant = data.consultants.find((c) => c.id === u.id || c.name === u.name);
        const initials = u.name.split(" ").map((n: any) => n[0]).join("").toUpperCase().slice(0, 2);
        list.push({
          id: u.id,
          name: u.name,
          avatar: existingConsultant?.avatar || initials || "?",
          color: existingConsultant?.color || "#64748b",
          role: u.role
        });
      }
    }

    // 2. Add any other from data.consultants that are not in list
    for (const c of data.consultants) {
      if (!list.find((x) => x.id === c.id)) {
        list.push({
          id: c.id,
          name: c.name,
          avatar: c.avatar,
          color: c.color,
          role: c.role
        });
      }
    }

    return list;
  }, [data.users, data.consultants]);
  const [embeddedAiView, setEmbeddedAiView] = useState<"delay-dashboard" | "assignment-dashboard" | "clash-dashboard" | null>(null);
  const [embeddedAiModal, setEmbeddedAiModal] = useState<"estimate-tasks" | null>(null);
  const [embeddedAiTaskId, setEmbeddedAiTaskId] = useState<string | null>(null);
  const setSidebarCollapsed = useAppStore((state) => state.setSidebarCollapsed);
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);
  const [prevSidebarState, setPrevSidebarState] = useState<boolean | null>(null);

  React.useEffect(() => {
    if (embeddedAiView || embeddedAiModal) {
      if (prevSidebarState === null) {
        setPrevSidebarState(sidebarCollapsed);
      }
      setSidebarCollapsed(true);
      document.body.style.overflow = "hidden";
    } else if (embeddedAiView === null && embeddedAiModal === null && prevSidebarState !== null) {
      setSidebarCollapsed(prevSidebarState);
      setPrevSidebarState(null);
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [embeddedAiView, embeddedAiModal, setSidebarCollapsed, sidebarCollapsed, prevSidebarState]);
  const { t } = useTranslation();
  const { user } = useAuth();
  const visibleProjects = user ? filterProjects(data.projects, user) : [];
  const moveTask = useAppStore((state) => state.moveTask);
  const addTask = useAppStore((state) => state.addTask);
  const showToast = useAppStore((state) => state.showToast);
  const [taskView, setTaskView] = useState<"kanban" | "list" | "tree">("kanban");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drawerTask, setDrawerTask] = useState<{ task: Task; col: TaskCol } | null>(null);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState("all");

  React.useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'close-ai-modal') {
        setEmbeddedAiView(null);
        setEmbeddedAiModal(null);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Add Task Modal State
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [ntTitle, setNtTitle] = useState("");
  const [ntProject, setNtProject] = useState("");
  const [ntAssignees, setNtAssignees] = useState<{ id: string; hours: string }[]>([]);

  const createModalProject = data.projects.find((p) => p.id === ntProject);
  const createModalTeamIds = createModalProject?.team || [];
  const createModalEligibleAssignees = React.useMemo(() => {
    if (user?.role === "super_admin" || user?.role === "project_manager") {
      return allEligibleAssignees;
    }
    return createModalTeamIds.length > 0 
      ? allEligibleAssignees.filter((c) => createModalTeamIds.includes(c.id))
      : allEligibleAssignees;
  }, [createModalTeamIds, allEligibleAssignees, user?.role]);
  const totalAllocatedHours = ntAssignees.reduce((acc, curr) => acc + (parseFloat(curr.hours) || 0), 0);
  const [ntPriority, setNtPriority] = useState<any>("");
  const [ntDue, setNtDue] = useState("");
  const [ntEstimate, setNtEstimate] = useState("");
  const [ntTags, setNtTags] = useState("");
  const [ntIsMilestone, setNtIsMilestone] = useState(false);
  const [ntStatus, setNtStatus] = useState<"todo" | "inprogress" | "done">("todo");

  // AI Estimate State
  const [showAiEstimate, setShowAiEstimate] = useState(false);
  const [aiEstHeading, setAiEstHeading] = useState("");
  const [aiEstPeople, setAiEstPeople] = useState("1");
  const [aiEstPriority, setAiEstPriority] = useState("medium");
  const [aiEstDesc, setAiEstDesc] = useState("");
  const [aiEstResult, setAiEstResult] = useState<string | null>(null);
  const [aiEstNumber, setAiEstNumber] = useState<number | null>(null);
  const [isAiEstimating, setIsAiEstimating] = useState(false);

  const [aiEstMeta, setAiEstMeta] = useState<{
    difficulty: string;
    riskLevel: string;
    confidence: number;
    reasoning: string;
    isFallback?: boolean;
  } | null>(null);

  const handleGenerateAiEstimate = async () => {
    if (!aiEstHeading.trim() || !aiEstDesc.trim()) {
      setAiEstNumber(null);
      setAiEstMeta(null);
      setAiEstResult("Please enter the task name and description to generate an estimate.");
      return;
    }

    setIsAiEstimating(true);
    setAiEstResult(null);
    setAiEstMeta(null);

    try {
      const res = await fetch("/api/ai/estimate-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          taskName: `${aiEstHeading}: ${aiEstDesc}`,
          priority: aiEstPriority,
          teamSize: parseInt(aiEstPeople) || 1,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();
      const hrs = data.estimatedHours ?? data.hours ?? 8;

      setAiEstNumber(hrs);
      setAiEstResult(`Suggested Estimate → ${hrs} Hours`);
      setAiEstMeta({
        difficulty: data.difficulty || "Medium",
        riskLevel: data.riskLevel || "Low",
        confidence: data.confidenceScore || 75,
        reasoning: data.reasoning || "Estimated using historical task context.",
        isFallback: data.confidenceScore !== undefined && data.confidenceScore <= 75 && !data.historicalTasks?.length,
      });
    } catch (err: any) {
      // Local heuristic fallback if server call fails
      const people = parseInt(aiEstPeople) || 1;
      const multipliers: Record<string, number> = { low: 0.8, medium: 1, high: 1.5, critical: 2 };
      const base = 8 + Math.min(16, Math.floor((aiEstHeading.length + aiEstDesc.length) / 20) * 4);
      const finalEstimate = Math.round((base * (multipliers[aiEstPriority] || 1)) / Math.max(1, people * 0.8));
      setAiEstNumber(finalEstimate);
      setAiEstResult(`Suggested Estimate → ${finalEstimate} Hours`);
      setAiEstMeta({
        difficulty: "Medium",
        riskLevel: "Medium",
        confidence: 60,
        reasoning: "Local heuristic used — AI service unavailable.",
        isFallback: true,
      });
    } finally {
      setIsAiEstimating(false);
    }
  };

  // Completion Modal State
  const [completionModalTask, setCompletionModalTask] = useState<{ task: Task; newCol: TaskCol } | null>(null);
  const [completionDate, setCompletionDate] = useState("");

  const handleConfirmCompletion = () => {
    if (!completionModalTask || !completionDate) return;
    moveTask(completionModalTask.task.id, completionModalTask.newCol, completionDate);
    showToast(`${t("Task moved to")} ${COL_LABELS[completionModalTask.newCol]}`, "success");
    setCompletionModalTask(null);
  };

  const handleCancelCompletion = () => {
    setCompletionModalTask(null);
  };

  // Subtasks State
  const [subtasks, setSubtasks] = useState<{ title: string; dueDate: string; description?: string; isMilestone?: boolean; status?: 'Not Started' | 'In Progress' | 'Completed' }[]>([]);
  const [subtaskErrors, setSubtaskErrors] = useState<string[]>([]);

  React.useEffect(() => {
    if (visibleProjects.length > 0) {
      setNtProject(visibleProjects[0].id);
    }
    // Fixed Issue 1: Do not force an initial assignee. Let it remain empty.
  }, [data, visibleProjects, showTaskModal]);

  // Real-time validation for subtasks deadlines against main task deadline
  React.useEffect(() => {
    const nextErrors = subtasks.map((sub) => {
      if (sub.dueDate && ntDue && new Date(sub.dueDate) >= new Date(ntDue)) {
        return "Subtask deadline must be earlier than the main task deadline.";
      }
      return "";
    });
    setSubtaskErrors(nextErrors);
  }, [subtasks, ntDue]);

  const handleAddSubtaskField = () => {
    setSubtasks([...subtasks, { title: "", dueDate: "", description: "", isMilestone: false, status: "Not Started" }]);
    setSubtaskErrors([...subtaskErrors, ""]);
  };

  const handleRemoveSubtaskField = (index: number) => {
    setSubtasks(subtasks.filter((_, idx) => idx !== index));
    setSubtaskErrors(subtaskErrors.filter((_, idx) => idx !== index));
  };

  const handleUpdateSubtaskField = (index: number, key: string, value: any) => {
    const updated = [...subtasks];
    updated[index] = { ...updated[index], [key]: value };
    setSubtasks(updated);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ntTitle || !ntProject || ntAssignees.length === 0) {
      showToast("Please fill all required fields (Title, Project, Assignees).", "danger");
      return;
    }

    // Final validation checklist
    let hasError = false;
    const errors = subtasks.map((sub) => {
      if (sub.dueDate && ntDue && new Date(sub.dueDate) >= new Date(ntDue)) {
        hasError = true;
        return "Subtask deadline must be earlier than the main task deadline.";
      }
      return "";
    });

    if (hasError) {
      setSubtaskErrors(errors);
      showToast("Subtask deadline must be earlier than the main task deadline.", "danger");
      return;
    }

    addTask({
      title: ntTitle,
      project: ntProject,
      assignee: ntAssignees.length > 0 ? ntAssignees[0].id : "",
      priority: (ntPriority || "None") as any,
      dueDate: ntDue || "",
      estimate: ntEstimate !== "" ? parseFloat(ntEstimate) : 0,
      tags: ntTags ? ntTags.split(",").map(t => t.trim()).filter(Boolean) : [],
      subtasks: subtasks.filter(sub => sub.title.trim() !== ""),
      isMilestone: ntIsMilestone,
      col: ntStatus,
    });

    // Reset Form
    setNtTitle("");
    setNtDue("");
    setNtEstimate("");
    setNtTags("");
    setNtIsMilestone(false);
    setNtStatus("todo");
    setSubtasks([]);
    setSubtaskErrors([]);
    setNtAssignees([]);
    setShowTaskModal(false);
  };

  const exportBtnStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: "6px",
    padding: "7px 14px", fontSize: "13px", fontWeight: 500,
    color: "#1e3a5f", background: "transparent",
    border: "1px solid rgba(0,0,0,0.15)", borderRadius: "7px",
    cursor: "pointer", transition: "background 150ms ease, border-color 150ms ease",
  };

  const handleExportCSV = () => {
    if (filteredAllTasks.length === 0) {
      showToast("No data to export", "warning");
      return;
    }
    const dateStr = new Date().toISOString().split("T")[0];
    const headers = ["Task ID", "Task Name", "Project", "Assignee", "Status", "Priority", "Due Date", "Created Date"];
    const rows = filteredAllTasks.map((t) => {
      const c = allEligibleAssignees.find((x) => x.id === t.assignee);
      return [
        t.id,
        `"${t.title}"`,
        t.project,
        `"${c ? c.name : t.assignee}"`,
        `"${COL_LABELS[t.col as TaskCol]}"`,
        t.priority,
        t.dueDate,
        dateStr,
      ];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Systemeta_Tasks_${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Export downloaded successfully", "success");
  };

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const allTasks = Object.entries(data.tasks).flatMap(([col, tasks]) =>
    tasks.map((t) => ({ ...t, col: col as TaskCol }))
  );
  
  const visibleTasks = user ? filterTasks(allTasks, user) : [];
  const totalTasks = visibleTasks.length;

  const findTaskAndCol = (id: string): { task: Task; col: TaskCol } | null => {
    for (const [col, tasks] of Object.entries(data.tasks)) {
      const task = tasks.find((t) => t.id === id);
      if (task) return { task, col: col as TaskCol };
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const found = findTaskAndCol(active.id as string);
    if (!found) return;
    const newCol = over.id as TaskCol;
    if (found.col !== newCol) {
      const isManager = user?.role === "super_admin" || user?.role === "Super Admin" || user?.role === "project_manager" || user?.role === "Project Manager";
      if (!isManager && newCol === "done") {
        showToast(t("Only Project Managers and Super Admins can set tasks to Done directly"), "danger");
        return;
      }
      if (newCol === "done") {
        setCompletionModalTask({ task: found.task, newCol });
        setCompletionDate(new Date().toISOString().split("T")[0]);
      } else {
        moveTask(active.id as string, newCol);
        showToast(`Task moved to ${COL_LABELS[newCol]}`, "success");
      }
    }
  };

  const activeTask = activeId ? findTaskAndCol(activeId) : null;

  const filteredAllTasks = visibleTasks.filter(
    (t) => selectedProjectFilter === "all" || t.project === selectedProjectFilter
  );

  return (
    <div style={{ animation: "fadeIn 0.5s ease-out" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("Task Management")}</h1>
          <p className="page-subtitle">{t("Across all active projects")} · {totalTasks} {t("total tasks")}</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div className="tabs">
            {(["kanban", "list", "tree"] as const).map((v) => (
              <button key={v} className={`tab ${taskView === v ? "active" : ""}`} onClick={() => setTaskView(v)}>
                {t(v.charAt(0).toUpperCase() + v.slice(1))}
              </button>
            ))}
          </div>
          <SearchableSelect
            className="select"
            value={selectedProjectFilter}
            onChange={(val) => setSelectedProjectFilter(val)}
            options={[
              { label: t("All Projects"), value: "all" },
              ...(user ? filterProjects(data.projects, user) : []).map((p) => ({ label: p.name, value: p.id }))
            ]}
          />
          <select className="select">
            <option>{t("All Priorities")}</option>
            <option>{t("Critical")}</option>
            <option>{t("High")}</option>
            <option>{t("Medium")}</option>
            <option>{t("Low")}</option>
          </select>
          <button
            id="tasks-export-csv"
            style={exportBtnStyle}
            onClick={handleExportCSV}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.04)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,0,0,0.25)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,0,0,0.15)"; }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {t("Export CSV")}
          </button>
          <ActionGuard action="create_edit_task">
            <button className="btn btn-primary btn-sm" onClick={() => setShowTaskModal(true)}>
              + {t("Add Task")}
            </button>
          </ActionGuard>
        </div>
      </div>

      {/* AI Recommendation Center */}
      {showAiCopilot && user && ["super_admin", "project_manager"].includes(user.role) && (
        <div style={{
          background: "linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(20, 184, 166, 0.05) 100%)",
          border: "1px solid rgba(37, 99, 235, 0.15)",
          borderRadius: "12px",
          padding: "16px",
          marginBottom: "20px",
          boxShadow: "0 4px 20px -2px rgba(37, 99, 235, 0.05)",
          backdropFilter: "blur(8px)",
          position: "relative",
          animation: "slideDown 0.3s ease-out"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "24px", height: "24px", borderRadius: "6px", background: "linear-gradient(135deg, #2563eb, #14b8a6)", color: "white" }}>
                <Sparkles size={14} />
              </span>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>{t("AI Copilot Recommendations")}</span>
              <span className="badge badge-brand" style={{ fontSize: "10px", padding: "2px 6px" }}>{t("Recommended")}</span>
            </div>
            <button 
              className="btn btn-ghost btn-sm" 
              onClick={() => setShowAiCopilot(false)}
              style={{ padding: "2px", minWidth: "auto", minHeight: "auto", color: "var(--text-secondary)" }}
            >
              ×
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
            {/* Card 1: Schedule Conflict Detector */}
            <div style={{ background: "var(--bg-surface)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: "rgba(108, 126, 199, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#6C7EC7" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  </div>
                  <h4 style={{ fontSize: "13px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>{t("Detect Scheduling Conflicts")}</h4>
                </div>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "0 0 12px 0", lineHeight: "1.4" }}>
                  {t("Scan resources, detect overlapping assignments, and suggest optimized project timelines.")}
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="btn btn-primary btn-sm" onClick={() => setEmbeddedAiView("clash-dashboard")} style={{ flex: 1, fontSize: "11px", padding: "4px 8px", justifyContent: "center" }}>{t("Detect Conflicts")}</button>
              </div>
            </div>

            {/* Card 2: Task Time Estimation */}
            <div style={{ background: "var(--bg-surface)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: "rgba(46, 134, 193, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#2E86C1" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                  </div>
                  <h4 style={{ fontSize: "13px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>{t("Estimate Task Duration using AI")}</h4>
                </div>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "0 0 12px 0", lineHeight: "1.4" }}>
                  {t("Run duration estimation, assess confidence intervals, and predict deadline milestones.")}
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="btn btn-primary btn-sm" onClick={() => { setEmbeddedAiModal("estimate-tasks"); setEmbeddedAiTaskId(null); }} style={{ flex: 1, fontSize: "11px", padding: "4px 8px", justifyContent: "center" }}>{t("Estimate Task Duration")}</button>
              </div>
            </div>

            {/* Card 3: Automated Task Assigner */}
            <div style={{ background: "var(--bg-surface)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: "rgba(99, 102, 241, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#6366f1" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                  </div>
                  <h4 style={{ fontSize: "13px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>{t("Assign Best Resource using AI")}</h4>
                </div>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "0 0 12px 0", lineHeight: "1.4" }}>
                  {t("Match and recommend team assignees using skill matrix matching and workload models.")}
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="btn btn-primary btn-sm" onClick={() => { setEmbeddedAiView("assignment-dashboard"); setEmbeddedAiTaskId(null); }} style={{ flex: 1, fontSize: "11px", padding: "4px 8px", justifyContent: "center" }}>{t("Recommend Assignee")}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {filteredAllTasks.length === 0 ? (
        <div 
          className="card" 
          style={{ 
            display: "flex", 
            flexDirection: "column", 
            alignItems: "center", 
            justifyContent: "center", 
            padding: "64px 24px", 
            textAlign: "center", 
            color: "var(--text-secondary)" 
          }}
        >
          <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
            {t("No tasks found for this project")}
          </div>
          <div style={{ fontSize: "13px", color: "var(--text-tertiary)" }}>
            {t("Try adding a new task or selecting a different project filter.")}
          </div>
        </div>
      ) : (
        <>
          {taskView === "kanban" && (
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="kanban-board">
                {(["todo", "inprogress", "review", "done"] as TaskCol[]).map((col) => {
                  const colTasks = (user ? filterTasks(data.tasks[col] || [], user) : []).filter(
                    (t) => selectedProjectFilter === "all" || t.project === selectedProjectFilter
                  );
                  return (
                    <KanbanColumn
                      key={col}
                      col={col}
                      tasks={colTasks}
                      consultants={allEligibleAssignees}
                      onOpen={(task, c) => setDrawerTask({ task, col: c })}
                    />
                  );
                })}
              </div>
              <DragOverlay>
                {activeTask && (
                  <div className="card" style={{ padding: "14px", opacity: 0.9, boxShadow: "var(--shadow-xl)", borderLeft: `3px solid ${PRIORITY_COLORS[activeTask.task.priority]}`, width: "240px" }}>
                    <div style={{ fontSize: "13px", fontWeight: 600 }}>{activeTask.task.title}</div>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}

          {taskView === "list" && (
            <div className="card">
              <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: "24px" }}><input type="checkbox" style={{ cursor: "pointer" }} /></th>
                      <th>{t("Task")}</th>
                      <th>{t("Project")}</th>
                      <th>{t("Assignee")}</th>
                      <th>{t("Priority")}</th>
                      <th>{t("Status")}</th>
                      <th>{t("Due")}</th>
                      <th>{t("Estimate")}</th>
                      <th>{t("Progress")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAllTasks.map((task) => {
                      const c = allEligibleAssignees.find((x) => x.id === task.assignee) || { color: "#64748b", avatar: "?", name: task.assignee };
                      const proj = data.projects.find((p) => p.id === task.project);
                      const projectName = proj ? proj.name : task.project;
                      return (
                        <tr key={task.id} style={{ cursor: "pointer" }} onClick={() => setDrawerTask({ task: task, col: task.col })}>
                          <td><input type="checkbox" onClick={(e) => e.stopPropagation()} style={{ cursor: "pointer" }} /></td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span className={`priority-dot priority-${task.priority}`} />
                              <div>
                                <div style={{ fontSize: "13px", fontWeight: 500 }}>{task.title}</div>
                                <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{task.id}</div>
                              </div>
                            </div>
                          </td>
                          <td><span className="badge badge-gray" style={{ fontSize: "11px" }}>{projectName}</span></td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <div className="avatar" style={{ background: c.color, width: "22px", height: "22px", minWidth: "22px", fontSize: "8px" }}>{c.avatar}</div>
                              <span style={{ fontSize: "12px" }}>{c.name.split(" ")[0]}</span>
                            </div>
                          </td>
                          <td><span style={{ fontSize: "11.5px", fontWeight: 600, color: PRIORITY_COLORS[task.priority] }}>{t(task.priority.charAt(0).toUpperCase() + task.priority.slice(1))}</span></td>
                          <td><span className={`badge ${COL_BADGE[task.col as TaskCol]}`} style={{ fontSize: "10.5px" }}>{t(COL_LABELS[task.col as TaskCol])}</span></td>
                          <td style={{ fontSize: "12px" }}>{task.dueDate}</td>
                          <td style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{task.estimate}h</td>
                          <td>
                            {task.isMilestone ? (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <div
                                  style={{
                                    width: "10px",
                                    height: "10px",
                                    background: task.col === "done" ? "#10b981" : task.col === "inprogress" ? "#f59e0b" : "#94a3b8",
                                    transform: "rotate(45deg)",
                                    borderRadius: "1px",
                                    marginLeft: "25px",
                                  }}
                                  title={task.col === "done" ? t("Completed Milestone") : t("Milestone")}
                                />
                                <span style={{ fontSize: "11px", color: "var(--text-secondary)", marginLeft: "4px" }}>
                                  {task.col === "done" ? t("Completed") : task.col === "inprogress" ? t("In Progress") : t("Not Started")}
                                </span>
                              </div>
                            ) : (
                              task.progress !== undefined ? (
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <div className="progress-bar" style={{ width: "60px", height: "5px" }}>
                                    <div className="progress-fill" style={{ width: `${task.progress}%` }} />
                                  </div>
                                  <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{task.progress}%</span>
                                </div>
                              ) : "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {taskView === "tree" && (
            <div>
              {visibleProjects
                .filter((proj) => selectedProjectFilter === "all" || proj.id === selectedProjectFilter)
                .map((proj) => {
                  const projTasks = visibleTasks.filter((t) => t.project === proj.id);
                  if (projTasks.length === 0) return null;
                  return (
                    <div key={proj.id} className="card" style={{ marginBottom: "16px" }}>
                      <div className="card-header">
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}><IconFolder size={14} /> {proj.name}</span>
                          <span className="badge badge-gray" style={{ fontSize: "10px" }}>{projTasks.length} {t("tasks")}</span>
                          <span className={`badge badge-${proj.health === "on-track" ? "success" : proj.health === "at-risk" ? "warning" : "danger"}`} style={{ fontSize: "10px" }}>{t(proj.health === "on-track" ? "On Track" : proj.health === "at-risk" ? "At Risk" : "Critical")}</span>
                        </div>
                      </div>
                      <div className="card-body">
                        {(["todo", "inprogress", "review", "done"] as TaskCol[]).map((col) => {
                           const colTasks = projTasks.filter((t) => t.col === col);
                           if (colTasks.length === 0) return null;
                           return (
                             <div key={col} style={{ marginBottom: "12px" }}>
                               <div style={{ fontSize: "11px", fontWeight: 600, color: COL_COLORS[col], textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px", paddingLeft: "16px" }}>
                                 {t(COL_LABELS[col])} ({colTasks.length})
                               </div>
                               {colTasks.map((task) => {
                                 const c = allEligibleAssignees.find((x) => x.id === task.assignee) || { color: "#64748b", avatar: "?", name: task.assignee };
                                 return (
                                   <div
                                     key={task.id}
                                     style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 16px", cursor: "pointer", borderRadius: "6px", transition: "background 0.15s" }}
                                     onClick={() => setDrawerTask({ task: task, col })}
                                     onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-surface-2)"; }}
                                     onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
                                   >
                                     <span className={`priority-dot priority-${task.priority}`} />
                                     <span style={{ fontSize: "13px", flex: 1, color: "var(--text-primary)" }}>{task.title}</span>
                                     <div className="avatar" style={{ background: c.color, width: "20px", height: "20px", minWidth: "20px", fontSize: "8px" }}>{c.avatar}</div>
                                     <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{task.dueDate}</span>
                                     <span style={{ fontSize: "10.5px", fontWeight: 700, color: PRIORITY_COLORS[task.priority] }}>{t(task.priority.charAt(0).toUpperCase() + task.priority.slice(1))}</span>
                                   </div>
                                 );
                               })}
                             </div>
                           );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </>
      )}

      {(() => {
        const liveTask = drawerTask ? allTasks.find((t) => t.id === drawerTask.task.id) : null;
        if (!liveTask) return null;
        return (
          <TaskDrawer
            task={liveTask}
            col={liveTask.col}
            consultants={allEligibleAssignees}
            onClose={() => setDrawerTask(null)}
            onOpenAiInline={(view, modal, taskId) => {
              setEmbeddedAiView(view);
              setEmbeddedAiModal(modal);
              setEmbeddedAiTaskId(taskId || null);
            }}
          />
        );
      })()}
      {showTaskModal && (
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
            if (e.target === e.currentTarget) setShowTaskModal(false);
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
              position: "relative",
              animation: "cardEntrance 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            }}
          >
            {showAiEstimate && (
              <div style={{ position: "absolute", inset: 0, background: "var(--bg-surface)", zIndex: 10, display: "flex", flexDirection: "column" }}>
                <div className="card-header" style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)" }}>
                  <span className="card-title" style={{ fontSize: "16px", display: "flex", alignItems: "center", gap: "8px", color: "#2563eb" }}>
                    <Sparkles size={16} /> AI Estimate
                  </span>
                  <button type="button" className="topbar-btn" onClick={() => setShowAiEstimate(false)} style={{ width: "32px", height: "32px", borderRadius: "8px" }}>
                    <IconClose size={14} />
                  </button>
                </div>
                <div style={{ padding: "20px 24px", flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>{t("Task Heading")}</label>
                    <input className="login-input" type="text" placeholder="e.g. Build API Authentication System" value={aiEstHeading} onChange={e => setAiEstHeading(e.target.value)} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div className="login-field">
                      <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>{t("Number of People")}</label>
                      <select className="login-input" value={aiEstPeople} onChange={e => setAiEstPeople(e.target.value)}>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4+</option>
                      </select>
                    </div>
                    <div className="login-field">
                      <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>{t("Priority")}</label>
                      <select className="login-input" value={aiEstPriority} onChange={e => setAiEstPriority(e.target.value)}>
                        <option value="low">{t("Low")}</option>
                        <option value="medium">{t("Medium")}</option>
                        <option value="high">{t("High")}</option>
                        <option value="critical">{t("Critical")}</option>
                      </select>
                    </div>
                  </div>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>{t("Task Description")}</label>
                    <textarea className="login-input" placeholder="Describe the task details to improve estimate accuracy..." rows={4} style={{ resize: "vertical" }} value={aiEstDesc} onChange={e => setAiEstDesc(e.target.value)} />
                  </div>
                  
                  {aiEstResult && (
                    <div style={{ marginTop: "8px", padding: "16px", background: aiEstMeta?.isFallback ? "rgba(245, 158, 11, 0.06)" : "rgba(37, 99, 235, 0.05)", border: `1px solid ${aiEstMeta?.isFallback ? "rgba(245, 158, 11, 0.3)" : "rgba(37, 99, 235, 0.2)"}`, borderRadius: "10px", display: "flex", flexDirection: "column", gap: "12px" }}>
                      {aiEstMeta?.isFallback && (
                        <div style={{ fontSize: "11px", color: "#b45309", background: "rgba(245, 158, 11, 0.1)", padding: "6px 10px", borderRadius: "6px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                          ⚠ AI service unavailable — local estimate used
                        </div>
                      )}
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "18px", fontWeight: 800, color: aiEstMeta?.isFallback ? "#b45309" : "#2563eb", marginBottom: "4px" }}>{aiEstResult}</div>
                        {aiEstNumber !== null && (
                          <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>≈ {Math.ceil((aiEstNumber ?? 0) / 8)} working days</div>
                        )}
                      </div>
                      {aiEstMeta && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                          {[
                            { label: "Difficulty", value: aiEstMeta.difficulty },
                            { label: "Risk", value: aiEstMeta.riskLevel },
                            { label: "Confidence", value: `${aiEstMeta.confidence}%` },
                          ].map(({ label, value }) => (
                            <div key={label} style={{ textAlign: "center", padding: "8px", background: "var(--bg-surface-2)", borderRadius: "8px" }}>
                              <div style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "3px" }}>{label}</div>
                              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>{value}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {aiEstMeta?.reasoning && (
                        <div style={{ fontSize: "11.5px", color: "var(--text-secondary)", lineHeight: 1.5, fontStyle: "italic", borderTop: "1px solid var(--border-subtle)", paddingTop: "10px" }}>
                          {aiEstMeta.reasoning}
                        </div>
                      )}
                      {aiEstNumber !== null && (
                        <button
                          type="button"
                          onClick={() => {
                            if (aiEstNumber !== null) {
                              setNtEstimate(aiEstNumber.toString());
                              setShowAiEstimate(false);
                            }
                          }}
                          style={{ padding: "8px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", justifyContent: "center" }}
                        >
                          <Sparkles size={12} /> Use This Estimate
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAiEstimate(false)}>{t("Cancel")}</button>
                  <button type="button" className="btn btn-primary" onClick={handleGenerateAiEstimate} disabled={isAiEstimating} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {isAiEstimating ? "Estimating..." : <><Sparkles size={14} /> {t("Generate Estimate")}</>}
                  </button>
                </div>
              </div>
            )}
            <div className="card-header" style={{ padding: "20px 24px" }}>
              <span className="card-title" style={{ fontSize: "18px" }}>
                {t("Create New Task")}
              </span>
              <button
                className="topbar-btn"
                onClick={() => setShowTaskModal(false)}
                style={{ width: "32px", height: "32px", minWidth: "32px", borderRadius: "8px" }}
              >
                <IconClose size={14} />
              </button>
            </div>
            <div className="card-body" style={{ padding: "20px 24px" }}>
              <form onSubmit={handleCreateTask} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="login-field">
                  <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                    {t("Task Title")}
                  </label>
                  <input
                    className="login-input"
                    type="text"
                    placeholder={t("e.g. Prepare system test scripts")}
                    value={ntTitle}
                    onChange={(e) => setNtTitle(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      {t("Project")}
                    </label>
                    <SearchableSelect
                      className="login-input"
                      value={ntProject}
                      onChange={(val) => setNtProject(val)}
                      required
                      placeholder={t("Select Project")}
                      options={visibleProjects.map((p) => ({ label: `${p.name} (${p.id})`, value: p.id }))}
                    />
                  </div>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      {t("Assignees")}
                    </label>
                    <SearchableSelect
                      className="login-input"
                      value=""
                      onChange={(val) => {
                        if (val === "SELECT_ALL") {
                          setNtAssignees(createModalEligibleAssignees.map(c => ({ id: c.id, hours: "" })));
                        } else if (val === "CLEAR_ALL") {
                          setNtAssignees([]);
                        } else if (val && !ntAssignees.find(a => a.id === val)) {
                          setNtAssignees([...ntAssignees, { id: val, hours: "" }]);
                        }
                      }}
                      placeholder={t("Add an assignee...")}
                      options={[
                        { label: t("Select All"), value: "SELECT_ALL" },
                        { label: t("Clear All"), value: "CLEAR_ALL" },
                        ...createModalEligibleAssignees.filter(c => !ntAssignees.find(a => a.id === c.id)).map((c) => ({ label: c.name, value: c.id }))
                      ]}
                    />

                    {ntAssignees.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px", background: "var(--bg-surface-2)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                        {ntAssignees.map((assignee, idx) => {
                          const c = allEligibleAssignees.find(x => x.id === assignee.id);
                          return (
                            <div key={assignee.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                                <button type="button" onClick={() => setNtAssignees(ntAssignees.filter(a => a.id !== assignee.id))} style={{ cursor: "pointer", background: "none", border: "none", color: "var(--danger-500)", padding: 0, display: "flex", fontSize: "16px", fontWeight: 600 }}>×</button>
                                <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>{c?.name}</span>
                              </div>
                              <div style={{ flex: 1, borderBottom: "1px dashed var(--border-subtle)", opacity: 0.5 }} />
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <input
                                  type="number"
                                  className="login-input"
                                  style={{ width: "64px", padding: "4px 8px", fontSize: "13px", height: "auto", textAlign: "center" }}
                                  placeholder="0"
                                  min="0"
                                  value={assignee.hours}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const updated = [...ntAssignees];
                                    updated[idx].hours = val;
                                    setNtAssignees(updated);
                                  }}
                                />
                                <span style={{ fontSize: "12px", color: "var(--text-secondary)", minWidth: "20px" }}>hrs</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {totalAllocatedHours !== parseFloat(ntEstimate || "0") && parseFloat(ntEstimate || "0") > 0 && (
                      <div style={{ fontSize: "12px", color: "var(--danger-500)", marginTop: "8px", fontWeight: 500, display: "flex", alignItems: "center", gap: "4px" }}>
                        Total assignee hours must exactly match task estimated hours
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      {t("Priority")}
                    </label>
                    <select
                      className="login-input"
                      value={ntPriority}
                      onChange={(e) => setNtPriority(e.target.value as any)}
                    >
                      <option value="">{t("None")}</option>
                      <option value="low">{t("Low")}</option>
                      <option value="medium">{t("Medium")}</option>
                      <option value="high">{t("High")}</option>
                      <option value="critical">{t("Critical")}</option>
                    </select>
                  </div>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      {t("Due Date")}
                    </label>
                    <input
                      className="login-input"
                      type="date"
                      value={ntDue}
                      onChange={(e) => setNtDue(e.target.value)}
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="login-field">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <label className="login-label" style={{ fontSize: "13px", fontWeight: 600, margin: 0 }}>
                        {t("Estimate (Hours)")}
                      </label>
                      <button 
                        type="button" 
                        onClick={() => setShowAiEstimate(true)} 
                        style={{ background: "rgba(37, 99, 235, 0.1)", border: "1px solid rgba(37, 99, 235, 0.2)", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#2563eb", padding: "4px 8px", borderRadius: "999px", transition: "all 0.2s" }}
                        onMouseOver={(e) => (e.currentTarget.style.background = "rgba(37, 99, 235, 0.2)")}
                        onMouseOut={(e) => (e.currentTarget.style.background = "rgba(37, 99, 235, 0.1)")}
                      >
                        <Sparkles size={12} /> AI Estimate
                      </button>
                    </div>
                    <input
                      className="login-input"
                      type="number"
                      placeholder="8"
                      value={ntEstimate}
                      onChange={(e) => setNtEstimate(e.target.value)}
                    />
                  </div>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      {t("Tags (comma separated)")}
                    </label>
                    <input
                      className="login-input"
                      type="text"
                      placeholder={t("testing, QA")}
                      value={ntTags}
                      onChange={(e) => setNtTags(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", alignItems: "center" }}>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      {t("Status")}
                    </label>
                    <select
                      className="login-input"
                      value={ntStatus}
                      onChange={(e) => setNtStatus(e.target.value as any)}
                    >
                      <option value="todo">{t("Not Started")}</option>
                      <option value="inprogress">{t("In Progress")}</option>
                      <option value="done">{t("Completed")}</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingTop: "20px" }}>
                    <input
                      type="checkbox"
                      id="nt-is-milestone"
                      checked={ntIsMilestone}
                      onChange={(e) => setNtIsMilestone(e.target.checked)}
                      style={{ width: "16px", height: "16px", cursor: "pointer" }}
                    />
                    <label htmlFor="nt-is-milestone" className="login-label" style={{ fontSize: "13px", fontWeight: 600, cursor: "pointer", margin: 0 }}>
                      {t("Mark as Milestone")}
                    </label>
                  </div>
                </div>

                {/* Subtasks Section */}
                <div style={{ marginTop: "8px", borderTop: "1px solid var(--border-subtle)", paddingTop: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>{t("Subtasks")}</span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleAddSubtaskField}
                      style={{ padding: "4px 12px", fontSize: "12px" }}
                    >
                      + {t("Add Subtask")}
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {subtasks.map((sub, idx) => (
                      <div key={idx} style={{ position: "relative", padding: "16px 16px 12px 16px", border: "1px solid var(--border-subtle)", borderRadius: "8px", background: "var(--bg-surface-2)" }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveSubtaskField(idx)}
                          style={{ position: "absolute", top: "12px", right: "12px", background: "transparent", border: "none", color: "var(--danger-500)", fontSize: "12px", cursor: "pointer", fontWeight: 500 }}
                        >
                          {t("Remove")}
                        </button>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "8px" }}>
                          <div className="login-field">
                            <label className="login-label" style={{ fontSize: "12px", fontWeight: 600 }}>{t("Subtask Title *")}</label>
                            <input
                              className="login-input"
                              type="text"
                              placeholder={t("e.g. Write unit tests")}
                              value={sub.title}
                              onChange={e => handleUpdateSubtaskField(idx, 'title', e.target.value)}
                              required
                            />
                          </div>
                          <div className="login-field">
                            <label className="login-label" style={{ fontSize: "12px", fontWeight: 600 }}>{t("Deadline *")}</label>
                            <input
                              className="login-input"
                              type="date"
                              value={sub.dueDate}
                              onChange={e => handleUpdateSubtaskField(idx, 'dueDate', e.target.value)}
                              required
                            />
                          </div>
                        </div>
                        <div className="login-field">
                          <label className="login-label" style={{ fontSize: "12px", fontWeight: 600 }}>{t("Description (Optional)")}</label>
                          <input
                            className="login-input"
                            type="text"
                            placeholder={t("Short description of subtask")}
                            value={sub.description || ""}
                            onChange={e => handleUpdateSubtaskField(idx, 'description', e.target.value)}
                          />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "8px", alignItems: "center" }}>
                          <div className="login-field">
                            <label className="login-label" style={{ fontSize: "12px", fontWeight: 600 }}>{t("Subtask Status")}</label>
                            <select
                              className="login-input"
                              value={sub.status || "Not Started"}
                              onChange={e => handleUpdateSubtaskField(idx, 'status', e.target.value)}
                              style={{ height: "36px", padding: "6px 12px" }}
                            >
                              <option value="Not Started">{t("Not Started")}</option>
                              <option value="In Progress">{t("In Progress")}</option>
                              <option value="Completed">{t("Completed")}</option>
                            </select>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingTop: "18px" }}>
                            <input
                              type="checkbox"
                              id={`subtask-milestone-${idx}`}
                              checked={sub.isMilestone || false}
                              onChange={e => handleUpdateSubtaskField(idx, 'isMilestone', e.target.checked)}
                              style={{ width: "16px", height: "16px", cursor: "pointer" }}
                            />
                            <label htmlFor={`subtask-milestone-${idx}`} className="login-label" style={{ fontSize: "12px", fontWeight: 600, cursor: "pointer", margin: 0 }}>
                              {t("Mark as Milestone")}
                            </label>
                          </div>
                        </div>
                        {subtaskErrors[idx] && (
                          <div style={{ fontSize: "11px", color: "var(--danger-500)", marginTop: "6px", fontWeight: 500 }}>
                            {t(subtaskErrors[idx])}
                          </div>
                        )}
                      </div>
                    ))}
                    {subtasks.length === 0 && (
                      <div style={{ fontSize: "12px", color: "var(--text-tertiary)", textAlign: "center", padding: "16px", border: "1px dashed var(--border-subtle)", borderRadius: "8px" }}>
                        {t("No subtasks added yet. Click \"+ Add Subtask\" to add one.")}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "8px" }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => setShowTaskModal(false)}
                  >
                    {t("Cancel")}
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary btn-sm" 
                    style={{ padding: "8px 20px" }}
                    disabled={!ntTitle || !ntProject || ntAssignees.length === 0}
                  >
                    {t("Create Task")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {completionModalTask && (
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
            if (e.target === e.currentTarget) handleCancelCompletion();
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "420px",
              margin: "24px",
              maxHeight: "85vh",
              overflowY: "auto",
              animation: "cardEntrance 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            }}
          >
            <div className="card-header" style={{ padding: "20px 24px" }}>
              <span className="card-title" style={{ fontSize: "18px" }}>
                {t("Confirm Task Completion Date")}
              </span>
              <button
                type="button"
                className="topbar-btn"
                onClick={handleCancelCompletion}
                style={{ width: "32px", height: "32px", minWidth: "32px", borderRadius: "8px" }}
              >
                <IconClose size={14} />
              </button>
            </div>
            <div className="card-body" style={{ padding: "20px 24px" }}>
              <div style={{ marginBottom: "16px", fontSize: "14px", color: "var(--text-secondary)" }}>
                {t("Please confirm the completion date for task:")} <strong>{completionModalTask.task.title}</strong>
              </div>
              <div className="login-field" style={{ marginBottom: "20px" }}>
                <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                  {t("Completion Date")}
                </label>
                <input
                  className="login-input"
                  type="date"
                  value={completionDate}
                  onChange={(e) => setCompletionDate(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={handleCancelCompletion}
                >
                  {t("Cancel")}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={handleConfirmCompletion}
                  disabled={!completionDate}
                >
                  {t("Confirm")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {(embeddedAiView || embeddedAiModal) && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.4)",
          backdropFilter: "blur(4px)",
          zIndex: 99999,
          display: "flex",
          justifyContent: "flex-end",
        }} onClick={() => { setEmbeddedAiView(null); setEmbeddedAiModal(null); }}>
          <div style={{
            width: embeddedAiModal ? "min(550px, 100vw)" : "min(1200px, 100vw)",
            height: "100vh",
            background: "var(--bg-surface)",
            boxShadow: "var(--shadow-2xl)",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            animation: "slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 24px",
              borderBottom: "1px solid var(--border-subtle)",
              background: "var(--bg-card)",
              flexShrink: 0
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "24px", height: "24px", borderRadius: "6px", background: "linear-gradient(135deg, #2563eb, #14b8a6)", color: "white" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </span>
                <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
                  {embeddedAiModal === "estimate-tasks" && t("Task Time Estimation")}
                  {embeddedAiView === "delay-dashboard" && t("Delay Detection & Root Cause")}
                  {embeddedAiView === "assignment-dashboard" && t("Automated Task Assigner")}
                  {embeddedAiView === "clash-dashboard" && t("Schedule Conflict Detector")}
                </span>
              </div>
              <button 
                className="btn btn-ghost btn-sm"
                onClick={() => { setEmbeddedAiView(null); setEmbeddedAiModal(null); }}
                style={{ fontSize: "18px", padding: "4px", minWidth: "auto" }}
              >
                ×
              </button>
            </div>
            <div style={{ flex: 1, padding: "24px" }}>
              <AIPageComponent 
                embeddedView={embeddedAiView}
                embeddedModal={embeddedAiModal}
                embeddedProjectId={selectedProjectFilter !== "all" ? selectedProjectFilter : null}
                embeddedTaskId={embeddedAiTaskId}
                onCloseEmbedded={() => { setEmbeddedAiView(null); setEmbeddedAiModal(null); }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
