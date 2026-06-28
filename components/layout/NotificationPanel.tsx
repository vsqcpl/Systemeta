"use client";

import React, { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, useTranslation } from "@/lib/store";
import {
  IconCircleDot,
  IconClipboard,
  IconAlert,
  IconInfo,
  IconCheckCircle,
  IconPin,
} from "@/components/ui/Icons";

interface NotificationPanelProps {
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  filterCategory?: "project" | "timesheet" | "general";
}

export default function NotificationPanel({ buttonRef, filterCategory }: NotificationPanelProps) {
  const router = useRouter();
  const notifOpen = useAppStore((state) => state.notifOpen);
  const setNotifOpen = useAppStore((state) => state.setNotifOpen);
  const notifications = useAppStore((state) => state.data.notifications);
  const markNotificationRead = useAppStore((state) => state.markNotificationRead);
  const markAllNotificationsRead = useAppStore((state) => state.markAllNotificationsRead);

  const { t } = useTranslation();

  const panelRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside of the button or panel
  useEffect(() => {
    if (!notifOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const btn = buttonRef.current;
      const panel = panelRef.current;
      if (btn && !btn.contains(e.target as Node) && panel && !panel.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };

    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [notifOpen, setNotifOpen, buttonRef]);

  if (!notifOpen) return null;

  // Filter notifications by category when a module-specific filter is provided
  const visibleNotifications = filterCategory
    ? notifications.filter((n) => n.category === filterCategory)
    : notifications;

  const unread = visibleNotifications.filter((n) => !n.read).length;

  const emojiIcons: Record<string, React.ReactNode> = {
    alert: <IconCircleDot size={14} style={{ color: "#ef4444" }} />,
    approval: <IconClipboard size={14} style={{ color: "var(--brand-600)" }} />,
    risk: <IconAlert size={14} style={{ color: "#f59e0b" }} />,
    info: <IconInfo size={14} style={{ color: "var(--brand-500)" }} />,
    success: <IconCheckCircle size={14} style={{ color: "#10b981" }} />,
  };

  const buttonRect = buttonRef.current?.getBoundingClientRect();
  const top = buttonRect ? buttonRect.bottom + 8 : 60;

  const panelTitle =
    filterCategory === "project"
      ? t("Project Notifications")
      : filterCategory === "timesheet"
      ? t("Timesheet Notifications")
      : t("Notifications");

  const getDestinationUrl = (notif: any) => {
    const msg = (notif.message || "").toLowerCase();
    const title = (notif.title || "").toLowerCase();

    if (title.includes("meeting") || msg.includes("meeting")) {
      return "/meetings";
    }
    if (title.includes("call") || msg.includes("call")) {
      return "/calls";
    }
    if (title.includes("contact") || msg.includes("contact")) {
      return "/contacts";
    }
    if (title.includes("leave") || msg.includes("leave")) {
      return "/leave";
    }
    if (title.includes("expense") || msg.includes("expense")) {
      return "/expenses";
    }
    if (title.includes("timesheet") || msg.includes("timesheet")) {
      return "/timesheets";
    }
    if (title.includes("requirement") || msg.includes("requirement")) {
      return "/requirements";
    }
    if (title.includes("opportunity") || msg.includes("opportunity")) {
      return "/opportunities";
    }
    if (title.includes("escalation") || msg.includes("escalation")) {
      return "/escalations";
    }
    if (title.includes("client") || msg.includes("client")) {
      return "/clients";
    }
    if (title.includes("project") || msg.includes("project")) {
      return "/projects";
    }
    return null;
  };

  const handleNotifClick = (n: any) => {
    markNotificationRead(n.id);
    setNotifOpen(false);
    const dest = getDestinationUrl(n);
    if (dest) {
      router.push(dest);
    }
  };

  return (
    <div
      ref={panelRef}
      className="notification-panel"
      style={{
        position: "fixed",
        top: `${top}px`,
        right: "24px",
        zIndex: 999,
        maxHeight: "480px",
        overflowY: "auto",
      }}
    >
      <div className="notification-header">
        <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
          {panelTitle}
        </span>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {unread > 0 ? <span className="badge badge-danger">{unread} {t("new")}</span> : null}
          <button
            className="btn btn-ghost btn-sm"
            onClick={markAllNotificationsRead}
            style={{ padding: "4px 8px", fontSize: "11px" }}
          >
            {t("Mark all read")}
          </button>
        </div>
      </div>
      {visibleNotifications.length === 0 ? (
        <div style={{ padding: "16px", color: "var(--text-tertiary)", fontSize: "12px", textAlign: "center" }}>
          {t("No notifications")}
        </div>
      ) : (
        visibleNotifications.map((n) => (
          <div
            key={n.id}
            className={`notification-item ${n.read ? "" : "unread"}`}
            onClick={() => handleNotifClick(n)}
            style={{ cursor: "pointer" }}
          >
            <div
              className="notif-icon"
              style={{
                background: n.read ? "var(--bg-surface-2)" : "var(--brand-50)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {emojiIcons[n.type as keyof typeof emojiIcons] || <IconPin size={14} />}
            </div>
            <div style={{ flex: 1 }}>
              <div className="notif-title">{n.title}</div>
              <div className="notif-msg">{n.message}</div>
              <div className="notif-time">{n.time}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
