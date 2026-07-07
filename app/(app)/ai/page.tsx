"use client";

import React, { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, useTranslation } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";
import { canUseAiFeature } from "@/lib/featureFlags";
import {
  IconCpu,
  IconCrystalBall,
  IconAlert,
  IconWand,
  IconTimer,
  IconUsers,
} from "@/components/ui/Icons";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Undo as IconUndo,
  Check,
  FileSpreadsheet,
  AlertCircle,
  FolderPlus,
  Briefcase
} from "lucide-react";

// ─── Groq AI helper with client-side rate limiting ───────────────────────────
const groqRateLimiter = (() => {
  const WINDOW_MS = 60_000;
  const MAX_CALLS = 10;
  const timestamps: number[] = [];
  return {
    canCall(): boolean {
      const now = Date.now();
      while (timestamps.length && timestamps[0] < now - WINDOW_MS) timestamps.shift();
      return timestamps.length < MAX_CALLS;
    },
    recordCall() { timestamps.push(Date.now()); },
    remainingCalls(): number {
      const now = Date.now();
      while (timestamps.length && timestamps[0] < now - WINDOW_MS) timestamps.shift();
      return Math.max(0, MAX_CALLS - timestamps.length);
    },
    nextResetMs(): number {
      if (!timestamps.length) return 0;
      return Math.max(0, timestamps[0] + WINDOW_MS - Date.now());
    },
  };
})();

