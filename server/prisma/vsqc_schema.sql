-- =============================================================================
-- VSQC PLATFORM — PRODUCTION POSTGRESQL 15 SCHEMA (WITH CRM & RLS)
-- Target: Neon DB (PostgreSQL 15) / Supabase
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- CLEAN SLATE — DROP EXISTING STRUCTURES
-- =============================================================================

DROP TABLE IF EXISTS "PermissionOverride" CASCADE;
DROP TABLE IF EXISTS "RolePermission" CASCADE;
DROP TABLE IF EXISTS "AuditLog" CASCADE;
DROP TABLE IF EXISTS "Notification" CASCADE;
DROP TABLE IF EXISTS "Activity" CASCADE;
DROP TABLE IF EXISTS "AIInsight" CASCADE;
DROP TABLE IF EXISTS "Invoice" CASCADE;
DROP TABLE IF EXISTS "Expense" CASCADE;
DROP TABLE IF EXISTS "LeaveRequest" CASCADE;
DROP TABLE IF EXISTS "TimesheetEntry" CASCADE;
DROP TABLE IF EXISTS "Timesheet" CASCADE;
DROP TABLE IF EXISTS "Milestone" CASCADE;
DROP TABLE IF EXISTS "TaskComment" CASCADE;
DROP TABLE IF EXISTS "Subtask" CASCADE;
DROP TABLE IF EXISTS "Task" CASCADE;
DROP TABLE IF EXISTS "ProjectAssignment" CASCADE;
DROP TABLE IF EXISTS "Project" CASCADE;
DROP TABLE IF EXISTS "Verification" CASCADE;
DROP TABLE IF EXISTS "Account" CASCADE;
DROP TABLE IF EXISTS "Session" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;

-- Drop CRM tables
DROP TABLE IF EXISTS "Escalation" CASCADE;
DROP TABLE IF EXISTS "Opportunity" CASCADE;
DROP TABLE IF EXISTS "Requirement" CASCADE;
DROP TABLE IF EXISTS "FollowUp" CASCADE;
DROP TABLE IF EXISTS "Meeting" CASCADE;
DROP TABLE IF EXISTS "Call" CASCADE;
DROP TABLE IF EXISTS "Contact" CASCADE;
DROP TABLE IF EXISTS "Client" CASCADE;

-- =============================================================================
-- AUTHENTICATION — USERS
-- =============================================================================

CREATE TABLE "User" (
  "id"                 TEXT         NOT NULL,
  "name"               TEXT         NOT NULL,
  "email"              TEXT         NOT NULL,
  "emailVerified"      BOOLEAN      NOT NULL DEFAULT FALSE,
  "image"              TEXT,
  "createdAt"          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- VSQC platform fields
  "passwordHash"       TEXT         NOT NULL,
  "role"               TEXT         NOT NULL CHECK ("role" IN ('super_admin', 'client_manager', 'project_manager', 'senior_consultant', 'consultant', 'accounts', 'client_contact')),
  "status"             TEXT         NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'inactive', 'Invited')),
  "mfa"                BOOLEAN      NOT NULL DEFAULT FALSE,
  "lastLoginAt"        TIMESTAMPTZ,
  "mustChangePassword" BOOLEAN      NOT NULL DEFAULT TRUE,

  -- Relationships
  "clientId"           TEXT,
  "reporteeOfId"       TEXT,

  CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "User_email_key" UNIQUE ("email"),
  CONSTRAINT "User_reporteeOf_fkey" FOREIGN KEY ("reporteeOfId")
    REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "User_role_idx"   ON "User"("role");
CREATE INDEX "User_status_idx" ON "User"("status");
CREATE INDEX "User_email_idx"  ON "User"("email");

-- =============================================================================
-- AUTHENTICATION — SESSIONS
-- =============================================================================

