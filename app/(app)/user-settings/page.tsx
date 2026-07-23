"use client";

import React, { useState } from "react";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";



type SettingsSection = "security" | "projectTypes";

export default function UserSettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("security");
  const setChangePasswordModalOpen = useAppStore(
    (state) => state.setChangePasswordModalOpen
  );
  const { user } = useAuth();
  
  const projectTypes = useAppStore(s => s.projectTypes);
  const setProjectTypes = useAppStore(s => s.setProjectTypes);
  const showToast = useAppStore(s => s.showToast);

  const [newType, setNewType] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleAddType = async () => {
    if (!newType.trim()) return;
    const typeStr = newType.trim();
    if (projectTypes.includes(typeStr)) {
      showToast("Project type already exists", "warning");
      return;
    }
    
    setIsSaving(true);
    try {
      const updatedTypes = [...projectTypes, typeStr];
      const res = await fetch('/api/branding');
      const data = await res.ok ? await res.json() : {};
      
      const payload = {
        ...data,
        companyName: data.companyName || "Systemeta",
        projectTypes: JSON.stringify(updatedTypes)
      };

      const putRes = await fetch('/api/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (putRes.ok) {
        setProjectTypes(updatedTypes);
        setNewType("");
        showToast("Project type added successfully", "success");
      } else {
        showToast("Failed to add project type", "danger");
      }
    } catch (error) {
      console.error(error);
      showToast("Error adding project type", "danger");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveType = async (typeToRemove: string) => {
    setIsSaving(true);
    try {
      const updatedTypes = projectTypes.filter(t => t !== typeToRemove);
      const res = await fetch('/api/branding');
      const data = await res.ok ? await res.json() : {};
      
      const payload = {
        ...data,
        companyName: data.companyName || "Systemeta",
        projectTypes: JSON.stringify(updatedTypes)
      };

      const putRes = await fetch('/api/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (putRes.ok) {
        setProjectTypes(updatedTypes);
        showToast("Project type removed successfully", "success");
      } else {
        showToast("Failed to remove project type", "danger");
      }
    } catch (error) {
      console.error(error);
      showToast("Error removing project type", "danger");
    } finally {
      setIsSaving(false);
    }
  };

  const initials = user
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : "??";

  const displayRole = user
    ? user.role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "";

  const sections: { id: SettingsSection; label: string; icon: React.ReactNode }[] =
    [
      {
        id: "security",
        label: "Security",
        icon: (
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        ),
      },
    ];
    
  if (user?.role === "super_admin") {
    sections.push({
      id: "projectTypes",
      label: "Project Types",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
      )
    });
  }

  return (
    <div className="screen" style={{ padding: "24px 28px" }}>
      {/* Page header */}
      <div className="page-header" style={{ marginBottom: "28px" }}>
        <h1 className="page-title" style={{ fontSize: "22px", fontWeight: 700 }}>
          User Settings
        </h1>
        <p
          style={{
            color: "var(--text-secondary)",
            fontSize: "13.5px",
            marginTop: "4px",
          }}
        >
          Manage your personal account preferences and security settings.
        </p>
      </div>

      <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>
        {/* Left panel: profile card + section nav */}
        <div style={{ width: "220px", flexShrink: 0 }}>
          {/* Profile card */}
          <div
            className="card"
            style={{
              padding: "20px 16px",
              textAlign: "center",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "50%",
                background: "var(--brand-100, #dbeafe)",
                color: "var(--brand-700, #1e4976)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "18px",
                margin: "0 auto 12px",
              }}
            >
              {initials}
            </div>
            <div
              style={{
                fontWeight: 600,
                fontSize: "14px",
                color: "var(--text-primary)",
              }}
            >
              {user?.name ?? "—"}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "var(--text-secondary)",
                marginTop: "2px",
              }}
            >
              {displayRole}
            </div>
            <div
              style={{
                fontSize: "11.5px",
                color: "var(--text-secondary)",
                marginTop: "4px",
                wordBreak: "break-all",
              }}
            >
              {user?.email ?? ""}
            </div>
          </div>

          {/* Section nav */}
          <nav
            className="card"
            style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "2px" }}
          >
            {sections.map((s) => {
              const isActive = activeSection === s.id;
              return (
                <button
                  key={s.id}
                  id={`user-settings-nav-${s.id}`}
                  onClick={() => setActiveSection(s.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "13.5px",
                    fontWeight: isActive ? 600 : 500,
                    color: isActive
                      ? "var(--brand-600, #2563eb)"
                      : "var(--text-secondary)",
                    background: isActive
                      ? "var(--brand-50, #eff6ff)"
                      : "transparent",
                    width: "100%",
                    textAlign: "left",
                    transition: "background 0.15s, color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive)
                      e.currentTarget.style.background = "var(--bg-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive)
                      e.currentTarget.style.background = "transparent";
                  }}
                >
                  {s.icon}
                  {s.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right panel: section content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {activeSection === "security" && (
            <div className="card" style={{ padding: "28px" }}>
              {/* Section header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "24px",
                  paddingBottom: "16px",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: "var(--brand-50, #eff6ff)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--brand-600, #2563eb)",
                  }}
                >
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div>
                  <h2
                    style={{
                      fontSize: "16px",
                      fontWeight: 700,
                      margin: 0,
                      color: "var(--text-primary)",
                    }}
                  >
                    Security
                  </h2>
                  <p
                    style={{
                      fontSize: "12.5px",
                      color: "var(--text-secondary)",
                      margin: 0,
                      marginTop: "2px",
                    }}
                  >
                    Manage your password and account access.
                  </p>
                </div>
              </div>

              {/* Change Password row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "18px 20px",
                  borderRadius: "10px",
                  border: "1px solid var(--border-subtle)",
                  background: "var(--bg-surface, var(--bg-subtle))",
                  gap: "16px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "14px",
                      color: "var(--text-primary)",
                      marginBottom: "3px",
                    }}
                  >
                    Password
                  </div>
                  <div
                    style={{ fontSize: "13px", color: "var(--text-secondary)" }}
                  >
                    Update your current password to keep your account secure.
                    Changing your password will keep you logged in on this device.
                  </div>
                </div>
                <button
                  id="user-settings-change-password-btn"
                  className="btn btn-primary"
                  style={{
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    fontSize: "13px",
                    padding: "8px 18px",
                  }}
                  onClick={() => setChangePasswordModalOpen(true)}
                >
                  Change Password
                </button>
              </div>


            </div>
          )}

          {activeSection === "projectTypes" && user?.role === "super_admin" && (
            <div className="card" style={{ padding: "28px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "24px",
                  paddingBottom: "16px",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: "var(--brand-50, #eff6ff)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--brand-600, #2563eb)",
                  }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                  </svg>
                </div>
                <div>
                  <h2
                    style={{
                      fontSize: "16px",
                      fontWeight: 700,
                      margin: 0,
                      color: "var(--text-primary)",
                    }}
                  >
                    Project Types
                  </h2>
                  <p
                    style={{
                      fontSize: "12.5px",
                      color: "var(--text-secondary)",
                      margin: 0,
                      marginTop: "2px",
                    }}
                  >
                    Manage the available project types for the organization.
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <input
                    type="text"
                    className="login-input"
                    placeholder="New Project Type (e.g. AI Implementation)"
                    value={newType}
                    onChange={(e) => setNewType(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddType();
                    }}
                    style={{ maxWidth: "300px" }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={handleAddType}
                    disabled={!newType.trim() || isSaving}
                  >
                    {isSaving ? "Saving..." : "Add"}
                  </button>
                </div>
                
                <div style={{ marginTop: "16px" }}>
                  <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "12px" }}>Current Project Types</h3>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                    {projectTypes.map(type => (
                      <div key={type} style={{
                        display: "flex", alignItems: "center", gap: "8px", 
                        padding: "6px 12px", background: "var(--bg-subtle)", 
                        border: "1px solid var(--border-subtle)", borderRadius: "20px",
                        fontSize: "13px", fontWeight: 500
                      }}>
                        {type}
                        <button 
                          onClick={() => handleRemoveType(type)}
                          disabled={isSaving || projectTypes.length <= 1}
                          style={{
                            background: "transparent", border: "none", cursor: projectTypes.length <= 1 ? "not-allowed" : "pointer",
                            color: "var(--danger-500)", padding: "2px", display: "flex", alignItems: "center", opacity: projectTypes.length <= 1 ? 0.5 : 1
                          }}
                          title={projectTypes.length <= 1 ? "Cannot remove last type" : "Remove"}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

