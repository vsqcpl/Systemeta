import React from "react";
import { Timesheet } from "./data/types";

let currentCurrencyFormat: 'indian' | 'intl' = 'indian';
let currentCurrencySymbol: string = '₹';

export function setGlobalCurrencyFormat(format: 'indian' | 'intl') {
  currentCurrencyFormat = format;
}

export function getGlobalCurrencyFormat(): 'indian' | 'intl' {
  return currentCurrencyFormat;
}

export function setGlobalCurrencySymbol(symbol: string) {
  currentCurrencySymbol = symbol;
}

export function getGlobalCurrencySymbol(): string {
  return currentCurrencySymbol;
}

// Restore currency symbol from localStorage on module load (client only)
if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem('vsqc_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.defaultCurrency) {
        // defaultCurrency is stored as the full label, e.g. "$ US Dollar (USD)"
        const symbol = parsed.defaultCurrency.split(' ')[0];
        if (symbol) currentCurrencySymbol = symbol;
      }
      if (parsed.numberingSystem) {
        currentCurrencyFormat = parsed.numberingSystem as 'indian' | 'intl';
      }
    }
  } catch (_) {}
}

export function formatIndianCurrency(v: number): string {
  const isNegative = v < 0;
  const absValue = Math.abs(v);
  const sym = currentCurrencySymbol;
  
  let formatted = "";
  if (currentCurrencyFormat === 'indian') {
    if (absValue >= 10000000) { // 1 Crore = 10,000,000
      formatted = (absValue / 10000000).toFixed(2) + "Cr";
    } else if (absValue >= 100000) { // 1 Lakh = 100,000
      formatted = (absValue / 100000).toFixed(2) + "L";
    } else {
      formatted = absValue.toLocaleString("en-IN");
    }
  } else {
    // International format: Billions, Millions, Thousands
    if (absValue >= 1000000000) { // 1 Billion
      formatted = (absValue / 1000000000).toFixed(2) + "B";
    } else if (absValue >= 1000000) { // 1 Million
      formatted = (absValue / 1000000).toFixed(2) + "M";
    } else if (absValue >= 1000) { // 1 Thousand
      formatted = (absValue / 1000).toFixed(0) + "K";
    } else {
      formatted = absValue.toLocaleString("en-IN");
    }
  }
  
  return (isNegative ? "-" : "") + sym + formatted;
}

export function formatCurrency(v: number): string {
  return formatIndianCurrency(v);
}

export function formatShortDate(str: string): string {
  if (!str) return "";
  const d = new Date(str);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export interface DateStatus {
  isOverdue: boolean;
  isDueSoon: boolean;
  label: string;
}

export function getTaskDateStatus(str: string): DateStatus {
  if (!str) return { isOverdue: false, isDueSoon: false, label: "" };
  const d = new Date(str);
  const now = new Date();
  
  // Set times to midnight to calculate pure day difference
  d.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  
  const diff = (d.getTime() - now.getTime()) / 86400000;
  
  const label = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  if (diff < 0) {
    return { isOverdue: true, isDueSoon: false, label: "Overdue" };
  }
  if (diff < 3) {
    return { isOverdue: false, isDueSoon: true, label };
  }
  return { isOverdue: false, isDueSoon: false, label };
}

export function calculateAverageUtilization(consultantId: string, timesheets: Timesheet[], weeksToAverage = 4): number {
  if (!timesheets || timesheets.length === 0) return 0;
  
  const consultantTimesheets = timesheets
    .filter(ts => ts.consultant === consultantId)
    .sort((a, b) => new Date(b.week).getTime() - new Date(a.week).getTime());
    
  if (consultantTimesheets.length === 0) return 0;
  
  const recentTimesheets = consultantTimesheets.slice(0, weeksToAverage);
  
  let totalHours = 0;
  recentTimesheets.forEach(ts => {
    if (ts.entries) {
      ts.entries.forEach(entry => {
        totalHours += entry.hours || 0;
      });
    }
  });
  
  const expectedTotalHours = recentTimesheets.length * 40;
  if (expectedTotalHours === 0) return 0;
  
  return Math.round((totalHours / expectedTotalHours) * 100);
}

export function calculateWeeklyUtilization(consultantId: string, weekStr: string, timesheets: Timesheet[]): number {
  if (!timesheets) return 0;
  const ts = timesheets.find(t => t.consultant === consultantId && t.week === weekStr);
  if (!ts || !ts.entries) return 0;
  
  let totalHours = 0;
  ts.entries.forEach(entry => {
    totalHours += entry.hours || 0;
  });
  
  return Math.round((totalHours / 40) * 100);
}

export function getRecentWeeks(timesheets: Timesheet[], numWeeks = 5): { weekStr: string, label: string }[] {
  if (!timesheets || timesheets.length === 0) return [];
  
  const uniqueWeeks = Array.from(new Set(timesheets.map(t => t.week)))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    .slice(0, numWeeks)
    .reverse();
    
  return uniqueWeeks.map(w => {
    const d = new Date(w);
    const month = d.toLocaleDateString("en-US", { month: "short" });
    const date = d.getDate();
    return {
      weekStr: w,
      label: `${date} ${month}`
    };
  });
}
