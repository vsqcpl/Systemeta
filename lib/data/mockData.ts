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
  expenses: [
    {
      id: "exp-001",
      consultant: "consultant-1",
      project: "proj-1",
      category: "Travel",
      description: "Flight to client site",
      amount: 15000,
      currency: "INR",
      date: "2026-06-15",
      status: "approved",
      reimbursementStage: "Pending",
      receipt: "receipt_001.pdf"
    },
    {
      id: "exp-002",
      consultant: "consultant-2",
      project: "proj-2",
      category: "Accommodation",
      description: "Hotel stay for 2 nights",
      amount: 8500,
      currency: "INR",
      date: "2026-06-20",
      status: "approved",
      reimbursementStage: "Payment Queued",
      receipt: "hotel_bill.pdf"
    },
    {
      id: "exp-003",
      consultant: "consultant-1",
      project: "proj-1",
      category: "Meals",
      description: "Team lunch",
      amount: 3200,
      currency: "INR",
      date: "2026-06-25",
      status: "pending",
      reimbursementStage: "Pending",
      receipt: null
    }
  ],

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
