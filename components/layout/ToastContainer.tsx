"use client";

import React, { useEffect } from "react";
import { useAppStore } from "@/lib/store";

export default function ToastContainer() {
  const toast = useAppStore((state) => state.toast);
  const clearToast = useAppStore((state) => state.clearToast);

  useEffect(() => {
    if (toast) {
      const duration = toast.type === "danger" || toast.type === "warning" ? 4000 : 3000;
      const timer = setTimeout(() => {
        clearToast();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [toast, clearToast]);

  if (!toast) return null;

  const bgColors = {
    success: "#10b981",
    danger: "#ef4444",
    info: "#2563eb",
    warning: "#f59e0b",
  };

  const backgroundColor = bgColors[toast.type] || bgColors.info;

  return (
    <div
      id="vsqc-toast"
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        backgroundColor,
        color: "white",
        padding: "12px 24px",
        borderRadius: "8px",
        fontSize: "13.5px",
        fontWeight: 600,
        boxShadow: "0 10px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.3)",
        zIndex: 9999,
        whiteSpace: "nowrap",
        animation: "toastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      }}
    >
      {toast.message}
    </div>
  );
}
