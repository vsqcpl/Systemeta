"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAppStore, useTranslation } from "@/lib/store";
import { Check, X, Ban, RefreshCw, KeyRound, CheckCircle, Search, FileDown, Trash2, Shield, AlertTriangle, Clock } from "lucide-react";
import RouteGuard from "@/components/guards/RouteGuard";
import { ROLES } from "@/lib/roles";
import ActionGuard from "@/components/guards/ActionGuard";

const CURRENCIES = [
  { symbol: "₹", name: "Indian Rupee", code: "INR", label: "₹ Indian Rupee (INR)" },
  { symbol: "$", name: "US Dollar", code: "USD", label: "$ US Dollar (USD)" },
  { symbol: "€", name: "Euro", code: "EUR", label: "€ Euro (EUR)" },
  { symbol: "£", name: "British Pound", code: "GBP", label: "£ British Pound (GBP)" },
  { symbol: "¥", name: "Japanese Yen", code: "JPY", label: "¥ Japanese Yen (JPY)" },
  { symbol: "AED", name: "UAE Dirham", code: "AED", label: "AED UAE Dirham (AED)" },
  { symbol: "SAR", name: "Saudi Riyal", code: "SAR", label: "SAR Saudi Riyal (SAR)" },
  { symbol: "SGD", name: "Singapore Dollar", code: "SGD", label: "SGD Singapore Dollar (SGD)" },
  { symbol: "AUD", name: "Australian Dollar", code: "AUD", label: "AUD Australian Dollar (AUD)" },
];

const LANGUAGES = [
  { id: "en-IN", label: "English (India)" },
  { id: "en-US", label: "English (US)" },
  { id: "en-GB", label: "English (UK)" },
  { id: "hi", label: "Hindi (हिंदी)" },
  { id: "ar", label: "Arabic (عربي)" },
  { id: "fr", label: "French (Français)" },
  { id: "de", label: "German (Deutsch)" },
  { id: "es", label: "Spanish (Español)" },
];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const TIMEZONES = [
  {
    group: "common",
    zones: [
      { id: "Asia/Dubai", label: "Asia/Dubai (UTC+4)" },
      { id: "Asia/Kolkata", label: "Asia/Kolkata (UTC+5:30)" },
      { id: "Europe/London", label: "Europe/London (GMT/BST)" },
      { id: "America/New_York", label: "America/New_York (EST/EDT)" },
    ],
  },
];

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  super_admin: "Super Admin",
  client_manager: "Client Manager",
  project_manager: "Project Manager",
  senior_consultant: "Senior Consultant",
  consultant: "Consultant",
  accounts: "Accounts",
  client_contact: "Client Contact",
};

