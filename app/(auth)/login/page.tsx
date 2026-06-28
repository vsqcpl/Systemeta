"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const router = useRouter();
  const darkMode = useAppStore((state) => state.darkMode);
  const setDarkMode = useAppStore((state) => state.setDarkMode);
  const showToast = useAppStore((state) => state.showToast);

  const { login, error: authError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authError) setError(authError);
  }, [authError]);

  useEffect(() => {
    // Focus email input on load
    const el = document.getElementById("login-email");
    if (el) el.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await login(email, password);
    setLoading(false);
    
    if (result.success) {
      showToast("Signed in successfully", "success");
    } else {
      setError(result.message || "Invalid email or password.");
    }
  };

  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

  return (
    <div className="login-page">
      {/* Floating Theme Toggle */}
      <div
        className="theme-toggle-fixed"
        onClick={toggleTheme}
        style={{ cursor: "pointer" }}
        title={darkMode ? "Light mode" : "Dark mode"}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          {darkMode ? (
            <>
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </>
          ) : (
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          )}
        </svg>
      </div>

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
          background: "linear-gradient(180deg, var(--brand-600), var(--brand-400))",
          zIndex: 600,
        }}
      ></div>

      <div className="login-card">
        {/* Logo */}
        <div className="login-logo-wrap">
          <div className="login-logo-mark">VS</div>
          <div>
            <div className="login-logo-name">VSQC Platform</div>
            <div className="login-logo-sub">Enterprise Operations Suite</div>
          </div>
        </div>

        <div className="login-divider"></div>

        <h2 className="login-title">Welcome back</h2>
        <p className="login-subtitle">Sign in to continue to your workspace</p>

        {error && (
          <div style={{ color: "#ef4444", background: "#fef2f2", padding: "12px", borderRadius: "8px", marginBottom: "16px", fontSize: "14px", fontWeight: 500, border: "1px solid #f87171" }}>
            {error}
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label className="login-label" htmlFor="login-email">
              Email address
            </label>
            <input
              className="login-input"
              id="login-email"
              type="email"
              placeholder="Enter email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="login-field">
            <label className="login-label" htmlFor="login-password">
              Password
              <a
                href="#"
                className="login-forgot"
                onClick={(e) => e.preventDefault()}
              >
                Forgot password?
              </a>
            </label>
            <div className="login-pass-wrap">
              <input
                className="login-input"
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-eye"
                onClick={() => setShowPassword(!showPassword)}
                id="eye-btn"
                style={{ background: "transparent", border: "none" }}
              >
                <svg
                  id="eye-icon"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  {showPassword ? (
                    <>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </>
                  ) : (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>

          <div className="login-remember">
            <label className="login-check-label">
              <input type="checkbox" defaultChecked /> Remember me for 30 days
            </label>
          </div>

          <button
            type="submit"
            className={`login-btn ${loading ? "login-btn-loading" : ""}`}
            id="login-submit"
            disabled={loading}
          >
            <span id="login-btn-text">
              {loading ? "Signing in..." : "Sign In"}
            </span>
            {!loading && (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            )}
          </button>
        </form>

        {/* Divider with version badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "24px" }}>
          <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }}></div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--text-tertiary)",
              letterSpacing: "0.5px",
            }}
          >
            VSQC v3.1
          </span>
          <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }}></div>
        </div>
      </div>
    </div>
  );
}
