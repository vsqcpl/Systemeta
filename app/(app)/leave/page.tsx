"use client";

import { useState, useEffect } from "react";
import { useAppStore, useTranslation } from "@/lib/store";
import { LeaveType } from "@/lib/data/types";
import { Check, X, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { filterLeaveRecords } from "@/lib/dataFilters";
import { canDo } from "@/lib/permissionHelpers";

export default function LeavePage() {
  const data = useAppStore((state) => state.data);
  const { t } = useTranslation();
  const { user } = useAuth();
  const showToast = useAppStore((state) => state.showToast);
  const approveLeaveRequest = useAppStore((state) => state.approveLeaveRequest);
  const rejectLeaveRequest = useAppStore((state) => state.rejectLeaveRequest);
  const addLeaveRequest = useAppStore((state) => state.addLeaveRequest);
  const deleteLeaveRequest = useAppStore((state) => state.deleteLeaveRequest);

  const visibleLeaveRequests = user ? filterLeaveRecords(data.leaveRequests, user) : [];

  const visibleConsultants = (() => {
    const role = user?.role || "";
    const sourceList = (role === "super_admin" || role === "Super Admin") ? (data.users || data.consultants) : data.consultants;

    let filtered = sourceList.filter((c: any) => {
      if (role === "super_admin" || role === "Super Admin") return true;
      if (role === "project_manager" || role === "Project Manager") {
        if (c.id === user?.id) return true;
        const lrCount = visibleLeaveRequests.filter(lr => lr.consultant === c.id).length;
        return lrCount > 0;
      }
      if (role === "senior_consultant" || role === "Senior Consultant") {
        const repIds = user?.reporteeIds || [];
        return c.id === user?.id || repIds.includes(c.id);
      }
      if (role === "consultant" || role === "Consultant") return c.id === user?.id;
      if (role === "client_manager" || role === "Client Manager") return c.id === user?.id;
      if (role === "accounts" || role === "Accounts") return c.id === user?.id;
      return false;
    });

    filtered = filtered.map((c: any) => ({
      ...c,
      color: c.color || "#6366f1",
      avatar: c.avatar || (c.name || "").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2),
    }));

    if (filtered.length === 0 && user) {
      return [{
        id: user.id,
        name: user.name,
        color: "#6366f1",
        avatar: user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2),
        role: user.role,
        dept: "Technology",
        utilization: 0,
        availability: 100,
        billRate: 0,
        skills: [] as string[],
      }];
    }
    return filtered;
  })();

  const [viewMode, setViewMode] = useState<"calendar" | "team">("calendar");
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [expandedReasons, setExpandedReasons] = useState<Record<string, boolean>>({});
  const [customLeaveType, setCustomLeaveType] = useState("");
  const [detailsModalLeave, setDetailsModalLeave] = useState<any | null>(null);
  const [newRequest, setNewRequest] = useState<{
    consultant: string;
    type: LeaveType;
    start: string;
    end: string;
    reason: string;
    attachment: string;
  }>(() => ({
    consultant: "",
    type: "Annual Leave",
    start: "",
    end: "",
    reason: "",
    attachment: "",
  }));

  // Update default consultant when consultant list loads from the backend
  useEffect(() => {
    if (visibleConsultants.length > 0 && !newRequest.consultant) {
      setNewRequest((prev) => ({
        ...prev,
        consultant: visibleConsultants[0].id,
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.consultants, user?.id]);

  // NOTE: visibleConsultants is re-computed each render (inline .filter),
  // so we MUST NOT put it in a useEffect dependency array — it would loop infinitely.
  // The consultant default is synced above via useEffect watching data.consultants.

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRequest.start || !newRequest.end) {
      showToast("Please select start and end dates.", "warning");
      return;
    }
    const startObj = new Date(newRequest.start);
    const endObj = new Date(newRequest.end);
    if (endObj < startObj) {
      showToast("End date cannot be before start date.", "warning");
      return;
    }

    if (newRequest.type === "Other" && !customLeaveType.trim()) {
      showToast("Please specify the leave type.", "warning");
      return;
    }

    const diffTime = Math.abs(endObj.getTime() - startObj.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    addLeaveRequest({
      consultant: newRequest.consultant,
      type: newRequest.type === "Other" ? customLeaveType.trim() : newRequest.type,
      start: newRequest.start,
      end: newRequest.end,
      days: diffDays,
      reason: newRequest.reason,
      attachment: newRequest.attachment,
    });

    setIsRequestModalOpen(false);
    setNewRequest({
      consultant: visibleConsultants[0]?.id || user?.id || "TK",
      type: "Annual Leave",
      start: "",
      end: "",
      reason: "",
      attachment: "",
    });
    setCustomLeaveType("");
  };

  // Default to June 2026 to align with mock data range
  const [currentMonth, setCurrentMonth] = useState(5); // 0-indexed (June = 5)
  const [currentYear, setCurrentYear] = useState(2026);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // Get calendar parameters
  const firstDayIndex = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7; // Mon = 0, Sun = 6
  const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();

  const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);
  const paddingArray = Array.from({ length: firstDayIndex }, (_, i) => i);

  // Check matching leave requests for a specific calendar cell date
  const getLeaveStatusForDay = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dateObj = new Date(dateStr);
    
    // Find matching active requests (approved or pending)
    const matches = visibleLeaveRequests.filter((lr) => {
      if (lr.status !== "approved" && lr.status !== "pending") return false;
      const start = new Date(lr.start);
      const end = new Date(lr.end);
      return dateObj >= start && dateObj <= end;
    });

    if (matches.length === 0) return null;

    // Prioritize leave type color mapping
    const match = matches[0];
    const consultant = data.consultants.find((c) => c.id === match.consultant) || data.users?.find((u) => u.id === match.consultant);
    const label = `${consultant?.name.split(" ")[0] || match.consultant} – ${match.type.split(" ")[0]}`;

    return {
      type: match.type,
      label,
      status: match.status,
    };
  };

  const pendingRequests = visibleLeaveRequests.filter((lr) => lr.status === "pending");

  return (
    <div style={{ animation: "fadeIn 0.5s ease-out" }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("Leave Management")}</h1>
          <p className="page-subtitle">
            {pendingRequests.length} {t("requests pending")} · {t(months[currentMonth])} {currentYear}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className={`btn ${viewMode === "team" ? "btn-primary" : "btn-secondary"} btn-sm`}
            onClick={() => setViewMode(viewMode === "team" ? "calendar" : "team")}
          >
            {viewMode === "team" ? t("Calendar View") : t("Team View")}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setIsRequestModalOpen(true)}
          >
            + {t("Request Leave")}
          </button>
        </div>
      </div>

      <div className="grid-2 mb-4">
        {/* Leave Requests Card */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: 0 }}>
            <span className="card-title">{t("Leave Requests")}</span>
            <span className="badge badge-warning">{pendingRequests.length} {t("pending")}</span>
          </div>
          <div className="card-body">
            {visibleLeaveRequests.map((lr) => {
              let c: any = data.consultants.find((x) => x.id === lr.consultant);
              if (!c) {
                const u = data.users?.find((x) => x.id === lr.consultant);
                c = u ? {
                  color: "#64748b",
                  avatar: u.name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2),
                  name: u.name,
                } : {
                  color: "#64748b",
                  avatar: lr.consultant,
                  name: lr.consultant,
                };
              }
              const statusBadge = (({
                pending: "badge-warning",
                approved: "badge-success",
                rejected: "badge-danger",
              } as Record<string, string>)[lr.status]) || "badge-gray";

              const typeColor = (({
                "Annual Leave": "#2563eb",
                "Sick Leave": "#ef4444",
                "Study Leave": "#f59e0b",
              } as Record<string, string>)[lr.type]) || "#64748b";

              return (
                <div
                  key={lr.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "13px 0",
                    borderBottom: "1px solid var(--border-subtle)",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      className="avatar"
                      style={{
                        background: c.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontWeight: "bold",
                      }}
                    >
                      {c.avatar}
                    </div>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
                        {c.name}
                      </div>
                      <div style={{ fontSize: "12px", color: typeColor, fontWeight: 500 }}>{t(lr.type)}</div>
                      <div style={{ fontSize: "11.5px", color: "var(--text-tertiary)" }}>
                        {lr.start} → {lr.end} · {lr.days} {t("days")}
                      </div>
                      {(lr.reason || lr.attachment) && (
                        <div style={{ marginTop: "4px" }}>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: "4px 8px", fontSize: "11px", color: "var(--brand-600)", display: "flex", alignItems: "center", gap: "4px", height: "auto", border: "1px solid var(--border-default)", borderRadius: "4px" }}
                            onClick={() => setDetailsModalLeave(lr)}
                          >
                            <Info size={12} /> {t("Details")}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <span className={`badge ${statusBadge}`} style={{ fontSize: "11.5px" }}>{t(lr.status)}</span>
                    {lr.status === "pending" && canDo("approve_leave", user?.role as any) && lr.consultant !== user?.id && (
                      <div style={{ display: "flex", gap: "4px", marginTop: "6px" }}>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => approveLeaveRequest(lr.id)}
                          style={{ padding: "4px 8px", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          <Check size={14} />
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => rejectLeaveRequest(lr.id)}
                          style={{ padding: "4px 8px", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                    {lr.status === "pending" && (lr.consultant === user?.id || user?.role === "super_admin" || user?.role === "Super Admin") && (
                      <div style={{ marginTop: "6px" }}>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => {
                            if (confirm(t("Are you sure you want to withdraw this leave request?"))) {
                              deleteLeaveRequest(lr.id);
                            }
                          }}
                          style={{ padding: "4px 8px", fontSize: "11px", display: "inline-flex", alignItems: "center", justifyContent: "center", width: "100%" }}
                        >
                          {t("Withdraw")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dynamic Calendar / Team Schedule Card */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: 0 }}>
            <span className="card-title">
              {viewMode === "team" ? `${t("Team Schedule")} – ${t(months[currentMonth])} ${currentYear}` : `${t(months[currentMonth])} ${currentYear}`}
            </span>
            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
              <div className="tabs" style={{ marginRight: "8px" }}>
                <button
                  className={`tab ${viewMode === "calendar" ? "active" : ""}`}
                  onClick={() => setViewMode("calendar")}
                  style={{ fontSize: "11px", padding: "4px 8px" }}
                >
                  {t("Calendar")}
                </button>
                <button
                  className={`tab ${viewMode === "team" ? "active" : ""}`}
                  onClick={() => setViewMode("team")}
                  style={{ fontSize: "11px", padding: "4px 8px" }}
                >
                  {t("Team View")}
                </button>
              </div>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={handlePrevMonth}>
                <ChevronLeft size={16} />
              </button>
              <button className="btn btn-ghost btn-sm btn-icon" onClick={handleNextMonth}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="card-body">
            {viewMode === "calendar" ? (
              <>
                <div className="leave-calendar">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                    <div key={d} className="leave-cal-header">
                      {t(d)}
                    </div>
                  ))}
                  {paddingArray.map((_, idx) => (
                    <div key={`padding-${idx}`} className="leave-cal-day other-month" />
                  ))}
                  {daysArray.map((day) => {
                    const leaveData = getLeaveStatusForDay(day);
                    const isToday =
                      new Date().getDate() === day &&
                      new Date().getMonth() === currentMonth &&
                      new Date().getFullYear() === currentYear;

                    let cls = "";
                    if (isToday) cls = "today";
                    else if (leaveData) {
                      if (leaveData.type === "Sick Leave") cls = "leave-sick";
                      else if (leaveData.type === "Study Leave") cls = "leave-study";
                      else if (leaveData.type === "Annual Leave") cls = "leave-annual";
                      else cls = "leave-other";
                    }

                    return (
                      <div
                        key={day}
                        className={`leave-cal-day ${cls}`}
                        title={isToday ? t("Today") : leaveData ? leaveData.label : ""}
                      >
                        {day}
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: "16px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11.5px", color: "var(--text-secondary)" }}>
                    <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "var(--brand-100)" }} />
                    {t("Annual Leave")}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11.5px", color: "var(--text-secondary)" }}>
                    <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "var(--danger-50)" }} />
                    {t("Sick Leave")}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11.5px", color: "var(--text-secondary)" }}>
                    <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "var(--warning-50)" }} />
                    {t("Study Leave")}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div style={{ overflowX: "auto" }}>
                  <div style={{ minWidth: "720px" }}>
                    {/* Header Row */}
                    <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "8px", marginBottom: "8px" }}>
                      <div style={{ width: "130px", fontWeight: "bold", fontSize: "12px", color: "var(--text-secondary)" }}>
                        {t("Consultant")}
                      </div>
                      <div style={{ display: "flex", flex: 1, justifyContent: "space-between" }}>
                        {daysArray.map((day) => {
                          const dateObj = new Date(currentYear, currentMonth, day);
                          const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                          return (
                            <div
                              key={day}
                              style={{
                                width: "20px",
                                textAlign: "center",
                                fontSize: "10px",
                                fontWeight: "bold",
                                color: isWeekend ? "var(--text-tertiary)" : "var(--text-secondary)",
                                background: isWeekend ? "var(--bg-surface-2)" : "transparent",
                                borderRadius: "3px",
                              }}
                            >
                              {day}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Consultant Rows */}
                    {visibleConsultants.map((c) => (
                      <div
                        key={c.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          padding: "8px 0",
                          borderBottom: "1px solid var(--border-subtle)",
                        }}
                      >
                        <div style={{ width: "130px", display: "flex", alignItems: "center", gap: "8px" }}>
                          <div
                            className="avatar"
                            style={{
                              background: c.color,
                              width: "24px",
                              height: "24px",
                              fontSize: "9px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "white",
                              fontWeight: "bold",
                            }}
                          >
                            {c.avatar}
                          </div>
                          <span style={{ fontSize: "12.5px", fontWeight: 500, color: "var(--text-primary)" }}>
                            {c.name.split(" ")[0]} {c.name.split(" ")[1]?.[0] || ""}
                          </span>
                        </div>
                        <div style={{ display: "flex", flex: 1, justifyContent: "space-between" }}>
                          {daysArray.map((day) => {
                            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                            const dateObj = new Date(dateStr);
                            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

                            const matches = visibleLeaveRequests.filter((lr) => {
                              if (lr.consultant !== c.id) return false;
                              if (lr.status !== "approved" && lr.status !== "pending") return false;
                              const start = new Date(lr.start);
                              const end = new Date(lr.end);
                              return dateObj >= start && dateObj <= end;
                            });

                            const hasLeave = matches.length > 0;
                            const leave = matches[0];

                            let cellBg = "transparent";
                            let borderStyle = "1px solid var(--border-subtle)";
                            let tooltip = `${c.name}: ${t("Working")}`;

                            if (hasLeave) {
                              borderStyle = "none";
                              const isApproved = leave.status === "approved";
                              if (leave.type === "Sick Leave") {
                                cellBg = isApproved ? "#ef4444" : "var(--danger-50)";
                              } else if (leave.type === "Study Leave") {
                                cellBg = isApproved ? "#f59e0b" : "var(--warning-50)";
                              } else if (leave.type === "Annual Leave") {
                                cellBg = isApproved ? "#2563eb" : "var(--brand-100)";
                              } else {
                                cellBg = isApproved ? "#64748b" : "#cbd5e1";
                              }
                              tooltip = `${c.name}: ${t(leave.type)} (${t(leave.status)})`;
                            } else if (isWeekend) {
                              cellBg = "var(--bg-surface-2)";
                              tooltip = `${c.name}: ${t("Weekend")}`;
                            }

                            return (
                              <div
                                key={day}
                                title={tooltip}
                                style={{
                                  width: "20px",
                                  height: "20px",
                                  borderRadius: "4px",
                                  background: cellBg,
                                  border: borderStyle,
                                  cursor: "pointer",
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ marginTop: "16px", display: "flex", flexWrap: "wrap", gap: "16px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "var(--text-secondary)" }}>
                    <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "#2563eb" }} />
                    {t("Annual")} ({t("Approved")})
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "var(--text-secondary)" }}>
                    <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "var(--brand-100)", border: "1px solid #2563eb" }} />
                    {t("Annual")} ({t("Pending")})
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "var(--text-secondary)" }}>
                    <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "#ef4444" }} />
                    {t("Sick")} ({t("Approved")})
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "var(--text-secondary)" }}>
                    <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "var(--danger-50)", border: "1px solid #ef4444" }} />
                    {t("Sick")} ({t("Pending")})
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "var(--text-secondary)" }}>
                    <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "#f59e0b" }} />
                    {t("Study")} ({t("Approved")})
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "var(--text-secondary)" }}>
                    <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: "var(--warning-50)", border: "1px solid #f59e0b" }} />
                    {t("Study")} ({t("Pending")})
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Team Leave Balances (Deterministic - resolves Bug #2) */}
      <div className="card">
        <div className="card-header" style={{ marginBottom: 0 }}>
          <span className="card-title">{t("Team Leave Balances")} — 2026</span>
        </div>
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>{t("Consultant")}</th>
                <th>{t("Annual Entitlement")}</th>
                <th>{t("Used")}</th>
                <th>{t("Pending")}</th>
                <th>{t("Remaining")}</th>
                <th>{t("Balance Status")}</th>
              </tr>
            </thead>
            <tbody>
              {visibleConsultants.map((c) => {
                const pendingDays = visibleLeaveRequests
                  .filter((lr) => lr.consultant === c.id && lr.status === "pending")
                  .reduce((sum, lr) => sum + lr.days, 0);

                const approvedDays = visibleLeaveRequests
                  .filter((lr) => lr.consultant === c.id && lr.status === "approved")
                  .reduce((sum, lr) => sum + lr.days, 0);

                // Deterministic base used days calculation to prevent random shift
                const charSum = c.name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
                const baselineUsed = (charSum % 8) + 4; // 4 to 11 base days
                const used = baselineUsed + approvedDays;
                const remaining = Math.max(0, 30 - used - pendingDays);
                const pct = (used / 30) * 100;

                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div
                          className="avatar"
                          style={{
                            background: c.color,
                            width: "26px",
                            height: "26px",
                            minWidth: "26px",
                            fontSize: "9px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontWeight: "bold",
                          }}
                        >
                          {c.avatar}
                        </div>
                        <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{c.name}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: "13px", color: "var(--text-primary)" }}>30 {t("days")}</td>
                    <td style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary)" }}>
                      {used} {t("days")}
                    </td>
                    <td style={{ fontSize: "13px" }}>
                      {pendingDays > 0 ? (
                        <span className="badge badge-warning">{pendingDays} {t("days")}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td
                      style={{
                        fontWeight: 700,
                        fontSize: "13px",
                        color: remaining < 5 ? "var(--danger-600)" : "var(--success-600)",
                      }}
                    >
                      {remaining} {t("days")}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div className="progress-bar" style={{ width: "80px", height: "5px" }}>
                          <div
                            className={`progress-fill ${pct > 80 ? "danger" : ""}`}
                            style={{ width: `${pct}%`, background: pct > 80 ? "var(--danger-500)" : "var(--brand-500)" }}
                          />
                        </div>
                        <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                          {Math.round(pct)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isRequestModalOpen && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setIsRequestModalOpen(false)}
        >
          <div
            className="modal-content"
            style={{
              background: "var(--bg-surface)",
              borderRadius: "12px",
              padding: "24px",
              width: "min(480px, 90%)",
              boxShadow: "var(--shadow-xl)",
              border: "1px solid var(--border-default)",
              animation: "slideDown 0.2s cubic-bezier(0.4,0,0.2,1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: "16px", fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>
              {t("Request Leave")}
            </h2>
            <form onSubmit={handleRequestSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                  {t("Consultant")}
                </label>
                <select
                  value={newRequest.consultant}
                  onChange={(e) => setNewRequest({ ...newRequest, consultant: e.target.value })}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-default)",
                    background: "var(--bg-surface)",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                    width: "100%",
                  }}
                >
                  {visibleConsultants.length === 0 && (
                    <option value="" disabled>
                      {t("Loading consultants…")}
                    </option>
                  )}
                  {visibleConsultants.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                  {t("Leave Type")}
                </label>
                <select
                  value={newRequest.type}
                  onChange={(e) => {
                    setNewRequest({ ...newRequest, type: e.target.value as LeaveType });
                    if (e.target.value !== "Other") {
                      setCustomLeaveType("");
                    }
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-default)",
                    background: "var(--bg-surface)",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                  }}
                  required
                >
                  <option value="Annual Leave">{t("Annual Leave")}</option>
                  <option value="Sick Leave">{t("Sick Leave")}</option>
                  <option value="Study Leave">{t("Study Leave")}</option>
                  <option value="Other">{t("Other")}</option>
                </select>
              </div>

              {newRequest.type === "Other" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", animation: "fadeIn 0.3s ease" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                    {t("Specify Leave Type")}
                  </label>
                  <input
                    type="text"
                    value={customLeaveType}
                    onChange={(e) => setCustomLeaveType(e.target.value)}
                    placeholder={t("e.g. Marriage Leave")}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid var(--border-default)",
                      background: "var(--bg-surface)",
                      color: "var(--text-primary)",
                      fontSize: "13px",
                    }}
                    required
                  />
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                    {t("Start Date")}
                  </label>
                  <input
                    type="date"
                    value={newRequest.start}
                    onChange={(e) => setNewRequest({ ...newRequest, start: e.target.value })}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid var(--border-default)",
                      background: "var(--bg-surface)",
                      color: "var(--text-primary)",
                      fontSize: "13px",
                    }}
                    required
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                    {t("End Date")}
                  </label>
                  <input
                    type="date"
                    value={newRequest.end}
                    onChange={(e) => setNewRequest({ ...newRequest, end: e.target.value })}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid var(--border-default)",
                      background: "var(--bg-surface)",
                      color: "var(--text-primary)",
                      fontSize: "13px",
                    }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                  {t("Reason")}
                </label>
                <textarea
                  value={newRequest.reason}
                  onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })}
                  placeholder={t("e.g. Annual family vacation")}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-default)",
                    background: "var(--bg-surface)",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                    minHeight: "80px",
                    resize: "vertical",
                  }}
                  required
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>
                  {t("Attachment (Optional)")}
                </label>
                <input
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setNewRequest({ ...newRequest, attachment: file.name });
                    } else {
                      setNewRequest({ ...newRequest, attachment: "" });
                    }
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-default)",
                    background: "var(--bg-surface)",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsRequestModalOpen(false)}
                >
                  {t("Cancel")}
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  {t("Submit Request")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailsModalLeave && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setDetailsModalLeave(null)}
        >
          <div
            className="modal-content"
            style={{
              background: "var(--bg-surface)",
              borderRadius: "12px",
              padding: "24px",
              width: "min(400px, 90%)",
              boxShadow: "var(--shadow-xl)",
              border: "1px solid var(--border-default)",
              animation: "slideDown 0.2s cubic-bezier(0.4,0,0.2,1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: "16px", fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>
              {t("Leave Details")}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px", color: "var(--text-primary)" }}>
              {detailsModalLeave.reason && (
                <div>
                  <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{t("Reason")}:</span>
                  <div style={{ marginTop: "4px", padding: "8px", background: "var(--bg-surface-2)", borderRadius: "6px", whiteSpace: "pre-wrap" }}>
                    {detailsModalLeave.reason}
                  </div>
                </div>
              )}
              {detailsModalLeave.attachment && (
                <div>
                  <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{t("Attachment")}:</span>
                  <div style={{ marginTop: "4px", padding: "8px", background: "var(--bg-surface-2)", borderRadius: "6px" }}>
                    📄 {detailsModalLeave.attachment}
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setDetailsModalLeave(null)}
              >
                {t("Close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
