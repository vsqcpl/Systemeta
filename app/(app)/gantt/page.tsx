"use client";

import React, { useState } from "react";
import { GanttChart } from "@/components/charts/GanttChart";
import { useAppStore, useTranslation } from "@/lib/store";

export default function GanttPage() {
  const showToast = useAppStore((state) => state.showToast);
  const { t } = useTranslation();
  const [zoom, setZoom] = useState<"month" | "quarter" | "year">("month");

  const handleZoomChange = (val: "month" | "quarter" | "year") => {
    setZoom(val);
    showToast(`Gantt timeline zoom set to: ${val}`, "info");
  };

  return (
    <div style={{ animation: "fadeIn 0.5s ease-out" }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("Gantt / Timeline")}</h1>
          <p className="page-subtitle">Full portfolio view · Zoom: {zoom.charAt(0).toUpperCase() + zoom.slice(1)}</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div className="tabs">
            {(["month", "quarter", "year"] as const).map((z) => (
              <button
                key={z}
                className={`tab ${zoom === z ? "active" : ""}`}
                onClick={() => handleZoomChange(z)}
              >
                {z.charAt(0).toUpperCase() + z.slice(1)}
              </button>
            ))}
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => showToast("Exporting Gantt timeline...", "success")}
          >
            {t("Export")}
          </button>
        </div>
      </div>

      {/* Legend Card */}
      <div className="card mb-4">
        <div className="card-body" style={{ padding: "16px" }}>
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginBottom: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-secondary)" }}>
              <div style={{ width: "20px", height: "6px", borderRadius: "3px", background: "#2563eb" }} />
              Active
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-secondary)" }}>
              <div style={{ width: "20px", height: "6px", borderRadius: "3px", background: "rgba(37,99,235,0.4)" }} />
              Planned
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-secondary)" }}>
              <div style={{ width: "10px", height: "10px", background: "#10b981", transform: "rotate(45deg)" }} />
              Milestone (On Track)
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-secondary)" }}>
              <div style={{ width: "10px", height: "10px", background: "#ef4444", transform: "rotate(45deg)" }} />
              Milestone (Delayed)
            </div>
          </div>
        </div>
      </div>

      {/* Full Gantt Component */}
      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          <GanttChart zoom={zoom} />
        </div>
      </div>
    </div>
  );
}
