"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, useTranslation } from "@/lib/store";
import {
  IconCpu,
  IconChart,
  IconReceipt,
  IconTrendingUp,
  IconUsers,
  IconCheckCircle,
  IconLeaf,
  IconLightbulb,
} from "@/components/ui/Icons";

// ── Mini Bar Chart ─────────────────────────────────────────────────────────────
function MiniBarChart({ data }: { data: { week: string; efficiency: number }[] }) {
  const max = 100;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "64px", marginTop: "8px" }}>
      {data.map((d) => (
        <div key={d.week} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
          <div
            style={{
              width: "100%",
              height: `${(d.efficiency / max) * 56}px`,
              background: "linear-gradient(180deg, #2563eb, #14b8a6)",
              borderRadius: "3px 3px 0 0",
              transition: "height 0.4s ease",
            }}
          />
          <span style={{ fontSize: "9px", color: "var(--text-tertiary)", fontWeight: 600 }}>{d.week}</span>
        </div>
      ))}
    </div>
  );
}

// ── Circular Score Widget ────────────────────────────────────────────────────
function CircleScore({ value, label, color }: { value: number | "N/A"; label: string; color: string }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = value === "N/A" ? 0 : (value / 100) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", minWidth: "40px", flex: 1 }}>
      <svg width="44" height="44" viewBox="0 0 60 60">
        <circle cx="30" cy="30" r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="5" />
        <circle
          cx="30" cy="30" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
        <text x="30" y="35" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--text-primary)">{value === "N/A" ? "N/A" : `${value}%`}</text>
      </svg>
      <span style={{ fontSize: "9px", color: "var(--text-tertiary)", fontWeight: 600, textAlign: "center", wordBreak: "break-word", overflowWrap: "anywhere" }}>{label}</span>
    </div>
  );
}