function AdminPageContent() {
  const data = useAppStore((state) => state.data);
  const showToast = useAppStore((state) => state.showToast);
  const currencyFormat = useAppStore((state) => state.currencyFormat);
  const setCurrencyFormat = useAppStore((state) => state.setCurrencyFormat);
  const setCurrencySymbol = useAppStore((state) => state.setCurrencySymbol);
  const setTimezone = useAppStore((state) => state.setTimezone);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const loggedInUser = useAppStore((state) => state.user);
  const deleteUser = useAppStore((state) => state.deleteUser);

  // Override actions and state from store
  const permissionOverrides = useAppStore((state) => state.permissionOverrides);
  const fetchOverrides = useAppStore((state) => state.fetchOverrides);
  const createOverride = useAppStore((state) => state.createOverride);
  const updateOverride = useAppStore((state) => state.updateOverride);
  const deleteOverride = useAppStore((state: any) => state.deleteOverride);

  // Extend override modal state
  const [extendOverrideId, setExtendOverrideId] = useState<string | null>(null);
  const [extendEndDate, setExtendEndDate] = useState<string>("");
  const [extendReason, setExtendReason] = useState<string>("");
  const [isExtending, setIsExtending] = useState(false);

  // Override form states
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [overridePermKey, setOverridePermKey] = useState<string>("");
  const [overrideGranted, setOverrideGranted] = useState<boolean>(true);
  const [overrideReason, setOverrideReason] = useState<string>("");
  const [overrideStartDate, setOverrideStartDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [overrideEndDate, setOverrideEndDate] = useState<string>("");
  const [isCreatingOverride, setIsCreatingOverride] = useState(false);

  const isSuperAdmin = loggedInUser?.role === "super_admin" || loggedInUser?.role === "Super Admin";
  const isProjectManager = loggedInUser?.role === "project_manager" || loggedInUser?.role === "Project Manager";

  // Sub-tab state
  const [rolesSubTab, setRolesSubTab] = useState<"matrix" | "overrides">("matrix");

  // Permissions Matrix States & Handlers
  const matrixRoles = ["Super Admin", "Client Manager", "Project Manager", "Senior Consultant", "Consultant", "Accounts", "Client Contact"];
  const permissionsList = [
    { name: "View Projects",            vals: [true, false, true, true, true, true, true] },
    { name: "Create Projects",          vals: [true, false, true, false, false, false, false] },
    { name: "Approve Timesheets",       vals: [true, false, true, true, false, false, false] },
    { name: "Approve Leave",            vals: [true, false, true, true, false, false, false] },
    { name: "Approve Expenses",         vals: [true, false, true, false, false, true, false] },
    { name: "Admin Panel Access",       vals: [true, false, false, false, false, false, false] },
    { name: "View AI Insights",         vals: [true, true, true, true, true, true, false] },
    { name: "Unlock Project Plans",     vals: [true, false, true, false, false, false, false] },
    { name: "Emergency Project Access",  vals: [true, false, false, false, false, false, false] },
    { name: "Cross-Project Visibility",  vals: [true, false, false, false, false, false, false] },
    { name: "CRM Access",               vals: [true, true, false, false, false, false, false] },
  ];

  const [matrix, setMatrix] = useState<{ name: string; vals: boolean[] }[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("vsqc_permissions_matrix");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (_) {}
      }
    }
    return permissionsList;
  });

  const handleCheckboxToggle = (permIdx: number, roleIdx: number) => {
    const updated = [...matrix];
    updated[permIdx].vals[roleIdx] = !updated[permIdx].vals[roleIdx];
    setMatrix(updated);
  };
  const handleResetMatrix = () => {
    setMatrix(JSON.parse(JSON.stringify(permissionsList)));
    try {
      localStorage.removeItem("vsqc_permissions_matrix");
    } catch (_) {}
    showToast("Permissions matrix reset to default", "info");
  };
  const handleSaveMatrix = () => {
    try {
      localStorage.setItem("vsqc_permissions_matrix", JSON.stringify(matrix));
    } catch (_) {}
    showToast("Permissions matrix changes saved successfully", "success");
  };

  const { t, langCode } = useTranslation();

  const [activeTab, setActiveTab] = useState<"users" | "roles" | "audit" | "settings">("users");
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  useEffect(() => {
    if (tabParam && ["users", "roles", "audit", "settings"].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [tabParam]);

  // Live data states
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Fetch admin data on mount
  const fetchAdminData = async () => {
    setLoadingData(true);
    try {
      const [uRes, aRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/audit")
      ]);
      if (uRes.ok) {
        const uData = await uRes.ok ? await uRes.json() : [];
        setUsers(uData);
      }
      if (aRes.ok) {
        const aData = await aRes.ok ? await aRes.json() : [];
        if (Array.isArray(aData)) {
          aData.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }
        setAuditLogs(aData);
      }
    } catch (err) {
      showToast("Failed to fetch administrative records", "danger");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
    fetchOverrides();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Form settings states
  const [platformName, setPlatformName] = useState("Systemeta");
  const [platformNameError, setPlatformNameError] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("₹ Indian Rupee (INR)");
  const [selectedFiscalYear, setSelectedFiscalYear] = useState("January");
  const [selectedTimezone, setSelectedTimezone] = useState("Asia/Kolkata (UTC+5:30)");
  const [selectedLanguage, setSelectedLanguage] = useState("English (India)");
  const [selectedNumbering, setSelectedNumbering] = useState<'indian' | 'intl'>("indian");

  const [initialSettings, setInitialSettings] = useState({
    platformName: "Systemeta",
    defaultCurrency: "₹ Indian Rupee (INR)",
    fiscalYearStart: "January",
    timezone: "Asia/Kolkata (UTC+5:30)",
    language: "English (India)",
    numberingSystem: "indian"
  });

  const [showTimezoneDropdown, setShowTimezoneDropdown] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [showFiscalYearDropdown, setShowFiscalYearDropdown] = useState(false);

  const [timezoneSearch, setTimezoneSearch] = useState("");
  const [currencySearch, setCurrencySearch] = useState("");

  const [openUpwardTimezone, setOpenUpwardTimezone] = useState(false);
  const [openUpwardLanguage, setOpenUpwardLanguage] = useState(false);
  const [openUpwardCurrency, setOpenUpwardCurrency] = useState(false);
  const [openUpwardFiscal, setOpenUpwardFiscal] = useState(false);

  const timezoneRef = useRef<HTMLDivElement>(null);
  const languageRef = useRef<HTMLDivElement>(null);
  const currencyRef = useRef<HTMLDivElement>(null);
  const fiscalYearRef = useRef<HTMLDivElement>(null);

  const [isSaving, setIsSaving] = useState(false);

  // Notification settings state
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifSlack, setNotifSlack] = useState(true);
  const [notifAiAlerts, setNotifAiAlerts] = useState(true);
  const [notifWeeklyDigest, setNotifWeeklyDigest] = useState(false);
  const [isSavingNotif, setIsSavingNotif] = useState(false);

  // Security settings state
  const [secForceMfa, setSecForceMfa] = useState(false);
  const [secSessionTimeout, setSecSessionTimeout] = useState("60");
  const [secPasswordPolicy, setSecPasswordPolicy] = useState("Strong");
  const [secIpWhitelist, setSecIpWhitelist] = useState(false);
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);

  // Integration settings state
  const [intMs365, setIntMs365] = useState(true);
  const [intSalesforce, setIntSalesforce] = useState(true);
  const [intJira, setIntJira] = useState(false);
  const [intSap, setIntSap] = useState(false);
  const [isSavingIntegrations, setIsSavingIntegrations] = useState(false);

  // Master save
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Emission Factors
  const storeEmissionFactors = useAppStore((state) => state.emissionFactors);
  const setStoreEmissionFactors = useAppStore((state) => state.setEmissionFactors);
  const [adminEmissionFactors, setAdminEmissionFactors] = useState(storeEmissionFactors || {});

  useEffect(() => {
    if (storeEmissionFactors) {
      setAdminEmissionFactors(storeEmissionFactors);
    }
  }, [storeEmissionFactors]);

  // Load settings on mount
  useEffect(() => {
    let platform = "Systemeta";
    let currency = "₹ Indian Rupee (INR)";
    let fiscalYear = "January";
    let tz = "Asia/Kolkata (UTC+5:30)";
    let lang = "English (India)";
    let numbering = "indian" as "indian" | "intl";

    try {
      const savedSettings = localStorage.getItem("vsqc_settings");
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        platform = parsed.platformName || "Systemeta";
        currency = parsed.defaultCurrency || "₹ Indian Rupee (INR)";
        fiscalYear = parsed.fiscalYearStart || "January";
        tz = parsed.timezone || "Asia/Kolkata (UTC+5:30)";
        lang = parsed.language || "English (India)";
        numbering = parsed.numberingSystem || "indian";
      }
    } catch (_) {}

    setPlatformName(platform);
    setSelectedCurrency(currency);
    setSelectedFiscalYear(fiscalYear);
    setSelectedTimezone(tz);
    setSelectedLanguage(lang);
    setSelectedNumbering(numbering);

    setInitialSettings({
      platformName: platform,
      defaultCurrency: currency,
      fiscalYearStart: fiscalYear,
      timezone: tz,
      language: lang,
      numberingSystem: numbering
    });

    setTimezone(tz);
    setLanguage(lang, true);
    setCurrencyFormat(numbering);
    const currSym = currency.split(" ")[0] || "₹";
    setCurrencySymbol(currSym);

    // Load notification settings
    try {
      const savedNotif = localStorage.getItem("vsqc_notif_settings");
      if (savedNotif) {
        const n = JSON.parse(savedNotif);
        if (n.email !== undefined) setNotifEmail(n.email);
        if (n.slack !== undefined) setNotifSlack(n.slack);
        if (n.aiAlerts !== undefined) setNotifAiAlerts(n.aiAlerts);
        if (n.weeklyDigest !== undefined) setNotifWeeklyDigest(n.weeklyDigest);
      }
    } catch (_) {}

    // Load security settings
    try {
      const savedSec = localStorage.getItem("vsqc_security_settings");
      if (savedSec) {
        const s = JSON.parse(savedSec);
        if (s.forceMfa !== undefined) setSecForceMfa(s.forceMfa);
        if (s.sessionTimeout !== undefined) setSecSessionTimeout(s.sessionTimeout);
        if (s.passwordPolicy !== undefined) setSecPasswordPolicy(s.passwordPolicy);
        if (s.ipWhitelist !== undefined) setSecIpWhitelist(s.ipWhitelist);
      }
    } catch (_) {}

    // Load integration settings
    try {
      const savedInt = localStorage.getItem("vsqc_integration_settings");
      if (savedInt) {
        const i = JSON.parse(savedInt);
        if (i.ms365 !== undefined) setIntMs365(i.ms365);
        if (i.salesforce !== undefined) setIntSalesforce(i.salesforce);
        if (i.jira !== undefined) setIntJira(i.jira);
        if (i.sap !== undefined) setIntSap(i.sap);
      }
    } catch (_) {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dropdown outside click + Escape key handlers
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (timezoneRef.current && !timezoneRef.current.contains(target)) setShowTimezoneDropdown(false);
      if (languageRef.current && !languageRef.current.contains(target)) setShowLanguageDropdown(false);
      if (currencyRef.current && !currencyRef.current.contains(target)) setShowCurrencyDropdown(false);
      if (fiscalYearRef.current && !fiscalYearRef.current.contains(target)) setShowFiscalYearDropdown(false);
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowTimezoneDropdown(false);
        setShowLanguageDropdown(false);
        setShowCurrencyDropdown(false);
        setShowFiscalYearDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  useEffect(() => {
    const checkSpace = (ref: React.RefObject<HTMLDivElement | null>, setOpenUpward: (val: boolean) => void) => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        setOpenUpward(window.innerHeight - rect.bottom < 230);
      }
    };
    if (showTimezoneDropdown) checkSpace(timezoneRef, setOpenUpwardTimezone);
    if (showLanguageDropdown) checkSpace(languageRef, setOpenUpwardLanguage);
    if (showCurrencyDropdown) checkSpace(currencyRef, setOpenUpwardCurrency);
    if (showFiscalYearDropdown) checkSpace(fiscalYearRef, setOpenUpwardFiscal);
  }, [showTimezoneDropdown, showLanguageDropdown, showCurrencyDropdown, showFiscalYearDropdown]);

  // CENTRAL USER FORM DRAWER STATE
  const [showUserModal, setShowUserModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{email: string, password: string, name: string} | null>(null);

  // Form Fields
  const [formFullname, setFormFullname] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formConfirmPassword, setFormConfirmPassword] = useState("");
  const [formRole, setFormRole] = useState("consultant");
  const [formProjectIds, setFormProjectIds] = useState<string[]>([]);
  const [formClientId, setFormClientId] = useState("");
  const [formReporteeOf, setFormReporteeOf] = useState("");
  const [resetPasswordToggle, setResetPasswordToggle] = useState(false);

  // Live inline validation errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Dynamic Validation as User Types
  useEffect(() => {
    if (!showUserModal) return;

    const errs: Record<string, string> = {};

    if (formFullname && formFullname.trim().length < 2) {
      errs.fullname = "Full Name must be at least 2 characters";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formEmail && !emailRegex.test(formEmail)) {
      errs.email = "Please enter a valid email address";
    } else if (formEmail && !isEditing) {
      // Local uniqueness check against current user list
      const duplicate = users.some(u => u.email.toLowerCase() === formEmail.toLowerCase());
      if (duplicate) {
        errs.email = "This email is already registered";
      }
    }

    // Password validations (required only for create OR when reset password toggle is on)
    if (!isEditing || resetPasswordToggle) {
      const passwordPattern = /^(?=.*[A-Z])(?=.*[0-9])/;
      if (formPassword && formPassword.length < 8) {
        errs.password = "Password must be at least 8 characters";
      } else if (formPassword && !passwordPattern.test(formPassword)) {
        errs.password = "Password must contain at least 1 uppercase letter and 1 number";
      }

      if (formConfirmPassword && formPassword !== formConfirmPassword) {
        errs.confirmPassword = "Passwords do not match";
      }
    }

    // Role-based validations
    // Project assignment is optional for all roles

    if (formRole === "client_contact" && !formClientId) {
      errs.client = "Please link a client";
    }

    setFormErrors(errs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formFullname, formEmail, formPassword, formConfirmPassword, formRole, formProjectIds, formClientId, showUserModal, resetPasswordToggle, isEditing]);

  // Escape key for user modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setShowUserModal(false); };
    if (showUserModal) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showUserModal]);

  const handleOpenCreate = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormFullname("");
    setFormEmail("");
    setFormPassword("");
    setFormConfirmPassword("");
    setFormRole("consultant");
    setFormProjectIds([]);
    setFormClientId("");
    setFormReporteeOf("");
    setResetPasswordToggle(false);
    setFormErrors({});
    setShowUserModal(true);
  };

  const handleOpenEdit = (u: any) => {
    setIsEditing(true);
    setEditingId(u.id);
    setFormFullname(u.name);
    setFormEmail(u.email);
    setFormPassword("");
    setFormConfirmPassword("");
    setFormRole(u.role);
    setFormProjectIds(u.projectIds || []);
    setFormClientId(u.clientId || "");
    setFormReporteeOf(u.reporteeOf || "");
    setResetPasswordToggle(false);
    setFormErrors({});
    setShowUserModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check required fields before sending
    if (!formFullname.trim() || !formEmail.trim() || (!isEditing && !formPassword.trim())) {
      showToast("Please fill in all required fields", "warning");
      return;
    }

    if (Object.keys(formErrors).length > 0) {
      showToast("Please resolve all validation errors", "warning");
      return;
    }

    const payload = {
      name: formFullname.trim(),
      email: formEmail.trim().toLowerCase(),
      role: formRole,
      project_ids: ["project_manager", "senior_consultant", "consultant"].includes(formRole) ? formProjectIds : [],
      client_id: formRole === "client_contact" ? formClientId : null,
      reportee_of: formRole === "consultant" && formReporteeOf ? formReporteeOf : null,
      password: (!isEditing || resetPasswordToggle) ? formPassword : null,
    };

    try {
      const url = isEditing ? `/api/users/${editingId}` : "/api/users";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Server error");
      }

      if (!isEditing) {
        setCreatedCredentials({
          email: payload.email,
          password: payload.password!,
          name: payload.name
        });
      }

      showToast(isEditing ? "User details updated successfully" : "User created successfully", "success");
      setShowUserModal(false);
      fetchAdminData();
    } catch (err: any) {
      showToast(err.message || "Failed to save user", "danger");
    }
  };

  const handleCopyInvite = (email: string) => {
    const inviteText = `Login URL: ${window.location.origin}/login\nEmail: ${email}`;
    navigator.clipboard.writeText(inviteText);
    showToast("Invite details copied to clipboard", "success");
  };

  const handleToggleMFA = async (uId: string, currentMfa: boolean) => {
    try {
      const res = await fetch(`/api/users/${uId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfa: !currentMfa }),
      });
      if (res.ok) {
        showToast("MFA setting updated", "success");
        fetchAdminData();
      } else {
        const err = await res.json();
        showToast(err.message || "Failed to update MFA", "danger");
      }
    } catch {
      showToast("Network error", "danger");
    }
  };

  const handleToggleStatus = async (uId: string, currentStatus: "active" | "inactive") => {
    const targetStatus = currentStatus === "active" ? "inactive" : "active";
    let reason = "";
    if (targetStatus === "inactive") {
      const inputReason = prompt("Please enter a reason for deactivation:");
      if (inputReason === null) return; // User clicked Cancel
      reason = inputReason.trim();
    }

    try {
      const res = await fetch(`/api/users/${uId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus, reason }),
      });
      if (res.ok) {
        showToast(`User status updated to ${targetStatus}`, "success");
        fetchAdminData();
      } else {
        const err = await res.json();
        showToast(err.message || "Failed to update status", "danger");
      }
    } catch {
      showToast("Network error", "danger");
    }
  };

  const [userSearch, setUserSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.role.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredAuditLogs = auditLogs.filter((log) =>
    log.user.toLowerCase().includes(auditSearch.toLowerCase()) ||
    log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
    log.detail.toLowerCase().includes(auditSearch.toLowerCase())
  );

  const exportBtnStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: "6px",
    padding: "7px 14px", fontSize: "13px", fontWeight: 500,
    color: "#1e3a5f", background: "transparent",
    border: "1px solid rgba(0,0,0,0.15)", borderRadius: "7px",
    cursor: "pointer", transition: "background 150ms ease, border-color 150ms ease",
  };

  const handleExportUsers = () => {
    if (filteredUsers.length === 0) { showToast("No data to export", "warning"); return; }
    const dateStr = new Date().toISOString().split("T")[0];
    const headers = ["Name", "Email", "Role", "Status", "MFA", "Last Login"];
    const rows = filteredUsers.map((u) => [
      `"${u.name}"`, `"${u.email}"`, `"${ROLE_DISPLAY_NAMES[u.role] || u.role}"`, `"${u.status}"`,
      u.mfa ? "Enabled" : "Disabled", `"${u.last_login_at}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `Systemeta_Users_${dateStr}.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast("Export downloaded successfully", "success");
  };

  const handleExportAuditLog = () => {
    if (filteredAuditLogs.length === 0) { showToast("No data to export", "warning"); return; }
    const dateStr = new Date().toISOString().split("T")[0];
    const headers = ["Timestamp", "User", "Action", "Resource", "Details", "IP"];
    const rows = filteredAuditLogs.map((log) => [
      `"${log.timestamp}"`, `"${log.user}"`, `"${log.action}"`, `"${log.resource}"`, `"${log.detail.replace(/"/g, '""')}"`, log.ip,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `Systemeta_AuditLog_${dateStr}.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast("Export downloaded successfully", "success");
  };


  const isDirty =
    platformName !== initialSettings.platformName ||
    selectedCurrency !== initialSettings.defaultCurrency ||
    selectedFiscalYear !== initialSettings.fiscalYearStart ||
    selectedTimezone !== initialSettings.timezone ||
    selectedLanguage !== initialSettings.language ||
    selectedNumbering !== initialSettings.numberingSystem;

  const handleSaveGeneralSettings = async () => {
    if (!platformName.trim()) { setPlatformNameError("Platform name is required"); return; }
    setPlatformNameError("");
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const settingsObj = {
      platformName, defaultCurrency: selectedCurrency, fiscalYearStart: selectedFiscalYear,
      timezone: selectedTimezone, language: selectedLanguage, numberingSystem: selectedNumbering
    };
    try {
      localStorage.setItem("vsqc_settings", JSON.stringify(settingsObj));
      localStorage.setItem("vsqc_platform_name", platformName);
      localStorage.setItem("currencyFormat", selectedNumbering);
      localStorage.setItem("vsqc_timezone", selectedTimezone);
      localStorage.setItem("vsqc_language", selectedLanguage);
    } catch (_) {}
    const isLangChanged = selectedLanguage !== initialSettings.language;
    setCurrencyFormat(selectedNumbering);
    setTimezone(selectedTimezone);
    setLanguage(selectedLanguage, !isLangChanged);
    setInitialSettings(settingsObj);
    setIsSaving(false);
    showToast("General settings saved", "success");
  };

  const handleSaveNotifSettings = async (silent = false) => {
    setIsSavingNotif(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    try { localStorage.setItem("vsqc_notif_settings", JSON.stringify({ email: notifEmail, slack: notifSlack, aiAlerts: notifAiAlerts, weeklyDigest: notifWeeklyDigest })); } catch (_) {}
    setIsSavingNotif(false);
    if (!silent) showToast("Notification settings saved", "success");
  };

  const handleSaveSecuritySettings = async (silent = false) => {
    setIsSavingSecurity(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    try { localStorage.setItem("vsqc_security_settings", JSON.stringify({ forceMfa: secForceMfa, sessionTimeout: secSessionTimeout, passwordPolicy: secPasswordPolicy, ipWhitelist: secIpWhitelist })); } catch (_) {}
    setIsSavingSecurity(false);
    if (!silent) showToast("Security settings saved", "success");
  };

  const handleSaveIntegrationSettings = async (silent = false) => {
    setIsSavingIntegrations(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    try { localStorage.setItem("vsqc_integration_settings", JSON.stringify({ ms365: intMs365, salesforce: intSalesforce, jira: intJira, sap: intSap })); } catch (_) {}
    setIsSavingIntegrations(false);
    if (!silent) showToast("Integration settings saved", "success");
  };

  const handleConfirmRestoreDefaults = () => {
    const defaultPlatform = "Systemeta";
    const defaultCurrency = "₹ Indian Rupee (INR)";
    const defaultFiscalYear = "January";
    const defaultTimezone = "Asia/Kolkata (UTC+5:30)";
    const defaultLanguage = "English (US)";
    const defaultNumbering = "indian";

    setPlatformName(defaultPlatform);
    setSelectedCurrency(defaultCurrency);
    setSelectedFiscalYear(defaultFiscalYear);
    setSelectedTimezone(defaultTimezone);
    setSelectedLanguage(defaultLanguage);
    setSelectedNumbering(defaultNumbering);

    setInitialSettings({
      platformName: defaultPlatform,
      defaultCurrency: defaultCurrency,
      fiscalYearStart: defaultFiscalYear,
      timezone: defaultTimezone,
      language: defaultLanguage,
      numberingSystem: defaultNumbering
    });

    setNotifEmail(true);
    setNotifSlack(true);
    setNotifAiAlerts(true);
    setNotifWeeklyDigest(true);

    setSecForceMfa(false);
    setSecSessionTimeout("60");
    setSecPasswordPolicy("Strong");
    setSecIpWhitelist(false);

    setIntMs365(false);
    setIntSalesforce(false);
    setIntJira(false);
    setIntSap(false);

    try {
      const settingsObj = {
        platformName: defaultPlatform,
        defaultCurrency: defaultCurrency,
        fiscalYearStart: defaultFiscalYear,
        timezone: defaultTimezone,
        language: defaultLanguage,
        numberingSystem: defaultNumbering
      };
      localStorage.setItem("vsqc_settings", JSON.stringify(settingsObj));
      localStorage.setItem("vsqc_platform_name", defaultPlatform);
      localStorage.setItem("currencyFormat", defaultNumbering);
      localStorage.setItem("vsqc_timezone", defaultTimezone);
      localStorage.setItem("vsqc_language", defaultLanguage);

      localStorage.setItem("vsqc_notif_settings", JSON.stringify({
        email: true, slack: true, aiAlerts: true, weeklyDigest: true
      }));
      localStorage.setItem("vsqc_security_settings", JSON.stringify({
        forceMfa: false, sessionTimeout: "60", passwordPolicy: "Strong", ipWhitelist: false
      }));
      localStorage.setItem("vsqc_integration_settings", JSON.stringify({
        ms365: false, salesforce: false, jira: false, sap: false
      }));
    } catch (_) {}

    setTimezone(defaultTimezone);
    setLanguage(defaultLanguage, true);
    setCurrencyFormat(defaultNumbering);
    setCurrencySymbol("₹");

    setShowResetConfirm(false);
    showToast("Settings restored to defaults", "success");
  };

  const handleSaveAllSettings = async () => {
    if (isSavingAll) return;
    if (!platformName.trim()) {
      setPlatformNameError("Platform name is required");
      setActiveTab("settings");
      showToast("Please fix validation errors before saving all settings", "warning");
      return;
    }
    setIsSavingAll(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    try {
      const settingsObj = { platformName, defaultCurrency: selectedCurrency, fiscalYearStart: selectedFiscalYear, timezone: selectedTimezone, language: selectedLanguage, numberingSystem: selectedNumbering };
      localStorage.setItem("vsqc_settings", JSON.stringify(settingsObj));
      localStorage.setItem("vsqc_platform_name", platformName);
      localStorage.setItem("currencyFormat", selectedNumbering);
      localStorage.setItem("vsqc_timezone", selectedTimezone);
      localStorage.setItem("vsqc_language", selectedLanguage);
      const isLangChanged = selectedLanguage !== initialSettings.language;
      setCurrencyFormat(selectedNumbering);
      const currSym = selectedCurrency.split(" ")[0] || "₹";
      setCurrencySymbol(currSym);
      setTimezone(selectedTimezone);
      setLanguage(selectedLanguage, !isLangChanged);
      setInitialSettings(settingsObj);
    } catch (_) {}
    
    // Save emission factors
    setStoreEmissionFactors(adminEmissionFactors);

    try { localStorage.setItem("vsqc_notif_settings", JSON.stringify({ email: notifEmail, slack: notifSlack, aiAlerts: notifAiAlerts, weeklyDigest: notifWeeklyDigest })); } catch (_) {}
    try { localStorage.setItem("vsqc_security_settings", JSON.stringify({ forceMfa: secForceMfa, sessionTimeout: secSessionTimeout, passwordPolicy: secPasswordPolicy, ipWhitelist: secIpWhitelist })); } catch (_) {}
    try { localStorage.setItem("vsqc_integration_settings", JSON.stringify({ ms365: intMs365, salesforce: intSalesforce, jira: intJira, sap: intSap })); } catch (_) {}
    setIsSavingAll(false);
    showToast("All settings saved successfully", "success");
  };

  // Distinct clients from data.projects and data.clients
  const clientsList = Array.from(new Set([
    ...data.projects.map((p: any) => p.client),
    ...(data.clients ? data.clients.map((c: any) => c.companyName || c.name) : [])
  ])).filter(Boolean);

  // Senior consultants list for "Report To"
  const seniorConsultants = users.filter((u) => u.role === "senior_consultant");

  return (
    <div style={{ animation: "fadeIn 0.5s ease-out" }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: "22px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title" style={{ fontSize: "24px", fontWeight: 600 }}>{t("Admin Panel")}</h1>
          <p className="page-subtitle" style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            {t("System administration")} · {users.length} {langCode === "hi" ? "उपयोगकर्ता" : langCode === "ar" ? "مستخدمين" : "users"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className="btn btn-sm"
            style={{ backgroundColor: maintenanceEnabled ? "#C0392B" : "#1E293B", color: "#ffffff", transition: "background-color 150ms ease" }}
            onClick={() => {
              const nextState = !maintenanceEnabled;
              setMaintenanceEnabled(nextState);
              showToast(nextState ? "Platform set to Maintenance Mode" : "Platform taken out of Maintenance Mode", nextState ? "warning" : "info");
            }}
          >
            {t("Maintenance Mode")}
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleOpenCreate}>
            {t("Invite User")}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "24px", borderBottom: "1px solid var(--border-subtle)", marginBottom: "20px" }}>
        {[
          { id: "users",    label: t("Users") },
          { id: "roles",    label: t("Roles & Permissions") },
          { id: "audit",    label: t("Audit Log") },
          { id: "settings", label: t("System Settings") },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                background: "transparent", border: "none",
                borderBottom: isActive ? "2px solid #2E86C1" : "2px solid transparent",
                padding: "8px 0 12px 0", fontSize: "13.5px",
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
                cursor: "pointer", transition: "all 150ms ease", borderRadius: 0,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Loading state indicator */}
      {loadingData ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "200px" }}>
          <img src="/logo.png" alt="Loading" className="loading-logo" style={{ background: "transparent", border: "none", boxShadow: "none", width: "50px", height: "50px", borderRadius: "14px", objectFit: "cover", animation: "pulse 1.5s infinite" }} />
          <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "12px" }}>Loading records...</div>
        </div>
      ) : (
        <>
          {/* 1. Users Tab */}
          {activeTab === "users" && (
            <div style={{ animation: "fadeIn 0.3s ease-out" }}>
              <div className="card">
                <div className="card-header" style={{ marginBottom: 0 }}>
                  <span className="card-title">User Management</span>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                      <Search size={13} style={{ position: "absolute", left: "10px", color: "var(--text-tertiary)" }} />
                      <input className="input" placeholder="Search users..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} style={{ paddingLeft: "30px", width: "240px" }} />
                    </div>
                    <button style={exportBtnStyle} onClick={handleExportUsers}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.04)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <FileDown size={14} />
                      {t("Export CSV")}
                    </button>
                  </div>
                </div>
                <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>{t("User")}</th>
                        <th>{t("Email")}</th>
                        <th>{t("Role")}</th>
                        <th>{t("Status")}</th>
                        <th>{t("MFA")}</th>
                        <th>{t("Last Login")}</th>
                        <th>{t("Actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => {
                        const c = data.consultants.find((x: any) => x.name === u.name) || { color: "#64748b", avatar: u.name[0] };
                        const isUserActive = u.status === "active";
                        return (
                          <tr key={u.id} style={{ opacity: isUserActive ? 1 : 0.6 }}>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                                <div className="avatar" style={{ background: c.color, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold" }}>{c.avatar}</div>
                                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{u.name}</span>
                              </div>
                            </td>
                            <td style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>{u.email}</td>
                            <td><span className="badge badge-gray" style={{ fontSize: "11px" }}>{ROLE_DISPLAY_NAMES[u.role] || u.role}</span></td>
                            <td>
                              <span className={`badge ${u.status === "active" ? "badge-success" : u.status === "Invited" ? "badge-warning" : "badge-gray"}`} style={{ fontSize: "11px" }}>
                                {u.status === "active" ? "Active" : u.status === "Invited" ? "Invited" : "Inactive"}
                              </span>
                            </td>
                            <td>
                              {(u.role === "client_manager" || u.role === "Client Manager") && !isSuperAdmin ? (
                                <span className={`badge ${u.mfa ? "badge-success" : "badge-warning"}`} style={{ fontSize: "10.5px", opacity: 0.65, display: "inline-flex", alignItems: "center", gap: "4px" }} title="MFA status (only Super Admins can manage Client Managers)">
                                  {u.mfa ? <><Check size={12} /> Enabled</> : <><X size={12} /> Disabled</>}
                                </span>
                              ) : (
                                <span onClick={() => handleToggleMFA(u.id, u.mfa)} className={`badge ${u.mfa ? "badge-success" : "badge-warning"}`} style={{ fontSize: "10.5px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }} title="Click to toggle MFA">
                                  {u.mfa ? <><Check size={12} /> Enabled</> : <><X size={12} /> Disabled</>}
                                </span>
                              )}
                            </td>
                            <td style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{u.last_login_at || "—"}</td>
                            <td>
                              <div style={{ display: "flex", gap: "4px" }}>
                                {(u.role === "client_manager" || u.role === "Client Manager") && !isSuperAdmin ? (
                                  <span style={{ fontSize: "12px", color: "var(--text-tertiary)", padding: "4px 8px" }}>Restricted</span>
                                ) : (
                                  <>
                                    {u.status === "Invited" && (
                                      <button
                                        className="btn btn-ghost btn-sm"
                                        style={{ color: "var(--brand-600)" }}
                                        onClick={() => handleCopyInvite(u.email)}
                                      >
                                        Copy Invite
                                      </button>
                                    )}
                                    <button className="btn btn-ghost btn-sm" onClick={() => handleOpenEdit(u)}>Edit</button>
                                    <button className="btn btn-ghost btn-sm btn-icon" style={{ color: isUserActive ? "var(--danger-500)" : "var(--success-500)" }} onClick={() => handleToggleStatus(u.id, u.status as any)} title={isUserActive ? "Deactivate User" : "Activate User"}>
                                      {isUserActive ? <Ban size={14} /> : <RefreshCw size={14} />}
                                    </button>
                                    <ActionGuard action="delete_user">
                                      {u.id !== loggedInUser?.id && (
                                        <button
                                          className="btn btn-ghost btn-sm btn-icon"
                                          style={{ color: "var(--danger-600, #dc2626)" }}
                                          onClick={() => {
                                            setUserToDelete(u);
                                            setShowDeleteConfirm(true);
                                          }}
                                          title="Delete User"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      )}
                                    </ActionGuard>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 2. Roles & Permissions Tab */}
          {activeTab === "roles" && (() => {
            const PERMISSION_KEYS = [
              { key: "Admin Panel Access",     defaultRoles: ["super_admin"] },
              { key: "View AI Insights",       defaultRoles: ["super_admin", "project_manager", "senior_consultant", "consultant", "accounts"] },
              { key: "Approve Expenses",       defaultRoles: ["super_admin", "project_manager", "accounts"] },
              { key: "Approve Timesheets",     defaultRoles: ["super_admin", "project_manager", "senior_consultant"] },
              { key: "Approve Leave",          defaultRoles: ["super_admin", "project_manager", "senior_consultant"] },
              { key: "Create Projects",        defaultRoles: ["super_admin", "project_manager"] },
              { key: "Unlock Project Plans",   defaultRoles: ["super_admin", "project_manager"] },
              { key: "Emergency Project Access", defaultRoles: ["super_admin"] },
              { key: "Cross-Project Visibility", defaultRoles: ["super_admin"] },
              { key: "CRM Access",             defaultRoles: ["super_admin", "client_manager"] },
            ];

            const selectedUser = users.find(u => u.id === selectedUserId);
            const now = new Date();

             const userOverrides = permissionOverrides.filter(o => o.userId === selectedUserId);
             const pendingOverrides  = userOverrides.filter(o => !o.isActive && o.grantedBy === "Pending Approval" && new Date(o.endDate) > now);
             const activeOverrides   = userOverrides.filter(o => o.isActive && new Date(o.endDate) > now);
             const expiredOverrides  = userOverrides.filter(o => new Date(o.endDate) <= now || (o.isActive === false && o.grantedBy !== "Pending Approval"));

            const getOverrideForPerm = (permKey: string) =>
              activeOverrides.find(o => o.permissionKey === permKey);

            const hasDefaultAccess = (permKey: string) =>
              selectedUser ? PERMISSION_KEYS.find(p => p.key === permKey)?.defaultRoles.includes(selectedUser.role) ?? false : false;

            const getEffectiveAccess = (permKey: string) => {
              if (!selectedUser) return null;
              const override = getOverrideForPerm(permKey);
              if (override) return { effective: override.granted, source: 'override' as const, override };
              return { effective: hasDefaultAccess(permKey), source: 'role' as const, override: null };
            };

            const handleCreateOverride = async () => {
              if (!selectedUserId || !overridePermKey || !overrideReason.trim() || !overrideEndDate) {
                showToast("Please fill in all required fields.", "warning"); return;
              }
              setIsCreatingOverride(true);
              try {
                await createOverride({ userId: selectedUserId, permissionKey: overridePermKey, granted: overrideGranted, reason: overrideReason, startDate: overrideStartDate, endDate: overrideEndDate });
                setOverrideReason(""); setOverrideEndDate(""); setOverridePermKey("");
              } finally { setIsCreatingOverride(false); }
            };

            const badgeStyle = (color: string): React.CSSProperties => ({
              display: "inline-flex", alignItems: "center", gap: "4px",
              padding: "2px 8px", borderRadius: "999px", fontSize: "11px", fontWeight: 600,
              background: color === 'green' ? "rgba(16,185,129,0.12)" : color === 'red' ? "rgba(239,68,68,0.12)" : color === 'orange' ? "rgba(245,158,11,0.12)" : "rgba(100,116,139,0.12)",
              color: color === 'green' ? "#059669" : color === 'red' ? "#dc2626" : color === 'orange' ? "#d97706" : "#64748b",
            });

            return (
              <div style={{ animation: "fadeIn 0.3s ease-out", display: "flex", flexDirection: "column", gap: "20px" }}>
                {/* Sub-tab navigation */}
                <div style={{ display: "flex", gap: "16px", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "8px" }}>
                  {[
                    { id: "matrix", label: "Permissions Matrix" },
                    { id: "overrides", label: "Emergency Overrides" }
                  ].map((subTab) => {
                    const isSubActive = rolesSubTab === subTab.id;
                    return (
                      <button
                        key={subTab.id}
                        onClick={() => setRolesSubTab(subTab.id as any)}
                        style={{
                          background: isSubActive ? "rgba(46,134,193,0.08)" : "transparent",
                          border: "none",
                          borderBottom: isSubActive ? "2px solid #2E86C1" : "2px solid transparent",
                          padding: "6px 12px",
                          fontSize: "12.5px",
                          fontWeight: isSubActive ? 600 : 500,
                          color: isSubActive ? "#2E86C1" : "var(--text-secondary)",
                          cursor: "pointer",
                          transition: "all 150ms ease",
                          borderRadius: "4px 4px 0 0",
                        }}
                      >
                        {subTab.label}
                      </button>
                    );
                  })}
                </div>

                {rolesSubTab === "matrix" && (
                  <div style={{ animation: "fadeIn 0.3s ease-out" }} className="card">
                    <div className="card-header" style={{ marginBottom: "16px" }}>
                      <span className="card-title">Permissions Matrix (Role Defaults)</span>
                    </div>
                    <div className="card-body">
                      <div className="permissions-matrix" style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "700px" }}>
                          <thead>
                            <tr style={{ borderBottom: "2px solid var(--border-default)" }}>
                              <th style={{ padding: "10px 16px", textAlign: "left", fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>Permission</th>
                              {matrixRoles.map((r) => (
                                <th key={r} style={{ padding: "10px 12px", textAlign: "center", fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>{r}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {matrix.map((row, permIdx) => (
                              <tr key={row.name} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                                <td style={{ padding: "12px 16px", fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>{row.name}</td>
                                {row.vals.map((v, roleIdx) => (
                                  <td key={roleIdx} style={{ padding: "12px", textAlign: "center" }}>
                                    <input type="checkbox" checked={v} onChange={() => handleCheckboxToggle(permIdx, roleIdx)} style={{ cursor: "pointer", width: "16px", height: "16px" }} />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                        <button className="btn btn-secondary" onClick={handleResetMatrix}>Reset</button>
                        <button className="btn btn-primary" onClick={handleSaveMatrix}>Save Changes</button>
                      </div>
                    </div>
                  </div>
                )}

                {rolesSubTab === "overrides" && (
                  <div style={{ animation: "fadeIn 0.3s ease-out", display: "flex", flexDirection: "column", gap: "20px" }}>
                    {/* Header */}
                    <div className="card">
                      <div className="card-header" style={{ marginBottom: "16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <Shield size={20} color="#2E86C1" />
                          <span className="card-title">Emergency Access Overrides</span>
                        </div>
                        <button className="btn btn-sm btn-secondary" onClick={() => fetchOverrides()} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <RefreshCw size={13} /> Refresh
                        </button>
                      </div>
                      <div className="card-body">
                        <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                          Grant or restrict temporary, time-bound permissions beyond a user&apos;s default role. All overrides are audited and expire automatically.
                          {!isSuperAdmin && !isProjectManager && <span style={{ color: "var(--danger-500)", marginLeft: "8px" }}>▲ Read-only view</span>}
                        </p>

                        {/* User Selector */}
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                          <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>Select User:</label>
                          <select
                            className="input"
                            value={selectedUserId}
                            onChange={e => setSelectedUserId(e.target.value)}
                            style={{ width: "260px", fontSize: "13px" }}
                          >
                            <option value="">— Choose a user —</option>
                            {users.filter(u => u.status === 'active').map(u => (
                              <option key={u.id} value={u.id}>{u.name} ({ROLE_DISPLAY_NAMES[u.role] || u.role})</option>
                            ))}
                          </select>
                          {selectedUser && (
                            <span style={badgeStyle('gray')}>{ROLE_DISPLAY_NAMES[selectedUser.role] || selectedUser.role}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {selectedUser && (
                      <>
                        {/* Permission Grid */}
                        <div className="card">
                          <div className="card-header" style={{ marginBottom: "12px" }}>
                            <span className="card-title" style={{ fontSize: "14px" }}>Effective Permissions — {selectedUser.name}</span>
                            <div style={{ fontSize: "12px", color: "var(--text-tertiary)", display: "flex", gap: "16px" }}>
                              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#10b981", display: "inline-block" }} /> Default Access</span>
                              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#2E86C1", display: "inline-block" }} /> Override Active</span>
                              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#ef4444", display: "inline-block" }} /> Denied / No Access</span>
                            </div>
                          </div>
                          <div className="card-body" style={{ padding: 0 }}>
                            <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
                              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                  <tr style={{ borderBottom: "2px solid var(--border-default)" }}>
                                    <th style={{ padding: "10px 16px", textAlign: "left", fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>Permission</th>
                                    <th style={{ padding: "10px 12px", textAlign: "center", fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>Default (Role)</th>
                                    <th style={{ padding: "10px 12px", textAlign: "center", fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>Override</th>
                                    <th style={{ padding: "10px 12px", textAlign: "center", fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>Effective</th>
                                    <th style={{ padding: "10px 12px", textAlign: "left", fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>Expires</th>
                                    <th style={{ padding: "10px 12px", textAlign: "left", fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {PERMISSION_KEYS.map(({ key }) => {
                                    const result = getEffectiveAccess(key);
                                    if (!result) return null;
                                    const { effective, source, override } = result;
                                    const defaultVal = hasDefaultAccess(key);
                                    return (
                                      <tr key={key} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                                        <td style={{ padding: "12px 16px", fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>{key}</td>
                                        <td style={{ padding: "12px", textAlign: "center" }}>
                                          {defaultVal ? <CheckCircle size={16} color="#10b981" /> : <X size={16} color="#cbd5e1" />}
                                        </td>
                                        <td style={{ padding: "12px", textAlign: "center" }}>
                                          {source === 'override' && override ? (
                                            <span style={badgeStyle(override.granted ? 'green' : 'red')}>
                                              {override.granted ? '✓ Grant' : '✗ Deny'}
                                            </span>
                                          ) : <span style={{ color: "var(--text-tertiary)", fontSize: "12px" }}>—</span>}
                                        </td>
                                        <td style={{ padding: "12px", textAlign: "center" }}>
                                          {effective
                                            ? <span style={badgeStyle('green')}>Allowed</span>
                                            : <span style={badgeStyle('red')}>Denied</span>}
                                        </td>
                                        <td style={{ padding: "12px", fontSize: "12px", color: "var(--text-secondary)" }}>
                                          {source === 'override' && override
                                            ? new Date(override.endDate).toLocaleDateString()
                                            : <span style={{ color: "var(--text-tertiary)" }}>Permanent (role)</span>}
                                        </td>
                                        <td style={{ padding: "12px" }}>
                                          {isSuperAdmin && source === 'override' && override && (
                                            <div style={{ display: "flex", gap: "6px" }}>
                                              <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger-500)", fontSize: "11px" }}
                                                onClick={() => updateOverride(override.id, { action: 'revoke' })}>
                                                Revoke
                                              </button>
                                            </div>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>

                        {/* Create Override Form */}
                        {(isSuperAdmin || isProjectManager) && (
                          <div className="card">
                            <div className="card-header" style={{ marginBottom: "16px" }}>
                              <span className="card-title" style={{ fontSize: "14px" }}>
                                {isSuperAdmin ? "Create Emergency Override" : "Request Emergency Override"}
                              </span>
                              {isProjectManager && !isSuperAdmin && (
                                <span style={badgeStyle('orange')}><AlertTriangle size={11} /> Requires Approval</span>
                              )}
                            </div>
                            <div className="card-body">
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                                <div>
                                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>Permission Key *</label>
                                  <select className="input" value={overridePermKey} onChange={e => setOverridePermKey(e.target.value)} style={{ width: "100%", fontSize: "13px" }}>
                                    <option value="">— Select permission —</option>
                                    {PERMISSION_KEYS.map(p => <option key={p.key} value={p.key}>{p.key}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>Override Type *</label>
                                  <select className="input" value={overrideGranted ? 'grant' : 'deny'} onChange={e => setOverrideGranted(e.target.value === 'grant')} style={{ width: "100%", fontSize: "13px" }}>
                                    <option value="grant">Grant (extend access)</option>
                                    <option value="deny">Deny (restrict access)</option>
                                  </select>
                                </div>
                                <div>
                                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>Start Date *</label>
                                  <input type="date" className="input" value={overrideStartDate} onChange={e => setOverrideStartDate(e.target.value)} style={{ width: "100%", fontSize: "13px" }} />
                                </div>
                                <div>
                                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>Expiration Date *</label>
                                  <input type="date" className="input" value={overrideEndDate} onChange={e => setOverrideEndDate(e.target.value)} min={overrideStartDate} style={{ width: "100%", fontSize: "13px" }} />
                                </div>
                                <div style={{ gridColumn: "1 / -1" }}>
                                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>Reason / Justification *</label>
                                  <textarea className="input" value={overrideReason} onChange={e => setOverrideReason(e.target.value)}
                                    placeholder="Provide a clear business justification for this override..."
                                    rows={3} style={{ width: "100%", fontSize: "13px", resize: "vertical" }} />
                                </div>
                              </div>
                              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                <button className="btn btn-primary" onClick={handleCreateOverride} disabled={isCreatingOverride}
                                  style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <Shield size={14} />
                                  {isCreatingOverride ? "Submitting..." : (isSuperAdmin ? "Create Override" : "Submit Request")}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Pending Requests (Super Admin only) */}
                        {isSuperAdmin && pendingOverrides.length > 0 && (
                          <div className="card">
                            <div className="card-header" style={{ marginBottom: "12px" }}>
                              <span className="card-title" style={{ fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                                <AlertTriangle size={16} color="#d97706" /> Pending Approval Requests
                              </span>
                            </div>
                            <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
                              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                  <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                                    <th style={{ padding: "8px 16px", fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, textAlign: "left" }}>Permission</th>
                                    <th style={{ padding: "8px 12px", fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, textAlign: "left" }}>Type</th>
                                    <th style={{ padding: "8px 12px", fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, textAlign: "left" }}>Requested By</th>
                                    <th style={{ padding: "8px 12px", fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, textAlign: "left" }}>Reason</th>
                                    <th style={{ padding: "8px 12px", fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, textAlign: "left" }}>Expires</th>
                                    <th style={{ padding: "8px 12px", fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, textAlign: "left" }}>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {pendingOverrides.map(o => (
                                    <tr key={o.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                                      <td style={{ padding: "10px 16px", fontSize: "13px", fontWeight: 500 }}>{o.permissionKey}</td>
                                      <td style={{ padding: "10px 12px" }}><span style={badgeStyle(o.granted ? 'green' : 'red')}>{o.granted ? 'Grant' : 'Deny'}</span></td>
                                      <td style={{ padding: "10px 12px", fontSize: "12px", color: "var(--text-secondary)" }}>{o.grantedByName || o.grantedBy}</td>
                                      <td style={{ padding: "10px 12px", fontSize: "12px", color: "var(--text-primary)", maxWidth: "200px" }}>{o.reason}</td>
                                      <td style={{ padding: "10px 12px", fontSize: "12px", color: "var(--text-secondary)" }}>{new Date(o.endDate).toLocaleDateString()}</td>
                                      <td style={{ padding: "10px 12px" }}>
                                        <div style={{ display: "flex", gap: "6px" }}>
                                          <button className="btn btn-sm" style={{ background: "#10b981", color: "white", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}
                                            onClick={() => updateOverride(o.id, { action: 'approve' })}>
                                            <Check size={12} /> Approve
                                          </button>
                                          <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger-500)", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}
                                            onClick={() => updateOverride(o.id, { action: 'revoke' })}>
                                            <X size={12} /> Reject
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Active Overrides */}
                        {activeOverrides.length > 0 && (
                          <div className="card">
                            <div className="card-header" style={{ marginBottom: "12px" }}>
                              <span className="card-title" style={{ fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                                <CheckCircle size={16} color="#10b981" /> Active Overrides
                              </span>
                            </div>
                            <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
                              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                  <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                                    <th style={{ padding: "8px 16px", fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, textAlign: "left" }}>Permission</th>
                                    <th style={{ padding: "8px 12px", fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, textAlign: "left" }}>Type</th>
                                    <th style={{ padding: "8px 12px", fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, textAlign: "left" }}>Granted By</th>
                                    <th style={{ padding: "8px 12px", fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, textAlign: "left" }}>Reason</th>
                                    <th style={{ padding: "8px 12px", fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, textAlign: "left" }}>Expires</th>
                                    {isSuperAdmin && <th style={{ padding: "8px 12px", fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, textAlign: "left" }}>Actions</th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {activeOverrides.map(o => {
                                    const daysLeft = Math.ceil((new Date(o.endDate).getTime() - now.getTime()) / 86400000);
                                    const urgentExpiry = daysLeft <= 3;
                                    return (
                                      <tr key={o.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                                        <td style={{ padding: "10px 16px", fontSize: "13px", fontWeight: 500 }}>{o.permissionKey}</td>
                                        <td style={{ padding: "10px 12px" }}><span style={badgeStyle(o.granted ? 'green' : 'red')}>{o.granted ? 'Grant' : 'Deny'}</span></td>
                                        <td style={{ padding: "10px 12px", fontSize: "12px", color: "var(--text-secondary)" }}>{o.grantedByName || o.grantedBy}</td>
                                        <td style={{ padding: "10px 12px", fontSize: "12px", color: "var(--text-primary)", maxWidth: "180px" }}>{o.reason}</td>
                                        <td style={{ padding: "10px 12px", fontSize: "12px" }}>
                                          <span style={{ color: urgentExpiry ? "#d97706" : "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px" }}>
                                            {urgentExpiry && <Clock size={12} />}
                                            {new Date(o.endDate).toLocaleDateString()} {urgentExpiry && `(${daysLeft}d left)`}
                                          </span>
                                        </td>
                                        {isSuperAdmin && (
                                          <td style={{ padding: "10px 12px" }}>
                                            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                              <button className="btn btn-ghost btn-sm" style={{ color: "#2E86C1", fontSize: "11px" }}
                                                onClick={() => { setExtendOverrideId(o.id); setExtendEndDate(""); setExtendReason(""); }}>
                                                Extend
                                              </button>
                                              <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger-500)", fontSize: "11px" }}
                                                onClick={() => updateOverride(o.id, { action: 'revoke' })}>Revoke</button>
                                              <button className="btn btn-ghost btn-sm" style={{ color: "var(--text-tertiary)", fontSize: "11px" }}
                                                onClick={() => { if (confirm('Permanently delete this override record?')) deleteOverride(o.id); }}>Delete</button>
                                            </div>
                                          </td>
                                        )}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Expired/History */}
                        {expiredOverrides.length > 0 && (
                          <div className="card">
                            <div className="card-header" style={{ marginBottom: "12px" }}>
                              <span className="card-title" style={{ fontSize: "14px", color: "var(--text-secondary)" }}>Override History ({expiredOverrides.length})</span>
                            </div>
                            <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
                              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                  <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                                    <th style={{ padding: "8px 16px", fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, textAlign: "left" }}>Permission</th>
                                    <th style={{ padding: "8px 12px", fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, textAlign: "left" }}>Type</th>
                                    <th style={{ padding: "8px 12px", fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, textAlign: "left" }}>Status</th>
                                    <th style={{ padding: "8px 12px", fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, textAlign: "left" }}>Reason</th>
                                    <th style={{ padding: "8px 12px", fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, textAlign: "left" }}>Expired</th>
                                    {isSuperAdmin && <th style={{ padding: "8px 12px", fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 600, textAlign: "left" }}>Actions</th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {expiredOverrides.map(o => (
                                    <tr key={o.id} style={{ borderBottom: "1px solid var(--border-subtle)", opacity: 0.65 }}>
                                      <td style={{ padding: "9px 16px", fontSize: "13px", fontWeight: 500 }}>{o.permissionKey}</td>
                                      <td style={{ padding: "9px 12px" }}><span style={badgeStyle(o.granted ? 'green' : 'red')}>{o.granted ? 'Grant' : 'Deny'}</span></td>
                                      <td style={{ padding: "9px 12px" }}><span style={badgeStyle('gray')}>{o.status || 'expired'}</span></td>
                                      <td style={{ padding: "9px 12px", fontSize: "12px", color: "var(--text-primary)", maxWidth: "180px" }}>{o.reason}</td>
                                      <td style={{ padding: "9px 12px", fontSize: "12px", color: "var(--text-secondary)" }}>{new Date(o.endDate).toLocaleDateString()}</td>
                                      {isSuperAdmin && (
                                        <td style={{ padding: "9px 12px" }}>
                                          <button className="btn btn-ghost btn-sm" style={{ color: "var(--text-tertiary)", fontSize: "11px" }}
                                            onClick={() => { if (confirm('Permanently delete this override record?')) deleteOverride(o.id); }}>Delete</button>
                                        </td>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {!selectedUser && (
                      <div className="card">
                        <div className="card-body" style={{ textAlign: "center", padding: "48px 24px" }}>
                          <Shield size={40} color="var(--text-tertiary)" style={{ margin: "0 auto 16px" }} />
                          <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>Select a user above to view and manage their emergency access overrides.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* 3. Audit Log Tab */}
          {activeTab === "audit" && (
            <div style={{ animation: "fadeIn 0.3s ease-out" }} className="card">
              <div className="card-header" style={{ marginBottom: 0 }}>
                <span className="card-title">Audit Log</span>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                    <Search size={13} style={{ position: "absolute", left: "10px", color: "var(--text-tertiary)" }} />
                    <input className="input" placeholder="Search logs..." value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} style={{ paddingLeft: "30px", width: "200px", fontSize: "12.5px" }} />
                  </div>
                  <button style={exportBtnStyle} onClick={handleExportAuditLog}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.04)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <FileDown size={14} />
                    Export CSV
                  </button>
                </div>
              </div>
              <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>User</th>
                      <th>Action</th>
                      <th>Resource</th>
                      <th>Details</th>
                      <th>IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAuditLogs.map((log, idx) => (
                      <tr key={idx}>
                        <td style={{ fontSize: "12px", fontFamily: "monospace", color: "var(--text-secondary)" }}>{log.timestamp}</td>
                        <td style={{ fontSize: "12.5px", color: "var(--text-primary)" }}>{log.user}</td>
                        <td><span className="badge badge-brand" style={{ fontSize: "10px", fontFamily: "monospace" }}>{log.action}</span></td>
                        <td style={{ fontSize: "12px", fontFamily: "monospace", color: "var(--text-secondary)" }}>{log.resource}</td>
                        <td style={{ fontSize: "12.5px", color: "var(--text-primary)", maxWidth: "260px" }}>{log.detail}</td>
                        <td style={{ fontSize: "11.5px", fontFamily: "monospace", color: "var(--text-tertiary)" }}>{log.ip}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. System Settings Tab */}
          {activeTab === "settings" && (
            <div style={{ animation: "fadeIn 0.3s ease-out" }}>
              <div className="grid-2">
                {/* General Settings */}
                <div className="card" style={{ overflow: "visible" }}>
                  <div className="card-header" style={{ marginBottom: 0 }}>
                    <span className="card-title">{t("General Settings")}</span>
                  </div>
                  <div className="card-body">


                    {/* Default Currency */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-subtle)", position: "relative" }}>
                      <div style={{ fontSize: "13px", color: "var(--text-primary)" }}>{t("Default Currency")}</div>
                      <div ref={currencyRef} className="timezone-field-wrapper" style={{ position: "relative", width: "200px" }}>
                        <button type="button" className={`settings-dropdown${showCurrencyDropdown ? " open" : ""}`} onClick={() => setShowCurrencyDropdown((v) => !v)}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{selectedCurrency}</span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: "6px", flexShrink: 0, transform: showCurrencyDropdown ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }}><polyline points="6 9 12 15 18 9" /></svg>
                        </button>
                        {showCurrencyDropdown && (
                          <div className={`timezone-dropdown-menu${openUpwardCurrency ? " upward" : ""}`}>
                            <input className="timezone-search-input" placeholder="Search currency..." value={currencySearch} onChange={(e) => setCurrencySearch(e.target.value)} autoFocus />
                            <div className="timezone-list">
                              {(() => {
                                const q = currencySearch.trim().toLowerCase();
                                const filtered = CURRENCIES.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q));
                                if (filtered.length === 0) return <div style={{ padding: "12px", fontSize: "12px", color: "var(--text-tertiary)", textAlign: "center" }}>{t("No results found")}</div>;
                                return filtered.map((c) => (
                                  <div key={c.code} className={`timezone-option${selectedCurrency === c.label ? " selected" : ""}`} onClick={() => { setSelectedCurrency(c.label); setShowCurrencyDropdown(false); setCurrencySearch(""); }}>{c.label}</div>
                                ));
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Fiscal Year Start */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-subtle)", position: "relative" }}>
                      <div style={{ fontSize: "13px", color: "var(--text-primary)" }}>{t("Fiscal Year Start")}</div>
                      <div ref={fiscalYearRef} className="timezone-field-wrapper" style={{ position: "relative", width: "200px" }}>
                        <button type="button" className={`settings-dropdown${showFiscalYearDropdown ? " open" : ""}`} onClick={() => setShowFiscalYearDropdown((v) => !v)}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{selectedFiscalYear}</span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: "6px", flexShrink: 0, transform: showFiscalYearDropdown ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }}><polyline points="6 9 12 15 18 9" /></svg>
                        </button>
                        {showFiscalYearDropdown && (
                          <div className={`timezone-dropdown-menu${openUpwardFiscal ? " upward" : ""}`}>
                            <div className="timezone-list">
                              {MONTHS.map((m) => (
                                <div key={m} className={`timezone-option${selectedFiscalYear === m ? " selected" : ""}`} onClick={() => { setSelectedFiscalYear(m); setShowFiscalYearDropdown(false); }}>{m}</div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Timezone */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-subtle)", position: "relative" }}>
                      <div style={{ fontSize: "13px", color: "var(--text-primary)" }}>{t("Timezone")}</div>
                      <div ref={timezoneRef} className="timezone-field-wrapper" style={{ position: "relative", width: "200px" }}>
                        <button type="button" className={`settings-dropdown${showTimezoneDropdown ? " open" : ""}`} onClick={() => setShowTimezoneDropdown((v) => !v)}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{selectedTimezone}</span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: "6px", flexShrink: 0, transform: showTimezoneDropdown ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }}><polyline points="6 9 12 15 18 9" /></svg>
                        </button>
                        {showTimezoneDropdown && (
                          <div className={`timezone-dropdown-menu${openUpwardTimezone ? " upward" : ""}`}>
                            <input className="timezone-search-input" placeholder={t("Search timezone...") || "Search timezone..."} value={timezoneSearch} onChange={(e) => setTimezoneSearch(e.target.value)} autoFocus />
                            <div className="timezone-list">
                              {(() => {
                                const q = timezoneSearch.trim().toLowerCase().replace(/[\s_-]+/g, "");
                                const filtered = TIMEZONES.map((g) => ({ ...g, zones: g.zones.filter((z) => { const nL = z.label.toLowerCase().replace(/[\s_-]+/g, ""); const nI = z.id.toLowerCase().replace(/[\s_-]+/g, ""); return nL.includes(q) || nI.includes(q); }) })).filter((g) => g.zones.length > 0);
                                if (filtered.length === 0) return <div style={{ padding: "12px", fontSize: "12px", color: "var(--text-tertiary)", textAlign: "center" }}>{t("No results found") || "No results found"}</div>;
                                return filtered.map((g) => (
                                  <React.Fragment key={g.group}>
                                    <div className="timezone-group-label" style={{ position: "static" }}>{g.group.toUpperCase()}</div>
                                    {g.zones.map((z) => (
                                      <div key={z.id} className={`timezone-option${selectedTimezone === z.label ? " selected" : ""}`}
                                        onClick={() => { setSelectedTimezone(z.label); setShowTimezoneDropdown(false); setTimezoneSearch(""); }}
                                      >{z.label}</div>
                                    ))}
                                  </React.Fragment>
                                ));
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Language */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-subtle)", position: "relative" }}>
                      <div style={{ fontSize: "13px", color: "var(--text-primary)" }}>{t("Language / Locale")}</div>
                      <div ref={languageRef} className="timezone-field-wrapper" style={{ position: "relative", width: "200px" }}>
                        <button type="button" className={`settings-dropdown${showLanguageDropdown ? " open" : ""}`} onClick={() => setShowLanguageDropdown((v) => !v)}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{selectedLanguage}</span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: "6px", flexShrink: 0, transform: showLanguageDropdown ? "rotate(180deg)" : "none", transition: "transform 150ms ease" }}><polyline points="6 9 12 15 18 9" /></svg>
                        </button>
                        {showLanguageDropdown && (
                          <div className={`timezone-dropdown-menu${openUpwardLanguage ? " upward" : ""}`}>
                            <div className="timezone-list">
                              {LANGUAGES.map((lang) => (
                                <div key={lang.id} className={`timezone-option${selectedLanguage === lang.label ? " selected" : ""}`} onClick={() => { setSelectedLanguage(lang.label); setShowLanguageDropdown(false); }}>{lang.label}</div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Numbering System */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                      <div style={{ fontSize: "13px", color: "var(--text-primary)" }}>{t("Numbering System")}</div>
                      <div className="currency-toggle-container">
                        <button className={`currency-toggle-btn ${selectedNumbering === "indian" ? "active" : ""}`} onClick={() => setSelectedNumbering("indian")}>Indian</button>
                        <button className={`currency-toggle-btn ${selectedNumbering === "intl" ? "active" : ""}`} onClick={() => setSelectedNumbering("intl")}>International</button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Carbon Footprint Emission Factors */}
                {isSuperAdmin && (
                  <div className="card" style={{ overflow: "visible" }}>
                    <div className="card-header" style={{ marginBottom: 0 }}>
                      <span className="card-title">{t("Carbon Emission Factors (kgCO2e/km)")}</span>
                    </div>
                    <div className="card-body">
                      {Object.keys(adminEmissionFactors).map((vehicle) => (
                        <div key={vehicle} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                          <div style={{ fontSize: "13px", color: "var(--text-primary)" }}>{t(vehicle)}</div>
                          <input 
                            type="number" 
                            step="0.01"
                            value={adminEmissionFactors[vehicle]}
                            onChange={(e) => setAdminEmissionFactors({...adminEmissionFactors, [vehicle]: parseFloat(e.target.value) || 0})}
                            style={{ width: "80px", padding: "4px 8px", border: "1px solid var(--border-default)", borderRadius: "4px", fontSize: "13px", textAlign: "right" }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notifications Settings */}
                <div className="card">
                  <div className="card-header" style={{ marginBottom: 0 }}>
                    <span className="card-title">{t("Notifications Settings")}</span>
                  </div>
                  <div className="card-body">
                    {([
                      { label: "Email notifications",  checked: notifEmail,        setter: setNotifEmail },
                      { label: "Slack integration",     checked: notifSlack,        setter: setNotifSlack },
                      { label: "AI alert emails",       checked: notifAiAlerts,     setter: setNotifAiAlerts },
                      { label: "Weekly digest",         checked: notifWeeklyDigest,  setter: setNotifWeeklyDigest },
                    ] as { label: string; checked: boolean; setter: (v: boolean) => void }[]).map((item) => (
                      <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                        <div style={{ fontSize: "13px", color: "var(--text-primary)" }}>{t(item.label)}</div>
                        <label className="toggle">
                          <input type="checkbox" checked={item.checked} onChange={(e) => item.setter(e.target.checked)} />
                          <div className="toggle-track" /><div className="toggle-thumb" />
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Security Settings */}
                <div className="card">
                  <div className="card-header" style={{ marginBottom: 0 }}>
                    <span className="card-title">{t("Security Settings")}</span>
                  </div>
                  <div className="card-body">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                      <div style={{ fontSize: "13px", color: "var(--text-primary)" }}>{t("Force MFA")}</div>
                      <label className="toggle"><input type="checkbox" checked={secForceMfa} onChange={(e) => setSecForceMfa(e.target.checked)} /><div className="toggle-track" /><div className="toggle-thumb" /></label>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                      <div style={{ fontSize: "13px", color: "var(--text-primary)" }}>{t("Session timeout (mins)")}</div>
                      <input className="input" type="number" min="5" max="1440" value={secSessionTimeout} onChange={(e) => setSecSessionTimeout(e.target.value)} style={{ width: "100px", textAlign: "left", paddingLeft: "12px" }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                      <div style={{ fontSize: "13px", color: "var(--text-primary)" }}>{t("Password policy")}</div>
                      <select className="select" value={secPasswordPolicy} onChange={(e) => setSecPasswordPolicy(e.target.value)} style={{ width: "140px", fontSize: "12.5px" }}>
                        <option value="Strong">{t("Strong")}</option><option value="Medium">{t("Medium")}</option><option value="Basic">{t("Basic")}</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                      <div style={{ fontSize: "13px", color: "var(--text-primary)" }}>{t("IP whitelist")}</div>
                      <label className="toggle"><input type="checkbox" checked={secIpWhitelist} onChange={(e) => setSecIpWhitelist(e.target.checked)} /><div className="toggle-track" /><div className="toggle-thumb" /></label>
                    </div>
                  </div>
                </div>

                {/* Integrations Settings */}
                <div className="card">
                  <div className="card-header" style={{ marginBottom: 0 }}>
                    <span className="card-title">{t("Integrations Settings")}</span>
                  </div>
                  <div className="card-body">
                    {([
                      { label: "Microsoft 365",  checked: intMs365,      setter: setIntMs365 },
                      { label: "Salesforce CRM", checked: intSalesforce,  setter: setIntSalesforce },
                      { label: "Jira Sync",      checked: intJira,        setter: setIntJira },
                      { label: "SAP Integration",checked: intSap,         setter: setIntSap },
                    ] as { label: string; checked: boolean; setter: (v: boolean) => void }[]).map((item) => (
                      <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                        <div style={{ fontSize: "13px", color: "var(--text-primary)" }}>{t(item.label)}</div>
                        <label className="toggle">
                          <input type="checkbox" checked={item.checked} onChange={(e) => item.setter(e.target.checked)} />
                          <div className="toggle-track" /><div className="toggle-thumb" />
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Save & Reset Action Bar */}
                <div style={{
                  gridColumn: "span 2",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                  marginTop: "16px",
                  padding: "16px 20px",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "8px",
                  boxShadow: "var(--shadow-sm)"
                }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ padding: "8px 16px", fontSize: "13px" }}
                    onClick={() => setShowResetConfirm(true)}
                  >
                    {t("Restore Defaults")}
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    disabled={isSavingAll}
                    onClick={handleSaveAllSettings}
                    style={{ padding: "8px 20px", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    {isSavingAll && <RefreshCw size={14} className="animate-spin" />}
                    {isSavingAll ? t("Saving...") : t("Save Changes")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* CENTRAL USER DRAWER / MODAL */}
      {showUserModal && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowUserModal(false)}
        >
          <div
            className="modal-content"
            style={{
              background: "var(--bg-surface)",
              borderRadius: "12px",
              padding: "24px",
              width: "min(520px, 95%)",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "var(--shadow-xl)",
              border: "1px solid var(--border-default)",
              animation: "slideDown 0.2s cubic-bezier(0.4,0,0.2,1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: "16px", fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>
              {isEditing ? "Edit User Details" : "Create New User"}
            </h2>

            {isEditing && (
              <div style={{
                padding: "10px",
                background: "rgba(245, 158, 11, 0.08)",
                border: "1px solid rgba(245, 158, 11, 0.2)",
                borderRadius: "6px",
                fontSize: "12px",
                color: "var(--warning-600, #d97706)",
                marginBottom: "16px"
              }}>
                <strong>Warning:</strong> Changing user role takes effect on the user&apos;s next login. Their current active session will continue with their old role.
              </div>
            )}

            <form onSubmit={handleFormSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              
              {/* Full Name */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>
                  Full Name <span style={{ color: "red" }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={formFullname}
                  onChange={(e) => setFormFullname(e.target.value)}
                  className="input"
                  style={{ borderColor: formErrors.fullname ? "red" : undefined }}
                  required
                />
                {formErrors.fullname && (
                  <span style={{ fontSize: "11px", color: "red" }}>{formErrors.fullname}</span>
                )}
              </div>

              {/* Email Address */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>
                  Email Address <span style={{ color: "red" }}>*</span>
                </label>
                <input
                  type="email"
                  placeholder="e.g. john.doe@systemeta.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="input"
                  style={{ borderColor: formErrors.email ? "red" : undefined }}
                  required
                />
                {formErrors.email && (
                  <span style={{ fontSize: "11px", color: "red" }}>{formErrors.email}</span>
                )}
              </div>

              {/* Role Select */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>
                  Role <span style={{ color: "red" }}>*</span>
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="select"
                  style={{ width: "100%" }}
                >
                  <option value="super_admin">Super Admin</option>
                  {isSuperAdmin && <option value="client_manager">Client Manager</option>}
                  <option value="project_manager">Project Manager</option>
                  <option value="senior_consultant">Senior Consultant</option>
                  <option value="consultant">Consultant</option>
                  <option value="accounts">Accounts</option>
                  <option value="client_contact">Client Contact</option>
                </select>
              </div>

              {/* CONDITIONAL FIELD: Assign Projects (shown for PM, SC, Consultant) */}
              {["project_manager", "senior_consultant", "consultant"].includes(formRole) && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>
                    Assign to Project(s)
                  </label>
                  <div style={{
                    maxHeight: "130px",
                    overflowY: "auto",
                    border: "1px solid var(--border-default)",
                    borderRadius: "6px",
                    padding: "8px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    background: "var(--bg-surface-2)"
                  }}>
                    {data.projects.map((p: any) => {
                      const isChecked = formProjectIds.includes(p.id);
                      return (
                        <label key={p.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setFormProjectIds(formProjectIds.filter(id => id !== p.id));
                              } else {
                                setFormProjectIds([...formProjectIds, p.id]);
                              }
                            }}
                          />
                          {p.name}
                        </label>
                      );
                    })}
                  </div>
                  {formErrors.projects && (
                    <span style={{ fontSize: "11px", color: "red" }}>{formErrors.projects}</span>
                  )}
                </div>
              )}

              {/* CONDITIONAL FIELD: Linked Client (shown for client_contact only) */}
              {formRole === "client_contact" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>
                    Linked Client <span style={{ color: "red" }}>*</span>
                  </label>
                  <select
                    value={formClientId}
                    onChange={(e) => setFormClientId(e.target.value)}
                    className="select"
                    style={{ width: "100%" }}
                  >
                    <option value="">-- Select Client --</option>
                    {clientsList.map((client) => (
                      <option key={client} value={client}>{client}</option>
                    ))}
                  </select>
                  {formErrors.client && (
                    <span style={{ fontSize: "11px", color: "red" }}>{formErrors.client}</span>
                  )}
                </div>
              )}

              {/* CONDITIONAL FIELD: Report To (SC) (shown for consultant only) */}
              {formRole === "consultant" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>
                    Report To (Senior Consultant)
                  </label>
                  <select
                    value={formReporteeOf}
                    onChange={(e) => setFormReporteeOf(e.target.value)}
                    className="select"
                    style={{ width: "100%" }}
                  >
                    <option value="">-- None --</option>
                    {seniorConsultants.map((sc) => (
                      <option key={sc.id} value={sc.id}>{sc.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Password resetting trigger in Edit */}
              {isEditing && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 0" }}>
                  <input
                    type="checkbox"
                    id="toggle-pwd-reset"
                    checked={resetPasswordToggle}
                    onChange={(e) => setResetPasswordToggle(e.target.checked)}
                  />
                  <label htmlFor="toggle-pwd-reset" style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                    <KeyRound size={13} /> Force Password Reset
                  </label>
                </div>
              )}

              {/* Password fields (shown when creating OR when reset toggle is active) */}
              {(!isEditing || resetPasswordToggle) && (
                <>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>
                      Temporary Password <span style={{ color: "red" }}>*</span>
                    </label>
                    <input
                      type="password"
                      placeholder="Min 8 characters, uppercase, number"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      className="input"
                      style={{ borderColor: formErrors.password ? "red" : undefined }}
                      required
                    />
                    {formErrors.password && (
                      <span style={{ fontSize: "11px", color: "red" }}>{formErrors.password}</span>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-secondary)" }}>
                      Confirm Password <span style={{ color: "red" }}>*</span>
                    </label>
                    <input
                      type="password"
                      placeholder="Repeat Temporary Password"
                      value={formConfirmPassword}
                      onChange={(e) => setFormConfirmPassword(e.target.value)}
                      className="input"
                      style={{ borderColor: formErrors.confirmPassword ? "red" : undefined }}
                      required
                    />
                    {formErrors.confirmPassword && (
                      <span style={{ fontSize: "11px", color: "red" }}>{formErrors.confirmPassword}</span>
                    )}
                  </div>

                  {/* Pasword Strength Indicator Info Box */}
                  <div style={{
                    fontSize: "11.5px",
                    color: "var(--text-secondary)",
                    background: "var(--bg-surface-2)",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px dashed var(--border-default)"
                  }}>
                    Must be at least <strong>8 characters</strong> long, containing at least <strong>1 uppercase letter</strong> and <strong>1 number</strong>. User will be forced to change this password on their first login.
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowUserModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  {isEditing ? "Save Changes" : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {createdCredentials && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 3000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "fadeIn 0.2s ease",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setCreatedCredentials(null);
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "420px",
              margin: "24px",
              padding: "24px",
              animation: "cardEntrance 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            }}
          >
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>
              User Created Successfully
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px", lineHeight: 1.5 }}>
              Please copy these credentials and share them with the user.
            </p>
            <div style={{ background: "var(--bg-surface-2)", padding: "16px", borderRadius: "8px", marginBottom: "16px", fontSize: "13px", fontFamily: "monospace" }}>
              <div><strong>Login URL:</strong> {window.location.origin}/login</div>
              <div style={{ marginTop: "8px" }}><strong>Email:</strong> {createdCredentials.email}</div>
              <div style={{ marginTop: "8px" }}><strong>Password:</strong> {createdCredentials.password}</div>
            </div>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setCreatedCredentials(null)}>Close</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const text = `Login URL: ${window.location.origin}/login\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.password}`;
                  navigator.clipboard.writeText(text);
                  showToast("Credentials copied to clipboard", "success");
                }}
              >
                Copy Credentials
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 3000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "fadeIn 0.2s ease",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDeleteConfirm(false);
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "420px",
              margin: "24px",
              padding: "24px",
              animation: "cardEntrance 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            }}
          >
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>
              Delete User
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px", lineHeight: 1.5 }}>
              Are you sure you want to delete <strong>{userToDelete?.name}</strong>? This action is permanent and will cascade delete all session records, account records, timesheets, expense records, leave requests, and task comments associated with this user.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeletingUser}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger btn-sm"
                style={{ backgroundColor: "#dc2626", color: "white" }}
                disabled={isDeletingUser}
                onClick={async () => {
                  if (!userToDelete) return;
                  setIsDeletingUser(true);
                  const success = await deleteUser(userToDelete.id);
                  setIsDeletingUser(false);
                  if (success) {
                    setShowDeleteConfirm(false);
                    setUserToDelete(null);
                    fetchAdminData();
                  }
                }}
              >
                {isDeletingUser ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 3000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "fadeIn 0.2s ease",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowResetConfirm(false);
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "420px",
              margin: "24px",
              padding: "24px",
              animation: "cardEntrance 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            }}
          >
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>
              {t("Restore Default Settings")}
            </h3>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px", lineHeight: 1.5 }}>
              Are you sure you want to reset all settings to defaults? This will restore the platform name to "Systemeta", the default currency to INR, numbering system to Indian, timezone to Asia/Kolkata, language to English (India), and default security & notifications policies.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowResetConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger btn-sm"
                style={{ backgroundColor: "#dc2626", color: "white" }}
                onClick={handleConfirmRestoreDefaults}
              >
                Restore Defaults
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ─── Extend Override Modal ─────────────────────────────────────────── */}
      {extendOverrideId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: "var(--bg-card)", borderRadius: "12px", boxShadow: "0 24px 60px rgba(0,0,0,0.3)", width: "440px", maxWidth: "calc(100vw - 48px)", padding: "28px", animation: "cardEntrance 0.3s cubic-bezier(0.175,0.885,0.32,1.275)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
              <Shield size={18} color="#2E86C1" />
              <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Extend Override</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>New Expiration Date *</label>
                <input type="date" className="input" value={extendEndDate} onChange={(e) => setExtendEndDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]} style={{ width: "100%", fontSize: "13px" }} />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: "6px" }}>Reason for Extension *</label>
                <textarea className="input" value={extendReason} onChange={(e) => setExtendReason(e.target.value)}
                  placeholder="Provide justification for extending this override..." rows={3}
                  style={{ width: "100%", fontSize: "13px", resize: "vertical" }} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setExtendOverrideId(null)} disabled={isExtending}>Cancel</button>
              <button className="btn btn-primary btn-sm" disabled={isExtending || !extendEndDate || !extendReason.trim()}
                onClick={async () => {
                  if (!extendEndDate || !extendReason.trim()) { showToast("Please fill in all required fields.", "warning"); return; }
                  setIsExtending(true);
                  try {
                    await updateOverride(extendOverrideId, { action: "extend", endDate: extendEndDate, reason: extendReason.trim() });
                    setExtendOverrideId(null);
                  } finally { setIsExtending(false); }
                }}>
                {isExtending ? "Extending..." : "Confirm Extension"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RouteGuard screenKey="user_management">
        <AdminPageContent />
      </RouteGuard>
    </Suspense>
  );
}
