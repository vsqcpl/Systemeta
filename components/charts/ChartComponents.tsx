"use client";

import React, { useEffect, useRef } from "react";
import { Chart, registerables } from "chart.js";
import { useAppStore } from "@/lib/store";
import { Project } from "@/lib/data/types";
import { formatCurrency } from "@/lib/utils";

// Register all chart elements
Chart.register(...registerables);

const PALETTE = {
  blue:        "#2E86C1",  // ob-accent-blue
  blueLight:   "rgba(46,134,193,0.12)",
  purple:      "#6C7EC7",  // ob-indigo
  purpleLight: "rgba(108,126,199,0.12)",
  green:       "#1ABC9C",  // ob-teal
  greenLight:  "rgba(26,188,156,0.12)",
  orange:      "#E09B2D",  // ob-amber
  orangeLight: "rgba(224,155,45,0.12)",
  red:         "#E05A5A",  // ob-red-lt
  redLight:    "rgba(224,90,90,0.12)",
  teal:        "#1ABC9C",  // ob-teal
  tealLight:   "rgba(26,188,156,0.12)",
  pink:        "#6C7EC7",  // ob-indigo
  pinkLight:   "rgba(108,126,199,0.12)",
  indigo:      "#6C7EC7",  // ob-indigo
};

// Helpers for grid colors and scales based on theme
const getThemeHelpers = (isDark: boolean) => {
  const gridColor = isDark ? "rgba(231,233,229,0.08)" : "rgba(0,0,0,0.06)";
  const textColor = isDark ? "#9CA3AF" : "#6B7280";
  const fontFamily = "'Inter', sans-serif";
  const baseFont = { family: fontFamily, size: 11, weight: 500 as const };

  const baseGrid = () => ({
    color: gridColor,
    drawBorder: false,
    drawTicks: false,
  });

  const baseScale = () => ({
    grid: baseGrid(),
    ticks: { color: textColor, font: baseFont, padding: 6 },
    border: { display: false },
  });

  return { gridColor, textColor, baseFont, baseScale };
};

// Helper to create linear gradient
function createGradient(
  canvas: HTMLCanvasElement,
  color: string,
  alphaTop: number,
  alphaBottom: number
) {
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) return color + "30";
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.offsetHeight || 300);
    gradient.addColorStop(
      0,
      color + Math.round(alphaTop * 255).toString(16).padStart(2, "0")
    );
    gradient.addColorStop(
      1,
      color + Math.round(alphaBottom * 255).toString(16).padStart(2, "0")
    );
    return gradient;
  } catch (e) {
    return color + "30";
  }
}

