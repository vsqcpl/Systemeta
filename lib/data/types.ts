export interface Kpis {
  activeProjects: number;
  delayedTasks: number;
  upcomingMilestones: number;
  revenuePipeline: number;
  resourceUtilization: number;
  billableHours: number;
  teamMembers: number;
  clientSatisfaction: number;
}

export type ProjectStatus = 'active' | 'planning' | 'completed';
export type ProjectHealth = 'on-track' | 'at-risk' | 'delayed';
export type ProjectPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Project {
  id: string;
  name: string;
  client: string;
  status: ProjectStatus;
  health: ProjectHealth;
  progress: number;
  budget: number;
  spent: number;
  dueDate: string;
  manager: string;
  team: string[]; // Consultant IDs
  priority: ProjectPriority;
  type: string;
}

export interface Consultant {
  id: string;
  name: string;
  role: string;
  dept: string;
  utilization: number;
  availability: number;
  avatar: string;
  color: string;
  billRate: number;
  skills: string[];
}

export interface Subtask {
  title: string;
  dueDate: string;
  description?: string;
  isMilestone?: boolean;
  status?: 'Not Started' | 'In Progress' | 'Completed';
}

export interface Task {
  id: string;
  title: string;
  project: string; // Project ID
  assignee: string; // Consultant ID
  assignees?: string[]; // Multiple Consultant IDs
  priority: ProjectPriority;
  dueDate: string;
  estimate: number;
  progress?: number;
  tags: string[];
  comments?: TaskComment[];
  subtasks?: Subtask[];
  isMilestone?: boolean;
  actualCompletionDate?: string;
}

export interface TaskComment {
  id: string;
  user: string;
  avatar: string;
  color: string;
  role: string;
  text: string;
  time: string;
}

export type MilestoneStatus = 'upcoming' | 'at-risk' | 'delayed' | 'completed';

export interface Milestone {
  id: string;
  project: string; // Project ID (frontend/store field)
  projectId?: string; // Project ID (API/backend field — alias of project)
  title: string;
  date: string;
  status: MilestoneStatus;
  amount: number;
}

export interface RevenueData {
  labels: string[];
  actual: (number | null)[];
  forecast: number[];
  target: number[];
}

export interface UtilizationData {
  labels: string[];
  billable: number[];
  nonBillable: number[];
  available: number[];
}

export interface TimesheetEntry {
  day: number; // 0 (Mon) to 6 (Sun)
  project: string; // Project ID
  task: string;
  hours: number;
  billable: boolean;
  punchInTime?: string;
  punchOutTime?: string;
}

export interface Timesheet {
  consultant: string; // Consultant ID
  week: string; // YYYY-MM-DD
  entries: TimesheetEntry[];
}

export type LeaveStatus = 'pending' | 'approved' | 'rejected';
export type LeaveType = 'Annual Leave' | 'Sick Leave' | 'Study Leave' | 'Other' | (string & {});

export interface LeaveRequest {
  id: string;
  consultant: string; // Consultant ID
  type: LeaveType;
  start: string;
  end: string;
  days: number;
  status: LeaveStatus;
  reason: string;
}

export type ExpenseCategory = 'Travel' | 'Accommodation' | 'Meals' | 'Transport' | 'Other';
export type ExpenseStatus = 'pending' | 'approved' | 'rejected';

export interface Expense {
  id: string;
  consultant: string; // Consultant ID
  project: string; // Project ID
  category: ExpenseCategory;
  description: string;
  amount: number;
  currency: string;
  date: string;
  status: ExpenseStatus;
  receipt: string | boolean | null;
  modeOfTransport?: string;
  fromLocation?: string;
  toLocation?: string;
  calculatedDistance?: number | null;
  isOutsideCity?: boolean;
  reimbursementStage?: string;
  onHoldReason?: string | null;
}

export type InvoiceStatus = 'draft' | 'issued' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  date: string;
  method: string;
  referenceNumber?: string;
  transactionId?: string;
  remarks?: string;
  proofUrl?: string;
  recordedBy: string;
  recordedAt?: string;
}

export interface Invoice {
  id: string;
  project: string; // Project ID
  client: string;
  amount: number;
  status: InvoiceStatus;
  issued: string;
  due?: string;
  paid?: string;
  collectedAmount?: number;
  outstandingAmount?: number;
  payments?: Payment[];
}

export type AIInsightSeverity = 'high' | 'medium' | 'low' | 'info';
export type AIInsightType = 'risk' | 'resource' | 'revenue' | 'prediction' | 'performance';

export interface AIInsight {
  type: AIInsightType;
  severity: AIInsightSeverity;
  title: string;
  description: string;
  action: string;
}

export interface Activity {
  time: string;
  user: string; // Consultant ID or System
  action: string;
  subject: string;
  project: string | null; // Project ID
  type: 'task' | 'file' | 'risk' | 'timesheet' | 'comment' | 'invoice' | 'leave' | 'ai';
}

