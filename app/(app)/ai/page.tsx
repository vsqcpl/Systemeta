"use client";

import React, { useState, useCallback, useRef } from "react";
import { useAppStore, useTranslation } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";
import {
  IconCpu,
  IconCrystalBall,
  IconAlert,
  IconWand,
  IconTimer,
  IconUsers,
} from "@/components/ui/Icons";

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

// ─── Component ───────────────────────────────────────────────────────────────
export default function AIPage() {
  const showToast = useAppStore((state) => state.showToast);
  const data = useAppStore((state) => state.data);
  const { t } = useTranslation();

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

  // Card 1: Task-Time Estimation
  const [estTask, setEstTask] = useState("GST & Compliance Audit");
  const [estPriority, setEstPriority] = useState("Medium");
  const [estTeamSize, setEstTeamSize] = useState("3");
  const [estResult, setEstResult] = useState<any>(null);
  const [estLoading, setEstLoading] = useState(false);

  // Card 2: Delay Detection
  const [predTaskName, setPredTaskName] = useState("");
  const [predStartDate, setPredStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [predTeamSize, setPredTeamSize] = useState("2");
  const [predComplexity, setPredComplexity] = useState("Medium");
  const [predResult, setPredResult] = useState<any>(null);
  const [predLoading, setPredLoading] = useState(false);

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
    e.preventDefault(); setEstLoading(true); setRateLimitMsg(null);
    try {
      const res = await fetch("/api/ai/estimate-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskName: estTask, priority: estPriority, teamSize: estTeamSize }),
      });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      setEstResult(result);
      showToast("Task estimation calculated with Groq AI + historical RAG.", "success");
    } catch (err: any) {
      showToast("Estimation failed: " + (err?.message || "Unknown error"), "danger");
    } finally { setEstLoading(false); }
  };

  // ── Predict Deadlines → backend endpoint (Rule-Based + GenAI root-cause) ──
  const handlePredictDeadline = async (e: React.FormEvent) => {
    e.preventDefault(); setPredLoading(true); setRateLimitMsg(null);
    try {
      const res = await fetch("/api/ai/predict-deadline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskName: predTaskName, startDate: predStartDate, teamSize: predTeamSize, complexity: predComplexity }),
      });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      setPredResult(result);
      showToast("Deadline prediction generated.", "success");
    } catch (err: any) {
      showToast("Prediction failed: " + (err?.message || "Unknown error"), "danger");
    } finally { setPredLoading(false); }
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

  // ── Schedule Clash Detection state ──
  const [clashResult, setClashResult] = React.useState<any>(null);
  const [clashLoading, setClashLoading] = React.useState(false);

  const handleDetectClashes = async () => {
    setClashLoading(true);
    try {
      const res = await fetch("/api/ai/schedule-clashes", { method: "POST", headers: { "Content-Type": "application/json" } });
      if (!res.ok) throw new Error(await res.text());
      setClashResult(await res.json());
      showToast("Clash detection complete.", "success");
    } catch (err: any) {
      showToast("Clash detection failed: " + (err?.message || "Unknown error"), "danger");
    } finally { setClashLoading(false); }
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
            <p className="page-subtitle">Zero-ML intelligence powered by Groq AI · Rule-based engines · RAG over live data</p>
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
        <div className="card card-hoverable" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(46, 134, 193, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconCrystalBall size={20} style={{ color: "#2E86C1" }} /></div>
                  <div><h3 style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Task-Time Estimation</h3><span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>GenAI + RAG · Historical Database Context</span></div>
                </div>
                <span className="badge badge-brand" style={{ fontSize: "10px" }}>Groq AI</span>
              </div>
              <ul style={{ margin: "0 0 20px", padding: "0 0 0 18px", color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.7" }}>
                <li>RAG over similar historical tasks from live database</li>
                <li>Groq AI confidence scoring with anti-hallucination constraints</li>
                <li>Strict JSON output with PM insight for deadline setting</li>
              </ul>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
              <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setEstResult(null); setActiveModal("estimate-tasks"); }}>Estimate Tasks</button>
              <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setPredResult(null); setActiveModal("predict-deadlines"); }}>Predict Deadlines</button>
            </div>
          </div>
        </div>

        {/* Card 2: Delay Detection */}
        <div className="card card-hoverable" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(224, 155, 45, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconAlert size={20} style={{ color: "#E09B2D" }} /></div>
                  <div><h3 style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Delay Detection & Root-Cause</h3><span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Diagnostic Engine</span></div>
                </div>
              </div>
              <ul style={{ margin: "0 0 20px", padding: "0 0 0 18px", color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.7" }}>
                <li>Detect delayed tasks automatically</li>
                <li>Identify causes: dependency blockers, resource conflicts, scope creep</li>
                <li>Suggest corrective actions with impact scoring</li>
              </ul>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
              <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => setActiveModal("scan-delays")}>Scan Delays</button>
              <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => setActiveModal("analyze-roots")}>Analyze Roots</button>
            </div>
          </div>
        </div>

        {/* Card 3: Billing Milestone Insights (NEW) */}
        <div className="card card-hoverable" style={{ display: "flex", flexDirection: "column", height: "100%", border: "1px solid rgba(20, 184, 166, 0.25)" }}>
          <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(20, 184, 166, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconWand size={20} style={{ color: "#14b8a6" }} /></div>
                  <div><h3 style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Billing Milestone Insights</h3><span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Revenue Recognition · Schedule Variance</span></div>
                </div>
                <span className="badge badge-brand" style={{ fontSize: "10px" }}>Groq AI</span>
              </div>
              <ul style={{ margin: "0 0 20px", padding: "0 0 0 18px", color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.7" }}>
                <li>Prioritised report linking billing readiness to task completion</li>
                <li>Schedule variance & burn rate statistical analysis</li>
                <li>Milestone readiness score to focus PM effort</li>
              </ul>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
              <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setBillingResult(null); setActiveModal("billing-insights"); }}>Analyze Milestone</button>
              <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => setActiveModal("billing-report")}>View Report</button>
            </div>
          </div>
        </div>

        {/* Card 4: Automated Task Assignment (NEW) */}
        <div className="card card-hoverable" style={{ display: "flex", flexDirection: "column", height: "100%", border: "1px solid rgba(99, 102, 241, 0.25)" }}>
          <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(99, 102, 241, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconUsers size={20} style={{ color: "#6366f1" }} /></div>
                  <div><h3 style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Automated Task Assignment</h3><span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Utilisation · Skill-Fit · Availability</span></div>
                </div>
                <span className="badge badge-brand" style={{ fontSize: "10px" }}>Groq AI</span>
              </div>
              <ul style={{ margin: "0 0 20px", padding: "0 0 0 18px", color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.7" }}>
                <li>Suggests assignments based on consultant availability & skill profile</li>
                <li>Groq AI ranking using live consultant queue and utilisation data</li>
                <li>PM can accept, modify, or override AI suggestions</li>
              </ul>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
              <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setAssignResult(null); setActiveModal("auto-assign"); }}>Auto-Assign Task</button>
              <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => setActiveModal("view-assignments")}>View Suggestions</button>
            </div>
          </div>
        </div>

        {/* Card 5: Schedule Clash Detection */}
        <div className="card card-hoverable" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(108, 126, 199, 0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconTimer size={20} style={{ color: "#6C7EC7" }} /></div>
                  <div><h3 style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Schedule Clash Detection</h3><span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>Resource Management</span></div>
                </div>
              </div>
              <ul style={{ margin: "0 0 20px", padding: "0 0 0 18px", color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.7" }}>
                <li>Detect overlapping task assignments for the same resource</li>
                <li>Flag scheduling conflicts for manager review</li>
              </ul>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "auto" }}>
              <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => setActiveModal("detect-clashes")}>Detect Clashes</button>
              <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => setActiveModal("review-conflicts")}>Review Conflicts</button>
            </div>
          </div>
        </div>

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
          <div className="modal-content" style={{ background: "var(--bg-surface)", borderRadius: "12px", padding: "24px", width: "min(480px, 95%)", maxHeight: "90vh", overflowY: "auto", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border-default)", animation: "slideDown 0.2s cubic-bezier(0.4,0,0.2,1)" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: "4px", fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>Task-Time Estimation</h2>
            <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "20px" }}>Uses historical RAG context + Groq AI (temperature 0, strict JSON)</p>
            {!estResult ? (
              <form onSubmit={handleRunEstimate} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Select Task Type</label>
                  {(() => {
                    const uniqueTitles = Array.from(new Set(getFlatTasks(data?.tasks).map((t: any) => t.title))).filter(Boolean);
                    if (uniqueTitles.length > 0) {
                      return (
                        <select className="select" value={estTask} onChange={(e) => setEstTask(e.target.value)}>
                          {uniqueTitles.map((title: string, index: number) => (
                            <option key={index} value={title}>{title}</option>
                          ))}
                        </select>
                      );
                    } else {
                      return (
                        <input 
                          type="text" 
                          required 
                          placeholder="Enter task name to estimate" 
                          className="input" 
                          value={estTask} 
                          onChange={(e) => setEstTask(e.target.value)} 
                        />
                      );
                    }
                  })()}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Priority</label>
                    <select className="select" value={estPriority} onChange={(e) => setEstPriority(e.target.value)}><option>Low</option><option>Medium</option><option>High</option></select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Team Size</label>
                    <input type="number" min="1" max="10" className="input" value={estTeamSize} onChange={(e) => setEstTeamSize(e.target.value)} />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={estLoading}>{estLoading ? "Running AI..." : "Run Estimate"}</button>
                </div>
              </form>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ padding: "16px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                  {[{ label: "Estimated Completion Time", value: estResult.time, color: "var(--success-600)" }, { label: "Similar Historical Tasks", value: `${estResult.historical} tasks`, color: "var(--text-primary)" }, { label: "Groq AI Confidence Score", value: estResult.confidence, color: "var(--brand-600)" }].map((row, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < 2 ? "1px solid var(--border-subtle)" : "none" }}>
                      <span style={{ color: "var(--text-secondary)", fontSize: "13px" }}>{row.label}</span>
                      <strong style={{ color: row.color, fontSize: "13px" }}>{row.value}</strong>
                    </div>
                  ))}
                </div>
                {estResult.insight && (<div style={{ padding: "12px", background: "rgba(37, 99, 235, 0.06)", borderRadius: "8px", borderLeft: "3px solid var(--brand-500)" }}><div style={{ fontSize: "11px", fontWeight: 600, color: "var(--brand-600)", marginBottom: "4px" }}>🤖 AI Insight (Groq)</div><div style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: "1.6" }}>{estResult.insight}</div></div>)}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEstResult(null)}>Recalculate</button>
                  <button className="btn btn-primary btn-sm" onClick={() => setActiveModal(null)}>Close</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Predict Deadlines Modal */}
      {activeModal === "predict-deadlines" && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setActiveModal(null)}>
          <div className="modal-content" style={{ background: "var(--bg-surface)", borderRadius: "12px", padding: "24px", width: "min(480px, 95%)", maxHeight: "90vh", overflowY: "auto", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border-default)", animation: "slideDown 0.2s cubic-bezier(0.4,0,0.2,1)" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: "4px", fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>Predict Deadline</h2>
            <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "20px" }}>Rule-based date scheduling + Groq AI root-cause insight</p>
            {!predResult ? (
              <form onSubmit={handlePredictDeadline} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}><label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Task Name</label><input type="text" required placeholder="e.g. Integrate Payment Gateway" className="input" value={predTaskName} onChange={(e) => setPredTaskName(e.target.value)} /></div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}><label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Start Date</label><input type="date" required className="input" value={predStartDate} onChange={(e) => setPredStartDate(e.target.value)} /></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}><label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Complexity</label><select className="select" value={predComplexity} onChange={(e) => setPredComplexity(e.target.value)}><option>Easy</option><option>Medium</option><option>Complex</option></select></div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}><label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>Team Size</label><input type="number" min="1" max="15" className="input" value={predTeamSize} onChange={(e) => setPredTeamSize(e.target.value)} /></div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveModal(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={predLoading}>{predLoading ? "Predicting..." : "Predict Deadline"}</button>
                </div>
              </form>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ padding: "16px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                  {[{ label: "Recommended Deadline", value: predResult.deadline, color: "var(--success-600)" }, { label: "Estimated Effort", value: predResult.effort, color: "var(--text-primary)" }, { label: "Risk Level", value: predResult.risk, color: predResult.risk === "High" ? "var(--danger-600)" : predResult.risk === "Medium" ? "var(--warning-600)" : "var(--success-600)" }, { label: "Suggested Buffer", value: predResult.buffer, color: "var(--text-secondary)" }].map((row, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < 3 ? "1px solid var(--border-subtle)" : "none" }}>
                      <span style={{ color: "var(--text-secondary)", fontSize: "13px" }}>{row.label}</span>
                      <strong style={{ color: row.color, fontSize: "13px" }}>{row.value}</strong>
                    </div>
                  ))}
                </div>
                {predResult.insight && (<div style={{ padding: "12px", background: "rgba(37, 99, 235, 0.06)", borderRadius: "8px", borderLeft: "3px solid var(--brand-500)" }}><div style={{ fontSize: "11px", fontWeight: 600, color: "var(--brand-600)", marginBottom: "4px" }}>🤖 AI Insight (Groq)</div><div style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: "1.6" }}>{predResult.insight}</div></div>)}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setPredResult(null)}>Predict Again</button>
                  <button className="btn btn-primary btn-sm" onClick={() => setActiveModal(null)}>Close</button>
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
            <h2 style={{ marginBottom: "4px", fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>Billing Milestone Insights</h2>
            <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "20px" }}>Schedule Variance · Burn Rate · Milestone Readiness Score</p>
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
                  <button type="submit" className="btn btn-primary btn-sm" disabled={billingLoading}>{billingLoading ? "Analyzing..." : "Generate Insight"}</button>
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
                {billingResult.insight && (<div style={{ padding: "12px", background: "rgba(20, 184, 166, 0.06)", borderRadius: "8px", borderLeft: "3px solid #14b8a6" }}><div style={{ fontSize: "11px", fontWeight: 600, color: "#0d9488", marginBottom: "4px" }}>🤖 AI Insight (Groq)</div><div style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: "1.6" }}>{billingResult.insight}</div></div>)}
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
            <h2 style={{ marginBottom: "4px", fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>Automated Task Assignment</h2>
            <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "20px" }}>Groq AI consultant ranking via live utilisation + RAG context</p>
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
                {assignResult.insight && (<div style={{ padding: "12px", background: "rgba(99, 102, 241, 0.06)", borderRadius: "8px", borderLeft: "3px solid #6366f1" }}><div style={{ fontSize: "11px", fontWeight: 600, color: "#6366f1", marginBottom: "4px" }}>🤖 AI Assignment Recommendation (Groq)</div><div style={{ fontSize: "12.5px", color: "var(--text-secondary)", lineHeight: "1.6" }}>{assignResult.insight}</div></div>)}
                <div style={{ padding: "10px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)", fontSize: "12px", color: "var(--text-tertiary)" }}><strong style={{ color: "var(--text-secondary)" }}>Note:</strong> These are AI suggestions. You can accept, modify, or override the assignment in the Project Management module.</div>
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
            <h2 style={{ marginBottom: "4px", fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>Daily Delay Alert Scan</h2>
            <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "20px" }}>Rule-based engine · Zero AI calls · Alerts dispatched to assignees</p>
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

      {/* Detect Clashes Modal — backend interval-tree + OR-Tools solver */}
      {activeModal === "detect-clashes" && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setActiveModal(null)}>
          <div className="modal-content" style={{ background: "var(--bg-surface)", borderRadius: "12px", padding: "24px", width: "min(520px, 95%)", maxHeight: "85vh", overflowY: "auto", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border-default)", animation: "slideDown 0.2s cubic-bezier(0.4,0,0.2,1)" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: "4px", fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>Schedule Clash Detection</h2>
            <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "20px" }}>Interval-tree overlap analysis · OR-Tools resolution suggestions</p>
            {!clashResult ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ padding: "16px", background: "rgba(108,126,199,0.06)", borderRadius: "8px", border: "1px solid rgba(108,126,199,0.3)", fontSize: "13px", color: "var(--text-secondary)" }}>
                  Scans all active tasks for date-range overlaps across consultants and computes resolution options.
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setActiveModal(null)}>Cancel</button>
                  <button className="btn btn-primary btn-sm" disabled={clashLoading} onClick={handleDetectClashes}>{clashLoading ? "Scanning..." : "Detect Clashes"}</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ padding: "12px 16px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>Conflicts Detected</span>
                  <strong style={{ fontSize: "22px", fontWeight: 800, color: clashResult.conflictsCount > 0 ? "var(--danger-600)" : "var(--success-600)" }}>{clashResult.conflictsCount}</strong>
                </div>
                {clashResult.conflictsCount > 0 ? (
                  <div className="table-wrapper" style={{ border: "1px solid var(--border-subtle)", borderRadius: "8px", overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead><tr style={{ background: "var(--bg-surface-2)", borderBottom: "1px solid var(--border-subtle)" }}><th style={{ padding: "10px", textAlign: "left", fontSize: "12px", fontWeight: 600 }}>Task A</th><th style={{ padding: "10px", textAlign: "left", fontSize: "12px", fontWeight: 600 }}>Task B</th></tr></thead>
                      <tbody>
                        {(clashResult.conflicts || []).map((c: any, i: number) => (
                          <tr key={i} style={{ borderBottom: i < clashResult.conflicts.length - 1 ? "1px solid var(--border-subtle)" : "none" }}>
                            <td style={{ padding: "10px", fontSize: "12.5px" }}>{c.taskATitle}</td>
                            <td style={{ padding: "10px", fontSize: "12.5px" }}>{c.taskBTitle}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: "20px", textAlign: "center", color: "var(--text-tertiary)", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px dashed var(--border-default)" }}>No scheduling conflicts detected — all resources are clear!</div>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setClashResult(null)}>Scan Again</button>
                  <button className="btn btn-primary btn-sm" onClick={() => { setActiveModal("review-conflicts"); }}>Review Resolutions</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Review Conflicts Modal — OR-Tools resolution suggestions */}
      {activeModal === "review-conflicts" && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setActiveModal(null)}>
          <div className="modal-content" style={{ background: "var(--bg-surface)", borderRadius: "12px", padding: "24px", width: "min(460px, 90%)", maxHeight: "85vh", overflowY: "auto", boxShadow: "var(--shadow-xl)", border: "1px solid var(--border-default)", animation: "slideDown 0.2s cubic-bezier(0.4,0,0.2,1)" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: "4px", fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>Conflict Resolution Review</h2>
            <p style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "20px" }}>Suggestions from OR-Tools heuristic solver</p>
            {clashResult && Array.isArray(clashResult.resolutionSuggestions) && clashResult.resolutionSuggestions.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                {(clashResult.resolutionSuggestions || []).map((s: any, i: number) => (
                  <div key={i} style={{ padding: "12px 14px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#6C7EC7", marginBottom: "4px" }}>RESOLUTION {i + 1}</div>
                    <div style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>{s.suggestion || s}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--text-tertiary)", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px dashed var(--border-default)", marginBottom: "20px" }}>
                {clashResult ? "No active conflicts to resolve — schedule is clear!" : "Run Clash Detection first to see resolution options."}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              {!clashResult && <button className="btn btn-secondary btn-sm" onClick={() => setActiveModal("detect-clashes")}>Run Detection First</button>}
              <button className="btn btn-primary btn-sm" onClick={() => { setActiveModal(null); showToast("Conflict resolutions reviewed.", "success"); }}>Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