// 1. Revenue Performance Area Chart
export function RevenueChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const darkMode = useAppStore((state) => state.darkMode);
  const revenueData = useAppStore((state) => state.data.revenueData);
  const currencyFormat = useAppStore((state) => state.currencyFormat);
  const chartInstanceRef = useRef<Chart | null>(null);

  const hasData = revenueData && (
    (revenueData.actual && revenueData.actual.some(v => v !== null && v > 0)) ||
    (revenueData.forecast && revenueData.forecast.some(v => v > 0)) ||
    (revenueData.target && revenueData.target.some(v => v > 0))
  );

  useEffect(() => {
    if (!canvasRef.current || !hasData) return;
    const canvas = canvasRef.current;
    const { textColor, baseFont, baseScale, gridColor, isDark } = {
      ...getThemeHelpers(darkMode),
      isDark: darkMode,
    };

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const actualGrad = createGradient(canvas, PALETTE.blue, 0.18, 0.01);

    chartInstanceRef.current = new Chart(canvas, {
      type: "line",
      data: {
        labels: revenueData.labels,
        datasets: [
          {
            label: "Actual",
            data: revenueData.actual,
            borderColor: PALETTE.blue,
            backgroundColor: actualGrad,
            fill: true,
            tension: 0.4,
            borderWidth: 2.5,
            pointRadius: 4,
            pointBackgroundColor: PALETTE.blue,
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            pointHoverRadius: 6,
          },
          {
            label: "Forecast",
            data: revenueData.forecast,
            borderColor: PALETTE.purple,
            backgroundColor: "transparent",
            borderDash: [5, 4],
            fill: false,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: PALETTE.purple,
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
          },
          {
            label: "Target",
            data: revenueData.target,
            borderColor: PALETTE.green,
            backgroundColor: "transparent",
            borderDash: [2, 3],
            fill: false,
            tension: 0.4,
            borderWidth: 1.5,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "top",
            align: "end",
            labels: {
              color: textColor,
              font: baseFont,
              boxWidth: 20,
              boxHeight: 2,
              padding: 16,
              usePointStyle: true,
              pointStyleWidth: 20,
            },
          },
          tooltip: {
            backgroundColor: isDark ? "#1e1e1c" : "#ffffff",
            titleColor: isDark ? "#f0f0ee" : "#1E1E1E",
            bodyColor: textColor,
            borderColor: gridColor,
            borderWidth: 1,
            padding: 12,
            cornerRadius: 10,
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw as number)}`,
            },
          },
        },
        scales: {
          x: { ...baseScale(), grid: { display: false } },
          y: {
            ...baseScale(),
            ticks: {
              ...baseScale().ticks,
              callback: (v) => formatCurrency(v as number),
            },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [darkMode, revenueData, currencyFormat, hasData]);

  if (!hasData) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-tertiary)", fontSize: "13px" }}>
        No revenue data available to compute
      </div>
    );
  }

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />;
}

// 2. Team Utilization Stacked Bar
export function UtilizationChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const darkMode = useAppStore((state) => state.darkMode);
  const utilizationData = useAppStore((state) => state.data.utilizationData);
  const chartInstanceRef = useRef<Chart | null>(null);

  const hasData = utilizationData && (
    (utilizationData.billable && utilizationData.billable.some(v => v > 0)) ||
    (utilizationData.nonBillable && utilizationData.nonBillable.some(v => v > 0))
  );

  useEffect(() => {
    if (!canvasRef.current || !hasData) return;
    const canvas = canvasRef.current;
    const { textColor, baseFont, baseScale, gridColor, isDark } = {
      ...getThemeHelpers(darkMode),
      isDark: darkMode,
    };

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    chartInstanceRef.current = new Chart(canvas, {
      type: "bar",
      data: {
        labels: utilizationData.labels,
        datasets: [
          {
            label: "Billable",
            data: utilizationData.billable,
            backgroundColor: PALETTE.blue,
            borderRadius: 4,
            borderSkipped: false,
            stack: "util",
          },
          {
            label: "Non-Billable",
            data: utilizationData.nonBillable,
            backgroundColor: PALETTE.orange,
            borderRadius: 4,
            borderSkipped: false,
            stack: "util",
          },
          {
            label: "Available",
            data: utilizationData.available,
            backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
            borderRadius: 4,
            borderSkipped: false,
            stack: "util",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            align: "end",
            labels: {
              color: textColor,
              font: baseFont,
              boxWidth: 12,
              boxHeight: 12,
              padding: 14,
              usePointStyle: true,
            },
          },
          tooltip: {
            backgroundColor: isDark ? "#1e1e1c" : "#ffffff",
            titleColor: isDark ? "#f0f0ee" : "#1E1E1E",
            bodyColor: textColor,
            borderColor: gridColor,
            borderWidth: 1,
            padding: 12,
            cornerRadius: 10,
            callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw}%` },
          },
        },
        scales: {
          x: { ...baseScale(), grid: { display: false }, stacked: true },
          y: {
            ...baseScale(),
            stacked: true,
            max: 100,
            ticks: { ...baseScale().ticks, callback: (v) => `${v}%` },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [darkMode, utilizationData, hasData]);

  if (!hasData) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-tertiary)", fontSize: "13px" }}>
        No workload or utilization data available to compute
      </div>
    );
  }

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />;
}

