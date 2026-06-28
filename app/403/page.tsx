"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { ShieldAlert, LogOut, ArrowLeft } from "lucide-react";

export default function ForbiddenPage() {
  const router = useRouter();
  const { logout, user } = useAuth();

  return (
    <div className="login-page">
      {/* Background orbs */}
      <div className="login-orb login-orb-1"></div>
      <div className="login-orb login-orb-2"></div>
      <div className="login-orb login-orb-3"></div>

      {/* Branded side strip */}
      <div
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          width: "5px",
          background: "linear-gradient(180deg, var(--danger-600, #dc2626), var(--danger-400, #f87171))",
          zIndex: 600,
        }}
      ></div>

      <div className="login-card" style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* Warning Icon */}
        <div
          style={{
            width: "56px",
            height: "56px",
            background: "rgba(220, 38, 38, 0.1)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--danger-500, #ef4444)",
            marginBottom: "16px",
          }}
        >
          <ShieldAlert size={28} />
        </div>

        <h2 className="login-title" style={{ color: "var(--text-primary)" }}>403 Access Denied</h2>
        <p className="login-subtitle" style={{ maxWidth: "320px", margin: "8px auto 24px auto" }}>
          You do not have the required permissions to view this page.
        </p>

        {user && (
          <div
            style={{
              padding: "10px 14px",
              background: "var(--bg-surface-2, #f8fafc)",
              borderRadius: "8px",
              border: "1px solid var(--border-subtle, #e2e8f0)",
              fontSize: "12px",
              color: "var(--text-secondary)",
              marginBottom: "24px",
              width: "100%",
            }}
          >
            Signed in as: <strong style={{ color: "var(--text-primary)" }}>{user.name}</strong> ({user.role})
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
          <button
            type="button"
            className="login-btn"
            onClick={() => router.back()}
            style={{ background: "var(--brand-600)", borderColor: "var(--brand-600)" }}
          >
            <ArrowLeft size={16} />
            Go Back
          </button>
          
          <button
            type="button"
            className="login-btn"
            onClick={() => logout()}
            style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-default)" }}
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
