"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";

import { useAppStore, useTranslation } from "@/lib/store";
import { getGlobalCurrencySymbol, getGlobalCurrencyFormat } from "@/lib/utils";

// Local Exact Formatting Function - Overrides global suffix rounding (Cr, L)
const formatCurrency = (val: number) => {
  const sym = getGlobalCurrencySymbol();
  const fmt = getGlobalCurrencyFormat();
  
  const formatter = new Intl.NumberFormat(fmt === "indian" ? "en-IN" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  const isNegative = val < 0;
  const formatted = formatter.format(Math.abs(val));
  return (isNegative ? "-" : "") + sym + formatted;
};
import { useAuth } from "@/hooks/useAuth";
import { filterExpenses, filterProjects } from "@/lib/dataFilters";
import ActionGuard from "@/components/guards/ActionGuard";
import { ExpenseCategory } from "@/lib/data/types";
import {
  IconPlane,
  IconHotel,
  IconUtensils,
  IconCar,
  IconPackage,
  IconFileText,
  IconPaperclip,
  IconAlert,
  IconCheckCircle,
  IconClose,
} from "@/components/ui/Icons";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from "recharts";

// Pure SVG donut chart — avoids Recharts PolarChart infinite-loop bug
function SvgDonutChart({ data, colors }: { data: { name: string; value: number; percentage: number }[]; colors: string[] }) {
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 70;
  const innerR = 50;
  const gap = 3; // degrees gap between slices
  const total = data.reduce((s, d) => s + d.value, 0);

  let cumAngle = -90; // start at top
  const slices = data.map((d, i) => {
    const angle = (d.value / total) * 360 - gap;
    const start = cumAngle + gap / 2;
    cumAngle += (d.value / total) * 360;
    const end = start + angle;

    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const x1 = cx + outerR * Math.cos(toRad(start));
    const y1 = cy + outerR * Math.sin(toRad(start));
    const x2 = cx + outerR * Math.cos(toRad(end));
    const y2 = cy + outerR * Math.sin(toRad(end));
    const x3 = cx + innerR * Math.cos(toRad(end));
    const y3 = cy + innerR * Math.sin(toRad(end));
    const x4 = cx + innerR * Math.cos(toRad(start));
    const y4 = cy + innerR * Math.sin(toRad(start));
    const large = angle > 180 ? 1 : 0;

    return {
      d: `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${large} 0 ${x4} ${y4} Z`,
      color: colors[i % colors.length],
      name: d.name,
    };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", margin: "0 auto" }}>
      {slices.map((s, i) => (
        <path key={i} d={s.d} fill={s.color} />
      ))}
    </svg>
  );
}

const CATEGORY_COLORS = ["#2E86C1", "#6C7EC7", "#1ABC9C", "#17A5C8", "#E09B2D"];

const EXPENSE_DETAILS_MAP: Record<string, {
  title: string;
  id: string;
  employeeName: string;
  projectCode: string;
  date: string;
  submittedDate: string;
  category: string;
  amount: number;
  status: string;
  receiptAttached: string;
  description: string;
  approvalStatus: string;
  reimbursementStage: string;
}> = {};

export default function ExpensesPage() {
  const data = useAppStore((state) => state.data);
  const darkMode = useAppStore((state) => state.darkMode);
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAccountsOrAdmin = user?.role === "super_admin" || user?.role === "Super Admin" || user?.role === "accounts" || user?.role === "Accounts";
  const showToast = useAppStore((state) => state.showToast);
  const approveExpense = useAppStore((state) => state.approveExpense);
  const rejectExpense = useAppStore((state) => state.rejectExpense);
  const deleteExpense = useAppStore((state) => state.deleteExpense);
  const addExpense = useAppStore((state) => state.addExpense);

  // Stable memoized arrays — MUST use useMemo, never inline .filter()
  // Inline .filter() creates a new array reference every render, which causes
  // any useEffect depending on them to loop infinitely.
  const visibleExpenses = useMemo(
    () => (user ? filterExpenses(data.expenses, user) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.expenses, user?.id]
  );
  const visibleProjects = useMemo(
    () => (user ? filterProjects(data.projects, user) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.projects, user?.id]
  );

  // Analytics calculations have been moved down below the filteredExpenses declaration
  // to ensure a single source of truth and full synchronization.

  // Filter States
  const [selectedProject, setSelectedProject] = useState("All Projects");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [dateRangeFilter, setDateRangeFilter] = useState("All Dates");
  const [searchTerm, setSearchTerm] = useState("");

  // Modals & Tracker
  const [showForm, setShowForm] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [selectedTrackerId, setSelectedTrackerId] = useState<string | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  
  const [expenseStage, setExpenseStage] = useState("");
  const [expenseOnHoldReason, setExpenseOnHoldReason] = useState("");
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);

  // Sync state when selectedExpense changes
  useEffect(() => {
    if (selectedExpense) {
      setExpenseStage(selectedExpense.reimbursementStage || "Pending");
      setExpenseOnHoldReason(selectedExpense.onHoldReason || "");
    }
  }, [selectedExpense]);

  const handleUpdateExpenseStage = async () => {
    if (!selectedExpense) return;
    setIsUpdatingStage(true);
    try {
      const res = await fetch(`/api/expenses/${selectedExpense.id}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: expenseStage, reason: expenseOnHoldReason }),
      });
      if (res.ok) {
        showToast("Expense stage updated successfully", "success");
        // Update local state
        const updated = await res.json();
        useAppStore.setState((s: any) => ({
          data: {
            ...s.data,
            expenses: s.data.expenses.map((e: any) => e.id === selectedExpense.id ? { ...e, reimbursementStage: expenseStage, onHoldReason: expenseOnHoldReason } : e)
          }
        }));
        setSelectedExpense({ ...selectedExpense, reimbursementStage: expenseStage, onHoldReason: expenseOnHoldReason });
      } else {
        const err = await res.json();
        showToast(err.message || "Failed to update stage", "danger");
      }
    } catch (e) {
      showToast("Error updating stage", "danger");
    } finally {
      setIsUpdatingStage(false);
    }
  };

  // Form State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [receipt, setReceipt] = useState<{
    fileName: string;
    fileSize: string;
    fileType: string;
    previewUrl: string;
    supabaseUrl: string;  // real Supabase public URL
    timestamp: string;
  } | null>(null);


  const [newExpense, setNewExpense] = useState({
    description: "",
    amount: "",
    consultant: "",
    project: "",
    category: "Travel",
    date: new Date().toISOString().split("T")[0],
    modeOfTransport: "",
    fromLocation: "",
    toLocation: "",
    calculatedDistance: null as number | null,
    mealLocation: "residence",
  });

  const [fromQuery, setFromQuery] = useState("");
  const [toQuery, setToQuery] = useState("");
  const [fromResults, setFromResults] = useState<any[]>([]);
  const [toResults, setToResults] = useState<any[]>([]);
  const [fromCoords, setFromCoords] = useState<{ lat: string; lon: string } | null>(null);
  const [toCoords, setToCoords] = useState<{ lat: string; lon: string } | null>(null);
  const [showFromResults, setShowFromResults] = useState(false);
  const [showToResults, setShowToResults] = useState(false);

  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);

  const handleCalculateDistance = () => {
    if (!fromCoords || !toCoords || !newExpense.modeOfTransport) return;
    setIsCalculatingDistance(true);

    if (newExpense.modeOfTransport === "Flight" || newExpense.modeOfTransport === "Train") {
      // Straight line distance for Flight / Train
      const lat1 = parseFloat(fromCoords.lat);
      const lon1 = parseFloat(fromCoords.lon);
      const lat2 = parseFloat(toCoords.lat);
      const lon2 = parseFloat(toCoords.lon);
      const R = 6371; 
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distKm = R * c;
      
      setTimeout(() => {
        setNewExpense((prev) => ({ ...prev, calculatedDistance: parseFloat(distKm.toFixed(1)) }));
        setIsCalculatingDistance(false);
      }, 500); // Simulate network delay
      return;
    }

    const profile = newExpense.modeOfTransport === "Bike" ? "cycling" : "driving";

    fetch(`https://router.project-osrm.org/route/v1/${profile}/${fromCoords.lon},${fromCoords.lat};${toCoords.lon},${toCoords.lat}?overview=false`)
      .then((res) => res.json())
      .then((data) => {
        if (data.routes && data.routes.length > 0) {
          const distKm = data.routes[0].distance / 1000;
          setNewExpense((prev) => ({ ...prev, calculatedDistance: parseFloat(distKm.toFixed(1)) }));
        }
      })
      .catch((err) => console.error("OSRM Error:", err))
      .finally(() => setIsCalculatingDistance(false));
  };

  const nominatimTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const searchNominatim = (query: string, setter: React.Dispatch<React.SetStateAction<any[]>>) => {
    if (nominatimTimeoutRef.current) {
      clearTimeout(nominatimTimeoutRef.current);
    }

    if (query.length < 3) {
      setter([]);
      return;
    }

    nominatimTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/nominatim?q=${encodeURIComponent(query)}`);
        if (!res.ok) {
          if (res.status === 429) {
            console.warn("Nominatim rate limit hit (429). Please wait a moment.");
          } else {
            console.warn(`Nominatim search failed: ${res.status}`);
          }
          setter([]);
          return;
        }
        const data = await res.json();
        setter(data);
      } catch (err) {
        console.error("Nominatim Error:", err);
      }
    }, 1200);
  };

  // One-time init: populate form defaults on first render only.
  // We intentionally use an empty dep array — we only want to seed the form once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setNewExpense((prev) => ({
      ...prev,
      consultant: user?.id ?? data.consultants?.[0]?.id ?? "",
      project: data.projects?.[0]?.id ?? "",
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One-time init: select first tracker item. Use a ref guard so this only runs
  // once even if visibleExpenses reference changes (avoids infinite loop).
  const trackerInitRef = useRef(false);
  useEffect(() => {
    if (!trackerInitRef.current && visibleExpenses.length > 0) {
      trackerInitRef.current = true;
      setSelectedTrackerId(visibleExpenses[0].id);
    }
  }, [visibleExpenses]);

  const handleFormChange = (field: string, value: string) => {
    setNewExpense((prev) => ({ ...prev, [field]: value }));
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024;
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];

    if (!allowedTypes.includes(file.type)) {
      showToast("Unsupported file type! Only JPG, PNG, and PDF are allowed.", "danger");
      return;
    }
    if (file.size > maxSize) {
      showToast("File size exceeds 10MB limit!", "danger");
      return;
    }

    setReceiptUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "expenses");

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const result = await res.json();

      if (!res.ok || !result.url) {
        throw new Error(result.error || "Upload failed");
      }

      // For images create a local preview; for PDFs show a PDF icon
      const previewUrl = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : "";

      setReceipt({
        fileName: file.name,
        fileSize: result.fileSize,
        fileType: file.type,
        previewUrl,
        supabaseUrl: result.url,
        timestamp: new Date().toLocaleString(),
      });
      showToast("Receipt uploaded to cloud storage.", "success");
    } catch (err: any) {
      showToast("Receipt upload failed: " + err.message, "danger");
    } finally {
      setReceiptUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const resetExpenseForm = () => {
    setNewExpense({
      description: "",
      amount: "",
      consultant: user?.id ?? data.consultants?.[0]?.id ?? "",
      project: data.projects?.[0]?.id ?? "",
      category: "Travel",
      date: new Date().toISOString().split("T")[0],
      modeOfTransport: "",
      fromLocation: "",
      toLocation: "",
      calculatedDistance: null,
      mealLocation: "residence",
    });
    setFromQuery("");
    setToQuery("");
    setFromCoords(null);
    setToCoords(null);
    setReceipt(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmitExpense = async () => {
    if (!newExpense.description || !newExpense.amount) {
      showToast("Please fill in description and amount.", "warning");
      return;
    }

    try {
      const finalProject = newExpense.project || visibleProjects[0]?.id;
      const finalConsultant = newExpense.consultant || (user?.role === "super_admin" ? data.consultants[0]?.id : user?.id);

      if (!finalProject || !finalConsultant) {
        showToast("Project and Consultant are required.", "warning");
        return;
      }

      await addExpense({
        description: newExpense.description,
        amount: Number(newExpense.amount),
        consultant: finalConsultant,
        project: finalProject,
        category: newExpense.category as ExpenseCategory,
        date: newExpense.date,
        currency: "INR",
        receiptUrl: receipt?.supabaseUrl,
        modeOfTransport: newExpense.modeOfTransport || undefined,
        fromLocation: newExpense.fromLocation || undefined,
        toLocation: newExpense.toLocation || undefined,
        calculatedDistance: newExpense.calculatedDistance ?? undefined,
        isOutsideCity: newExpense.category === "Meals" ? newExpense.mealLocation === "outside" : undefined,
      });

      // Reset Form only if successful
      resetExpenseForm();
      setShowForm(false);
      showToast("Expense submitted successfully.", "success");
    } catch (error) {
      // The store already shows the toast for the error. We just prevent form close.
      console.warn("Expense submission failed:", error);
    }
  };

  const handleRemoveReceipt = () => {
    setReceipt(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    showToast("Receipt removed.", "info");
  };

  const handleExport = () => {
    if (!visibleExpenses?.length) {
      showToast("No expenses to export.", "warning");
      return;
    }
    const headers = ["Description", "Amount", "Consultant", "Project", "Category", "Status", "Date"];
    const rows = visibleExpenses.map((e) => [
      e.description,
      e.amount,
      e.consultant,
      e.project,
      e.category,
      e.status,
      e.date,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows].map((r) => r.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "expenses_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Expenses report exported as CSV.", "success");
  };

  const getExpenseDetails = (expense: any) => {
    if (!expense) return null;
    const staticData = EXPENSE_DETAILS_MAP[expense.id];
    if (staticData) {
      let currentStatus = staticData.status;
      let currentApprovalStatus = staticData.approvalStatus;
      let currentReimbursementStage = staticData.reimbursementStage;

      if (expense.status === "approved") {
        currentStatus = "Approved";
        currentApprovalStatus = "Approved";
        currentReimbursementStage = "Payment queued";
      } else if (expense.status === "rejected") {
        currentStatus = "Rejected";
        currentApprovalStatus = "Rejected";
        currentReimbursementStage = "Hold pending approval";
      } else if (expense.status === "pending") {
        currentStatus = "Pending";
        currentApprovalStatus = "Awaiting Manager Review";
        currentReimbursementStage = "Hold pending approval";
      }

      return {
        ...staticData,
        status: currentStatus,
        approvalStatus: currentApprovalStatus,
        reimbursementStage: currentReimbursementStage,
      };
    }

    const consultantObj = data.consultants.find((c: any) => c.id === expense.consultant);
    const employeeName = consultantObj ? consultantObj.name : expense.consultant || "Unknown";
    
    const statusLower = expense.status.toLowerCase();
    const displayStatus = statusLower === "approved" ? "Approved" : statusLower === "rejected" ? "Rejected" : "Pending";
    const approvalStatus = statusLower === "approved" ? "Approved" : statusLower === "rejected" ? "Rejected" : "Awaiting Manager Review";
    const reimbursementStage = statusLower === "approved" ? "Payment queued" : "Hold pending approval";

    return {
      title: expense.description.replace(/^\[Policy:\s*[^\]]+\]\s*/i, ""),
      id: expense.id.startsWith("E") ? `EXP-${expense.id.slice(1)}` : expense.id,
      employeeName,
      projectCode: expense.project,
      date: expense.date,
      submittedDate: expense.date,
      category: expense.category,
      amount: expense.amount,
      status: displayStatus,
      receiptAttached: expense.receipt ? "Receipt Attached" : "Missing Receipt",
      description: expense.description,
      approvalStatus,
      reimbursementStage,
    };
  };

  const details = selectedExpense ? getExpenseDetails(selectedExpense) : null;

  if (!data) return null;

  // Advanced Filtering
  const filteredExpenses = useMemo(() => {
    return visibleExpenses.filter((e) => {
      const matchesSearch =
        e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesProject = selectedProject === "All Projects" || e.project === selectedProject;
      const matchesCategory = categoryFilter === "All Categories" || e.category === categoryFilter;
      
      let matchesStatus = true;
      if (statusFilter !== "All Statuses") {
        if (statusFilter === "Approved") matchesStatus = e.status === "approved";
        else if (statusFilter === "Awaiting Approval") matchesStatus = e.status === "pending";
        else if (statusFilter === "Rejected") matchesStatus = e.status === "rejected";
        else if (statusFilter === "Under Review") matchesStatus = e.status === "pending"; // simulate under review
      }

      let matchesDate = true;
      if (dateRangeFilter !== "All Dates") {
        const dateLimit = new Date();
        if (dateRangeFilter === "Last 30 Days") {
          dateLimit.setDate(dateLimit.getDate() - 30);
        } else if (dateRangeFilter === "This Month") {
          dateLimit.setDate(1);
        } else if (dateRangeFilter === "Last 3 Months") {
          dateLimit.setMonth(dateLimit.getMonth() - 3);
        }
        const claimDate = new Date(e.date);
        matchesDate = claimDate >= dateLimit;
      }

      return matchesSearch && matchesProject && matchesCategory && matchesStatus && matchesDate;
    });
  }, [visibleExpenses, searchTerm, selectedProject, categoryFilter, statusFilter, dateRangeFilter]);

  // Business Logic: Exclude rejected expenses from analytics calculations
  const analyticsExpenses = useMemo(() => filteredExpenses.filter((e) => e.status !== "rejected"), [filteredExpenses]);

  // Precise calculation helper to prevent floating-point errors and support massive amounts
  const preciseSum = (expenses: any[]) => {
    let maxDec = 0;
    for (const e of expenses) {
      if (!e.amount) continue;
      let s = e.amount.toString();
      if (s.includes('e')) s = Number(e.amount).toLocaleString('fullwide', {useGrouping:false, maximumFractionDigits: 20});
      const parts = s.split('.');
      if (parts[1] && parts[1].length > maxDec) maxDec = parts[1].length;
    }
    
    let totalBig = BigInt(0);
    for (const e of expenses) {
      if (!e.amount) continue;
      let s = e.amount.toString();
      if (s.includes('e')) s = Number(e.amount).toLocaleString('fullwide', {useGrouping:false, maximumFractionDigits: 20});
      const parts = s.split('.');
      const intPart = parts[0] || '0';
      const decPart = parts[1] || '';
      const paddedDec = decPart.padEnd(maxDec, '0');
      totalBig += BigInt(intPart + paddedDec);
    }
    
    const totalStr = totalBig.toString();
    if (maxDec === 0) return Number(totalStr);
    
    const isNeg = totalStr.startsWith('-');
    const absStr = isNeg ? totalStr.slice(1) : totalStr;
    const paddedAbs = absStr.padStart(maxDec + 1, '0');
    const intResult = paddedAbs.slice(0, paddedAbs.length - maxDec);
    const decResult = paddedAbs.slice(paddedAbs.length - maxDec);
    return Number((isNeg ? '-' : '') + intResult + '.' + decResult);
  };

  // KPI calculations
  const totalAllSubmitted = useMemo(() => preciseSum(filteredExpenses), [filteredExpenses]);
  const totalSubmitted = useMemo(() => preciseSum(analyticsExpenses), [analyticsExpenses]);
  const pendingAmount = useMemo(() => preciseSum(analyticsExpenses.filter((e) => e.status === "pending")), [analyticsExpenses]);
  const approvedAmount = useMemo(() => preciseSum(analyticsExpenses.filter((e) => e.status === "approved")), [analyticsExpenses]);
  const avgClaim = analyticsExpenses.length ? totalSubmitted / analyticsExpenses.length : 0;
  const progressPercent = totalSubmitted > 0 ? Math.round((approvedAmount / totalSubmitted) * 100) : 0;

  // Analytics calculations updated to use analyticsExpenses as the single source of truth
  const categoryData = useMemo(() => {
    const categories = ["Travel", "Accommodation", "Meals", "Transport", "Other"];
    const grouped: Record<string, any[]> = {};
    categories.forEach(c => grouped[c] = []);
    grouped["Other"] = [];
    
    analyticsExpenses.forEach((e) => {
      if (categories.includes(e.category)) {
        grouped[e.category].push(e);
      } else {
        grouped["Other"].push(e);
      }
    });
    
    return categories.map((name) => {
      const val = preciseSum(grouped[name]);
      const percentage = totalSubmitted > 0 ? (val / totalSubmitted) * 100 : 0;
      return { name, value: val, percentage };
    });
  }, [analyticsExpenses, totalSubmitted]);

  const monthlyData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const grouped: Record<string, any[]> = {};
    months.forEach(m => grouped[m] = []);
    
    analyticsExpenses.forEach((e) => {
      const dateParts = e.date.split("-");
      if (dateParts.length >= 2) {
        const monthIdx = parseInt(dateParts[1], 10) - 1;
        if (monthIdx >= 0 && monthIdx < 12) {
          grouped[months[monthIdx]].push(e);
        }
      }
    });
    
    return ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((m) => ({
      month: m,
      Spend: preciseSum(grouped[m]),
    }));
  }, [analyticsExpenses]);

  const recentActivities = useMemo(() => {
    const sorted = [...visibleExpenses].sort((a, b) => {
      const timeA = new Date(a.date).getTime();
      const timeB = new Date(b.date).getTime();
      return timeB - timeA;
    });

    return sorted
      .slice(0, 5)
      .map((e, idx) => {
        const statusText = e.status === "approved" ? "approved" : e.status === "rejected" ? "rejected" : "submitted";
        const type = e.status === "approved" ? "approve" : e.status === "rejected" ? "reject" : "submit";
        const consultantObj = data.consultants.find((c: any) => c.id === e.consultant);
        const name = consultantObj ? consultantObj.name : e.consultant || "Someone";
        return {
          id: idx,
          text: `${name} ${statusText} ${e.category.toLowerCase()} expense claim for ${formatCurrency(e.amount)} (${e.project})`,
          time: e.date,
          type,
        };
      });
  }, [visibleExpenses, data.consultants]);

  // Selected Expense for Workflow Tracker
  const trackedExpense = visibleExpenses.find((e) => e.id === (selectedTrackerId || ""));

  const getWorkflowSteps = (status: string) => {
    const steps = [
      { title: "Draft Created", desc: "Submitted by consultant", state: "done" },
      { title: "Receipt Validated", desc: "AI audit verification passed", state: "done" },
      { title: "Manager Review", desc: status === "approved" ? "Approved by Director" : status === "rejected" ? "Rejected" : "Awaiting review", state: status === "approved" ? "done" : status === "rejected" ? "error" : "active" },
      { title: "Reimbursement", desc: status === "approved" ? "Payment queued" : "Hold pending approval", state: status === "approved" ? "done" : "pending" },
    ];
    return steps;
  };

  return (
    <div style={{ animation: "fadeIn 0.5s ease-out", color: "var(--text-primary)" }}>
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/jpg,image/png,application/pdf"
        style={{ display: "none" }}
      />

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("Travel & Expenses")}</h1>
          <p className="page-subtitle">
            {filteredExpenses.length} {t("claims filtered")} · {t("Total")} {formatCurrency(totalSubmitted)}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button className="btn btn-secondary btn-sm" onClick={handleExport}>
            {t("Export CSV")}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
            {t("Submit Expense")}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        
        {/* Card 1 */}
        <div className="card" style={{ padding: "20px", borderLeft: "4px solid var(--ob-accent-blue)" }}>
          <div style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
            {t("Total Expenses Submitted")}
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--text-primary)" }}>
            {formatCurrency(totalAllSubmitted)}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>{t("Across all expense categories")}</div>
        </div>

        {/* Card 2 */}
        <div className="card" style={{ padding: "20px", borderLeft: "4px solid var(--ob-amber)" }}>
          <div style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
            {t("Awaiting Approval")}
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--text-primary)" }}>
            {formatCurrency(pendingAmount)}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>{t("Pending manager review")}</div>
        </div>

        {/* Card 3 */}
        <div className="card" style={{ padding: "20px", borderLeft: "4px solid var(--ob-teal)" }}>
          <div style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
            {t("Approved Expenses")}
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--text-primary)" }}>
            {formatCurrency(approvedAmount)}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>{t("Approved for reimbursement")}</div>
        </div>

        {/* Card 4 */}
        <div className="card" style={{ padding: "20px", borderLeft: "4px solid var(--ob-indigo)" }}>
          <div style={{ fontSize: "11px", color: "var(--text-tertiary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
            {t("Average Claim Value")}
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--text-primary)" }}>
            {formatCurrency(avgClaim)}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>{t("Average amount per expense claim")}</div>
        </div>

      </div>

      {/* Main Grid: Claims List & Advanced Filters */}
      <div className="grid-7-3" style={{ gap: "20px", marginBottom: "24px" }}>
        
        {/* Left Column: Claims & Management */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Claims List Card */}
          <div className="card">
            <div className="card-header" style={{ display: "flex", flexDirection: "column", gap: "16px", paddingBottom: "16px", borderBottom: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                <span className="card-title" style={{ fontSize: "16px" }}>{t("Recent Expense Claims")}</span>
                <span className="badge badge-brand">{filteredExpenses.length} {t("Claims Found")}</span>
              </div>

              {/* Filters Panel */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: "10px", width: "100%" }}>
                <input
                  type="text"
                  placeholder={t("Search claims...")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input"
                  style={{ fontSize: "12.5px", padding: "6px 10px", width: "100%" }}
                />

                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="select"
                  style={{ fontSize: "12px", padding: "6px" }}
                >
                  <option value="All Projects">{t("All Projects")}</option>
                  {visibleProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.id}
                    </option>
                  ))}
                </select>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="select"
                  style={{ fontSize: "12px", padding: "6px" }}
                >
                  <option value="All Categories">{t("All Categories")}</option>
                  <option value="Travel">{t("Travel")}</option>
                  <option value="Accommodation">{t("Accommodation")}</option>
                  <option value="Meals">{t("Meals")}</option>
                  <option value="Transport">{t("Transport")}</option>
                  <option value="Other">{t("Other")}</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="select"
                  style={{ fontSize: "12px", padding: "6px" }}
                >
                  <option value="All Statuses">{t("All Statuses")}</option>
                  <option value="Approved">{t("Approved")}</option>
                  <option value="Awaiting Approval">{t("Awaiting Approval")}</option>
                  <option value="Rejected">{t("Rejected")}</option>
                  <option value="Under Review">{t("Under Review")}</option>
                </select>

                <select
                  value={dateRangeFilter}
                  onChange={(e) => setDateRangeFilter(e.target.value)}
                  className="select"
                  style={{ fontSize: "12px", padding: "6px" }}
                >
                  <option value="All Dates">{t("All Dates")}</option>
                  <option value="Last 30 Days">{t("Last 30 Days")}</option>
                  <option value="This Month">{t("This Month")}</option>
                  <option value="Last 3 Months">{t("Last 3 Months")}</option>
                </select>
              </div>
            </div>

            <div className="card-body" style={{ padding: "0 20px" }}>
              {filteredExpenses.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
                  <IconAlert size={28} style={{ color: "var(--text-tertiary)", marginBottom: "10px" }} />
                  <div>{t("No claims match your filters")}</div>
                </div>
              ) : (
                filteredExpenses.map((e) => {
                  const c = data.consultants.find((x) => x.id === e.consultant) || {
                    color: "#64748b",
                    avatar: "?",
                    name: e.consultant,
                  };
                  const catIcon: Record<string, React.ReactNode> = {
                    Travel: <IconPlane size={16} />,
                    Accommodation: <IconHotel size={16} />,
                    Meals: <IconUtensils size={16} />,
                    Transport: <IconCar size={16} />,
                    Other: <IconPackage size={16} />,
                  };
                  const catIconEl = catIcon[e.category as string] || <IconFileText size={16} />;

                  const statusBadge = {
                    approved: "badge-success",
                    pending: "badge-warning",
                    rejected: "badge-danger",
                  }[e.status as string] || "badge-gray";

                  return (
                    <div
                      key={e.id}
                      onClick={() => setSelectedTrackerId(e.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "16px 0",
                        borderBottom: "1px solid var(--border-subtle)",
                        cursor: "pointer",
                        background: selectedTrackerId === e.id ? "rgba(46,134,193,0.05)" : "transparent",
                        margin: "0 -20px",
                        paddingLeft: "20px",
                        paddingRight: "20px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                        <div
                          style={{
                            background: "var(--ob-bg-elevated)",
                            width: "38px",
                            height: "38px",
                            borderRadius: "10px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--ob-accent-blue)",
                          }}
                        >
                          {catIconEl}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {e.description.replace(/^\[Policy:\s*[^\]]+\]\s*/i, "")}
                          </div>
                          <div style={{ fontSize: "11.5px", color: "var(--text-secondary)", marginTop: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                              <div
                                style={{
                                  background: c.color,
                                  width: "16px",
                                  height: "16px",
                                  borderRadius: "50%",
                                  fontSize: "8px",
                                  color: "white",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontWeight: 700,
                                }}
                              >
                                {c.avatar}
                              </div>
                              {c.name}
                            </span>
                            <span>·</span>
                            <span>{e.project}</span>
                            <span>·</span>
                            <span>{e.date}</span>
                            {e.receipt ? (
                              <span style={{ color: "var(--ob-teal)", display: "inline-flex", alignItems: "center", gap: "2px", marginLeft: "4px" }}>
                                <IconPaperclip size={10} /> {t("Receipt")}
                              </span>
                            ) : (
                              <span style={{ color: "var(--ob-red)", display: "inline-flex", alignItems: "center", gap: "2px", marginLeft: "4px" }}>
                                <IconAlert size={10} /> {t("Missing Receipt")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--text-primary)" }}>
                            {formatCurrency(e.amount)}
                          </div>
                          <span className={`badge ${statusBadge}`} style={{ fontSize: "10px", marginTop: "4px" }}>
                            {e.status === "pending" ? t("Awaiting Approval") : t(e.status.charAt(0).toUpperCase() + e.status.slice(1))}
                          </span>
                        </div>

                        {/* Dropdown actions */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <button
                            className="btn btn-secondary btn-xs"
                            onClick={(evt) => {
                              evt.stopPropagation();
                              setSelectedExpense(e);
                              setSelectedExpense(null); // trigger state refresh
                              setSelectedExpense(e);
                            }}
                            style={{ fontSize: "10px", padding: "4px 8px", display: "inline-flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}
                          >
                            {t("Details")}
                          </button>
                          {e.status === "pending" && (user?.role === "super_admin" || user?.role === "project_manager") && (
                            <div style={{ display: "flex", gap: "2px" }}>
                              <button
                                className="btn btn-primary btn-xs"
                                onClick={(evt) => {
                                  evt.stopPropagation();
                                  approveExpense(e.id);
                                  showToast("Expense approved.", "success");
                                }}
                                style={{ fontSize: "9px", padding: "2px 4px", background: "var(--ob-teal)" }}
                              >
                                {t("Approve")}
                              </button>
                              <button
                                className="btn btn-danger btn-xs"
                                onClick={(evt) => {
                                  evt.stopPropagation();
                                  rejectExpense(e.id);
                                  showToast("Expense rejected.", "warning");
                                }}
                                style={{ fontSize: "9px", padding: "2px 4px", background: "var(--ob-red)" }}
                              >
                                {t("Reject")}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Spend Summary Charts */}
          {(() => {
            const travelSum = preciseSum(analyticsExpenses.filter(e => e.category === "Travel"));
            const travelPct = totalSubmitted > 0 ? Math.round((travelSum / totalSubmitted) * 100) : 0;

            const hotelSum = preciseSum(analyticsExpenses.filter(e => e.category === "Accommodation"));
            const hotelPct = totalSubmitted > 0 ? Math.round((hotelSum / totalSubmitted) * 100) : 0;

            const pendingClaims = analyticsExpenses.filter(e => e.status === "pending");
            const pendingCount = pendingClaims.length;

            return (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                
                {/* Monthly Spend Bar Chart */}
                <div className="card">
                  <div className="card-header">
                    <span className="card-title">{t("Monthly Spend Summary")}</span>
                  </div>
                  {totalSubmitted > 0 ? (
                    <div className="card-body" style={{ padding: "16px" }}>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: "10px", height: "180px", width: "100%" }}>
                        {monthlyData.map((d, i) => {
                          const maxSpend = Math.max(...monthlyData.map((m) => m.Spend));
                          const pct = maxSpend > 0 ? (d.Spend / maxSpend) * 100 : 0;
                          return (
                            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", height: "100%", justifyContent: "flex-end" }}>
                              <span style={{ fontSize: "10px", color: "var(--text-tertiary)", fontWeight: 600 }}>
                                {(d.Spend / 1000).toFixed(0)}k
                              </span>
                              <div
                                title={`${d.month}: ₹${d.Spend.toLocaleString()}`}
                                style={{
                                  width: "100%",
                                  height: `${pct}%`,
                                  background: darkMode
                                    ? "linear-gradient(180deg, #5BA3D9, #2E6EA6)"
                                    : "linear-gradient(180deg, #2E86C1, #1a5c87)",
                                  borderRadius: "4px 4px 0 0",
                                  transition: "height 0.3s ease",
                                  cursor: "default",
                                }}
                              />
                              <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{d.month}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="card-body" style={{ padding: "16px", display: "flex", alignItems: "center", justifyContent: "center", height: "180px" }}>
                      <div style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>
                        No expenses logged to compute
                      </div>
                    </div>
                  )}
                </div>

                {/* AI Insights Card */}
                <div className="card">
                  <div className="card-header">
                    <span className="card-title">{t("AI Spend Insights")}</span>
                  </div>
                  {totalSubmitted > 0 ? (
                    <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      
                      {/* Insight Card 1 */}
                      <div style={{
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-md)",
                        boxShadow: "var(--shadow-xs)",
                        padding: "14px 16px",
                        borderLeft: "4px solid var(--ob-accent-blue)"
                      }}>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
                          {t("Travel Allocation")}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "6px", lineHeight: "1.4" }}>
                          Travel expenses account for {formatCurrency(travelSum)} ({travelPct}% of total spend).
                        </div>
                      </div>

                      {/* Insight Card 2 */}
                      <div style={{
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-md)",
                        boxShadow: "var(--shadow-xs)",
                        padding: "14px 16px",
                        borderLeft: "4px solid var(--ob-teal)"
                      }}>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
                          {t("Accommodation Distribution")}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "6px", lineHeight: "1.4" }}>
                          Hotel and lodging expenses account for {formatCurrency(hotelSum)} ({hotelPct}% of total spend).
                        </div>
                      </div>

                      {/* Insight Card 3 */}
                      <div style={{
                        backgroundColor: "var(--bg-surface)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-md)",
                        boxShadow: "var(--shadow-xs)",
                        padding: "14px 16px",
                        borderLeft: "4px solid var(--ob-indigo)"
                      }}>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
                          {t("Pending Approvals Pipeline")}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "6px", lineHeight: "1.4" }}>
                          Currently, {formatCurrency(pendingAmount)} ({pendingCount} claim(s)) are awaiting review in the approval pipeline.
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="card-body" style={{ padding: "16px", display: "flex", alignItems: "center", justifyContent: "center", height: "180px" }}>
                      <div style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>
                        No spend insights available
                      </div>
                    </div>
                  )}
                </div>

              </div>
            );
          })()}

        </div>

        {/* Right Column: Analytics & Trackers */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Analytics Donut Chart */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">{t("Expense Distribution")}</span>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ height: "180px", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <SvgDonutChart data={categoryData} colors={CATEGORY_COLORS} />
              </div>

              {/* Legend with percentages */}
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "6px", marginTop: "10px" }}>
                {categoryData.map((cat, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: CATEGORY_COLORS[idx] }} />
                      <span style={{ color: "var(--text-secondary)" }}>{t(cat.name)}</span>
                    </div>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{cat.percentage.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>



          {/* Workflow Tracker Card */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">{t("Workflow Tracker")}</span>
            </div>
            <div className="card-body">
              {trackedExpense ? (
                <div>
                  <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "14px" }}>
                    {t("Tracking:")} <strong>{trackedExpense.description.replace(/^\[Policy:\s*[^\]]+\]\s*/i, "")}</strong> ({trackedExpense.id})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {getWorkflowSteps(trackedExpense.status).map((step, idx) => (
                      <div key={idx} style={{ display: "flex", gap: "12px" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <div
                            style={{
                              width: "20px",
                              height: "20px",
                              borderRadius: "50%",
                              background:
                                step.state === "done"
                                  ? "var(--ob-teal)"
                                  : step.state === "active"
                                  ? "var(--ob-amber)"
                                  : step.state === "error"
                                  ? "var(--ob-red)"
                                  : "var(--ob-border-mid)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "10px",
                              color: "white",
                              fontWeight: "bold",
                            }}
                          >
                            {step.state === "done" ? "✓" : step.state === "error" ? "✗" : idx + 1}
                          </div>
                          {idx < 3 && (
                            <div style={{ width: "2px", flex: 1, background: "var(--ob-border-subtle)", margin: "4px 0" }} />
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>{t(step.title)}</div>
                          <div style={{ fontSize: "11.5px", color: "var(--text-secondary)", marginTop: "2px" }}>{t(step.desc)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "10px", color: "var(--text-secondary)", fontSize: "12px" }}>
                  {t("Select a claim to track approval progress")}
                </div>
              )}
            </div>
          </div>



          {/* Recent Activity Feed */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">{t("Recent Activity")}</span>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {recentActivities.map((act) => (
                <div key={act.id} style={{ display: "flex", justifyContent: "space-between", gap: "10px", fontSize: "12px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{t(act.text)}</span>
                  <span style={{ color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>{t(act.time)}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Details & Receipt Modal */}
      {selectedExpense && details && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "40px 20px",
          }}
          onClick={() => setSelectedExpense(null)}
        >
          <div
            className="modal-content"
            style={{
              background: "var(--bg-surface)",
              borderRadius: "12px",
              width: "680px",
              maxWidth: "90vw",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              animation: "fadeIn 0.2s ease-out",
              border: "1px solid var(--border-subtle)",
              margin: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-subtle)", padding: "28px 28px 16px 28px", flexShrink: 0 }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>{t("Expense Claim Details")}</h2>
              <button
                className="topbar-btn"
                onClick={() => setSelectedExpense(null)}
                style={{ width: "30px", height: "30px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}
              >
                <IconClose size={16} />
              </button>
            </div>

            {/* Modal Content Sections — scrolls internally when content exceeds available height */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px", display: "flex", flexDirection: "column", gap: "24px" }}>
              
              {/* Expense Information */}
              <div>
                <div style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "8px", marginBottom: "16px" }}>
                  <h3 style={{ fontSize: "12px", fontWeight: 700, margin: 0, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {t("Expense Information")}
                  </h3>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px 24px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t("Expense Title")}</div>
                    <div style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-primary)" }}>{t(details.title)}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t("Expense ID")}</div>
                    <div style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-primary)" }}>{details.id}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t("Employee Name")}</div>
                    <div style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-primary)" }}>{t(details.employeeName)}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t("Project Code")}</div>
                    <div style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-primary)" }}>{details.projectCode}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t("Client")}</div>
                    <div style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-primary)" }}>
                      {t(data.projects?.find((p: any) => p.id === details.projectCode)?.client || "Unknown")}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t("Expense Date")}</div>
                    <div style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-primary)" }}>{details.date}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t("Expense Category")}</div>
                    <div style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-primary)" }}>{t(details.category)}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t("Amount")}</div>
                    <div style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-primary)" }}>{formatCurrency(details.amount)}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t("Status")}</div>
                    <div style={{ display: "flex", alignItems: "center", height: "20px" }}>
                      <span className={`badge ${
                        details.status.toLowerCase() === "approved"
                          ? "badge-success"
                          : details.status.toLowerCase() === "rejected"
                          ? "badge-danger"
                          : "badge-warning"
                      }`} style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "5px", fontWeight: 600 }}>
                        {t(details.status)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Travel Details */}
              {(selectedExpense.category === "Travel" || selectedExpense.category === "Transport") && selectedExpense.modeOfTransport && (
                <div>
                  <div style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "8px", marginBottom: "16px" }}>
                    <h3 style={{ fontSize: "12px", fontWeight: 700, margin: 0, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {t("Travel Details")}
                    </h3>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px 24px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t("Mode of Transport")}</div>
                      <div style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-primary)" }}>{t(selectedExpense.modeOfTransport)}</div>
                    </div>
                    {selectedExpense.fromLocation && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t("From Location")}</div>
                        <div style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-primary)" }}>{selectedExpense.fromLocation}</div>
                      </div>
                    )}
                    {selectedExpense.toLocation && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t("To Location")}</div>
                        <div style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-primary)" }}>{selectedExpense.toLocation}</div>
                      </div>
                    )}
                    {selectedExpense.calculatedDistance !== null && selectedExpense.calculatedDistance !== undefined && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{t("Calculated Distance")}</div>
                        <div style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-primary)" }}>{selectedExpense.calculatedDistance} km</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Receipt Information */}
              <div>
                <div style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "8px", marginBottom: "16px" }}>
                  <h3 style={{ fontSize: "12px", fontWeight: 700, margin: 0, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {t("Receipt Information")}
                  </h3>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px 24px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {t("Receipt Attached")}
                    </div>
                    <div>
                      <span className={`badge ${
                        details.receiptAttached.toLowerCase() === "receipt attached"
                          ? "badge-success"
                          : "badge-danger"
                      }`} style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "5px", fontWeight: 600 }}>
                        {t(details.receiptAttached)}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {t("Receipt Document")}
                    </div>
                    {selectedExpense.receipt ? (() => {
                      // receipt can be: string URL (new), object with previewUrl (legacy local), or true (very old mock)
                      const receiptUrl = typeof selectedExpense.receipt === "string"
                        ? selectedExpense.receipt
                        : (selectedExpense.receipt?.previewUrl || selectedExpense.receipt?.supabaseUrl || null);
                      const fileName = typeof selectedExpense.receipt === "string"
                        ? selectedExpense.receipt.split("/").pop() || "receipt"
                        : (selectedExpense.receipt?.fileName || "receipt.pdf");
                      const fileSize = typeof selectedExpense.receipt === "object" && selectedExpense.receipt?.fileSize
                        ? selectedExpense.receipt.fileSize
                        : null;
                      const isImage = typeof selectedExpense.receipt === "object"
                        ? selectedExpense.receipt?.fileType?.startsWith("image/")
                        : (typeof selectedExpense.receipt === "string" && /\.(jpg|jpeg|png|webp)$/i.test(selectedExpense.receipt));

                      return (
                        <div
                          onClick={() => receiptUrl && window.open(receiptUrl, "_blank")}
                          title={receiptUrl ? t("Click to view/open receipt") : t("No URL available")}
                          style={{
                            background: "var(--bg-surface-2)",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: "8px",
                            padding: "12px",
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            cursor: receiptUrl ? "pointer" : "default",
                            transition: "all 0.15s ease",
                          }}
                          onMouseEnter={(e) => { if (receiptUrl) e.currentTarget.style.background = "rgba(46,134,193,0.08)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-surface-2)"; }}
                        >
                          <IconPaperclip size={16} style={{ color: "var(--ob-accent-blue)", flexShrink: 0 }} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {fileName}
                            </div>
                            {fileSize && (
                              <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>{fileSize}</div>
                            )}
                            {receiptUrl && (
                              <div style={{ fontSize: "10px", color: "#10b981", fontWeight: 600, marginTop: "2px" }}>☁ Stored in cloud</div>
                            )}
                          </div>
                          {receiptUrl && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-tertiary)", flexShrink: 0 }}>
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                            </svg>
                          )}
                        </div>
                      );
                    })() : (
                      <div style={{ background: "var(--bg-surface-2)", border: "1px solid var(--border-subtle)", borderRadius: "8px", padding: "12px", color: "var(--text-secondary)", fontSize: "12px" }}>
                        {t("No receipt document attached.")}
                      </div>
                    )}

                  </div>
                </div>

                {(() => {
                  const r = selectedExpense?.receipt;
                  if (!r) return null;
                  // String URL ending in image extension = new Supabase format
                  const isStrImage = typeof r === "string" && /\.(jpg|jpeg|png|webp)$/i.test(r);
                  const isObjImage = typeof r === "object" && r?.fileType?.startsWith("image/") && r?.previewUrl;
                  if (!isStrImage && !isObjImage) return null;
                  const src = typeof r === "string" ? r : r.previewUrl;
                  return (
                    <div style={{ marginTop: "16px", width: "100%", maxWidth: "300px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                        {t("Receipt Image Preview")}
                      </div>
                      <img
                        src={src}
                        alt="Receipt Preview"
                        style={{ width: "100%", maxHeight: "150px", borderRadius: "6px", objectFit: "contain", border: "1px solid var(--border-subtle)", background: "var(--bg-surface-2)" }}
                      />
                    </div>
                  );
                })()}
              </div>

              {/* Approval Information */}
              <div>
                <div style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "8px", marginBottom: "16px" }}>
                  <h3 style={{ fontSize: "12px", fontWeight: 700, margin: 0, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {t("Approval Information")}
                  </h3>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px 24px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {t("Submitted Date")}
                    </div>
                    <div style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-primary)" }}>
                      {details.submittedDate}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {t("Approval Status")}
                    </div>
                    <div style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-primary)" }}>
                      {t(details.approvalStatus)}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {t("Reimbursement Stage")}
                    </div>
                    <div style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-primary)" }}>
                      {t(details.reimbursementStage)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Reimbursement Stage Edit (Accounts/Admin only) */}
              {isAccountsOrAdmin && (
                <div style={{ background: "var(--surface-50)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-subtle)", marginBottom: "16px" }}>
                  <h3 style={{ fontSize: "13px", fontWeight: 700, margin: "0 0 12px 0", color: "var(--text-primary)" }}>{t("Reimbursement Stage")}</h3>
                  <div className="form-group" style={{ marginBottom: expenseStage === "On Hold" ? "12px" : "16px" }}>
                    <select
                      className="select"
                      value={expenseStage}
                      onChange={(e) => setExpenseStage(e.target.value)}
                      style={{ width: "100%", padding: "8px 12px", fontSize: "13px" }}
                    >
                      <option value="Pending">{t("Pending")}</option>
                      <option value="Payment Queued">{t("Payment Queued")}</option>
                      <option value="Paid">{t("Paid")}</option>
                      <option value="On Hold">{t("On Hold")}</option>
                    </select>
                  </div>
                  
                  {expenseStage === "On Hold" && (
                    <div className="form-group" style={{ marginBottom: "16px" }}>
                      <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px", display: "block" }}>{t("Reason for Hold")}</label>
                      <textarea
                        className="input-field"
                        value={expenseOnHoldReason}
                        onChange={(e) => setExpenseOnHoldReason(e.target.value)}
                        placeholder="E.g., Missing original receipts"
                        rows={2}
                        style={{ width: "100%", resize: "vertical", fontSize: "13px" }}
                      />
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button 
                      className="btn btn-primary btn-sm" 
                      onClick={handleUpdateExpenseStage}
                      disabled={isUpdatingStage}
                      style={{ display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      {isUpdatingStage && <span className="spinner" style={{ width: "12px", height: "12px", border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />}
                      {isUpdatingStage ? t("Updating...") : t("Update Stage")}
                    </button>
                  </div>
                </div>
              )}

              {/* Additional Information */}
              <div>
                <div style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "8px", marginBottom: "16px" }}>
                  <h3 style={{ fontSize: "12px", fontWeight: 700, margin: 0, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {t("Additional Information")}
                  </h3>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {t("Expense Description")}
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.5", background: "var(--bg-surface-2)", padding: "12px 16px", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                    {t(details.description)}
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", padding: "16px 28px 28px 28px", borderTop: "1px solid var(--border-subtle)", flexShrink: 0 }}>
              
              <ActionGuard action="Approve Expenses">
                {details.status.toLowerCase() === "pending" && (
                  <>
                    <button className="btn btn-success btn-sm" onClick={() => {
                      approveExpense(selectedExpense.id);
                      setSelectedExpense(null);
                    }} style={{ padding: "8px 16px", fontSize: "12.5px", background: "var(--ob-teal)", display: "flex", alignItems: "center", gap: "6px" }}>
                      <IconCheckCircle size={16} /> {t("Approve")}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => {
                      rejectExpense(selectedExpense.id);
                      setSelectedExpense(null);
                    }} style={{ padding: "8px 16px", fontSize: "12.5px", background: "var(--ob-red)", display: "flex", alignItems: "center", gap: "6px" }}>
                      <IconClose size={16} /> {t("Reject")}
                    </button>
                  </>
                )}
              </ActionGuard>

              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedExpense(null)} style={{ padding: "8px 16px", fontSize: "12.5px" }}>{t("Close")}</button>
              <button className="btn btn-danger btn-sm" onClick={() => {
                setExpenseToDelete(selectedExpense.id);
                setSelectedExpense(null);
              }} style={{ padding: "8px 16px", fontSize: "12.5px", background: "var(--ob-red)", display: "flex", alignItems: "center", gap: "6px" }}>
                🗑 {t("Delete Expense")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Expense Form Modal */}
      {showForm && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
          }}
        >
          <div
            className="modal-content"
            style={{
              background: "var(--bg-surface)",
              borderRadius: "12px",
              padding: "24px",
              width: "min(500px, 90%)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
              animation: "fadeIn 0.22s ease-out",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>{t("Submit New Expense")}</h2>
              <button
                className="topbar-btn"
                onClick={() => setShowForm(false)}
                style={{ width: "30px", height: "30px", padding: 0 }}
              >
                <IconClose size={16} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <input
                type="text"
                placeholder={t("Description")}
                value={newExpense.description}
                onChange={(e) => handleFormChange("description", e.target.value)}
                className="input"
                style={{ padding: "10px", borderRadius: "6px" }}
              />

              <input
                type="number"
                placeholder={t("Amount (INR)")}
                value={newExpense.amount}
                onChange={(e) => handleFormChange("amount", e.target.value)}
                className="input"
                style={{ padding: "10px", borderRadius: "6px" }}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <select
                  value={newExpense.consultant}
                  onChange={(e) => handleFormChange("consultant", e.target.value)}
                  className="select"
                  style={{ padding: "10px", borderRadius: "6px" }}
                >
                  {(user?.role === "super_admin" ? data.consultants : data.consultants.filter((c) => c.id === user?.id)).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <select
                  value={newExpense.project}
                  onChange={(e) => handleFormChange("project", e.target.value)}
                  className="select"
                  style={{ padding: "10px", borderRadius: "6px" }}
                >
                  {visibleProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.id}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <select
                  value={newExpense.category}
                  onChange={(e) => handleFormChange("category", e.target.value)}
                  className="select"
                  style={{ padding: "10px", borderRadius: "6px" }}
                >
                  <option value="Travel">{t("Travel")}</option>
                  <option value="Accommodation">{t("Accommodation")}</option>
                  <option value="Meals">{t("Meals")}</option>
                  <option value="Transport">{t("Transport")}</option>
                  <option value="Other">{t("Other")}</option>
                </select>

                <input
                  type="date"
                  value={newExpense.date}
                  onChange={(e) => handleFormChange("date", e.target.value)}
                  className="input"
                  style={{ padding: "10px", borderRadius: "6px" }}
                />
              </div>

              {newExpense.category === "Meals" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px" }}>
                  <select
                    value={newExpense.mealLocation}
                    onChange={(e) => handleFormChange("mealLocation", e.target.value)}
                    className="select"
                    style={{ padding: "10px", borderRadius: "6px" }}
                  >
                    <option value="residence">{t("Residence City")}</option>
                    <option value="outside">{t("Outside City")}</option>
                  </select>
                </div>
              )}

              {/* Travel Details Section */}
              {(newExpense.category === "Travel" || newExpense.category === "Transport") && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>{t("Travel Details")}</div>
                  
                  {/* Mode of Transport */}
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)" }}>{t("Mode of Transport")}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {["Flight", "Train", "Car", "Bike", "Auto"].map((mode) => (
                      <button
                        key={mode}
                        onClick={() => {
                          handleFormChange("modeOfTransport", mode);
                          setNewExpense(prev => ({ ...prev, calculatedDistance: null }));
                        }}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "16px",
                          border: newExpense.modeOfTransport === mode ? "1px solid var(--brand-500)" : "1px solid var(--border-default)",
                          background: newExpense.modeOfTransport === mode ? "rgba(var(--brand-500-rgb), 0.1)" : "transparent",
                          color: newExpense.modeOfTransport === mode ? "var(--brand-500)" : "var(--text-secondary)",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "all 0.2s ease"
                        }}
                      >
                        {t(mode)}
                      </button>
                    ))}
                  </div>

                  {/* Route */}
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", marginTop: "8px" }}>{t("Route")}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", position: "relative" }}>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        placeholder={t("From Location")}
                        value={fromQuery}
                        onChange={(e) => {
                          setFromQuery(e.target.value);
                          handleFormChange("fromLocation", e.target.value);
                          if (e.target.value.trim() === "") setFromCoords(null);
                          setNewExpense(prev => ({ ...prev, calculatedDistance: null }));
                          searchNominatim(e.target.value, setFromResults);
                          setShowFromResults(true);
                        }}
                        onBlur={() => setTimeout(() => setShowFromResults(false), 200)}
                        className="input"
                        style={{ padding: "10px", borderRadius: "6px", width: "100%" }}
                      />
                      {showFromResults && fromResults.length > 0 && (
                        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "6px", zIndex: 10, marginTop: "4px", maxHeight: "200px", overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                          {fromResults.map((r, i) => (
                            <div
                              key={`${r.place_id}-${i}`}
                              style={{ padding: "8px 12px", fontSize: "12px", cursor: "pointer", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
                              onClick={() => {
                                setFromQuery(r.display_name);
                                handleFormChange("fromLocation", r.display_name);
                                setFromCoords({ lat: r.lat, lon: r.lon });
                                setShowFromResults(false);
                              }}
                            >
                              {r.display_name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        placeholder={t("To Location")}
                        value={toQuery}
                        onChange={(e) => {
                          setToQuery(e.target.value);
                          handleFormChange("toLocation", e.target.value);
                          if (e.target.value.trim() === "") setToCoords(null);
                          setNewExpense(prev => ({ ...prev, calculatedDistance: null }));
                          searchNominatim(e.target.value, setToResults);
                          setShowToResults(true);
                        }}
                        onBlur={() => setTimeout(() => setShowToResults(false), 200)}
                        className="input"
                        style={{ padding: "10px", borderRadius: "6px", width: "100%" }}
                      />
                      {showToResults && toResults.length > 0 && (
                        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "6px", zIndex: 10, marginTop: "4px", maxHeight: "200px", overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                          {toResults.map((r, i) => (
                            <div
                              key={`${r.place_id}-${i}`}
                              style={{ padding: "8px 12px", fontSize: "12px", cursor: "pointer", borderBottom: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
                              onClick={() => {
                                setToQuery(r.display_name);
                                handleFormChange("toLocation", r.display_name);
                                setToCoords({ lat: r.lat, lon: r.lon });
                                setShowToResults(false);
                              }}
                            >
                              {r.display_name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Calculate Distance Button & Result */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px" }}>
                    <button
                      type="button"
                      onClick={handleCalculateDistance}
                      disabled={!fromCoords || !toCoords || !newExpense.modeOfTransport || isCalculatingDistance}
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        borderRadius: "6px",
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-default)",
                        color: "var(--text-primary)",
                        cursor: (!fromCoords || !toCoords || !newExpense.modeOfTransport || isCalculatingDistance) ? "not-allowed" : "pointer",
                        opacity: (!fromCoords || !toCoords || !newExpense.modeOfTransport || isCalculatingDistance) ? 0.6 : 1,
                        transition: "all 0.2s ease"
                      }}
                    >
                      {isCalculatingDistance ? t("Calculating...") : t("Calculate Distance")}
                    </button>
                    {newExpense.calculatedDistance !== null && (
                      <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>
                        Distance: <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>{newExpense.calculatedDistance} km</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Receipt Upload Box */}
              <div
                style={{
                  border: "2px dashed var(--border-default)",
                  background: "var(--bg-surface-2)",
                  borderRadius: "8px",
                  padding: "16px",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onClick={handleUploadClick}
              >
              {receiptUploading ? (
                  <div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 1s linear infinite", color: "var(--brand-500)", marginBottom: "6px" }}><circle cx="12" cy="12" r="10" stroke="rgba(0,0,0,0.1)" strokeWidth="4"/><path d="M4 12a8 8 0 0 1 8-8"/></svg>
                    <div style={{ fontSize: "13px", fontWeight: 600 }}>{t("Uploading to cloud…")}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "2px" }}>{t("Please wait")}</div>
                  </div>
                ) : !receipt ? (
                  <div>
                    <IconPaperclip size={20} style={{ color: "var(--text-tertiary)", marginBottom: "4px" }} />
                    <div style={{ fontSize: "13px", fontWeight: 600 }}>{t("Upload Receipt")}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-tertiary)", marginTop: "2px" }}>{t("PDF, JPG, PNG — max 10MB")}</div>
                  </div>
                ) : (
                  <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "center" }}>
                      {receipt.fileType.startsWith("image/") ? (
                        <img src={receipt.previewUrl} alt="Preview" style={{ width: "40px", height: "40px", borderRadius: "4px", objectFit: "cover" }} />
                      ) : (
                        <IconFileText size={28} style={{ color: "var(--ob-accent-blue)" }} />
                      )}
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontSize: "12.5px", fontWeight: 700, maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {receipt.fileName}
                        </div>
                        <div style={{ fontSize: "10.5px", color: "var(--text-tertiary)" }}>
                          {receipt.fileSize} · {receipt.timestamp}
                        </div>
                        <div style={{ fontSize: "10px", color: "#10b981", fontWeight: 600, marginTop: "2px" }}>
                          ☁ Saved to cloud storage
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                      <button className="btn btn-secondary btn-xs" onClick={handleUploadClick}>{t("Change Receipt")}</button>
                      <button className="btn btn-danger btn-xs" onClick={handleRemoveReceipt}>{t("Remove Receipt")}</button>
                    </div>
                  </div>
                )}

              </div>

            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
              <button className="btn btn-secondary" onClick={() => { resetExpenseForm(); setShowForm(false); }}>{t("Cancel")}</button>
              <button className="btn btn-primary" onClick={handleSubmitExpense}>{t("Submit Claim")}</button>
            </div>

          </div>
        </div>
      )}

      {/* Delete Expense Confirmation Modal */}
      {expenseToDelete && (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            className="modal-content"
            style={{
              background: "var(--bg-surface)",
              borderRadius: "12px",
              padding: "24px",
              width: "min(400px, 90%)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
              animation: "fadeIn 0.22s ease-out",
            }}
          >
            <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>
              {t("Delete Expense?")}
            </div>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>
              {t("Are you sure you want to permanently delete this expense claim?")}
            </p>
            <p style={{ fontSize: "13px", color: "var(--ob-red)", marginBottom: "24px", fontWeight: 600 }}>
              {t("This action cannot be undone.")}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                className="btn btn-secondary"
                onClick={() => setExpenseToDelete(null)}
              >
                {t("Cancel")}
              </button>
              <button
                className="btn btn-danger"
                style={{ background: "var(--ob-red)", color: "#fff" }}
                onClick={async () => {
                  if (expenseToDelete) {
                    await deleteExpense(expenseToDelete);
                    if (selectedExpense?.id === expenseToDelete) {
                      setSelectedExpense(null);
                    }
                    setExpenseToDelete(null);
                  }
                }}
              >
                {t("Delete")}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