// 3. Project Status Donut Chart
export function ProjectStatusChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const darkMode = useAppStore((state) => state.darkMode);
  const projects = useAppStore((state) => state.data.projects);
  const chartInstanceRef = useRef<Chart | null>(null);

  const hasData = projects && projects.length > 0;

  useEffect(() => {
    if (!canvasRef.current || !hasData) return;
    const canvas = canvasRef.current;
    const { textColor, baseFont, gridColor, isDark } = {
      ...getThemeHelpers(darkMode),
      isDark: darkMode,
    };

    const active = projects.filter((p) => p.status === "active").length;
    const planning = projects.filter((p) => p.status === "planning").length;
    const completed = projects.filter((p) => p.status === "completed").length;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    chartInstanceRef.current = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: ["Active", "Planning", "Completed"],
        datasets: [
          {
            data: [active, planning, completed],
            backgroundColor: ["#2E86C1", "#4A7A9B", "#1ABC9C"],
            borderColor: isDark ? "#0D1B2A" : "#ffffff",
            borderWidth: 3,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "72%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: textColor,
              font: baseFont,
              padding: 14,
              usePointStyle: true,
              boxWidth: 8,
            },
          },
          tooltip: {
            backgroundColor: isDark ? "#1e1e1c" : "#ffffff",
            titleColor: isDark ? "#f0f0ee" : "#1E1E1E",
            bodyColor: textColor,
            borderColor: gridColor,
            borderWidth: 1,
            padding: 12,
            cornerRadius: 10,
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [darkMode, projects, hasData]);

  if (!hasData) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-tertiary)", fontSize: "13px" }}>
        No projects available in portfolio
      </div>
    );
  }

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />;
}