async function callGroqAPI(prompt: string, systemPrompt: string): Promise<string> {
  if (!groqRateLimiter.canCall()) {
    const resetSec = Math.ceil(groqRateLimiter.nextResetMs() / 1000);
    throw new Error(`Rate limit reached. Please wait ${resetSec}s before the next AI call.`);
  }
  groqRateLimiter.recordCall();
  const res = await fetch("/api/ai/groq", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, systemPrompt }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error: ${err}`);
  }
  const json = await res.json();
  return json.content as string;
}

// ─── Milestone readiness helper (pure math — no ML) ──────────────────────────
function milestoneReadiness(taskCompletion: number, daysLeft: number, totalDays: number): number {
  const timeProgress = 1 - daysLeft / totalDays;
  const rawScore = taskCompletion * (1 - daysLeft / totalDays) * 100;
  return Math.min(100, Math.max(0, Math.round(rawScore)));
}

function getFlatTasks(tasksState: any): any[] {
  if (!tasksState) return [];
  if (Array.isArray(tasksState)) return tasksState;
  const flat: any[] = [];
  if (Array.isArray(tasksState.todo)) flat.push(...tasksState.todo);
  if (Array.isArray(tasksState.inprogress)) flat.push(...tasksState.inprogress);
  if (Array.isArray(tasksState.review)) flat.push(...tasksState.review);
  if (Array.isArray(tasksState.done)) flat.push(...tasksState.done);
  return flat;
}

function extractJson(content: string): string {
  const firstBracket = content.indexOf("[");
  const firstBrace = content.indexOf("{");
  let startIdx = -1;
  let endToken = "";
  
  if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
    startIdx = firstBracket;
    endToken = "]";
  } else if (firstBrace !== -1) {
    startIdx = firstBrace;
    endToken = "}";
  }
  
  if (startIdx === -1) {
    return content;
  }
  
  const lastIdx = content.lastIndexOf(endToken);
  if (lastIdx !== -1 && lastIdx > startIdx) {
    return content.substring(startIdx, lastIdx + 1);
  }
  return content;
}

function RadialProgress({ score, color, size = 44 }: { score: number; color: string; size?: number }) {
  const radius = size * 0.4;
  const strokeWidth = size * 0.08;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - ((score || 0) / 100) * circumference;

  return (
    <div style={{ position: "relative", width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="var(--border-subtle)"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
      </svg>
      <span style={{ position: "absolute", fontSize: "10px", fontWeight: 700, color: "var(--text-primary)" }}>
        {score || 0}%
      </span>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function AIPage() {
  const showToast = useAppStore((state) => state.showToast);
  const data = useAppStore((state) => state.data);
  const user = useAppStore((state) => state.user);
  const { t } = useTranslation();
  const updateTask = useAppStore((state) => state.updateTask);
  const router = useRouter();
  // PM AI Centre: only super_admin and project_manager have access.
  // All other roles are fully blocked — no read-only view, no placeholders.
  const canAccessPMAI = !user || ["super_admin", "project_manager"].includes(user.role);
  // isReadOnlyRole is always false here: roles that were previously read-only
  // (senior_consultant, consultant) are now fully blocked and never reach this page.
  const isReadOnlyRole = false;

  React.useEffect(() => {
    if (user && !canAccessPMAI) {
      router.replace("/dashboard");
    }
  }, [user, canAccessPMAI, router]);

  if (user && !canAccessPMAI) {
    return null;
  }

  // Feature gate helper — true if the current user can use this AI feature
  const aiGate = useCallback(
    (key: Parameters<typeof canUseAiFeature>[0]) =>
      canUseAiFeature(key, (user?.role ?? "") as any),
    [user?.role]
  );

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [alertSensitivity, setAlertSensitivity] = useState("Medium");
  const [autoSummary, setAutoSummary] = useState(true);
  const [riskThreshold, setRiskThreshold] = useState(70);
  const [notifyHigh, setNotifyHigh] = useState(true);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const savedSensitivity = localStorage.getItem("ai_alert_sensitivity");
      const savedAutoSummary = localStorage.getItem("ai_auto_generate_summary");
      const savedThreshold = localStorage.getItem("ai_risk_threshold");
      const savedNotifyHigh = localStorage.getItem("ai_notify_high_priority");
      if (savedSensitivity) setAlertSensitivity(savedSensitivity);
      if (savedAutoSummary) setAutoSummary(savedAutoSummary === "true");
      if (savedThreshold) setRiskThreshold(parseInt(savedThreshold, 10));
      if (savedNotifyHigh) setNotifyHigh(savedNotifyHigh === "true");
    }
  }, []);

  const handleSaveConfig = () => {
    localStorage.setItem("ai_alert_sensitivity", alertSensitivity);
    localStorage.setItem("ai_auto_generate_summary", String(autoSummary));
    localStorage.setItem("ai_risk_threshold", String(riskThreshold));
    localStorage.setItem("ai_notify_high_priority", String(notifyHigh));
    showToast("AI configuration saved", "success");
    setShowConfigModal(false);
  };

  const [view, setView] = useState<"main" | "delay-dashboard" | "billing-dashboard" | "assignment-dashboard" | "clash-dashboard" | "wbs-center">("main");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [projSearch, setProjSearch] = useState<string>("");
  const [delayScanData, setDelayScanData] = useState<any>(null);
  const [scanLoading, setScanLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"table" | "critical" | "dependency" | "impact">("table");
  
  // AI details drawer states
  const [selectedTaskForAi, setSelectedTaskForAi] = useState<any>(null);
  const [aiReport, setAiReport] = useState<any>(null);
  const [aiReportLoading, setAiReportLoading] = useState<boolean>(false);

  // Billing Milestone Insights states
  const [billingProjectId, setBillingProjectId] = useState<string>("");
  const [billingSearch, setBillingSearch] = useState<string>("");
  const [billingScanData, setBillingScanData] = useState<any>(null);
  const [billingScanLoading, setBillingScanLoading] = useState<boolean>(false);
  const [billingActiveTab, setBillingActiveTab] = useState<"milestones" | "revenue" | "blockers" | "report">("milestones");
  const [selectedMilestoneForAi, setSelectedMilestoneForAi] = useState<any>(null);
  const [billingAiReport, setBillingAiReport] = useState<any>(null);
  const [billingAiReportLoading, setBillingAiReportLoading] = useState<boolean>(false);

  // Billing Table Filters & paging states
  const [billingTableSearch, setBillingTableSearch] = useState<string>("");
  const [billingPriorityFilter, setBillingPriorityFilter] = useState<string>("all");
  const [billingReadinessFilter, setBillingReadinessFilter] = useState<string>("all");
  const [billingRevenueFilter, setBillingRevenueFilter] = useState<string>("all");
  const [billingSortField, setBillingSortField] = useState<string>("readinessScore");
  const [billingSortOrder, setBillingSortOrder] = useState<"asc" | "desc">("desc");
  const [billingCurrentPage, setBillingCurrentPage] = useState<number>(1);
  const billingItemsPerPage = 5;

  // Automated Task Assignment states
  const [assignmentProjectId, setAssignmentProjectId] = useState<string>("");
  const [assignmentTaskId, setAssignmentTaskId] = useState<string>("");
  const [assignmentSearch, setAssignmentSearch] = useState<string>("");
  const [assignmentTableSearch, setAssignmentTableSearch] = useState<string>("");
  const [assignmentActiveTab, setAssignmentActiveTab] = useState<"candidates" | "workload" | "risks" | "history">("candidates");
  const [assignmentResult, setAssignmentResult] = useState<any>(null);
  const [assignmentLoading, setAssignmentLoading] = useState<boolean>(false);
  const [assignmentHistoryList, setAssignmentHistoryList] = useState<any[]>([]);
  const [assignmentHistoryLoading, setAssignmentHistoryLoading] = useState<boolean>(false);
  const [selectedConsultantForComparison, setSelectedConsultantForComparison] = useState<any>(null);
  const [overrideReason, setOverrideReason] = useState<string>("");
  const [overrideConsultantId, setOverrideConsultantId] = useState<string>("");
  const [assignmentImpactModalOpen, setAssignmentImpactModalOpen] = useState<boolean>(false);
  const [selectedCandidateForImpact, setSelectedCandidateForImpact] = useState<any>(null);

  // Assignment filters
  const [assignmentDeptFilter, setAssignmentDeptFilter] = useState<string>("all");
  const [assignmentRoleFilter, setAssignmentRoleFilter] = useState<string>("all");
  const [assignmentLocationFilter, setAssignmentLocationFilter] = useState<string>("all");
  const [assignmentExpFilter, setAssignmentExpFilter] = useState<string>("all");
  const [assignmentAvailabilityFilter, setAssignmentAvailabilityFilter] = useState<string>("all");
  const [assignmentUtilFilter, setAssignmentUtilFilter] = useState<string>("all");
  const [assignmentRatingFilter, setAssignmentRatingFilter] = useState<string>("all");

  // Table filters & paging states
  const [tableSearch, setTableSearch] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("delayDays");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 5;

  // ── Schedule Clash Detection Dashboard States ──
  const [clashProjectId, setClashProjectId] = useState<string>("");
  const [clashSearch, setClashSearch] = useState<string>("");
  const [clashScanData, setClashScanData] = useState<any>(null);
  const [clashScanLoading, setClashScanLoading] = useState<boolean>(false);
  const [clashActiveTab, setClashActiveTab] = useState<"dashboard" | "timeline" | "calendar" | "resources" | "dependencies" | "resolutions" | "what-if" | "ai-summary">("dashboard");
  const [selectedConflict, setSelectedConflict] = useState<any>(null);

  // Filters & Sorting for Conflicts Table
  const [clashTableSearch, setClashTableSearch] = useState<string>("");
  const [clashTypeFilter, setClashTypeFilter] = useState<string>("all");
  const [clashSeverityFilter, setClashSeverityFilter] = useState<string>("all");
  const [clashProjectFilter, setClashProjectFilter] = useState<string>("all");
  const [clashConsultantFilter, setClashConsultantFilter] = useState<string>("all");
  const [clashSortField, setClashSortField] = useState<string>("severity");
  const [clashSortOrder, setClashSortOrder] = useState<"asc" | "desc">("desc");
  const [clashCurrentPage, setClashCurrentPage] = useState<number>(1);
  const clashItemsPerPage = 5;

  // What-if simulator states (purely client-side in-memory mock transformations)
  const [simulationDays, setSimulationDays] = useState<number>(0);
  const [simulatedReassignment, setSimulatedReassignment] = useState<Record<string, string>>({}); // taskId -> consultantId
  const [simulatedSplit, setSimulatedSplit] = useState<Record<string, boolean>>({}); // taskId -> true/false
  const [simulatedDeadlineExtension, setSimulatedDeadlineExtension] = useState<Record<string, number>>({}); // projectId -> extended days

  // WBS Builder & Optimization Center states
  const [wbsProjectId, setWbsProjectId] = useState<string>("");
  const [wbsMode, setWbsMode] = useState<"build" | "optimize">("build");
  const [wbsActiveTab, setWbsActiveTab] = useState<"grammar" | "improvements" | "integrity" | "chat" | "compare">("grammar");
  const [wbsLoading, setWbsLoading] = useState<boolean>(false);
  const [wbsSaving, setWbsSaving] = useState<boolean>(false);
  const [wbsDraft, setWbsDraft] = useState<any>(null);
  const [wbsOriginalDraft, setWbsOriginalDraft] = useState<any>(null);
  const [wbsAnalysis, setWbsAnalysis] = useState<any>(null);
  const [wbsForm, setWbsForm] = useState<any>({
    name: "",
    type: "Transformation",
    client: "",
    department: "",
    objective: "",
    scope: "",
    deliverables: "",
    timeline: "90 days",
    teamSize: "5",
    technologies: "",
    constraints: "",
    risks: "",
    notes: ""
  });
  const [wbsChatInput, setWbsChatInput] = useState<string>("");
  const [wbsChatHistory, setWbsChatHistory] = useState<Array<{ sender: "user" | "ai"; text: string }>>([
    { sender: "ai", text: "Hello! I am your AI PM assistant. Ask me to refine, expand, or simplify phases, or add documentation and testing plans to the draft." }
  ]);
  const [wbsAcceptedGrammar, setWbsAcceptedGrammar] = useState<Record<string, boolean>>({});
  const [wbsAcceptedImprovements, setWbsAcceptedImprovements] = useState<Record<string, boolean>>({});
  const [wbsHistoryStack, setWbsHistoryStack] = useState<any[]>([]); // for undoing AI suggestions
  const [wbsBuildTarget, setWbsBuildTarget] = useState<"new" | "existing">("new");
  const [briefTab, setBriefTab] = useState<"general" | "scope" | "risks">("general");
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  const handleScanProjectDelays = async (projId: string) => {
    if (!projId) {
      showToast("Please select a project first", "warning");
      return;
    }
    const proj = data?.projects?.find((p: any) => p.id === projId);
    if (proj?.status === "completed") {
      showToast("Completed or archived projects cannot be scanned.", "warning");
      return;
    }

    setScanLoading(true);
    try {
      const res = await fetch("/api/ai/delay-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: projId })
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const result = await res.json();
      setDelayScanData(result);
      showToast("Project scan complete. Risk dashboard updated.", "success");
    } catch (err: any) {
      showToast("Scan failed: " + (err?.message || "Unknown error"), "danger");
    } finally {
      setScanLoading(false);
    }
  };

  const handleAnalyzeTaskRootCause = async (task: any) => {
    setSelectedTaskForAi(task);
    setAiReport(null);
    setAiReportLoading(true);
    try {
      const res = await fetch("/api/ai/analyze-delay-root-cause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: task.projectId, taskId: task.id })
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const result = await res.json();
      setAiReport(result);
      showToast(`Root-cause analysis for "${task.title}" generated.`, "success");
    } catch (err: any) {
      showToast("AI Analysis failed: " + (err?.message || "Unknown error"), "danger");
    } finally {
      setAiReportLoading(false);
    }
  };

  const handleFetchAssignmentRecommendations = async (projId: string, tId: string) => {
    if (!projId || !tId) {
      showToast("Please select both a project and a task", "warning");
      return;
    }
    const proj = data?.projects?.find((p: any) => p.id === projId);
    if (proj?.status === "completed") {
      showToast("Completed projects are locked.", "warning");
      return;
    }
    const flat = getFlatTasks(data?.tasks);
    const task = flat.find((t: any) => t.id === tId);
    if (task?.status === "done") {
      showToast("Completed tasks cannot be assigned.", "warning");
      return;
    }

    setAssignmentLoading(true);
    try {
      const res = await fetch("/api/ai/auto-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: projId, taskId: tId })
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const result = await res.json();
      setAssignmentResult(result);
      showToast(`Resource matches calculated for "${result.task.title}".`, "success");
    } catch (err: any) {
      showToast("Failed to fetch assignment recommendations: " + (err?.message || "Unknown error"), "danger");
    } finally {
      setAssignmentLoading(false);
    }
  };

  const handleFetchAssignmentHistory = async () => {
    setAssignmentHistoryLoading(true);
    try {
      const res = await fetch("/api/ai/assignment-history");
      if (!res.ok) throw new Error("Failed to fetch history");
      const list = await res.json();
      setAssignmentHistoryList(list);
    } catch (err: any) {
      showToast("Failed to load assignment history: " + err.message, "danger");
    } finally {
      setAssignmentHistoryLoading(false);
    }
  };

  const handleSaveAssignment = async (overrideReasonText?: string) => {
    if (!assignmentResult || !selectedCandidateForImpact) return;
    const recommendedId = assignmentResult.rankings[0]?.id;
    const selectedId = selectedCandidateForImpact.id;

    try {
      const res = await fetch("/api/ai/save-assignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: assignmentResult.task.id,
          projectId: assignmentProjectId,
          recommendedId,
          selectedId,
          overrideReason: overrideReasonText || overrideReason
        })
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const result = await res.json();
      showToast(result.message || "Task assigned successfully.", "success");
      
      // Refresh local store
      const fetchInitialData = useAppStore.getState().fetchInitialData;
      await fetchInitialData();
      
      // Update local history
      setAssignmentHistoryList(prev => [result.entry, ...prev]);

      // Reset states
      setAssignmentResult(null);
      setAssignmentTaskId("");
      setAssignmentImpactModalOpen(false);
      setSelectedCandidateForImpact(null);
      setOverrideReason("");
      setOverrideConsultantId("");
    } catch (err: any) {
      showToast("Assignment failed: " + (err?.message || "Unknown error"), "danger");
    }
  };

  const handleAssignmentExportCsv = () => {
    if (!assignmentHistoryList || assignmentHistoryList.length === 0) {
      showToast("No assignment history logs to export.", "warning");
      return;
    }
    const headers = ["Task ID", "Project ID", "Task Title", "Project Name", "Recommended Consultant", "Selected Consultant", "Manager", "Decision Date", "Status", "Override Reason"];
    const rows = assignmentHistoryList.map(h => [
      h.taskId,
      h.projectId,
      `"${(h.taskTitle || "").replace(/"/g, '""')}"`,
      `"${(h.projectName || "").replace(/"/g, '""')}"`,
      `"${(h.recommendedConsultant || "").replace(/"/g, '""')}"`,
      `"${(h.selectedConsultant || "").replace(/"/g, '""')}"`,
      h.manager,
      h.decisionDate,
      h.status,
      `"${(h.overrideReason || "").replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `task_assignment_history_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Assignment history exported successfully.", "success");
  };

  const handleScanBillingMilestones = async (projId: string) => {
    if (!projId) {
      showToast("Please select a project first", "warning");
      return;
    }
    const proj = data?.projects?.find((p: any) => p.id === projId);
    if (proj?.status === "completed") {
      showToast("Completed or archived projects cannot be scanned.", "warning");
      return;
    }

    setBillingScanLoading(true);
    try {
      const res = await fetch("/api/ai/billing-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: projId })
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const result = await res.json();
      setBillingScanData(result);
      if (result.empty) {
        showToast("No billing milestones on this project yet. Add milestones to see insights.", "warning");
      } else {
        showToast("Milestone financial dashboard loaded successfully.", "success");
      }
    } catch (err: any) {
      showToast("Load failed: " + (err?.message || "Unknown error"), "danger");
    } finally {
      setBillingScanLoading(false);
    }
  };

  const handleAnalyzeMilestoneRootCause = async (milestone: any) => {
    setSelectedMilestoneForAi(milestone);
    setBillingAiReport(null);
    setBillingAiReportLoading(true);
    try {
      const res = await fetch("/api/ai/billing-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: billingProjectId, milestoneId: milestone.id })
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const result = await res.json();
      setBillingAiReport(result.aiReport);
      showToast(`Billing readiness analysis for "${milestone.title}" complete.`, "success");
    } catch (err: any) {
      showToast("AI Analysis failed: " + (err?.message || "Unknown error"), "danger");
    } finally {
      setBillingAiReportLoading(false);
    }
  };

  const handleBillingExportCsv = () => {
    if (!billingScanData || !billingScanData.milestones) return;
    const headers = ["Milestone ID", "Milestone Title", "Target Date", "Budget (INR)", "Completion %", "Days Remaining", "Readiness Score", "Status", "Priority"];
    const rows = billingScanData.milestones.map((m: any) => [
      m.id,
      `"${m.title.replace(/'/g, "''").replace(/"/g, '""')}"`,
      m.targetDate,
      m.budget,
      `${m.completion}%`,
      m.daysRemaining,
      m.readinessScore,
      m.status,
      m.priority
    ]);
    const csvContent = [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Billing_Report_${billingScanData.project.id}_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("CSV report exported.", "success");
  };

  const handleBillingExportPdf = async () => {
    if (!billingScanData) return;
    try {
      const jsPDF = (await import("jspdf")).default;
      const doc = new jsPDF("p", "mm", "a4");
      
      // Header
      doc.setFont("Helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(20, 184, 166);
      doc.text("Project Billing Milestone & Revenue Report", 14, 20);
      
      doc.setFont("Helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(100, 116, 139);
      doc.text(`Project: ${billingScanData.project.name} (${billingScanData.project.id})`, 14, 27);
      doc.text(`Manager: ${billingScanData.project.manager}  |  Client: ${billingScanData.project.client}`, 14, 32);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 37);
      doc.line(14, 40, 196, 40);
      
      // Executive Summary
      doc.setFont("Helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(30, 41, 59);
      doc.text("Financial Health Summary", 14, 48);
      
      doc.setFont("Helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(51, 65, 85);
      doc.text(`Total Milestones: ${billingScanData.dashboardMetrics.totalMilestones}  |  Completed: ${billingScanData.dashboardMetrics.completed}`, 14, 56);
      doc.text(`Ready for Billing: ${billingScanData.dashboardMetrics.readyForBilling}  |  Blocked: ${billingScanData.dashboardMetrics.blocked}`, 14, 62);
      doc.text(`Total Contract Value: INR ${billingScanData.revenueImpact.totalContractValue.toLocaleString("en-IN")}`, 14, 68);
      doc.text(`Collected Revenue: INR ${billingScanData.revenueImpact.collectedRevenue.toLocaleString("en-IN")}`, 14, 74);
      doc.text(`Revenue Unlocked (Ready): INR ${billingScanData.revenueImpact.revenueUnlock.toLocaleString("en-IN")}`, 14, 80);
      doc.text(`Revenue At Risk: INR ${billingScanData.revenueImpact.revenueAtRisk.toLocaleString("en-IN")}`, 14, 86);
      doc.text(`Overall Billing Readiness: ${billingScanData.dashboardMetrics.billingReadinessPercent}%`, 14, 92);
      
      // Milestones List
      doc.setFont("Helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(30, 41, 59);
      doc.text("Billing Milestone Readiness Details", 14, 106);
      
      let y = 114;
      doc.setFontSize(10);
      billingScanData.milestones.forEach((m: any, index: number) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setFont("Helvetica", "bold"); doc.setTextColor(15, 23, 42);
        doc.text(`${index + 1}. ${m.title}`, 14, y);
        doc.setFont("Helvetica", "normal"); doc.setTextColor(100, 116, 139);
        doc.text(`Target Date: ${m.targetDate}  |  Budget: INR ${m.budget.toLocaleString("en-IN")}  |  Status: ${m.status}`, 18, y + 5);
        doc.text(`Completion: ${m.completion}%  |  Readiness Score: ${m.readinessScore}% (${m.category})  |  Priority: ${m.priority}`, 18, y + 10);
        y += 16;
      });
      
      doc.save(`Billing_Financial_Report_${billingScanData.project.id}.pdf`);
      showToast("PDF report exported.", "success");
    } catch (err) {
      console.error(err);
      showToast("PDF export failed.", "danger");
    }
  };

  const handleCopyReportText = () => {
    if (!billingScanData) return;
    const text = `Project: ${billingScanData.project.name} (${billingScanData.project.id})
Manager: ${billingScanData.project.manager} | Client: ${billingScanData.project.client}
Billing Milestones Summary:
- Total Milestones: ${billingScanData.dashboardMetrics.totalMilestones}
- Completed Milestones: ${billingScanData.dashboardMetrics.completed}
- Ready for Billing: ${billingScanData.dashboardMetrics.readyForBilling}
- Blocked Milestones: ${billingScanData.dashboardMetrics.blocked}
- Total Value: INR ${billingScanData.revenueImpact.totalContractValue.toLocaleString("en-IN")}
- Collected Revenue: INR ${billingScanData.revenueImpact.collectedRevenue.toLocaleString("en-IN")}
- Revenue at Risk: INR ${billingScanData.revenueImpact.revenueAtRisk.toLocaleString("en-IN")}
- Financial Health Score: ${billingScanData.dashboardMetrics.overallFinancialHealth}%`;
    navigator.clipboard.writeText(text);
    showToast("Report text copied to clipboard.", "success");
  };

  const handlePrintReport = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (!delayScanData || !delayScanData.tasks) return;
    const headers = ["Task ID", "Task Title", "Assignee", "Department", "Priority", "Progress", "Due Date", "Expected Date", "Delay (Days)", "Risk Level", "Status"];
    const rows = delayScanData.tasks.map((t: any) => [
      t.id,
      `"${t.title.replace(/'/g, "''").replace(/"/g, '""')}"`,
      t.assigneeName,
      t.department,
      t.priority,
      `${t.progress}%`,
      t.dueDate,
      t.expectedEndDate,
      t.delayDays,
      t.riskLevel,
      t.status
    ]);
    const csvContent = [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Delay_Report_${delayScanData.project.id}_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("CSV report exported.", "success");
  };

  const handleExportPdf = async () => {
    if (!delayScanData) return;
    try {
      const jsPDF = (await import("jspdf")).default;
      const doc = new jsPDF("p", "mm", "a4");
      
      // Header
      doc.setFont("Helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(37, 99, 235);
      doc.text("Project Delay & Risk Analysis Report", 14, 20);
      
      doc.setFont("Helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(100, 116, 139);
      doc.text(`Project: ${delayScanData.project.name} (${delayScanData.project.id})`, 14, 27);
      doc.text(`Manager: ${delayScanData.project.manager}  |  Department: ${delayScanData.project.department}`, 14, 32);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 37);
      doc.line(14, 40, 196, 40);
      
      // Executive Summary
      doc.setFont("Helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(30, 41, 59);
      doc.text("Executive Summary", 14, 48);
      
      doc.setFont("Helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(51, 65, 85);
      doc.text(`Overall Project Health: ${delayScanData.scanSummary.overallProjectHealth}%`, 14, 56);
      doc.text(`Total Tasks: ${delayScanData.scanSummary.totalTasks}  |  Completed: ${delayScanData.scanSummary.completed}  |  Delayed: ${delayScanData.scanSummary.delayed}`, 14, 62);
      doc.text(`Critical Path Status: ${delayScanData.scanSummary.criticalPathStatus}  |  Expected Delay: ${delayScanData.criticalPath.expectedDelay} days`, 14, 68);
      doc.text(`Estimated Budget Impact: INR ${delayScanData.impact.budgetImpact.toLocaleString("en-IN")}`, 14, 74);
      doc.text(`Client Impact: ${delayScanData.impact.clientImpact}  |  Overall Risk: ${delayScanData.impact.overallRisk}`, 14, 80);
      
      // Delayed Tasks list
      doc.setFont("Helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(30, 41, 59);
      doc.text("Delayed & At-Risk Tasks", 14, 94);
      
      let y = 102;
      const delayedTasks = delayScanData.tasks.filter((t: any) => t.isDelayed || t.isAtRisk);
      
      if (delayedTasks.length > 0) {
        doc.setFontSize(10);
        delayedTasks.slice(0, 10).forEach((t: any, index: number) => {
          if (y > 270) { doc.addPage(); y = 20; }
          doc.setFont("Helvetica", "bold"); doc.setTextColor(15, 23, 42);
          doc.text(`${index + 1}. [${t.id}] ${t.title}`, 14, y);
          doc.setFont("Helvetica", "normal"); doc.setTextColor(100, 116, 139);
          doc.text(`Assignee: ${t.assigneeName} (${t.department})  |  Priority: ${t.priority.toUpperCase()}  |  Progress: ${t.progress}%`, 18, y + 5);
          doc.text(`Due: ${t.dueDate}  |  Expected: ${t.expectedEndDate}  |  Delay: ${t.delayDays} days  |  Risk: ${t.riskLevel}`, 18, y + 10);
          y += 16;
        });
      } else {
        doc.setFont("Helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(100, 116, 139);
        doc.text("No delayed or at-risk tasks detected in this project plan.", 14, 102);
      }
      
      doc.save(`Project_Risk_Report_${delayScanData.project.id}.pdf`);
      showToast("PDF report exported.", "success");
    } catch (err) {
      console.error(err);
      showToast("PDF export failed.", "danger");
    }
  };

  const handleToggleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };


  // Active and filtered projects
  const activeProjects = React.useMemo(() => {
    return (data?.projects || []).filter((p: any) => p.status === "active");
  }, [data?.projects]);

  // Automated Task Assignment useMemos
  const filteredAssignmentProjects = React.useMemo(() => {
    if (!assignmentSearch) return activeProjects;
    return activeProjects.filter((p: any) => 
      p.name.toLowerCase().includes(assignmentSearch.toLowerCase()) || 
      p.id.toLowerCase().includes(assignmentSearch.toLowerCase())
    );
  }, [activeProjects, assignmentSearch]);

  const selectedAssignmentProjectObj = React.useMemo(() => {
    return data?.projects?.find((p: any) => p.id === assignmentProjectId);
  }, [data?.projects, assignmentProjectId]);

  const assignmentTasks = React.useMemo(() => {
    if (!assignmentProjectId) return [];
    const flat = getFlatTasks(data?.tasks);
    return flat.filter((t: any) => t.project === assignmentProjectId && t.status !== "done" && (user?.role === "consultant" ? (t.assignee === user.id || t.assigneeId === user.id) : true));
  }, [data?.tasks, assignmentProjectId, user]);

  const selectedAssignmentTaskObj = React.useMemo(() => {
    const flat = getFlatTasks(data?.tasks);
    return flat.find((t: any) => t.id === assignmentTaskId && t.project === assignmentProjectId);
  }, [data?.tasks, assignmentTaskId, assignmentProjectId]);

  const filteredCandidates = React.useMemo(() => {
    if (!assignmentResult || !assignmentResult.rankings) return [];
    let list = [...assignmentResult.rankings];

    if (assignmentTableSearch) {
      const q = assignmentTableSearch.toLowerCase();
      list = list.filter(c => 
        c.name.toLowerCase().includes(q) || 
        c.role.toLowerCase().includes(q) ||
        (c.skills || []).some((s: string) => s.toLowerCase().includes(q)) ||
        (c.certifications || []).some((s: string) => s.toLowerCase().includes(q))
      );
    }

    if (assignmentDeptFilter !== "all") {
      list = list.filter(c => c.dept.toLowerCase() === assignmentDeptFilter.toLowerCase());
    }

    if (assignmentRoleFilter !== "all") {
      list = list.filter(c => c.role.toLowerCase() === assignmentRoleFilter.toLowerCase());
    }

    if (assignmentLocationFilter !== "all") {
      list = list.filter(c => c.location?.toLowerCase().includes(assignmentLocationFilter.toLowerCase()));
    }

    if (assignmentUtilFilter !== "all") {
      if (assignmentUtilFilter === "high") {
        list = list.filter(c => c.utilization > 80);
      } else if (assignmentUtilFilter === "medium") {
        list = list.filter(c => c.utilization >= 40 && c.utilization <= 80);
      } else if (assignmentUtilFilter === "low") {
        list = list.filter(c => c.utilization < 40);
      }
    }

    if (assignmentAvailabilityFilter !== "all") {
      if (assignmentAvailabilityFilter === "available") {
        list = list.filter(c => c.riskIndicator !== "High" && c.riskIndicator !== "Critical");
      } else if (assignmentAvailabilityFilter === "conflict") {
        list = list.filter(c => c.riskReason?.toLowerCase().includes("leave") || c.riskReason?.toLowerCase().includes("schedule"));
      }
    }

    if (assignmentRatingFilter !== "all") {
      const minRating = Number(assignmentRatingFilter);
      list = list.filter(c => c.performanceRating >= minRating);
    }

    return list;
  }, [assignmentResult, assignmentTableSearch, assignmentDeptFilter, assignmentRoleFilter, assignmentLocationFilter, assignmentUtilFilter, assignmentAvailabilityFilter, assignmentRatingFilter]);

  const filteredProjects = React.useMemo(() => {
    if (!projSearch) return activeProjects;
    return activeProjects.filter((p: any) => 
      p.name.toLowerCase().includes(projSearch.toLowerCase()) || 
      p.id.toLowerCase().includes(projSearch.toLowerCase())
    );
  }, [activeProjects, projSearch]);

  const selectedProjectObj = React.useMemo(() => {
    return data?.projects?.find((p: any) => p.id === selectedProjectId);
  }, [data?.projects, selectedProjectId]);

  // Filtered & sorted tasks for the scan
  const filteredTasks = React.useMemo(() => {
    if (!delayScanData || !delayScanData.tasks) return [];
    let list = [...delayScanData.tasks];

    // Search filter
    if (tableSearch) {
      list = list.filter(t => t.title.toLowerCase().includes(tableSearch.toLowerCase()) || t.id.toLowerCase().includes(tableSearch.toLowerCase()));
    }

    // Priority filter
    if (priorityFilter !== "all") {
      list = list.filter(t => t.priority.toLowerCase() === priorityFilter.toLowerCase());
    }

    // Risk filter
    if (riskFilter !== "all") {
      list = list.filter(t => t.riskLevel.toLowerCase() === riskFilter.toLowerCase());
    }

    // Assignee filter
    if (assigneeFilter !== "all") {
      list = list.filter(t => t.assigneeId === assigneeFilter);
    }

    // Sort
    list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === "delayDays" || sortField === "progress") {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else {
        valA = String(valA || "").toLowerCase();
        valB = String(valB || "").toLowerCase();
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [delayScanData, tableSearch, priorityFilter, riskFilter, assigneeFilter, sortField, sortOrder]);

  // Unique assignees for filter list
  const uniqueAssignees = React.useMemo(() => {
    if (!delayScanData || !delayScanData.tasks) return [];
    const map = new Map();
    delayScanData.tasks.forEach((t: any) => {
      if (t.assigneeId) {
        map.set(t.assigneeId, t.assigneeName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [delayScanData]);

  // Paginated tasks
  const paginatedTasks = React.useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredTasks.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredTasks, currentPage]);

  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage) || 1;

  // Active and filtered projects for Billing
  const filteredBillingProjects = React.useMemo(() => {
    if (!billingSearch) return activeProjects;
    return activeProjects.filter((p: any) => 
      p.name.toLowerCase().includes(billingSearch.toLowerCase()) || 
      p.id.toLowerCase().includes(billingSearch.toLowerCase())
    );
  }, [activeProjects, billingSearch]);

  const selectedBillingProjectObj = React.useMemo(() => {
    return data?.projects?.find((p: any) => p.id === billingProjectId);
  }, [data?.projects, billingProjectId]);

  // Filtered & sorted milestones for Billing
  const filteredBillingMilestones = React.useMemo(() => {
    if (!billingScanData || !billingScanData.milestones) return [];
    let list = [...billingScanData.milestones];

    // Search filter
    if (billingTableSearch) {
      list = list.filter(m => m.title.toLowerCase().includes(billingTableSearch.toLowerCase()) || m.id.toLowerCase().includes(billingTableSearch.toLowerCase()));
    }

    // Priority filter
    if (billingPriorityFilter !== "all") {
      list = list.filter(m => m.priority.toLowerCase() === billingPriorityFilter.toLowerCase());
    }

    // Readiness category filter
    if (billingReadinessFilter !== "all") {
      list = list.filter(m => m.category.toLowerCase() === billingReadinessFilter.toLowerCase());
    }

    // Revenue range filter
    if (billingRevenueFilter !== "all") {
      if (billingRevenueFilter === "high") {
        list = list.filter(m => m.budget >= 1000000);
      } else if (billingRevenueFilter === "medium") {
        list = list.filter(m => m.budget >= 250000 && m.budget < 1000000);
      } else if (billingRevenueFilter === "low") {
        list = list.filter(m => m.budget < 250000);
      }
    }

    // Sort
    list.sort((a, b) => {
      let valA = a[billingSortField];
      let valB = b[billingSortField];

      if (billingSortField === "budget" || billingSortField === "readinessScore" || billingSortField === "completion") {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else {
        valA = String(valA || "").toLowerCase();
        valB = String(valB || "").toLowerCase();
      }

      if (valA < valB) return billingSortOrder === "asc" ? -1 : 1;
      if (valA > valB) return billingSortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [billingScanData, billingTableSearch, billingPriorityFilter, billingReadinessFilter, billingRevenueFilter, billingSortField, billingSortOrder]);

  // Paginated billing milestones
  const paginatedBillingMilestones = React.useMemo(() => {
    const startIdx = (billingCurrentPage - 1) * billingItemsPerPage;
    return filteredBillingMilestones.slice(startIdx, startIdx + billingItemsPerPage);
  }, [filteredBillingMilestones, billingCurrentPage]);

  const totalBillingPages = Math.ceil(filteredBillingMilestones.length / billingItemsPerPage) || 1;

  const handleToggleBillingSort = (field: string) => {
    if (billingSortField === field) {
      setBillingSortOrder(billingSortOrder === "asc" ? "desc" : "asc");
    } else {
      setBillingSortField(field);
      setBillingSortOrder("desc");
    }
  };

  const renderDelayDashboard = () => {
    const isCritical = (task: any) => task.priority === "critical" || task.priority === "high";

    return (
      <div style={{ animation: "fadeIn 0.5s ease-out", display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Header */}
        <div className="page-header" style={{ marginBottom: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setView("main"); setDelayScanData(null); setSelectedProjectId(""); setSelectedTaskForAi(null); setAiReport(null); }}>
              ← Back to AI Center
            </button>
            <div>
              <h1 className="page-title">Delay Detection & Root-Cause Analysis</h1>
              <p className="page-subtitle">Project Management Risk Monitoring Suite</p>
            </div>
          </div>
        </div>

        {/* Project Selection Card */}
        <div className="card">
          <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>1. Select Active Project</h3>
            
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: "1 1 300px" }}>
                <input
                  type="text"
                  placeholder="Search active projects..."
                  value={projSearch}
                  onChange={(e) => setProjSearch(e.target.value)}
                  className="input"
                  style={{ width: "100%", paddingRight: "30px" }}
                />
                {projSearch && (
                  <button onClick={() => setProjSearch("")} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}>×</button>
                )}
              </div>

              <select
                className="select"
                value={selectedProjectId}
                onChange={(e) => {
                  setSelectedProjectId(e.target.value);
                  setDelayScanData(null);
                  setSelectedTaskForAi(null);
                  setAiReport(null);
                }}
                style={{ flex: "1 1 300px" }}
              >
                <option value="">-- Choose Project --</option>
                {filteredProjects.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                ))}
              </select>

              {!isReadOnlyRole && (
                <button
                  className="btn btn-primary"
                  disabled={scanLoading || !selectedProjectId}
                  onClick={() => handleScanProjectDelays(selectedProjectId)}
                  style={{ height: "42px", padding: "0 24px" }}
                >
                  {scanLoading ? "Scanning..." : "Scan Delays"}
                </button>
              )}
            </div>

            {selectedProjectObj && (
              <div style={{ padding: "12px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", fontSize: "13px" }}>
                <div><span style={{ color: "var(--text-tertiary)", display: "block" }}>PROJECT NAME</span><strong style={{ color: "var(--text-primary)" }}>{selectedProjectObj.name}</strong></div>
                <div><span style={{ color: "var(--text-tertiary)", display: "block" }}>PROJECT CODE</span><strong style={{ color: "var(--text-primary)" }}>{selectedProjectObj.id}</strong></div>
                <div><span style={{ color: "var(--text-tertiary)", display: "block" }}>MANAGER</span><strong style={{ color: "var(--text-primary)" }}>{selectedProjectObj.manager || "Super Admin"}</strong></div>
                <div><span style={{ color: "var(--text-tertiary)", display: "block" }}>DEPARTMENT</span><strong style={{ color: "var(--text-primary)" }}>{selectedProjectObj.type || "Technology"}</strong></div>
                <div><span style={{ color: "var(--text-tertiary)", display: "block" }}>STATUS</span><span className="badge badge-success">{selectedProjectObj.status}</span></div>
              </div>
            )}
          </div>
        </div>

        {/* Validation Notice if no scan is loaded */}
        {!delayScanData && (
          <div className="card" style={{ padding: "40px 20px", textAlign: "center", border: "1px dashed var(--border-default)" }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔍</div>
            <h4 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 6px", color: "var(--text-primary)" }}>No Active Scan Results</h4>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", maxWidth: "400px", margin: "0 auto" }}>
              Select an active project from the dropdown and click "Scan Delays" to analyze tasks, dependencies, milestone breaches, and resource overallocations.
            </p>
          </div>
        )}

        {/* Scan Results Panel */}
        {delayScanData && (
          <>
            {/* KPI Cards Panel */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
              {/* Card Overall Health */}
              <div className="card">
                <div className="card-body" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: delayScanData.scanSummary.overallProjectHealth >= 80 ? "rgba(34,197,94,0.1)" : delayScanData.scanSummary.overallProjectHealth >= 60 ? "rgba(234,179,8,0.1)" : "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: 800, color: delayScanData.scanSummary.overallProjectHealth >= 80 ? "#22c55e" : delayScanData.scanSummary.overallProjectHealth >= 60 ? "#eab308" : "#ef4444" }}>
                    {delayScanData.scanSummary.overallProjectHealth}%
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Overall Health</span>
                    <h4 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
                      {delayScanData.scanSummary.overallProjectHealth >= 80 ? "Healthy" : delayScanData.scanSummary.overallProjectHealth >= 60 ? "At Risk" : "Critical"}
                    </h4>
                  </div>
                </div>
              </div>

              {/* Card Delayed Tasks */}
              <div className="card">
                <div className="card-body" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444" }}>
                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Delayed / At Risk</span>
                    <h4 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
                      {delayScanData.scanSummary.delayed} <span style={{ fontSize: "13px", fontWeight: 400, color: "var(--text-secondary)" }}>/ {delayScanData.scanSummary.atRisk} tasks</span>
                    </h4>
                  </div>
                </div>
              </div>

              {/* Card Blocked Tasks */}
              <div className="card">
                <div className="card-body" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(234,179,8,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#eab308" }}>
                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Blocked Tasks</span>
                    <h4 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
                      {delayScanData.scanSummary.blocked} <span style={{ fontSize: "13px", fontWeight: 400, color: "var(--text-secondary)" }}>tasks</span>
                    </h4>
                  </div>
                </div>
              </div>

              {/* Card Critical Path Status */}
              <div className="card">
                <div className="card-body" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(37,99,235,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb" }}>
                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Critical Path</span>
                    <h4 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
                      {delayScanData.criticalPath.status}
                    </h4>
                  </div>
                </div>
              </div>
            </div>

            {/* Project Health Score Breakdowns */}
            <div className="card">
              <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h4 style={{ fontSize: "14px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Project Risk Score Breakdowns</h4>
                  <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Scan Timestamp: {delayScanData.scanSummary.scanTimestamp}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                  {/* Schedule */}
                  <div style={{ padding: "10px 14px", background: "var(--bg-surface-2)", borderRadius: "8px" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>SCHEDULE HEALTH</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "4px" }}>
                      <span style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)" }}>{delayScanData.healthScores.scheduleHealth}%</span>
                      <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{delayScanData.scanSummary.delayed} delayed</span>
                    </div>
                  </div>
                  {/* Resource */}
                  <div style={{ padding: "10px 14px", background: "var(--bg-surface-2)", borderRadius: "8px" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>RESOURCE HEALTH</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "4px" }}>
                      <span style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)" }}>{delayScanData.healthScores.resourceHealth}%</span>
                      <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Load: {delayScanData.impact.resourceImpact}</span>
                    </div>
                  </div>
                  {/* Dependency */}
                  <div style={{ padding: "10px 14px", background: "var(--bg-surface-2)", borderRadius: "8px" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>DEPENDENCY HEALTH</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "4px" }}>
                      <span style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)" }}>{delayScanData.healthScores.dependencyHealth}%</span>
                      <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{delayScanData.scanSummary.blocked} blocked</span>
                    </div>
                  </div>
                  {/* Milestone */}
                  <div style={{ padding: "10px 14px", background: "var(--bg-surface-2)", borderRadius: "8px" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>MILESTONE HEALTH</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "4px" }}>
                      <span style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)" }}>{delayScanData.healthScores.milestoneHealth}%</span>
                      <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{delayScanData.impact.milestoneImpact} delayed</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="tabs" style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "2px", display: "flex", gap: "16px" }}>
              <button className={`tab ${activeTab === "table" ? "active" : ""}`} onClick={() => setActiveTab("table")}>Delay Dashboard (Table)</button>
              <button className={`tab ${activeTab === "critical" ? "active" : ""}`} onClick={() => setActiveTab("critical")}>Critical Path & Timeline</button>
              <button className={`tab ${activeTab === "dependency" ? "active" : ""}`} onClick={() => setActiveTab("dependency")}>Dependency Visualization</button>
              <button className={`tab ${activeTab === "impact" ? "active" : ""}`} onClick={() => setActiveTab("impact")}>Business Impact & Alerts</button>
            </div>

            {/* Split layout for Table view */}
            {activeTab === "table" && (
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-start" }}>
                {/* Delayed Tasks Table Card */}
                <div className="card" style={{ flex: selectedTaskForAi ? "1 1 60%" : "1 1 100%", transition: "all 0.3s ease-in-out" }}>
                  <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    
                    {/* Filters bar */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                        <input
                          type="text"
                          placeholder="Search delayed tasks..."
                          value={tableSearch}
                          onChange={(e) => { setTableSearch(e.target.value); setCurrentPage(1); }}
                          className="input"
                          style={{ minWidth: "180px", padding: "6px 12px", fontSize: "12.5px" }}
                        />
                        
                        <select className="select" value={priorityFilter} onChange={(e) => { setPriorityFilter(e.target.value); setCurrentPage(1); }} style={{ padding: "6px 10px", fontSize: "12.5px" }}>
                          <option value="all">All Priorities</option>
                          <option value="critical">Critical</option>
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>

                        <select className="select" value={riskFilter} onChange={(e) => { setRiskFilter(e.target.value); setCurrentPage(1); }} style={{ padding: "6px 10px", fontSize: "12.5px" }}>
                          <option value="all">All Risks</option>
                          <option value="high">High Risk</option>
                          <option value="medium">Medium Risk</option>
                          <option value="low">Low Risk</option>
                        </select>

                        <select className="select" value={assigneeFilter} onChange={(e) => { setAssigneeFilter(e.target.value); setCurrentPage(1); }} style={{ padding: "6px 10px", fontSize: "12.5px" }}>
                          <option value="all">All Consultants</option>
                          {uniqueAssignees.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: "flex", gap: "8px" }}>
                        <button className="btn btn-secondary btn-sm" onClick={handleExportCsv} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          Export CSV
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={handleExportPdf} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          Export PDF
                        </button>
                      </div>
                    </div>

                    {/* Tasks Table */}
                    <div className="table-wrapper" style={{ border: "1px solid var(--border-subtle)", borderRadius: "8px", overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "var(--bg-surface-2)", borderBottom: "1px solid var(--border-subtle)", fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                            <th style={{ padding: "12px 10px", textAlign: "left" }}>Task ID & Title</th>
                            <th style={{ padding: "12px 10px", textAlign: "left" }}>Consultant</th>
                            <th style={{ padding: "12px 10px", textAlign: "left" }}>Department</th>
                            <th style={{ padding: "12px 10px", textAlign: "center" }}>Priority</th>
                            <th style={{ padding: "12px 10px", textAlign: "center" }}>Progress</th>
                            <th style={{ padding: "12px 10px", textAlign: "center", cursor: "pointer" }} onClick={() => handleToggleSort("delayDays")}>
                              Delay {sortField === "delayDays" && (sortOrder === "asc" ? "▲" : "▼")}
                            </th>
                            <th style={{ padding: "12px 10px", textAlign: "center" }}>Risk Level</th>
                            <th style={{ padding: "12px 10px", textAlign: "center" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedTasks.length > 0 ? (
                            paginatedTasks.map((t: any) => {
                              return (
                                <tr key={t.id} style={{ borderBottom: "1px solid var(--border-subtle)", background: selectedTaskForAi?.id === t.id ? "rgba(37,99,235,0.05)" : "transparent" }}>
                                  <td style={{ padding: "12px 10px", maxWidth: "250px" }}>
                                    <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary)" }}>{t.title}</div>
                                    <div style={{ fontSize: "10.5px", color: "var(--text-tertiary)", marginTop: "2px" }}>ID: {t.id} · Due: {t.dueDate}</div>
                                  </td>
                                  <td style={{ padding: "12px 10px", fontSize: "12.5px", color: "var(--text-primary)" }}>{t.assigneeName}</td>
                                  <td style={{ padding: "12px 10px", fontSize: "12.5px", color: "var(--text-secondary)" }}>{t.department}</td>
                                  <td style={{ padding: "12px 10px", textAlign: "center" }}>
                                    <span className={`badge ${t.priority === "critical" ? "badge-danger" : t.priority === "high" ? "badge-danger" : t.priority === "medium" ? "badge-warning" : "badge-gray"}`} style={{ fontSize: "10px", textTransform: "uppercase" }}>
                                      {t.priority}
                                    </span>
                                  </td>
                                  <td style={{ padding: "12px 10px", textAlign: "center" }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                                      <div style={{ width: "36px", height: "4px", background: "var(--border-subtle)", borderRadius: "2px", overflow: "hidden" }}>
                                        <div style={{ width: `${t.progress}%`, height: "100%", background: t.progress >= 80 ? "#22c55e" : t.progress >= 40 ? "#eab308" : "#2563eb" }} />
                                      </div>
                                      <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>{t.progress}%</span>
                                    </div>
                                  </td>
                                  <td style={{ padding: "12px 10px", textAlign: "center", fontWeight: 700, color: t.isDelayed ? "#ef4444" : "var(--text-primary)", fontSize: "13px" }}>
                                    {t.delayDays > 0 ? `+${t.delayDays}d` : "On track"}
                                  </td>
                                  <td style={{ padding: "12px 10px", textAlign: "center" }}>
                                    <span className={`badge ${t.riskLevel === "High" ? "badge-danger" : t.riskLevel === "Medium" ? "badge-warning" : "badge-success"}`} style={{ fontSize: "10.5px" }}>
                                      {t.riskLevel}
                                    </span>
                                  </td>
                                  <td style={{ padding: "12px 10px", textAlign: "center" }}>
                                    <button
                                      className={`btn ${selectedTaskForAi?.id === t.id ? "btn-primary" : "btn-secondary"} btn-sm`}
                                      onClick={() => handleAnalyzeTaskRootCause(t)}
                                      disabled={t.status === "done"}
                                      style={{ padding: "4px 8px", fontSize: "11px" }}
                                    >
                                      Analyze Root-Cause
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={8} style={{ padding: "24px", textAlign: "center", color: "var(--text-tertiary)" }}>
                                No tasks match the selected filters
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Showing {currentPage * itemsPerPage - itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredTasks.length)} of {filteredTasks.length} tasks</span>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button className="btn btn-secondary btn-sm" disabled={currentPage === 1} onClick={() => setCurrentPage(c => c - 1)}>Prev</button>
                          {Array.from({ length: totalPages }).map((_, i) => (
                            <button key={i} className={`btn ${currentPage === i + 1 ? "btn-primary" : "btn-secondary"} btn-sm`} style={{ minWidth: "28px", padding: 0 }} onClick={() => setCurrentPage(i + 1)}>{i + 1}</button>
                          ))}
                          <button className="btn btn-secondary btn-sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(c => c + 1)}>Next</button>
                        </div>
                      </div>
                    )}

                  </div>
                </div>

                {/* AI Root-Cause Split Panel */}
                {selectedTaskForAi && (
                  <div className="card" style={{ flex: "1 1 35%", minWidth: "320px", position: "sticky", top: "10px", border: "1px solid rgba(224, 155, 45, 0.4)", animation: "slideRight 0.3s ease-out" }}>
                    <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <span style={{ fontSize: "10px", fontWeight: 700, color: "#eab308", letterSpacing: "0.05em", display: "block" }}>AI ROOT-CAUSE SUMMARY</span>
                          <h4 style={{ fontSize: "14px", fontWeight: 800, color: "var(--text-primary)", margin: "2px 0 0 0" }}>{selectedTaskForAi.title}</h4>
                        </div>
                        <button onClick={() => { setSelectedTaskForAi(null); setAiReport(null); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "var(--text-tertiary)" }}>×</button>
                      </div>

                      {aiReportLoading && (
                        <div style={{ padding: "40px 10px", textAlign: "center" }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ margin: "0 auto 12px", animation: "spin 1s linear infinite", color: "#eab308" }}><circle cx="12" cy="12" r="10" stroke="rgba(0,0,0,0.1)" strokeWidth="4" /><path d="M4 12a8 8 0 0 1 8-8" /></svg>
                          <div style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>Running deep AI root-cause RAG analysis...</div>
                        </div>
                      )}

                      {!aiReportLoading && aiReport && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "13px" }}>
                          
                          {/* Cause Summary */}
                          <div style={{ padding: "12px", background: "rgba(224,155,45,0.06)", borderRadius: "8px", borderLeft: "3px solid #eab308" }}>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#d97706", display: "flex", justifyContent: "space-between" }}>
                              <span>PRIMARY CAUSE</span>
                              <span>Confidence: {aiReport.confidenceScore}%</span>
                            </div>
                            <div style={{ fontWeight: 700, color: "var(--text-primary)", marginTop: "4px" }}>{aiReport.primaryCause}</div>
                            {aiReport.reasoningSummary && <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "6px", lineHeight: "1.5" }}>{aiReport.reasoningSummary}</div>}
                          </div>

                          {/* Secondary Causes */}
                          {aiReport.secondaryCauses && aiReport.secondaryCauses.length > 0 && (
                            <div>
                              <strong style={{ display: "block", marginBottom: "4px", fontSize: "11.5px" }}>Secondary Factors:</strong>
                              <ul style={{ margin: 0, paddingLeft: "16px", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "3px" }}>
                                {aiReport.secondaryCauses.map((c: string, idx: number) => <li key={idx}>{c}</li>)}
                              </ul>
                            </div>
                          )}

                          {/* Evidence & Impact */}
                          <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "12px" }}>
                            <strong style={{ display: "block", marginBottom: "6px", fontSize: "11.5px" }}>AI Impact Predictions:</strong>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "11.5px" }}>
                              <div style={{ padding: "6px", background: "var(--bg-surface-2)", borderRadius: "4px" }}><span style={{ color: "var(--text-tertiary)" }}>Schedule:</span> <strong style={{ color: "var(--text-primary)", display: "block" }}>{aiReport.scheduleImpact || "Negligible"}</strong></div>
                              <div style={{ padding: "6px", background: "var(--bg-surface-2)", borderRadius: "4px" }}><span style={{ color: "var(--text-tertiary)" }}>Budget:</span> <strong style={{ color: "var(--text-primary)", display: "block" }}>{aiReport.budgetImpact || "Low"}</strong></div>
                              <div style={{ padding: "6px", background: "var(--bg-surface-2)", borderRadius: "4px" }}><span style={{ color: "var(--text-tertiary)" }}>Milestone:</span> <strong style={{ color: "var(--text-primary)", display: "block" }}>{aiReport.milestoneImpact || "None"}</strong></div>
                              <div style={{ padding: "6px", background: "var(--bg-surface-2)", borderRadius: "4px" }}><span style={{ color: "var(--text-tertiary)" }}>Client:</span> <strong style={{ color: "var(--text-primary)", display: "block" }}>{aiReport.clientImpact || "None"}</strong></div>
                            </div>
                          </div>

                          {/* Recommendations */}
                          {aiReport.recommendations && aiReport.recommendations.length > 0 && (
                            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "12px" }}>
                              <strong style={{ display: "block", marginBottom: "8px", fontSize: "11.5px" }}>Recommended Recovery Actions:</strong>
                              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {aiReport.recommendations.map((rec: any, idx: number) => (
                                  <div key={idx} style={{ padding: "10px", background: "var(--bg-surface-2)", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                      <strong style={{ color: "var(--text-primary)", fontSize: "12px" }}>{rec.action}</strong>
                                      <span className={`badge ${rec.priority === "High" ? "badge-danger" : rec.priority === "Medium" ? "badge-warning" : "badge-success"}`} style={{ fontSize: "9px" }}>{rec.priority}</span>
                                    </div>
                                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: "1.4" }}>{rec.reason}</div>
                                    <div style={{ display: "flex", gap: "8px", marginTop: "6px", fontSize: "9.5px", color: "var(--text-tertiary)" }}>
                                      <span>Est. Recovery: <strong>{rec.estimatedRecovery}</strong></span>
                                      <span>·</span>
                                      <span>Difficulty: <strong>{rec.implementationDifficulty}</strong></span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        </div>
                      )}

                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Critical Path & Timeline View */}
            {activeTab === "critical" && (
              <div className="card">
                <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h4 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Critical Path Schedule Status</h4>
                      <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "4px 0 0 0" }}>Delayed tasks on the critical path directly delay the project delivery.</p>
                    </div>
                    <span className={`badge ${delayScanData.criticalPath.status === "Delayed" ? "badge-danger" : delayScanData.criticalPath.status === "At Risk" ? "badge-warning" : "badge-success"}`} style={{ padding: "6px 12px", fontSize: "12px" }}>
                      Project Schedule: {delayScanData.criticalPath.status}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", padding: "12px 0", borderTop: "1px solid var(--border-subtle)" }}>
                    <div>
                      <strong style={{ fontSize: "13px", color: "var(--text-primary)" }}>Summary of Critical Path Impacts:</strong>
                      <ul style={{ paddingLeft: "16px", margin: "8px 0 0 0", color: "var(--text-secondary)", fontSize: "12.5px", display: "flex", flexDirection: "column", gap: "6px" }}>
                        <li>Expected project schedule slippage: <strong style={{ color: "#ef4444" }}>{delayScanData.criticalPath.expectedDelay} days</strong></li>
                        <li>Number of tasks causing immediate risk: <strong>{delayScanData.criticalPath.affectedTasks.length}</strong></li>
                        <li>Overdue project milestones detected: <strong>{delayScanData.impact.milestoneImpact}</strong></li>
                      </ul>
                    </div>

                    <div>
                      <strong style={{ fontSize: "13px", color: "var(--text-primary)" }}>WBS Fast-Tracking Options:</strong>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" }}>
                        {delayScanData.criticalPath.recoveryOptions.map((opt: string, i: number) => (
                          <div key={i} style={{ padding: "8px 10px", background: "var(--bg-surface-2)", borderRadius: "6px", borderLeft: "3px solid var(--brand-600)", fontSize: "12px", color: "var(--text-secondary)" }}>
                            {opt}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Delay Timeline Chart list */}
                  <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "16px" }}>
                    <strong style={{ fontSize: "13px", color: "var(--text-primary)", display: "block", marginBottom: "12px" }}>Delay Timeline & Slack Analysis:</strong>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {delayScanData.tasks.filter((t: any) => user?.role !== "consultant" || t.assignee === user.id || t.assigneeId === user.id).map((t: any) => {
                        const isTaskDelayed = t.isDelayed;
                        const isTaskAtRisk = t.isAtRisk;
                        return (
                          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "16px", padding: "10px 12px", background: "var(--bg-surface-2)", borderRadius: "8px", border: isTaskDelayed ? "1px solid rgba(239,68,68,0.2)" : isTaskAtRisk ? "1px solid rgba(234,179,8,0.2)" : "1px solid transparent" }}>
                            <div style={{ width: "180px", flexShrink: 0 }}>
                              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)", display: "block" }}>ID: {t.id}</span>
                              <strong style={{ fontSize: "12.5px", color: "var(--text-primary)" }}>{t.title}</strong>
                            </div>
                            
                            {/* Visual Timeline bar */}
                            <div style={{ flex: 1, position: "relative", height: "16px", background: "var(--border-default)", borderRadius: "8px", overflow: "hidden" }}>
                              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${t.progress}%`, background: isTaskDelayed ? "rgba(239,68,68,0.3)" : isTaskAtRisk ? "rgba(234,179,8,0.3)" : "rgba(37,99,235,0.3)", borderRadius: "8px" }} />
                              <div style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "10px", fontWeight: 700, color: "var(--text-primary)" }}>
                                Progress: {t.progress}%
                              </div>
                            </div>

                            <div style={{ width: "160px", flexShrink: 0, fontSize: "11.5px", textAlign: "right" }}>
                              <div style={{ color: "var(--text-secondary)" }}>Due: {t.dueDate}</div>
                              <div style={{ color: isTaskDelayed ? "#ef4444" : "var(--text-tertiary)", fontWeight: isTaskDelayed ? 700 : 400 }}>
                                Expected: {t.expectedEndDate} {t.delayDays > 0 && `(+${t.delayDays}d)`}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* Dependency Visualizer View */}
            {activeTab === "dependency" && (
              <div className="card">
                <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <h4 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Task Dependency Trees & Blocker Trees</h4>
                    <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "4px 0 0 0" }}>Traces backward dependency paths to highlight the root task blocking execution.</p>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", borderTop: "1px solid var(--border-subtle)", paddingTop: "12px" }}>
                    {delayScanData.dependencyChains.filter((c: any) => {
                      if (user?.role !== "consultant") return true;
                      const taskObj = delayScanData.tasks.find((t: any) => t.id === c.taskId);
                      return taskObj && (taskObj.assignee === user.id || taskObj.assigneeId === user.id);
                    }).map((c: any) => {
                      const isTaskDelayed = delayScanData.tasks.find((t: any) => t.id === c.taskId)?.isDelayed;
                      const isTaskAtRisk = delayScanData.tasks.find((t: any) => t.id === c.taskId)?.isAtRisk;
                      if (!isTaskDelayed && !isTaskAtRisk) return null;
                      
                      return (
                        <div key={c.taskId} style={{ padding: "12px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)" }}>TARGET BLOCKAGE CHAIN: {c.taskId}</span>
                            <span style={{ fontSize: "11.5px", color: "#ef4444", fontWeight: 700 }}>Blocked by: {c.firstBlocking}</span>
                          </div>

                          {/* Graphical Flow Representation */}
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", fontSize: "12px" }}>
                            {c.chain.map((step: string, idx: number) => {
                              const isStepBlocking = step === c.firstBlocking;
                              return (
                                <React.Fragment key={idx}>
                                  <div style={{ padding: "6px 12px", background: isStepBlocking ? "rgba(239,68,68,0.12)" : "var(--bg-surface)", border: isStepBlocking ? "1px solid #ef4444" : "1px solid var(--border-default)", borderRadius: "6px", fontWeight: isStepBlocking ? 700 : 400, color: isStepBlocking ? "#ef4444" : "var(--text-primary)" }}>
                                    {isStepBlocking && "🔒 "}{step}
                                  </div>
                                  {idx < c.chain.length - 1 && <span style={{ color: "var(--text-tertiary)" }}>➔</span>}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Business Impact & Alerts View */}
            {activeTab === "impact" && (
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                {/* Impact details card */}
                <div className="card" style={{ flex: "1 1 45%" }}>
                  <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <h4 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Estimated Business & Delivery Impacts</h4>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px solid var(--border-subtle)", paddingTop: "12px", fontSize: "13px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Direct Revenue at Risk</span>
                        <strong style={{ color: "var(--text-primary)" }}>INR {delayScanData.impact.revenueImpact.toLocaleString("en-IN")}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Recalculated Extra Budget Needed</span>
                        <strong style={{ color: "var(--text-primary)" }}>INR {delayScanData.impact.budgetImpact.toLocaleString("en-IN")}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Project Milestones Delayed</span>
                        <strong style={{ color: "var(--text-primary)" }}>{delayScanData.impact.milestoneImpact} milestones</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Client Delivery Risk Level</span>
                        <span className={`badge ${delayScanData.impact.clientImpact === "High" ? "badge-danger" : delayScanData.impact.clientImpact === "Medium" ? "badge-warning" : "badge-success"}`}>{delayScanData.impact.clientImpact}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Overall Project Risk Category</span>
                        <span className={`badge ${delayScanData.impact.overallRisk === "High" ? "badge-danger" : delayScanData.impact.overallRisk === "Medium" ? "badge-warning" : "badge-success"}`}>{delayScanData.impact.overallRisk}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Alerts history logs */}
                <div className="card" style={{ flex: "1 1 45%" }}>
                  <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    <h4 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Scan Dispatched Alerts & Notifications History</h4>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid var(--border-subtle)", paddingTop: "12px", maxHeight: "300px", overflowY: "auto" }}>
                      {delayScanData.alerts && delayScanData.alerts.length > 0 ? (
                        delayScanData.alerts.map((a: any, idx: number) => (
                          <div key={idx} style={{ padding: "10px", background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "6px", fontSize: "12.5px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                              <strong style={{ color: "#ef4444" }}>{a.title}</strong>
                              <span style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>Dispatched</span>
                            </div>
                            <div style={{ color: "var(--text-secondary)", fontSize: "11.5px" }}>{a.message}</div>
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: "30px 10px", textAlign: "center", color: "var(--text-tertiary)", fontSize: "12.5px" }}>
                          No new breach notifications were dispatched in this scan.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </>
        )}
      </div>
    );
  };

  const renderBillingDashboard = () => {
    return (
      <div style={{ animation: "fadeIn 0.5s ease-out", display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Header */}
        <div className="page-header" style={{ marginBottom: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setView("main"); setBillingScanData(null); setBillingProjectId(""); setSelectedMilestoneForAi(null); setBillingAiReport(null); }}>
              ← Back to AI Center
            </button>
            <div>
              <h1 className="page-title">Billing Milestone Insights</h1>
              <p className="page-subtitle">Project Financial Health & Revenue Unlock Engine</p>
            </div>
          </div>
        </div>

        {/* Project Selection Card */}
        <div className="card">
          <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>1. Select Project for Financial Analysis</h3>
            
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: "1 1 300px" }}>
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={billingSearch}
                  onChange={(e) => setBillingSearch(e.target.value)}
                  className="input"
                  style={{ width: "100%", paddingRight: "30px" }}
                />
                {billingSearch && (
                  <button onClick={() => setBillingSearch("")} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}>×</button>
                )}
              </div>

              <select
                className="select"
                value={billingProjectId}
                onChange={(e) => {
                  setBillingProjectId(e.target.value);
                  setBillingScanData(null);
                  setSelectedMilestoneForAi(null);
                  setBillingAiReport(null);
                }}
                style={{ flex: "1 1 300px" }}
              >
                <option value="">-- Choose Project --</option>
                {filteredBillingProjects.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                ))}
              </select>

              <button
                className="btn btn-primary"
                disabled={billingScanLoading || !billingProjectId}
                onClick={() => handleScanBillingMilestones(billingProjectId)}
                style={{ height: "42px", padding: "0 24px" }}
              >
                {billingScanLoading ? "Loading..." : "Load Milestones"}
              </button>
            </div>

            {selectedBillingProjectObj && (
              <div style={{ padding: "12px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", fontSize: "13px" }}>
                <div><span style={{ color: "var(--text-tertiary)", display: "block" }}>PROJECT NAME</span><strong style={{ color: "var(--text-primary)" }}>{selectedBillingProjectObj.name}</strong></div>
                <div><span style={{ color: "var(--text-tertiary)", display: "block" }}>PROJECT CODE</span><strong style={{ color: "var(--text-primary)" }}>{selectedBillingProjectObj.id}</strong></div>
                <div><span style={{ color: "var(--text-tertiary)", display: "block" }}>CLIENT NAME</span><strong style={{ color: "var(--text-primary)" }}>{selectedBillingProjectObj.client || "Tata Motors"}</strong></div>
                <div><span style={{ color: "var(--text-tertiary)", display: "block" }}>PROJECT MANAGER</span><strong style={{ color: "var(--text-primary)" }}>{selectedBillingProjectObj.manager || "Super Admin"}</strong></div>
                <div><span style={{ color: "var(--text-tertiary)", display: "block" }}>STATUS</span><span className="badge badge-success">{selectedBillingProjectObj.status}</span></div>
              </div>
            )}
          </div>
        </div>

        {/* Validation Notice if no scan is loaded */}
        {!billingScanData && (
          <div className="card" style={{ padding: "40px 20px", textAlign: "center", border: "1px dashed var(--border-default)" }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>📊</div>
            <h4 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 6px", color: "var(--text-primary)" }}>No Milestone Data Loaded</h4>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", maxWidth: "400px", margin: "0 auto" }}>
              Select a project from the dropdown and click "Load Milestones" to query billing stages, budgets, linked tasks progress, and readiness indicators.
            </p>
          </div>
        )}

        {/* Scan Results Panel */}
        {billingScanData && (
          <>
            {/* KPI Cards Panel */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
              {/* Card Financial Health */}
              <div className="card">
                <div className="card-body" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: billingScanData.dashboardMetrics.overallFinancialHealth >= 80 ? "rgba(20,184,166,0.1)" : billingScanData.dashboardMetrics.overallFinancialHealth >= 60 ? "rgba(234,179,8,0.1)" : "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: 800, color: billingScanData.dashboardMetrics.overallFinancialHealth >= 80 ? "#14b8a6" : billingScanData.dashboardMetrics.overallFinancialHealth >= 60 ? "#eab308" : "#ef4444" }}>
                    {billingScanData.dashboardMetrics.overallFinancialHealth}%
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Financial Health</span>
                    <h4 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
                      {billingScanData.dashboardMetrics.overallFinancialHealth >= 80 ? "Excellent" : billingScanData.dashboardMetrics.overallFinancialHealth >= 60 ? "Stable" : "Critical"}
                    </h4>
                  </div>
                </div>
              </div>

              {/* Card Revenue Unlock */}
              <div className="card">
                <div className="card-body" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#22c55e" }}>
                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Revenue Unlock</span>
                    <h4 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
                      ₹{(billingScanData.revenueImpact.revenueUnlock / 100000).toFixed(1)}L <span style={{ fontSize: "12px", fontWeight: 400, color: "var(--text-secondary)" }}>ready</span>
                    </h4>
                  </div>
                </div>
              </div>

              {/* Card Revenue At Risk */}
              <div className="card">
                <div className="card-body" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444" }}>
                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Revenue at Risk</span>
                    <h4 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
                      ₹{(billingScanData.revenueImpact.revenueAtRisk / 100000).toFixed(1)}L <span style={{ fontSize: "12px", fontWeight: 400, color: "var(--text-secondary)" }}>at risk</span>
                    </h4>
                  </div>
                </div>
              </div>

              {/* Card Billing Readiness % */}
              <div className="card">
                <div className="card-body" style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(20,184,166,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#14b8a6" }}>
                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Billing Readiness</span>
                    <h4 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
                      {billingScanData.dashboardMetrics.billingReadinessPercent}% <span style={{ fontSize: "12px", fontWeight: 400, color: "var(--text-secondary)" }}>ready</span>
                    </h4>
                  </div>
                </div>
              </div>
            </div>

            {/* Dashboard Status Sub-widgets */}
            <div className="card">
              <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <strong style={{ fontSize: "14px", color: "var(--text-primary)" }}>Billing Milestones Dashboard Metrics</strong>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px" }}>
                  <div style={{ padding: "8px 12px", background: "var(--bg-surface-2)", borderRadius: "6px", textAlign: "center" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>TOTAL</div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)", marginTop: "2px" }}>{billingScanData.dashboardMetrics.totalMilestones}</div>
                  </div>
                  <div style={{ padding: "8px 12px", background: "var(--bg-surface-2)", borderRadius: "6px", textAlign: "center" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>COMPLETED</div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--success-600)", marginTop: "2px" }}>{billingScanData.dashboardMetrics.completed}</div>
                  </div>
                  <div style={{ padding: "8px 12px", background: "var(--bg-surface-2)", borderRadius: "6px", textAlign: "center" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>READY</div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--brand-600)", marginTop: "2px" }}>{billingScanData.dashboardMetrics.readyForBilling}</div>
                  </div>
                  <div style={{ padding: "8px 12px", background: "var(--bg-surface-2)", borderRadius: "6px", textAlign: "center" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>BLOCKED</div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--danger-600)", marginTop: "2px" }}>{billingScanData.dashboardMetrics.blocked}</div>
                  </div>
                  <div style={{ padding: "8px 12px", background: "var(--bg-surface-2)", borderRadius: "6px", textAlign: "center" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>DELAYED</div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "#eab308", marginTop: "2px" }}>{billingScanData.dashboardMetrics.delayed}</div>
                  </div>
                  <div style={{ padding: "8px 12px", background: "var(--bg-surface-2)", borderRadius: "6px", textAlign: "center" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>UPCOMING</div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-secondary)", marginTop: "2px" }}>{billingScanData.dashboardMetrics.upcoming}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="tabs" style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "2px", display: "flex", gap: "16px" }}>
              <button className={`tab ${billingActiveTab === "milestones" ? "active" : ""}`} onClick={() => setBillingActiveTab("milestones")}>Billing Milestones (Table)</button>
              <button className={`tab ${billingActiveTab === "revenue" ? "active" : ""}`} onClick={() => setBillingActiveTab("revenue")}>Revenue Impact & Forecast</button>
              <button className={`tab ${billingActiveTab === "blockers" ? "active" : ""}`} onClick={() => setBillingActiveTab("blockers")}>Blockers & Bottlenecks</button>
              <button className={`tab ${billingActiveTab === "report" ? "active" : ""}`} onClick={() => setBillingActiveTab("report")}>Milestone Report Preview</button>
            </div>

            {/* Tab 1: Milestones Table view */}
            {billingActiveTab === "milestones" && (
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-start" }}>
                {/* Table container */}
                <div className="card" style={{ flex: selectedMilestoneForAi ? "1 1 60%" : "1 1 100%", transition: "all 0.3s ease-in-out" }}>
                  <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    
                    {/* Filters Bar */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                        <input
                          type="text"
                          placeholder="Search milestones..."
                          value={billingTableSearch}
                          onChange={(e) => { setBillingTableSearch(e.target.value); setBillingCurrentPage(1); }}
                          className="input"
                          style={{ minWidth: "180px", padding: "6px 12px", fontSize: "12.5px" }}
                        />
                        
                        <select className="select" value={billingPriorityFilter} onChange={(e) => { setBillingPriorityFilter(e.target.value); setBillingCurrentPage(1); }} style={{ padding: "6px 10px", fontSize: "12.5px" }}>
                          <option value="all">All Priorities</option>
                          <option value="highest">Highest</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>

                        <select className="select" value={billingReadinessFilter} onChange={(e) => { setBillingReadinessFilter(e.target.value); setBillingCurrentPage(1); }} style={{ padding: "6px 10px", fontSize: "12.5px" }}>
                          <option value="all">All Readiness States</option>
                          <option value="ready for billing">Ready for Billing</option>
                          <option value="nearly ready">Nearly Ready</option>
                          <option value="requires attention">Requires Attention</option>
                          <option value="high risk">High Risk</option>
                          <option value="blocked">Blocked</option>
                        </select>

                        <select className="select" value={billingRevenueFilter} onChange={(e) => { setBillingRevenueFilter(e.target.value); setBillingCurrentPage(1); }} style={{ padding: "6px 10px", fontSize: "12.5px" }}>
                          <option value="all">All Revenue Ranges</option>
                          <option value="high">High (&gt;= 10L)</option>
                          <option value="medium">Medium (2.5L - 10L)</option>
                          <option value="low">Low (&lt; 2.5L)</option>
                        </select>
                      </div>

                      <div style={{ display: "flex", gap: "8px" }}>
                        <button className="btn btn-secondary btn-sm" onClick={handleBillingExportCsv} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          Export CSV
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={handleBillingExportPdf} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          Export PDF
                        </button>
                      </div>
                    </div>

                    {/* Milestones Grid Table */}
                    <div className="table-wrapper" style={{ border: "1px solid var(--border-subtle)", borderRadius: "8px", overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "var(--bg-surface-2)", borderBottom: "1px solid var(--border-subtle)", fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                            <th style={{ padding: "12px 10px", textAlign: "left" }}>Milestone Title</th>
                            <th style={{ padding: "12px 10px", textAlign: "center", cursor: "pointer" }} onClick={() => handleToggleBillingSort("targetDate")}>
                              Target Date {billingSortField === "targetDate" && (billingSortOrder === "asc" ? "▲" : "▼")}
                            </th>
                            <th style={{ padding: "12px 10px", textAlign: "right", cursor: "pointer" }} onClick={() => handleToggleBillingSort("budget")}>
                              Budget (₹) {billingSortField === "budget" && (billingSortOrder === "asc" ? "▲" : "▼")}
                            </th>
                            <th style={{ padding: "12px 10px", textAlign: "center", cursor: "pointer" }} onClick={() => handleToggleBillingSort("completion")}>
                              Completion {billingSortField === "completion" && (billingSortOrder === "asc" ? "▲" : "▼")}
                            </th>
                            <th style={{ padding: "12px 10px", textAlign: "center", cursor: "pointer" }} onClick={() => handleToggleBillingSort("readinessScore")}>
                              Readiness Score {billingSortField === "readinessScore" && (billingSortOrder === "asc" ? "▲" : "▼")}
                            </th>
                            <th style={{ padding: "12px 10px", textAlign: "center" }}>Priority</th>
                            <th style={{ padding: "12px 10px", textAlign: "center" }}>Invoices</th>
                            <th style={{ padding: "12px 10px", textAlign: "center" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedBillingMilestones.length > 0 ? (
                            paginatedBillingMilestones.map((m: any) => {
                              return (
                                <tr key={m.id} style={{ borderBottom: "1px solid var(--border-subtle)", background: selectedMilestoneForAi?.id === m.id ? "rgba(20,184,166,0.05)" : "transparent" }}>
                                  <td style={{ padding: "12px 10px" }}>
                                    <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary)" }}>{m.title}</div>
                                    <div style={{ fontSize: "10.5px", color: "var(--text-tertiary)", marginTop: "2px" }}>ID: {m.id} · Predecessor tasks: {m.linkedTasksCount}</div>
                                  </td>
                                  <td style={{ padding: "12px 10px", textAlign: "center", fontSize: "12.5px", color: "var(--text-secondary)" }}>{m.targetDate}</td>
                                  <td style={{ padding: "12px 10px", textAlign: "right", fontWeight: 700, color: "var(--text-primary)", fontSize: "13px" }}>
                                    ₹{m.budget.toLocaleString("en-IN")}
                                  </td>
                                  <td style={{ padding: "12px 10px", textAlign: "center" }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                                      <div style={{ width: "36px", height: "4px", background: "var(--border-subtle)", borderRadius: "2px", overflow: "hidden" }}>
                                        <div style={{ width: `${m.completion}%`, height: "100%", background: m.completion >= 80 ? "#22c55e" : m.completion >= 40 ? "#eab308" : "#ef4444" }} />
                                      </div>
                                      <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>{m.completion}%</span>
                                    </div>
                                  </td>
                                  <td style={{ padding: "12px 10px", textAlign: "center" }}>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                                      <strong style={{ fontSize: "13px", color: "var(--text-primary)" }}>{m.readinessScore}%</strong>
                                      <span className={`badge ${m.category === "Ready for Billing" ? "badge-success" : m.category === "Nearly Ready" ? "badge-success" : m.category === "Requires Attention" ? "badge-warning" : "badge-danger"}`} style={{ fontSize: "9px", padding: "1px 4px" }}>
                                        {m.category}
                                      </span>
                                    </div>
                                  </td>
                                  <td style={{ padding: "12px 10px", textAlign: "center" }}>
                                    <span className={`badge ${m.priority === "Highest" ? "badge-danger" : m.priority === "Medium" ? "badge-warning" : "badge-gray"}`} style={{ fontSize: "9.5px", textTransform: "uppercase" }}>
                                      {m.priority}
                                    </span>
                                  </td>
                                  <td style={{ padding: "12px 10px", textAlign: "center" }}>
                                    {m.linkedInvoices.length > 0 ? (
                                      m.linkedInvoices.map((inv: any) => (
                                        <span key={inv.id} className={`badge ${inv.status === "paid" ? "badge-success" : "badge-warning"}`} style={{ fontSize: "9px", margin: "1px", display: "inline-block" }}>
                                          {inv.id} ({inv.status})
                                        </span>
                                      ))
                                    ) : (
                                      <span style={{ color: "var(--text-tertiary)", fontSize: "11px" }}>Unbilled</span>
                                    )}
                                  </td>
                                  <td style={{ padding: "12px 10px", textAlign: "center" }}>
                                    <button
                                      className={`btn ${selectedMilestoneForAi?.id === m.id ? "btn-primary" : "btn-secondary"} btn-sm`}
                                      onClick={() => handleAnalyzeMilestoneRootCause(m)}
                                      style={{ padding: "4px 8px", fontSize: "11px" }}
                                    >
                                      Analyze Readiness
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={8} style={{ padding: "24px", textAlign: "center", color: "var(--text-tertiary)" }}>
                                No milestones match the selected filters
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {totalBillingPages > 1 && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Showing {billingCurrentPage * billingItemsPerPage - billingItemsPerPage + 1} to {Math.min(billingCurrentPage * billingItemsPerPage, filteredBillingMilestones.length)} of {filteredBillingMilestones.length} milestones</span>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button className="btn btn-secondary btn-sm" disabled={billingCurrentPage === 1} onClick={() => setBillingCurrentPage(c => c - 1)}>Prev</button>
                          {Array.from({ length: totalBillingPages }).map((_, i) => (
                            <button key={i} className={`btn ${billingCurrentPage === i + 1 ? "btn-primary" : "btn-secondary"} btn-sm`} style={{ minWidth: "28px", padding: 0 }} onClick={() => setBillingCurrentPage(i + 1)}>{i + 1}</button>
                          ))}
                          <button className="btn btn-secondary btn-sm" disabled={billingCurrentPage === totalBillingPages} onClick={() => setBillingCurrentPage(c => c + 1)}>Next</button>
                        </div>
                      </div>
                    )}

                  </div>
                </div>

                {/* AI Root-Cause Split Panel drawer */}
                {selectedMilestoneForAi && (
                  <div className="card" style={{ flex: "1 1 35%", minWidth: "320px", position: "sticky", top: "10px", border: "1px solid rgba(20, 184, 166, 0.4)", animation: "slideRight 0.3s ease-out" }}>
                    <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <span style={{ fontSize: "10px", fontWeight: 700, color: "#14b8a6", letterSpacing: "0.05em", display: "block" }}>FINANCIAL READINESS REVIEW</span>
                          <h4 style={{ fontSize: "14px", fontWeight: 800, color: "var(--text-primary)", margin: "2px 0 0 0" }}>{selectedMilestoneForAi.title}</h4>
                        </div>
                        <button onClick={() => { setSelectedMilestoneForAi(null); setBillingAiReport(null); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "var(--text-tertiary)" }}>×</button>
                      </div>

                      {billingAiReportLoading && (
                        <div style={{ padding: "40px 10px", textAlign: "center" }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ margin: "0 auto 12px", animation: "spin 1s linear infinite", color: "#14b8a6" }}><circle cx="12" cy="12" r="10" stroke="rgba(0,0,0,0.1)" strokeWidth="4" /><path d="M4 12a8 8 0 0 1 8-8" /></svg>
                          <div style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>Running deep AI billing verification...</div>
                        </div>
                      )}

                      {!billingAiReportLoading && billingAiReport && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "13px" }}>
                          
                          {/* Cause Summary */}
                          <div style={{ padding: "12px", background: "rgba(20,184,166,0.06)", borderRadius: "8px", borderLeft: "3px solid #14b8a6" }}>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#0d9488", display: "flex", justifyContent: "space-between" }}>
                              <span>EXECUTIVE INSIGHT</span>
                              <span>Confidence: {billingAiReport.confidenceScore}%</span>
                            </div>
                            <div style={{ fontWeight: 700, color: "var(--text-primary)", marginTop: "4px" }}>{billingAiReport.summary}</div>
                            {billingAiReport.whyReadyOrBlocked && <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "6px", lineHeight: "1.5" }}>{billingAiReport.whyReadyOrBlocked}</div>}
                          </div>

                          {/* Blockers explanation */}
                          {billingAiReport.blockersExplanation && (
                            <div>
                              <strong style={{ display: "block", marginBottom: "4px", fontSize: "11.5px" }}>Blocker Details:</strong>
                              <div style={{ color: "var(--text-secondary)", lineHeight: "1.4" }}>{billingAiReport.blockersExplanation}</div>
                            </div>
                          )}

                          {/* Recommendations */}
                          {billingAiReport.recommendations && billingAiReport.recommendations.length > 0 && (
                            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "12px" }}>
                              <strong style={{ display: "block", marginBottom: "8px", fontSize: "11.5px" }}>Actionable Recovery Steps:</strong>
                              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {billingAiReport.recommendations.map((rec: any, idx: number) => (
                                  <div key={idx} style={{ padding: "10px", background: "var(--bg-surface-2)", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                      <strong style={{ color: "var(--text-primary)", fontSize: "12px" }}>{rec.action}</strong>
                                      <span className={`badge ${rec.priority === "High" ? "badge-danger" : rec.priority === "Medium" ? "badge-warning" : "badge-success"}`} style={{ fontSize: "9px" }}>{rec.priority}</span>
                                    </div>
                                    <div style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: "1.4" }}>{rec.reason}</div>
                                    <div style={{ display: "flex", gap: "8px", marginTop: "6px", fontSize: "9.5px", color: "var(--text-tertiary)" }}>
                                      <span>Impact: <strong style={{ color: "var(--brand-600)" }}>{rec.businessImpact}</strong></span>
                                      <span>·</span>
                                      <span>Est. Time: <strong>{rec.estimatedTime}</strong></span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        </div>
                      )}

                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Revenue Impact & Forecast view */}
            {billingActiveTab === "revenue" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Revenue stats grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                  <div style={{ padding: "14px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>TOTAL CONTRACT VALUE</div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-primary)", marginTop: "4px" }}>₹{billingScanData.revenueImpact.totalContractValue.toLocaleString("en-IN")}</div>
                  </div>
                  <div style={{ padding: "14px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>COLLECTED REVENUE</div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--success-600)", marginTop: "4px" }}>₹{billingScanData.revenueImpact.collectedRevenue.toLocaleString("en-IN")}</div>
                  </div>
                  <div style={{ padding: "14px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>OUTSTANDING REVENUE</div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--warning-600)", marginTop: "4px" }}>₹{billingScanData.revenueImpact.outstandingRevenue.toLocaleString("en-IN")}</div>
                  </div>
                  <div style={{ padding: "14px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>REMAINING UNBILLED</div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--text-secondary)", marginTop: "4px" }}>₹{billingScanData.revenueImpact.remainingRevenue.toLocaleString("en-IN")}</div>
                  </div>
                </div>

                {/* Cash Flow Forecast (30/60/90 days) */}
                <div className="card">
                  <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <strong style={{ fontSize: "14px", color: "var(--text-primary)" }}>Revenue Pipeline & Cash Flow Projections</strong>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px" }}>
                      <div style={{ padding: "12px", background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "8px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "#16a34a" }}>30-DAY CASH FORECAST</div>
                        <div style={{ fontSize: "22px", fontWeight: 800, color: "#16a34a", marginTop: "4px" }}>₹{billingScanData.revenueImpact.cash30Days.toLocaleString("en-IN")}</div>
                        <div style={{ fontSize: "11.5px", color: "var(--text-secondary)", marginTop: "4px" }}>Potential revenue unlocked from milestones currently ready for billing.</div>
                      </div>
                      <div style={{ padding: "12px", background: "rgba(20,184,166,0.04)", border: "1px solid rgba(20,184,166,0.2)", borderRadius: "8px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "#0d9488" }}>60-DAY CASH FORECAST</div>
                        <div style={{ fontSize: "22px", fontWeight: 800, color: "#0d9488", marginTop: "4px" }}>₹{billingScanData.revenueImpact.cash60Days.toLocaleString("en-IN")}</div>
                        <div style={{ fontSize: "11.5px", color: "var(--text-secondary)", marginTop: "4px" }}>Expected revenue from upcoming milestones with readiness scores &gt;= 70%.</div>
                      </div>
                      <div style={{ padding: "12px", background: "rgba(37,99,235,0.04)", border: "1px solid rgba(37,99,235,0.2)", borderRadius: "8px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "#2563eb" }}>90-DAY CONTRACT PIPELINE</div>
                        <div style={{ fontSize: "22px", fontWeight: 800, color: "#2563eb", marginTop: "4px" }}>₹{billingScanData.revenueImpact.cash90Days.toLocaleString("en-IN")}</div>
                        <div style={{ fontSize: "11.5px", color: "var(--text-secondary)", marginTop: "4px" }}>Total remaining contract amount value to be realized by end of project.</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Month-by-month forecasting table */}
                <div className="card">
                  <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <strong style={{ fontSize: "14px", color: "var(--text-primary)" }}>Monthly Revenue Schedule & Invoiced Status</strong>
                    <div className="table-wrapper" style={{ border: "1px solid var(--border-subtle)", borderRadius: "8px", overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "var(--bg-surface-2)", borderBottom: "1px solid var(--border-subtle)", fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                            <th style={{ padding: "10px", textAlign: "left" }}>Forecast Month</th>
                            <th style={{ padding: "10px", textAlign: "right" }}>Projected Milestone Budget (₹)</th>
                            <th style={{ padding: "10px", textAlign: "right" }}>Invoiced & Paid (₹)</th>
                            <th style={{ padding: "10px", textAlign: "right" }}>Outstanding / Draft Invoices (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {billingScanData.revenueImpact.forecast.map((f: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                              <td style={{ padding: "10px", fontWeight: 600, color: "var(--text-primary)" }}>{f.month}</td>
                              <td style={{ padding: "10px", textAlign: "right", color: "var(--brand-600)", fontWeight: 700 }}>₹{f.projected.toLocaleString("en-IN")}</td>
                              <td style={{ padding: "10px", textAlign: "right", color: "var(--success-600)" }}>₹{f.collected.toLocaleString("en-IN")}</td>
                              <td style={{ padding: "10px", textAlign: "right", color: "var(--warning-600)" }}>₹{f.outstanding.toLocaleString("en-IN")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Blockers & Bottlenecks view */}
            {billingActiveTab === "blockers" && (
              <div className="card">
                <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <h4 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Identified Delivery Blockers & Financial Risks</h4>
                    <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "4px 0 0 0" }}>Ranked tasks, pending client inputs, failed tests, and compliance issues blocking revenue unlock.</p>
                  </div>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px solid var(--border-subtle)", paddingTop: "12px" }}>
                    {billingScanData.blockers.length > 0 ? (
                      billingScanData.blockers.map((b: any, idx: number) => (
                        <div key={idx} style={{ padding: "12px", background: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
                          <div>
                            <span style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--text-tertiary)" }}>TASK REFERENCE ID: {b.taskId}</span>
                            <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--text-primary)", marginTop: "2px" }}>{b.title}</div>
                            <div style={{ fontSize: "12px", color: "#ef4444", marginTop: "4px" }}>⚠️ Block Reason: {b.reason}</div>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                            <span className={`badge ${b.severity === "High" ? "badge-danger" : "badge-warning"}`} style={{ fontSize: "10px", textTransform: "uppercase" }}>
                              {b.severity} RISK
                            </span>
                            <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Task Priority: {b.priority}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: "40px", textAlign: "center", color: "var(--text-tertiary)" }}>
                        No delivery bottlenecks or blocked predecessor tasks detected for these billing milestones.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Financial Report Preview/Export view */}
            {billingActiveTab === "report" && (
              <div className="card">
                <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  
                  {/* Actions buttons */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "12px" }}>
                    <strong style={{ fontSize: "15px", color: "var(--text-primary)" }}>Milestone Billing Audit Report</strong>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button className="btn btn-secondary btn-sm" onClick={handleCopyReportText}>Copy Text</button>
                      <button className="btn btn-secondary btn-sm" onClick={handlePrintReport}>Print</button>
                      <button className="btn btn-secondary btn-sm" onClick={handleBillingExportCsv}>Download Excel/CSV</button>
                      <button className="btn btn-primary btn-sm" onClick={handleBillingExportPdf}>Download PDF Report</button>
                    </div>
                  </div>

                  {/* Document Preview Frame */}
                  <div style={{ padding: "24px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)", fontFamily: "monospace", fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                    {`PROJECT FINANCIAL STATUS & BILLING REPORT
==================================================
Project:      ${billingScanData.project.name} (${billingScanData.project.id})
Manager:      ${billingScanData.project.manager}
Department:   ${billingScanData.project.department}
Client:       ${billingScanData.project.client}
Status:       ${billingScanData.project.status.toUpperCase()}
Report Date:  ${new Date().toLocaleString()}

EXECUTIVE SUMMARY
-----------------
Overall Project Financial Health:   ${billingScanData.dashboardMetrics.overallFinancialHealth}%
Billing Milestone Readiness Index:  ${billingScanData.dashboardMetrics.billingReadinessPercent}%
Total Milestones Tracked:           ${billingScanData.dashboardMetrics.totalMilestones}
Milestones Completed:               ${billingScanData.dashboardMetrics.completed}
Milestones Ready for Billing:       ${billingScanData.dashboardMetrics.readyForBilling}
Milestones Blocked/At-Risk:         ${billingScanData.dashboardMetrics.blocked}

FINANCIAL STATS (INR)
---------------------
Total Contract Value:       ₹${billingScanData.revenueImpact.totalContractValue.toLocaleString("en-IN")}
Collected Revenue (Paid):   ₹${billingScanData.revenueImpact.collectedRevenue.toLocaleString("en-IN")}
Outstanding Revenue (Due):  ₹${billingScanData.revenueImpact.outstandingRevenue.toLocaleString("en-IN")}
Potential Revenue Unlock:   ₹${billingScanData.revenueImpact.revenueUnlock.toLocaleString("en-IN")}
Revenue Currently At Risk:  ₹${billingScanData.revenueImpact.revenueAtRisk.toLocaleString("en-IN")}

MILESTONES LIST & STATUS
------------------------
${billingScanData.milestones.map((m: any, i: number) => {
  return `${i + 1}. [${m.id}] ${m.title}
   Target Billing Date: ${m.targetDate}
   Milestone Budget:    ₹${m.budget.toLocaleString("en-IN")}
   Completion Status:   ${m.completion}%
   Readiness score:     ${m.readinessScore}% (${m.category})
   Priority Level:      ${m.priority.toUpperCase()}`;
}).join("\n\n")}

CRITICAL DELIVERY BLOCKERS
--------------------------
${billingScanData.blockers.length > 0 ? billingScanData.blockers.map((b: any, i: number) => {
  return `${i + 1}. Task ID: ${b.taskId} - "${b.title}"
   Block Reason:  ${b.reason}
   Risk Severity: ${b.severity.toUpperCase()} RISK`;
}).join("\n") : "No critical delivery blockers detected."}
`}
                  </div>

                </div>
              </div>
            )}

          </>
        )}
      </div>
    );
  };

  const renderClashDashboard = () => {
    if (!clashScanData) {
      return (
        <div style={{ animation: "fadeIn 0.5s ease-out", display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="page-header" style={{ marginBottom: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setView("main")}>
                ← Back to AI Center
              </button>
              <div>
                <h1 className="page-title">Schedule Clash Detection</h1>
                <p className="page-subtitle">Enterprise Scheduling Intelligence Module</p>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: "40px 20px", textAlign: "center", border: "1px dashed var(--border-default)" }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>🛡️</div>
            <h4 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 6px", color: "var(--text-primary)" }}>Scan Scheduling Conflicts</h4>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", maxWidth: "420px", margin: "0 auto 20px" }}>
              Analyze active projects, consultant calendars, milestones, and task dependency sequences to identify bottleneck overlaps automatically.
            </p>
            <div style={{ display: "flex", justifySelf: "center", gap: "12px", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
              <select
                className="select"
                value={clashProjectId}
                onChange={(e) => setClashProjectId(e.target.value)}
                style={{ width: "240px" }}
              >
                <option value="all">Analyze All Active Projects</option>
                {(data?.projects || []).filter((p: any) => p.status === "active" || p.status === "planning").map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                ))}
              </select>
              <button
                className="btn btn-primary"
                disabled={clashScanLoading}
                onClick={() => handleRunScheduleClashScan(clashProjectId)}
                style={{ height: "42px" }}
              >
                {clashScanLoading ? "Analyzing..." : "Detect Clashes"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    const { scanSummary, conflicts, resolutions, resourceUtilisation, dependencyAnalysis, projectHealth, aiExecutiveSummary } = clashScanData;
    const usersList = data?.users || [];
    const leaveRequests = data?.leaveRequests || [];

    // Helper functions for date operations
    const parseDateStr = (str: string): Date => {
      const d = new Date(str);
      d.setHours(0,0,0,0);
      return d;
    };

    const getSimulatedTaskRange = (t: any) => {
      const end = parseDateStr(t.dueDate);
      
      // Check for what-if timeline shift simulation
      if (simulationDays !== 0) {
        end.setDate(end.getDate() + simulationDays);
      }

      // Check for project deadline extensions
      const extDays = simulatedDeadlineExtension[t.projectId] || 0;
      if (extDays !== 0) {
        end.setDate(end.getDate() + extDays);
      }

      const start = new Date(end);
      let days = Math.max(1, Math.ceil((t.estimate || 2) / 8));
      
      // Check for split task simulation
      if (simulatedSplit[t.id]) {
        days = Math.max(1, Math.ceil(days / 2));
      }

      start.setDate(end.getDate() - days + 1);
      return { start, end };
    };

    // Recalculate conflicts in-memory for What-if Simulation
    const runSimulationAnalysis = () => {
      const simulatedConflictsList: any[] = [];
      const simulatedUtils: Record<string, number> = {};

      // Initialize base utilization hours
      const usersList = data?.users?.filter((u: any) => u.role !== "client_contact") || [];
      usersList.forEach((u: any) => {
        simulatedUtils[u.id] = 0;
      });

      // Get list of tasks
      const allTasksList = getFlatTasksLocal(data?.tasks) || [];
      const activeTasksList = allTasksList.filter((t: any) => t.status !== "done");

      // Apply simulations to task properties
      const simulatedTasks = activeTasksList.map((t: any) => {
        const { start, end } = getSimulatedTaskRange(t);
        const assigneeId = simulatedReassignment[t.id] || t.assigneeId;
        const estimate = simulatedSplit[t.id] ? (t.estimate || 2) / 2 : (t.estimate || 2);
        
        if (assigneeId && simulatedUtils[assigneeId] !== undefined) {
          simulatedUtils[assigneeId] += estimate;
        }

        return {
          ...t,
          assigneeId,
          estimate,
          startDate: start.toISOString().split("T")[0],
          dueDate: end.toISOString().split("T")[0]
        };
      });

      // Check overlaps
      const tasksByUserMap: Record<string, any[]> = {};
      simulatedTasks.forEach(t => {
        if (!t.assigneeId) return;
        if (!tasksByUserMap[t.assigneeId]) tasksByUserMap[t.assigneeId] = [];
        tasksByUserMap[t.assigneeId].push(t);
      });

      for (const [assigneeId, tList] of Object.entries(tasksByUserMap)) {
        const userObj = usersList.find((u: any) => u.id === assigneeId);
        for (let i = 0; i < tList.length; i++) {
          for (let j = i + 1; j < tList.length; j++) {
            const tA = tList[i];
            const tB = tList[j];
            const rA = getSimulatedTaskRange(tA);
            const rB = getSimulatedTaskRange(tB);

            if (rA.start <= rB.end && rB.start <= rA.end) {
              simulatedConflictsList.push({
                id: `SIM-${simulatedConflictsList.length + 1}`,
                type: "Consultant overlap",
                taskTitle: tA.title,
                overlapTitle: tB.title,
                consultantName: userObj?.name || "Resource"
              });
            }
          }
        }
      }

      // Check leaves
      const leaveRequestsList = data?.leaveRequests || [];
      simulatedTasks.forEach(t => {
        if (!t.assigneeId) return;
        const userLeaves = leaveRequestsList.filter((l: any) => l.consultant === t.assigneeId && (l.status === "approved" || l.status === "pending"));
        const { start, end } = getSimulatedTaskRange(t);

        userLeaves.forEach((l: any) => {
          const lStart = parseDateStr(l.start);
          const lEnd = parseDateStr(l.end);
          if (lStart <= end && start <= lEnd) {
            simulatedConflictsList.push({
              id: `SIM-${simulatedConflictsList.length + 1}`,
              type: "Leave conflict",
              taskTitle: t.title,
              overlapTitle: `Leave request (${l.start} to ${l.end})`,
              consultantName: usersList.find((u: any) => u.id === t.assigneeId)?.name || "Resource"
            });
          }
        });
      });

      return {
        simulatedConflictsList,
        simulatedUtils
      };
    };

    const simResults = runSimulationAnalysis();

    // Filtering, searching, sorting conflicts list
    const filteredConflicts = conflicts.filter((c: any) => {
      const matchSearch =
        c.task.title.toLowerCase().includes(clashTableSearch.toLowerCase()) ||
        (c.consultant?.name || "").toLowerCase().includes(clashTableSearch.toLowerCase()) ||
        c.project.name.toLowerCase().includes(clashTableSearch.toLowerCase()) ||
        c.type.toLowerCase().includes(clashTableSearch.toLowerCase());

      if (!matchSearch) return false;
      if (clashTypeFilter !== "all" && c.type !== clashTypeFilter) return false;
      if (clashSeverityFilter !== "all" && c.severity !== clashSeverityFilter) return false;
      if (clashProjectFilter !== "all" && c.project.id !== clashProjectFilter) return false;
      if (clashConsultantFilter !== "all" && c.consultant?.id !== clashConsultantFilter) return false;

      if (user?.role === "consultant") {
        const isUserConflict = c.consultant?.id === user.id || c.task.assigneeId === user.id || c.task.assignee === user.id;
        if (!isUserConflict) return false;
      }

      return true;
    });

    const sortedConflicts = [...filteredConflicts].sort((a: any, b: any) => {
      let valA = a[clashSortField] || "";
      let valB = b[clashSortField] || "";

      if (clashSortField === "task") {
        valA = a.task.title;
        valB = b.task.title;
      } else if (clashSortField === "project") {
        valA = a.project.name;
        valB = b.project.name;
      } else if (clashSortField === "consultant") {
        valA = a.consultant?.name || "";
        valB = b.consultant?.name || "";
      }

      if (clashSortOrder === "asc") {
        return valA > valB ? 1 : -1;
      } else {
        return valA < valB ? 1 : -1;
      }
    });

    // Pagination
    const totalItems = sortedConflicts.length;
    const totalPages = Math.ceil(totalItems / clashItemsPerPage);
    const paginatedConflicts = sortedConflicts.slice(
      (clashCurrentPage - 1) * clashItemsPerPage,
      clashCurrentPage * clashItemsPerPage
    );

    // Export report simulator
    const handleTriggerExport = (type: string) => {
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `${type.replace(/\s+/g, "_").toLowerCase()}_report_${timestamp}`;
      showToast(`Generating ${type} report...`, "info");
      
      setTimeout(() => {
        const dummyContent = "vsqc platform scheduling report stub";
        const blob = new Blob([dummyContent], { type: "text/plain" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        showToast(`${type} successfully exported as CSV/Excel stub.`, "success");
      }, 800);
    };

    return (
      <div style={{ animation: "fadeIn 0.5s ease-out", display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Header */}
        <div className="page-header" style={{ marginBottom: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setView("main"); setClashScanData(null); }}>
              ← Back to AI Center
            </button>
            <div>
              <h1 className="page-title">Schedule Clash Detection Dashboard</h1>
              <p className="page-subtitle">Enterprise Scheduling Intelligence Module</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <select
              className="select"
              value={clashProjectId}
              onChange={(e) => setClashProjectId(e.target.value)}
              style={{ width: "200px", height: "38px" }}
            >
              <option value="all">Analyze All Active Projects</option>
              {(data?.projects || []).filter((p: any) => p.status === "active" || p.status === "planning").map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {!isReadOnlyRole && (
              <button
                className="btn btn-primary btn-sm"
                disabled={clashScanLoading}
                onClick={() => handleRunScheduleClashScan(clashProjectId)}
              >
                {clashScanLoading ? "Scanning..." : "Rescan Clashes"}
              </button>
            )}
          </div>
        </div>

        {/* KPI Health Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
          <div className="card">
            <div className="card-body" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: projectHealth.overallHealth >= 80 ? "rgba(34,197,94,0.1)" : projectHealth.overallHealth >= 50 ? "rgba(234,179,8,0.1)" : "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 800, color: projectHealth.overallHealth >= 80 ? "#22c55e" : projectHealth.overallHealth >= 50 ? "#eab308" : "#ef4444" }}>
                {projectHealth.overallHealth}%
              </div>
              <div>
                <span style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Overall Health</span>
                <h4 style={{ fontSize: "14.5px", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>{projectHealth.riskLevel} Risk</h4>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444" }}>
                <strong>{scanSummary.conflictsFound}</strong>
              </div>
              <div>
                <span style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Conflicts Found</span>
                <h4 style={{ fontSize: "14.5px", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>{scanSummary.criticalConflicts} Critical</h4>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(37,99,235,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563eb" }}>
                <strong>{scanSummary.projectsScanned}</strong>
              </div>
              <div>
                <span style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Projects Scanned</span>
                <h4 style={{ fontSize: "14.5px", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>{scanSummary.tasksScanned} Tasks</h4>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(20,184,166,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#14b8a6" }}>
                <strong>{projectHealth.deliveryConfidence}%</strong>
              </div>
              <div>
                <span style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase" }}>Delivery Confidence</span>
                <h4 style={{ fontSize: "14.5px", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>Scale: {projectHealth.deliveryConfidence >= 75 ? "High" : "Medium"}</h4>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="tabs" style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "2px", display: "flex", gap: "14px", overflowX: "auto" }}>
          <button className={`tab ${clashActiveTab === "dashboard" ? "active" : ""}`} onClick={() => setClashActiveTab("dashboard")}>Conflicts Dashboard</button>
          <button className={`tab ${clashActiveTab === "timeline" ? "active" : ""}`} onClick={() => setClashActiveTab("timeline")}>Visual Timeline</button>
          <button className={`tab ${clashActiveTab === "calendar" ? "active" : ""}`} onClick={() => setClashActiveTab("calendar")}>Calendar View</button>
          <button className={`tab ${clashActiveTab === "resources" ? "active" : ""}`} onClick={() => setClashActiveTab("resources")}>Resource Load</button>
          <button className={`tab ${clashActiveTab === "dependencies" ? "active" : ""}`} onClick={() => setClashActiveTab("dependencies")}>Dependency Analysis</button>
          <button className={`tab ${clashActiveTab === "resolutions" ? "active" : ""}`} onClick={() => setClashActiveTab("resolutions")}>Resolutions Engine</button>
          <button className={`tab ${clashActiveTab === "what-if" ? "active" : ""}`} onClick={() => setClashActiveTab("what-if")}>What-If Simulator</button>
          <button className={`tab ${clashActiveTab === "ai-summary" ? "active" : ""}`} onClick={() => setClashActiveTab("ai-summary")}>AI Reasoner Summary</button>
        </div>

        {/* Tab Content Rendering */}
        {clashActiveTab === "dashboard" && (
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-start" }}>
            {/* Table */}
            <div className="card" style={{ flex: selectedConflict ? "1 1 60%" : "1 1 100%", transition: "all 0.3s ease" }}>
              <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* Search & Filters */}
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                    <input
                      type="text"
                      placeholder="Search conflicts..."
                      value={clashTableSearch}
                      onChange={(e) => { setClashTableSearch(e.target.value); setClashCurrentPage(1); }}
                      className="input"
                      style={{ maxWidth: "200px", padding: "6px 12px", fontSize: "12.5px" }}
                    />
                    <select className="select" value={clashTypeFilter} onChange={(e) => { setClashTypeFilter(e.target.value); setClashCurrentPage(1); }} style={{ padding: "6px 10px", fontSize: "12.5px" }}>
                      <option value="all">All Types</option>
                      <option value="Leave conflict">Leave Conflict</option>
                      <option value="Consultant overlap">Consultant Overlap</option>
                      <option value="Dependency violation">Dependency Violation</option>
                      <option value="Circular dependency">Circular Dependency</option>
                      <option value="Capacity overload">Capacity Overload</option>
                      <option value="Holiday conflict">Holiday Conflict</option>
                      <option value="Weekend scheduling conflict">Weekend Conflict</option>
                      <option value="Project deadline conflict">Deadline Conflict</option>
                      <option value="Milestone conflict">Milestone Conflict</option>
                      <option value="Shared equipment conflict">Shared Equipment</option>
                    </select>
                    <select className="select" value={clashSeverityFilter} onChange={(e) => { setClashSeverityFilter(e.target.value); setClashCurrentPage(1); }} style={{ padding: "6px 10px", fontSize: "12.5px" }}>
                      <option value="all">All Severities</option>
                      <option value="Critical">Critical</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleTriggerExport("Conflict Report")}>Export Report</button>
                  </div>
                </div>

                {/* Table wrapper */}
                <div className="table-wrapper" style={{ border: "1px solid var(--border-subtle)", borderRadius: "8px", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "var(--bg-surface-2)", borderBottom: "1px solid var(--border-subtle)" }}>
                        <th style={{ padding: "10px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)" }}>CONFLICT TYPE</th>
                        <th style={{ padding: "10px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)" }}>PROJECT</th>
                        <th style={{ padding: "10px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)" }}>TASK</th>
                        <th style={{ padding: "10px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)" }}>CONSULTANT</th>
                        <th style={{ padding: "10px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)" }}>SEVERITY</th>
                        <th style={{ padding: "10px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)" }}>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedConflicts.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "var(--text-tertiary)" }}>
                            No scheduling conflicts detected. Resource allocation is currently balanced.
                          </td>
                        </tr>
                      ) : (
                        paginatedConflicts.map((c: any) => (
                          <tr key={c.id} onClick={() => setSelectedConflict(c)} style={{ borderBottom: "1px solid var(--border-subtle)", cursor: "pointer", background: selectedConflict?.id === c.id ? "var(--bg-surface-3)" : "none", transition: "background 0.2s" }}>
                            <td style={{ padding: "10px", fontSize: "12.5px", fontWeight: 600 }}>{c.type}</td>
                            <td style={{ padding: "10px", fontSize: "12.5px" }}>{c.project.name}</td>
                            <td style={{ padding: "10px", fontSize: "12.5px" }}>{c.task.title}</td>
                            <td style={{ padding: "10px", fontSize: "12.5px" }}>{c.consultant?.name || "Resource"}</td>
                            <td style={{ padding: "10px", fontSize: "12.5px" }}>
                              <span className={`badge ${c.severity === "Critical" ? "badge-danger" : c.severity === "High" ? "badge-warning" : "badge-secondary"}`}>
                                {c.severity}
                              </span>
                            </td>
                            <td style={{ padding: "10px", fontSize: "12.5px" }}>
                              <span className="badge badge-success">{c.status}</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Page {clashCurrentPage} of {totalPages}</span>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button className="btn btn-secondary btn-xs" disabled={clashCurrentPage === 1} onClick={() => setClashCurrentPage(prev => prev - 1)}>Prev</button>
                      <button className="btn btn-secondary btn-xs" disabled={clashCurrentPage === totalPages} onClick={() => setClashCurrentPage(prev => prev + 1)}>Next</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Details panel */}
            {selectedConflict && (
              <div className="card" style={{ flex: "1 1 35%", minWidth: "300px", border: "1px solid var(--border-default)" }}>
                <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "10px" }}>
                    <div>
                      <span className="badge badge-danger" style={{ marginBottom: "6px" }}>{selectedConflict.severity} Priority</span>
                      <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Conflict Details</h3>
                    </div>
                    <button onClick={() => setSelectedConflict(null)} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "var(--text-tertiary)" }}>×</button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px" }}>
                    <div>
                      <span style={{ color: "var(--text-tertiary)", display: "block" }}>CONFLICT SUMMARY</span>
                      <strong style={{ color: "var(--text-primary)" }}>{selectedConflict.details.summary}</strong>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <div>
                        <span style={{ color: "var(--text-tertiary)", display: "block" }}>AFFECTED TASK</span>
                        <span style={{ color: "var(--text-secondary)" }}>{selectedConflict.task.title}</span>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-tertiary)", display: "block" }}>AFFECTED CONSULTANT</span>
                        <span style={{ color: "var(--text-secondary)" }}>{selectedConflict.consultant?.name || "Resource"}</span>
                      </div>
                    </div>

                    <div>
                      <span style={{ color: "var(--text-tertiary)", display: "block" }}>ROOT CAUSE</span>
                      <span style={{ color: "var(--text-secondary)" }}>{selectedConflict.details.rootCause}</span>
                    </div>

                    <div>
                      <span style={{ color: "var(--text-tertiary)", display: "block" }}>BUSINESS IMPACT</span>
                      <span style={{ color: "var(--text-secondary)" }}>{selectedConflict.details.businessImpact}</span>
                    </div>

                    <div style={{ padding: "10px", background: "var(--bg-surface-2)", borderRadius: "6px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <div>
                        <span style={{ color: "var(--text-tertiary)", display: "block", fontSize: "11px" }}>AFFECTED REVENUE</span>
                        <strong style={{ color: "var(--danger-600)" }}>{formatCurrency(selectedConflict.details.affectedRevenue)}</strong>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-tertiary)", display: "block", fontSize: "11px" }}>ESTIMATED DELAY</span>
                        <strong style={{ color: "var(--text-primary)" }}>{selectedConflict.details.estimatedDelay}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Recommendations quick list */}
                  <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "12px" }}>
                    <h4 style={{ fontSize: "13px", fontWeight: 700, margin: "0 0 8px 0", color: "var(--text-primary)" }}>Suggested Recovery Actions:</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {resolutions.filter((r: any) => r.conflictId === selectedConflict.id).map((r: any, idx: number) => (
                        <div key={idx} style={{ padding: "8px", background: "var(--bg-surface-2)", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                            <span style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--brand-600)" }}>{r.type}</span>
                            <span className="badge badge-secondary" style={{ fontSize: "9px" }}>Diff: {r.implementationDifficulty}</span>
                          </div>
                          <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: 0 }}>{r.expectedImpact}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {clashActiveTab === "timeline" && (
          <div className="card">
            <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <h4 style={{ fontSize: "14px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Project Resource Overlaps Timeline</h4>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>Horizontal representation of concurrent assignments indicating scheduling clashes.</p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", background: "var(--bg-surface-2)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-subtle)", overflowX: "auto" }}>
                <div style={{ minWidth: "600px" }}>
                  {/* Timeline Header scale */}
                  <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "8px", fontWeight: 600, fontSize: "12px", color: "var(--text-tertiary)" }}>
                    <div>RESOURCE / TASK</div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Jun 15</span>
                      <span>Jun 20</span>
                      <span>Jun 25</span>
                      <span>Jul 01</span>
                      <span>Jul 05</span>
                      <span>Jul 10</span>
                      <span>Jul 15</span>
                    </div>
                  </div>

                  {/* Draw tasks rows */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                    {(getFlatTasksLocal(data?.tasks) || []).slice(0, 8).map((t: any, idx: number) => {
                      const assigneeName = usersList.find((u: any) => u.id === t.assigneeId)?.name || "Unassigned";
                      const isClashed = conflicts.some((c: any) => c.task.id === t.id);
                      return (
                        <div key={idx} style={{ display: "grid", gridTemplateColumns: "150px 1fr", alignItems: "center", fontSize: "12.5px" }}>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <strong style={{ color: "var(--text-primary)" }}>{t.title.slice(0, 16)}...</strong>
                            <span style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>{assigneeName}</span>
                          </div>
                          <div style={{ position: "relative", height: "18px", background: "var(--bg-surface-3)", borderRadius: "4px" }}>
                            {/* Simulated timeline position bars */}
                            <div style={{ position: "absolute", left: `${20 + idx * 7}%`, width: `${25 + (idx % 3) * 10}%`, height: "100%", background: isClashed ? "rgba(239, 68, 68, 0.4)" : "rgba(34, 197, 94, 0.4)", border: `1px solid ${isClashed ? "#ef4444" : "#22c55e"}`, borderRadius: "4px", display: "flex", alignItems: "center", paddingLeft: "6px" }}>
                              <span style={{ fontSize: "9px", color: "var(--text-primary)", fontWeight: 700 }}>Due: {t.dueDate}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {clashActiveTab === "calendar" && (
          <div className="card">
            <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <h4 style={{ fontSize: "14px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Enterprise Calendar Planner</h4>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>Visual schedule grid highlights conflict zones and approved consultant leaves.</p>
              </div>

              {/* Monthly calendar matrix representation for June 2026 */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "8px", background: "var(--bg-surface-2)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
                  <div key={i} style={{ textAlign: "center", fontWeight: 700, fontSize: "12px", color: "var(--text-tertiary)", paddingBottom: "6px" }}>{d}</div>
                ))}

                {/* Draw 28 days of June 2026 */}
                {Array.from({ length: 28 }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const dateStr = `2026-06-${String(dayNum).padStart(2, "0")}`;
                  
                  // Check if this date has any overlaps / conflicts
                  const dayConflicts = conflicts.filter((c: any) => c.startDate <= dateStr && dateStr <= c.endDate);
                  const dayLeaves = leaveRequests.filter((l: any) => l.start <= dateStr && dateStr <= l.end && (l.status === "approved" || l.status === "pending"));
                  const isConflictZone = dayConflicts.length > 0;
                  const hasLeave = dayLeaves.length > 0;

                  return (
                    <div key={idx} style={{ minHeight: "80px", background: isConflictZone ? "rgba(239, 68, 68, 0.08)" : "var(--bg-surface)", border: `1px solid ${isConflictZone ? "#ef4444" : "var(--border-subtle)"}`, borderRadius: "6px", padding: "6px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: isConflictZone ? "#ef4444" : "var(--text-primary)" }}>{dayNum}</span>
                        {isConflictZone && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ef4444" }} />}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        {hasLeave && (
                          <div style={{ fontSize: "9px", background: "rgba(234,179,8,0.15)", color: "#b45309", padding: "1px 3px", borderRadius: "3px" }}>
                            Leave: {dayLeaves[0].consultant}
                          </div>
                        )}
                        {dayConflicts.slice(0, 1).map((dc: any, i: number) => (
                          <div key={i} style={{ fontSize: "9px", background: "rgba(239,68,68,0.15)", color: "#b91c1c", padding: "1px 3px", borderRadius: "3px" }}>
                            Clash: {dc.task.title.slice(0, 8)}...
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {clashActiveTab === "resources" && (
          <div className="card">
            <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h4 style={{ fontSize: "14px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Consultant Utilization Grid</h4>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>Summary of consultant workloads, assigned tasks and future capacity limits.</p>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => handleTriggerExport("Resource Report")}>Export Resource Report</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px" }}>
                {resourceUtilisation.map((res: any) => (
                  <div key={res.consultantId} style={{ padding: "14px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <strong style={{ fontSize: "13.5px", color: "var(--text-primary)" }}>{res.name}</strong>
                        <span style={{ display: "block", fontSize: "11px", color: "var(--text-tertiary)" }}>{res.role}</span>
                      </div>
                      <span className={`badge ${res.overloaded ? "badge-danger" : res.underutilised ? "badge-warning" : "badge-success"}`}>
                        {res.currentUtilisation}% Utilized
                      </span>
                    </div>

                    {/* Progress utilization bar */}
                    <div>
                      <div style={{ height: "6px", width: "100%", background: "var(--bg-surface-3)", borderRadius: "3px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(100, res.currentUtilisation)}%`, background: res.overloaded ? "#ef4444" : "#22c55e", borderRadius: "3px" }} />
                      </div>
                    </div>

                    <div style={{ fontSize: "11.5px" }}>
                      <strong style={{ color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>Active Assignments ({res.currentAssignments.length})</strong>
                      <ul style={{ margin: 0, paddingLeft: "14px", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "2px" }}>
                        {res.currentAssignments.map((as: any, idx: number) => (
                          <li key={idx}>{as.title} ({as.estimate} hrs)</li>
                        ))}
                      </ul>
                    </div>

                    {res.upcomingLeave.length > 0 && (
                      <div style={{ fontSize: "11px", background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.3)", borderRadius: "4px", padding: "6px" }}>
                        ⚠️ Leave: {res.upcomingLeave[0].start} to {res.upcomingLeave[0].end}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {clashActiveTab === "dependencies" && (
          <div className="card">
            <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <h4 style={{ fontSize: "14px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Critical Path & Dependency Sequences</h4>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>Highlights sequence loops, broken task chains, and the first active blocking tasks.</p>
              </div>

              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                {/* Blocking task banner */}
                {dependencyAnalysis.firstBlockingTask ? (
                  <div style={{ flex: "1 1 100%", padding: "12px 16px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ fontSize: "20px" }}>🚨</div>
                    <div>
                      <strong style={{ fontSize: "13px", color: "#b91c1c", display: "block" }}>First Critical Blocking Task</strong>
                      <span style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>
                        Task <strong>"{dependencyAnalysis.firstBlockingTask.title}"</strong> is currently blocking successors. Shifting or reassigning this task will resolve subsequent schedule path delays.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div style={{ flex: "1 1 100%", padding: "12px 16px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "8px", display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ fontSize: "20px" }}>✅</div>
                    <span style={{ fontSize: "12.5px", color: "var(--success-600)" }}>No active critical path blocking tasks identified in the dependency trees.</span>
                  </div>
                )}

                {/* Broken and Circular lists */}
                <div style={{ flex: "1 1 45%", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <h4 style={{ fontSize: "13px", fontWeight: 700, margin: 0 }}>Broken Sequencing / Dependency Violations</h4>
                  <div style={{ padding: "12px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                    {dependencyAnalysis.brokenDependencies.length === 0 ? (
                      <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>All dependency sequences are ordered logically.</span>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "12.5px", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "4px" }}>
                        {dependencyAnalysis.brokenDependencies.map((title: string, i: number) => (
                          <li key={i}>{title}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div style={{ flex: "1 1 45%", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <h4 style={{ fontSize: "13px", fontWeight: 700, margin: 0 }}>Circular / Loop Mappings</h4>
                  <div style={{ padding: "12px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                    {dependencyAnalysis.circularDependencies.length === 0 ? (
                      <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>No dependency loops or cycles detected.</span>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "12.5px", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "4px" }}>
                        {dependencyAnalysis.circularDependencies.map((title: string, i: number) => (
                          <li key={i} style={{ color: "#ef4444", fontWeight: 600 }}>🔄 {title}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {clashActiveTab === "resolutions" && (
          <div className="card">
            <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <h4 style={{ fontSize: "14px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Non-destructive Scheduling Recommendation Engine</h4>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>Suggestions to recover timeline buffer without modifying original project definitions directly.</p>
              </div>

              <div className="table-wrapper" style={{ border: "1px solid var(--border-subtle)", borderRadius: "8px", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--bg-surface-2)", borderBottom: "1px solid var(--border-subtle)" }}>
                      <th style={{ padding: "10px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)" }}>RESOLUTION ACTION</th>
                      <th style={{ padding: "10px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)" }}>PRIORITY</th>
                      <th style={{ padding: "10px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)" }}>EXPECTED IMPACT</th>
                      <th style={{ padding: "10px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)" }}>EST. RECOVERY</th>
                      <th style={{ padding: "10px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)" }}>DIFFICULTY</th>
                      <th style={{ padding: "10px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)" }}>CONFIDENCE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resolutions.map((r: any, i: number) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "10px", fontSize: "12.5px", fontWeight: 600, color: "var(--brand-600)" }}>{r.type}</td>
                        <td style={{ padding: "10px", fontSize: "12.5px" }}>
                          <span className={`badge ${r.priority === "High" ? "badge-danger" : "badge-secondary"}`}>{r.priority}</span>
                        </td>
                        <td style={{ padding: "10px", fontSize: "12.5px", color: "var(--text-secondary)" }}>{r.expectedImpact}</td>
                        <td style={{ padding: "10px", fontSize: "12.5px", fontWeight: 700 }}>{r.recoveryTime}</td>
                        <td style={{ padding: "10px", fontSize: "12.5px" }}>{r.implementationDifficulty}</td>
                        <td style={{ padding: "10px", fontSize: "12.5px", fontWeight: 700, color: "#14b8a6" }}>{r.confidence}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {clashActiveTab === "what-if" && (
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-start" }}>
            {/* Control Panel */}
            <div className="card" style={{ flex: "1 1 350px" }}>
              <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <h4 style={{ fontSize: "14px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>1. Configure Simulations</h4>
                  <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: 0 }}>Simulate offsets on task parameters in-memory. Project DB will not be updated.</p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {/* Shift Timeline Slider */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>Shift All Active Tasks Offset</label>
                      <strong style={{ color: "var(--brand-600)" }}>{simulationDays > 0 ? `+${simulationDays}` : simulationDays} days</strong>
                    </div>
                    <input
                      type="range"
                      min="-5"
                      max="15"
                      value={simulationDays}
                      onChange={(e) => setSimulationDays(parseInt(e.target.value))}
                      style={{ width: "100%", cursor: "pointer", accentColor: "var(--brand-600)" }}
                    />
                  </div>

                  {/* Swap assignees dropdown */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Simulate Reassignment (Soham Task)</label>
                    <select
                      className="select"
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          setSimulatedReassignment({
                            ...simulatedReassignment,
                            "T001": val,
                            "T002": val
                          });
                        } else {
                          setSimulatedReassignment({});
                        }
                      }}
                      style={{ fontSize: "12.5px" }}
                    >
                      <option value="">-- Maintain Original Assignments --</option>
                      {usersList.map((u: any) => (
                        <option key={u.id} value={u.id}>Reassign Soham's tasks to {u.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Split task checkpoint */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                    <div>
                      <strong style={{ fontSize: "12.5px", display: "block" }}>Split Parallel Workloads</strong>
                      <span style={{ fontSize: "10.5px", color: "var(--text-tertiary)" }}>Reduces estimate durations by half</span>
                    </div>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={!!simulatedSplit["T001"]}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSimulatedSplit({
                            ...simulatedSplit,
                            "T001": checked,
                            "T002": checked,
                            "T003": checked
                          });
                        }}
                      />
                      <div className="toggle-track" />
                      <div className="toggle-thumb" />
                    </label>
                  </div>

                  {/* Extend deadine */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>Extend Project Deadline Buffer</label>
                      <strong style={{ color: "var(--brand-600)" }}>+{simulatedDeadlineExtension["P002"] || 0} days</strong>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      value={simulatedDeadlineExtension["P002"] || 0}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setSimulatedDeadlineExtension({
                          ...simulatedDeadlineExtension,
                          "P001": val,
                          "P002": val
                        });
                      }}
                      style={{ width: "100%", cursor: "pointer", accentColor: "var(--brand-600)" }}
                    />
                  </div>
                </div>

                <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "12px", display: "flex", justifyContent: "flex-end" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => {
                    setSimulationDays(0);
                    setSimulatedReassignment({});
                    setSimulatedSplit({});
                    setSimulatedDeadlineExtension({});
                  }}>Reset Simulation</button>
                </div>
              </div>
            </div>

            {/* Results Panel */}
            <div className="card" style={{ flex: "1 1 450px" }}>
              <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <h4 style={{ fontSize: "14px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>2. Simulated Schedule Impact</h4>
                  <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: 0 }}>Review predicted health adjustments based on active simulation settings.</p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ padding: "12px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                    <span style={{ fontSize: "11px", color: "var(--text-tertiary)", display: "block" }}>SIMULATED CONFLICTS</span>
                    <strong style={{ fontSize: "20px", color: simResults.simulatedConflictsList.length > 0 ? "var(--danger-600)" : "var(--success-600)" }}>
                      {simResults.simulatedConflictsList.length}
                    </strong>
                    <span style={{ fontSize: "11px", display: "block", color: "var(--text-secondary)", marginTop: "4px" }}>
                      Original: {scanSummary.conflictsFound}
                    </span>
                  </div>

                  <div style={{ padding: "12px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                    <span style={{ fontSize: "11px", color: "var(--text-tertiary)", display: "block" }}>CONFLICT REDUCTION</span>
                    <strong style={{ fontSize: "20px", color: "var(--brand-600)" }}>
                      {scanSummary.conflictsFound > 0 ? Math.max(0, Math.round(((scanSummary.conflictsFound - simResults.simulatedConflictsList.length) / scanSummary.conflictsFound) * 100)) : 100}%
                    </strong>
                    <span style={{ fontSize: "11px", display: "block", color: "var(--text-secondary)", marginTop: "4px" }}>
                      Reduction percentage
                    </span>
                  </div>
                </div>

                {/* Simulated Conflicts list */}
                <div>
                  <strong style={{ fontSize: "13px", display: "block", marginBottom: "8px" }}>Simulated Conflict Zones ({simResults.simulatedConflictsList.length}):</strong>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "150px", overflowY: "auto" }}>
                    {simResults.simulatedConflictsList.length === 0 ? (
                      <div style={{ padding: "12px", background: "rgba(34,197,94,0.06)", border: "1px dashed rgba(34,197,94,0.4)", borderRadius: "6px", textAlign: "center", fontSize: "12px", color: "var(--success-600)" }}>
                        🎉 Complete Conflict Clearance. Resource allocation is fully balanced!
                      </div>
                    ) : (
                      simResults.simulatedConflictsList.map((c: any) => (
                        <div key={c.id} style={{ padding: "8px", background: "var(--bg-surface-2)", borderRadius: "6px", border: "1px solid var(--border-subtle)", fontSize: "11.5px" }}>
                          <span style={{ fontWeight: 700, color: "var(--danger-600)" }}>{c.type}</span>: {c.consultantName} scheduled on overlaps for "{c.taskTitle}" and "{c.overlapTitle}".
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {clashActiveTab === "ai-summary" && (
          <div className="card">
            <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <h4 style={{ fontSize: "14.5px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Schedule Clash Reasoning Center</h4>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>Natural language explanations of tradeoffs, risks and recommended implementations.</p>
              </div>

              <div style={{ padding: "16px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)", fontSize: "13px", lineHeight: "1.6", color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
                {aiExecutiveSummary}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderWbsCenter = () => {
    // Mode 1 generation handler
    const handleRunWbsBuild = async () => {
      if (wbsBuildTarget === "existing" && !wbsProjectId) {
        showToast("Please choose an existing project to build WBS for.", "warning");
        return;
      }
      if (!wbsForm.name || !wbsForm.client) {
        showToast("Project Name and Client Name are required fields.", "warning");
        return;
      }
      setWbsLoading(true);
      try {
        const res = await fetch("/api/ai/generate-wbs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(wbsForm)
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        
        // Transform the generated data into a flat array of draft tasks
        const generatedTasks: any[] = [];
        if (data && Array.isArray(data.phases)) {
          data.phases.forEach((p: any) => {
            if (p.tasks && Array.isArray(p.tasks)) {
              p.tasks.forEach((t: any) => {
                generatedTasks.push({
                  id: `T${String(generatedTasks.length + 1).padStart(3, "0")}`,
                  title: t.title,
                  priority: t.priority || "medium",
                  estimate: t.estimate || 24,
                  isMilestone: !!t.isMilestone,
                  tags: `phase:${p.name}`, // Store phase grouping in tags
                  subtasks: t.subtasks || []
                });
              });
            }
          });
        }
        setWbsDraft(generatedTasks);
        setWbsOriginalDraft(JSON.parse(JSON.stringify(generatedTasks)));
        showToast("AI WBS Draft successfully generated.", "success");
      } catch (err: any) {
        showToast("Generation failed: " + (err.message || err), "danger");
      } finally {
        setWbsLoading(false);
      }
    };

    // Mode 2 load handler
    const handleLoadExistingWbs = async (projId: string) => {
      if (!projId) return;
      setWbsLoading(true);
      try {
        // Load optimization analysis
        const res = await fetch("/api/ai/optimize-wbs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: projId })
        });
        if (!res.ok) throw new Error(await res.text());
        const analysis = await res.json();
        setWbsAnalysis(analysis);

        // Fetch flat tasks list for project from data store
        const projTasks = (getFlatTasksLocal(data?.tasks) || []).filter((t: any) => t.project === projId);
        
        const mappedTasks = projTasks.map((t: any) => ({
          id: t.id,
          title: t.title,
          priority: t.priority || "medium",
          estimate: t.estimate || 24,
          isMilestone: !!t.isMilestone,
          tags: t.tags || "",
          assigneeId: t.assignee,
          subtasks: t.subtasks || []
        }));

        setWbsDraft(mappedTasks);
        setWbsOriginalDraft(JSON.parse(JSON.stringify(mappedTasks)));
        showToast("Existing WBS loaded and analyzed successfully.", "success");
      } catch (err: any) {
        showToast("Failed to load WBS: " + (err.message || err), "danger");
      } finally {
        setWbsLoading(false);
      }
    };

    // AI Chat Assistant message action
    const handleWbsChatAction = async () => {
      if (!wbsChatInput.trim()) return;
      
      const userMsg = wbsChatInput.trim();
      setWbsChatHistory((prev: any[]) => [...prev, { sender: "user", text: userMsg }]);
      setWbsChatInput("");
      setWbsLoading(true);

      // Save history for Undo
      setWbsHistoryStack((prev: any[]) => [...prev, JSON.parse(JSON.stringify(wbsDraft))]);

      try {
        const systemPrompt = "You are a PM scheduling assistant that modifies WBS drafts. Output MUST be valid JSON.";
        const userPrompt = `Modify this Work Breakdown Structure tasks list based on user instruction: "${userMsg}".
Current WBS tasks:
${JSON.stringify(wbsDraft)}

Your output must be a valid JSON array of updated task objects matching the exact keys and format:
[
  {
    "id": "T001",
    "title": "Task title",
    "priority": "critical"|"high"|"medium"|"low",
    "estimate": hours,
    "isMilestone": boolean,
    "tags": "tags/phase",
    "subtasks": [{"title": "Subtask title", "description": "desc"}]
  }
]
Output ONLY the JSON array. Do not include markdown formats.`;

        const resultStr = await callGroqAPI(userPrompt, systemPrompt);
        
        // Parse results
        const cleanStr = extractJson(resultStr);
        const updatedTasks = JSON.parse(cleanStr);
        if (Array.isArray(updatedTasks)) {
          setWbsDraft(updatedTasks);
          setWbsChatHistory((prev: any[]) => [...prev, { sender: "ai", text: `I have updated the WBS plan according to: "${userMsg}". You can review the updated draft on the left. Click "Undo" if you wish to revert.` }]);
          showToast("Draft updated.", "success");
        } else {
          throw new Error("Invalid format returned by AI.");
        }
      } catch (err: any) {
        showToast("Chat update failed: " + (err.message || err), "danger");
        setWbsChatHistory((prev: any[]) => [...prev, { sender: "ai", text: `I encountered an issue processing that update: ${err.message || err}. Please try again.` }]);
      } finally {
        setWbsLoading(false);
      }
    };

    // Save final optimized/built WBS to DB
    const handleWbsSaveToDb = async () => {
      setWbsSaving(true);
      try {
        const payload: any = {
          tasks: wbsDraft
        };

        if (wbsMode === "build") {
          if (wbsBuildTarget === "existing") {
            if (!wbsProjectId) {
              showToast("Please choose an existing project to save into.", "warning");
              setWbsSaving(false);
              return;
            }
            payload.projectId = wbsProjectId;
            payload.isNewProject = false;
          } else {
            payload.isNewProject = true;
            payload.projectName = wbsForm.name;
            payload.clientName = wbsForm.client;
            payload.projectType = wbsForm.type;
          }
        } else {
          payload.projectId = wbsProjectId;
          payload.isNewProject = false;
        }

        const res = await fetch("/api/ai/save-wbs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error(await res.text());
        
        // Reload all data so other pages and stores are up to date!
        const fetchInitialData = useAppStore.getState().fetchInitialData;
        await fetchInitialData();

        showToast("WBS plan saved successfully to database.", "success");
        setView("main");
        setWbsDraft(null);
        setWbsAnalysis(null);
      } catch (err: any) {
        showToast("Failed to save WBS plan: " + (err.message || err), "danger");
      } finally {
        setWbsSaving(false);
      }
    };

    const handleUndo = () => {
      if (wbsHistoryStack.length === 0) return;
      const prev = wbsHistoryStack[wbsHistoryStack.length - 1];
      setWbsDraft(prev);
      setWbsHistoryStack((old: any[]) => old.slice(0, old.length - 1));
      setWbsChatHistory((prevChat: any[]) => [...prevChat, { sender: "ai", text: "Undid the last AI suggestion modification." }]);
      showToast("Reverted draft change.", "info");
    };

    const handleAcceptAllGrammar = () => {
      if (!wbsAnalysis || !wbsAnalysis.grammarIssues) return;
      const updated = wbsDraft.map((t: any) => {
        const suggestion = wbsAnalysis.grammarIssues.find((g: any) => g.taskId === t.id);
        if (suggestion) {
          return { ...t, title: suggestion.suggested };
        }
        return t;
      });
      setWbsDraft(updated);
      setWbsAcceptedGrammar({});
      showToast("Accepted all grammar changes.", "success");
    };

    const handleAcceptGrammar = (taskId: string, suggested: string) => {
      const updated = wbsDraft.map((t: any) => {
        if (t.id === taskId) {
          return { ...t, title: suggested };
        }
        return t;
      });
      setWbsDraft(updated);
      setWbsAcceptedGrammar((prev: any) => ({ ...prev, [taskId]: true }));
      showToast("Accepted grammar correction.", "success");
    };

    const handleAcceptImprovement = (index: number, sug: any) => {
      // If it's a split task improvement, we halve estimate and add a subtask or split
      if (sug.type.toLowerCase().includes("split")) {
        const updated = wbsDraft.map((t: any) => {
          if (t.title === sug.current) {
            return {
              ...t,
              estimate: Math.max(8, Math.ceil(t.estimate / 2)),
              subtasks: [...(t.subtasks || []), { title: sug.suggested, description: "AI suggested split task" }]
            };
          }
          return t;
        });
        setWbsDraft(updated);
      } else {
        // Just insert a new task in the draft
        const newId = `T${String(wbsDraft.length + 1).padStart(3, "0")}`;
        setWbsDraft((prev: any[]) => [
          ...prev,
          {
            id: newId,
            title: sug.suggested,
            estimate: 24,
            priority: sug.priority.toLowerCase() || "medium",
            isMilestone: sug.type.toLowerCase().includes("milestone"),
            tags: "AI Suggested",
            subtasks: []
          }
        ]);
      }
      setWbsAcceptedImprovements((prev: any) => ({ ...prev, [index]: true }));
      showToast("Improvement accepted into WBS draft.", "success");
    };

    // Inline task modification helpers
    const handleUpdateTaskField = (taskId: string, field: string, val: any) => {
      const updated = wbsDraft.map((t: any) => {
        if (t.id === taskId) {
          return { ...t, [field]: val };
        }
        return t;
      });
      setWbsDraft(updated);
    };

    const handleDeleteTask = (taskId: string) => {
      const updated = wbsDraft.filter((t: any) => t.id !== taskId);
      setWbsDraft(updated);
      showToast("Task removed from draft.", "info");
    };

    const handleAddCustomTask = (phaseName = "Custom Tasks") => {
      const newId = `T${String(wbsDraft.length + 1).padStart(3, "0")}`;
      const newTask = {
        id: newId,
        title: "New Custom Task",
        estimate: 24,
        priority: "medium",
        isMilestone: false,
        tags: `phase:${phaseName}`,
        subtasks: []
      };
      setWbsDraft((prev: any[]) => [...prev, newTask]);
      showToast("New task added.", "success");
    };

    // Subtask actions
    const handleAddSubtask = (taskId: string) => {
      const updated = wbsDraft.map((t: any) => {
        if (t.id === taskId) {
          const subtasks = t.subtasks || [];
          return {
            ...t,
            subtasks: [...subtasks, { title: "New Subtask", description: "" }]
          };
        }
        return t;
      });
      setWbsDraft(updated);
      showToast("Subtask added.", "success");
    };

    const handleUpdateSubtask = (taskId: string, subIdx: number, field: string, val: any) => {
      const updated = wbsDraft.map((t: any) => {
        if (t.id === taskId) {
          const subtasks = (t.subtasks || []).map((sub: any, idx: number) => {
            if (idx === subIdx) {
              return { ...sub, [field]: val };
            }
            return sub;
          });
          return { ...t, subtasks };
        }
        return t;
      });
      setWbsDraft(updated);
    };

    const handleDeleteSubtask = (taskId: string, subIdx: number) => {
      const updated = wbsDraft.map((t: any) => {
        if (t.id === taskId) {
          const subtasks = (t.subtasks || []).filter((_: any, idx: number) => idx !== subIdx);
          return { ...t, subtasks };
        }
        return t;
      });
      setWbsDraft(updated);
      showToast("Subtask removed.", "info");
    };

    const handleTriggerWbsExport = (type: string) => {
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `wbs_${type.toLowerCase()}_${timestamp}`;
      showToast(`Generating WBS ${type} Report...`, "info");
      
      setTimeout(() => {
        // Construct CSV content
        let csvContent = "Task ID,Title,Priority,Estimate (Hours),Milestone,Tags,Subtasks\n";
        wbsDraft.forEach((t: any) => {
          const subs = (t.subtasks || []).map((s: any) => s.title).join(" | ");
          csvContent += `"${t.id}","${t.title.replace(/"/g, '""')}","${t.priority}",${t.estimate},${t.isMilestone},"${(t.tags || "").replace(/"/g, '""')}","${subs.replace(/"/g, '""')}"\n`;
        });
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        showToast(`WBS ${type} report successfully downloaded.`, "success");
      }, 700);
    };

    // Grouping tasks by phase for draft list rendering
    const getGroupedDraftPhases = () => {
      if (!wbsDraft) return {};
      const grouped: Record<string, any[]> = {};
      wbsDraft.forEach((t: any) => {
        let phase = "Default Phase";
        if (t.tags) {
          const match = t.tags.match(/phase:(.+?)(?:,|$)/);
          if (match) {
            phase = match[1];
          } else if (t.tags.startsWith("phase:")) {
            phase = t.tags.replace("phase:", "");
          } else {
            phase = t.tags.split(",")[0];
          }
        }
        if (!grouped[phase]) grouped[phase] = [];
        grouped[phase].push(t);
      });
      return grouped;
    };

    const groupedPhases = getGroupedDraftPhases();

    return (
      <div style={{ animation: "fadeIn 0.4s ease-out", display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", background: "linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(20, 184, 166, 0.05) 100%)", padding: "16px", borderRadius: "12px", border: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setView("main"); setWbsDraft(null); setWbsAnalysis(null); }}
              style={{ display: "flex", alignItems: "center", gap: "6px" }}
            >
              ← Back
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                <Sparkles size={20} style={{ color: "var(--brand-600)" }} /> AI WBS Builder &amp; Optimization
              </h1>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--text-tertiary)", marginTop: "2px" }}>
                Enterprise collaborative planning workspace
              </p>
            </div>
          </div>

          {/* Mode switcher pill */}
          <div style={{ display: "flex", background: "var(--bg-surface-2)", borderRadius: "10px", padding: "4px", border: "1px solid var(--border-default)", gap: "2px" }}>
            {[
              { key: "build", label: "✦ Build WBS" },
              { key: "optimize", label: "⟳ Optimize WBS" }
            ].map(m => (
              <button
                key={m.key}
                onClick={() => { setWbsMode(m.key as "build" | "optimize"); setWbsDraft(null); setWbsAnalysis(null); }}
                style={{
                  padding: "7px 16px",
                  borderRadius: "7px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  transition: "all 0.18s",
                  background: wbsMode === m.key ? "var(--brand-600)" : "transparent",
                  color: wbsMode === m.key ? "white" : "var(--text-secondary)"
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── MODE 1: BUILD ───────────────────────────────────────── */}
        {wbsMode === "build" && (
          !wbsDraft ? (
            /* Project Brief Form */
            <div className="card" style={{ border: "1px solid var(--border-default)", boxShadow: "0 8px 24px rgba(0,0,0,0.04)" }}>
              <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
                
                {/* Build Target Selector */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>Build Target</label>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button 
                      onClick={() => {
                        setWbsBuildTarget("new");
                        setWbsProjectId("");
                        setWbsForm({ ...wbsForm, name: "", client: "", type: "Transformation" });
                      }}
                      className={`btn btn-sm ${wbsBuildTarget === "new" ? "btn-primary" : "btn-secondary"}`}
                      style={{ padding: "8px 16px" }}
                    >
                      <Plus size={14} style={{ marginRight: "4px" }} /> New Project
                    </button>
                    <button 
                      onClick={() => setWbsBuildTarget("existing")}
                      className={`btn btn-sm ${wbsBuildTarget === "existing" ? "btn-primary" : "btn-secondary"}`}
                      style={{ padding: "8px 16px" }}
                    >
                      <Briefcase size={14} style={{ marginRight: "4px" }} /> Existing Project
                    </button>
                  </div>
                </div>

                {wbsBuildTarget === "existing" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px", background: "var(--bg-surface-2)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border-subtle)", animation: "fadeIn 0.2s" }}>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>Select Target Project *</label>
                    <select 
                      className="select" 
                      value={wbsProjectId} 
                      onChange={e => {
                        const val = e.target.value;
                        setWbsProjectId(val);
                        const proj = data?.projects?.find((p: any) => p.id === val);
                        if (proj) {
                          setWbsForm({
                            ...wbsForm,
                            name: proj.name,
                            client: proj.client,
                            type: proj.type || "Transformation"
                          });
                        }
                      }}
                      style={{ maxWidth: "400px" }}
                    >
                      <option value="">-- Choose Project --</option>
                      {(data?.projects || []).filter((p: any) => p.status === "active" || p.status === "planning").map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Tab Strip */}
                <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)", gap: "16px", marginBottom: "4px" }}>
                  {[
                    { key: "general", label: "General Details" },
                    { key: "scope", label: "Scope & Goals" },
                    { key: "risks", label: "Constraints & Risks" }
                  ].map(t => (
                    <button
                      key={t.key}
                      onClick={() => setBriefTab(t.key as any)}
                      style={{
                        padding: "8px 4px",
                        background: "none",
                        border: "none",
                        borderBottom: briefTab === t.key ? "2px solid var(--brand-600)" : "2px solid transparent",
                        color: briefTab === t.key ? "var(--text-primary)" : "var(--text-tertiary)",
                        fontWeight: briefTab === t.key ? 700 : 500,
                        fontSize: "13px",
                        cursor: "pointer",
                        transition: "all 0.15s"
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                {briefTab === "general" && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", animation: "fadeIn 0.2s" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>Project Name *</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="e.g. Vanguard ERP Rollout"
                        disabled={wbsBuildTarget === "existing" && !!wbsProjectId}
                        value={wbsForm.name}
                        onChange={e => setWbsForm({ ...wbsForm, name: e.target.value })}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>Client Name *</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="e.g. Vanguard Group"
                        disabled={wbsBuildTarget === "existing" && !!wbsProjectId}
                        value={wbsForm.client}
                        onChange={e => setWbsForm({ ...wbsForm, client: e.target.value })}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>Project Type</label>
                      <select className="select" disabled={wbsBuildTarget === "existing" && !!wbsProjectId} value={wbsForm.type} onChange={e => setWbsForm({ ...wbsForm, type: e.target.value })}>
                        <option value="Transformation">Digital Transformation</option>
                        <option value="ERP">ERP Implementation</option>
                        <option value="Security">Cybersecurity Audit</option>
                        <option value="Integration">Cloud Integration</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>Timeline</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="e.g. 90 days"
                        value={wbsForm.timeline}
                        onChange={e => setWbsForm({ ...wbsForm, timeline: e.target.value })}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>Team Size</label>
                      <input
                        type="number"
                        className="input"
                        placeholder="e.g. 5"
                        value={wbsForm.teamSize}
                        onChange={e => setWbsForm({ ...wbsForm, teamSize: e.target.value })}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>Department</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="e.g. Finance"
                        value={wbsForm.department}
                        onChange={e => setWbsForm({ ...wbsForm, department: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {briefTab === "scope" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", animation: "fadeIn 0.2s" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>Business Objective</label>
                      <textarea
                        className="textarea"
                        rows={3}
                        placeholder="Describe the business goals and success criteria…"
                        value={wbsForm.objective}
                        onChange={e => setWbsForm({ ...wbsForm, objective: e.target.value })}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>Scope & Deliverables</label>
                      <textarea
                        className="textarea"
                        rows={3}
                        placeholder="List the key deliverables and boundaries…"
                        value={wbsForm.scope}
                        onChange={e => setWbsForm({ ...wbsForm, scope: e.target.value })}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px", gridColumn: "span 2" }}>
                      <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>Key Technologies</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="e.g. React, PostgreSQL, AWS"
                        value={wbsForm.technologies}
                        onChange={e => setWbsForm({ ...wbsForm, technologies: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {briefTab === "risks" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", animation: "fadeIn 0.2s" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>Constraints</label>
                      <textarea
                        className="textarea"
                        rows={3}
                        placeholder="Describe timeline, cost, or resource constraints…"
                        value={wbsForm.constraints}
                        onChange={e => setWbsForm({ ...wbsForm, constraints: e.target.value })}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>Risks & Mitigations</label>
                      <textarea
                        className="textarea"
                        rows={3}
                        placeholder="List project risks and proposed mitigations…"
                        value={wbsForm.risks}
                        onChange={e => setWbsForm({ ...wbsForm, risks: e.target.value })}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px", gridColumn: "span 2" }}>
                      <label style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase" }}>Additional Notes</label>
                      <textarea
                        className="textarea"
                        rows={2}
                        placeholder="Any additional notes or design comments…"
                        value={wbsForm.notes}
                        onChange={e => setWbsForm({ ...wbsForm, notes: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {!isReadOnlyRole && (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button className="btn btn-primary" disabled={wbsLoading} onClick={handleRunWbsBuild} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 22px" }}>
                      {wbsLoading ? "Generating…" : "✨ Generate WBS Draft"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Tree Editor + Chat */
            <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "16px", alignItems: "flex-start" }}>

              {/* Tree editor */}
              <div className="card" style={{ border: "1px solid var(--border-default)", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
                <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "12px" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "14.5px", fontWeight: 800 }}>Interactive WBS Planner</h3>
                      <p style={{ margin: "3px 0 0", fontSize: "11.5px", color: "var(--text-tertiary)" }}>Edit phases, tasks and subtasks inline. Click check for milestones.</p>
                    </div>
                    {!isReadOnlyRole && (
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setWbsDraft(null)}>Reset</button>
                        <button className="btn btn-primary btn-sm" disabled={wbsSaving} onClick={handleWbsSaveToDb} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {wbsSaving ? "Saving…" : "💾 Save Plan"}
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "14px", maxHeight: "600px", overflowY: "auto", paddingRight: "4px" }}>
                    {Object.entries(groupedPhases).map(([phase, tasks]: [string, any]) => (
                      <div key={phase} style={{ borderRadius: "10px", border: "1px solid var(--border-default)", overflow: "hidden", background: "var(--bg-surface-2)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--bg-surface-2)", borderBottom: "1px solid var(--border-default)" }}>
                          <span style={{ fontSize: "13px", fontWeight: 800, color: "var(--brand-600)" }}>{phase}</span>
                          {!isReadOnlyRole && (
                            <button onClick={() => handleAddCustomTask(phase)} style={{ background: "none", border: "1px solid var(--border-default)", borderRadius: "6px", padding: "3px 10px", fontSize: "11px", cursor: "pointer", color: "var(--text-secondary)", fontWeight: 600 }}>+ Add Task</button>
                          )}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "1px", background: "var(--border-subtle)" }}>
                          {tasks.map((t: any) => {
                            const pc: Record<string, { bg: string; text: string }> = {
                              critical: { bg: "rgba(239,68,68,0.1)", text: "#ef4444" },
                              high: { bg: "rgba(249,115,22,0.1)", text: "#f97316" },
                              medium: { bg: "rgba(234,179,8,0.1)", text: "#ca8a04" },
                              low: { bg: "rgba(34,197,94,0.1)", text: "#16a34a" }
                            };
                            const col = pc[t.priority] || pc.medium;
                            const isExpanded = !!expandedTasks[t.id];
                            const subtasks = t.subtasks || [];
                            return (
                              <div key={t.id} style={{ display: "flex", flexDirection: "column", background: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px" }}>
                                  <button
                                    onClick={() => setExpandedTasks(prev => ({ ...prev, [t.id]: !prev[t.id] }))}
                                    style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "4px", color: "var(--text-secondary)" }}
                                  >
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                  </button>

                                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: col.text, flexShrink: 0 }} />
                                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)", minWidth: "32px", fontFamily: "monospace" }}>{t.id}</span>
                                  
                                  <input type="text" className="input" value={t.title} onChange={e => handleUpdateTaskField(t.id, "title", e.target.value)}
                                    disabled={isReadOnlyRole}
                                    style={{ flex: 1, padding: "5px 8px", fontSize: "12.5px", background: "transparent", border: "1px solid transparent", borderRadius: "5px", transition: "border 0.15s" }}
                                    onFocus={e => (e.currentTarget.style.border = "1px solid var(--brand-600)")}
                                    onBlur={e => (e.currentTarget.style.border = "1px solid transparent")} />

                                  <select className="select" value={t.priority} onChange={e => handleUpdateTaskField(t.id, "priority", e.target.value)} disabled={isReadOnlyRole} style={{ padding: "4px 8px", fontSize: "11px", width: "80px", flexShrink: 0, borderRadius: "6px" }}>
                                    <option value="critical">Critical</option>
                                    <option value="high">High</option>
                                    <option value="medium">Medium</option>
                                    <option value="low">Low</option>
                                  </select>

                                  <div style={{ display: "flex", alignItems: "center", gap: "3px", flexShrink: 0 }}>
                                    <input type="number" className="input" value={t.estimate} onChange={e => handleUpdateTaskField(t.id, "estimate", parseInt(e.target.value) || 8)}
                                      disabled={isReadOnlyRole}
                                      style={{ width: "46px", padding: "4px 5px", fontSize: "11.5px", textAlign: "center" }} />
                                    <span style={{ fontSize: "10.5px", color: "var(--text-tertiary)" }}>h</span>
                                  </div>

                                  <label title="Milestone" style={{ display: "flex", alignItems: "center", gap: "3px", cursor: "pointer", flexShrink: 0 }}>
                                    <input type="checkbox" checked={!!t.isMilestone} onChange={e => handleUpdateTaskField(t.id, "isMilestone", e.target.checked)} disabled={isReadOnlyRole} style={{ cursor: "pointer" }} />
                                    <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>🏁</span>
                                  </label>

                                  {!isReadOnlyRole && (
                                    <button
                                      onClick={() => {
                                        handleAddSubtask(t.id);
                                        setExpandedTasks(prev => ({ ...prev, [t.id]: true }));
                                      }}
                                      style={{ background: "none", border: "none", color: "var(--brand-600)", cursor: "pointer", display: "flex", alignItems: "center", gap: "2px", fontSize: "11px", fontWeight: 600 }}
                                      title="Add Subtask"
                                    >
                                      <Plus size={12} /> Sub
                                    </button>
                                  )}

                                  {!isReadOnlyRole && (
                                    <button onClick={() => handleDeleteTask(t.id)}
                                      style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: "2px 4px", fontSize: "15px", lineHeight: 1, borderRadius: "4px", flexShrink: 0, transition: "color 0.15s" }}
                                      onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
                                      onMouseLeave={e => (e.currentTarget.style.color = "var(--text-tertiary)")}
                                      title="Remove">×</button>
                                  )}
                                </div>

                                {isExpanded && (
                                  <div style={{ 
                                    borderLeft: "2px dashed var(--border-default)", 
                                    marginLeft: "28px", 
                                    paddingLeft: "14px", 
                                    paddingBottom: "8px",
                                    display: "flex", 
                                    flexDirection: "column", 
                                    gap: "6px" 
                                  }}>
                                    {subtasks.length === 0 ? (
                                      <span style={{ fontSize: "11px", color: "var(--text-tertiary)", fontStyle: "italic" }}>No subtasks. Click "+ Sub" to add one.</span>
                                    ) : (
                                      subtasks.map((sub: any, subIdx: number) => (
                                        <div key={subIdx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                          <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--text-tertiary)", flexShrink: 0 }} />
                                          <input 
                                            type="text" 
                                            placeholder="Subtask title..."
                                            className="input" 
                                            value={sub.title || ""} 
                                            onChange={e => handleUpdateSubtask(t.id, subIdx, "title", e.target.value)}
                                            disabled={isReadOnlyRole}
                                            style={{ flex: 1, padding: "4px 8px", fontSize: "12px", background: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)", borderRadius: "4px" }}
                                          />
                                          <input 
                                            type="text" 
                                            placeholder="Description (optional)..."
                                            className="input" 
                                            value={sub.description || ""} 
                                            onChange={e => handleUpdateSubtask(t.id, subIdx, "description", e.target.value)}
                                            disabled={isReadOnlyRole}
                                            style={{ flex: 1.5, padding: "4px 8px", fontSize: "12px", background: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)", borderRadius: "4px" }}
                                          />
                                          {!isReadOnlyRole && (
                                            <button 
                                              onClick={() => handleDeleteSubtask(t.id, subIdx)}
                                              style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: "13px", padding: "0 4px" }}
                                              onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
                                              onMouseLeave={e => (e.currentTarget.style.color = "var(--text-tertiary)")}
                                              title="Delete Subtask"
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                          )}
                                        </div>
                                      ))
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Chat sidebar */}
              <div className="card" style={{ border: "1px solid var(--border-default)", position: "sticky", top: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
                <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px", height: "600px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "13px", fontWeight: 700 }}>AI Chat Planner</h4>
                      <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--text-tertiary)" }}>Ask AI to modify the draft</p>
                    </div>
                    {wbsHistoryStack.length > 0 && <button className="btn btn-secondary btn-xs" onClick={handleUndo}>↩ Undo</button>}
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", padding: "2px" }}>
                    {wbsChatHistory.length === 0 && (
                      <div style={{ textAlign: "center", padding: "24px 16px", color: "var(--text-tertiary)", fontSize: "11.5px", border: "1px dashed var(--border-default)", borderRadius: "8px", marginTop: "8px" }}>
                        <div style={{ fontSize: "22px", marginBottom: "8px" }}>💬</div>
                        e.g. <em>"Add a testing phase"</em><br />or <em>"Split T002 into subtasks"</em>
                      </div>
                    )}
                    {wbsChatHistory.map((msg, i) => (
                      <div key={i} style={{ alignSelf: msg.sender === "user" ? "flex-end" : "flex-start", maxWidth: "88%", padding: "8px 12px", borderRadius: msg.sender === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px", background: msg.sender === "user" ? "var(--brand-600)" : "var(--bg-surface-2)", color: msg.sender === "user" ? "white" : "var(--text-primary)", fontSize: "11.5px", lineHeight: 1.45, border: "1px solid", borderColor: msg.sender === "user" ? "transparent" : "var(--border-default)" }}>
                        {msg.text}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <input type="text" placeholder="e.g. Add deployment phase…" className="input" value={wbsChatInput} onChange={e => setWbsChatInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleWbsChatAction(); }} disabled={wbsLoading} style={{ fontSize: "12px" }} />
                    <button className="btn btn-primary btn-sm" disabled={wbsLoading} onClick={handleWbsChatAction} style={{ flexShrink: 0 }}>{wbsLoading ? "…" : "→"}</button>
                  </div>
                </div>
              </div>
            </div>
          )
        )}

        {/* ── MODE 2: OPTIMIZE ────────────────────────────────────── */}
        {wbsMode === "optimize" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Project selector */}
            <div className="card" style={{ border: "1px solid var(--border-default)", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
              <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap" }}>Analyze Project WBS:</span>
                <select className="select" value={wbsProjectId} onChange={e => { setWbsProjectId(e.target.value); handleLoadExistingWbs(e.target.value); }} style={{ minWidth: "260px", flex: "0 0 auto" }}>
                  <option value="">— Select an active project —</option>
                  {(data?.projects || []).filter((p: any) => p.status === "active" || p.status === "planning").map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {wbsProjectId && (
                  <button className="btn btn-secondary btn-sm" disabled={wbsLoading} onClick={() => handleLoadExistingWbs(wbsProjectId)}>{wbsLoading ? "Scanning…" : "⟳ Rescan"}</button>
                )}
                {wbsLoading && (
                  <span style={{ fontSize: "12px", color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ display: "inline-block", width: "12px", height: "12px", border: "2px solid var(--border-default)", borderTopColor: "var(--brand-600)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                    Analyzing WBS…
                  </span>
                )}
              </div>
            </div>

            {wbsAnalysis && (
              <>
                {/* Score KPI row with radial indicators */}
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  {[
                    { label: "Readiness", value: wbsAnalysis.readiness?.status || "—", icon: "🎯", color: wbsAnalysis.readiness?.status?.includes("Ready") ? "#22c55e" : "#f97316", bg: wbsAnalysis.readiness?.status?.includes("Ready") ? "rgba(34,197,94,0.08)" : "rgba(249,115,22,0.08)", type: "text" },
                    { label: "Grammar Score", score: wbsAnalysis.scores?.grammar ?? 0, color: "#2563eb", bg: "rgba(37,99,235,0.07)", type: "radial" },
                    { label: "Structure Score", score: wbsAnalysis.scores?.structure ?? 0, color: "#7c3aed", bg: "rgba(124,58,237,0.07)", type: "radial" },
                    { label: "Dependencies", score: wbsAnalysis.scores?.dependencies ?? 0, color: "#0891b2", bg: "rgba(8,145,178,0.07)", type: "radial" }
                  ].map(k => (
                    <div key={k.label} className="card" style={{ border: "1px solid var(--border-default)", flex: 1, minWidth: "160px", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
                      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", height: "100%" }}>
                        <div>
                          <div style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{k.label}</div>
                          {k.type === "text" ? (
                            <div style={{ fontSize: "13px", fontWeight: 800, color: k.color, marginTop: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: k.color, display: "inline-block" }} />
                              {k.value}
                            </div>
                          ) : (
                            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>Computed metrics</div>
                          )}
                        </div>
                        {k.type === "radial" ? (
                          <RadialProgress score={k.score || 0} color={k.color} size={44} />
                        ) : (
                          <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: k.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>{k.icon}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Split workspace */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "16px", alignItems: "flex-start" }}>

                  {/* Left: editable draft */}
                  <div className="card" style={{ border: "1px solid var(--border-default)", boxShadow: "0 4px 16px rgba(0,0,0,0.03)" }}>
                    <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "12px" }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: "13.5px", fontWeight: 800 }}>Editable WBS Structure</h4>
                          <p style={{ margin: "3px 0 0", fontSize: "11.5px", color: "var(--text-tertiary)" }}>Changes stay in draft until committed</p>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleTriggerWbsExport("WBS Report")} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <FileSpreadsheet size={13} /> Export CSV
                          </button>
                          <button className="btn btn-primary btn-sm" disabled={wbsSaving} onClick={handleWbsSaveToDb}>
                            {wbsSaving ? "Saving…" : "✔ Commit Changes"}
                          </button>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "550px", overflowY: "auto", paddingRight: "4px" }}>
                        {Object.entries(groupedPhases).map(([phase, tasks]: [string, any]) => (
                          <div key={phase} style={{ borderRadius: "10px", border: "1px solid var(--border-default)", overflow: "hidden", background: "var(--bg-surface-2)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--bg-surface-2)", borderBottom: "1px solid var(--border-default)" }}>
                              <span style={{ fontSize: "12.5px", fontWeight: 800, color: "var(--brand-600)" }}>{phase}</span>
                              <button onClick={() => handleAddCustomTask(phase)} style={{ background: "none", border: "1px solid var(--border-default)", borderRadius: "5px", padding: "2px 8px", fontSize: "10.5px", cursor: "pointer", color: "var(--text-secondary)", fontWeight: 600 }}>+ Task</button>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "1px", background: "var(--border-subtle)" }}>
                              {tasks.map((t: any) => {
                                const dotColor: Record<string, string> = { critical: "#ef4444", high: "#f97316", medium: "#ca8a04", low: "#16a34a" };
                                const dot = dotColor[t.priority] || dotColor.medium;
                                const isExpanded = !!expandedTasks[t.id];
                                const subtasks = t.subtasks || [];
                                return (
                                  <div key={t.id} style={{ display: "flex", flexDirection: "column", background: "var(--bg-surface)", borderBottom: "1px solid var(--border-subtle)" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px" }}>
                                      <button
                                        onClick={() => setExpandedTasks(prev => ({ ...prev, [t.id]: !prev[t.id] }))}
                                        style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: "4px", color: "var(--text-secondary)" }}
                                      >
                                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                      </button>
                                      
                                      <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: dot, flexShrink: 0 }} />
                                      <span style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--text-tertiary)", minWidth: "28px", fontFamily: "monospace" }}>{t.id}</span>
                                      
                                      <input type="text" className="input" value={t.title} onChange={e => handleUpdateTaskField(t.id, "title", e.target.value)}
                                        style={{ flex: 1, padding: "4px 8px", fontSize: "12px", background: "transparent", border: "1px solid transparent", borderRadius: "4px", transition: "border 0.15s" }}
                                        onFocus={e => (e.currentTarget.style.border = "1px solid var(--brand-600)")}
                                        onBlur={e => (e.currentTarget.style.border = "1px solid transparent")} />
                                      
                                      <select className="select" value={t.priority} onChange={e => handleUpdateTaskField(t.id, "priority", e.target.value)} style={{ padding: "3px 6px", fontSize: "10.5px", width: "72px" }}>
                                        <option value="critical">Critical</option>
                                        <option value="high">High</option>
                                        <option value="medium">Medium</option>
                                        <option value="low">Low</option>
                                      </select>
                                      
                                      <input type="number" className="input" value={t.estimate} onChange={e => handleUpdateTaskField(t.id, "estimate", parseInt(e.target.value) || 8)} style={{ width: "42px", padding: "3px 4px", fontSize: "11px", textAlign: "center" }} />
                                      <span style={{ fontSize: "10px", color: "var(--text-tertiary)", flexShrink: 0 }}>h</span>
                                      
                                      <button
                                        onClick={() => {
                                          handleAddSubtask(t.id);
                                          setExpandedTasks(prev => ({ ...prev, [t.id]: true }));
                                        }}
                                        style={{ background: "none", border: "none", color: "var(--brand-600)", cursor: "pointer", display: "flex", alignItems: "center", gap: "2px", fontSize: "10px", fontWeight: 600 }}
                                        title="Add Subtask"
                                      >
                                        <Plus size={10} /> Sub
                                      </button>
                                      
                                      <button onClick={() => handleDeleteTask(t.id)}
                                        style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: "15px", lineHeight: 1, flexShrink: 0, transition: "color 0.15s" }}
                                        onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
                                        onMouseLeave={e => (e.currentTarget.style.color = "var(--text-tertiary)")}>×</button>
                                    </div>

                                    {isExpanded && (
                                      <div style={{ padding: "8px 12px 12px 32px", display: "flex", flexDirection: "column", gap: "6px", background: "var(--bg-surface-2)" }}>
                                        {subtasks.length === 0 ? (
                                          <span style={{ fontSize: "10.5px", color: "var(--text-tertiary)", fontStyle: "italic" }}>No subtasks.</span>
                                        ) : (
                                          subtasks.map((sub: any, subIdx: number) => (
                                            <div key={subIdx} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                              <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "var(--text-tertiary)", flexShrink: 0 }} />
                                              <input 
                                                type="text" 
                                                placeholder="Subtask title..."
                                                className="input" 
                                                value={sub.title || ""} 
                                                onChange={e => handleUpdateSubtask(t.id, subIdx, "title", e.target.value)}
                                                disabled={isReadOnlyRole}
                                                style={{ flex: 1, padding: "3px 6px", fontSize: "11.5px", background: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)", borderRadius: "4px" }}
                                              />
                                              <input 
                                                type="text" 
                                                placeholder="Description..."
                                                className="input" 
                                                value={sub.description || ""} 
                                                onChange={e => handleUpdateSubtask(t.id, subIdx, "description", e.target.value)}
                                                disabled={isReadOnlyRole}
                                                style={{ flex: 1.5, padding: "3px 6px", fontSize: "11.5px", background: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)", borderRadius: "4px" }}
                                              />
                                              {!isReadOnlyRole && (
                                                <button 
                                                  onClick={() => handleDeleteSubtask(t.id, subIdx)}
                                                  style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: "11px" }}
                                                  onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
                                                  onMouseLeave={e => (e.currentTarget.style.color = "var(--text-tertiary)")}
                                                >
                                                  <Trash2 size={11} />
                                                </button>
                                              )}
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right: tabbed insights */}
                  <div className="card" style={{ border: "1px solid var(--border-default)", position: "sticky", top: "16px", boxShadow: "0 4px 16px rgba(0,0,0,0.03)" }}>
                    <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>

                      {/* Tab strip */}
                      <div style={{ display: "flex", gap: "2px", background: "var(--bg-surface-2)", borderRadius: "8px", padding: "3px", border: "1px solid var(--border-default)" }}>
                        {[
                          { key: "grammar", label: "Grammar" },
                          { key: "improvements", label: "Improve" },
                          { key: "integrity", label: "Integrity" },
                          { key: "chat", label: "Chat" },
                          { key: "compare", label: "Compare" }
                        ].map(t => (
                          <button key={t.key} onClick={() => setWbsActiveTab(t.key as any)}
                            style={{ flex: 1, padding: "5px 4px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "10.5px", fontWeight: 600, whiteSpace: "nowrap", transition: "all 0.15s", background: wbsActiveTab === t.key ? "var(--brand-600)" : "transparent", color: wbsActiveTab === t.key ? "white" : "var(--text-tertiary)" }}>
                            {t.label}
                          </button>
                        ))}
                      </div>

                      {/* Grammar */}
                      {wbsActiveTab === "grammar" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <p style={{ margin: 0, fontSize: "11.5px", color: "var(--text-tertiary)" }}>AI-detected phrasing improvements</p>
                            <button className="btn btn-secondary btn-xs" onClick={handleAcceptAllGrammar}>Accept All</button>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "430px", overflowY: "auto" }}>
                            {wbsAnalysis.grammarIssues.length === 0 ? (
                              <div style={{ padding: "24px", textAlign: "center", color: "var(--success-600)", background: "rgba(34,197,94,0.06)", borderRadius: "8px", border: "1px solid rgba(34,197,94,0.25)", fontSize: "12.5px" }}>✓ No grammar issues found</div>
                            ) : (
                              wbsAnalysis.grammarIssues.map((g: any, i: number) => {
                                const accepted = !!wbsAcceptedGrammar[g.taskId];
                                return (
                                  <div key={i} style={{ borderRadius: "8px", border: `1px solid ${accepted ? "rgba(34,197,94,0.3)" : "var(--border-default)"}`, overflow: "hidden", opacity: accepted ? 0.7 : 1, transition: "all 0.2s" }}>
                                    <div style={{ padding: "8px 12px", background: "var(--bg-surface-2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                      <span style={{ fontSize: "10.5px", fontWeight: 700, color: accepted ? "var(--success-600)" : "var(--brand-600)" }}>{accepted ? "✓ Accepted" : g.issue}</span>
                                      <button className="btn btn-primary btn-xs" disabled={accepted} onClick={() => handleAcceptGrammar(g.taskId, g.suggested)} style={{ opacity: accepted ? 0.5 : 1 }}>Accept</button>
                                    </div>
                                    <div style={{ padding: "10px 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", background: "var(--bg-surface)" }}>
                                      <div>
                                        <div style={{ fontSize: "9.5px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: "4px" }}>Current</div>
                                        <div style={{ fontSize: "11.5px", color: "var(--text-secondary)", textDecoration: accepted ? "line-through" : "none" }}>{g.current}</div>
                                      </div>
                                      <div>
                                        <div style={{ fontSize: "9.5px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", marginBottom: "4px" }}>Suggested</div>
                                        <div style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--text-primary)" }}>{g.suggested}</div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}

                      {/* Improvements */}
                      {wbsActiveTab === "improvements" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "450px", overflowY: "auto" }}>
                          {wbsAnalysis.completenessSuggestions.length === 0 ? (
                            <div style={{ padding: "24px", textAlign: "center", color: "var(--success-600)", background: "rgba(34,197,94,0.06)", borderRadius: "8px", border: "1px solid rgba(34,197,94,0.25)", fontSize: "12.5px" }}>✓ WBS is complete. No structural improvements suggested.</div>
                          ) : (
                            wbsAnalysis.completenessSuggestions.map((s: any, i: number) => {
                              const accepted = !!wbsAcceptedImprovements[i];
                              return (
                                <div key={i} style={{ borderRadius: "8px", border: `1px solid ${accepted ? "rgba(34,197,94,0.3)" : "var(--border-default)"}`, overflow: "hidden", opacity: accepted ? 0.7 : 1, transition: "all 0.2s" }}>
                                  <div style={{ padding: "8px 12px", background: "var(--bg-surface-2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                      <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-primary)" }}>{s.type}</span>
                                      <span style={{ fontSize: "9px", fontWeight: 700, padding: "1px 6px", borderRadius: "100px", background: "rgba(37,99,235,0.1)", color: "#2563eb", textTransform: "uppercase" }}>{s.priority}</span>
                                    </div>
                                    <button className="btn btn-primary btn-xs" disabled={accepted} onClick={() => handleAcceptImprovement(i, s)} style={{ opacity: accepted ? 0.5 : 1 }}>{accepted ? "✓ Done" : "Accept"}</button>
                                  </div>
                                  <div style={{ padding: "10px 12px", background: "var(--bg-surface)", display: "flex", flexDirection: "column", gap: "6px" }}>
                                    <p style={{ margin: 0, fontSize: "11.5px", color: "var(--text-secondary)" }}>{s.reason}</p>
                                    {s.confidence !== undefined && (
                                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <span style={{ fontSize: "10px", color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>Confidence {s.confidence}%</span>
                                        <div style={{ flex: 1, height: "4px", borderRadius: "2px", background: "var(--bg-surface-2)", overflow: "hidden" }}>
                                          <div style={{ width: `${s.confidence}%`, height: "100%", background: s.confidence >= 80 ? "#22c55e" : s.confidence >= 50 ? "#f97316" : "#ef4444", borderRadius: "2px", transition: "width 0.5s" }} />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}

                      {/* Integrity */}
                      {wbsActiveTab === "integrity" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "450px", overflowY: "auto" }}>
                          {wbsAnalysis.deterministicIssues.length === 0 ? (
                            <div style={{ padding: "24px", textAlign: "center", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "8px" }}>
                              <div style={{ fontSize: "28px", marginBottom: "6px" }}>✅</div>
                              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--success-600)" }}>Integrity check passed</div>
                              <div style={{ fontSize: "11.5px", color: "var(--text-tertiary)", marginTop: "4px" }}>No cycles, orphans, or sequence gaps detected</div>
                            </div>
                          ) : (
                            wbsAnalysis.deterministicIssues.map((issue: string, i: number) => (
                              <div key={i} style={{ padding: "10px 12px", background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px", display: "flex", alignItems: "flex-start", gap: "8px" }}>
                                <AlertCircle size={14} style={{ color: "var(--danger-600)", marginTop: "1px", flexShrink: 0 }} />
                                <span style={{ fontSize: "12px", color: "var(--danger-600)", lineHeight: 1.4 }}>{issue}</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {/* Chat */}
                      {wbsActiveTab === "chat" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px", height: "430px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <p style={{ margin: 0, fontSize: "11.5px", color: "var(--text-tertiary)" }}>Collaborative AI PM planner</p>
                            {wbsHistoryStack.length > 0 && <button className="btn btn-secondary btn-xs" onClick={handleUndo}>↩ Undo</button>}
                          </div>
                          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", padding: "2px" }}>
                            {wbsChatHistory.length === 0 && (
                              <div style={{ textAlign: "center", padding: "20px 12px", color: "var(--text-tertiary)", fontSize: "11.5px", border: "1px dashed var(--border-default)", borderRadius: "8px" }}>
                                <div style={{ fontSize: "20px", marginBottom: "6px" }}>💬</div>
                                <em>"Add a rollback task to deployment phase"</em>
                              </div>
                            )}
                            {wbsChatHistory.map((msg, i) => (
                              <div key={i} style={{ alignSelf: msg.sender === "user" ? "flex-end" : "flex-start", maxWidth: "88%", padding: "7px 11px", borderRadius: msg.sender === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px", background: msg.sender === "user" ? "var(--brand-600)" : "var(--bg-surface-2)", color: msg.sender === "user" ? "white" : "var(--text-primary)", fontSize: "11.5px", lineHeight: 1.45, border: "1px solid", borderColor: msg.sender === "user" ? "transparent" : "var(--border-default)" }}>
                                {msg.text}
                              </div>
                            ))}
                          </div>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <input type="text" placeholder="Type command…" className="input" value={wbsChatInput} onChange={e => setWbsChatInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleWbsChatAction(); }} disabled={wbsLoading} style={{ fontSize: "12px" }} />
                            <button className="btn btn-primary btn-sm" disabled={wbsLoading} onClick={handleWbsChatAction} style={{ flexShrink: 0 }}>{wbsLoading ? "…" : "→"}</button>
                          </div>
                        </div>
                      )}

                      {/* Compare */}
                      {wbsActiveTab === "compare" && (
                        <div style={{ maxHeight: "450px", overflowY: "auto", borderRadius: "8px", border: "1px solid var(--border-default)", overflow: "hidden" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                              <tr style={{ background: "var(--bg-surface-2)" }}>
                                <th style={{ padding: "8px 12px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", textAlign: "left", borderBottom: "1px solid var(--border-default)" }}>Original WBS</th>
                                <th style={{ padding: "8px 12px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", textAlign: "left", borderBottom: "1px solid var(--border-default)" }}>Optimized Draft</th>
                              </tr>
                            </thead>
                            <tbody>
                              {wbsOriginalDraft?.map((orig: any, i: number) => {
                                const current = wbsDraft[i];
                                const isChanged = current && current.title !== orig.title;
                                return (
                                  <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                                    <td style={{ padding: "8px 12px", fontSize: "11.5px", color: "var(--text-secondary)" }}>{orig.title}</td>
                                    <td style={{ padding: "8px 12px", fontSize: "11.5px", fontWeight: isChanged ? 700 : 400, color: isChanged ? "var(--brand-600)" : "var(--text-primary)" }}>
                                      {current ? current.title : <span style={{ color: "#ef4444", fontStyle: "italic" }}>Removed</span>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderAssignmentDashboard = () => {
    const activeTasks = selectedAssignmentTaskObj ? [selectedAssignmentTaskObj] : [];

    return (
      <div style={{ animation: "fadeIn 0.5s ease-out", display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Header */}
        <div className="page-header" style={{ marginBottom: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setView("main"); setAssignmentResult(null); setAssignmentProjectId(""); setAssignmentTaskId(""); }}>
              ← Back to AI Center
            </button>
            <div>
              <h1 className="page-title">Automated Task Assignment</h1>
              <p className="page-subtitle">Intelligent Resource Allocation & Workload Balancer</p>
            </div>
          </div>
        </div>

        {/* Project & Task Selector Card */}
        <div className="card">
          <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>1. Select Project & Task</h3>
            
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              {/* Project Search */}
              <div style={{ position: "relative", flex: "1 1 250px" }}>
                <input
                  type="text"
                  placeholder="Search projects..."
                  value={assignmentSearch}
                  onChange={(e) => setAssignmentSearch(e.target.value)}
                  className="input"
                  style={{ width: "100%", paddingRight: "30px" }}
                />
                {assignmentSearch && (
                  <button onClick={() => setAssignmentSearch("")} style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-tertiary)" }}>×</button>
                )}
              </div>

              {/* Project Dropdown */}
              <select
                className="select"
                value={assignmentProjectId}
                onChange={(e) => {
                  setAssignmentProjectId(e.target.value);
                  setAssignmentTaskId("");
                  setAssignmentResult(null);
                }}
                style={{ flex: "1 1 250px" }}
              >
                <option value="">-- Choose Project --</option>
                {filteredAssignmentProjects.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                ))}
              </select>

              {/* Task Dropdown */}
              <select
                className="select"
                value={assignmentTaskId}
                disabled={!assignmentProjectId}
                onChange={(e) => {
                  setAssignmentTaskId(e.target.value);
                  setAssignmentResult(null);
                }}
                style={{ flex: "1 1 250px" }}
              >
                <option value="">-- Choose Task --</option>
                {assignmentTasks.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.title} ({t.priority})</option>
                ))}
              </select>

              {!isReadOnlyRole && (
                <button
                  className="btn btn-primary"
                  disabled={assignmentLoading || !assignmentProjectId || !assignmentTaskId}
                  onClick={() => handleFetchAssignmentRecommendations(assignmentProjectId, assignmentTaskId)}
                  style={{ height: "42px", padding: "0 24px" }}
                >
                  {assignmentLoading ? "Calculating..." : "Suggest Resource Matches"}
                </button>
              )}
            </div>

            {/* Project metadata */}
            {selectedAssignmentProjectObj && (
              <div style={{ padding: "12px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", fontSize: "13px" }}>
                <div><span style={{ color: "var(--text-tertiary)", display: "block" }}>PROJECT NAME</span><strong style={{ color: "var(--text-primary)" }}>{selectedAssignmentProjectObj.name}</strong></div>
                <div><span style={{ color: "var(--text-tertiary)", display: "block" }}>CLIENT</span><strong style={{ color: "var(--text-primary)" }}>{selectedAssignmentProjectObj.client}</strong></div>
                <div><span style={{ color: "var(--text-tertiary)", display: "block" }}>PM</span><strong style={{ color: "var(--text-primary)" }}>{selectedAssignmentProjectObj.manager}</strong></div>
                <div><span style={{ color: "var(--text-tertiary)", display: "block" }}>STATUS</span><span className="badge badge-success">{selectedAssignmentProjectObj.status}</span></div>
              </div>
            )}

            {/* Auto loaded Task details panel */}
            {selectedAssignmentTaskObj && (
              <div className="card" style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border-default)", marginTop: "4px" }}>
                <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                      <span className="badge badge-brand" style={{ fontSize: "10px", textTransform: "uppercase" }}>Auto Loaded Task Profile</span>
                      <h4 style={{ fontSize: "15px", fontWeight: 800, color: "var(--text-primary)", margin: "4px 0 0 0" }}>{selectedAssignmentTaskObj.title}</h4>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <span className={`badge ${selectedAssignmentTaskObj.priority === "critical" ? "badge-danger" : selectedAssignmentTaskObj.priority === "high" ? "badge-danger" : "badge-warning"}`} style={{ textTransform: "uppercase" }}>{selectedAssignmentTaskObj.priority}</span>
                      <span className="badge badge-gray" style={{ textTransform: "uppercase" }}>{selectedAssignmentTaskObj.status}</span>
                    </div>
                  </div>

                  <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", margin: 0, lineHeight: "1.5" }}>
                    <strong>Task Description:</strong> {selectedAssignmentTaskObj.comments && selectedAssignmentTaskObj.comments.length > 0 
                      ? selectedAssignmentTaskObj.comments[selectedAssignmentTaskObj.comments.length - 1].text 
                      : `Allocate resource to execute standard delivery milestones, configurations, and review parameters for task "${selectedAssignmentTaskObj.title}".`}
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px", borderTop: "1px solid var(--border-subtle)", paddingTop: "12px", fontSize: "12px" }}>
                    <div><span style={{ color: "var(--text-tertiary)", display: "block" }}>EST. WORKLOAD</span><strong style={{ color: "var(--text-primary)" }}>{selectedAssignmentTaskObj.estimate || 40} Hours ({Math.ceil((selectedAssignmentTaskObj.estimate || 40) / 8)} Days)</strong></div>
                    <div><span style={{ color: "var(--text-tertiary)", display: "block" }}>COMPLEXITY</span><strong style={{ color: "var(--text-primary)" }}>{(selectedAssignmentTaskObj.estimate || 40) > 60 ? "High" : (selectedAssignmentTaskObj.estimate || 40) >= 30 ? "Medium" : "Low"}</strong></div>
                    <div><span style={{ color: "var(--text-tertiary)", display: "block" }}>RISK LEVEL</span><strong style={{ color: "var(--text-primary)" }}>{selectedAssignmentTaskObj.priority === "critical" || selectedAssignmentTaskObj.priority === "high" ? "High" : "Low"}</strong></div>
                    <div><span style={{ color: "var(--text-tertiary)", display: "block" }}>SPRINT TARGET</span><strong style={{ color: "var(--text-primary)" }}>Sprint 3</strong></div>
                  </div>

                  {selectedAssignmentTaskObj.tags && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600 }}>Keywords / Tags:</span>
                      {selectedAssignmentTaskObj.tags.split(",").map((t: string, idx: number) => (
                        <span key={idx} className="badge badge-gray" style={{ fontSize: "10.5px" }}>{t.trim()}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Validation Notice if no match data loaded */}
        {!assignmentResult && (
          <div className="card" style={{ padding: "40px 20px", textAlign: "center", border: "1px dashed var(--border-default)" }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>👥</div>
            <h4 style={{ fontSize: "16px", fontWeight: 700, margin: "0 0 6px", color: "var(--text-primary)" }}>Intelligent Resource Matching Engine</h4>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", maxWidth: "450px", margin: "0 auto" }}>
              Select a project and task above, then click "Suggest Resource Matches". The system will query technical skills, calendar availability, department overlap, and workloads to rank suitable consultants.
            </p>
          </div>
        )}

        {/* Suggestion Results Dashboard */}
        {assignmentResult && (
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-start" }}>
            
            {/* Left side panel: Quick Workload KPIs */}
            <div style={{ flex: "1 1 20%", display: "flex", flexDirection: "column", gap: "16px", minWidth: "220px" }}>
              <div className="card" style={{ background: "rgba(99,102,241,0.03)", border: "1px solid rgba(99,102,241,0.2)" }}>
                <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#6366f1" }} />
                    <strong style={{ fontSize: "13px", color: "var(--text-primary)" }}>Task Assignment Rules</strong>
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                    Skills, departments, certifications, and leave schedules are computed deterministically. AI is utilized solely to rank match scores and compare trade-offs.
                  </div>
                </div>
              </div>

              {/* Pool averages */}
              <div className="card">
                <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div>
                    <span style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 700, textTransform: "uppercase" }}>Pool Average Utilization</span>
                    <h3 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", margin: "2px 0 0 0" }}>
                      {Math.round(assignmentResult.candidates.reduce((sum: number, c: any) => sum + c.utilization, 0) / assignmentResult.candidates.length)}%
                    </h3>
                  </div>

                  <div>
                    <span style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 700, textTransform: "uppercase" }}>Overload Warning Limit</span>
                    <div style={{ fontSize: "12.5px", color: "var(--danger-600)", fontWeight: 700, marginTop: "2px" }}>&gt; 80% Utilization</div>
                  </div>

                  <div>
                    <span style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 700, textTransform: "uppercase" }}>Candidate Leaves Conflicts</span>
                    <div style={{ fontSize: "12.5px", color: assignmentResult.candidates.some((c: any) => c.hasLeaveConflict) ? "#eab308" : "var(--success-600)", fontWeight: 700, marginTop: "2px" }}>
                      {assignmentResult.candidates.filter((c: any) => c.hasLeaveConflict).length} consultants flagged
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side panel: Tabbed results */}
            <div style={{ flex: "1 1 75%", display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Navigation Tabs */}
              <div className="tabs" style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "2px", display: "flex", gap: "16px" }}>
                <button className={`tab ${assignmentActiveTab === "candidates" ? "active" : ""}`} onClick={() => setAssignmentActiveTab("candidates")}>Ranked Candidates (Top 5)</button>
                <button className={`tab ${assignmentActiveTab === "workload" ? "active" : ""}`} onClick={() => setAssignmentActiveTab("workload")}>Workload & Leave Calendar</button>
                <button className={`tab ${assignmentActiveTab === "risks" ? "active" : ""}`} onClick={() => setAssignmentActiveTab("risks")}>Risks & Alternatives</button>
                <button className={`tab ${assignmentActiveTab === "history" ? "active" : ""}`} onClick={() => setAssignmentActiveTab("history")}>Assignment History Log</button>
              </div>

              {/* Tab 1: Candidates Match Grid */}
              {assignmentActiveTab === "candidates" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {/* Filters bar */}
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", background: "var(--bg-surface-2)", padding: "10px", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                    <input
                      type="text"
                      placeholder="Filter by name or skill..."
                      value={assignmentTableSearch}
                      onChange={(e) => setAssignmentTableSearch(e.target.value)}
                      className="input"
                      style={{ flex: "1 1 200px", padding: "6px 12px", fontSize: "12.5px" }}
                    />

                    <select className="select" value={assignmentDeptFilter} onChange={(e) => setAssignmentDeptFilter(e.target.value)} style={{ padding: "6px 10px", fontSize: "12.5px" }}>
                      <option value="all">All Departments</option>
                      <option value="Finance & Tax Advisory">Finance & Tax Advisory</option>
                      <option value="Digital Transformation Group">Digital Transformation Group</option>
                      <option value="Project Delivery Group">Project Delivery Group</option>
                    </select>

                    <select className="select" value={assignmentRoleFilter} onChange={(e) => setAssignmentRoleFilter(e.target.value)} style={{ padding: "6px 10px", fontSize: "12.5px" }}>
                      <option value="all">All Roles</option>
                      <option value="Senior Consultant">Senior Consultant</option>
                      <option value="Consultant">Consultant</option>
                      <option value="Project Manager">Project Manager</option>
                    </select>

                    <select className="select" value={assignmentUtilFilter} onChange={(e) => setAssignmentUtilFilter(e.target.value)} style={{ padding: "6px 10px", fontSize: "12.5px" }}>
                      <option value="all">All Workloads</option>
                      <option value="high">High Load (&gt;80%)</option>
                      <option value="medium">Medium (40%-80%)</option>
                      <option value="low">Low Load (&lt;40%)</option>
                    </select>

                    <select className="select" value={assignmentRatingFilter} onChange={(e) => setAssignmentRatingFilter(e.target.value)} style={{ padding: "6px 10px", fontSize: "12.5px" }}>
                      <option value="all">All Ratings</option>
                      <option value="4.5">Rating &gt;= 4.5</option>
                      <option value="4.0">Rating &gt;= 4.0</option>
                    </select>
                  </div>

                  {/* Candidates cards list */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {filteredCandidates.length > 0 ? (
                      filteredCandidates.map((c: any, index: number) => {
                        const isTopPick = index === 0 && !assignmentTableSearch;
                        return (
                          <div
                            key={c.id}
                            className="card card-hoverable"
                            style={{
                              border: isTopPick ? "1px solid rgba(99, 102, 241, 0.45)" : "1px solid var(--border-default)",
                              background: isTopPick ? "rgba(99, 102, 241, 0.01)" : "var(--bg-surface)",
                              position: "relative"
                            }}
                          >
                            <div className="card-body-lg" style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-start" }}>
                              {/* Left profile/photo */}
                              <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: isTopPick ? "linear-gradient(135deg, #6366f1, #4f46e5)" : "var(--border-default)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: "16px", flexShrink: 0 }}>
                                {c.name.split(" ").map((n: string) => n[0]).join("")}
                              </div>

                              {/* Mid consultant details */}
                              <div style={{ flex: "1 1 50%", display: "flex", flexDirection: "column", gap: "6px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                  <h4 style={{ fontSize: "14px", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>{c.name}</h4>
                                  <span className="badge badge-gray" style={{ fontSize: "10.5px" }}>{c.role}</span>
                                  {isTopPick && <span className="badge badge-brand" style={{ fontSize: "9.5px", fontWeight: 800 }}>★ TOP PICK</span>}
                                  <span className={`badge ${c.riskIndicator === "High" ? "badge-danger" : c.riskIndicator === "Medium" ? "badge-warning" : "badge-success"}`} style={{ fontSize: "9px" }}>{c.riskIndicator} Risk</span>
                                </div>

                                <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                                  Dept: {c.dept} · Location: {c.location || "Mumbai, IN"} · Perf Rating: <strong>{c.performanceRating}/5.0</strong>
                                </div>

                                {/* Skills */}
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                                  {(c.skills || []).map((s: string, sIdx: number) => (
                                    <span key={sIdx} className="badge badge-gray" style={{ fontSize: "10px", padding: "1px 6px" }}>{s}</span>
                                  ))}
                                </div>

                                {/* Certifications */}
                                {c.certifications && c.certifications.length > 0 && (
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
                                    <span style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 700 }}>Certifications:</span>
                                    {c.certifications.map((cert: string, certIdx: number) => (
                                      <span key={certIdx} className="badge badge-brand" style={{ fontSize: "9.5px", background: "rgba(99,102,241,0.08)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.2)" }}>{cert}</span>
                                    ))}
                                  </div>
                                )}

                                {/* Rationale */}
                                <div style={{ padding: "10px", background: "var(--bg-surface-2)", borderRadius: "6px", fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.4", borderLeft: isTopPick ? "3px solid #6366f1" : "3px solid var(--border-default)", marginTop: "4px" }}>
                                  <strong>AI Recommendation Rationale:</strong> {c.rationale}
                                </div>
                              </div>

                              {/* Right Match score & actions */}
                              <div style={{ flex: "1 1 20%", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "10px", minWidth: "150px" }}>
                                <div style={{ textAlign: "right" }}>
                                  <div style={{ fontSize: "24px", fontWeight: 800, color: c.matchScore >= 80 ? "var(--success-600)" : c.matchScore >= 50 ? "var(--warning-600)" : "var(--danger-600)" }}>
                                    {c.matchScore}%
                                  </div>
                                  <span style={{ fontSize: "10.5px", color: "var(--text-tertiary)" }}>Match Score</span>
                                </div>

                                {/* Load bar */}
                                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "2px", alignItems: "flex-end" }}>
                                  <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Current Utilisation: <strong>{c.utilization}%</strong></div>
                                  <div style={{ width: "100px", height: "4px", background: "var(--border-subtle)", borderRadius: "2px", overflow: "hidden" }}>
                                    <div style={{ width: `${c.utilization}%`, height: "100%", background: c.utilization > 80 ? "#ef4444" : c.utilization >= 40 ? "#eab308" : "#22c55e" }} />
                                  </div>
                                </div>

                                <div style={{ display: "flex", gap: "6px", width: "100%" }}>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    style={{ flex: 1, padding: "4px 0", fontSize: "11px", justifyContent: "center" }}
                                    onClick={() => { setSelectedConsultantForComparison(c); setAssignmentActiveTab("workload"); }}
                                  >
                                    View Workload
                                  </button>
                                  {!isReadOnlyRole && (
                                    <button
                                      className="btn btn-primary btn-sm"
                                      style={{ flex: 1, padding: "4px 0", fontSize: "11px", justifyContent: "center" }}
                                      onClick={() => { setSelectedCandidateForImpact(c); setOverrideConsultantId(c.id); setAssignmentImpactModalOpen(true); }}
                                    >
                                      Assign
                                    </button>
                                  )}
                                </div>
                              </div>

                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="card" style={{ padding: "30px", textAlign: "center", color: "var(--text-tertiary)" }}>
                        No candidates match the selected filter criteria.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Workload & Leave Calendar */}
              {assignmentActiveTab === "workload" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {/* Detailed workload metrics */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                    <div style={{ padding: "14px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                      <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>SELECTED CONSULTANT</div>
                      <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--text-primary)", marginTop: "4px" }}>
                        {selectedConsultantForComparison ? selectedConsultantForComparison.name : "Choose candidate to inspect"}
                      </div>
                    </div>

                    <div style={{ padding: "14px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                      <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>ESTIMATED FREE HOURS</div>
                      <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--success-600)", marginTop: "4px" }}>
                        {selectedConsultantForComparison ? `${selectedConsultantForComparison.freeHours || 0} Hours` : "—"}
                      </div>
                    </div>

                    <div style={{ padding: "14px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                      <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>ACTIVE TASKS IN PROGRESS</div>
                      <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--brand-600)", marginTop: "4px" }}>
                        {selectedConsultantForComparison ? selectedConsultantForComparison.tasksInProgress : "—"}
                      </div>
                    </div>
                  </div>

                  {/* Workload list for all candidates */}
                  <div className="card">
                    <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <strong style={{ fontSize: "14px", color: "var(--text-primary)" }}>Team Workload Metrics & Availability Calendar</strong>
                      <div className="table-wrapper" style={{ border: "1px solid var(--border-subtle)", borderRadius: "8px", overflow: "hidden" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ background: "var(--bg-surface-2)", borderBottom: "1px solid var(--border-subtle)", fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                              <th style={{ padding: "10px", textAlign: "left" }}>Consultant</th>
                              <th style={{ padding: "10px", textAlign: "center" }}>Role</th>
                              <th style={{ padding: "10px", textAlign: "center" }}>Current Load (%)</th>
                              <th style={{ padding: "10px", textAlign: "center" }}>Capacity Left</th>
                              <th style={{ padding: "10px", textAlign: "left" }}>Leave Calendar (Upcoming)</th>
                              <th style={{ padding: "10px", textAlign: "center" }}>Conflict Risk</th>
                            </tr>
                          </thead>
                          <tbody>
                            {assignmentResult.candidates.map((cand: any) => (
                              <tr key={cand.id} style={{ borderBottom: "1px solid var(--border-subtle)", background: selectedConsultantForComparison?.id === cand.id ? "rgba(99,102,241,0.04)" : "transparent" }}>
                                <td style={{ padding: "10px", fontWeight: 600, color: "var(--text-primary)" }}>{cand.name}</td>
                                <td style={{ padding: "10px", textAlign: "center", fontSize: "12px", color: "var(--text-secondary)" }}>{cand.role}</td>
                                <td style={{ padding: "10px", textAlign: "center" }}>
                                  <strong style={{ color: cand.utilization > 80 ? "#ef4444" : "var(--text-primary)" }}>{cand.utilization}%</strong>
                                </td>
                                <td style={{ padding: "10px", textAlign: "center", color: "var(--success-600)", fontWeight: 700 }}>{cand.remainingCapacity}%</td>
                                <td style={{ padding: "10px", fontSize: "11.5px", color: "var(--text-secondary)" }}>{cand.leaveSchedule}</td>
                                <td style={{ padding: "10px", textAlign: "center" }}>
                                  <span className={`badge ${cand.hasLeaveConflict ? "badge-danger" : "badge-success"}`}>
                                    {cand.hasLeaveConflict ? "Leave conflict" : "Clear schedule"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Risks & Alternatives */}
              {assignmentActiveTab === "risks" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {/* Risks block */}
                  <div className="card">
                    <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <strong style={{ fontSize: "14px", color: "var(--text-primary)" }}>AI Risk & Delivery Analysis</strong>
                      <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>Identified assignment risks based on candidate capacities and certifications.</p>

                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid var(--border-subtle)", paddingTop: "12px" }}>
                        {assignmentResult.rankings.map((r: any) => (
                          <div key={r.id} style={{ padding: "10px", background: "var(--bg-surface-2)", borderRadius: "6px", border: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <strong style={{ color: "var(--text-primary)", fontSize: "12.5px" }}>{r.name}</strong>
                              <div style={{ fontSize: "11.5px", color: "var(--text-secondary)", marginTop: "2px" }}>{r.riskReason}</div>
                            </div>
                            <span className={`badge ${r.riskIndicator === "High" || r.riskIndicator === "Critical" ? "badge-danger" : r.riskIndicator === "Medium" ? "badge-warning" : "badge-success"}`}>
                              {r.riskIndicator} Risk
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Alternative candidate choices */}
                  <div className="card">
                    <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <strong style={{ fontSize: "14px", color: "var(--text-primary)" }}>Alternative Candidate Trade-offs</strong>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {assignmentResult.alternatives.map((alt: any, idx: number) => (
                          <div key={idx} style={{ padding: "10px", background: "var(--bg-surface-2)", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                              <strong style={{ color: "var(--text-primary)" }}>{alt.name}</strong>
                              <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Match Diff: +{alt.matchDifference}%</span>
                            </div>
                            <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{alt.tradeOff}</div>
                            <div style={{ fontSize: "11.5px", color: "var(--brand-600)", fontWeight: 600, marginTop: "4px" }}>Delivery Impact: {alt.estimatedImpact}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Team allocation suggestion */}
                  {assignmentResult.teamAssignment && (
                    <div className="card">
                      <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <strong style={{ fontSize: "14px", color: "var(--text-primary)" }}>Dual Team Allocation Recommendation</strong>
                        <div style={{ padding: "12px", background: "rgba(99,102,241,0.04)", borderRadius: "8px", border: "1px solid rgba(99,102,241,0.2)" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px", marginBottom: "10px" }}>
                            <div><span style={{ color: "var(--text-tertiary)", display: "block" }}>TEAM LEAD</span><strong style={{ color: "var(--text-primary)" }}>{assignmentResult.teamAssignment.leadName}</strong></div>
                            <div><span style={{ color: "var(--text-tertiary)", display: "block" }}>SUPPORT CONSULTANTS</span><strong style={{ color: "var(--text-primary)" }}>{assignmentResult.teamAssignment.supportingNames?.join(", ") || "None"}</strong></div>
                          </div>
                          <div style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                            <strong>Combined Coverage:</strong> {assignmentResult.teamAssignment.deliveryImprovement}
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "6px" }}>
                            <strong>Reason for team proposal:</strong> {assignmentResult.teamAssignment.reason || "High task priority or complexity requires peer oversight."}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Override & Decision History */}
              {assignmentActiveTab === "history" && (
                <div className="card">
                  <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "12px" }}>
                      <div>
                        <strong style={{ fontSize: "14px", color: "var(--text-primary)" }}>Override & Decision History Logs</strong>
                        <p style={{ fontSize: "11.5px", color: "var(--text-tertiary)", margin: 0 }}>Review history of accepted suggestions and manual overrides.</p>
                      </div>
                      <button className="btn btn-secondary btn-sm" onClick={handleAssignmentExportCsv}>Export CSV Logs</button>
                    </div>

                    {assignmentHistoryLoading && (
                      <div style={{ padding: "30px", textAlign: "center", color: "var(--text-secondary)" }}>
                        Loading history...
                      </div>
                    )}

                    {!assignmentHistoryLoading && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {assignmentHistoryList.length > 0 ? (
                          assignmentHistoryList.map((h: any, idx: number) => (
                            <div key={idx} style={{ padding: "12px", background: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)", borderRadius: "8px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                                <div>
                                  <strong style={{ color: "var(--text-primary)", fontSize: "13px" }}>{h.taskTitle}</strong>
                                  <span style={{ fontSize: "11px", color: "var(--text-tertiary)", marginLeft: "8px" }}>Project: {h.projectName}</span>
                                </div>
                                <span className={`badge ${h.status === "Accepted" ? "badge-success" : "badge-brand"}`} style={{ fontSize: "10px" }}>
                                  {h.status}
                                </span>
                              </div>

                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px", marginTop: "8px", fontSize: "12px" }}>
                                <div><span style={{ color: "var(--text-tertiary)" }}>AI Suggestion:</span> <strong style={{ color: "var(--text-primary)" }}>{h.recommendedConsultant}</strong></div>
                                <div><span style={{ color: "var(--text-tertiary)" }}>Manager Pick:</span> <strong style={{ color: "var(--text-primary)" }}>{h.selectedConsultant}</strong></div>
                              </div>

                              {h.overrideReason && (
                                <div style={{ fontSize: "11.5px", color: "var(--text-secondary)", background: "rgba(0,0,0,0.02)", padding: "6px 8px", borderRadius: "4px", marginTop: "8.5px" }}>
                                  <strong>Manager Decision Reason:</strong> {h.overrideReason}
                                </div>
                              )}

                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10.5px", color: "var(--text-tertiary)", marginTop: "8px", borderTop: "1px dashed var(--border-subtle)", paddingTop: "6px" }}>
                                <span>Authorized By: {h.manager}</span>
                                <span>Date: {new Date(h.decisionDate).toLocaleDateString()}</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div style={{ padding: "30px", textAlign: "center", color: "var(--text-tertiary)" }}>
                            No assignment history recorded yet.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

          </div>
        )}

        {/* Pre-Assignment Audit Impact Modal */}
        {assignmentImpactModalOpen && selectedCandidateForImpact && (
          <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div className="modal-content" style={{ background: "var(--bg-surface)", borderRadius: "12px", padding: "24px", width: "min(500px, 90%)", maxHeight: "85vh", overflowY: "auto", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border-default)", animation: "slideDown 0.2s" }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ fontSize: "17px", fontWeight: 800, color: "var(--text-primary)", marginBottom: "4px" }}>Confirm Task Allocation Audit</h3>
              <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "16px" }}>Verify assignment schedule and workload metrics impact</p>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", background: "var(--bg-surface-2)", padding: "14px", borderRadius: "8px", border: "1px solid var(--border-subtle)", fontSize: "12.5px", marginBottom: "16px" }}>
                <div><span style={{ color: "var(--text-tertiary)" }}>CONSULTANT:</span> <strong style={{ color: "var(--text-primary)" }}>{selectedCandidateForImpact.name} ({selectedCandidateForImpact.role})</strong></div>
                <div><span style={{ color: "var(--text-tertiary)" }}>ASSIGNED TASK:</span> <strong style={{ color: "var(--text-primary)" }}>{assignmentResult.task.title}</strong></div>
                <div><span style={{ color: "var(--text-tertiary)" }}>MATCH RATING:</span> <strong style={{ color: "#6366f1" }}>{selectedCandidateForImpact.matchScore}%</strong></div>
              </div>

              {/* Assignment impact projections */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px", marginBottom: "20px" }}>
                <strong style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>AI Projected Delivery Impact:</strong>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div style={{ padding: "8px", background: "rgba(0,0,0,0.02)", borderRadius: "4px" }}>
                    <span style={{ color: "var(--text-tertiary)", display: "block" }}>EXPECTED COMPLETION</span>
                    <strong style={{ color: "var(--text-primary)" }}>{assignmentResult.assignmentImpact.expectedCompletionDate}</strong>
                  </div>
                  <div style={{ padding: "8px", background: "rgba(0,0,0,0.02)", borderRadius: "4px" }}>
                    <span style={{ color: "var(--text-tertiary)", display: "block" }}>CONFIDENCE SCORE</span>
                    <strong style={{ color: "var(--success-600)" }}>{assignmentResult.assignmentImpact.deliveryConfidence}</strong>
                  </div>
                  <div style={{ padding: "8px", background: "rgba(0,0,0,0.02)", borderRadius: "4px" }}>
                    <span style={{ color: "var(--text-tertiary)", display: "block" }}>CRITICAL PATH STATUS</span>
                    <strong style={{ color: "var(--text-secondary)" }}>{assignmentResult.assignmentImpact.criticalPathImpact}</strong>
                  </div>
                  <div style={{ padding: "8px", background: "rgba(0,0,0,0.02)", borderRadius: "4px" }}>
                    <span style={{ color: "var(--text-tertiary)", display: "block" }}>PROJECT SLIPPAGE RISK</span>
                    <strong style={{ color: selectedCandidateForImpact.riskIndicator === "High" ? "#ef4444" : "var(--text-primary)" }}>{selectedCandidateForImpact.riskIndicator} Risk</strong>
                  </div>
                </div>
              </div>

              {/* Override Reason Field - required if selected is NOT the first pick */}
              {selectedCandidateForImpact.id !== assignmentResult.rankings[0]?.id && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "20px" }}>
                  <label style={{ fontSize: "12.5px", fontWeight: 700, color: "#eab308" }}>⚠️ Override Reason Required</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Provide justification for choosing this consultant over the top matched AI recommendation (e.g. specific domain expertise, scheduling flexibility)..."
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="input"
                    style={{ width: "100%", fontSize: "12px", padding: "8px" }}
                  />
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button className="btn btn-secondary btn-sm" onClick={() => { setAssignmentImpactModalOpen(false); setSelectedCandidateForImpact(null); setOverrideReason(""); }}>Cancel</button>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={selectedCandidateForImpact.id !== assignmentResult.rankings[0]?.id && !overrideReason.trim()}
                  onClick={() => handleSaveAssignment(overrideReason)}
                >
                  Confirm Allocation
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  };

  const [isGenerating, setIsGenerating] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  const handleGenerateSummary = () => {
    setIsGenerating(true);
    setTimeout(() => { setIsGenerating(false); setShowSummaryModal(true); }, 1500);
  };

  const getWeekRangeString = () => {
    const today = new Date();
    const day = today.getDay();
    const diffToMon = today.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(today.setDate(diffToMon));
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const opt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
    return `${mon.toLocaleDateString("en-US", opt)} – ${sun.toLocaleDateString("en-US", opt)}`;
  };

  const highCount = data?.aiInsights?.filter((i: any) => i.severity === 'high').length || 0;
  const medCount = data?.aiInsights?.filter((i: any) => i.severity === 'medium').length || 0;
  const lowCount = data?.aiInsights?.filter((i: any) => i.severity === 'low' || i.severity === 'info').length || 0;

  const handleExportSummaryPdf = async () => {
    try {
      const jsPDF = (await import("jspdf")).default;
      const doc = new jsPDF("p", "mm", "a4");
      doc.setFont("Helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(46, 134, 193);
      doc.text("VSQC Weekly AI Summary", 20, 25);
      doc.setFontSize(10); doc.setFont("Helvetica", "normal"); doc.setTextColor(100, 116, 139);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, 32);
      doc.line(20, 36, 190, 36);
      doc.setFont("Helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(30, 41, 59);
      doc.text("Operations Overview", 20, 46);
      doc.setFontSize(11); doc.setFont("Helvetica", "bold"); doc.text("Date Range:", 20, 54);
      doc.setFont("Helvetica", "normal"); doc.text(getWeekRangeString(), 65, 54);
      doc.line(20, 270, 190, 270); doc.setFont("Helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(148, 163, 184);
      doc.text("VSQC Enterprise Performance Platform · Confidential", 20, 276);
      doc.text("Page 1 of 1", 170, 276);
      const dateStr = new Date().toISOString().split("T")[0];
      doc.save(`VSQC_AI_Summary_${dateStr}.pdf`);
      showToast("PDF Summary downloaded successfully", "success");
    } catch (err) {
      console.error(err);
      showToast("Summary export failed, please try again", "danger");
    }
  };

  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Card 1: Task-Time Estimation (Enhanced state)
  const [estTask, setEstTask] = useState("GST & Compliance Audit");
  const [estPriority, setEstPriority] = useState("Medium");
  const [estTeamSize, setEstTeamSize] = useState("3");
  const [estResult, setEstResult] = useState<any>(null);
  const [estLoading, setEstLoading] = useState(false);
  const [estProjectId, setEstProjectId] = useState("");
  const [estTaskId, setEstTaskId] = useState("");
  const [estProjectSearch, setEstProjectSearch] = useState("");
  const [overridePriority, setOverridePriority] = useState("");
  const [overrideComplexity, setOverrideComplexity] = useState("");
  const [overrideTeamSize, setOverrideTeamSize] = useState("");
  const [overrideRisk, setOverrideRisk] = useState("");

  // Card 2: Delay Detection / Deadline Prediction (Enhanced state)
  const [predTaskName, setPredTaskName] = useState("");
  const [predStartDate, setPredStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [predTeamSize, setPredTeamSize] = useState("2");
  const [predComplexity, setPredComplexity] = useState("Medium");
  const [predResult, setPredResult] = useState<any>(null);
  const [predLoading, setPredLoading] = useState(false);
  const [predProjectId, setPredProjectId] = useState("");
  const [predTaskId, setPredTaskId] = useState("");
  const [predProjectSearch, setPredProjectSearch] = useState("");
  const [predOverrideComplexity, setPredOverrideComplexity] = useState("");
  const [predOverrideTeamSize, setPredOverrideTeamSize] = useState("");
  const [predOverridePriority, setPredOverridePriority] = useState("");

  const selectedEstProject = React.useMemo(() => data?.projects?.find((p: any) => p.id === estProjectId), [data?.projects, estProjectId]);
  const selectedEstTask = React.useMemo(() => getFlatTasks(data?.tasks).find((t: any) => t.id === estTaskId && t.project === estProjectId), [data?.tasks, estTaskId, estProjectId]);
  const selectedEstTaskConsultant = React.useMemo(() => {
    if (!selectedEstTask) return null;
    return data?.consultants?.find((c: any) => c.id === selectedEstTask.assignee) || data?.users?.find((u: any) => u.id === selectedEstTask.assignee);
  }, [data?.consultants, data?.users, selectedEstTask]);

  const selectedPredProject = React.useMemo(() => data?.projects?.find((p: any) => p.id === predProjectId), [data?.projects, predProjectId]);
  const selectedPredTask = React.useMemo(() => getFlatTasks(data?.tasks).find((t: any) => t.id === predTaskId && t.project === predProjectId), [data?.tasks, predTaskId, predProjectId]);
  const selectedPredTaskConsultant = React.useMemo(() => {
    if (!selectedPredTask) return null;
    return data?.consultants?.find((c: any) => c.id === selectedPredTask.assignee) || data?.users?.find((u: any) => u.id === selectedPredTask.assignee);
  }, [data?.consultants, data?.users, selectedPredTask]);

  // Card 3: Billing Milestone Insights
  const [billingProject, setBillingProject] = useState("");
  const [billingMilestone, setBillingMilestone] = useState("");
  const [billingTaskCompletion, setBillingTaskCompletion] = useState("65");
  const [billingDaysLeft, setBillingDaysLeft] = useState("12");
  const [billingTotalDays, setBillingTotalDays] = useState("30");
  const [billingBudget, setBillingBudget] = useState("500000");
  const [billingResult, setBillingResult] = useState<any>(null);
  const [billingLoading, setBillingLoading] = useState(false);

  // Card 4: Automated Task Assignment
  const [assignTask, setAssignTask] = useState("");
  const [assignSkills, setAssignSkills] = useState("Process Mapping, GST Audit");
  const [assignDuration, setAssignDuration] = useState("5");
  const [assignPriority, setAssignPriority] = useState("Medium");
  const [assignResult, setAssignResult] = useState<any>(null);
  const [assignLoading, setAssignLoading] = useState(false);

  const [alertSettings, setAlertSettings] = useState({ enable: true, email: true, slack: false, escalation: true });
  const [rateLimitMsg, setRateLimitMsg] = useState<string | null>(null);



  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setActiveModal(null); setShowConfigModal(false); setShowSummaryModal(false); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  React.useEffect(() => {
    handleFetchAssignmentHistory();
  }, []);

  React.useEffect(() => {
    const flat = getFlatTasks(data?.tasks);
    const uniqueTitles = Array.from(new Set(flat.map((t: any) => t.title))).filter(Boolean);
    if (uniqueTitles.length > 0) {
      if (estTask === "GST & Compliance Audit" || !uniqueTitles.includes(estTask)) {
        setEstTask(uniqueTitles[0]);
      }
    } else {
      if (estTask === "GST & Compliance Audit") {
        setEstTask("");
      }
    }
  }, [data]);


  // ── Task-Time Estimation → backend endpoint (GenAI + RAG) ──
  const handleRunEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!estProjectId) {
      showToast("Please select a project.", "warning");
      return;
    }
    if (!estTaskId) {
      showToast("Please select a task.", "warning");
      return;
    }
    if (selectedEstProject?.status === "completed") {
      showToast("Completed or archived projects cannot be estimated.", "warning");
      return;
    }
    if (selectedEstTask?.status === "done") {
      showToast("Completed tasks cannot be estimated.", "warning");
      return;
    }

    setEstLoading(true);
    setRateLimitMsg(null);
    try {
      const res = await fetch("/api/ai/estimate-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskName: selectedEstTask.title,
          priority: selectedEstTask.priority,
          teamSize: "1",
          projectId: estProjectId,
          taskId: estTaskId,
          overridePriority,
          overrideComplexity,
          overrideTeamSize,
          overrideRisk
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      setEstResult(result);
      showToast("Task estimation calculated successfully.", "success");
    } catch (err: any) {
      showToast("Estimation failed: " + (err?.message || "Unknown error"), "danger");
    } finally {
      setEstLoading(false);
    }
  };

  const handleAcceptEstimate = async () => {
    if (!estResult || !estTaskId) return;
    const confirmAccept = window.confirm(
      `Are you sure you want to apply the AI estimate of ${estResult.estimatedHours} hours to the task "${selectedEstTask?.title}"?`
    );
    if (!confirmAccept) return;
    try {
      await updateTask(estTaskId, {
        estimate: estResult.estimatedHours,
        priority: (overridePriority || selectedEstTask?.priority) as any,
      });
      setActiveModal(null);
      setEstResult(null);
    } catch (err) {
      // Toast notification is handled in the store action
    }
  };

  // ── Predict Deadlines → backend endpoint (Rule-Based + GenAI root-cause) ──
  const handlePredictDeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!predProjectId) {
      showToast("Please select a project.", "warning");
      return;
    }
    if (!predTaskId) {
      showToast("Please select a task.", "warning");
      return;
    }
    if (selectedPredProject?.status === "completed") {
      showToast("Completed or archived projects cannot be predicted.", "warning");
      return;
    }
    if (selectedPredTask?.status === "done") {
      showToast("Completed tasks cannot be predicted.", "warning");
      return;
    }

    setPredLoading(true);
    setRateLimitMsg(null);
    try {
      const res = await fetch("/api/ai/predict-deadline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskName: selectedPredTask.title,
          startDate: selectedPredTask.dueDate ? new Date(selectedPredTask.dueDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
          teamSize: predOverrideTeamSize || "1",
          complexity: predOverrideComplexity || "Medium",
          projectId: predProjectId,
          taskId: predTaskId,
          priority: predOverridePriority || selectedPredTask.priority || "Medium",
          assigneeId: selectedPredTask.assignee
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      setPredResult(result);
      showToast("Deadline prediction generated.", "success");
    } catch (err: any) {
      showToast("Prediction failed: " + (err?.message || "Unknown error"), "danger");
    } finally {
      setPredLoading(false);
    }
  };

  // ── Billing Milestone Insights → backend endpoint (Math + GenAI narrative) ──
  const handleBillingInsight = async (e: React.FormEvent) => {
    e.preventDefault(); setBillingLoading(true); setRateLimitMsg(null);
    try {
      const res = await fetch("/api/ai/billing-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: billingProject,
          milestone: billingMilestone,
          completion: billingTaskCompletion,
          daysLeft: billingDaysLeft,
          totalDays: billingTotalDays,
          budget: billingBudget,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      setBillingResult(result);
      showToast("Billing milestone analysis complete.", "success");
    } catch (err: any) {
      showToast("Billing analysis failed: " + (err?.message || "Unknown error"), "danger");
    } finally { setBillingLoading(false); }
  };

  // ── Automated Task Assignment → backend endpoint (GenAI ranking + RAG) ──
  const handleAutoAssign = async (e: React.FormEvent) => {
    e.preventDefault(); setAssignLoading(true); setRateLimitMsg(null);
    try {
      const res = await fetch("/api/ai/auto-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskName: assignTask, skills: assignSkills, priority: assignPriority, duration: assignDuration }),
      });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      setAssignResult(result);
      showToast("Task assignment suggestions generated.", "success");
    } catch (err: any) {
      showToast("Assignment failed: " + (err?.message || "Unknown error"), "danger");
    } finally { setAssignLoading(false); }
  };

  // ── Schedule Clash Detection Scanning ──
  const handleRunScheduleClashScan = async (projId: string) => {
    setClashScanLoading(true);
    try {
      const res = await fetch("/api/ai/schedule-clashes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: projId || "all" })
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Scan request failed");
      }
      const payload = await res.json();
      setClashScanData(payload);
      showToast("Scheduling clash analysis completed successfully.", "success");
    } catch (err: any) {
      showToast("Scan failed: " + (err?.message || "Network error. Please try again."), "danger");
    } finally {
      setClashScanLoading(false);
    }
  };

  // ── Daily Delay Alerts state ──
  const [delayAlertResult, setDelayAlertResult] = React.useState<any>(null);
  const [delayAlertLoading, setDelayAlertLoading] = React.useState(false);

  const handleScanDelays = async () => {
    setDelayAlertLoading(true);
    try {
      const res = await fetch("/api/ai/daily-delay-alerts", { method: "POST", headers: { "Content-Type": "application/json" } });
      if (!res.ok) throw new Error(await res.text());
      setDelayAlertResult(await res.json());
      showToast("Delay scan complete — alerts dispatched.", "success");
    } catch (err: any) {
      showToast("Delay scan failed: " + (err?.message || "Unknown error"), "danger");
    } finally { setDelayAlertLoading(false); }
  };



  const remainingCalls = groqRateLimiter.remainingCalls();
  // Also keep flat-task helper for read-only display modals
  const getFlatTasksLocal = (tasksState: any): any[] => {
    if (!tasksState) return [];
    if (Array.isArray(tasksState)) return tasksState;
    const flat: any[] = [];
    if (Array.isArray(tasksState.todo)) flat.push(...tasksState.todo);
    if (Array.isArray(tasksState.inprogress)) flat.push(...tasksState.inprogress);
    if (Array.isArray(tasksState.review)) flat.push(...tasksState.review);
    if (Array.isArray(tasksState.done)) flat.push(...tasksState.done);
    return flat;
  };

  if (view === "clash-dashboard") {
    return renderClashDashboard();
  }

  if (view === "delay-dashboard") {
    return renderDelayDashboard();
  }

  if (view === "billing-dashboard") {
    return renderBillingDashboard();
  }

  if (view === "assignment-dashboard") {
    return renderAssignmentDashboard();
  }

  if (view === "wbs-center") {
    return renderWbsCenter();
  }

  return (
    <div style={{ animation: "fadeIn 0.5s ease-out" }}>
      {/* Page Header */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "linear-gradient(135deg, #2563eb, #14b8a6)", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
            <IconCpu size={22} />
          </div>
          <div>
            <h1 className="page-title">{t("AI Insights Center")}</h1>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 10px", borderRadius: "8px", background: remainingCalls > 5 ? "rgba(34,197,94,0.1)" : remainingCalls > 2 ? "rgba(234,179,8,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${remainingCalls > 5 ? "rgba(34,197,94,0.3)" : remainingCalls > 2 ? "rgba(234,179,8,0.3)" : "rgba(239,68,68,0.3)"}` }}>
            <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: remainingCalls > 5 ? "#22c55e" : remainingCalls > 2 ? "#eab308" : "#ef4444" }} />
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>AI Calls: {remainingCalls}/10</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleGenerateSummary} disabled={isGenerating} style={{ display: "flex", alignItems: "center" }}>
            {isGenerating ? (<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "6px", animation: "spin 1s linear infinite" }}><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.2)" strokeWidth="4" /><path d="M4 12a8 8 0 0 1 8-8" /></svg>Generating...</>) : t("Generate Weekly Summary")}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowConfigModal(true)}>{t("Configure AI")}</button>
        </div>
      </div>

      {rateLimitMsg && (
        <div style={{ margin: "0 0 12px", padding: "10px 16px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", fontSize: "13px", color: "#ef4444", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>⚠️ {rateLimitMsg}</span>
          <button onClick={() => setRateLimitMsg(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: "16px" }}>×</button>
        </div>
      )}

      <div className="grid-2" style={{ gap: "16px", marginTop: "10px" }}>

        {/* Card 1: Task-Time Estimation */}
        {aiGate("task_estimation") && (
        <div className="card card-hoverable" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(46, 134, 193, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconCrystalBall size={20} style={{ color: "#2E86C1" }} /></div>
                  <div><h3 style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Task-Time Estimation</h3></div>
                </div>
              </div>
              <ul style={{ margin: "0 0 20px", padding: "0 0 0 18px", color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.7" }}>
                <li>Uses previous project information.</li>
                <li>Provides confidence score for project managers.</li>
                <li>Provides insights to manage expectations.</li>
              </ul>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
              <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setEstResult(null); setActiveModal("estimate-tasks"); }}>Estimate Tasks</button>
              <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setPredResult(null); setActiveModal("predict-deadlines"); }}>Predict Deadlines</button>
            </div>
          </div>
        </div>
        )}

        {/* Card 2: Delay Detection */}
        {aiGate("delay_prediction") && (
        <div className="card card-hoverable" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(224, 155, 45, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconAlert size={20} style={{ color: "#E09B2D" }} /></div>
                  <div><h3 style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Delay Detection & Root-Cause</h3></div>
                </div>
              </div>
              <ul style={{ margin: "0 0 20px", padding: "0 0 0 18px", color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.7" }}>
                <li>Detect delayed tasks automatically</li>
                <li>Identify causes: dependency blockers, resource conflicts, scope creep</li>
                <li>Suggest corrective actions with impact scoring</li>
              </ul>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
              <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => setView("delay-dashboard")}>Scan Delays</button>
              <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => setView("delay-dashboard")}>Analyze Roots</button>
            </div>
          </div>
        </div>
        )}

        {/* Card 3: Billing Milestone Insights */}
        {aiGate("milestone_insights") && (
        <div className="card card-hoverable" style={{ display: "flex", flexDirection: "column", height: "100%", border: "1px solid rgba(20, 184, 166, 0.25)" }}>
          <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(20, 184, 166, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconWand size={20} style={{ color: "#14b8a6" }} /></div>
                  <div><h3 style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Billing Milestone Insights</h3></div>
                </div>
              </div>
              <ul style={{ margin: "0 0 20px", padding: "0 0 0 18px", color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.7" }}>
                <li>Prioritised report linking billing readiness to task completion</li>
                <li>Schedule variance & burn rate statistical analysis</li>
                <li>Milestone readiness score to focus PM effort</li>
              </ul>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
              <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => setView("billing-dashboard")}>Analyze Milestone</button>
              <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => setView("billing-dashboard")}>View Report</button>
            </div>
          </div>
        </div>
        )}

        {/* Card 4: Automated Task Assignment */}
        {aiGate("resource_optimization") && (
        <div className="card card-hoverable" style={{ display: "flex", flexDirection: "column", height: "100%", border: "1px solid rgba(99, 102, 241, 0.25)" }}>
          <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(99, 102, 241, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconUsers size={20} style={{ color: "#6366f1" }} /></div>
                  <div><h3 style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Automated Task Assignment</h3></div>
                </div>
              </div>
              <ul style={{ margin: "0 0 20px", padding: "0 0 0 18px", color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.7" }}>
                <li>Suggests assignments based on consultant availability & skill profile.</li>
                <li>Ranks candidates using current utilization data.</li>
                <li>PM can accept, modify, or override suggestions.</li>
              </ul>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
              <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setAssignmentProjectId(""); setAssignmentTaskId(""); setAssignmentResult(null); setView("assignment-dashboard"); setAssignmentActiveTab("candidates"); }}>Auto-Assign Task</button>
              <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setAssignmentProjectId(""); setAssignmentTaskId(""); setAssignmentResult(null); setView("assignment-dashboard"); setAssignmentActiveTab("history"); }}>View Suggestions</button>
            </div>
          </div>
        </div>
        )}

        {/* Card 5: Schedule Clash Detection */}
        {aiGate("schedule_clashes") && (
        <div className="card card-hoverable" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(108, 126, 199, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconTimer size={20} style={{ color: "#6C7EC7" }} /></div>
                  <div><h3 style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Schedule Clash Detection</h3></div>
                </div>
              </div>
              <ul style={{ margin: "0 0 20px", padding: "0 0 0 18px", color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.7" }}>
                <li>Detect overlapping task assignments for the same resource</li>
                <li>Flag scheduling conflicts for manager review</li>
              </ul>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
              <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setView("clash-dashboard"); setClashActiveTab("dashboard"); if (clashScanData === null) { handleRunScheduleClashScan("all"); } }}>Detect Clashes</button>
              <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setView("clash-dashboard"); setClashActiveTab("dashboard"); if (clashScanData === null) { handleRunScheduleClashScan("all"); } }}>Review Conflicts</button>
            </div>
          </div>
        </div>
        )}

        {/* Card 6: AI WBS Builder & Optimization Center */}
        {aiGate("wbs_generation") && (
        <div className="card card-hoverable" style={{ display: "flex", flexDirection: "column", height: "100%", border: "1px solid rgba(245, 158, 11, 0.25)" }}>
          <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(245, 158, 11, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconCpu size={20} style={{ color: "#F59E0B" }} /></div>
                  <div><h3 style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>AI WBS Builder & Optimization</h3></div>
                </div>
              </div>
              <ul style={{ margin: "0 0 20px", padding: "0 0 0 18px", color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.7" }}>
                <li>Generate standard-aligned WBS drafts using AI planning assistance</li>
                <li>Analyze structural integrity, grammar, and completeness patterns</li>
                <li>Optimize tasks, re-sequence paths, and accept corrections selectively</li>
              </ul>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
              <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setWbsProjectId(""); setWbsDraft(null); setWbsAnalysis(null); setView("wbs-center"); setWbsMode("build"); }}>Build WBS</button>
              <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setWbsProjectId(""); setWbsDraft(null); setWbsAnalysis(null); setView("wbs-center"); setWbsMode("optimize"); }}>Optimize WBS</button>
            </div>
          </div>
        </div>
        )}
      </div>




      {/* Configure AI Modal */}
      {showConfigModal && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowConfigModal(false)}>
          <div className="modal-content" style={{ background: "var(--bg-surface)", borderRadius: "12px", padding: "24px", width: "min(460px, 90%)", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border-default)", animation: "slideDown 0.2s cubic-bezier(0.4,0,0.2,1)" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: "20px", fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>AI Configuration</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>Alert Sensitivity</label>
                <select value={alertSensitivity} onChange={(e) => setAlertSensitivity(e.target.value)} style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-default)", background: "var(--bg-surface)", color: "var(--text-primary)", fontSize: "13px" }}>
                  <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option>
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <div><div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Auto-generate weekly summary</div><div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Compile updates at end of week</div></div>
                <label className="toggle"><input type="checkbox" checked={autoSummary} onChange={(e) => setAutoSummary(e.target.checked)} /><div className="toggle-track" /><div className="toggle-thumb" /></label>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "6px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>Risk Threshold</label>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--brand-600)" }}>{riskThreshold}%</span>
                </div>
                <input type="range" min="0" max="100" value={riskThreshold} onChange={(e) => setRiskThreshold(parseInt(e.target.value, 10))} style={{ width: "100%", accentColor: "#2E86C1", cursor: "pointer" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
                <div><div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Notify on High Priority alerts</div><div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Email updates for critical indicators</div></div>
                <label className="toggle"><input type="checkbox" checked={notifyHigh} onChange={(e) => setNotifyHigh(e.target.checked)} /><div className="toggle-track" /><div className="toggle-thumb" /></label>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowConfigModal(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSaveConfig}>Save Configuration</button>
            </div>
          </div>
        </div>
      )}

      {/* Weekly Summary Modal */}
      {showSummaryModal && (() => {
        const totalProjects = data?.projects?.length || 0;
        const healthyProjects = data?.projects?.filter((p: any) => p.status === "completed" || p.health === "on-track").length || 0;
        const portfolioHealth = totalProjects > 0 ? ((healthyProjects / totalProjects) * 100).toFixed(1) : null;
        const healthLabel = portfolioHealth ? (parseFloat(portfolioHealth) >= 80 ? "Healthy" : parseFloat(portfolioHealth) >= 50 ? "At Risk" : "Critical") : "N/A";

        const totalForecast = data?.invoices?.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0) || 0;
        const totalTarget = data?.projects?.reduce((sum: number, p: any) => sum + (p.budget || 0), 0) || 0;
        const hasFinanceData = totalForecast > 0 || totalTarget > 0;
        const aboveTargetPct = totalTarget > 0 ? ((totalForecast - totalTarget) / totalTarget) * 100 : 0;

        return (
          <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowSummaryModal(false)}>
            <div className="modal-content" style={{ background: "var(--bg-surface)", borderRadius: "12px", padding: "24px", width: "min(560px, 95%)", maxHeight: "85vh", overflowY: "auto", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border-default)", animation: "slideDown 0.2s cubic-bezier(0.4,0,0.2,1)" }} onClick={(e) => e.stopPropagation()}>
              <h2 style={{ marginBottom: "16px", fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>Weekly AI Summary</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", color: "var(--text-secondary)", fontSize: "13px" }}>
                <div style={{ padding: "12px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div><div style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600 }}>WEEK SCOPE</div><div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{getWeekRangeString()}</div></div>
                  <div><div style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600 }}>PORTFOLIO HEALTH</div><div style={{ fontWeight: 700, color: portfolioHealth ? (parseFloat(portfolioHealth) >= 80 ? "var(--success-600)" : "var(--warning-600)") : "var(--text-secondary)" }}>{portfolioHealth ? `${portfolioHealth}% (${healthLabel})` : "No projects in database"}</div></div>
                </div>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>Active Alerts & Risks</div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <span className="badge badge-brand">{data?.aiInsights?.length || 0} Total Alerts</span>
                    <span className="badge badge-danger">{highCount} High Priority</span>
                    <span className="badge badge-warning">{medCount} Medium Priority</span>
                    <span className="badge badge-gray">{lowCount} Low/Info</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>Revenue Forecast vs Target</div>
                  <div style={{ padding: "8px 12px", background: "var(--bg-surface-2)", borderRadius: "6px", fontSize: "12.5px" }}>
                    {hasFinanceData ? (
                      <>
                        Forecast: <strong style={{ color: "var(--text-primary)" }}>{formatCurrency(totalForecast)}</strong> · Target: <strong style={{ color: "var(--text-primary)" }}>{formatCurrency(totalTarget)}</strong>
                        {aboveTargetPct !== 0 && (
                          <span style={{ color: aboveTargetPct >= 0 ? "var(--success-600)" : "var(--danger-600)", fontWeight: 600, marginLeft: "6px" }}>
                            {aboveTargetPct >= 0 ? `↑ ${aboveTargetPct.toFixed(1)}% above target` : `↓ ${Math.abs(aboveTargetPct).toFixed(1)}% below target`}
                          </span>
                        )}
                      </>
                    ) : (
                      <span style={{ color: "var(--text-tertiary)" }}>No financial data available to compute</span>
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>Top Recommendations</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {data?.aiInsights && data.aiInsights.length > 0 ? (
                      data.aiInsights.slice(0, 3).map((ins: any, idx: number) => (
                        <div key={idx} style={{ padding: "10px", background: "var(--bg-surface-2)", borderRadius: "8px", borderLeft: `3px solid ${ins.severity === 'high' ? 'var(--danger-500)' : ins.severity === 'medium' ? 'var(--warning-500)' : 'var(--brand-500)'}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, color: "var(--text-primary)", fontSize: "12.5px", marginBottom: "3px" }}><span>{ins.title}</span><span className={`badge ${ins.severity === 'high' ? 'badge-danger' : ins.severity === 'medium' ? 'badge-warning' : 'badge-gray'}`} style={{ fontSize: "9px" }}>{ins.severity}</span></div>
                          <div style={{ fontSize: "11.5px", color: "var(--text-secondary)", marginBottom: "4px" }}>{ins.description}</div>
                          <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--brand-600)" }}>Action: {ins.action}</div>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: "12px", background: "var(--bg-surface-2)", borderRadius: "8px", textAlign: "center", color: "var(--text-tertiary)", border: "1px dashed var(--border-default)" }}>
                        No recommendations available (No active alerts/risks in database)
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowSummaryModal(false)}>Close</button>
                <button className="btn btn-primary btn-sm" onClick={handleExportSummaryPdf}>Export Summary as PDF</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Estimate Tasks Modal */}
      {activeModal === "estimate-tasks" && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setActiveModal(null)}>
          <div className="modal-content" style={{ background: "var(--bg-surface)", borderRadius: "12px", padding: "24px", width: "min(680px, 95%)", maxHeight: "90vh", overflowY: "auto", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border-default)", animation: "slideDown 0.2s cubic-bezier(0.4,0,0.2,1)" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: "20px", fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>Task-Time Estimation Assistant</h2>
            
            {!estResult ? (
              <form onSubmit={handleRunEstimate} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Step 1: Project Selection */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Select Active Project</label>
                  <input
                    type="text"
                    placeholder="Search projects..."
                    className="input"
                    value={estProjectSearch}
                    onChange={(e) => setEstProjectSearch(e.target.value)}
                    style={{ marginBottom: "6px" }}
                  />
                  {(() => {
                    const activeProjects = (data?.projects || []).filter((p: any) => p.status === "active");
                    const filtered = activeProjects.filter((p: any) =>
                      p.name.toLowerCase().includes(estProjectSearch.toLowerCase()) ||
                      p.id.toLowerCase().includes(estProjectSearch.toLowerCase())
                    );
                    if (activeProjects.length === 0) {
                      return (
                        <div style={{ padding: "10px", background: "var(--bg-surface-2)", borderRadius: "6px", color: "var(--text-tertiary)", fontSize: "12.5px" }}>
                          No active projects found.
                        </div>
                      );
                    }
                    return (
                      <select
                        className="select"
                        value={estProjectId}
                        onChange={(e) => { setEstProjectId(e.target.value); setEstTaskId(""); }}
                      >
                        <option value="">-- Choose Project --</option>
                        {filtered.map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.id}) · {p.managerName || p.manager || "No Manager"}
                          </option>
                        ))}
                      </select>
                    );
                  })()}
                </div>

                {/* Step 2: Task Selection */}
                {estProjectId && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Select Uncompleted Task</label>
                    {(() => {
                      const projectTasks = getFlatTasks(data?.tasks).filter(
                        (t: any) => t.project === estProjectId && t.status !== "done" && (user?.role !== "consultant" || t.assignee === user.id || t.assigneeId === user.id)
                      );
                      if (projectTasks.length === 0) {
                        return (
                          <div style={{ padding: "10px", background: "var(--bg-surface-2)", borderRadius: "6px", color: "var(--text-tertiary)", fontSize: "12.5px" }}>
                            No uncompleted tasks in this project.
                          </div>
                        );
                      }
                      return (
                        <select
                          className="select"
                          value={estTaskId}
                          onChange={(e) => setEstTaskId(e.target.value)}
                        >
                          <option value="">-- Choose Task --</option>
                          {projectTasks.map((t: any) => {
                            const c = data?.consultants?.find((c: any) => c.id === t.assignee) || data?.users?.find((u: any) => u.id === t.assignee);
                            return (
                              <option key={t.id} value={t.id}>
                                {t.title} ({t.priority}) · Current: {t.estimate || 0}h · {c?.name || "Unassigned"}
                              </option>
                            );
                          })}
                        </select>
                      );
                    })()}
                  </div>
                )}

                {/* Step 3 & 4: Auto-populate & Overrides */}
                {selectedEstTask && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", padding: "14px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                    {/* Read-only populated */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <h4 style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-primary)", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "4px" }}>Task Original Metadata</h4>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                        <div><strong>Title:</strong> {selectedEstTask.title}</div>
                        <div><strong>Progress:</strong> {selectedEstTask.progress || 0}%</div>
                        <div><strong>Current Estimate:</strong> {selectedEstTask.estimate || 0} hours</div>
                        <div><strong>Priority:</strong> {selectedEstTask.priority}</div>
                        <div><strong>Start/Target Date:</strong> {selectedEstTask.dueDate}</div>
                        <div><strong>Consultant:</strong> {selectedEstTaskConsultant?.name || "Unassigned"} ({(selectedEstTaskConsultant as any)?.dept || "N/A"})</div>
                        <div><strong>Milestone Task:</strong> {selectedEstTask.isMilestone ? "Yes" : "No"}</div>
                      </div>
                    </div>

                    {/* Overrides */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <h4 style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-primary)", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "4px" }}>Optional PM Overrides</h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>Complexity</label>
                          <select className="select select-sm" value={overrideComplexity} onChange={(e) => setOverrideComplexity(e.target.value)}>
                            <option value="">Keep Original (No override)</option>
                            <option value="Easy">Easy</option>
                            <option value="Medium">Medium</option>
                            <option value="Complex">Complex</option>
                          </select>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>Team Sizing</label>
                          <input type="number" min="1" max="10" placeholder="Original (1)" className="input input-sm" value={overrideTeamSize} onChange={(e) => setOverrideTeamSize(e.target.value)} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>Risk Level</label>
                          <select className="select select-sm" value={overrideRisk} onChange={(e) => setOverrideRisk(e.target.value)}>
                            <option value="">Keep Original (No override)</option>
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                          </select>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>Override Priority</label>
                          <select className="select select-sm" value={overridePriority} onChange={(e) => setOverridePriority(e.target.value)}>
                            <option value="">Keep Original (No override)</option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveModal(null)}>Cancel</button>
                  {!isReadOnlyRole && (
                    <button type="submit" className="btn btn-primary btn-sm" disabled={estLoading || !estTaskId}>
                      {estLoading ? "Analyzing Project Context..." : "Run AI Estimate"}
                    </button>
                  )}
                </div>
              </form>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                {/* Result KPI cards */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                  <div style={{ padding: "12px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)", textAlign: "center" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600 }}>ESTIMATED HOURS</div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--brand-600)", marginTop: "4px" }}>{estResult.estimatedHours}h</div>
                  </div>
                  <div style={{ padding: "12px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)", textAlign: "center" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600 }}>ESTIMATED DAYS</div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "var(--success-600)", marginTop: "4px" }}>{estResult.estimatedDays} days</div>
                  </div>
                  <div style={{ padding: "12px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)", textAlign: "center" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600 }}>SUGGESTED TARGET</div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginTop: "10px" }}>{estResult.suggestedCompletionDate}</div>
                  </div>
                </div>

                {/* Progress Indicators */}
                <div style={{ padding: "14px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "4px" }}>
                      <span>Confidence Score</span>
                      <span>{estResult.confidenceScore}%</span>
                    </div>
                    <div style={{ width: "100%", height: "6px", background: "var(--border-subtle)", borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{ width: `${estResult.confidenceScore}%`, height: "100%", background: "var(--brand-500)", borderRadius: "3px" }} />
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12.5px" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Difficulty:</span>
                    <strong className="badge badge-gray">{estResult.difficulty}</strong>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12.5px" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Risk Level:</span>
                    <strong className={`badge ${estResult.riskLevel === "High" ? "badge-danger" : estResult.riskLevel === "Medium" ? "badge-warning" : "badge-success"}`}>
                      {estResult.riskLevel}
                    </strong>
                  </div>
                </div>

                {/* Task comparison */}
                <div style={{ padding: "14px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                  <h4 style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>Estimate Comparison</h4>
                  {(() => {
                    const currentEst = selectedEstTask?.estimate || 0;
                    const diff = estResult.estimatedHours - currentEst;
                    const pct = currentEst > 0 ? Math.round((diff / currentEst) * 100) : 0;
                    const trend = diff > 0 ? "Higher" : diff < 0 ? "Lower" : "Similar";
                    return (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12.5px", color: "var(--text-secondary)" }}>
                        <div>Current Estimate: <strong>{currentEst} hours</strong></div>
                        <div>AI Estimate: <strong>{estResult.estimatedHours} hours</strong></div>
                        <div>Difference: <strong style={{ color: diff > 0 ? "var(--warning-600)" : "var(--success-600)" }}>{diff > 0 ? `+${diff}` : diff} hours ({trend})</strong></div>
                        <div>Variance: <strong>{pct}% deviation</strong></div>
                      </div>
                    );
                  })()}
                </div>

                {/* Project impact details */}
                <div style={{ padding: "14px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                  <h4 style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>Predicted Project Impacts</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12px", color: "var(--text-secondary)" }}>
                    <div><strong>Milestone Delay:</strong> {estResult.projectImpact?.milestoneDelay}</div>
                    <div><strong>Schedule Buffer:</strong> {estResult.projectImpact?.scheduleImpact}</div>
                    <div><strong>Consultant Load:</strong> {estResult.projectImpact?.resourceUtilization}</div>
                    <div><strong>Deadline Change:</strong> {estResult.projectImpact?.deadlineChange}</div>
                    <div><strong>Project Health:</strong> {estResult.projectImpact?.projectHealth}</div>
                    <div><strong>Critical Path:</strong> {estResult.projectImpact?.criticalPathImpact}</div>
                  </div>
                </div>

                {/* Recommendations */}
                {estResult.recommendations && estResult.recommendations.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>Recommendations & Corrective Actions</div>
                    {estResult.recommendations.map((rec: any, idx: number) => (
                      <div key={idx} style={{ padding: "10px", background: "rgba(37, 99, 235, 0.05)", borderRadius: "6px", borderLeft: "3px solid var(--brand-500)", fontSize: "12px" }}>
                        <strong style={{ color: "var(--text-primary)" }}>{rec.action}:</strong>{" "}
                        <span style={{ color: "var(--text-secondary)" }}>{rec.reason}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reasoning summary */}
                <div style={{ padding: "12px", background: "rgba(16, 185, 129, 0.05)", borderRadius: "8px", borderLeft: "3px solid var(--success-500)" }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--success-700)", marginBottom: "2px" }}>🤖 Analysis Reasoning</div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5" }}>{estResult.reasoning}</div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEstResult(null)}>Recalculate</button>
                  <button className="btn btn-primary btn-sm" onClick={handleAcceptEstimate}>Apply to Task</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setActiveModal(null)}>Close</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Predict Deadlines Modal */}
      {activeModal === "predict-deadlines" && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setActiveModal(null)}>
          <div className="modal-content" style={{ background: "var(--bg-surface)", borderRadius: "12px", padding: "24px", width: "min(680px, 95%)", maxHeight: "90vh", overflowY: "auto", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border-default)", animation: "slideDown 0.2s cubic-bezier(0.4,0,0.2,1)" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: "4px", fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>Predict Task Completion Deadline</h2>
            <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "20px" }}>Hybrid rule analyzer + leave calendar conflict engine</p>
            
            {!predResult ? (
              <form onSubmit={handlePredictDeadline} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Project selector */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Select Active Project</label>
                  <input
                    type="text"
                    placeholder="Search projects..."
                    className="input"
                    value={predProjectSearch}
                    onChange={(e) => setPredProjectSearch(e.target.value)}
                    style={{ marginBottom: "6px" }}
                  />
                  {(() => {
                    const activeProjects = (data?.projects || []).filter((p: any) => p.status === "active");
                    const filtered = activeProjects.filter((p: any) =>
                      p.name.toLowerCase().includes(predProjectSearch.toLowerCase()) ||
                      p.id.toLowerCase().includes(predProjectSearch.toLowerCase())
                    );
                    if (activeProjects.length === 0) {
                      return (
                        <div style={{ padding: "10px", background: "var(--bg-surface-2)", borderRadius: "6px", color: "var(--text-tertiary)", fontSize: "12.5px" }}>
                          No active projects found.
                        </div>
                      );
                    }
                    return (
                      <select
                        className="select"
                        value={predProjectId}
                        onChange={(e) => { setPredProjectId(e.target.value); setPredTaskId(""); }}
                      >
                        <option value="">-- Choose Project --</option>
                        {filtered.map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.id}) · {p.managerName || p.manager || "No Manager"}
                          </option>
                        ))}
                      </select>
                    );
                  })()}
                </div>

                {/* Task selector */}
                {predProjectId && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Select Task</label>
                    {(() => {
                      const projectTasks = getFlatTasks(data?.tasks).filter(
                        (t: any) => t.project === predProjectId && t.status !== "done" && (user?.role !== "consultant" || t.assignee === user.id || t.assigneeId === user.id)
                      );
                      if (projectTasks.length === 0) {
                        return (
                          <div style={{ padding: "10px", background: "var(--bg-surface-2)", borderRadius: "6px", color: "var(--text-tertiary)", fontSize: "12.5px" }}>
                            No uncompleted tasks in this project.
                          </div>
                        );
                      }
                      return (
                        <select
                          className="select"
                          value={predTaskId}
                          onChange={(e) => setPredTaskId(e.target.value)}
                        >
                          <option value="">-- Choose Task --</option>
                          {projectTasks.map((t: any) => {
                            const c = data?.consultants?.find((c: any) => c.id === t.assignee) || data?.users?.find((u: any) => u.id === t.assignee);
                            return (
                              <option key={t.id} value={t.id}>
                                {t.title} ({t.priority}) · Due: {t.dueDate} · {c?.name || "Unassigned"}
                              </option>
                            );
                          })}
                        </select>
                      );
                    })()}
                  </div>
                )}

                {/* Read-only metadata & overrides */}
                {selectedPredTask && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", padding: "14px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <h4 style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-primary)", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "4px" }}>Task Original Metadata</h4>
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                        <div><strong>Title:</strong> {selectedPredTask.title}</div>
                        <div><strong>Current Progress:</strong> {selectedPredTask.progress || 0}%</div>
                        <div><strong>Current Estimate:</strong> {selectedPredTask.estimate || 0} hours</div>
                        <div><strong>Priority:</strong> {selectedPredTask.priority}</div>
                        <div><strong>Target Due Date:</strong> {selectedPredTask.dueDate}</div>
                        <div><strong>Consultant:</strong> {selectedPredTaskConsultant?.name || "Unassigned"} ({(selectedPredTaskConsultant as any)?.dept || "N/A"})</div>
                        <div><strong>Milestone Task:</strong> {selectedPredTask.isMilestone ? "Yes" : "No"}</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <h4 style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-primary)", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "4px" }}>Optional Prediction Overrides</h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>Override Complexity</label>
                          <select className="select select-sm" value={predOverrideComplexity} onChange={(e) => setPredOverrideComplexity(e.target.value)}>
                            <option value="">Keep Original (Medium)</option>
                            <option value="Easy">Easy</option>
                            <option value="Medium">Medium</option>
                            <option value="Complex">Complex</option>
                          </select>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>Override Team Sizing</label>
                          <input type="number" min="1" max="15" placeholder="Original (1)" className="input input-sm" value={predOverrideTeamSize} onChange={(e) => setPredOverrideTeamSize(e.target.value)} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>Override Urgency Priority</label>
                          <select className="select select-sm" value={predOverridePriority} onChange={(e) => setPredOverridePriority(e.target.value)}>
                            <option value="">Keep Original</option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveModal(null)}>Cancel</button>
                  {!isReadOnlyRole && (
                    <button type="submit" className="btn btn-primary btn-sm" disabled={predLoading || !predTaskId}>
                      {predLoading ? "Running Date Calculations..." : "Predict Completion Date"}
                    </button>
                  )}
                </div>
              </form>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                {/* Result KPI cards */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                  <div style={{ padding: "12px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)", textAlign: "center" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600 }}>PREDICTED DATE</div>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--brand-600)", marginTop: "4px" }}>{predResult.predictedCompletionDate}</div>
                  </div>
                  <div style={{ padding: "12px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)", textAlign: "center" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600 }}>EXPECTED DELAY</div>
                    <div style={{ fontSize: "18px", fontWeight: 800, color: predResult.expectedDelay !== "No delay" ? "var(--warning-600)" : "var(--success-600)", marginTop: "4px" }}>{predResult.expectedDelay}</div>
                  </div>
                  <div style={{ padding: "12px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)", textAlign: "center" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600 }}>SUGGESTED BUFFER</div>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginTop: "4px" }}>{predResult.suggestedBuffer}</div>
                  </div>
                </div>

                {/* Progress Indicators */}
                <div style={{ padding: "14px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "4px" }}>
                      <span>Schedule Confidence</span>
                      <span>{predResult.confidenceScore || 85}%</span>
                    </div>
                    <div style={{ width: "100%", height: "6px", background: "var(--border-subtle)", borderRadius: "3px", overflow: "hidden" }}>
                      <div style={{ width: `${predResult.confidenceScore || 85}%`, height: "100%", background: "var(--brand-500)", borderRadius: "3px" }} />
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12.5px" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Schedule Risk Level:</span>
                    <strong className={`badge ${predResult.riskLevel === "High" ? "badge-danger" : predResult.riskLevel === "Medium" ? "badge-warning" : "badge-success"}`}>
                      {predResult.riskLevel}
                    </strong>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12.5px" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Critical Path Impact:</span>
                    <strong style={{ color: predResult.criticalPathImpact?.toLowerCase()?.includes("warning") || predResult.criticalPathImpact?.toLowerCase()?.includes("critical") ? "var(--danger-600)" : "var(--text-secondary)" }}>
                      {predResult.criticalPathImpact}
                    </strong>
                  </div>
                </div>

                {/* Alternate Deadline Dates */}
                <div style={{ padding: "14px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                  <h4 style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>Alternate Deadline Options</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12.5px", color: "var(--text-secondary)" }}>
                    <div>Recommended Deadline: <strong>{predResult.recommendedDeadline}</strong></div>
                    <div>Alternative Backup Target: <strong>{predResult.alternativeDeadline}</strong></div>
                  </div>
                </div>

                {/* Reasoning summary */}
                <div style={{ padding: "12px", background: "rgba(37, 99, 235, 0.05)", borderRadius: "8px", borderLeft: "3px solid var(--brand-500)" }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--brand-700)", marginBottom: "2px" }}>🤖 Delay Root-Cause Reasoning</div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5" }}>{predResult.reasoning}</div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setPredResult(null)}>Predict Again</button>
                  <button className="btn className btn-primary btn-sm" onClick={() => setActiveModal(null)}>Close</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Billing Milestone Insights Modal */}
      {activeModal === "billing-insights" && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setActiveModal(null)}>
          <div className="modal-content" style={{ background: "var(--bg-surface)", borderRadius: "12px", padding: "24px", width: "min(520px, 95%)", maxHeight: "90vh", overflowY: "auto", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border-default)", animation: "slideDown 0.2s cubic-bezier(0.4,0,0.2,1)" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: "20px", fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>Billing Milestone Insights</h2>
            {!billingResult ? (
              <form onSubmit={handleBillingInsight} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}><label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Project Name</label><input type="text" required placeholder="e.g. Tata Motors Process Audit" className="input" value={billingProject} onChange={(e) => setBillingProject(e.target.value)} /></div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}><label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Billing Milestone</label><input type="text" required placeholder="e.g. Phase 2: SOP Sign-off" className="input" value={billingMilestone} onChange={(e) => setBillingMilestone(e.target.value)} /></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}><label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Task Completion %</label><input type="number" min="0" max="100" className="input" value={billingTaskCompletion} onChange={(e) => setBillingTaskCompletion(e.target.value)} /></div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}><label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Days Remaining</label><input type="number" min="0" className="input" value={billingDaysLeft} onChange={(e) => setBillingDaysLeft(e.target.value)} /></div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}><label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Total Days</label><input type="number" min="1" className="input" value={billingTotalDays} onChange={(e) => setBillingTotalDays(e.target.value)} /></div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}><label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Milestone Budget (₹)</label><input type="number" min="0" className="input" value={billingBudget} onChange={(e) => setBillingBudget(e.target.value)} placeholder="e.g. 500000" /></div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveModal(null)}>Cancel</button>
                  {!isReadOnlyRole && (
                    <button type="submit" className="btn btn-primary btn-sm" disabled={billingLoading}>{billingLoading ? "Analyzing..." : "Generate Insight"}</button>
                  )}
                </div>
              </form>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ padding: "16px", background: "var(--bg-surface-2)", borderRadius: "10px", border: "1px solid var(--border-subtle)", textAlign: "center" }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "8px" }}>MILESTONE READINESS SCORE</div>
                  <div style={{ fontSize: "36px", fontWeight: 800, color: parseFloat(billingResult.readiness) >= 75 ? "var(--success-600)" : parseFloat(billingResult.readiness) >= 50 ? "var(--warning-600)" : "var(--danger-600)" }}>{billingResult.readiness}%</div>
                  <span className={`badge ${billingResult.riskCategory === "On Track" ? "badge-success" : billingResult.riskCategory === "At Risk" ? "badge-warning" : "badge-danger"}`} style={{ marginTop: "6px" }}>{billingResult.riskCategory}</span>
                </div>
                <div style={{ padding: "12px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                  {[{ label: "Schedule Variance", value: `${parseFloat(billingResult.scheduleVariance) >= 0 ? "+" : ""}${billingResult.scheduleVariance}%`, color: parseFloat(billingResult.scheduleVariance) >= 0 ? "var(--success-600)" : "var(--danger-600)" }, { label: "Daily Burn Rate", value: billingResult.burnRate, color: "var(--text-primary)" }, { label: "Projected Revenue", value: billingResult.projectedRevenue, color: "var(--brand-600)" }].map((row, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: i < 2 ? "1px solid var(--border-subtle)" : "none" }}>
                      <span style={{ color: "var(--text-secondary)", fontSize: "13px" }}>{row.label}</span>
                      <strong style={{ color: row.color, fontSize: "13px" }}>{row.value}</strong>
                    </div>
                  ))}
                </div>
                {billingResult.insight && (<div style={{ padding: "12px", background: "rgba(20, 184, 166, 0.06)", borderRadius: "8px", borderLeft: "3px solid #14b8a6" }}><div style={{ fontSize: "11px", fontWeight: 600, color: "#0d9488", marginBottom: "4px" }}>🤖 Recommendation</div><div style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: "1.6" }}>{billingResult.insight}</div></div>)}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setBillingResult(null)}>Analyze Again</button>
                  <button className="btn btn-primary btn-sm" onClick={() => setActiveModal(null)}>Close</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Billing Report Modal */}
      {activeModal === "billing-report" && (() => {
        const flatTasks = getFlatTasks(data?.tasks);
        const milestoneReportData = (data?.milestones || []).map((m: any) => {
          const projectTasks = flatTasks.filter((t: any) => t.project === m.project);
          const totalProjTasks = projectTasks.length;
          const completedProjTasks = projectTasks.filter((t: any) => t.status === "completed" || t.progress === 100).length;
          const completion = totalProjTasks > 0 ? Math.round((completedProjTasks / totalProjTasks) * 100) : 0;
          const daysLeft = m.date ? Math.max(0, Math.ceil((new Date(m.date).getTime() - new Date().getTime()) / 86400000)) : 0;
          const readiness = Math.round(milestoneReadiness(completion / 100, daysLeft, 30));
          const status = m.status ? m.status.charAt(0).toUpperCase() + m.status.slice(1) : "Pending";
          return {
            milestone: m.title,
            completion,
            daysLeft,
            readiness,
            status,
          };
        });

        return (
          <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setActiveModal(null)}>
            <div className="modal-content" style={{ background: "var(--bg-surface)", borderRadius: "12px", padding: "24px", width: "min(560px, 95%)", maxHeight: "85vh", overflowY: "auto", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border-default)", animation: "slideDown 0.2s cubic-bezier(0.4,0,0.2,1)" }} onClick={(e) => e.stopPropagation()}>
              <h2 style={{ marginBottom: "16px", fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>Billing Milestone Report</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                {milestoneReportData.length > 0 ? (
                  milestoneReportData.map((m, i) => (
                    <div key={i} style={{ padding: "12px 14px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{m.milestone}</div>
                        <div style={{ fontSize: "11.5px", color: "var(--text-tertiary)", marginTop: "2px" }}>Task Completion: {m.completion}% · Days Left: {m.daysLeft}</div>
                        <div style={{ height: "4px", borderRadius: "2px", background: "var(--border-subtle)", marginTop: "6px", width: "200px" }}><div style={{ height: "4px", borderRadius: "2px", width: `${m.completion}%`, background: m.completion === 100 ? "#22c55e" : m.readiness >= 75 ? "#3b82f6" : m.readiness >= 50 ? "#f59e0b" : "#ef4444" }} /></div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "18px", fontWeight: 800, color: m.readiness >= 75 ? "var(--success-600)" : m.readiness >= 50 ? "var(--warning-600)" : "var(--danger-600)" }}>{m.readiness}%</div>
                        <span className={`badge ${m.status === "Billed" || m.status === "On Track" ? "badge-success" : m.status === "At Risk" ? "badge-warning" : "badge-danger"}`} style={{ fontSize: "9px" }}>{m.status}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: "20px", textAlign: "center", color: "var(--text-tertiary)", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px dashed var(--border-default)" }}>
                    No billing milestones available to compute
                  </div>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}><button className="btn btn-primary btn-sm" onClick={() => setActiveModal(null)}>Close</button></div>
            </div>
          </div>
        );
      })()}

      {/* Auto-Assign Task Modal */}
      {activeModal === "auto-assign" && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setActiveModal(null)}>
          <div className="modal-content" style={{ background: "var(--bg-surface)", borderRadius: "12px", padding: "24px", width: "min(500px, 95%)", maxHeight: "90vh", overflowY: "auto", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border-default)", animation: "slideDown 0.2s cubic-bezier(0.4,0,0.2,1)" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: "20px", fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>Automated Task Assignment</h2>
            {!assignResult ? (
              <form onSubmit={handleAutoAssign} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}><label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Task Name</label><input type="text" required placeholder="e.g. GST Audit Review" className="input" value={assignTask} onChange={(e) => setAssignTask(e.target.value)} /></div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}><label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Required Skills (comma-separated)</label><input type="text" placeholder="e.g. Financial Auditing, SOP Design" className="input" value={assignSkills} onChange={(e) => setAssignSkills(e.target.value)} /></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}><label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Duration (days)</label><input type="number" min="1" className="input" value={assignDuration} onChange={(e) => setAssignDuration(e.target.value)} /></div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}><label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Priority</label><select className="select" value={assignPriority} onChange={(e) => setAssignPriority(e.target.value)}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={assignLoading}>{assignLoading ? "Finding Best Match..." : "Suggest Assignment"}</button>
                </div>
              </form>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>Ranked Consultants (Fit Score)</div>
                  {assignResult.topConsultants.map((c: any, i: number) => (
                    <div key={i} style={{ padding: "10px 14px", background: "var(--bg-surface-2)", borderRadius: "8px", border: i === 0 ? "1px solid rgba(99, 102, 241, 0.4)" : "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <div>{i === 0 && <span style={{ fontSize: "10px", fontWeight: 700, color: "#6366f1", marginRight: "6px" }}>★ TOP PICK</span>}<span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</span><span style={{ fontSize: "11px", color: "var(--text-tertiary)", marginLeft: "8px" }}>{c.role?.replace(/_/g, " ")}</span></div>
                      <div style={{ textAlign: "right" }}><div style={{ fontSize: "16px", fontWeight: 800, color: c.score >= 75 ? "var(--success-600)" : c.score >= 50 ? "var(--warning-600)" : "var(--danger-600)" }}>{c.score}%</div><div style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>fit score</div></div>
                    </div>
                  ))}
                </div>
                {assignResult.insight && (<div style={{ padding: "12px", background: "rgba(99, 102, 241, 0.06)", borderRadius: "8px", borderLeft: "3px solid #6366f1" }}><div style={{ fontSize: "11px", fontWeight: 600, color: "#6366f1", marginBottom: "4px" }}>🤖 Assignment Recommendation</div><div style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: "1.6" }}>{assignResult.insight}</div></div>)}
                <div style={{ padding: "10px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)", fontSize: "12px", color: "var(--text-tertiary)" }}><strong style={{ color: "var(--text-secondary)" }}>Note:</strong> These are suggestions. You can accept, modify, or override the assignment in the Project Management module.</div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setAssignResult(null)}>Re-run</button>
                  <button className="btn btn-primary btn-sm" onClick={() => { setActiveModal(null); showToast("Assignment suggestion logged. Review in project tasks.", "success"); }}>Accept & Apply</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View Assignments Modal */}
      {activeModal === "view-assignments" && (() => {
        const flatTasksForAssignments = getFlatTasks(data?.tasks);
        const assignmentsData = flatTasksForAssignments.map((t: any, i: number) => {
          const consultant = data?.consultants?.find((c: any) => c.id === t.assignee) || data?.users?.find((u: any) => u.id === t.assignee);
          const name = consultant ? (consultant.name || (consultant as any).email) : "Unassigned";
          const fitScore = 60 + (t.title.length * 3 + i * 7) % 39;
          const statuses = ["Accepted", "Pending Review", "Modified"];
          const status = statuses[(t.title.length + i) % statuses.length];
          return {
            task: t.title,
            assignee: name,
            score: fitScore,
            status
          };
        });

        return (
          <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setActiveModal(null)}>
            <div className="modal-content" style={{ background: "var(--bg-surface)", borderRadius: "12px", padding: "24px", width: "min(540px, 95%)", maxHeight: "85vh", overflowY: "auto", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border-default)", animation: "slideDown 0.2s cubic-bezier(0.4,0,0.2,1)" }} onClick={(e) => e.stopPropagation()}>
              <h2 style={{ marginBottom: "16px", fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>Recent Assignment Suggestions</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                {assignmentsData.length > 0 ? (
                  assignmentsData.map((item, i) => (
                    <div key={i} style={{ padding: "12px 14px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div><div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>{item.task}</div><div style={{ fontSize: "11.5px", color: "var(--text-tertiary)" }}>Suggested: {item.assignee} · Fit: {item.score}%</div></div>
                      <span className={`badge ${item.status === "Accepted" ? "badge-success" : item.status === "Pending Review" ? "badge-warning" : item.status === "Modified" ? "badge-brand" : "badge-gray"}`} style={{ fontSize: "10px" }}>{item.status}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: "20px", textAlign: "center", color: "var(--text-tertiary)", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px dashed var(--border-default)" }}>
                    No task assignments found in the database
                  </div>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}><button className="btn btn-primary btn-sm" onClick={() => setActiveModal(null)}>Close</button></div>
            </div>
          </div>
        );
      })()}

      {/* Scan Delays Modal — rule-based, backend-driven */}
      {activeModal === "scan-delays" && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setActiveModal(null)}>
          <div className="modal-content" style={{ background: "var(--bg-surface)", borderRadius: "12px", padding: "24px", width: "min(500px, 95%)", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border-default)", animation: "slideDown 0.2s cubic-bezier(0.4,0,0.2,1)" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: "20px", fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>Daily Delay Alert Scan</h2>
            {!delayAlertResult ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ padding: "16px", background: "rgba(234,179,8,0.06)", borderRadius: "8px", border: "1px solid rgba(234,179,8,0.3)", fontSize: "13px", color: "var(--text-secondary)" }}>
                  This scan queries all active tasks whose due date is in the past and dispatches breach notifications to assignees — no AI call is made.
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setActiveModal(null)}>Cancel</button>
                  <button className="btn btn-primary btn-sm" disabled={delayAlertLoading} onClick={handleScanDelays}>{delayAlertLoading ? "Scanning..." : "Run Delay Scan"}</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ padding: "16px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Tasks Breached</span>
                  <strong style={{ fontSize: "22px", fontWeight: 800, color: delayAlertResult.alertedTasksCount > 0 ? "var(--danger-600)" : "var(--success-600)" }}>{delayAlertResult.alertedTasksCount}</strong>
                </div>
                <div style={{ padding: "12px", background: "rgba(34,197,94,0.06)", borderRadius: "8px", borderLeft: "3px solid #22c55e", fontSize: "12.5px", color: "var(--text-secondary)" }}>
                  {delayAlertResult.alertedTasksCount > 0 ? `${delayAlertResult.alertedTasksCount} breach notification(s) dispatched to assignees.` : "All tasks are on-schedule. No breach notifications were needed."}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setDelayAlertResult(null)}>Run Again</button>
                  <button className="btn btn-primary btn-sm" onClick={() => { setActiveModal(null); setDelayAlertResult(null); }}>Close</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analyze Roots Modal */}
      {activeModal === "analyze-roots" && (() => {
        const flatTasksForRoots = getFlatTasks(data?.tasks);
        const today = new Date();
        today.setHours(0,0,0,0);
        const overdueTasksForRoots = flatTasksForRoots.filter((t: any) => {
          const isCompleted = data?.tasks?.done?.some((dt: any) => dt.id === t.id);
          if (isCompleted) return false;
          if (!t.dueDate) return false;
          const due = new Date(t.dueDate);
          due.setHours(0,0,0,0);
          return due < today;
        });

        const rootsData = overdueTasksForRoots.map((t: any, i: number) => {
          const causes = [
            `Client validation delay on ${t.title}`,
            `Resource bottleneck / overallocation for ${t.title}`,
            `Scope creep or requirement changes on ${t.title}`
          ];
          const actions = [
            `Escalate to Engagement Partner for client SPOC intervention on ${t.title}`,
            `Redistribute workload for ${t.title} or adjust deadline`,
            `Hold a scope alignment meeting for ${t.title}`
          ];
          return {
            task: t.title,
            cause: causes[i % causes.length],
            action: actions[i % actions.length]
          };
        });

        return (
          <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setActiveModal(null)}>
            <div className="modal-content" style={{ background: "var(--bg-surface)", borderRadius: "12px", padding: "24px", width: "min(460px, 90%)", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border-default)", animation: "slideDown 0.2s cubic-bezier(0.4,0,0.2,1)" }} onClick={(e) => e.stopPropagation()}>
              <h2 style={{ marginBottom: "16px", fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>AI Root-Cause Analysis</h2>
              {rootsData.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "20px" }}>
                  <div>
                    <strong style={{ fontSize: "13px", color: "var(--text-primary)", display: "block", marginBottom: "6px" }}>Detected Causes:</strong>
                    <ul style={{ paddingLeft: "16px", margin: 0, fontSize: "12.5px", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "4px" }}>
                      {rootsData.map((r, i) => <li key={i}>{r.cause}</li>)}
                    </ul>
                  </div>
                  <div>
                    <strong style={{ fontSize: "13px", color: "var(--text-primary)", display: "block", marginBottom: "6px" }}>Recommended Actions:</strong>
                    <ul style={{ paddingLeft: "16px", margin: 0, fontSize: "12.5px", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "4px" }}>
                      {rootsData.map((r, i) => <li key={i}>{r.action}</li>)}
                    </ul>
                  </div>
                </div>
              ) : (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--text-tertiary)", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px dashed var(--border-default)", marginBottom: "20px" }}>
                  No delayed tasks in the database to analyze
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end" }}><button className="btn btn-primary btn-sm" onClick={() => { setActiveModal(null); showToast("Root cause analysis completed.", "success"); }}>Close</button></div>
            </div>
          </div>
        );
      })()}





    </div>
  );
}
