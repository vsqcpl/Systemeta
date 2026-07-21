"use client";

import React, { useState } from "react";
import { useAppStore } from "@/lib/store";
import ModalPortal from "@/components/ui/ModalPortal";
import { IconClose } from "@/components/ui/Icons";

export default function ChangePasswordModal() {
  const isChangePasswordModalOpen = useAppStore((state) => state.isChangePasswordModalOpen);
  const setChangePasswordModalOpen = useAppStore((state) => state.setChangePasswordModalOpen);
  const showToast = useAppStore((state) => state.showToast);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isChangePasswordModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      showToast("Please fill in all fields", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (res.ok) {
        showToast("Password changed successfully", "success");
        setChangePasswordModalOpen(false);
        setCurrentPassword("");
        setNewPassword("");
      } else {
        const err = await res.json();
        showToast(err.message || "Failed to change password", "danger");
      }
    } catch (err) {
      showToast("Network error", "danger");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div 
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999
        }}
        onClick={() => setChangePasswordModalOpen(false)}
      >
        <div 
          className="card"
          style={{
            width: "100%",
            maxWidth: "420px",
            borderRadius: "16px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            overflow: "hidden",
            animation: "cardEntrance 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="card-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)" }}>
            <h2 className="card-title" style={{ fontSize: "18px", margin: 0 }}>Change Password</h2>
            <button 
              onClick={() => setChangePasswordModalOpen(false)}
              className="topbar-btn"
              style={{ width: "32px", height: "32px", minWidth: "32px", borderRadius: "8px" }}
            >
              <IconClose size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="card-body" style={{ padding: "24px" }}>
            <p style={{ fontSize: "13.5px", color: "var(--text-secondary)", marginBottom: "24px" }}>
              When you change your password, we keep you logged in to this device but may log you out from your other devices.
            </p>
            
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>
                  Current password
                </label>
                <input 
                  type="password" 
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="input" 
                  style={{ width: "100%", fontSize: "13px" }} 
                  autoComplete="current-password"
                />
              </div>
              
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>
                  New password
                </label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input" 
                  style={{ width: "100%", fontSize: "13px" }} 
                  autoComplete="new-password"
                />
              </div>

              <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button 
                  type="button" 
                  onClick={() => setChangePasswordModalOpen(false)} 
                  className="btn btn-secondary" 
                  style={{ padding: "8px 16px", fontSize: "13px" }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ padding: "8px 16px", fontSize: "13px" }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