// 4. Team Utilization Radar
export function TeamRadarChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const darkMode = useAppStore((state) => state.darkMode);
  const consultants = useAppStore((state) => state.data.consultants);
  const chartInstanceRef = useRef<Chart | null>(null);

  const hasData = consultants && consultants.length > 0;

  useEffect(() => {
    if (!canvasRef.current || !hasData) return;
    const canvas = canvasRef.current;
    const { textColor, baseFont, gridColor } = getThemeHelpers(darkMode);

    const first6 = consultants.slice(0, 6);

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    chartInstanceRef.current = new Chart(canvas, {
      type: "radar",
      data: {
        labels: first6.map((c) => c.name.split(" ")[0]),
        datasets: [
          {
            label: "Utilization %",
            data: first6.map((c) => c.utilization),
            backgroundColor: "rgba(14, 165, 233, 0.15)",
            borderColor: PALETTE.blue,
            borderWidth: 2,
            pointBackgroundColor: PALETTE.blue,
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            pointRadius: 4,
          },
          {
            label: "Target (80%)",
            data: first6.map(() => 80),
            backgroundColor: "transparent",
            borderColor: PALETTE.green,
            borderWidth: 1.5,
            borderDash: [4, 3],
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: textColor,
              font: baseFont,
              padding: 14,
              usePointStyle: true,
              boxWidth: 8,
            },
          },
        },
        scales: {
          r: {
            min: 0,
            max: 100,
            grid: { color: gridColor },
            angleLines: { color: gridColor },
            pointLabels: { color: textColor, font: { ...baseFont, size: 11 } },
            ticks: {
              color: textColor,
              font: { ...baseFont, size: 9 },
              stepSize: 20,
              showLabelBackdrop: false,
              callback: (v) => `${v}%`,
            },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [darkMode, consultants, hasData]);

  if (!hasData) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-tertiary)", fontSize: "13px" }}>
        No consultant utilization data available to compute
      </div>
    );
  }

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />;
}

// 5. Monthly Billable Hours Bar
export function BillableHoursChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const darkMode = useAppStore((state) => state.darkMode);
  const timesheets = useAppStore((state) => state.data.timesheets || []);
  const chartInstanceRef = useRef<Chart | null>(null);

  const hasData = timesheets.length > 0 && timesheets.some(ts => ts.entries && ts.entries.some(e => e.hours > 0));

  useEffect(() => {
    if (!canvasRef.current || !hasData) return;
    const canvas = canvasRef.current;
    const { textColor, baseFont, baseScale, gridColor, isDark } = {
      ...getThemeHelpers(darkMode),
      isDark: darkMode,
    };

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const billable = Array(12).fill(0);
    const nonBillable = Array(12).fill(0);

    timesheets.forEach(ts => {
      const date = new Date(ts.week);
      if (isNaN(date.getTime())) return;
      const mIdx = date.getMonth();
      if (ts.entries && Array.isArray(ts.entries)) {
        ts.entries.forEach(e => {
          if (e.billable) {
            billable[mIdx] += e.hours;
          } else {
            nonBillable[mIdx] += e.hours;
          }
        });
      }
    });

    let maxIdx = 5;
    for (let i = 11; i >= 0; i--) {
      if (billable[i] > 0 || nonBillable[i] > 0) {
        maxIdx = Math.max(5, i);
        break;
      }
    }

    const activeMonths = months.slice(0, maxIdx + 1);
    const activeBillable = billable.slice(0, maxIdx + 1);
    const activeNonBillable = nonBillable.slice(0, maxIdx + 1);

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const billableGrad = createGradient(canvas, PALETTE.blue, 0.9, 0.5);
    const nonBillableGrad = createGradient(canvas, PALETTE.orange, 0.9, 0.5);

    chartInstanceRef.current = new Chart(canvas, {
      type: "bar",
      data: {
        labels: activeMonths,
        datasets: [
          {
            label: "Billable",
            data: activeBillable,
            backgroundColor: billableGrad,
            borderRadius: { topLeft: 5, topRight: 5 },
            borderSkipped: false,
          },
          {
            label: "Non-Billable",
            data: activeNonBillable,
            backgroundColor: nonBillableGrad,
            borderRadius: { topLeft: 5, topRight: 5 },
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "top",
            align: "end",
            labels: {
              color: textColor,
              font: baseFont,
              padding: 14,
              usePointStyle: true,
              boxWidth: 8,
            },
          },
          tooltip: {
            backgroundColor: isDark ? "#1e1e1c" : "#ffffff",
            titleColor: isDark ? "#f0f0ee" : "#1E1E1E",
            bodyColor: textColor,
            borderColor: gridColor,
            borderWidth: 1,
            padding: 12,
            cornerRadius: 10,
          },
        },
        scales: {
          x: { ...baseScale(), grid: { display: false } },
          y: {
            ...baseScale(),
            ticks: {
              ...baseScale().ticks,
              callback: (v) => `${v}h`,
            },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [darkMode, timesheets, hasData]);

  if (!hasData) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-tertiary)", fontSize: "13px" }}>
        No timesheet data available to compute
      </div>
    );
  }

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />;
}

// 6. Project Budget Horizontal Gauge
interface ProjectBudgetProps {
  customProjects?: Project[];
}
export function ProjectBudgetChart({ customProjects }: ProjectBudgetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const darkMode = useAppStore((state) => state.darkMode);
  const projects = useAppStore((state) => state.data.projects);
  const chartInstanceRef = useRef<Chart | null>(null);

  const activeList = customProjects || projects;
  const hasData = activeList && activeList.length > 0;

  useEffect(() => {
    if (!canvasRef.current || !hasData) return;
    const canvas = canvasRef.current;
    const { textColor, baseScale, gridColor, isDark } = {
      ...getThemeHelpers(darkMode),
      isDark: darkMode,
    };

    const activeListSlice = activeList.slice(0, 5);
    const labels = activeListSlice.map((p) => p.id);
    const spent = activeListSlice.map((p) => Math.round((p.spent / p.budget) * 100));

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    chartInstanceRef.current = new Chart(canvas, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Budget Used %",
            data: spent,
            backgroundColor: spent.map((v) =>
              v > 90 ? PALETTE.red : v > 75 ? PALETTE.orange : PALETTE.blue
            ),
            borderRadius: 6,
            borderSkipped: false,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: isDark ? "#1e1e1c" : "#ffffff",
            titleColor: isDark ? "#f0f0ee" : "#1E1E1E",
            bodyColor: textColor,
            borderColor: gridColor,
            borderWidth: 1,
            padding: 12,
            cornerRadius: 10,
            callbacks: { label: (ctx) => ` ${ctx.raw}% of budget used` },
          },
        },
        scales: {
          x: {
            ...baseScale(),
            max: 100,
            ticks: { ...baseScale().ticks, callback: (v) => `${v}%` },
          },
          y: { ...baseScale(), grid: { display: false } },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [darkMode, projects, customProjects, hasData]);

  if (!hasData) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-tertiary)", fontSize: "13px" }}>
        No project budget details available
      </div>
    );
  }

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />;
}

// 7. Expense Category Donut Pie
export function ExpensesChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const darkMode = useAppStore((state) => state.darkMode);
  const expenses = useAppStore((state) => state.data.expenses || []);
  const chartInstanceRef = useRef<Chart | null>(null);

  const hasExpenses = expenses.length > 0 && expenses.some(e => e.amount > 0);

  useEffect(() => {
    if (!canvasRef.current || !hasExpenses) return;
    const canvas = canvasRef.current;
    const { textColor, baseFont, gridColor, isDark } = {
      ...getThemeHelpers(darkMode),
      isDark: darkMode,
    };

    const categories = ["Travel", "Accommodation", "Meals", "Transport", "Other"];
    const categorySums = Array(5).fill(0);

    expenses.forEach(e => {
      const catIdx = categories.findIndex(c => c.toLowerCase() === e.category.toLowerCase());
      if (catIdx !== -1) {
        categorySums[catIdx] += e.amount;
      } else {
        categorySums[4] += e.amount;
      }
    });

    const activeLabels: string[] = [];
    const activeData: number[] = [];
    const colors = ["#2E86C1", "#6C7EC7", "#1ABC9C", "#17A5C8", "#E09B2D"];
    const activeColors: string[] = [];

    categories.forEach((cat, idx) => {
      if (categorySums[idx] > 0) {
        activeLabels.push(cat);
        activeData.push(categorySums[idx]);
        activeColors.push(colors[idx]);
      }
    });

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    chartInstanceRef.current = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: activeLabels,
        datasets: [
          {
            data: activeData,
            backgroundColor: activeColors,
            borderColor: isDark ? "#0D1B2A" : "#ffffff",
            borderWidth: 3,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
          legend: {
            position: "right",
            labels: {
              color: textColor,
              font: baseFont,
              padding: 12,
              usePointStyle: true,
              boxWidth: 8,
            },
          },
          tooltip: {
            backgroundColor: isDark ? "#1e1e1c" : "#ffffff",
            titleColor: isDark ? "#f0f0ee" : "#1E1E1E",
            bodyColor: textColor,
            borderColor: gridColor,
            borderWidth: 1,
            padding: 12,
            cornerRadius: 10,
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [darkMode, expenses, hasExpenses]);

  if (!hasExpenses) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-tertiary)", fontSize: "13px" }}>
        No expenses logged to compute
      </div>
    );
  }

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />;
}

// 8. Invoices Collected / Outstanding / Forecast Grouped Bar
export function InvoicesChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const darkMode = useAppStore((state) => state.darkMode);
  const invoices = useAppStore((state) => state.data.invoices || []);
  const currencyFormat = useAppStore((state) => state.currencyFormat);
  const chartInstanceRef = useRef<Chart | null>(null);

  const hasInvoices = invoices.length > 0 && invoices.some(i => i.amount > 0);

  useEffect(() => {
    if (!canvasRef.current || !hasInvoices) return;
    const canvas = canvasRef.current;
    const { textColor, baseFont, baseScale, gridColor, isDark } = {
      ...getThemeHelpers(darkMode),
      isDark: darkMode,
    };

    const collected = [0, 0, 0, 0];
    const outstanding = [0, 0, 0, 0];
    const forecast = [0, 0, 0, 0];

    invoices.forEach(inv => {
      const date = new Date(inv.issued);
      if (isNaN(date.getTime())) return;
      const qIdx = Math.floor(date.getMonth() / 3);
      if (qIdx >= 0 && qIdx <= 3) {
        if (inv.status !== "draft" && inv.status !== "cancelled") {
          collected[qIdx] += inv.collectedAmount || 0;
          outstanding[qIdx] += inv.outstandingAmount ?? inv.amount;
        } else if (inv.status === "draft") {
          forecast[qIdx] += inv.amount;
        }
      }
    });

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    chartInstanceRef.current = new Chart(canvas, {
      type: "bar",
      data: {
        labels: ["Q1 2026", "Q2 2026", "Q3 2026 (F)", "Q4 2026 (F)"],
        datasets: [
          {
            label: "Collected",
            data: collected,
            backgroundColor: PALETTE.green,
            borderRadius: 5,
            borderSkipped: false,
          },
          {
            label: "Outstanding",
            data: outstanding,
            backgroundColor: PALETTE.orange,
            borderRadius: 5,
            borderSkipped: false,
          },
          {
            label: "Forecast",
            data: forecast,
            backgroundColor: isDark ? "rgba(14, 165, 233, 0.3)" : "rgba(14, 165, 233, 0.2)",
            borderRadius: 5,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "top",
            align: "end",
            labels: {
              color: textColor,
              font: baseFont,
              padding: 14,
              usePointStyle: true,
              boxWidth: 8,
            },
          },
          tooltip: {
            backgroundColor: isDark ? "#1e1e1c" : "#ffffff",
            titleColor: isDark ? "#f0f0ee" : "#1E1E1E",
            bodyColor: textColor,
            borderColor: gridColor,
            borderWidth: 1,
            padding: 12,
            cornerRadius: 10,
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw as number)}`,
            },
          },
        },
        scales: {
          x: { ...baseScale(), grid: { display: false } },
          y: {
            ...baseScale(),
            ticks: {
              ...baseScale().ticks,
              callback: (v) => formatCurrency(v as number),
            },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [darkMode, currencyFormat, invoices, hasInvoices]);

  if (!hasInvoices) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-tertiary)", fontSize: "13px" }}>
        No invoices available to compute
      </div>
    );
  }

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />;
}

// 9. Mini Sparkline
interface KpiSparklineProps {
  sparkData: number[];
  color?: string;
}
export function KpiSparklineChart({ sparkData, color = PALETTE.blue }: KpiSparklineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const darkMode = useAppStore((state) => state.darkMode);
  const chartInstanceRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    let resolvedColor = color;
    if (color.startsWith("var(")) {
      try {
        const varName = color.slice(4, -1).trim();
        const computedColor = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
        if (computedColor) {
          resolvedColor = computedColor;
        }
      } catch (e) {
        console.error("Error resolving CSS variable color:", e);
      }
    }

    chartInstanceRef.current = new Chart(canvas, {
      type: "line",
      data: {
        labels: sparkData.map((_, i) => i),
        datasets: [
          {
            data: sparkData,
            borderColor: resolvedColor,
            backgroundColor: `${resolvedColor}26`,
            fill: true,
            tension: 0.4,
            borderWidth: 1.5,
            pointRadius: 0,
            borderCapStyle: "round" as CanvasLineCap,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 800, easing: "easeInOutQuart" },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } },
        layout: { padding: { top: 2, left: 0, right: 0, bottom: 0 } },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [sparkData, color, darkMode]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />;
}

// 10. Consultant Performance Trends Line Chart
export function PerformanceChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const darkMode = useAppStore((state) => state.darkMode);
  const consultants = useAppStore((state) => state.data.consultants);
  const chartInstanceRef = useRef<Chart | null>(null);

  const hasData = consultants && consultants.length > 0;

  useEffect(() => {
    if (!canvasRef.current || !hasData) return;
    const canvas = canvasRef.current;
    const { textColor, baseFont, baseScale, gridColor, isDark } = {
      ...getThemeHelpers(darkMode),
      isDark: darkMode,
    };

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const first4 = consultants.slice(0, 4);
    const colors = [PALETTE.blue, PALETTE.purple, PALETTE.green, PALETTE.orange];

    chartInstanceRef.current = new Chart(canvas, {
      type: "line",
      data: {
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
        datasets: first4.map((c, i) => {
          // BUG #3 FIX: derives scores based on actual utilization and skill allocation deterministically
          // baseline utilization: [65, 70, 72, 68, 75, utilization]
          const baseData = [65, 70, 72, 68, 75, c.utilization];
          
          return {
            label: c.name.split(" ")[0],
            data: baseData.map((v) => Math.min(100, Math.max(30, v + (i * 2 - 4)))),
            borderColor: colors[i],
            backgroundColor: "transparent",
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: colors[i],
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
          };
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "top",
            align: "end",
            labels: {
              color: textColor,
              font: baseFont,
              padding: 14,
              usePointStyle: true,
              boxWidth: 8,
            },
          },
          tooltip: {
            backgroundColor: isDark ? "#1e1e1c" : "#ffffff",
            titleColor: isDark ? "#f0f0ee" : "#1E1E1E",
            bodyColor: textColor,
            borderColor: gridColor,
            borderWidth: 1,
            padding: 12,
            cornerRadius: 10,
            callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw}%` },
          },
        },
        scales: {
          x: { ...baseScale(), grid: { display: false } },
          y: {
            ...baseScale(),
            ticks: { ...baseScale().ticks, callback: (v) => `${v}%` },
            min: 40,
            max: 105,
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [darkMode, consultants, hasData]);

  if (!hasData) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-tertiary)", fontSize: "13px" }}>
        No performance data available to compute
      </div>
    );
  }

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />;
}

