"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import RouteGuard from "@/components/guards/RouteGuard";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import SearchOverlay from "@/components/layout/SearchOverlay";
import ToastContainer from "@/components/layout/ToastContainer";
import { getScreenKey } from "@/lib/permissionHelpers";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const activeModule = useAppStore((state) => state.activeModule);
  const setCurrencyFormat = useAppStore((state) => state.setCurrencyFormat);
  const setCurrencySymbol = useAppStore((state) => state.setCurrencySymbol);
  const setTimezone = useAppStore((state) => state.setTimezone);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const setActiveModule = useAppStore((state) => state.setActiveModule);
  const fetchInitialData = useAppStore((state) => state.fetchInitialData);
  const activeProjectId = useAppStore((state) => state.activeProjectId);
  const [mounted, setMounted] = useState(false);
  const [resolvedModule, setResolvedModule] = useState<string | null>(null);
  const [isInline, setIsInline] = useState(false);
  const [maintenanceActive, setMaintenanceActive] = useState(false);
 
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsInline(window.location.search.includes("inline=true"));
    }
  }, [pathname]);

  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const res = await fetch("/api/branding");
        if (res.ok) {
          const data = await res.json();
          setMaintenanceActive(!!data.maintenanceMode);
        }
      } catch (e) {
        console.error("Failed to check maintenance mode status", e);
      }
    };
    checkMaintenance();
  }, []);
 
  const { user } = useAuth();
  const isClientContact = user?.role === "client_contact" || user?.role === "Client Contact";

  // Redirect client_contact away from portfolio/dashboard screens to their project dashboard
  useEffect(() => {
    if (!isClientContact) return;
    const ccPortfolioRoutes = ["/dashboard", "/projects", "/portfolio", "/billing", "/billing/milestones"];
    if (ccPortfolioRoutes.includes(pathname)) {
      const pid = activeProjectId || "P001";
      router.replace(`/projects/${pid}`);
    }
  }, [isClientContact, pathname, activeProjectId, router]);

  useEffect(() => {
    setMounted(true);
    fetchInitialData();

    // 1. Restore all settings from vsqc_settings (silent — no toast)
    try {
      const vsqcSettings = localStorage.getItem("vsqc_settings");
      if (vsqcSettings) {
        const parsed = JSON.parse(vsqcSettings);
        if (parsed.numberingSystem) setCurrencyFormat(parsed.numberingSystem as "indian" | "intl");
        if (parsed.defaultCurrency) {
          const sym = parsed.defaultCurrency.split(" ")[0] || "₹";
          setCurrencySymbol(sym);
        }
        if (parsed.timezone) setTimezone(parsed.timezone);
        if (parsed.language) setLanguage(parsed.language, true);
      }
    } catch (_) {}

    // 2. Fallback to individual keys for currency/timezone/language
    const saved = localStorage.getItem("currencyFormat") as "indian" | "intl";
    if (saved) setCurrencyFormat(saved);
    const savedTimezone = localStorage.getItem("vsqc_timezone");
    if (savedTimezone) setTimezone(savedTimezone);
    const savedLanguage = localStorage.getItem("vsqc_language");
    if (savedLanguage) {
      setLanguage(savedLanguage, true);
    } else {
      document.documentElement.lang = "en-US";
      document.documentElement.dir = "ltr";
    }

    const savedEmissionFactors = localStorage.getItem("vsqc_emission_factors");
    if (savedEmissionFactors) {
      try {
        useAppStore.getState().setEmissionFactors(JSON.parse(savedEmissionFactors));
      } catch (e) {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve which module to show — client_contact always gets 'projects', others pick from storage
  useEffect(() => {
    if (!mounted) return;

    const isClientContact = user?.role === "client_contact" || user?.role === "Client Contact";
    const isClientManager = user?.role === "client_manager" || user?.role === "Client Manager";

    if (isClientContact) {
      // Client Contact skips module selector — always in Projects module
      setActiveModule("projects");
      setResolvedModule("projects");
      localStorage.setItem("vsqc_active_module", "projects");
      return;
    }

    if (isClientManager) {
      // Restrict /ai access for client_manager
      if (pathname.startsWith("/ai")) {
        router.replace("/cm-dashboard");
        return;
      }

      const savedModule = (localStorage.getItem("vsqc_active_module") || "crm") as "crm" | "timesheets";
      setActiveModule(savedModule as any);
      setResolvedModule(savedModule);
      localStorage.setItem("vsqc_active_module", savedModule);

      const crmRoutes = [
        "/cm-dashboard",
        "/clients",
        "/contacts",
        "/calls",
        "/meetings",
        "/follow-ups",
        "/requirements",
        "/opportunities",
        "/escalations",
        "/reports/cm",
      ];
      // Client Manager timesheet module: only the timesheet log
      const timesheetRoutes = [
        "/timesheets",
        "/leave",
      ];
      
      const isCrmRoute = crmRoutes.some(r => pathname === r || pathname.startsWith(r + "/"));
      const isTimesheetRoute = timesheetRoutes.some(r => pathname === r || pathname.startsWith(r + "/"));

      if (savedModule === "crm" && !isCrmRoute) {
        router.replace("/cm-dashboard");
      } else if (savedModule === "timesheets" && !isTimesheetRoute) {
        router.replace("/timesheets");
      }
      return;
    }

    const savedModule = localStorage.getItem("vsqc_active_module") as "projects" | "timesheets" | null;
    if (savedModule) {
      setActiveModule(savedModule);
      setResolvedModule(savedModule);
    } else if (activeModule) {
      setResolvedModule(activeModule);
    } else {
      router.replace("/select-module");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, user?.role]);

  if (!mounted || (!resolvedModule && !activeModule)) {
    return (
      <div className="loading-screen">
        <img src="/logo.png" alt="Loading" className="loading-logo" style={{ background: "transparent", border: "none", boxShadow: "none", width: "50px", height: "50px", borderRadius: "14px", objectFit: "cover" }} />
        <div className="loading-text">Loading workspace...</div>
        <div className="loading-bar">
          <div className="loading-bar-fill"></div>
        </div>
      </div>
    );
  }


  if (isInline) {
    return (
      <div style={{ display: "flex", height: "100vh", overflow: "hidden", position: "relative", background: "transparent" }}>
        <style dangerouslySetInnerHTML={{ __html: `
          .modal-overlay {
            background: transparent !important;
            backdrop-filter: none !important;
          }
          .modal-content {
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important;
            border: 1px solid var(--border-default) !important;
            margin: auto !important;
          }
          .page-header, .page-title, h1.page-title {
            display: none !important;
          }
          .page-content, .screen {
            padding: 0 !important;
            margin: 0 !important;
            height: 100% !important;
            background: transparent !important;
          }
        ` }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh" }}>
          <div className="page-content" id="page-content" style={{ flex: 1, overflowY: "auto", position: "relative", zIndex: 1, height: "100%", padding: 0 }}>
            <div className="screen">
              <RouteGuard screenKey={getScreenKey(pathname)}>
                {children}
              </RouteGuard>
            </div>
          </div>
        </div>
        <ToastContainer />
      </div>
    );
  }

  if (maintenanceActive && user?.role !== "super_admin") {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)",
        color: "#ffffff",
        fontFamily: "'Inter', sans-serif",
        textAlign: "center",
        padding: "24px",
      }}>
        <div style={{
          background: "rgba(30, 41, 59, 0.7)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "16px",
          padding: "40px",
          maxWidth: "480px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          animation: "fadeIn 0.6s ease-out",
        }}>
          {/* Animated Glowing Gear/Icon */}
          <div style={{
            position: "relative",
            width: "80px",
            height: "80px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <div style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              border: "3px dashed #3b82f6",
              animation: "spin 20s linear infinite",
            }} />
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))" }}>
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>

          <h2 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "12px", letterSpacing: "-0.5px" }}>
            Under Maintenance
          </h2>
          <p style={{ fontSize: "14px", color: "#94a3b8", lineHeight: "1.6", marginBottom: "28px" }}>
            Systemeta is currently undergoing scheduled upgrades to optimize performance. We apologize for the inconvenience and will be back shortly.
          </p>

          {/* Functional Sign Out Button */}
          <button
            onClick={() => {
              fetch("/api/auth/logout", { method: "POST", credentials: "include" })
                .then(() => {
                  window.location.href = "/login";
                })
                .catch(() => {
                  window.location.href = "/login";
                });
            }}
            className="btn"
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#ffffff",
              padding: "10px 24px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign Out
          </button>
        </div>

        {/* Global style block for rotation animation */}
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        ` }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", position: "relative" }}>
      {/* Sidebar */}
      <Sidebar />

      {/* Main app panel */}
      <div className="main main-content" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Topbar */}
        <Topbar />

        {/* Content area */}
        <div className="page-content" id="page-content" style={{ flex: 1, overflowY: "auto", position: "relative", zIndex: 1 }}>
          <div className="screen">
            <RouteGuard screenKey={getScreenKey(pathname)}>
              {children}
            </RouteGuard>
          </div>
        </div>
      </div>

      {/* Overlays and Toasts */}
      <SearchOverlay />
      <ToastContainer />
    </div>
  );
}