export interface Notification {
  id: string;
  type: 'alert' | 'approval' | 'risk' | 'info' | 'success';
  title: string;
  message: string;
  time: string;
  read: boolean;
  category?: 'project' | 'timesheet' | 'general';
}

export interface AuditLog {
  timestamp: string;
  user: string;
  action: string;
  resource: string;
  detail: string;
  ip: string;
}

export interface User {
  id: string; // matches Consultant ID or separate
  name: string;
  email: string;
  role: string;
  color?: string;
  avatar?: string;
  status: 'active' | 'inactive' | 'Invited';
  lastLogin: string;
  mfa: boolean;
  clientId?: string;
}

// ── CRM / Client Manager Types ───────────────────────────────────────────────

export type ClientStatus = 'Lead' | 'Prospect' | 'Active' | 'On Hold' | 'Inactive' | 'Closed';
export type ClientPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export interface Client {
  id: string;
  companyName: string;
  clientType: string;
  industry: string;
  website: string;
  gstNumber: string;
  panNumber: string;
  address: string;
  country: string;
  state: string;
  city: string;
  pincode: string;
  email: string;
  phone: string;
  status: ClientStatus;
  clientCategory: string;
  priority: ClientPriority;
  notes: string;
  accountOwner: string; // User ID
  createdAt: string;
}

export interface ClientContact {
  id: string;
  clientId: string;
  name: string;
  designation: string;
  department: string;
  email: string;
  phone: string;
  whatsapp: string;
  preferredContactMethod: string;
  decisionMaker: boolean;
  status: string; // Active, Inactive
}

export type CallDirection = 'Inbound' | 'Outbound';
export type CallOutcome = 'Interested' | 'Need Clarification' | 'Meeting Required' | 'Proposal Requested' | 'No Response' | 'Closed';

export interface ClientCall {
  id: string;
  clientId: string;
  contactId: string | null;
  callType: string;
  callDirection: CallDirection;
  date: string;
  time: string;
  duration: number; // in minutes
  discussionSummary: string;
  outcome: CallOutcome;
  nextAction: string;
  followUpDate: string | null;
}

export type MeetingOutcome = 'Approved' | 'Pending' | 'Need Discussion' | 'Escalated' | 'Rejected';

export type MeetingPlatform = 'Google Meet' | 'Zoom' | 'Microsoft Teams' | 'In Person';

export interface ClientMeeting {
  id: string;
  clientId: string;
  participants: string[]; // Names or IDs
  meetingType: string;
  date: string;
  time: string;
  agenda: string;
  notes: string;
  actionItems: string;
  outcome: MeetingOutcome;
  nextFollowUpDate: string | null;
  platform?: MeetingPlatform;
  inviteSent?: boolean;
  meetingLink?: string;
}

export type FollowUpPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type FollowUpStatus = 'Pending' | 'In Progress' | 'Completed' | 'Overdue' | 'Cancelled';

export interface FollowUp {
  id: string;
  clientId: string;
  contactId: string | null;
  title: string;
  description: string;
  priority: FollowUpPriority;
  dueDate: string;
  assignedTo: string; // User ID
  status: FollowUpStatus;
}

export type RequirementStatus = 'Draft' | 'Submitted' | 'Review' | 'Approved' | 'Rejected' | 'In Progress' | 'Completed';

export interface Requirement {
  id: string;
  reqNumber: string; // e.g., REQ-1001
  clientId: string;
  projectId: string | null;
  title: string;
  description: string;
  businessNeed: string;
  expectedOutcome: string;
  priority: ClientPriority;
  complexity: string; // Low, Medium, High
  requestedBy: string | null; // Contact ID
  assignedTo: string | null; // User ID
  targetDate: string;
  status: RequirementStatus;
  createdAt: string;
}

export type OpportunityStage = 'Lead' | 'Qualified' | 'Discussion' | 'Proposal' | 'Negotiation' | 'Won' | 'Lost';

export interface Opportunity {
  id: string;
  opportunityName: string;
  clientId: string;
  expectedRevenue: number;
  probability: number; // 0-100
  stage: OpportunityStage;
  expectedClosureDate: string;
  competitor: string;
  notes: string;
}

export interface Office {
  id: string;
  name: string;
  address: string;
}

export interface VSQCData {
  kpis: Kpis;
  projects: Project[];
  consultants: Consultant[];
  tasks: {
    todo: Task[];
    inprogress: Task[];
    review: Task[];
    done: Task[];
  };
  milestones: Milestone[];
  revenueData: RevenueData;
  utilizationData: UtilizationData;
  timesheets: Timesheet[];
  leaveRequests: LeaveRequest[];
  expenses: Expense[];
  invoices: Invoice[];
  payments?: Payment[];
  aiInsights: AIInsight[];
  activities: Activity[];
  notifications: Notification[];
  auditLogs: AuditLog[];
  users: User[];
  offices?: Office[];
  
  // CRM Modules
  clients: Client[];
  clientContacts: ClientContact[];
  clientCalls: ClientCall[];
  clientMeetings: ClientMeeting[];
  followUps: FollowUp[];
  requirements: Requirement[];
  opportunities: Opportunity[];
}