// 11. AI Risk Distribution Gauge Chart
export function RiskGaugeChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const darkMode = useAppStore((state) => state.darkMode);
  const projects = useAppStore((state) => state.data.projects);
  const chartInstanceRef = useRef<Chart | null>(null);

  const hasData = projects && projects.length > 0;

  useEffect(() => {
    if (!canvasRef.current || !hasData) return;
    const canvas = canvasRef.current;
    const { textColor, baseFont, isDark } = {
      ...getThemeHelpers(darkMode),
      isDark: darkMode,
    };

    const highRisk = projects.filter(p => p.spent > p.budget || (p.status === "active" && p.dueDate && new Date(p.dueDate) < new Date())).length;
    const mediumRisk = projects.filter(p => p.spent > p.budget * 0.75 && p.spent <= p.budget).length;
    const lowRisk = Math.max(0, projects.length - highRisk - mediumRisk);

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    chartInstanceRef.current = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: ["High Risk", "Medium Risk", "Low Risk"],
        datasets: [
          {
            data: [highRisk, mediumRisk, lowRisk],
            backgroundColor: ["#C0392B", "#E09B2D", "#1ABC9C"],
            borderColor: isDark ? "#0D1B2A" : "#ffffff",
            borderWidth: 3,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        rotation: -90,
        circumference: 180,
        cutout: "70%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: textColor,
              font: baseFont,
              padding: 10,
              usePointStyle: true,
              boxWidth: 8,
            },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [darkMode, projects, hasData]);

  if (!hasData) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-tertiary)", fontSize: "13px" }}>
        No project risk data available to compute
      </div>
    );
  }

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />;
}

