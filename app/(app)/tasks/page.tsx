"use client";

import React, { useState } from "react";
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
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
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
  
  const isAssignee = task.assignee === user?.id;
  const isManager = user?.role === "super_admin" || user?.role === "Super Admin" || user?.role === "project_manager" || user?.role === "Project Manager";
  const canMove = isAssignee || isManager;

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
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px", lineHeight: 1.4 }}>
          {task.title}
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginBottom: "10px" }}>{task.id}</div>
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
}: {
  task: Task;
  col: TaskCol;
  consultants: { id: string; name: string; avatar: string; color: string }[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const c = consultants.find((x) => x.id === task.assignee) || { color: "#64748b", avatar: "?", name: task.assignee };
  const addTaskComment = useAppStore((state) => state.addTaskComment);
  const addSubtaskToTask = useAppStore((state) => state.addSubtaskToTask);
  const [commentText, setCommentText] = React.useState("");
  const [showAddSubtask, setShowAddSubtask] = React.useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = React.useState("");
  const [newSubtaskDue, setNewSubtaskDue] = React.useState("");

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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className={`badge ${COL_BADGE[col]}`}>{t(COL_LABELS[col])}</span>
            <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{task.id}</span>
          </div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><IconClose size={13} /></button>
        </div>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px", lineHeight: 1.4 }}>{task.title}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
          {[
            { label: t("Assignee"), value: (<div style={{ display: "flex", alignItems: "center", gap: "6px" }}><div className="avatar" style={{ background: c.color, width: "20px", height: "20px", minWidth: "20px", fontSize: "8px" }}>{c.avatar}</div><span>{c.name}</span></div>) },
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
            <div style={{ fontSize: "10.5px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>{t("Comments")} ({task.comments.length})</div>
            {task.comments.map((cm) => (
              <div key={cm.id} style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
                <div className="avatar" style={{ background: cm.color, width: "28px", height: "28px", minWidth: "28px", fontSize: "9px" }}>{cm.avatar}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600 }}>{cm.user}</span>
                    <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{cm.time}</span>
                  </div>
                  <div style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: 1.5 }}>{cm.text}</div>
                </div>
              </div>
            ))}
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
  const data = useAppStore((state) => state.data);
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

  // Add Task Modal State
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [ntTitle, setNtTitle] = useState("");
  const [ntProject, setNtProject] = useState("");
  const [ntAssignee, setNtAssignee] = useState("");
  const [ntPriority, setNtPriority] = useState<any>("medium");
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

  const handleGenerateAiEstimate = () => {
    if (!aiEstHeading.trim() || !aiEstDesc.trim()) {
      setAiEstNumber(null);
      setAiEstResult("Please enter the details to find the estimate");
      return;
    }

    setIsAiEstimating(true);
    setTimeout(() => {
      let base = 8;
      const textLen = aiEstHeading.length + aiEstDesc.length;
      if (textLen > 50) base += 4;
      if (textLen > 150) base += 8;
      if (textLen > 300) base += 16;
      
      const people = parseInt(aiEstPeople) || 1;
      const multipliers: Record<string, number> = { low: 0.8, medium: 1, high: 1.5, critical: 2 };
      const priorityMult = multipliers[aiEstPriority] || 1;
      
      const finalEstimate = Math.round((base * priorityMult) / Math.max(1, people * 0.8));
      
      setAiEstNumber(finalEstimate);
      setAiEstResult(`Suggested Estimate → ${finalEstimate} Hours`);
      setIsAiEstimating(false);
    }, 1500);
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
    if (data.consultants.length > 0) {
      setNtAssignee(data.consultants[0].id);
    }
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
    if (!ntTitle || !ntProject || !ntAssignee || !ntDue || !ntEstimate) return;

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
      assignee: ntAssignee,
      priority: ntPriority,
      dueDate: ntDue,
      estimate: parseFloat(ntEstimate),
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
      const c = data.consultants.find((x) => x.id === t.assignee);
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
    a.download = `VSQC_Tasks_${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Export downloaded successfully", "success");
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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
          <select 
            className="select"
            value={selectedProjectFilter}
            onChange={(e) => setSelectedProjectFilter(e.target.value)}
          >
            <option value="all">{t("All Projects")}</option>
            {(user ? filterProjects(data.projects, user) : []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
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
                      consultants={data.consultants}
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
                      const c = data.consultants.find((x) => x.id === task.assignee) || { color: "#64748b", avatar: "?", name: task.assignee };
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
                          <td><span className="badge badge-gray" style={{ fontSize: "11px" }}>{task.project}</span></td>
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
                                 const c = data.consultants.find((x) => x.id === task.assignee) || { color: "#64748b", avatar: "?", name: task.assignee };
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
            consultants={data.consultants}
            onClose={() => setDrawerTask(null)}
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
                    <div style={{ marginTop: "8px", padding: "16px", background: "rgba(37, 99, 235, 0.05)", border: "1px solid rgba(37, 99, 235, 0.2)", borderRadius: "8px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 700, color: "#2563eb", marginBottom: "4px" }}>{aiEstResult}</div>
                        {aiEstNumber !== null && (
                          <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Review the suggested estimate and enter it in the form.</div>
                        )}
                      </div>
                      {aiEstNumber !== null && (
                        <button 
                          type="button" 
                          onClick={() => {
                            if (aiEstNumber !== null) {
                              setNtEstimate(aiEstNumber.toString());
                              setShowAiEstimate(false);
                            }
                          }}
                          style={{ padding: "6px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
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
                    <select
                      className="login-input"
                      value={ntProject}
                      onChange={(e) => setNtProject(e.target.value)}
                      required
                    >
                      {visibleProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.id})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      {t("Assignee")}
                    </label>
                    <select
                      className="login-input"
                      value={ntAssignee}
                      onChange={(e) => setNtAssignee(e.target.value)}
                      required
                    >
                      {data.consultants.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
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
                      required
                    >
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
                      required
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
                      required
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
                  <button type="submit" className="btn btn-primary btn-sm" style={{ padding: "8px 20px" }}>
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
    </div>
  );
}
