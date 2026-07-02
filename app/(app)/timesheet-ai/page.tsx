"use client";

import React, { useState, useMemo, useEffect } from "react";
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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", minWidth: "50px" }}>
      <svg width="52" height="52" viewBox="0 0 60 60">
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
      <span style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 600, textAlign: "center", wordBreak: "break-word", overflowWrap: "anywhere" }}>{label}</span>
    </div>
  );
}

// ── Card 4: Carbon Footprint Tracker ──────────────────────────────────────────
function CarbonTrackerCard({ consultants, projects }: { consultants: any[], projects: any[] }) {
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [clientOpen, setClientOpen] = useState(false);
  const [empOpen, setEmpOpen] = useState(false);

  const clientsList = useMemo(() => {
    const list = Array.from(new Set(projects?.map((p: any) => p.client))).filter(Boolean) as string[];
    // Pad with dummy clients if needed so partial selection is testable
    if (list.length === 0) list.push("Acme Corp", "Globex Inc", "Soylent Corp");
    else if (list.length === 1) list.push("Globex Inc", "Soylent Corp");
    else if (list.length === 2) list.push("Soylent Corp");
    return list;
  }, [projects]);

  const employeesList = useMemo(() => {
    const list = Array.from(new Set(consultants?.map((c: any) => c.name))).filter(Boolean) as string[];
    // Pad with dummy employees if needed
    if (list.length === 0) list.push("Alice Smith", "Bob Jones", "Charlie Brown");
    else if (list.length === 1) list.push("Bob Jones", "Charlie Brown");
    else if (list.length === 2) list.push("Charlie Brown");
    return list;
  }, [consultants]);

  // Generate deterministic dummy data keyed by name
  const dummyData = useMemo(() => {
    const data: Record<string, { travel: number, office: number, remote: number, digital: number }> = {};
    clientsList.forEach((c, i) => {
      // Much larger variance so changes are VERY visible
      data[`client_${c}`] = { travel: 500 + i * 400, office: 300 + i * 200, remote: 100 + i * 50, digital: 50 + i * 25 };
    });
    employeesList.forEach((e, i) => {
      data[`emp_${e}`] = { travel: 50 + i * 30, office: 30 + i * 15, remote: 40 + i * 20, digital: 15 + i * 5 };
    });
    return data;
  }, [clientsList, employeesList]);

  const toggleClient = (client: string) => setSelectedClients(prev => prev.includes(client) ? prev.filter(c => c !== client) : [...prev, client]);
  const toggleEmployee = (emp: string) => setSelectedEmployees(prev => prev.includes(emp) ? prev.filter(e => e !== emp) : [...prev, emp]);

  const isClientFiltered = selectedClients.length > 0;
  const isEmpFiltered = selectedEmployees.length > 0;

  let travel = 0, office = 0, remote = 0, digital = 0;
  
  // Additive logic: sum ONLY what is explicitly selected.
  // If nothing is selected, totals remain 0.
  if (isClientFiltered) {
    selectedClients.forEach(c => { const d = dummyData[`client_${c}`]; if (d) { travel += d.travel; office += d.office; remote += d.remote; digital += d.digital; } });
  }
  if (isEmpFiltered) {
    selectedEmployees.forEach(e => { const d = dummyData[`emp_${e}`]; if (d) { travel += d.travel; office += d.office; remote += d.remote; digital += d.digital; } });
  }

  const activeEmpsCount = isEmpFiltered ? selectedEmployees.length : 0;
  const activeClientsCount = isClientFiltered ? selectedClients.length : 0;

  const periodMult = period === "monthly" ? 1 : 12;
  travel *= periodMult;
  office *= periodMult;
  remote *= periodMult;
  digital *= periodMult;

  const totalCo2 = travel + office + remote + digital;
  const avgCo2 = Math.round(totalCo2 / (activeEmpsCount || 1));
  const trend = period === "monthly" ? -2.4 : 5.1;
  
  const breakdown = [
    { name: "Travel emissions", sub: "Flights, cabs", val: travel, target: "under" },
    { name: "Office energy", sub: "Electricity, HVAC", val: office, target: "under" },
    { name: "Remote work", sub: "WFH energy use", val: remote, target: "over" },
    { name: "Digital and cloud usage", sub: "Servers, storage", val: digital, target: "under" },
  ];

  return (
    <div className="card card-hoverable" style={{ display: "flex", flexDirection: "column", minWidth: 0, overflow: "visible", boxSizing: "border-box" }}>
      <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
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
            { label: "Trend vs last period", val: `${trend > 0 ? "+" : ""}${trend}%`, color: trend > 0 ? "#e11d48" : "#059669" },
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
        <div style={{ marginBottom: "16px", flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px" }}>Emissions breakdown</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {breakdown.map((b) => (
              <div key={b.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", padding: "8px 10px", borderRadius: "8px", background: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>{b.name}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{b.sub}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>{b.val.toLocaleString()} kg</div>
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
              ? `Combined footprint ${selectedClients.length > 0 ? `across ${selectedClients.length} selected clients ` : ""}rose ${trend}% this ${period === "monthly" ? "month" : "year"}, driven by remote work.`
              : `Combined footprint ${selectedClients.length > 0 ? `across ${selectedClients.length} selected clients ` : ""}dropped ${Math.abs(trend)}% this ${period === "monthly" ? "month" : "year"}, well within target.`
            }
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function TimesheetAIPage() {
  const showToast = useAppStore((state) => state.showToast);
  const data = useAppStore((state) => state.data);
  const { t } = useTranslation();

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
        type: e.description,
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
      
      return {
        task: t.title,
        project: t.project,
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gridAutoRows: "1fr", gap: "18px", marginTop: "8px" }}>

        {/* ── Card 1: Efficiency Tracking ────────────────────────────────────── */}
        <div className="card card-hoverable" style={{ display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden", boxSizing: "border-box" }}>
          <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>

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
                    {efficiencyTasks.map((t) => (
                      <option key={t.task} value={t.task}>{t.task} ({t.project})</option>
                    ))}
                  </select>
                </div>



                {/* Task list — over / under */}
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "8px", fontSize: "10.5px", fontWeight: 600, color: "var(--text-tertiary)" }}>
                    <span style={{ color: "#e11d48" }}>● Over Budget</span>
                    <span style={{ color: "#059669" }}>● Under Budget</span>
                  </div>
                  {efficiencyTasks.map((t) => (
                    <div
                      key={t.task}
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
                        {t.planned === null ? "—" : (t.status === "over" ? `+${t.actual - t.planned}h` : `-${t.planned - t.actual}h`)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* AI Recommendation */}
                <div style={{ background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.18)", borderRadius: "10px", padding: "12px 14px", marginTop: "auto" }}>
                  <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#2563eb", marginBottom: "4px" }}>💡 AI Recommendation</div>
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
        <div className="card card-hoverable" style={{ display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden", boxSizing: "border-box" }}>
          <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>

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
                  const userTimesheets = data.timesheets ? data.timesheets.filter((ts: any) => ts.consultant === selectedConsultant.name) : [];
                  
                  // Step 1 - Aggregate Logged Hours
                  let totalHours = 0;
                  userTimesheets.forEach((ts: any) => {
                    if (ts.entries && Array.isArray(ts.entries)) {
                      ts.entries.forEach((entry: any) => {
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
                  if (userTimesheets.length > 0) {
                    const dailyHours: Record<string, number> = {};
                    let earliestDate: Date | null = null;
                    let latestDate: Date | null = null;

                    userTimesheets.forEach((ts: any) => {
                      if (ts.entries && Array.isArray(ts.entries)) {
                        ts.entries.forEach((entry: any) => {
                          if (entry.punchInTime && entry.punchOutTime) {
                            const inTime = new Date(entry.punchInTime);
                            const outTime = new Date(entry.punchOutTime);
                            
                            if (!isNaN(inTime.getTime()) && !isNaN(outTime.getTime()) && outTime >= inTime) {
                              const hours = (outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60);
                              
                              const year = inTime.getFullYear();
                              const month = String(inTime.getMonth() + 1).padStart(2, '0');
                              const day = String(inTime.getDate()).padStart(2, '0');
                              const dateKey = `${year}-${month}-${day}`;
                              
                              dailyHours[dateKey] = (dailyHours[dateKey] || 0) + hours;

                              const dateOnly = new Date(year, inTime.getMonth(), inTime.getDate());
                              
                              if (!earliestDate || dateOnly < earliestDate) earliestDate = dateOnly;
                              if (!latestDate || dateOnly > latestDate) latestDate = dateOnly;
                            }
                          }
                        });
                      }
                    });

                    if (earliestDate && latestDate) {
                      const msPerDay = 1000 * 60 * 60 * 24;
                      const totalDays = Math.round(((latestDate as Date).getTime() - (earliestDate as Date).getTime()) / msPerDay) + 1;
                      
                      let presentDays = 0;
                      Object.values(dailyHours).forEach(hours => {
                        if (hours >= 8) {
                          presentDays++;
                        }
                      });

                      if (totalDays > 0) {
                        const attPct = (presentDays / totalDays) * 100;
                        calculatedAttendance = Math.min(100, Math.round(attPct));
                      }
                    }
                  }
                  // ----------------------------------------------------------------------------------------------------
                  
                  return (
                    <>
                      {/* Consultant selector */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "5px" }}>Select Consultant</label>
                  <select
                    className="select"
                    value={selectedConsultant.name}
                    onChange={(e) => setSelectedConsultant(consultants.find((c) => c.name === e.target.value) ?? consultants[0])}
                    style={{ width: "100%", fontSize: "12.5px" }}
                  >
                    {consultants.map((c) => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Circle KPIs */}
                <div style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: "12px 6px", padding: "12px 8px", marginBottom: "16px", background: "var(--bg-surface-2)", borderRadius: "12px", border: "1px solid var(--border-subtle)" }}>
                  {/* Utilization Metric - Scoped exclusively to the Performance Metrics Dashboard card */}
                  {(() => {
                    const r = 22;
                    const circ = 2 * Math.PI * r;
                    const dash = calculatedUtilization === "N/A" ? 0 : ((calculatedUtilization as number) / 100) * circ;
                    return (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", minWidth: "50px" }}>
                        <svg width="52" height="52" viewBox="0 0 60 60">
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
                        <span style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 600, textAlign: "center", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                          Utilisation
                        </span>
                      </div>
                    );
                  })()}
                  <CircleScore value={calculatedAttendance}           label="Attendance"    color="#059669" />
                  <CircleScore value={selectedConsultant.efficiency}  label="Efficiency"    color="#1ABC9C" />
                  <CircleScore value={selectedConsultant.score}       label="Productivity"  color="#d97706" />
                </div>

                {/* Consultant comparison table */}
                <div style={{ marginBottom: "16px", flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px" }}>Team Comparison</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    {consultants.map((c) => (
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
                            <div style={{ height: "100%", width: `${c.score}%`, background: "linear-gradient(90deg,#2563eb,#1ABC9C)", borderRadius: "2px", transition: "width 0.4s" }} />
                          </div>
                        </div>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: c.score >= 90 ? "#059669" : c.score >= 80 ? "#d97706" : "#e11d48", minWidth: "36px", textAlign: "right", flexShrink: 0 }}>{c.score}%</span>
                      </div>
                    ))}
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

        {/* ── Card 3: Travel Expense Auto-Push to Billing ─────────────────────── */}
        <div className="card card-hoverable" style={{ display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden", boxSizing: "border-box" }}>
          <div className="card-body-lg" style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>

            {/* Card Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(217,119,6,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <IconReceipt size={20} style={{ color: "#D97706" }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--text-primary)", margin: 0, wordBreak: "break-word", overflowWrap: "break-word" }}>Travel Expense Auto-Push to Billing</h3>
                <span style={{ fontSize: "11px", color: "var(--text-tertiary)", wordBreak: "break-word", overflowWrap: "break-word" }}>Classify &amp; Push Reimbursable Expenses</span>
              </div>
            </div>

            {expenses.length > 0 ? (
              <>
                {/* Summary badges */}
                <div style={{ display: "flex", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
                  <span className="badge badge-success" style={{ wordBreak: "break-word", overflowWrap: "break-word" }}>Billable: ₹{expenses.filter(e => e.category === "Billable").reduce((s,e) => s + e.amount, 0).toLocaleString("en-IN")}</span>
                  <span className="badge badge-brand" style={{ wordBreak: "break-word", overflowWrap: "break-word" }}>Reimbursable: ₹{expenses.filter(e => e.category === "Reimbursable").reduce((s,e) => s + e.amount, 0).toLocaleString("en-IN")}</span>
                  <span className="badge badge-gray" style={{ wordBreak: "break-word", overflowWrap: "break-word" }}>Non-Billable: ₹{expenses.filter(e => e.category === "Non-Billable").reduce((s,e) => s + e.amount, 0).toLocaleString("en-IN")}</span>
                </div>

                {/* Expense table */}
                <div style={{ flex: 1, marginBottom: "16px", minWidth: 0 }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px" }}>Select expenses to push</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {expenses.map((exp) => {
                      const checked = selectedExpenses.includes(exp.id);
                      return (
                        <div
                          key={exp.id}
                          onClick={() => toggleExpense(exp.id)}
                          style={{
                            display: "flex", alignItems: "center", gap: "10px",
                            padding: "9px 12px", borderRadius: "8px", cursor: "pointer",
                            background: checked ? "rgba(37,99,235,0.05)" : "var(--bg-surface-2)",
                            border: `1px solid ${checked ? "rgba(37,99,235,0.25)" : "var(--border-subtle)"}`,
                            transition: "all 0.15s",
                          }}
                        >
                          {/* Checkbox */}
                          <div style={{
                            width: "16px", height: "16px", borderRadius: "4px", flexShrink: 0,
                            border: `2px solid ${checked ? "#2563eb" : "var(--border-default)"}`,
                            background: checked ? "#2563eb" : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.15s",
                          }}>
                            {checked && <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><polyline points="1.5,4.5 3.5,6.5 7.5,2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                          <span style={{ fontSize: "16px", flexShrink: 0 }}>{exp.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-primary)", wordBreak: "break-word", overflowWrap: "break-word" }}>{exp.type}</div>
                            <span className={`badge ${categoryBadge[exp.category]}`} style={{ fontSize: "9.5px", marginTop: "2px" }}>{exp.category}</span>
                          </div>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: categoryColor[exp.category], textAlign: "right", flexShrink: 0 }}>
                            ₹{exp.amount.toLocaleString("en-IN")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Selected total */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--bg-surface-2)", borderRadius: "8px", marginBottom: "14px", border: "1px solid var(--border-subtle)" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600 }}>{selectedExpenses.length} expense{selectedExpenses.length !== 1 ? "s" : ""} selected</span>
                  <span style={{ fontSize: "15px", fontWeight: 800, color: "var(--text-primary)" }}>₹{totalSelected.toLocaleString("en-IN")}</span>
                </div>

                {/* Success banner */}
                {pushDone && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", background: "rgba(5,150,105,0.08)", border: "1px solid rgba(5,150,105,0.25)", borderRadius: "8px", marginBottom: "12px" }}>
                    <IconCheckCircle size={16} style={{ color: "#059669", flexShrink: 0 }} />
                    <span style={{ fontSize: "12px", color: "#059669", fontWeight: 600, flex: 1, wordBreak: "break-word", overflowWrap: "break-word" }}>Selected travel expenses successfully pushed to billing queue.</span>
                  </div>
                )}

                {/* Push button */}
                <button
                  className="btn btn-primary"
                  style={{ width: "100%", justifyContent: "center", gap: "8px", marginTop: "auto", display: "flex", alignItems: "center" }}
                  onClick={handlePushToBilling}
                  disabled={isPushing || selectedExpenses.length === 0}
                >
                  {isPushing ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 1s linear infinite" }}>
                        <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="4" />
                        <path d="M4 12a8 8 0 0 1 8-8" />
                      </svg>
                      Pushing to Billing...
                    </>
                  ) : (
                    <>
                      <IconChart size={14} />
                      Push to Billing
                    </>
                  )}
                </button>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)", fontSize: "13px", marginTop: "auto", marginBottom: "auto" }}>
                No travel or expense logs found in the system. Submit expenses in the Expenses page to enable auto-push to billing.
              </div>
            )}

          </div>
        </div>

        <CarbonTrackerCard consultants={consultants} projects={data.projects || []} />

      </div>
    </div>
  );
}
