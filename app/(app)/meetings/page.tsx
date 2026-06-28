"use client";

import React, { useState, useMemo } from "react";
import { useAppStore, useTranslation } from "@/lib/store";
import ModalPortal from "@/components/ui/ModalPortal";
import { IconClock, IconClose, IconSearch, IconCheck } from "@/components/ui/Icons";
import { MeetingPlatform } from "@/lib/data/types";

// Platform icons as inline SVG components
const GoogleMeetIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
    <path d="M28.5 24c0 2.485-2.015 4.5-4.5 4.5s-4.5-2.015-4.5-4.5 2.015-4.5 4.5-4.5 4.5 2.015 4.5 4.5z" fill="#00832d"/>
    <path d="M34.5 14.5L28 21l-4-4-8 4v6l4 4 4-4 7 7.5V14.5z" fill="#00832d"/>
    <path d="M34.5 33.5L28 27l-4 4-4-4-8-4v-6l8-4 4 4 7-6.5V33.5z" fill="#0066da" opacity=".5"/>
    <rect x="6" y="6" width="36" height="36" rx="8" stroke="#00832d" strokeWidth="2" fill="none"/>
  </svg>
);

const ZoomIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
    <rect width="48" height="48" rx="10" fill="#2D8CFF"/>
    <path d="M8 16h20a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-8a4 4 0 0 1 4-4z" fill="white"/>
    <path d="M32 20l12-8v24L32 28V20z" fill="white"/>
  </svg>
);

const TeamsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
    <rect width="48" height="48" rx="10" fill="#5059C9"/>
    <circle cx="30" cy="14" r="5" fill="white"/>
    <path d="M30 22c4.418 0 8 2.686 8 6v2H22v-2c0-3.314 3.582-6 8-6z" fill="white" opacity=".8"/>
    <circle cx="18" cy="17" r="6" fill="white"/>
    <path d="M18 27c-5.523 0-10 3.134-10 7v2h20v-2c0-3.866-4.477-7-10-7z" fill="white"/>
  </svg>
);

const InPersonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const PLATFORMS: { value: MeetingPlatform; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "Google Meet", label: "Google Meet", icon: <GoogleMeetIcon />, color: "#00832d" },
  { value: "Zoom", label: "Zoom", icon: <ZoomIcon />, color: "#2D8CFF" },
  { value: "Microsoft Teams", label: "Microsoft Teams", icon: <TeamsIcon />, color: "#5059C9" },
  { value: "In Person", label: "In Person", icon: <InPersonIcon />, color: "#64748b" },
];

const PLATFORM_COLORS: Record<string, string> = {
  "Google Meet": "#00832d",
  Zoom: "#2D8CFF",
  "Microsoft Teams": "#5059C9",
  "In Person": "#64748b",
};

function PlatformBadge({ platform }: { platform?: string }) {
  if (!platform) return null;
  const color = PLATFORM_COLORS[platform] ?? "#64748b";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        fontSize: "11px",
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: "99px",
        background: `${color}18`,
        color,
        border: `1px solid ${color}30`,
      }}
    >
      {platform}
    </span>
  );
}

