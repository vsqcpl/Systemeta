"use client";

import React, { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import ModalPortal from "@/components/ui/ModalPortal";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Sparkles } from "lucide-react";
import {
  IconBriefcase,
  IconCheck,
  IconTimer,
  IconReceipt,
  IconClose,
} from "@/components/ui/Icons";

interface QuickAddModalProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: "project" | "task" | "timesheet" | "expense";
  defaultProjectId?: string;
}

export default function QuickAddModal({ open, onClose, defaultTab, defaultProjectId }: QuickAddModalProps) {
  const data = useAppStore((state) => state.data);
  const showToast = useAppStore((state) => state.showToast);

  const allUsersList = React.useMemo(() => {
    const list: { id: string; name: string }[] = [];
    if (data.users && Array.isArray(data.users)) {
      for (const u of data.users) {
        list.push({ id: u.id, name: u.name });
      }
    }
    for (const c of data.consultants || []) {
      if (!list.find((x) => x.id === c.id || x.name === c.name)) {
        list.push({ id: c.id, name: c.name });
      }
    }
    return list;
  }, [data.users, data.consultants]);

  // Modal active tab
  const [activeTab, setActiveTab] = useState<"project" | "task" | "timesheet" | "expense">(defaultTab || "project");

  // Zustand Store Actions
  const addProject = useAppStore((state) => state.addProject);
  const addTask = useAppStore((state) => state.addTask);
  const addExpense = useAppStore((state) => state.addExpense);
  const updateTimesheetHours = useAppStore((state) => state.updateTimesheetHours);

  // Form State: Project
  const [npName, setNpName] = useState("");
  const [npClient, setNpClient] = useState("");
  const [npType, setNpType] = useState("Transformation");
  const [npBudget, setNpBudget] = useState("");
  const [npDue, setNpDue] = useState("");
  const [npManager, setNpManager] = useState("");
  const [npPriority, setNpPriority] = useState<"low" | "medium" | "high" | "critical">("medium");

  // Form State: Task
  const [ntTitle, setNtTitle] = useState("");
  const [ntProject, setNtProject] = useState("");
  const [ntAssignees, setNtAssignees] = useState<{ id: string; hours: string }[]>([]);
  const [ntPriority, setNtPriority] = useState<"low" | "medium" | "high" | "critical" | "">("");
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

  // Subtasks State
  const [subtasks, setSubtasks] = useState<{ title: string; dueDate: string; description?: string; isMilestone?: boolean; status?: 'Not Started' | 'In Progress' | 'Completed' }[]>([]);
  const [subtaskErrors, setSubtaskErrors] = useState<string[]>([]);

  // Form State: Timesheet
  const [tsProject, setTsProject] = useState("");
  const [tsTask, setTsTask] = useState("");
  const [tsDay, setTsDay] = useState<number>(0);
  const [tsHours, setTsHours] = useState("");
  const [tsBillable, setTsBillable] = useState(true);

  // Form State: Expense
  const [expConsultant, setExpConsultant] = useState("");
  const [expProject, setExpProject] = useState("");
  const [expCategory, setExpCategory] = useState<"Travel" | "Accommodation" | "Meals" | "Transport" | "Other">("Travel");
  const [expDescription, setExpDescription] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expCurrency, setExpCurrency] = useState("AED");
  const [expDate, setExpDate] = useState("");

  const projectTypes = useAppStore((state) => state.projectTypes);

  // Auto-select defaults when data is loaded
  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
    if (defaultProjectId) {
      setNtProject(defaultProjectId);
      setTsProject(defaultProjectId);
      setExpProject(defaultProjectId);
    } else if (data.projects.length > 0) {
      setNtProject(data.projects[0].id);
      setTsProject(data.projects[0].id);
      setExpProject(data.projects[0].id);
    }
    if (data.consultants.length > 0) {
      setNpManager(data.consultants[0].name);
      setExpConsultant(data.consultants[0].id);
    }
  }, [data, defaultTab, defaultProjectId, open]);

  const createModalProject = React.useMemo(() => {
    return data.projects.find((p) => p.id === ntProject || p.name === ntProject || (p.client ? `${p.name} (${p.client})` === ntProject : false));
  }, [data.projects, ntProject]);

  const createModalEligibleAssignees = React.useMemo(() => {
    const teamIds = createModalProject?.team || [];
    return allUsersList.filter((u) => teamIds.includes(u.id) || teamIds.includes(u.name));
  }, [createModalProject, allUsersList]);

  const totalAllocatedHours = React.useMemo(() => {
    return ntAssignees.reduce((sum, item) => sum + (parseFloat(item.hours) || 0), 0);
  }, [ntAssignees]);

  useEffect(() => {
    if (projectTypes.length > 0 && !projectTypes.includes(npType)) {
      setNpType(projectTypes[0]);
    }
  }, [projectTypes, npType]);

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

      const resData = await res.json();
      const hrs = resData.estimatedHours ?? resData.hours ?? 8;

      setAiEstNumber(hrs);
      setAiEstResult(`Suggested Estimate → ${hrs} Hours`);
      setAiEstMeta({
        difficulty: resData.difficulty || "Medium",
        riskLevel: resData.riskLevel || "Low",
        confidence: resData.confidenceScore || 75,
        reasoning: resData.reasoning || "Estimated using historical task context.",
        isFallback: resData.confidenceScore !== undefined && resData.confidenceScore <= 75 && !resData.historicalTasks?.length,
      });
    } catch (err: any) {
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

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!npName || !npClient || !npBudget || !npDue) return;

    addProject({
      name: npName,
      client: npClient,
      type: npType,
      budget: parseFloat(npBudget),
      dueDate: npDue,
      manager: npManager || (data.consultants[0]?.name || ""),
      priority: npPriority,
      status: "active",
    });

    // Reset Form
    setNpName("");
    setNpClient("");
    setNpBudget("");
    setNpDue("");
    onClose();
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ntTitle || !ntProject || ntAssignees.length === 0) {
      showToast("Please fill all required fields (Title, Project, Assignees).", "danger");
      return;
    }

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
      assignees: ntAssignees.map((a) => a.id),
      priority: (ntPriority || "None") as any,
      dueDate: ntDue || "",
      estimate: ntEstimate !== "" ? parseFloat(ntEstimate) : 0,
      tags: ntTags ? ntTags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      subtasks: subtasks.filter((sub) => sub.title.trim() !== ""),
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
    onClose();
  };

  const handleLogHours = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tsProject || !tsTask || !tsHours) return;

    updateTimesheetHours(
      tsProject,
      tsTask,
      tsDay,
      parseFloat(tsHours),
      tsBillable
    );

    showToast(`Logged ${tsHours}h on project ${tsProject} task "${tsTask}"`, "success");

    // Reset Form
    setTsTask("");
    setTsHours("");
    onClose();
  };

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expConsultant || !expProject || !expCategory || !expAmount || !expDate) return;

    addExpense({
      consultant: expConsultant,
      project: expProject,
      category: expCategory,
      description: expDescription,
      amount: parseFloat(expAmount),
      currency: expCurrency,
      date: expDate,
    });

    // Reset Form
    setExpDescription("");
    setExpAmount("");
    setExpDate("");
    onClose();
  };


  if (!open) return null;

  return (
    <ModalPortal>
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: "fadeIn 0.2s ease",
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
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
          onClick={(e) => e.stopPropagation()}
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
                  <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>Task Heading</label>
                  <input className="login-input" type="text" placeholder="e.g. Build API Authentication System" value={aiEstHeading} onChange={e => setAiEstHeading(e.target.value)} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>Number of People</label>
                    <select className="login-input" value={aiEstPeople} onChange={e => setAiEstPeople(e.target.value)}>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4+</option>
                    </select>
                  </div>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>Priority</label>
                    <select className="login-input" value={aiEstPriority} onChange={e => setAiEstPriority(e.target.value)}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>
                <div className="login-field">
                  <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>Task Description</label>
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowAiEstimate(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={handleGenerateAiEstimate} disabled={isAiEstimating} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {isAiEstimating ? "Estimating..." : <><Sparkles size={14} /> Generate Estimate</>}
                </button>
              </div>
            </div>
          )}
          {/* Header */}
          <div className="card-header" style={{ padding: "20px 24px" }}>
            <span className="card-title" style={{ fontSize: "18px" }}>
              Quick Add Workspace Entry
            </span>
            <button
              className="topbar-btn"
              onClick={onClose}
              style={{ width: "32px", height: "32px", minWidth: "32px", borderRadius: "8px" }}
            >
              <IconClose size={14} />
            </button>
          </div>

          <div className="card-body" style={{ padding: "20px 24px" }}>
            {/* Tabs */}
            <div
              style={{
                display: "flex",
                gap: "4px",
                background: "var(--bg-surface-2)",
                padding: "4px",
                borderRadius: "8px",
                border: "1px solid var(--border-subtle)",
                marginBottom: "20px",
              }}
            >
              {(["project", "task", "timesheet", "expense"] as const).map((tab) => {
                const isActive = activeTab === tab;
                const label = {
                  project: "Project",
                  task: "Task",
                  timesheet: "Hours",
                  expense: "Expense",
                }[tab];
                const tabIcon = {
                  project: <IconBriefcase size={13} style={{ flexShrink: 0 }} />,
                  task: <IconCheck size={13} style={{ flexShrink: 0 }} />,
                  timesheet: <IconTimer size={13} style={{ flexShrink: 0 }} />,
                  expense: <IconReceipt size={13} style={{ flexShrink: 0 }} />,
                }[tab];
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      flex: 1,
                      padding: "8px 4px",
                      background: isActive ? "var(--bg-surface)" : "transparent",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: isActive ? "700" : "500",
                      color: isActive ? "var(--brand-600)" : "var(--text-secondary)",
                      boxShadow: isActive ? "var(--shadow-xs)" : "none",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>{tabIcon}{label}</span>
                  </button>
                );
              })}
            </div>

            {/* PROJECT FORM */}
            {activeTab === "project" && (
              <form onSubmit={handleCreateProject} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="login-field">
                  <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                    Project Name
                  </label>
                  <input
                    className="login-input"
                    type="text"
                    placeholder="e.g. ERP Integration"
                    value={npName}
                    onChange={(e) => setNpName(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      Client
                    </label>
                    <SearchableSelect
                      className="login-input"
                      value={npClient}
                      onChange={(val) => setNpClient(val)}
                      required
                      placeholder="Select Client"
                      options={Array.from(new Set(data.projects.map((p) => p.client))).map((c) => ({ label: c, value: c }))}
                    />
                  </div>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      Type
                    </label>
                    <select
                      className="login-input"
                      value={npType}
                      onChange={(e) => setNpType(e.target.value)}
                      required
                    >
                      {projectTypes.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      Budget (AED)
                    </label>
                    <input
                      className="login-input"
                      type="number"
                      placeholder="350000"
                      value={npBudget}
                      onChange={(e) => setNpBudget(e.target.value)}
                      required
                    />
                  </div>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      Due Date
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
                      Manager
                    </label>
                    <select
                      className="login-input"
                      value={npManager}
                      onChange={(e) => setNpManager(e.target.value)}
                      required
                    >
                      {data.consultants.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      Priority
                    </label>
                    <select
                      className="login-input"
                      value={npPriority}
                      onChange={(e) => setNpPriority(e.target.value as any)}
                      required
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "8px" }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" style={{ padding: "8px 20px" }}>
                    Create Project
                  </button>
                </div>
              </form>
            )}

            {/* TASK FORM */}
            {activeTab === "task" && (
              <form onSubmit={handleCreateTask} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="login-field">
                  <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                    Task Title
                  </label>
                  <input
                    className="login-input"
                    type="text"
                    placeholder="e.g. Prepare system test scripts"
                    value={ntTitle}
                    onChange={(e) => setNtTitle(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      Project
                    </label>
                    <SearchableSelect
                      className="login-input"
                      value={ntProject}
                      onChange={(val) => { setNtProject(val); setNtAssignees([]); }}
                      required
                      placeholder="Select Project"
                      options={data.projects.map((p) => ({ label: p.client ? `${p.name} (${p.client})` : p.name, value: p.id }))}
                    />
                  </div>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      Assignees
                    </label>
                    <SearchableSelect
                      className="login-input"
                      value=""
                      onChange={(val) => {
                        if (val === "SELECT_ALL") {
                          setNtAssignees(createModalEligibleAssignees.map((c) => ({ id: c.id, hours: "" })));
                        } else if (val === "CLEAR_ALL") {
                          setNtAssignees([]);
                        } else if (val && !ntAssignees.find((a) => a.id === val)) {
                          setNtAssignees([...ntAssignees, { id: val, hours: "" }]);
                        }
                      }}
                      placeholder="Add an assignee..."
                      options={[
                        { label: "Select All", value: "SELECT_ALL" },
                        { label: "Clear All", value: "CLEAR_ALL" },
                        ...createModalEligibleAssignees
                          .filter((c) => !ntAssignees.find((a) => a.id === c.id))
                          .map((c) => ({ label: c.name, value: c.id })),
                      ]}
                    />

                    {ntAssignees.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px", background: "var(--bg-surface-2)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                        {ntAssignees.map((assignee, idx) => {
                          const c = allUsersList.find((x) => x.id === assignee.id);
                          return (
                            <div key={assignee.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                                <button type="button" onClick={() => setNtAssignees(ntAssignees.filter((a) => a.id !== assignee.id))} style={{ cursor: "pointer", background: "none", border: "none", color: "var(--danger-500)", padding: 0, display: "flex", fontSize: "16px", fontWeight: 600 }}>×</button>
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
                      Priority
                    </label>
                    <select
                      className="login-input"
                      value={ntPriority}
                      onChange={(e) => setNtPriority(e.target.value as any)}
                    >
                      <option value="">None</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      Due Date
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
                        Estimate (Hours)
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
                      Tags (comma separated)
                    </label>
                    <input
                      className="login-input"
                      type="text"
                      placeholder="testing, QA"
                      value={ntTags}
                      onChange={(e) => setNtTags(e.target.value)}
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", alignItems: "center", marginTop: "8px" }}>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      Status
                    </label>
                    <select
                      className="login-input"
                      value={ntStatus}
                      onChange={(e) => setNtStatus(e.target.value as any)}
                    >
                      <option value="todo">Not Started</option>
                      <option value="inprogress">In Progress</option>
                      <option value="done">Completed</option>
                    </select>
                  </div>
                  <div className="login-field" style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "20px" }}>
                    <input
                      id="q-nt-is-milestone"
                      type="checkbox"
                      checked={ntIsMilestone}
                      onChange={(e) => setNtIsMilestone(e.target.checked)}
                      style={{ width: "16px", height: "16px", cursor: "pointer" }}
                    />
                    <label htmlFor="q-nt-is-milestone" style={{ fontSize: "13px", fontWeight: 600, cursor: "pointer", userSelect: "none", margin: 0 }}>
                      Mark as Milestone
                    </label>
                  </div>
                </div>

                {/* Subtasks Section */}
                <div style={{ marginTop: "8px", borderTop: "1px solid var(--border-subtle)", paddingTop: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>Subtasks</span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleAddSubtaskField}
                      style={{ padding: "4px 12px", fontSize: "12px" }}
                    >
                      + Add Subtask
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
                          Remove
                        </button>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "8px" }}>
                          <div className="login-field">
                            <label className="login-label" style={{ fontSize: "12px", fontWeight: 600 }}>Subtask Title *</label>
                            <input
                              className="login-input"
                              type="text"
                              placeholder="e.g. Write unit tests"
                              value={sub.title}
                              onChange={e => handleUpdateSubtaskField(idx, 'title', e.target.value)}
                              required
                            />
                          </div>
                          <div className="login-field">
                            <label className="login-label" style={{ fontSize: "12px", fontWeight: 600 }}>Deadline *</label>
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
                          <label className="login-label" style={{ fontSize: "12px", fontWeight: 600 }}>Description (Optional)</label>
                          <input
                            className="login-input"
                            type="text"
                            placeholder="Short description of subtask"
                            value={sub.description || ""}
                            onChange={e => handleUpdateSubtaskField(idx, 'description', e.target.value)}
                          />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "8px", alignItems: "center" }}>
                          <div className="login-field">
                            <label className="login-label" style={{ fontSize: "12px", fontWeight: 600 }}>Subtask Status</label>
                            <select
                              className="login-input"
                              value={sub.status || "Not Started"}
                              onChange={e => handleUpdateSubtaskField(idx, 'status', e.target.value)}
                              style={{ height: "36px", padding: "6px 12px" }}
                            >
                              <option value="Not Started">Not Started</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Completed">Completed</option>
                            </select>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingTop: "18px" }}>
                            <input
                              type="checkbox"
                              id={`q-subtask-milestone-${idx}`}
                              checked={sub.isMilestone || false}
                              onChange={e => handleUpdateSubtaskField(idx, 'isMilestone', e.target.checked)}
                              style={{ width: "16px", height: "16px", cursor: "pointer" }}
                            />
                            <label htmlFor={`q-subtask-milestone-${idx}`} className="login-label" style={{ fontSize: "12px", fontWeight: 600, cursor: "pointer", margin: 0 }}>
                              Mark as Milestone
                            </label>
                          </div>
                        </div>
                        {subtaskErrors[idx] && (
                          <div style={{ fontSize: "11px", color: "var(--danger-500)", marginTop: "6px", fontWeight: 500 }}>
                            {subtaskErrors[idx]}
                          </div>
                        )}
                      </div>
                    ))}
                    {subtasks.length === 0 && (
                      <div style={{ fontSize: "12px", color: "var(--text-tertiary)", textAlign: "center", padding: "16px", border: "1px dashed var(--border-subtle)", borderRadius: "8px" }}>
                        No subtasks added yet. Click "+ Add Subtask" to add one.
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "16px" }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary btn-sm" 
                    style={{ padding: "8px 20px" }}
                    disabled={!ntTitle || !ntProject || ntAssignees.length === 0}
                  >
                    Create Task
                  </button>
                </div>
              </form>
            )}

            {/* TIMESHEET FORM */}
            {activeTab === "timesheet" && (
              <form onSubmit={handleLogHours} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      Project
                    </label>
                    <SearchableSelect
                      className="login-input"
                      value={tsProject}
                      onChange={(val) => setTsProject(val)}
                      required
                      placeholder="Select Project"
                      options={data.projects.map((p) => ({ label: p.name, value: p.id }))}
                    />
                  </div>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      Day of Week
                    </label>
                    <select
                      className="login-input"
                      value={tsDay}
                      onChange={(e) => setTsDay(parseInt(e.target.value, 10))}
                      required
                    >
                      <option value={0}>Monday</option>
                      <option value={1}>Tuesday</option>
                      <option value={2}>Wednesday</option>
                      <option value={3}>Thursday</option>
                      <option value={4}>Friday</option>
                      <option value={5}>Saturday</option>
                      <option value={6}>Sunday</option>
                    </select>
                  </div>
                </div>
                <div className="login-field">
                  <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                    Task Name / Description
                  </label>
                  <input
                    className="login-input"
                    type="text"
                    placeholder="e.g. Client alignment workshop"
                    value={tsTask}
                    onChange={(e) => setTsTask(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", alignItems: "center" }}>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      Hours Worked
                    </label>
                    <input
                      className="login-input"
                      type="number"
                      step="0.5"
                      placeholder="8"
                      value={tsHours}
                      onChange={(e) => setTsHours(e.target.value)}
                      required
                    />
                  </div>
                  <div className="login-field" style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "24px" }}>
                    <input
                      id="ts-billable"
                      type="checkbox"
                      checked={tsBillable}
                      onChange={(e) => setTsBillable(e.target.checked)}
                      style={{ width: "16px", height: "16px", cursor: "pointer" }}
                    />
                    <label htmlFor="ts-billable" style={{ fontSize: "13px", fontWeight: 600, cursor: "pointer", userSelect: "none" }}>
                      Billable hours
                    </label>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "8px" }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" style={{ padding: "8px 20px" }}>
                    Log Hours
                  </button>
                </div>
              </form>
            )}

            {/* EXPENSE FORM */}
            {activeTab === "expense" && (
              <form onSubmit={handleCreateExpense} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      Consultant
                    </label>
                    <SearchableSelect
                      className="login-input"
                      value={expConsultant}
                      onChange={(val) => setExpConsultant(val)}
                      required
                      placeholder="Select Consultant"
                      options={data.consultants.map((c) => ({ label: c.name, value: c.id }))}
                    />
                  </div>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      Project
                    </label>
                    <SearchableSelect
                      className="login-input"
                      value={expProject}
                      onChange={(val) => setExpProject(val)}
                      required
                      placeholder="Select Project"
                      options={data.projects.map((p) => ({ label: p.name, value: p.id }))}
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      Category
                    </label>
                    <select
                      className="login-input"
                      value={expCategory}
                      onChange={(e) => setExpCategory(e.target.value as any)}
                      required
                    >
                      <option value="Travel">Travel</option>
                      <option value="Accommodation">Accommodation</option>
                      <option value="Meals">Meals</option>
                      <option value="Transport">Transport</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      Date
                    </label>
                    <input
                      className="login-input"
                      type="date"
                      value={expDate}
                      onChange={(e) => setExpDate(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="login-field">
                  <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                    Description
                  </label>
                  <input
                    className="login-input"
                    type="text"
                    placeholder="e.g. Flights to client site"
                    value={expDescription}
                    onChange={(e) => setExpDescription(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      Amount
                    </label>
                    <input
                      className="login-input"
                      type="number"
                      placeholder="2500"
                      value={expAmount}
                      onChange={(e) => setExpAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      Currency
                    </label>
                    <input
                      className="login-input"
                      type="text"
                      value={expCurrency}
                      onChange={(e) => setExpCurrency(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "8px" }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" style={{ padding: "8px 20px" }}>
                    File Claim
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
