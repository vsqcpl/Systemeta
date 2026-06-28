"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { getPostLoginRedirect } from "@/lib/redirectMap";
import { KeyRound, Check, X } from "lucide-react";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, dispatch, logout } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Validation checks as user types
  const lengthValid = newPassword.length >= 8;
  const uppercaseValid = /[A-Z]/.test(newPassword);
  const numberValid = /[0-9]/.test(newPassword);
  const matchValid = newPassword && newPassword === confirmPassword;

  const isFormValid = lengthValid && uppercaseValid && numberValid && matchValid && currentPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? "Failed to change password");
      }

      setSuccess(true);
      
      // Refresh AuthContext with updated must_change_password = false user profile
      const meRes = await fetch("/api/auth/me");
      if (meRes.ok) {
        const updatedUser = await meRes.json();
        dispatch({ type: "AUTH_SUCCESS", payload: updatedUser });
        
        setTimeout(() => {
          const dest = getPostLoginRedirect(updatedUser.role);
          router.replace(dest);
        }, 1500);
      } else {
        router.replace("/login");
      }
    } catch (err: any) {
      setErrorMsg(err.message ?? "An error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Background orbs */}
      <div className="login-orb login-orb-1"></div>
      <div className="login-orb login-orb-2"></div>

      {/* Branded side strip */}
      <div
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          width: "5px",
          background: "linear-gradient(180deg, var(--brand-600), var(--brand-400))",
          zIndex: 600,
        }}
      ></div>

      <div className="login-card" style={{ width: "min(460px, 90%)" }}>
        {/* Header */}
        <div className="login-logo-wrap">
          <div className="login-logo-mark">VS</div>
          <div>
            <div className="login-logo-name">Update Password</div>
            <div className="login-logo-sub">Security Policy Enforcement</div>
          </div>
        </div>

        <div className="login-divider"></div>

        {success ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                background: "rgba(16, 185, 129, 0.1)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--success-500, #10b981)",
                margin: "0 auto 16px auto",
              }}
            >
              <Check size={24} />
            </div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>Password Changed!</h3>
            <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginTop: "8px" }}>
              Your password has been successfully updated. Redirecting to workspace...
            </p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px", lineHeight: "1.5" }}>
              Your administrator has flagged this account for a password change. Please set a secure password to activate your session.
            </p>

            {errorMsg && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "rgba(239, 68, 68, 0.08)",
                  borderRadius: "8px",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  fontSize: "12px",
                  color: "var(--danger-500, #ef4444)",
                  marginBottom: "16px",
                }}
              >
                {errorMsg}
              </div>
            )}

            <form className="login-form" onSubmit={handleSubmit}>
              {/* Current Password */}
              <div className="login-field">
                <label className="login-label" htmlFor="curr-password">
                  Current Temporary Password
                </label>
                <input
                  className="login-input"
                  id="curr-password"
                  type="password"
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {/* New Password */}
              <div className="login-field">
                <label className="login-label" htmlFor="new-password">
                  New Password
                </label>
                <input
                  className="login-input"
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {/* Confirm Password */}
              <div className="login-field" style={{ marginBottom: "20px" }}>
                <label className="login-label" htmlFor="confirm-password">
                  Confirm New Password
                </label>
                <input
                  className="login-input"
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {/* Validation Indicators */}
              <div
                style={{
                  padding: "12px",
                  background: "var(--bg-surface-2, #f8fafc)",
                  borderRadius: "8px",
                  border: "1px solid var(--border-subtle, #e2e8f0)",
                  marginBottom: "24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Password Requirements:
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: lengthValid ? "var(--success-600)" : "var(--text-secondary)" }}>
                  {lengthValid ? <Check size={12} color="#10b981" /> : <X size={12} color="#ef4444" />}
                  At least 8 characters
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: uppercaseValid ? "var(--success-600)" : "var(--text-secondary)" }}>
                  {uppercaseValid ? <Check size={12} color="#10b981" /> : <X size={12} color="#ef4444" />}
                  At least one uppercase letter
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: numberValid ? "var(--success-600)" : "var(--text-secondary)" }}>
                  {numberValid ? <Check size={12} color="#10b981" /> : <X size={12} color="#ef4444" />}
                  At least one number
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: matchValid ? "var(--success-600)" : "var(--text-secondary)" }}>
                  {matchValid ? <Check size={12} color="#10b981" /> : <X size={12} color="#ef4444" />}
                  Passwords match
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", width: "100%" }}>
                <button
                  type="submit"
                  className="login-btn"
                  disabled={loading || !isFormValid}
                  style={{ flex: 1 }}
                >
                  {loading ? "Updating..." : "Update Password"}
                </button>
                <button
                  type="button"
                  className="login-btn"
                  onClick={() => logout()}
                  style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-default)", flex: 0.5 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