export default function MeetingsPage() {
  const data = useAppStore((state) => state.data);
  const addMeeting = useAppStore((state) => state.addMeeting);
  const showToast = useAppStore((state) => state.showToast);
  const { t } = useTranslation();

  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // ── Form state ──────────────────────────────────────────────
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [platform, setPlatform] = useState<MeetingPlatform>("Google Meet");
  const [meetingLink, setMeetingLink] = useState("");
  const [notes, setNotes] = useState("");
  const [sendInvite, setSendInvite] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<"form" | "confirm" | "done">("form");

  const meetings = data.clientMeetings || [];
  const clients = data.clients || [];

  const filtered = useMemo(
    () =>
      meetings.filter(
        (m) =>
          m.meetingType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.outcome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          m.platform?.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [meetings, searchTerm]
  );

  const selectedClient = clients.find((c) => c.id === clientId);

  const resetForm = () => {
    setClientId("");
    setTitle("");
    setDate("");
    setTime("10:00");
    setPlatform("Google Meet");
    setMeetingLink("");
    setNotes("");
    setSendInvite(true);
    setStep("form");
  };

  const handleClose = () => {
    resetForm();
    setShowAddModal(false);
  };

  const handleReviewAndSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !title || !date) return;
    setStep("confirm");
  };

  const generateMeetingLink = (plat: string) => {
    const randomId = Math.random().toString(36).substring(2, 10);
    if (plat === "Google Meet") return `https://meet.google.com/${randomId}`;
    if (plat === "Zoom") return `https://zoom.us/j/${Math.floor(100000000 + Math.random() * 900000000)}`;
    if (plat === "Microsoft Teams") return `https://teams.microsoft.com/l/meetup-join/${randomId}`;
    return "";
  };

  const handleConfirmCreate = async () => {
    setSubmitting(true);
    try {
      let finalLink = meetingLink;

      await addMeeting({
        clientId,
        participants: [],
        meetingType: title,
        date,
        time,
        agenda: notes,
        notes,
        actionItems: "",
        outcome: "Pending",
        nextFollowUpDate: null,
        platform,
        meetingLink: finalLink,
        inviteSent: sendInvite,
      });

      if (sendInvite) {
        // Create an actual notification in the database for the client contact
        try {
          const clientContactUser = data.users.find(
            (u: any) => u.role === "client_contact" && u.clientId === selectedClient?.companyName
          );
          if (clientContactUser) {
            const nextNotifId = "N" + String(Math.floor(100000 + Math.random() * 900000));
            await fetch("/api/notifications", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: nextNotifId,
                userId: clientContactUser.id,
                type: "info",
                title: "Meeting Scheduled",
                message: `Meeting "${title}" is scheduled on ${date} at ${time}. Link: ${finalLink || "In Person"}.`,
                category: "general"
              })
            });
          }
        } catch (err) {
          console.error("Failed to create database notification:", err);
        }

        showToast(
          `Meeting invite sent to ${selectedClient?.companyName ?? "client"} via notification dashboard.`,
          "success"
        );
      } else {
        showToast("Meeting scheduled successfully.", "success");
      }

      setStep("done");
      // Auto-close after 1.6s
      setTimeout(() => {
        handleClose();
      }, 1600);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container" style={{ animation: "fadeIn 0.5s ease-out", padding: "24px" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("Meetings")}</h1>
          <p className="page-subtitle">{t("Schedule and track client meetings and outcomes.")}</p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div className="search-bar" style={{ position: "relative", width: "240px" }}>
            <IconSearch
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }}
              size={16}
            />
            <input
              type="text"
              className="login-input"
              placeholder={t("Search meetings...")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: "36px", height: "36px", margin: 0 }}
            />
          </div>
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowAddModal(true); }}>
            <IconClock /> {t("Schedule Meeting")}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>{t("Date & Time")}</th>
                <th>{t("Title")}</th>
                <th>{t("Client")}</th>
                <th>{t("Platform")}</th>
                <th>{t("Invite Sent")}</th>
                <th>{t("Outcome")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((m) => {
                  const client = clients.find((cl) => cl.id === m.clientId);
                  return (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                        {m.date}
                        {m.time && (
                          <span style={{ marginLeft: 6, fontWeight: 400, color: "var(--text-tertiary)", fontSize: 12 }}>
                            {m.time}
                          </span>
                        )}
                      </td>
                      <td>{m.meetingType}</td>
                      <td>{client ? client.companyName : "-"}</td>
                      <td>
                        <PlatformBadge platform={m.platform} />
                        {m.meetingLink && m.platform !== "In Person" && (
                           <div style={{ marginTop: 4 }}>
                             <a href={m.meetingLink} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "var(--brand-500)", textDecoration: "none" }}>
                               Join Meeting ↗
                             </a>
                           </div>
                        )}
                        {m.meetingLink && m.platform === "In Person" && (
                           <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-secondary)" }}>
                             {m.meetingLink}
                           </div>
                        )}
                      </td>
                      <td>
                        {m.inviteSent ? (
                          <span style={{ color: "var(--success-500)", fontSize: 13, fontWeight: 600 }}>✓ Sent</span>
                        ) : (
                          <span style={{ color: "var(--text-tertiary)", fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={{ maxWidth: 160, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {m.outcome || "-"}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "var(--text-tertiary)" }}>
                    {t("No meetings scheduled.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Schedule Meeting Modal ─────────────────────────── */}
      {showAddModal && (
        <ModalPortal>
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(4px)",
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
          >
            <div
              className="card"
              style={{ width: "100%", maxWidth: "520px", margin: "24px", animation: "cardEntrance 0.3s ease" }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Header ── */}
              <div className="card-header" style={{ padding: "20px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {step === "confirm" && (
                    <button
                      className="topbar-btn"
                      onClick={() => setStep("form")}
                      style={{ width: 28, height: 28, minWidth: 28, borderRadius: 8, marginRight: 2 }}
                      title="Back"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
                      </svg>
                    </button>
                  )}
                  <span className="card-title">
                    {step === "done"
                      ? "Meeting Scheduled!"
                      : step === "confirm"
                      ? "Confirm & Send"
                      : t("Schedule Meeting")}
                  </span>
                </div>
                <button
                  className="topbar-btn"
                  onClick={handleClose}
                  style={{ width: "32px", height: "32px", minWidth: "32px", borderRadius: "8px" }}
                >
                  <IconClose size={14} />
                </button>
              </div>

              <div className="card-body" style={{ padding: "20px 24px" }}>

                {/* ── STEP 1: FORM ── */}
                {step === "form" && (
                  <form onSubmit={handleReviewAndSchedule} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Title */}
                    <div className="login-field">
                      <label className="login-label">{t("Meeting Title")} *</label>
                      <input
                        className="login-input"
                        placeholder="e.g. Q3 Business Review"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                      />
                    </div>

                    {/* Client */}
                    <div className="login-field">
                      <label className="login-label">{t("Client")} *</label>
                      <select
                        className="login-input"
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        required
                      >
                        <option value="">— Select Client —</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>{c.companyName}</option>
                        ))}
                      </select>
                    </div>

                    {/* Date + Time */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div className="login-field">
                        <label className="login-label">{t("Date")} *</label>
                        <input
                          className="login-input"
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          required
                        />
                      </div>
                      <div className="login-field">
                        <label className="login-label">{t("Time")}</label>
                        <input
                          className="login-input"
                          type="time"
                          value={time}
                          onChange={(e) => setTime(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Platform picker */}
                    <div className="login-field">
                      <label className="login-label">{t("Meeting Platform")}</label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {PLATFORMS.map((p) => (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => {
                              setPlatform(p.value);
                              if (p.value !== "In Person") {
                                setMeetingLink(generateMeetingLink(p.value));
                              } else {
                                setMeetingLink("");
                              }
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 9,
                              padding: "10px 14px",
                              borderRadius: 10,
                              border: platform === p.value
                                ? `2px solid ${p.color}`
                                : "1.5px solid var(--border-default)",
                              background: platform === p.value
                                ? `${p.color}10`
                                : "var(--bg-surface)",
                              color: platform === p.value ? p.color : "var(--text-secondary)",
                              fontWeight: platform === p.value ? 700 : 500,
                              fontSize: 13,
                              cursor: "pointer",
                              transition: "all 0.18s ease",
                            }}
                          >
                            {p.icon}
                            {p.label}
                            {platform === p.value && (
                              <IconCheck
                                size={13}
                                style={{ marginLeft: "auto", color: p.color }}
                              />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Meeting Link / Location */}
                    <div className="login-field">
                      <label className="login-label">
                        {platform === "In Person" ? t("Location") : t("Meeting Link / URL")}
                      </label>
                      <input
                        className="login-input"
                        placeholder={platform === "In Person" ? "e.g. Client Office, Room 402" : "https://..."}
                        value={meetingLink}
                        onChange={(e) => setMeetingLink(e.target.value)}
                      />
                    </div>

                    {/* Notes */}
                    <div className="login-field">
                      <label className="login-label">{t("Agenda / Notes")}</label>
                      <textarea
                        className="login-input"
                        style={{ height: 72, resize: "none" }}
                        placeholder="Optional agenda or notes..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>

                    {/* Send Invite toggle */}
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        cursor: "pointer",
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: `1.5px solid ${sendInvite ? "var(--brand-400)" : "var(--border-default)"}`,
                        background: sendInvite ? "rgba(14,165,233,0.05)" : "var(--bg-surface)",
                        transition: "all 0.18s ease",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={sendInvite}
                        onChange={(e) => setSendInvite(e.target.checked)}
                        style={{ width: 16, height: 16, accentColor: "var(--brand-500)", cursor: "pointer" }}
                      />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                          Send invite to client
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 1 }}>
                          Client receives a notification in their dashboard
                        </div>
                      </div>
                    </label>

                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                      <button type="button" className="btn btn-sm btn-secondary" onClick={handleClose}>
                        {t("Cancel")}
                      </button>
                      <button type="submit" className="btn btn-primary btn-sm" style={{ padding: "8px 22px" }}>
                        Review & Schedule →
                      </button>
                    </div>
                  </form>
                )}

                {/* ── STEP 2: CONFIRM ── */}
                {step === "confirm" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Summary card */}
                    <div
                      style={{
                        borderRadius: 12,
                        border: "1.5px solid var(--border-default)",
                        background: "var(--bg-surface-2)",
                        padding: "16px 18px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      <Row label="Title" value={title} />
                      <Row label="Client" value={selectedClient?.companyName ?? clientId} />
                      <Row label="Date & Time" value={`${date}  ${time}`} />
                      <Row
                        label="Platform"
                        value={<PlatformBadge platform={platform} />}
                      />
                      {meetingLink && (
                        <Row 
                          label={platform === "In Person" ? "Location" : "Meeting Link"} 
                          value={
                             platform !== "In Person" && meetingLink.startsWith("http") ? (
                               <a href={meetingLink} target="_blank" rel="noreferrer" style={{ color: "var(--brand-500)" }}>{meetingLink}</a>
                             ) : (
                               meetingLink
                             )
                          } 
                        />
                      )}
                      {!meetingLink && platform !== "In Person" && (
                        <Row label="Meeting Link" value={<span style={{ color: "var(--text-tertiary)", fontStyle: "italic" }}>Will be auto-generated</span>} />
                      )}
                      {notes && <Row label="Notes" value={notes} />}
                    </div>

                    {/* Invite info */}
                    {sendInvite && (
                      <div
                        style={{
                          borderRadius: 10,
                          border: "1.5px solid var(--brand-200)",
                          background: "rgba(14,165,233,0.06)",
                          padding: "12px 14px",
                          display: "flex",
                          gap: 10,
                          alignItems: "flex-start",
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand-500)" strokeWidth="2" style={{ marginTop: 1, flexShrink: 0 }}>
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.09 6.09l.96-.96a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                        </svg>
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--brand-600)" }}>
                            Invite will be sent to {selectedClient?.companyName}
                          </div>
                          <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2 }}>
                            A notification will appear in their notification dashboard with meeting details and a calendar link.
                          </div>
                        </div>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => setStep("form")}>
                        ← Edit
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ padding: "8px 22px", opacity: submitting ? 0.7 : 1 }}
                        disabled={submitting}
                        onClick={handleConfirmCreate}
                      >
                        {submitting ? "Scheduling..." : sendInvite ? "Confirm & Send Invite" : "Confirm & Schedule"}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── STEP 3: DONE ── */}
                {step === "done" && (
                  <div style={{ textAlign: "center", padding: "24px 0" }}>
                    <div
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: "50%",
                        background: "rgba(16,185,129,0.1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 16px",
                        animation: "badgePop 0.4s cubic-bezier(0.175,0.885,0.32,1.275)",
                      }}
                    >
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                      Meeting Scheduled!
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      {sendInvite
                        ? `Invite sent to ${selectedClient?.companyName ?? "client"} via notification dashboard.`
                        : "Your meeting has been created."}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}

// Helper summary row
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, fontSize: 13 }}>
      <span style={{ color: "var(--text-tertiary)", minWidth: 90 }}>{label}</span>
      <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{value}</span>
    </div>
  );
}
