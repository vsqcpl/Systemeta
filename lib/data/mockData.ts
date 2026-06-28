import { VSQCData } from './types';

export const INITIAL_VSQC_DATA: VSQCData = {
  // ── KPI Metrics ──────────────────────────────────────────────
  kpis: {
    activeProjects: 0,
    delayedTasks: 0,
    upcomingMilestones: 0,
    revenuePipeline: 0,
    resourceUtilization: 0,
    billableHours: 0,
    teamMembers: 0,
    clientSatisfaction: 100
  },

  // ── Projects ─────────────────────────────────────────────────
  projects: [],

  // ── Team Members (Consultants) ──────────────────────────────────
  consultants: [],

  // ── Tasks ─────────────────────────────────────────────────────
  tasks: {
    todo: [],
    inprogress: [],
    review: [],
    done: []
  },

  // ── Milestones ────────────────────────────────────────────────
  milestones: [],

  // ── Revenue Chart Data ─────────────────────────────────────────
  revenueData: {
    labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    actual:  [null, null, null, null, null, null, null, null, null, null, null, null],
    forecast:[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    target:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  },

  // ── Utilization Data ──────────────────────────────────────────
  utilizationData: {
    labels: ['Week 1','Week 2','Week 3','Week 4'],
    billable: [0, 0, 0, 0],
    nonBillable: [0, 0, 0, 0],
    available: [100, 100, 100, 100]
  },

  // ── Timesheets ────────────────────────────────────────────────
  timesheets: [],

  // ── Leave Requests ────────────────────────────────────────────
  leaveRequests: [],

  // ── Expenses ──────────────────────────────────────────────────
  expenses: [],

  // ── Invoices ──────────────────────────────────────────────────
  invoices: [],

  // ── AI Insights ───────────────────────────────────────────────
  aiInsights: [],

  // ── Activity Feed ─────────────────────────────────────────────
  activities: [],

  // ── Notifications ─────────────────────────────────────────────
  notifications: [],

  // ── Audit Logs ────────────────────────────────────────────────
  auditLogs: [],

  // ── Users ─────────────────────────────────────────────────────
  users: [],

  // ── CRM Modules ───────────────────────────────────────────────
  clients: [],
  clientContacts: [],
  clientCalls: [],
  clientMeetings: [],
  followUps: [],
  requirements: [],
  opportunities: []
};
