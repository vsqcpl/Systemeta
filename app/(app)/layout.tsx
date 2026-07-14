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
 
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsInline(window.location.search.includes("inline=true"));
    }
  }, [pathname]);
 
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
