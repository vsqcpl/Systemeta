"use client";

import React, { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import ModalPortal from "@/components/ui/ModalPortal";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
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
}

export default function QuickAddModal({ open, onClose }: QuickAddModalProps) {
  const data = useAppStore((state) => state.data);
  const showToast = useAppStore((state) => state.showToast);

  // Modal active tab
  const [activeTab, setActiveTab] = useState<"project" | "task" | "timesheet" | "expense">("project");

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
  const [ntAssignee, setNtAssignee] = useState("");
  const [ntPriority, setNtPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [ntDue, setNtDue] = useState("");
  const [ntEstimate, setNtEstimate] = useState("");
  const [ntTags, setNtTags] = useState("");
  const [ntIsMilestone, setNtIsMilestone] = useState(false);
  const [ntStatus, setNtStatus] = useState<"todo" | "inprogress" | "done">("todo");

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

  // Auto-select defaults when data is loaded
  useEffect(() => {
    if (data.consultants.length > 0) {
      setNpManager(data.consultants[0].name);
      setNtAssignee(data.consultants[0].id);
      setExpConsultant(data.consultants[0].id);
    }
    if (data.projects.length > 0) {
      setNtProject(data.projects[0].id);
      setTsProject(data.projects[0].id);
      setExpProject(data.projects[0].id);
    }
  }, [data]);

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
    if (!ntTitle || !ntProject || !ntAssignee || !ntDue || !ntEstimate) return;

    addTask({
      title: ntTitle,
      project: ntProject,
      assignee: ntAssignee,
      priority: ntPriority,
      dueDate: ntDue,
      estimate: parseFloat(ntEstimate),
      tags: ntTags ? ntTags.split(",").map((t) => t.trim()).filter(Boolean) : [],
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

  const projectTypes = Array.from(new Set(data.projects.map((p) => p.type)));
  if (!projectTypes.includes("Other")) projectTypes.push("Other");

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
            animation: "cardEntrance 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
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
                      onChange={(val) => setNtProject(val)}
                      required
                      placeholder="Select Project"
                      options={data.projects.map((p) => ({ label: `${p.name} (${p.id})`, value: p.id }))}
                    />
                  </div>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      Assignee
                    </label>
                    <SearchableSelect
                      className="login-input"
                      value={ntAssignee}
                      onChange={(val) => setNtAssignee(val)}
                      required
                      placeholder="Select Assignee"
                      options={data.consultants.map((c) => ({ label: c.name, value: c.id }))}
                    />
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
                      required
                    >
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
                      required
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div className="login-field">
                    <label className="login-label" style={{ fontSize: "13px", fontWeight: 600 }}>
                      Estimate (Hours)
                    </label>
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
                  <div className="login-field" style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "24px" }}>
                    <input
                      id="q-nt-is-milestone"
                      type="checkbox"
                      checked={ntIsMilestone}
                      onChange={(e) => setNtIsMilestone(e.target.checked)}
                      style={{ width: "16px", height: "16px", cursor: "pointer" }}
                    />
                    <label htmlFor="q-nt-is-milestone" style={{ fontSize: "13px", fontWeight: 600, cursor: "pointer", userSelect: "none" }}>
                      Mark as Milestone
                    </label>
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
                  <button type="submit" className="btn btn-primary btn-sm" style={{ padding: "8px 20px" }}>
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
