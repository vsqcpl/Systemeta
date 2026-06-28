"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import {
  IconGrid,
  IconFolder,
  IconTarget,
  IconCheck,
  IconCalendar,
  IconUsers,
  IconClock,
  IconUmbrella,
  IconReceipt,
  IconBank,
  IconChart,
  IconAI,
  IconSettings,
  IconUser,
  IconSearch,
} from "@/components/ui/Icons";
import { getScreenKey, canAccessScreen } from "@/lib/permissionHelpers";
import { usePermission } from "@/hooks/usePermission";

export default function SearchOverlay() {
  const router = useRouter();
  const searchOpen = useAppStore((state) => state.searchOpen);
  const setSearchOpen = useAppStore((state) => state.setSearchOpen);
  const data = useAppStore((state) => state.data);
  const setActiveProjectId = useAppStore((state) => state.setActiveProjectId);
  const { role } = usePermission();

  const [query, setQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent searches on open
  useEffect(() => {
    if (searchOpen && typeof window !== "undefined") {
      setRecentSearches(
        JSON.parse(localStorage.getItem("vsqc_recent_searches") || "[]")
      );
    }
  }, [searchOpen]);

  const addRecentSearch = (term: string) => {
    const updated = [term, ...recentSearches.filter((s) => s !== term)].slice(0, 8);
    setRecentSearches(updated);
    localStorage.setItem("vsqc_recent_searches", JSON.stringify(updated));
  };

  const clearHistory = () => {
    setRecentSearches([]);
    localStorage.removeItem("vsqc_recent_searches");
  };

  // Toggle search with keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(!searchOpen);
      } else if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen, setSearchOpen]);

  // Focus input when modal opens
  useEffect(() => {
    if (searchOpen) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  if (!searchOpen) return null;

  const handleClose = () => {
    setSearchOpen(false);
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const searchIndex = [
    { label: 'Executive Dashboard', route: '/dashboard', keywords: ['dashboard', 'executive', 'overview', 'kpi'] },
    { label: 'Project Portfolio', route: '/projects', keywords: ['portfolio', 'projects', 'all projects'] },
    { label: 'Task Management', route: '/tasks', keywords: ['tasks', 'task', 'management', 'todo'] },
    { label: 'Resource Planning', route: '/resources', keywords: ['resource', 'planning', 'team', 'capacity'] },
    { label: 'Timesheets', route: '/timesheets', keywords: ['timesheets', 'time', 'hours', 'clock', 'punch'] },
    { label: 'Leave Management', route: '/leave', keywords: ['leave', 'vacation', 'sick', 'calendar', 'management'] },
    { label: 'Travel & Expenses', route: '/expenses', keywords: ['expenses', 'travel', 'meals', 'spend', 'reimbursement'] },
    { label: 'Billing & Finance', route: '/billing', keywords: ['billing', 'finance', 'invoice', 'payment'] },
    { label: 'Consultant Analytics', route: '/analytics', keywords: ['analytics', 'charts', 'performance', 'utilization'] },
    { label: 'AI Insights Center', route: '/ai', keywords: ['ai', 'insights', 'intelligence', 'analytics'] },
    { label: 'Admin Panel', route: '/admin', keywords: ['admin', 'settings', 'users', 'system'] },
    { label: 'System Settings', route: '/admin?tab=settings', keywords: ['settings', 'system', 'config'] },
    { label: 'User Management', route: '/admin?tab=users', keywords: ['users', 'team', 'members', 'invite'] },
    { label: 'Audit Log', route: '/admin?tab=audit', keywords: ['audit', 'log', 'history', 'activity'] },
    { label: 'Roles & Permissions', route: '/admin?tab=roles', keywords: ['roles', 'permissions', 'access'] },
    { label: 'Gantt / Timeline', route: '/gantt', keywords: ['gantt', 'timeline', 'schedule', 'milestones'] },
    ...(data?.projects || []).map((p) => ({
      label: `Project Dashboard: ${p.name}`,
      route: `/projects/${p.id}`,
      keywords: ['project', 'dashboard', p.id.toLowerCase(), p.name.toLowerCase(), p.client.toLowerCase()]
    }))
  ];

  const getIconForRoute = (route: string) => {
    if (route.startsWith("/admin")) return <IconSettings size={14} />;
    if (route.startsWith("/projects")) return <IconFolder size={14} />;
    if (route.startsWith("/tasks")) return <IconCheck size={14} />;
    if (route.startsWith("/dashboard")) return <IconGrid size={14} />;
    if (route.startsWith("/resources")) return <IconUsers size={14} />;
    if (route.startsWith("/billing")) return <IconBank size={14} />;
    if (route.startsWith("/ai")) return <IconAI size={14} />;
    if (route.startsWith("/timesheets")) return <IconClock size={14} />;
    if (route.startsWith("/leave")) return <IconUmbrella size={14} />;
    if (route.startsWith("/expenses")) return <IconReceipt size={14} />;
    if (route.startsWith("/analytics")) return <IconChart size={14} />;
    if (route.startsWith("/gantt")) return <IconCalendar size={14} />;
    return <IconGrid size={14} />;
  };

  const getResults = () => {
    const lq = query.toLowerCase().trim();
    if (!lq) return [];
    
    // Filter index items by role permissions
    const allowedIndex = searchIndex.filter((item) => {
      const key = getScreenKey(item.route);
      return role ? canAccessScreen(key, role) : false;
    });

    return allowedIndex.filter(
      (item) =>
        item.label.toLowerCase().includes(lq) ||
        item.keywords.some((kw) => kw.toLowerCase().includes(lq))
    );
  };

  const results = getResults();

  const handleResultClick = (result: typeof searchIndex[0]) => {
    addRecentSearch(result.label);
    const projectMatch = result.route.match(/^\/projects\/([^/?#]+)/);
    if (projectMatch && projectMatch[1] && projectMatch[1] !== "all") {
      setActiveProjectId(projectMatch[1]);
    }
    router.push(result.route);
    handleClose();
  };

  const handleRecentSearchClick = (term: string) => {
    setQuery(term);
  };

  return (
    <div
      className="search-overlay"
      id="search-overlay"
      onClick={handleContainerClick}
      style={{ display: "flex" }}
    >
      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="search-input-wrapper">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-tertiary)"
            strokeWidth="2.5"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            id="search-input"
            ref={inputRef}
            placeholder="Search projects, tasks, consultants..."
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="search-results" id="search-results">
          {query.trim() === "" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px" }}>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.4px", textTransform: "uppercase" }}>
                  Recent Searches
                </span>
                {recentSearches.length > 0 && (
                  <button
                    onClick={clearHistory}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--text-tertiary)",
                      fontSize: "11.5px",
                      cursor: "pointer",
                      padding: 0,
                      fontWeight: 500,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-tertiary)")}
                  >
                    Clear History
                  </button>
                )}
              </div>
              {recentSearches.length === 0 ? (
                <div style={{ fontSize: "12px", color: "var(--text-tertiary)", padding: "12px 8px" }}>
                  No recent searches
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  {recentSearches.map((term, index) => (
                    <div
                      key={index}
                      className="search-result-item"
                      style={{ cursor: "pointer" }}
                      onClick={() => handleRecentSearchClick(term)}
                    >
                      <div className="search-result-icon">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="11" cy="11" r="8" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                      </div>
                      <div>
                        <div className="search-result-title">{term}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : results.length === 0 ? (
            <div className="empty-state" style={{ padding: "28px" }}>
              <div className="empty-icon"><IconSearch size={28} style={{ color: "var(--text-tertiary)" }} /></div>
              <div className="empty-title">No results for &apos;{query}&apos;</div>
              <div className="empty-desc">Try a different search term</div>
            </div>
          ) : (
            results.map((r, i) => (
              <div key={i} className="search-result-item" onClick={() => handleResultClick(r)}>
                <div className="search-result-icon">{getIconForRoute(r.route)}</div>
                <div>
                  <div className="search-result-title">{r.label}</div>
                  <div className="search-result-sub">
                    {r.route}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