// ── Card 4: Carbon Footprint Tracker ──────────────────────────────────────────
function CarbonTrackerCard({ consultants, projects, rawExpenses }: { consultants: any[], projects: any[], rawExpenses: any[] }) {
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [clientOpen, setClientOpen] = useState(false);
  const [empOpen, setEmpOpen] = useState(false);

  const clientsList = useMemo(() => {
    return Array.from(new Set(projects?.map((p: any) => p.client))).filter(Boolean) as string[];
  }, [projects]);

  const employeesList = useMemo(() => {
    return Array.from(new Set(consultants?.map((c: any) => c.name))).filter(Boolean) as string[];
  }, [consultants]);

  const toggleClient = (client: string) => setSelectedClients(prev => prev.includes(client) ? prev.filter(c => c !== client) : [...prev, client]);
  const toggleEmployee = (emp: string) => setSelectedEmployees(prev => prev.includes(emp) ? prev.filter(e => e !== emp) : [...prev, emp]);

  const isClientFiltered = selectedClients.length > 0;
  const isEmpFiltered = selectedEmployees.length > 0;

  // Actual Travel Emissions Calculation
  const emissionFactors = useAppStore((state) => state.emissionFactors) || {
    Flight: 0.25,
    Train: 0.04,
    Car: 0.17,
    Bus: 0.08,
    Metro: 0.04,
    Cab: 0.20,
    Bike: 0.09,
    Auto: 0.12,
  };

  const modeIcons: Record<string, string> = {
    Flight: "✈️",
    Train: "🚆",
    Car: "🚗",
    Bus: "🚌",
    Metro: "🚇",
    Cab: "🚕",
    Bike: "🚲",
    Auto: "🛺",
  };

  const travelExpenses = (rawExpenses || []).filter(e => e.category === "Travel" || e.category === "Transport");

  const filteredTravelExpenses = travelExpenses.filter(e => {
    let keep = true;
    if (isClientFiltered) {
      const p = projects.find(proj => proj.id === e.project);
      if (!p || !selectedClients.includes(p.client)) keep = false;
    }
    if (isEmpFiltered) {
      const c = consultants.find(cons => cons.id === e.consultant);
      if (!c || !selectedEmployees.includes(c.name)) keep = false;
    }
    return keep;
  });

  const dates = travelExpenses.map(e => new Date(e.date).getTime()).filter(t => !isNaN(t));
  const referenceDate = dates.length > 0 ? new Date(Math.max(...dates)) : new Date();

  let currentTravelEmissions = 0;
  let previousTravelEmissions = 0;
  const emissionsByMode: Record<string, number> = {};

  filteredTravelExpenses.forEach(e => {
    if (!e.modeOfTransport || !e.calculatedDistance) return;
    const factor = emissionFactors[e.modeOfTransport] || 0;
    const emission = e.calculatedDistance * factor;

    const d = new Date(e.date);
    if (isNaN(d.getTime())) return;

    if (period === "monthly") {
      if (d.getFullYear() === referenceDate.getFullYear() && d.getMonth() === referenceDate.getMonth()) {
        currentTravelEmissions += emission;
        emissionsByMode[e.modeOfTransport] = (emissionsByMode[e.modeOfTransport] || 0) + emission;
      }
      const prevMonth = new Date(referenceDate);
      prevMonth.setMonth(prevMonth.getMonth() - 1);
      if (d.getFullYear() === prevMonth.getFullYear() && d.getMonth() === prevMonth.getMonth()) {
        previousTravelEmissions += emission;
      }
    } else {
      if (d.getFullYear() === referenceDate.getFullYear()) {
        currentTravelEmissions += emission;
        emissionsByMode[e.modeOfTransport] = (emissionsByMode[e.modeOfTransport] || 0) + emission;
      }
      if (d.getFullYear() === referenceDate.getFullYear() - 1) {
        previousTravelEmissions += emission;
      }
    }
  });

  const totalCo2 = Math.round(currentTravelEmissions);
  const prevTotalCo2 = Math.round(previousTravelEmissions);

  const activeEmpsCount = isEmpFiltered ? selectedEmployees.length : 0;
  const activeClientsCount = isClientFiltered ? selectedClients.length : 0;
  const activeCount = isEmpFiltered ? activeEmpsCount : (isClientFiltered ? consultants.length : consultants.length);
  const avgCo2 = Math.round(totalCo2 / (activeCount || 1));
  
  const trendRaw = prevTotalCo2 > 0 ? ((totalCo2 - prevTotalCo2) / prevTotalCo2) * 100 : (totalCo2 > 0 ? 100 : 0);
  const trend = parseFloat(trendRaw.toFixed(1));
  
  const breakdown = Object.entries(emissionsByMode)
    .sort((a, b) => b[1] - a[1])
    .map(([mode, val]) => ({
      name: `${mode} Travel`,
      sub: `${period === "monthly" ? "Monthly" : "Yearly"} usage log`,
      val: Math.round(val),
      icon: modeIcons[mode] || "🚗",
      target: val > 200 ? "over" : "under",
    }));

  if (breakdown.length === 0) {
    breakdown.push({ name: "No Travel Logged", sub: "0 distance recorded", val: 0, icon: "✨", target: "under" });
  }

  const highestMode = breakdown[0]?.val > 0 ? breakdown[0].name.split(" ")[0] : "travel";

  return (
    <div className="card card-hoverable" style={{ display: "flex", flexDirection: "column", minWidth: 0, overflow: "visible", boxSizing: "border-box", height: "800px" }}>
      <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, minHeight: 0 }}>
        {/* Card Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(16,185,129,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
             <IconLeaf size={20} style={{ color: "#10b981" }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--text-primary)", margin: 0, wordBreak: "break-word", overflowWrap: "break-word" }}>Carbon footprint tracker</h3>
            <span style={{ fontSize: "11px", color: "var(--text-tertiary)", wordBreak: "break-word", overflowWrap: "break-word" }}>Emissions reporting and sustainability insights</span>
          </div>
        </div>

        {/* Period Toggle */}
        <div style={{ display: "flex", background: "var(--bg-surface-2)", borderRadius: "999px", padding: "4px", marginBottom: "16px", width: "max-content" }}>
          <button
            onClick={() => setPeriod("monthly")}
            style={{ padding: "6px 14px", borderRadius: "999px", fontSize: "11px", fontWeight: 600, border: "none", cursor: "pointer", background: period === "monthly" ? "#2563eb" : "transparent", color: period === "monthly" ? "white" : "var(--text-secondary)", transition: "all 0.2s" }}
          >
            Monthly
          </button>
          <button
            onClick={() => setPeriod("yearly")}
            style={{ padding: "6px 14px", borderRadius: "999px", fontSize: "11px", fontWeight: 600, border: "none", cursor: "pointer", background: period === "yearly" ? "#2563eb" : "transparent", color: period === "yearly" ? "white" : "var(--text-secondary)", transition: "all 0.2s" }}
          >
            Yearly
          </button>
        </div>

        {/* Filters Row */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "16px", position: "relative", zIndex: 10 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "5px" }}>Select Clients</label>
            <div className="select" onClick={() => setClientOpen(!clientOpen)} style={{ fontSize: "12.5px", padding: "8px 10px", border: "1px solid var(--border-default)", borderRadius: "8px", cursor: "pointer", background: "var(--bg-surface)", minHeight: "36px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {selectedClients.length === 0 ? <span style={{ color: "var(--text-tertiary)" }}>All clients</span> : selectedClients.map(c => <span key={c} style={{ background: "var(--bg-surface-2)", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}>{c} <span style={{ cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); toggleClient(c); }}>×</span></span>)}
            </div>
            {clientOpen && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: "4px", background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: "200px", overflowY: "auto", zIndex: 20 }}>
                <div style={{ padding: "8px", display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)" }}>
                   <span style={{ fontSize: "10px", color: "#2563eb", cursor: "pointer", fontWeight: 600 }} onClick={() => setSelectedClients([...clientsList])}>Select All</span>
                   <span style={{ fontSize: "10px", color: "var(--text-tertiary)", cursor: "pointer", fontWeight: 600 }} onClick={() => setSelectedClients([])}>Clear</span>
                </div>
                {clientsList.map(c => <label key={c} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", cursor: "pointer", fontSize: "12px", color: "var(--text-primary)" }}><input type="checkbox" checked={selectedClients.includes(c)} onChange={() => toggleClient(c)} />{c}</label>)}
              </div>
            )}
          </div>

          <div style={{ flex: 1, position: "relative" }}>
            <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "5px" }}>Select Employees</label>
            <div className="select" onClick={() => setEmpOpen(!empOpen)} style={{ fontSize: "12.5px", padding: "8px 10px", border: "1px solid var(--border-default)", borderRadius: "8px", cursor: "pointer", background: "var(--bg-surface)", minHeight: "36px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {selectedEmployees.length === 0 ? <span style={{ color: "var(--text-tertiary)" }}>All employees</span> : selectedEmployees.map(e => <span key={e} style={{ background: "var(--bg-surface-2)", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}>{e} <span style={{ cursor: "pointer" }} onClick={(ev) => { ev.stopPropagation(); toggleEmployee(e); }}>×</span></span>)}
            </div>
            {empOpen && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: "4px", background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", maxHeight: "200px", overflowY: "auto", zIndex: 20 }}>
                <div style={{ padding: "8px", display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)" }}>
                   <span style={{ fontSize: "10px", color: "#2563eb", cursor: "pointer", fontWeight: 600 }} onClick={() => setSelectedEmployees([...employeesList])}>Select All</span>
                   <span style={{ fontSize: "10px", color: "var(--text-tertiary)", cursor: "pointer", fontWeight: 600 }} onClick={() => setSelectedEmployees([])}>Clear</span>
                </div>
                {employeesList.map(emp => <label key={emp} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", cursor: "pointer", fontSize: "12px", color: "var(--text-primary)" }}><input type="checkbox" checked={selectedEmployees.includes(emp)} onChange={() => toggleEmployee(emp)} />{emp}</label>)}
              </div>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px", marginBottom: "8px" }}>
          {[
            { label: "Total CO₂e", val: `${totalCo2.toLocaleString()} kg`, color: "var(--text-primary)" },
            { label: "Avg per employee", val: `${avgCo2.toLocaleString()} kg`, color: "var(--text-primary)" },
            { label: "Trend vs last period", val: `${trend > 0 ? "+" : ""}${trend}%`, color: trend > 0 ? "#e11d48" : (trend < 0 ? "#059669" : "var(--text-tertiary)") },
          ].map((k) => (
            <div key={k.label} style={{ background: "var(--bg-surface-2)", borderRadius: "10px", padding: "12px 6px", textAlign: "center", border: "1px solid var(--border-subtle)", minWidth: 0 }}>
              <div style={{ fontSize: "16px", fontWeight: 800, color: k.color, wordBreak: "break-word", overflowWrap: "anywhere" }}>{k.val}</div>
              <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "2px", fontWeight: 600, wordBreak: "break-word", overflowWrap: "anywhere" }}>{k.label}</div>
            </div>
          ))}
        </div>
        
        {(selectedClients.length > 0 || selectedEmployees.length > 0) ? (
          <div style={{ fontSize: "10px", color: "var(--text-tertiary)", textAlign: "center", marginBottom: "16px" }}>Showing combined total for {activeClientsCount} clients / {activeEmpsCount} employees</div>
        ) : (
          <div style={{ marginBottom: "16px" }} />
        )}

        {/* Emissions Breakdown */}
        <div style={{ marginBottom: "16px", flex: 1, minWidth: 0, overflowY: "auto", paddingRight: "4px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px" }}>Travel Emissions Breakdown by Mode</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {breakdown.map((b) => (
              <div key={b.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "8px", background: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: "18px", marginRight: "4px" }}>{b.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--text-primary)" }}>{b.name}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{b.sub}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>{b.val.toLocaleString()} kg</div>
                  <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 6px", borderRadius: "999px", background: b.target === "under" ? "rgba(5,150,105,0.1)" : "rgba(225,29,72,0.1)", color: b.target === "under" ? "#059669" : "#e11d48", display: "inline-block", marginTop: "2px" }}>
                    {b.target === "under" ? "Within Target" : "Over Target"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Insight Box */}
        <div style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "10px", padding: "12px 14px", marginTop: "auto" }}>
          <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#10b981", marginBottom: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
            <IconLightbulb size={12} /> AI Insight
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5, wordBreak: "break-word", overflowWrap: "break-word" }}>
            {trend > 0
              ? `Travel footprint ${selectedClients.length > 0 ? `across ${selectedClients.length} selected clients ` : ""}rose ${trend}% this ${period === "monthly" ? "month" : "year"}, driven primarily by ${highestMode}.`
              : `Travel footprint ${selectedClients.length > 0 ? `across ${selectedClients.length} selected clients ` : ""}dropped ${Math.abs(trend)}% this ${period === "monthly" ? "month" : "year"}, well within target.`
            }
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function TimesheetAIPage() {
  const router = typeof window !== "undefined" ? useRouter() : null;
  const data = useAppStore((state) => state.data);

  // Helper for flattening task states
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

  const showToast = useAppStore((state) => state.showToast);
  const { t } = useTranslation();
  const user = useAppStore((state) => state.user);

  useEffect(() => {
    if (user && (user.role === "accounts" || user.role === "client_contact")) {
      router?.replace("/dashboard");
    }
  }, [user, router]);

  if (user && (user.role === "accounts" || user.role === "client_contact")) {
    return null;
  }

  // 1. Dynamic Consultants mapping
  const consultants = useMemo(() => {
    if (!data.consultants || data.consultants.length === 0) return [];
    return data.consultants.map((c) => {
      const attendance = 100;
      const penaltyStr = typeof window !== 'undefined' ? sessionStorage.getItem(`efficiency_penalty_${c.name}`) : "0";
      const penalty = penaltyStr ? parseInt(penaltyStr, 10) : 0;
      const efficiency = Math.max(0, 90 - penalty);
      const score = Math.round((c.utilization + efficiency) / 2);
      return {
        id: c.id,
        name: c.name,
        utilisation: c.utilization,
        attendance,
        efficiency,
        score,
      };
    });
  }, [data.consultants]);

  // 2. Dynamic Expenses mapping
  const expenses = useMemo(() => {
    if (!data.expenses || data.expenses.length === 0) return [];
    return data.expenses.map((e, idx) => {
      const iconMap: Record<string, string> = {
        Travel: "✈️",
        Accommodation: "🏨",
        Transport: "🚗",
        Meals: "🍽️",
        Other: "📦",
      };
      const categoryMap: Record<string, string> = {
        Travel: "Billable",
        Accommodation: "Reimbursable",
        Meals: "Billable",
        Transport: "Billable",
        Other: "Non-Billable",
      };
      return {
        id: idx + 1,
        realId: e.id,
        type: e.description.replace(/^\[Policy:\s*[^\]]+\]\s*/i, ""),
        amount: e.amount,
        category: categoryMap[e.category] || "Billable",
        icon: iconMap[e.category] || "📄",
      };
    });
  }, [data.expenses]);

  // 3. Dynamic Efficiency Tasks mapping
  const efficiencyTasks = useMemo(() => {
    const allTasksList = [
      ...(data.tasks.todo || []),
      ...(data.tasks.inprogress || []),
      ...(data.tasks.review || []),
      ...(data.tasks.done || []),
    ];
    
    if (allTasksList.length === 0) return [];
    
    return allTasksList.map((t) => {
      let actualHours = 0;
      data.timesheets.forEach((ts) => {
        if (ts.entries && Array.isArray(ts.entries)) {
          ts.entries.forEach((entry: any) => {
            if (entry.project === t.project && (entry.task === t.id || entry.task === t.title)) {
              actualHours += entry.hours;
            }
          });
        }
      });
      
      const rawEstimate = typeof t.estimate === 'number' ? t.estimate : (t.estimate ? parseFloat(String(t.estimate).replace(/[^\d.-]/g, '')) : null);
      const planned = rawEstimate !== null && !isNaN(rawEstimate) ? rawEstimate : null;
      const actual = actualHours;
      const status = planned !== null && actual > planned ? "over" : "under";
      const projectName = data.projects?.find((p: any) => p.id === t.project)?.name || t.project;

      return {
        task: t.title,
        project: projectName,
        planned,
        actual,
        status,
      };
    });
  }, [data.tasks, data.timesheets]);

  // 4. Dynamic Weekly trend based on timesheets
  const weeklyTrend = useMemo(() => {
    if (!data.timesheets || data.timesheets.length === 0) {
      return [
        { week: "W1", efficiency: 0 },
        { week: "W2", efficiency: 0 },
        { week: "W3", efficiency: 0 },
        { week: "W4", efficiency: 0 },
      ];
    }
    const weeks = Array.from(new Set(data.timesheets.map((ts) => ts.week))).sort();
    return weeks.map((w, idx) => {
      return {
        week: `W${idx + 1}`,
        efficiency: 95, // default high efficiency target
      };
    });
  }, [data.timesheets]);

  // Card 1 state
  const [selectedTaskName, setSelectedTaskName] = useState<string | null>(null);

  const selectedTask = useMemo(() => {
    if (efficiencyTasks.length === 0) return null;
    if (selectedTaskName) {
      const found = efficiencyTasks.find(t => t.task === selectedTaskName);
      if (found) return found;
    }
    return efficiencyTasks[0];
  }, [efficiencyTasks, selectedTaskName]);

  // Card 2 state
  const [selectedConsultant, setSelectedConsultant] = useState<any>(null);
  const [selectedDashboardTask, setSelectedDashboardTask] = useState<string>("All Tasks");

  useEffect(() => {
    if (consultants.length > 0 && !selectedConsultant) {
      setSelectedConsultant(consultants[0]);
    }
  }, [consultants, selectedConsultant]);

  // Card 3 state
  const [selectedExpenses, setSelectedExpenses] = useState<number[]>([]);
  const [pushDone, setPushDone] = useState(false);
  const [isPushing, setIsPushing] = useState(false);

  useEffect(() => {
    if (expenses.length > 0 && selectedExpenses.length === 0) {
      setSelectedExpenses(expenses.slice(0, 3).map((e) => e.id));
    }
  }, [expenses]);

  const toggleExpense = (id: number) => {
    setPushDone(false);
    setSelectedExpenses((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handlePushToBilling = async () => {
    if (selectedExpenses.length === 0) {
      showToast("Please select at least one expense to push", "success");
      return;
    }
    setIsPushing(true);
    try {
      const realIds = selectedExpenses.map(id => expenses.find(e => e.id === id)?.realId).filter(Boolean);
      const res = await fetch("/api/ai/push-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenseIds: realIds }),
      });
      if (res.ok) {
        setIsPushing(false);
        setPushDone(true);
        showToast("Selected travel expenses successfully pushed to billing queue", "success");
        useAppStore.getState().fetchInitialData();
      } else {
        setIsPushing(false);
        showToast("Failed to push travel expenses to billing.", "danger");
      }
    } catch (err) {
      setIsPushing(false);
      showToast("Failed to push travel expenses to billing.", "danger");
    }
  };

  const efficiencyPct = selectedTask && selectedTask.planned !== null 
    ? Math.round((selectedTask.planned / selectedTask.actual) * 100)
    : null;
  const totalSelected = expenses.filter((e) => selectedExpenses.includes(e.id)).reduce((s, e) => s + e.amount, 0);

  const categoryColor: Record<string, string> = {
    Billable: "var(--success-600)",
    Reimbursable: "#2563eb",
    "Non-Billable": "var(--text-tertiary)",
  };
  const categoryBadge: Record<string, string> = {
    Billable: "badge-success",
    Reimbursable: "badge-brand",
    "Non-Billable": "badge-gray",
  };

  return (
    <div style={{ animation: "fadeIn 0.5s ease-out" }}>
      {/* Page Header */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #2563eb, #14b8a6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
            }}
          >
            <IconCpu size={22} />
          </div>
          <div>
            <h1 className="page-title">{t("AI Center")}</h1>
            <p className="page-subtitle">{t("Timesheet intelligence — efficiency, performance & expense automation")}</p>
          </div>
        </div>
      </div>

      {/* 4-Card Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gridAutoRows: "1fr", gap: "18px", marginTop: "8px" }}>

        {/* ── Card 1: Efficiency Tracking ────────────────────────────────────── */}
        <div className="card card-hoverable" style={{ display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden", boxSizing: "border-box", height: "800px" }}>
          <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, minHeight: 0 }}>

            {/* Card Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(46,134,193,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <IconTrendingUp size={20} style={{ color: "#2E86C1" }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--text-primary)", margin: 0, wordBreak: "break-word", overflowWrap: "break-word" }}>Efficiency Tracking Per Task</h3>
                <span style={{ fontSize: "11px", color: "var(--text-tertiary)", wordBreak: "break-word", overflowWrap: "break-word" }}>Planned vs Actual Hours Analysis</span>
              </div>
            </div>

            {/* KPI Row */}
            {selectedTask ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px", marginBottom: "18px" }}>
                  {[
                    { label: "Planned Hours", val: selectedTask.planned !== null ? `${selectedTask.planned}h` : "Not set", color: selectedTask.planned !== null ? "#2563eb" : "var(--text-tertiary)" },
                    { label: "Actual Hours",  val: `${selectedTask.actual}h`,  color: selectedTask.planned !== null && selectedTask.status === "over" ? "#e11d48" : "#059669" },
                    { label: "Efficiency",    val: efficiencyPct !== null ? (Number.isFinite(efficiencyPct) ? `${efficiencyPct}%` : "N/A") : "—",         color: efficiencyPct !== null && efficiencyPct >= 90 ? "#059669" : (efficiencyPct !== null && efficiencyPct >= 80 ? "#d97706" : (efficiencyPct !== null ? "#e11d48" : "var(--text-tertiary)")) },
                  ].map((k) => (
                    <div key={k.label} style={{ background: "var(--bg-surface-2)", borderRadius: "10px", padding: "12px 6px", textAlign: "center", border: "1px solid var(--border-subtle)", minWidth: 0 }}>
                      <div style={{ fontSize: "18px", fontWeight: 800, color: k.color, wordBreak: "break-word", overflowWrap: "anywhere" }}>{k.val}</div>
                      <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "2px", fontWeight: 600, wordBreak: "break-word", overflowWrap: "anywhere" }}>{k.label}</div>
                    </div>
                  ))}
                </div>

                {/* Task selector */}
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "5px" }}>Select Task</label>
                  <select
                    className="select"
                    value={selectedTask.task}
                    onChange={(e) => setSelectedTaskName(e.target.value)}
                    style={{ width: "100%", fontSize: "12.5px" }}
                  >
                    {efficiencyTasks.map((t, i) => (
                      <option key={`${t.task}-${t.project}-${i}`} value={t.task}>{t.task} ({t.project})</option>
                    ))}
                  </select>
                </div>



                {/* Task list — over / under */}
                <div style={{ marginBottom: "16px", flex: 1, overflowY: "auto", minHeight: 0, paddingRight: "4px" }}>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "8px", fontSize: "10.5px", fontWeight: 600, color: "var(--text-tertiary)" }}>
                    <span style={{ color: "#e11d48" }}>● Over Budget</span>
                    <span style={{ color: "#059669" }}>● Under Budget</span>
                  </div>
                  {efficiencyTasks.map((t, i) => (
                    <div
                      key={`${t.task}-${t.project}-${i}`}
                      onClick={() => setSelectedTaskName(t.task)}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px",
                        padding: "8px 10px", borderRadius: "7px", marginBottom: "5px",
                        cursor: "pointer",
                        background: selectedTask.task === t.task ? "var(--bg-surface-2)" : "transparent",
                        border: `1px solid ${selectedTask.task === t.task ? "var(--border-default)" : "transparent"}`,
                        transition: "all 0.15s",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", wordBreak: "break-word", overflowWrap: "break-word" }}>{t.task}</div>
                        <div style={{ fontSize: "10.5px", color: "var(--text-tertiary)", wordBreak: "break-word", overflowWrap: "break-word" }}>{t.project} · Planned {t.planned !== null ? `${t.planned}h` : 'Not set'} · Actual {t.actual}h</div>
                      </div>
                      <span style={{
                        fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px",
                        background: t.planned !== null && t.status === "over" ? "rgba(225,29,72,0.1)" : "rgba(5,150,105,0.1)",
                        color: t.planned !== null && t.status === "over" ? "#e11d48" : "#059669",
                        flexShrink: 0,
                      }}>
                        {t.planned === null ? "—" : (t.status === "over" ? `+${Number((t.actual - t.planned).toFixed(2))}h` : `-${Number((t.planned - t.actual).toFixed(2))}h`)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* AI Insight */}
                <div style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "10px", padding: "12px 14px", marginTop: "auto" }}>
                  <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#10b981", marginBottom: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <IconLightbulb size={12} /> AI Insight
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5, wordBreak: "break-word", overflowWrap: "break-word" }}>
                    {selectedTask.planned === null 
                      ? `"${selectedTask.task}" does not have a planned estimate. Update the task estimate in the Project Management module to receive AI recommendations on resource allocation.`
                      : (selectedTask.status === "over"
                          ? `"${selectedTask.task}" exceeded expected duration by ${selectedTask.planned > 0 ? Math.round(((selectedTask.actual - selectedTask.planned) / selectedTask.planned) * 100) : 0}%. Consider allocating additional resources or breaking this task into smaller sub-tasks.`
                          : `"${selectedTask.task}" completed ahead of schedule or is tracking well. Capacity freed can be reallocated to at-risk tasks in the current sprint.`)}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)", fontSize: "13px", marginTop: "auto", marginBottom: "auto" }}>
                No active tasks found in the system. Create a project and assign tasks to enable efficiency tracking.
              </div>
            )}

          </div>
        </div>

        {/* ── Card 2: Performance Metrics Dashboard ──────────────────────────── */}
        <div className="card card-hoverable" style={{ display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden", boxSizing: "border-box", height: "800px" }}>
          <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, minHeight: 0 }}>

            {/* Card Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(26,188,156,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <IconUsers size={20} style={{ color: "#1ABC9C" }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--text-primary)", margin: 0, wordBreak: "break-word", overflowWrap: "break-word" }}>Performance Metrics Dashboard</h3>
                <span style={{ fontSize: "11px", color: "var(--text-tertiary)", wordBreak: "break-word", overflowWrap: "break-word" }}>Consultant KPIs &amp; Productivity Trends</span>
              </div>
            </div>

            {selectedConsultant ? (
              <>
                {/* Utilization Metric Calculation - Scoped exclusively to the Performance Metrics Dashboard card */}
                {(() => {
                  const userTimesheets = data.timesheets ? data.timesheets.filter((ts: any) => ts.consultant === selectedConsultant.id) : [];
                  
                  // Step 1 - Aggregate Logged Hours
                  let totalHours = 0;
                  userTimesheets.forEach((ts: any) => {
                    if (ts.entries && Array.isArray(ts.entries)) {
                      ts.entries.forEach((entry: any) => {
                        let matchesTask = false;
                        if (selectedDashboardTask !== "All Tasks") {
                          const taskObj = getFlatTasksLocal(data.tasks).find((t: any) => t.id === selectedDashboardTask);
                          matchesTask = taskObj ? (entry.task === taskObj.title || entry.task === taskObj.id) : (entry.task === selectedDashboardTask);
                          if (!matchesTask && entry.project !== selectedDashboardTask && entry.projectId !== selectedDashboardTask) return;
                        }
                        if (entry.punchInTime && entry.punchOutTime) {
                          const inTime = new Date(entry.punchInTime).getTime();
                          const outTime = new Date(entry.punchOutTime).getTime();
                          if (!isNaN(inTime) && !isNaN(outTime) && outTime >= inTime) {
                            totalHours += (outTime - inTime) / (1000 * 60 * 60);
                          }
                        }
                      });
                    }
                  });
                  
                  // Step 2 - Calculate Capacity
                  const capacity = userTimesheets.length * 40;
                  
                  // Step 3 & 4 - Compute Utilization Percentage, Round and Cap
                  let calculatedUtilization: number | "N/A" = "N/A";
                  if (userTimesheets.length > 0 && capacity > 0) {
                    const utilPct = (totalHours / capacity) * 100;
                    calculatedUtilization = Math.min(100, Math.round(utilPct));
                  }

                  // --- Attendance Metric Calculation - Scoped exclusively to the Performance Metrics Dashboard card ---
                  let calculatedAttendance: number | "N/A" = "N/A";
                  
                  const today = new Date();
                  const year = today.getFullYear();
                  const month = today.getMonth();
                  const currentDateInt = today.getDate();
                  
                  let totalWorkingDays = 0;
                  let presentDays = 0;
                  
                  for (let d = 1; d <= currentDateInt; d++) {
                    const date = new Date(year, month, d);
                    const dayOfWeek = date.getDay();
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                    
                    if (!isWeekend) {
                      totalWorkingDays++;
                      
                      const targetDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                      let totalHours = 0;
                      
                      userTimesheets.forEach((ts: any) => {
                        ts.entries?.forEach((e: any) => {
                          if (e.punchInTime) {
                            const pDate = new Date(e.punchInTime);
                            const pStr = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}-${String(pDate.getDate()).padStart(2, '0')}`;
                            if (pStr === targetDateStr) {
                              totalHours += (e.hours || 0);
                            }
                          } else {
                            // Manual entry
                            const weekStart = new Date(ts.week);
                            weekStart.setDate(weekStart.getDate() + (e.day || 0));
                            const wStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
                            if (wStr === targetDateStr) {
                              totalHours += (e.hours || 0);
                            }
                          }
                        });
                      });
                      if (totalHours >= 8) {
                        presentDays += 1;
                      } else if (totalHours > 5) {
                        presentDays += 0.5;
                      }
                    }
                  }

                  if (totalWorkingDays > 0) {
                    const attPct = (presentDays / totalWorkingDays) * 100;
                    calculatedAttendance = Math.min(100, Math.round(attPct));
                  } else {
                    calculatedAttendance = 0;
                  }
                  // ----------------------------------------------------------------------------------------------------

                  // --- Efficiency Metric Calculation - Scoped exclusively to the Performance Metrics Dashboard card ---
                  let calculatedEfficiency: number | "N/A" = "N/A";
                  if (selectedConsultant && data.tasks) {
                    // const getFlatTasksLocal = ... (hoisted)
                    const allTasks = getFlatTasksLocal(data.tasks);
                    let totalPlannedHours = 0;
                    let totalActualHours = 0;

                    allTasks.forEach((task: any) => {
                      if (selectedDashboardTask !== "All Tasks" && task.title !== selectedDashboardTask && task.id !== selectedDashboardTask) return;
                      let isAssigned = false;
                      let assignedUsersArray: any[] = [];
                      
                      if (task.assignedUsers && Array.isArray(task.assignedUsers)) {
                        assignedUsersArray = task.assignedUsers;
                        isAssigned = assignedUsersArray.some((u: any) => u.userId === selectedConsultant.id || u.name === selectedConsultant.name);
                      } else if (Array.isArray(task.assignee)) {
                        isAssigned = task.assignee.includes(selectedConsultant.id) || task.assignee.includes(selectedConsultant.name);
                      } else if (typeof task.assignee === 'string') {
                        isAssigned = task.assignee === selectedConsultant.id || task.assignee === selectedConsultant.name || task.assignee.includes(selectedConsultant.name);
                      }
                      if (task.assigneeId && selectedConsultant.id && task.assigneeId === selectedConsultant.id) {
                        isAssigned = true;
                      }

                      if (isAssigned) {
                        let plannedHours = 0;
                        if (assignedUsersArray.length > 0) {
                          const userAssignment = assignedUsersArray.find((u: any) => u.userId === selectedConsultant.id || u.name === selectedConsultant.name);
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
                        userTimesheets.forEach((ts: any) => {
                          if (ts.entries && Array.isArray(ts.entries)) {
                            ts.entries.forEach((entry: any) => {
                              if (entry.task === task.title || entry.task === task.id) {
                                if (entry.punchInTime && entry.punchOutTime) {
                                  const inTime = new Date(entry.punchInTime).getTime();
                                  const outTime = new Date(entry.punchOutTime).getTime();
                                  if (!isNaN(inTime) && !isNaN(outTime) && outTime >= inTime) {
                                    actualHours += (outTime - inTime) / (1000 * 60 * 60);
                                  }
                                }
                              }
                            });
                          }
                        });

                        totalPlannedHours += plannedHours;
                        totalActualHours += actualHours;
                      }
                    });

                    if (totalActualHours > 0 && totalPlannedHours > 0) {
                      calculatedEfficiency = Math.round((totalPlannedHours / totalActualHours) * 100);
                    }
                  }

                  // --- Productivity Metric Calculation ---
                  let calculatedProductivity: number | "N/A" = "N/A";
                  if (typeof calculatedUtilization === "number" && typeof calculatedEfficiency === "number") {
                    calculatedProductivity = Math.round((calculatedUtilization + calculatedEfficiency) / 2);
                  } else if (typeof calculatedUtilization === "number") {
                    calculatedProductivity = calculatedUtilization;
                  } else if (typeof calculatedEfficiency === "number") {
                    calculatedProductivity = calculatedEfficiency;
                  }
                  // ----------------------------------------------------------------------------------------------------
                  
                  return (
                    <>
                      {/* Consultant selector */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "5px" }}>Select User</label>
                  <select
                    className="select"
                    value={selectedConsultant.name}
                    onChange={(e) => {
                      setSelectedConsultant(consultants.find((c) => c.name === e.target.value) ?? consultants[0]);
                      setSelectedDashboardTask("All Tasks");
                    }}
                    style={{ width: "100%", fontSize: "12.5px" }}
                  >
                    {consultants.map((c) => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Task selector */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "5px" }}>Select Task</label>
                  <select
                    className="select"
                    value={selectedDashboardTask}
                    onChange={(e) => setSelectedDashboardTask(e.target.value)}
                    style={{ width: "100%", fontSize: "12.5px" }}
                  >
                    <option value="All Tasks">All Assigned Tasks</option>
                    {(() => {
                      // const getFlatTasksLocal = ... (hoisted)
                      return getFlatTasksLocal(data.tasks).filter((task: any) => {
                        let isAssigned = false;
                        if (task.assignedUsers && Array.isArray(task.assignedUsers)) {
                          isAssigned = task.assignedUsers.some((u: any) => u.userId === selectedConsultant.id || u.name === selectedConsultant.name);
                        } else if (Array.isArray(task.assignee)) {
                          isAssigned = task.assignee.includes(selectedConsultant.id) || task.assignee.includes(selectedConsultant.name);
                        } else if (typeof task.assignee === 'string') {
                          isAssigned = task.assignee === selectedConsultant.id || task.assignee === selectedConsultant.name || task.assignee.includes(selectedConsultant.name);
                        }
                        if (task.assigneeId && selectedConsultant.id && task.assigneeId === selectedConsultant.id) {
                          isAssigned = true;
                        }
                        return isAssigned;
                      }).map((t: any, i: number) => (
                        <option key={`${t.id}-${i}`} value={t.title}>{t.title} ({t.project})</option>
                      ));
                    })()}
                  </select>
                </div>

                {/* Circle KPIs */}
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "nowrap", gap: "4px", padding: "12px 6px", marginBottom: "16px", background: "var(--bg-surface-2)", borderRadius: "12px", border: "1px solid var(--border-subtle)" }}>
                  {/* Utilization Metric - Scoped exclusively to the Performance Metrics Dashboard card */}
                  {(() => {
                    const r = 22;
                    const circ = 2 * Math.PI * r;
                    const dash = calculatedUtilization === "N/A" ? 0 : ((calculatedUtilization as number) / 100) * circ;
                    return (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", minWidth: "40px", flex: 1 }}>
                        <svg width="44" height="44" viewBox="0 0 60 60">
                          <circle cx="30" cy="30" r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="5" />
                          <circle
                            cx="30" cy="30" r={r} fill="none" stroke="#2563eb" strokeWidth="5"
                            strokeDasharray={`${dash} ${circ - dash}`}
                            strokeDashoffset={circ / 4}
                            strokeLinecap="round"
                            style={{ transition: "stroke-dasharray 0.6s ease" }}
                          />
                          <text x="30" y="35" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--text-primary)">
                            {calculatedUtilization === "N/A" ? "N/A" : `${calculatedUtilization}%`}
                          </text>
                        </svg>
                        <span style={{ fontSize: "9px", color: "var(--text-tertiary)", fontWeight: 600, textAlign: "center", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                          Utilisation
                        </span>
                      </div>
                    );
                  })()}
                  <CircleScore value={calculatedAttendance}           label="Attendance"    color="#059669" />
                  <CircleScore value={calculatedEfficiency}           label="Efficiency"    color="#1ABC9C" />
                  <CircleScore value={calculatedProductivity}         label="Productivity"  color="#d97706" />
                </div>

                {/* Consultant comparison table */}
                <div style={{ marginBottom: "16px", flex: 1, minWidth: 0, overflowY: "auto", paddingRight: "4px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px" }}>Team Comparison</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    {consultants.map((c) => {
                      const userTimesheets = data.timesheets ? data.timesheets.filter((ts: any) => ts.consultant === c.id) : [];
                      let totalHours = 0;
                      userTimesheets.forEach((ts: any) => {
                        if (ts.entries && Array.isArray(ts.entries)) {
                          ts.entries.forEach((entry: any) => {
                            let matchesTask = false;
                            if (selectedDashboardTask !== "All Tasks") {
                              const taskObj = getFlatTasksLocal(data.tasks).find((t: any) => t.id === selectedDashboardTask);
                              matchesTask = taskObj ? (entry.task === taskObj.title || entry.task === taskObj.id) : (entry.task === selectedDashboardTask);
                              if (!matchesTask && entry.project !== selectedDashboardTask && entry.projectId !== selectedDashboardTask) return;
                            }
                            if (entry.punchInTime && entry.punchOutTime) {
                              const inTime = new Date(entry.punchInTime).getTime();
                              const outTime = new Date(entry.punchOutTime).getTime();
                              if (!isNaN(inTime) && !isNaN(outTime) && outTime >= inTime) {
                                totalHours += (outTime - inTime) / (1000 * 60 * 60);
                              }
                            }
                          });
                        }
                      });
                      const capacity = userTimesheets.length * 40;
                      let rowUtil: number | "N/A" = "N/A";
                      if (userTimesheets.length > 0 && capacity > 0) {
                        rowUtil = Math.min(100, Math.round((totalHours / capacity) * 100));
                      }

                      let rowEff: number | "N/A" = "N/A";
                      if (data.tasks) {
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
                        const allTasks = getFlatTasksLocal(data.tasks);
                        let totalPlannedHours = 0;
                        let totalActualHours = 0;

                        allTasks.forEach((task: any) => {
                          if (selectedDashboardTask !== "All Tasks" && task.title !== selectedDashboardTask && task.id !== selectedDashboardTask) return;
                          let isAssigned = false;
                          let assignedUsersArray: any[] = [];
                          
                          if (task.assignedUsers && Array.isArray(task.assignedUsers)) {
                            assignedUsersArray = task.assignedUsers;
                            isAssigned = assignedUsersArray.some((u: any) => u.userId === c.id || u.name === c.name);
                          } else if (Array.isArray(task.assignee)) {
                            isAssigned = task.assignee.includes(c.id) || task.assignee.includes(c.name);
                          } else if (typeof task.assignee === 'string') {
                            isAssigned = task.assignee === c.id || task.assignee === c.name || task.assignee.includes(c.name);
                          }
                          if (task.assigneeId && c.id && task.assigneeId === c.id) {
                            isAssigned = true;
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
                            userTimesheets.forEach((ts: any) => {
                              if (ts.entries && Array.isArray(ts.entries)) {
                                ts.entries.forEach((entry: any) => {
                                  if (entry.task === task.title || entry.task === task.id) {
                                    if (entry.punchInTime && entry.punchOutTime) {
                                      const inTime = new Date(entry.punchInTime).getTime();
                                      const outTime = new Date(entry.punchOutTime).getTime();
                                      if (!isNaN(inTime) && !isNaN(outTime) && outTime >= inTime) {
                                        actualHours += (outTime - inTime) / (1000 * 60 * 60);
                                      }
                                    }
                                  }
                                });
                              }
                            });

                            totalPlannedHours += plannedHours;
                            totalActualHours += actualHours;
                          }
                        });

                        if (totalActualHours > 0 && totalPlannedHours > 0) {
                          rowEff = Math.round((totalPlannedHours / totalActualHours) * 100);
                        }
                      }

                      let rowProd: number | "N/A" = "N/A";
                      if (typeof rowUtil === "number" && typeof rowEff === "number") {
                        rowProd = Math.round((rowUtil + rowEff) / 2);
                      } else if (typeof rowUtil === "number") {
                        rowProd = rowUtil;
                      } else if (typeof rowEff === "number") {
                        rowProd = rowEff;
                      }
                      
                      return (
                        <div
                          key={c.name}
                          onClick={() => setSelectedConsultant(c)}
                          style={{
                            display: "flex", alignItems: "center", gap: "10px",
                            padding: "8px 10px", borderRadius: "8px", cursor: "pointer",
                            background: selectedConsultant.name === c.name ? "var(--bg-surface-2)" : "transparent",
                            border: `1px solid ${selectedConsultant.name === c.name ? "var(--border-default)" : "transparent"}`,
                            transition: "all 0.15s",
                          }}
                        >
                          <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "linear-gradient(135deg,#2563eb,#1ABC9C)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, color: "white", flexShrink: 0 }}>
                            {c.name.split(" ").map((n: string) => n[0]).join("")}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", wordBreak: "break-word", overflowWrap: "break-word" }}>{c.name}</div>
                            <div style={{ height: "4px", background: "var(--border-subtle)", borderRadius: "2px", marginTop: "4px" }}>
                              <div style={{ height: "100%", width: rowProd === "N/A" ? "0%" : `${rowProd}%`, background: "linear-gradient(90deg,#2563eb,#1ABC9C)", borderRadius: "2px", transition: "width 0.4s" }} />
                            </div>
                          </div>
                          <span style={{ fontSize: "12px", fontWeight: 700, color: rowProd === "N/A" ? "var(--text-tertiary)" : (rowProd >= 90 ? "#059669" : rowProd >= 80 ? "#d97706" : "#e11d48"), minWidth: "36px", textAlign: "right", flexShrink: 0 }}>{rowProd === "N/A" ? "N/A" : `${rowProd}%`}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* AI Insight Panel */}
                <div style={{ background: "rgba(26,188,156,0.07)", border: "1px solid rgba(26,188,156,0.2)", borderRadius: "10px", padding: "12px 14px", marginTop: "auto" }}>
                  <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#1ABC9C", marginBottom: "4px" }}>💡 AI Insight</div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5, wordBreak: "break-word", overflowWrap: "break-word" }}>
                    "{selectedConsultant.name}" utilization is <strong style={{ color: "var(--text-primary)" }}>{calculatedUtilization === "N/A" ? "N/A" : `${calculatedUtilization}%`}</strong>
                    {calculatedUtilization === "N/A" 
                      ? " — no timesheet data available. Ensure the consultant has logged their hours."
                      : (calculatedUtilization as number) > 85
                      ? " — approaching over-allocation. Consider redistributing tasks to balance workload across the team."
                      : (calculatedUtilization as number) < 75
                      ? " — below target. Review task assignment to improve billable hours ratio this month."
                      : " — within healthy range. Monitor weekly to maintain consistent productivity levels."}
                  </div>
                </div>
                    </>
                  );
                })()}
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)", fontSize: "13px", marginTop: "auto", marginBottom: "auto" }}>
                No active consultants or team members found in the system. Add users to enable performance dashboard.
              </div>
            )}

          </div>
        </div>

        {/* ── Card 3: Expense Monitoring Panel ─────────────────────── */}
        <div className="card card-hoverable" style={{ display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden", boxSizing: "border-box", height: "800px" }}>
          <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, minHeight: 0 }}>

            {/* Card Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(217,119,6,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <IconReceipt size={20} style={{ color: "#D97706" }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--text-primary)", margin: 0, wordBreak: "break-word", overflowWrap: "break-word" }}>Expense Claim Monitor</h3>
                <span style={{ fontSize: "11px", color: "var(--text-tertiary)", wordBreak: "break-word", overflowWrap: "break-word" }}>Real-time submitted expense processing</span>
              </div>
            </div>

            {data.expenses && data.expenses.length > 0 ? (
              <>
                {/* Summary badges */}
                <div style={{ display: "flex", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
                  <span className="badge badge-brand" style={{ wordBreak: "break-word", overflowWrap: "break-word" }}>Total: {data.expenses.length}</span>
                  <span className="badge badge-success" style={{ wordBreak: "break-word", overflowWrap: "break-word" }}>Approved: {data.expenses.filter((e: any) => e.status === "approved").length}</span>
                  <span className="badge badge-danger" style={{ wordBreak: "break-word", overflowWrap: "break-word" }}>Rejected: {data.expenses.filter((e: any) => e.status === "rejected").length}</span>
                  <span className="badge badge-warning" style={{ wordBreak: "break-word", overflowWrap: "break-word" }}>Pending: {data.expenses.filter((e: any) => e.status === "pending").length}</span>
                </div>

                {/* Expense table */}
                <div style={{ flex: 1, marginBottom: "16px", minWidth: 0, overflowY: "auto", paddingRight: "4px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px" }}>All Submitted Expenses</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {data.expenses.map((exp: any) => {
                      const empName = consultants.find((c: any) => c.id === exp.consultant)?.name || exp.consultant;
                      const projName = data.projects?.find((p: any) => p.id === exp.project)?.client || exp.project;
                      
                      const iconMap: Record<string, string> = { Travel: "✈️", Accommodation: "🏨", Transport: "🚗", Meals: "🍽️", Other: "📦" };
                      const expIcon = iconMap[exp.category] || "📄";

                      return (
                        <div
                          key={exp.id}
                          style={{
                            display: "flex", alignItems: "flex-start", gap: "10px",
                            padding: "10px 12px", borderRadius: "8px",
                            background: "var(--bg-surface-2)",
                            border: "1px solid var(--border-subtle)",
                          }}
                        >
                          <span style={{ fontSize: "18px", flexShrink: 0, marginTop: "2px" }}>{expIcon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginBottom: "4px" }}>
                              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", wordBreak: "break-word", overflowWrap: "break-word" }}>
                                {exp.description.replace(/^\[Policy:\s*[^\]]+\]\s*/i, "")}
                              </div>
                              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", flexShrink: 0 }}>
                                ₹{exp.amount.toLocaleString("en-IN")}
                              </div>
                            </div>
                            
                            <div style={{ fontSize: "11.5px", color: "var(--text-secondary)", marginBottom: "6px" }}>
                              {empName} • {projName} • {new Date(exp.date).toLocaleDateString()}
                            </div>

                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                              <span className="badge badge-gray" style={{ fontSize: "9px" }}>{exp.category}</span>
                              {(exp.category === "Travel" || exp.category === "Transport") && exp.modeOfTransport && (
                                <span className="badge badge-gray" style={{ fontSize: "9px" }}>{exp.modeOfTransport}</span>
                              )}
                              {(exp.category === "Travel" || exp.category === "Transport") && exp.calculatedDistance && (
                                <span className="badge badge-gray" style={{ fontSize: "9px" }}>{exp.calculatedDistance} km</span>
                              )}
                              
                              <span className={`badge ${
                                exp.status === "approved" ? "badge-success" : 
                                exp.status === "rejected" ? "badge-danger" : 
                                "badge-warning"
                              }`} style={{ fontSize: "9.5px", marginLeft: "auto" }}>
                                {exp.status === "approved" ? "Approved" : 
                                 exp.status === "rejected" ? "Rejected" : 
                                 "Pending Manual Review"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* AI Insight Panel */}
                <div style={{ background: "rgba(26,188,156,0.07)", border: "1px solid rgba(26,188,156,0.2)", borderRadius: "10px", padding: "12px 14px", marginTop: "auto", flexShrink: 0 }}>
                  <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#1ABC9C", marginBottom: "4px" }}>💡 AI Insight</div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5, wordBreak: "break-word", overflowWrap: "break-word" }}>
                    {(() => {
                      const approved = data.expenses.filter((e: any) => e.status === "approved").length;
                      const rejected = data.expenses.filter((e: any) => e.status === "rejected").length;
                      const pending = data.expenses.filter((e: any) => e.status === "pending").length;
                      
                      let insights = [];
                      if (approved > 0) insights.push(`${approved} expenses have been approved automatically.`);
                      if (pending > 0) insights.push(`${pending} expenses require manual review due to policy validation.`);
                      if (rejected > 0) insights.push(`${rejected} expenses have been rejected because they failed validation rules.`);
                      
                      if (insights.length === 0) return "No expense activity insights available.";
                      return insights.join(" ");
                    })()}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)", fontSize: "13px", marginTop: "auto", marginBottom: "auto" }}>
                No expenses found in the system. Submit expenses in the Expenses page to populate this monitor.
              </div>
            )}

          </div>
        </div>

        <CarbonTrackerCard consultants={consultants} projects={data.projects || []} rawExpenses={data.expenses || []} />

      </div>
    </div>
  );
}