CREATE TABLE "Session" (
  "id"        TEXT        NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "token"     TEXT        NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId"    TEXT        NOT NULL,

  CONSTRAINT "Session_pkey"      PRIMARY KEY ("id"),
  CONSTRAINT "Session_token_key" UNIQUE ("token"),
  CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Session_userId_idx"    ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- =============================================================================
-- AUTHENTICATION — OAUTH / CREDENTIAL ACCOUNTS (Better Auth)
-- =============================================================================

CREATE TABLE "Account" (
  "id"                    TEXT        NOT NULL,
  "accountId"             TEXT        NOT NULL,
  "providerId"            TEXT        NOT NULL,
  "userId"                TEXT        NOT NULL,
  "accessToken"           TEXT,
  "refreshToken"          TEXT,
  "idToken"               TEXT,
  "accessTokenExpiresAt"  TIMESTAMPTZ,
  "refreshTokenExpiresAt" TIMESTAMPTZ,
  "scope"                 TEXT,
  "password"              TEXT,
  "createdAt"             TIMESTAMPTZ NOT NULL,
  "updatedAt"             TIMESTAMPTZ NOT NULL,

  CONSTRAINT "Account_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Account_userId_idx"     ON "Account"("userId");
CREATE INDEX "Account_providerId_idx" ON "Account"("providerId");

-- =============================================================================
-- AUTHENTICATION — EMAIL VERIFICATION TOKENS
-- =============================================================================

CREATE TABLE "Verification" (
  "id"         TEXT        NOT NULL,
  "identifier" TEXT        NOT NULL,
  "value"      TEXT        NOT NULL,
  "expiresAt"  TIMESTAMPTZ NOT NULL,
  "createdAt"  TIMESTAMPTZ,
  "updatedAt"  TIMESTAMPTZ,

  CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");
CREATE INDEX "Verification_expiresAt_idx"  ON "Verification"("expiresAt");

-- =============================================================================
-- PROJECTS
-- =============================================================================

CREATE TABLE "Project" (
  "id"          TEXT             NOT NULL,
  "name"        TEXT             NOT NULL,
  "client"      TEXT             NOT NULL,
  "status"      TEXT             NOT NULL DEFAULT 'planning' CHECK ("status" IN ('active', 'planning', 'completed', 'on-hold', 'cancelled')),
  "health"      TEXT             NOT NULL DEFAULT 'on-track' CHECK ("health" IN ('on-track', 'at-risk', 'delayed')),
  "progress"    INTEGER          NOT NULL DEFAULT 0 CHECK ("progress" BETWEEN 0 AND 100),
  "budget"      DOUBLE PRECISION NOT NULL,
  "spent"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "dueDate"     TEXT             NOT NULL,
  "managerName" TEXT             NOT NULL,
  "priority"    TEXT             NOT NULL DEFAULT 'medium' CHECK ("priority" IN ('critical', 'high', 'medium', 'low')),
  "type"        TEXT             NOT NULL,
  "createdAt"   TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Project_status_idx"   ON "Project"("status");
CREATE INDEX "Project_client_idx"   ON "Project"("client");
CREATE INDEX "Project_priority_idx" ON "Project"("priority");

-- =============================================================================
-- PROJECT ASSIGNMENTS (Many-to-Many: User <-> Project)
-- =============================================================================

CREATE TABLE "ProjectAssignment" (
  "userId"    TEXT NOT NULL,
  "projectId" TEXT NOT NULL,

  CONSTRAINT "ProjectAssignment_pkey" PRIMARY KEY ("userId", "projectId"),
  CONSTRAINT "ProjectAssignment_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProjectAssignment_projectId_fkey" FOREIGN KEY ("projectId")
    REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ProjectAssignment_userId_idx"    ON "ProjectAssignment"("userId");
CREATE INDEX "ProjectAssignment_projectId_idx" ON "ProjectAssignment"("projectId");

-- =============================================================================
-- TASKS
-- =============================================================================

CREATE TABLE "Task" (
  "id"                   TEXT             NOT NULL,
  "title"                TEXT             NOT NULL,
  "projectId"            TEXT             NOT NULL,
  "assigneeId"           TEXT             NOT NULL,
  "priority"             TEXT             NOT NULL DEFAULT 'medium' CHECK ("priority" IN ('critical', 'high', 'medium', 'low')),
  "dueDate"              TEXT             NOT NULL,
  "estimate"             DOUBLE PRECISION NOT NULL,
  "progress"             INTEGER          NOT NULL DEFAULT 0 CHECK ("progress" BETWEEN 0 AND 100),
  "status"               TEXT             NOT NULL DEFAULT 'todo' CHECK ("status" IN ('todo', 'inprogress', 'review', 'done')),
  "tags"                 TEXT[]           NOT NULL DEFAULT '{}',
  "isMilestone"          BOOLEAN          NOT NULL DEFAULT FALSE,
  "actualCompletionDate" TEXT,
  "createdAt"            TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  "updatedAt"            TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

  CONSTRAINT "Task_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId")
    REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Task_projectId_idx"   ON "Task"("projectId");
CREATE INDEX "Task_assigneeId_idx"  ON "Task"("assigneeId");
CREATE INDEX "Task_status_idx"      ON "Task"("status");
CREATE INDEX "Task_priority_idx"    ON "Task"("priority");
CREATE INDEX "Task_dueDate_idx"     ON "Task"("dueDate");
CREATE INDEX "Task_isMilestone_idx" ON "Task"("isMilestone");

-- =============================================================================
-- SUBTASKS
-- =============================================================================

CREATE TABLE "Subtask" (
  "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "taskId"      TEXT        NOT NULL,
  "title"       TEXT        NOT NULL,
  "dueDate"     TEXT        NOT NULL,
  "description" TEXT,
  "isMilestone" BOOLEAN     NOT NULL DEFAULT FALSE,
  "status"      TEXT        NOT NULL DEFAULT 'Not Started' CHECK ("status" IN ('Not Started', 'In Progress', 'Completed')),
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "Subtask_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Subtask_taskId_fkey" FOREIGN KEY ("taskId")
    REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Subtask_taskId_idx" ON "Subtask"("taskId");
CREATE INDEX "Subtask_status_idx" ON "Subtask"("status");

-- =============================================================================
-- TASK COMMENTS
-- =============================================================================

CREATE TABLE "TaskComment" (
  "id"        TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "taskId"    TEXT        NOT NULL,
  "userName"  TEXT        NOT NULL,
  "avatar"    TEXT        NOT NULL,
  "color"     TEXT        NOT NULL,
  "role"      TEXT        NOT NULL,
  "text"      TEXT        NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId")
    REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "TaskComment_taskId_idx"    ON "TaskComment"("taskId");
CREATE INDEX "TaskComment_createdAt_idx" ON "TaskComment"("createdAt" DESC);

-- =============================================================================
-- MILESTONES
-- =============================================================================

CREATE TABLE "Milestone" (
  "id"        TEXT             NOT NULL,
  "projectId" TEXT             NOT NULL,
  "title"     TEXT             NOT NULL,
  "date"      TEXT             NOT NULL,
  "status"    TEXT             NOT NULL DEFAULT 'upcoming' CHECK ("status" IN ('upcoming', 'at-risk', 'delayed', 'completed')),
  "amount"    DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

  CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId")
    REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Milestone_projectId_idx" ON "Milestone"("projectId");
CREATE INDEX "Milestone_status_idx"    ON "Milestone"("status");

-- =============================================================================
-- TIMESHEETS
-- =============================================================================

CREATE TABLE "Timesheet" (
  "id"           TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "consultantId" TEXT        NOT NULL,
  "week"         TEXT        NOT NULL,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "Timesheet_pkey"            PRIMARY KEY ("id"),
  CONSTRAINT "Timesheet_consultant_week" UNIQUE ("consultantId", "week"),
  CONSTRAINT "Timesheet_consultantId_fkey" FOREIGN KEY ("consultantId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Timesheet_consultantId_idx" ON "Timesheet"("consultantId");
CREATE INDEX "Timesheet_week_idx"         ON "Timesheet"("week");

-- =============================================================================
-- TIMESHEET ENTRIES
-- =============================================================================

CREATE TABLE "TimesheetEntry" (
  "id"          TEXT             NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "timesheetId" TEXT             NOT NULL,
  "day"         INTEGER          NOT NULL CHECK ("day" BETWEEN 0 AND 6),
  "projectId"   TEXT             NOT NULL,
  "task"        TEXT             NOT NULL,
  "hours"       DOUBLE PRECISION NOT NULL CHECK ("hours" >= 0 AND "hours" <= 24),
  "billable"    BOOLEAN          NOT NULL DEFAULT TRUE,
  "createdAt"   TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

  CONSTRAINT "TimesheetEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TimesheetEntry_timesheetId_fkey" FOREIGN KEY ("timesheetId")
    REFERENCES "Timesheet"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "TimesheetEntry_timesheetId_idx" ON "TimesheetEntry"("timesheetId");
CREATE INDEX "TimesheetEntry_projectId_idx"   ON "TimesheetEntry"("projectId");
CREATE INDEX "TimesheetEntry_billable_idx"    ON "TimesheetEntry"("billable");

-- =============================================================================
-- LEAVE REQUESTS
-- =============================================================================

CREATE TABLE "LeaveRequest" (
  "id"           TEXT        NOT NULL,
  "consultantId" TEXT        NOT NULL,
  "type"         TEXT        NOT NULL CHECK ("type" IN ('Annual Leave', 'Sick Leave', 'Study Leave', 'Unpaid Leave', 'Maternity Leave', 'Paternity Leave', 'Emergency Leave')),
  "start"        TEXT        NOT NULL,
  "end"          TEXT        NOT NULL,
  "days"         INTEGER     NOT NULL CHECK ("days" > 0),
  "status"       TEXT        NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'approved', 'rejected')),
  "reason"       TEXT        NOT NULL,
  "reviewedBy"   TEXT,
  "reviewedAt"   TIMESTAMPTZ,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeaveRequest_consultantId_fkey" FOREIGN KEY ("consultantId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "LeaveRequest_consultantId_idx" ON "LeaveRequest"("consultantId");
CREATE INDEX "LeaveRequest_status_idx"       ON "LeaveRequest"("status");
CREATE INDEX "LeaveRequest_start_idx"        ON "LeaveRequest"("start");

-- =============================================================================
-- EXPENSES
-- =============================================================================

CREATE TABLE "Expense" (
  "id"           TEXT             NOT NULL,
  "consultantId" TEXT             NOT NULL,
  "projectId"    TEXT             NOT NULL,
  "category"     TEXT             NOT NULL CHECK ("category" IN ('Travel', 'Accommodation', 'Meals', 'Transport', 'Equipment', 'Software', 'Training', 'Other')),
  "description"  TEXT             NOT NULL,
  "amount"       DOUBLE PRECISION NOT NULL CHECK ("amount" > 0),
  "currency"     TEXT             NOT NULL DEFAULT 'INR',
  "date"         TEXT             NOT NULL,
  "status"       TEXT             NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'approved', 'rejected')),
  "receipt"      BOOLEAN          NOT NULL DEFAULT FALSE,
  "reviewedBy"   TEXT,
  "reviewedAt"   TIMESTAMPTZ,
  "createdAt"    TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Expense_consultantId_fkey" FOREIGN KEY ("consultantId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Expense_projectId_fkey" FOREIGN KEY ("projectId")
    REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Expense_consultantId_idx" ON "Expense"("consultantId");
CREATE INDEX "Expense_projectId_idx"    ON "Expense"("projectId");
CREATE INDEX "Expense_status_idx"       ON "Expense"("status");
CREATE INDEX "Expense_date_idx"         ON "Expense"("date");

-- =============================================================================
-- INVOICES
-- =============================================================================

CREATE TABLE "Invoice" (
  "id"        TEXT             NOT NULL,
  "projectId" TEXT             NOT NULL,
  "client"    TEXT             NOT NULL,
  "amount"    DOUBLE PRECISION NOT NULL CHECK ("amount" > 0),
  "status"    TEXT             NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft', 'outstanding', 'paid', 'overdue', 'cancelled')),
  "issued"    TEXT             NOT NULL,
  "due"       TEXT,
  "paid"      TEXT,
  "createdAt" TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Invoice_projectId_fkey" FOREIGN KEY ("projectId")
    REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Invoice_projectId_idx" ON "Invoice"("projectId");
CREATE INDEX "Invoice_status_idx"    ON "Invoice"("status");
CREATE INDEX "Invoice_client_idx"    ON "Invoice"("client");
CREATE INDEX "Invoice_issued_idx"    ON "Invoice"("issued");

-- =============================================================================
-- AI INSIGHTS
-- =============================================================================

CREATE TABLE "AIInsight" (
  "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "type"        TEXT        NOT NULL CHECK ("type" IN ('risk', 'resource', 'revenue', 'prediction', 'performance')),
  "severity"    TEXT        NOT NULL CHECK ("severity" IN ('high', 'medium', 'low', 'info')),
  "title"       TEXT        NOT NULL,
  "description" TEXT        NOT NULL,
  "action"      TEXT        NOT NULL,
  "projectId"   TEXT,
  "resolvedAt"  TIMESTAMPTZ,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "AIInsight_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AIInsight_type_idx"     ON "AIInsight"("type");
CREATE INDEX "AIInsight_severity_idx" ON "AIInsight"("severity");

-- =============================================================================
-- ACTIVITY LOG
-- =============================================================================

CREATE TABLE "Activity" (
  "id"        TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "userId"    TEXT        NOT NULL,
  "action"    TEXT        NOT NULL,
  "subject"   TEXT        NOT NULL,
  "projectId" TEXT,
  "type"      TEXT        NOT NULL CHECK ("type" IN ('task', 'file', 'risk', 'timesheet', 'comment', 'invoice', 'leave', 'ai', 'expense', 'project', 'user', 'override')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "Activity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Activity_userId_idx"    ON "Activity"("userId");
CREATE INDEX "Activity_projectId_idx" ON "Activity"("projectId");
CREATE INDEX "Activity_type_idx"      ON "Activity"("type");
CREATE INDEX "Activity_createdAt_idx" ON "Activity"("createdAt" DESC);

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================

CREATE TABLE "Notification" (
  "id"        TEXT    NOT NULL,
  "userId"    TEXT    NOT NULL,
  "type"      TEXT    NOT NULL CHECK ("type" IN ('alert', 'approval', 'risk', 'info', 'success', 'warning')),
  "title"     TEXT    NOT NULL,
  "message"   TEXT    NOT NULL,
  "createdAt" TEXT    NOT NULL,
  "read"      BOOLEAN NOT NULL DEFAULT FALSE,
  "category"  TEXT    CHECK ("category" IN ('project', 'timesheet', 'general', 'leave', 'expense', 'billing', 'admin')),

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Notification_userId_idx"   ON "Notification"("userId");
CREATE INDEX "Notification_read_idx"     ON "Notification"("read");
CREATE INDEX "Notification_type_idx"     ON "Notification"("type");

-- =============================================================================
-- AUDIT LOG
-- =============================================================================

CREATE TABLE "AuditLog" (
  "id"        TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "timestamp" TEXT        NOT NULL,
  "userEmail" TEXT        NOT NULL,
  "action"    TEXT        NOT NULL,
  "resource"  TEXT        NOT NULL,
  "detail"    TEXT        NOT NULL,
  "ip"        TEXT        NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_userEmail_idx"  ON "AuditLog"("userEmail");
CREATE INDEX "AuditLog_action_idx"     ON "AuditLog"("action");
CREATE INDEX "AuditLog_resource_idx"   ON "AuditLog"("resource");
CREATE INDEX "AuditLog_createdAt_idx"  ON "AuditLog"("createdAt" DESC);

-- =============================================================================
-- PERMISSION OVERRIDES — EMERGENCY ACCESS SYSTEM
-- =============================================================================

CREATE TABLE "PermissionOverride" (
  "id"            TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "userId"        TEXT        NOT NULL,
  "permissionKey" TEXT        NOT NULL,
  "granted"       BOOLEAN     NOT NULL,
  "grantedBy"     TEXT        NOT NULL,
  "reason"        TEXT        NOT NULL,
  "startDate"     TIMESTAMPTZ NOT NULL,
  "endDate"       TIMESTAMPTZ NOT NULL,
  "isActive"      BOOLEAN     NOT NULL DEFAULT TRUE,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "PermissionOverride_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PermissionOverride_endDate_gte_startDate"
    CHECK ("endDate" > "startDate")
);

CREATE INDEX "PermissionOverride_userId_idx"        ON "PermissionOverride"("userId");
CREATE INDEX "PermissionOverride_permissionKey_idx" ON "PermissionOverride"("permissionKey");
CREATE INDEX "PermissionOverride_isActive_idx"      ON "PermissionOverride"("isActive");
CREATE INDEX "PermissionOverride_endDate_idx"       ON "PermissionOverride"("endDate");

CREATE INDEX "PermissionOverride_active_user_idx"
  ON "PermissionOverride"("userId", "permissionKey", "endDate")
  WHERE "isActive" = TRUE;

-- =============================================================================
-- RBAC — ROLE PERMISSION DEFINITIONS (Static Reference Table)
-- =============================================================================

CREATE TABLE "RolePermission" (
  "id"            TEXT    NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "role"          TEXT    NOT NULL CHECK ("role" IN ('super_admin', 'client_manager', 'project_manager', 'senior_consultant', 'consultant', 'accounts', 'client_contact')),
  "permissionKey" TEXT    NOT NULL,
  "granted"       BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RolePermission_role_permission_key" UNIQUE ("role", "permissionKey")
);

CREATE INDEX "RolePermission_role_idx" ON "RolePermission"("role");

-- =============================================================================
-- CLIENT MANAGER CRM TABLES
-- =============================================================================

CREATE TABLE "Client" (
  "id"        TEXT        NOT NULL,
  "name"      TEXT        NOT NULL,
  "industry"  TEXT,
  "website"   TEXT,
  "address"   TEXT,
  "status"    TEXT        NOT NULL DEFAULT 'active' CHECK ("status" IN ('active', 'inactive', 'prospect')),
  "tier"      TEXT        NOT NULL DEFAULT 'standard' CHECK ("tier" IN ('standard', 'premium', 'enterprise')),
  "createdBy" TEXT        NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Client_status_idx" ON "Client"("status");
CREATE INDEX "Client_createdBy_idx" ON "Client"("createdBy");

CREATE TABLE "Contact" (
  "id"         TEXT        NOT NULL,
  "clientId"   TEXT        NOT NULL,
  "name"       TEXT        NOT NULL,
  "email"      TEXT,
  "phone"      TEXT,
  "role"       TEXT,
  "isPrimary"  BOOLEAN     NOT NULL DEFAULT FALSE,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "Contact_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Contact_clientId_fkey" FOREIGN KEY ("clientId")
    REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Contact_clientId_idx" ON "Contact"("clientId");

CREATE TABLE "Call" (
  "id"          TEXT        NOT NULL,
  "clientId"    TEXT        NOT NULL,
  "conductedBy" TEXT        NOT NULL,
  "subject"     TEXT        NOT NULL,
  "notes"       TEXT,
  "outcome"     TEXT,
  "duration"    INTEGER,
  "scheduledAt" TIMESTAMPTZ NOT NULL,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "Call_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Call_clientId_fkey" FOREIGN KEY ("clientId")
    REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Call_clientId_idx" ON "Call"("clientId");

CREATE TABLE "Meeting" (
  "id"          TEXT        NOT NULL,
  "clientId"    TEXT        NOT NULL,
  "organizedBy" TEXT        NOT NULL,
  "title"       TEXT        NOT NULL,
  "agenda"      TEXT,
  "notes"       TEXT,
  "platform"    TEXT,
  "meetLink"    TEXT,
  "status"      TEXT        NOT NULL DEFAULT 'scheduled' CHECK ("status" IN ('scheduled', 'completed', 'cancelled')),
  "scheduledAt" TIMESTAMPTZ NOT NULL,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Meeting_clientId_fkey" FOREIGN KEY ("clientId")
    REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Meeting_clientId_idx" ON "Meeting"("clientId");

CREATE TABLE "FollowUp" (
  "id"          TEXT        NOT NULL,
  "clientId"    TEXT        NOT NULL,
  "assignedTo"  TEXT        NOT NULL,
  "description" TEXT        NOT NULL,
  "dueDate"     TIMESTAMPTZ NOT NULL,
  "priority"    TEXT        NOT NULL DEFAULT 'medium' CHECK ("priority" IN ('low', 'medium', 'high', 'urgent')),
  "status"      TEXT        NOT NULL DEFAULT 'open' CHECK ("status" IN ('open', 'in-progress', 'done', 'cancelled')),
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FollowUp_clientId_fkey" FOREIGN KEY ("clientId")
    REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "FollowUp_clientId_idx" ON "FollowUp"("clientId");
CREATE INDEX "FollowUp_status_idx" ON "FollowUp"("status");

CREATE TABLE "Requirement" (
  "id"          TEXT             NOT NULL,
  "clientId"    TEXT             NOT NULL,
  "title"       TEXT             NOT NULL,
  "description" TEXT,
  "category"    TEXT,
  "priority"    TEXT             NOT NULL DEFAULT 'medium',
  "status"      TEXT             NOT NULL DEFAULT 'open' CHECK ("status" IN ('open', 'scoping', 'proposal-sent', 'won', 'lost')),
  "budget"      DOUBLE PRECISION,
  "raisedBy"    TEXT             NOT NULL,
  "createdAt"   TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

  CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Requirement_clientId_fkey" FOREIGN KEY ("clientId")
    REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Requirement_clientId_idx" ON "Requirement"("clientId");
CREATE INDEX "Requirement_status_idx" ON "Requirement"("status");

CREATE TABLE "Opportunity" (
  "id"            TEXT             NOT NULL,
  "clientId"      TEXT             NOT NULL,
  "title"         TEXT             NOT NULL,
  "value"         DOUBLE PRECISION,
  "stage"         TEXT             NOT NULL DEFAULT 'prospect' CHECK ("stage" IN ('prospect', 'qualified', 'proposal', 'negotiation', 'won', 'lost')),
  "probability"   INTEGER          NOT NULL DEFAULT 0 CHECK ("probability" BETWEEN 0 AND 100),
  "expectedClose" TIMESTAMPTZ,
  "ownedBy"       TEXT             NOT NULL,
  "notes"         TEXT,
  "createdAt"     TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ      NOT NULL DEFAULT NOW(),

  CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Opportunity_clientId_fkey" FOREIGN KEY ("clientId")
    REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Opportunity_clientId_idx" ON "Opportunity"("clientId");
CREATE INDEX "Opportunity_stage_idx" ON "Opportunity"("stage");

CREATE TABLE "Escalation" (
  "id"          TEXT        NOT NULL,
  "clientId"    TEXT        NOT NULL,
  "title"       TEXT        NOT NULL,
  "description" TEXT        NOT NULL,
  "severity"    TEXT        NOT NULL DEFAULT 'medium' CHECK ("severity" IN ('low', 'medium', 'high', 'critical')),
  "status"      TEXT        NOT NULL DEFAULT 'open' CHECK ("status" IN ('open', 'in-progress', 'resolved', 'closed')),
  "raisedBy"    TEXT        NOT NULL,
  "assignedTo"  TEXT,
  "resolvedAt"  TIMESTAMPTZ,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "Escalation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Escalation_clientId_idx" ON "Escalation"("clientId");
CREATE INDEX "Escalation_status_idx" ON "Escalation"("status");

-- =============================================================================
-- SEED: ROLE PERMISSION MATRIX
-- =============================================================================

INSERT INTO "RolePermission" ("role", "permissionKey", "granted") VALUES
  -- Super Admin: full access
  ('super_admin', 'Admin Panel Access', TRUE),
  ('super_admin', 'User Management', TRUE),
  ('super_admin', 'Approve Leave', TRUE),
  ('super_admin', 'Approve Expenses', TRUE),
  ('super_admin', 'Approve Timesheets', TRUE),
  ('super_admin', 'Cross-Project Visibility', TRUE),
  ('super_admin', 'View AI Insights', TRUE),
  ('super_admin', 'View Billing', TRUE),
  ('super_admin', 'Manage Invoices', TRUE),
  ('super_admin', 'Emergency Override Access', TRUE),
  ('super_admin', 'View Audit Log', TRUE),
  ('super_admin', 'Manage Milestones', TRUE),
  ('super_admin', 'Create Projects', TRUE),
  ('super_admin', 'Create Tasks', TRUE),
  ('super_admin', 'CRM Access', TRUE),

  -- Client Manager
  ('client_manager', 'Admin Panel Access', FALSE),
  ('client_manager', 'User Management', FALSE),
  ('client_manager', 'Approve Leave', FALSE),
  ('client_manager', 'Approve Expenses', FALSE),
  ('client_manager', 'Approve Timesheets', FALSE),
  ('client_manager', 'Cross-Project Visibility', FALSE),
  ('client_manager', 'View AI Insights', FALSE),
  ('client_manager', 'View Billing', FALSE),
  ('client_manager', 'Manage Invoices', FALSE),
  ('client_manager', 'Emergency Override Access', FALSE),
  ('client_manager', 'View Audit Log', FALSE),
  ('client_manager', 'Manage Milestones', FALSE),
  ('client_manager', 'Create Projects', FALSE),
  ('client_manager', 'Create Tasks', FALSE),
  ('client_manager', 'CRM Access', TRUE),

  -- Project Manager
  ('project_manager', 'Admin Panel Access', FALSE),
  ('project_manager', 'User Management', FALSE),
  ('project_manager', 'Approve Leave', TRUE),
  ('project_manager', 'Approve Expenses', TRUE),
  ('project_manager', 'Approve Timesheets', TRUE),
  ('project_manager', 'Cross-Project Visibility', TRUE),
  ('project_manager', 'View AI Insights', TRUE),
  ('project_manager', 'View Billing', TRUE),
  ('project_manager', 'Manage Invoices', FALSE),
  ('project_manager', 'Emergency Override Access', FALSE),
  ('project_manager', 'View Audit Log', FALSE),
  ('project_manager', 'Manage Milestones', TRUE),
  ('project_manager', 'Create Projects', FALSE),
  ('project_manager', 'Create Tasks', TRUE),
  ('project_manager', 'CRM Access', FALSE),

  -- Senior Consultant
  ('senior_consultant', 'Admin Panel Access', FALSE),
  ('senior_consultant', 'User Management', FALSE),
  ('senior_consultant', 'Approve Leave', FALSE),
  ('senior_consultant', 'Approve Expenses', FALSE),
  ('senior_consultant', 'Approve Timesheets', TRUE),
  ('senior_consultant', 'Cross-Project Visibility', FALSE),
  ('senior_consultant', 'View AI Insights', FALSE),
  ('senior_consultant', 'View Billing', FALSE),
  ('senior_consultant', 'Manage Invoices', FALSE),
  ('senior_consultant', 'Emergency Override Access', FALSE),
  ('senior_consultant', 'View Audit Log', FALSE),
  ('senior_consultant', 'Manage Milestones', FALSE),
  ('senior_consultant', 'Create Projects', FALSE),
  ('senior_consultant', 'Create Tasks', FALSE),
  ('senior_consultant', 'CRM Access', FALSE),

  -- Consultant
  ('consultant', 'Admin Panel Access', FALSE),
  ('consultant', 'User Management', FALSE),
  ('consultant', 'Approve Leave', FALSE),
  ('consultant', 'Approve Expenses', FALSE),
  ('consultant', 'Approve Timesheets', FALSE),
  ('consultant', 'Cross-Project Visibility', FALSE),
  ('consultant', 'View AI Insights', FALSE),
  ('consultant', 'View Billing', FALSE),
  ('consultant', 'Manage Invoices', FALSE),
  ('consultant', 'Emergency Override Access', FALSE),
  ('consultant', 'View Audit Log', FALSE),
  ('consultant', 'Manage Milestones', FALSE),
  ('consultant', 'Create Projects', FALSE),
  ('consultant', 'Create Tasks', FALSE),
  ('consultant', 'CRM Access', FALSE),

  -- Accounts
  ('accounts', 'Admin Panel Access', FALSE),
  ('accounts', 'User Management', FALSE),
  ('accounts', 'Approve Leave', FALSE),
  ('accounts', 'Approve Expenses', TRUE),
  ('accounts', 'Approve Timesheets', FALSE),
  ('accounts', 'Cross-Project Visibility', TRUE),
  ('accounts', 'View AI Insights', FALSE),
  ('accounts', 'View Billing', TRUE),
  ('accounts', 'Manage Invoices', TRUE),
  ('accounts', 'Emergency Override Access', FALSE),
  ('accounts', 'View Audit Log', FALSE),
  ('accounts', 'Manage Milestones', FALSE),
  ('accounts', 'Create Projects', FALSE),
  ('accounts', 'Create Tasks', FALSE),
  ('accounts', 'CRM Access', FALSE),

  -- Client Contact
  ('client_contact', 'Admin Panel Access', FALSE),
  ('client_contact', 'User Management', FALSE),
  ('client_contact', 'Approve Leave', FALSE),
  ('client_contact', 'Approve Expenses', FALSE),
  ('client_contact', 'Approve Timesheets', FALSE),
  ('client_contact', 'Cross-Project Visibility', FALSE),
  ('client_contact', 'View AI Insights', FALSE),
  ('client_contact', 'View Billing', FALSE),
  ('client_contact', 'Manage Invoices', FALSE),
  ('client_contact', 'Emergency Override Access', FALSE),
  ('client_contact', 'View Audit Log', FALSE),
  ('client_contact', 'Manage Milestones', FALSE),
  ('client_contact', 'Create Projects', FALSE),
  ('client_contact', 'Create Tasks', FALSE),
  ('client_contact', 'CRM Access', FALSE);

-- =============================================================================
-- TRIGGER FUNCTION — AUTO-UPDATE "updatedAt" COLUMNS
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "User_updatedAt"
  BEFORE UPDATE ON "User"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER "Project_updatedAt"
  BEFORE UPDATE ON "Project"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER "Task_updatedAt"
  BEFORE UPDATE ON "Task"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER "Subtask_updatedAt"
  BEFORE UPDATE ON "Subtask"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER "Milestone_updatedAt"
  BEFORE UPDATE ON "Milestone"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER "Timesheet_updatedAt"
  BEFORE UPDATE ON "Timesheet"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER "LeaveRequest_updatedAt"
  BEFORE UPDATE ON "LeaveRequest"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER "Expense_updatedAt"
  BEFORE UPDATE ON "Expense"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER "Invoice_updatedAt"
  BEFORE UPDATE ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER "AIInsight_updatedAt"
  BEFORE UPDATE ON "AIInsight"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER "PermissionOverride_updatedAt"
  BEFORE UPDATE ON "PermissionOverride"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Triggers for CRM Tables
CREATE TRIGGER "Client_updatedAt"
  BEFORE UPDATE ON "Client"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER "Contact_updatedAt"
  BEFORE UPDATE ON "Contact"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER "Call_updatedAt"
  BEFORE UPDATE ON "Call"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER "Meeting_updatedAt"
  BEFORE UPDATE ON "Meeting"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER "FollowUp_updatedAt"
  BEFORE UPDATE ON "FollowUp"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER "Requirement_updatedAt"
  BEFORE UPDATE ON "Requirement"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER "Opportunity_updatedAt"
  BEFORE UPDATE ON "Opportunity"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER "Escalation_updatedAt"
  BEFORE UPDATE ON "Escalation"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR CRM TABLES
-- =============================================================================

-- Enable RLS
ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Contact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Call" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Meeting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FollowUp" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Requirement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Opportunity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Escalation" ENABLE ROW LEVEL SECURITY;

-- 1. Client Policy
CREATE POLICY client_isolation_policy ON "Client"
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'super_admin' OR
    "createdBy" = auth.uid()::text
  );

-- 2. Contact Policy
CREATE POLICY contact_isolation_policy ON "Contact"
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'super_admin' OR
    EXISTS (
      SELECT 1 FROM "Client"
      WHERE "Client".id = "Contact"."clientId"
        AND "Client"."createdBy" = auth.uid()::text
    )
  );

-- 3. Call Policy
CREATE POLICY call_isolation_policy ON "Call"
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'super_admin' OR
    EXISTS (
      SELECT 1 FROM "Client"
      WHERE "Client".id = "Call"."clientId"
        AND "Client"."createdBy" = auth.uid()::text
    )
  );

-- 4. Meeting Policy
CREATE POLICY meeting_isolation_policy ON "Meeting"
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'super_admin' OR
    EXISTS (
      SELECT 1 FROM "Client"
      WHERE "Client".id = "Meeting"."clientId"
        AND "Client"."createdBy" = auth.uid()::text
    )
  );

-- 5. FollowUp Policy
CREATE POLICY followup_isolation_policy ON "FollowUp"
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'super_admin' OR
    EXISTS (
      SELECT 1 FROM "Client"
      WHERE "Client".id = "FollowUp"."clientId"
        AND "Client"."createdBy" = auth.uid()::text
    )
  );

-- 6. Requirement Policy
CREATE POLICY requirement_isolation_policy ON "Requirement"
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'super_admin' OR
    EXISTS (
      SELECT 1 FROM "Client"
      WHERE "Client".id = "Requirement"."clientId"
        AND "Client"."createdBy" = auth.uid()::text
    )
  );

-- 7. Opportunity Policy
CREATE POLICY opportunity_isolation_policy ON "Opportunity"
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'super_admin' OR
    EXISTS (
      SELECT 1 FROM "Client"
      WHERE "Client".id = "Opportunity"."clientId"
        AND "Client"."createdBy" = auth.uid()::text
    )
  );

-- 8. Escalation Policy
CREATE POLICY escalation_isolation_policy ON "Escalation"
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'super_admin' OR
    EXISTS (
      SELECT 1 FROM "Client"
      WHERE "Client".id = "Escalation"."clientId"
        AND "Client"."createdBy" = auth.uid()::text
    )
  );