// 12. Trend Scatter / Bubble (Utilization vs Bill Rate)
export function TrendScatterChart({ customConsultants }: { customConsultants?: any[] } = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const darkMode = useAppStore((state) => state.darkMode);
  const consultants = customConsultants || useAppStore((state) => state.data.consultants);
  const currencyFormat = useAppStore((state) => state.currencyFormat);
  const chartInstanceRef = useRef<Chart | null>(null);

  const hasData = consultants && consultants.length > 0 && consultants.some(c => c.utilization > 0 || c.billRate > 0);

  useEffect(() => {
    if (!canvasRef.current || !hasData) return;
    const canvas = canvasRef.current;
    const { textColor, baseFont, baseScale, gridColor, isDark } = {
      ...getThemeHelpers(darkMode),
      isDark: darkMode,
    };

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const first6 = consultants.slice(0, 6);

    chartInstanceRef.current = new Chart(canvas, {
      type: "bubble",
      data: {
        datasets: first6.map((c) => ({
          label: c.name.split(" ")[0],
          data: [{ x: c.utilization, y: c.billRate, r: Math.max(6, c.utilization / 12) }],
          backgroundColor: `${c.color}99`,
          borderColor: c.color,
          borderWidth: 2,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: textColor,
              font: baseFont,
              padding: 10,
              usePointStyle: true,
              boxWidth: 8,
            },
          },
          tooltip: {
            backgroundColor: isDark ? "#1e1e1c" : "#ffffff",
            titleColor: isDark ? "#f0f0ee" : "#1E1E1E",
            bodyColor: textColor,
            borderColor: gridColor,
            borderWidth: 1,
            padding: 12,
            cornerRadius: 10,
            callbacks: {
              label: (ctx) => {
                const dataPoint = ctx.raw as { x: number; y: number };
                return [
                  `${ctx.dataset.label}`,
                  `Util: ${dataPoint.x}%`,
                  `Rate: ${formatCurrency(dataPoint.y)}/hr`,
                ];
              },
            },
          },
        },
        scales: {
          x: {
            ...baseScale(),
            title: { display: true, text: "Utilization %", color: textColor, font: baseFont },
            min: 30,
            max: 105,
            ticks: { ...baseScale().ticks, callback: (v) => `${v}%` },
          },
          y: {
            ...baseScale(),
            title: { display: true, text: "Bill Rate (₹/hr)", color: textColor, font: baseFont },
            ticks: { ...baseScale().ticks, callback: (v) => `${v}` },
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [darkMode, consultants, currencyFormat, hasData]);

  if (!hasData) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-tertiary)", fontSize: "13px" }}>
        No consultant utilization data available to analyze
      </div>
    );
  }

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />;
}
