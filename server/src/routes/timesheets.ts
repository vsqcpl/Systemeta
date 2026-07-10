import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth.js";
import { checkPermission } from "../middlewares/rbac.js";
import { validateCsrf } from "../middlewares/csrf.js";
import { logAuditEvent } from "../lib/auditLogger.js";
import { invalidateDashboardCache } from "../lib/dashboardCache.js";

const router = Router();

// In-memory rate limiting structures
const rateLimitLogs = {
  efficiency: {
    daily: new Map<string, number>(),
    minute: new Map<string, number>(),
  },
  performance: {
    daily: new Map<string, number>(),
    minute: new Map<string, number>(),
  }
};

const timesheetIpLog = new Map<string, { count: number; resetTime: number }>();

// Clear logs periodically to prevent memory leaks
const rateLimitCleaner = setInterval(() => {
  if (rateLimitLogs.efficiency.daily.size > 5000) rateLimitLogs.efficiency.daily.clear();
  if (rateLimitLogs.efficiency.minute.size > 5000) rateLimitLogs.efficiency.minute.clear();
  if (rateLimitLogs.performance.daily.size > 5000) rateLimitLogs.performance.daily.clear();
  if (rateLimitLogs.performance.minute.size > 5000) rateLimitLogs.performance.minute.clear();
  if (timesheetIpLog.size > 5000) timesheetIpLog.clear();
}, 60 * 60 * 1000);
if (rateLimitCleaner && typeof rateLimitCleaner.unref === "function") {
  rateLimitCleaner.unref();
}

// Timesheet general rate limiter middleware (200 requests per 15 minutes per IP)
const timesheetRateLimiter = (req: any, res: any, next: any) => {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxRequests = 200;

  const log = timesheetIpLog.get(ip);
  if (!log || now > log.resetTime) {
    timesheetIpLog.set(ip, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (log.count >= maxRequests) {
    return res.status(429).json({
      message: "Too many requests to timesheet module. Please try again after 15 minutes."
    });
  }

  log.count += 1;
  next();
};

// Mount general rate limiter on all timesheet routes
router.use(timesheetRateLimiter);

// Mount authentication middleware
router.use(authMiddleware);

// POST /api/timesheets/compute - Stateless Mathematical & Statistical Computation Engine
router.post("/compute", async (req: AuthenticatedRequest, res) => {
  // 1. Check payload token size (approx. 4 chars per token)
  const rawBody = JSON.stringify(req.body);
  const estimatedTokens = Math.ceil(rawBody.length / 4);
  if (estimatedTokens > 1200) {
    return res.status(400).json({ error: "PAYLOAD_TOO_LARGE", max_tokens: 1200 });
  }

  const { feature } = req.body;

  // 2. Validate feature field
  if (!feature || !["efficiency", "performance"].includes(feature)) {
    return res.status(400).json({
      error: "UNKNOWN_FEATURE",
      allowed: ["efficiency", "performance"]
    });
  }

  const consultantId = req.body.consultant_id || req.user.id || "anonymous";
  const tenantId = req.ip || "global";

  // 3. Enforce Rate Limit Contract
  const todayStr = new Date().toISOString().split("T")[0];
  const minuteStr = new Date().toISOString().substring(0, 16); // e.g. "2026-06-24T11:34"

  const limits = {
    efficiency: { daily: 60, minute: 10 },
    performance: { daily: 120, minute: 20 }
  };

  const currentLimits = limits[feature as "efficiency" | "performance"];
  const logs = rateLimitLogs[feature as "efficiency" | "performance"];

  // Daily check
  const dailyKey = `${consultantId}_${todayStr}`;
  const dailyCount = logs.daily.get(dailyKey) || 0;
  if (dailyCount >= currentLimits.daily) {
    return res.status(429).json({
      error: "RATE_LIMIT_EXCEEDED",
      limit: "daily",
      max: currentLimits.daily,
      consultant_id: consultantId
    });
  }

  // Minute burst check
  const minuteKey = `${tenantId}_${minuteStr}`;
  const minuteCount = logs.minute.get(minuteKey) || 0;
  if (minuteCount >= currentLimits.minute) {
    return res.status(429).json({
      error: "RATE_LIMIT_EXCEEDED",
      limit: "burst",
      max: currentLimits.minute,
      tenant_id: tenantId
    });
  }

  // Increment logs
  logs.daily.set(dailyKey, dailyCount + 1);
  logs.minute.set(minuteKey, minuteCount + 1);

  // 4. Feature A: efficiency
  if (feature === "efficiency") {
    const { task_type, actual_hours, historical, threshold_k: rawThreshold } = req.body;

    // Validation
    if (task_type === undefined || typeof task_type !== "string") {
      return res.status(400).json({ error: "INVALID_INPUT", field: "task_type", reason: "task_type is required and must be a string" });
    }
    if (actual_hours === undefined || typeof actual_hours !== "number" || actual_hours <= 0 || actual_hours > 24) {
      return res.status(400).json({ error: "INVALID_INPUT", field: "actual_hours", reason: "actual_hours must be > 0 and <= 24" });
    }
    if (!historical || typeof historical !== "object") {
      return res.status(400).json({ error: "INVALID_INPUT", field: "historical", reason: "historical stats are required" });
    }
    const { n, mean, M2, std_dev } = historical;
    if (n === undefined || !Number.isInteger(n) || n < 1) {
      return res.status(400).json({ error: "INVALID_INPUT", field: "historical.n", reason: "historical.n must be an integer >= 1" });
    }
    if (mean === undefined || typeof mean !== "number" || mean <= 0) {
      return res.status(400).json({ error: "INVALID_INPUT", field: "historical.mean", reason: "historical.mean must be > 0" });
    }
    if (M2 === undefined || typeof M2 !== "number" || M2 < 0) {
      return res.status(400).json({ error: "INVALID_INPUT", field: "historical.M2", reason: "historical.M2 must be >= 0" });
    }
    if (std_dev === undefined || typeof std_dev !== "number" || std_dev < 0) {
      return res.status(400).json({ error: "INVALID_INPUT", field: "historical.std_dev", reason: "historical.std_dev must be >= 0" });
    }
    const threshold_k = rawThreshold !== undefined ? rawThreshold : 1.5;
    if (typeof threshold_k !== "number" || threshold_k < 1.0 || threshold_k > 3.0) {
      return res.status(400).json({ error: "INVALID_INPUT", field: "threshold_k", reason: "threshold_k must be between 1.0 and 3.0" });
    }

    // Computation
    const n_new = n + 1;
    const delta = actual_hours - mean;
    const mean_new = mean + delta / n_new;
    const delta2 = actual_hours - mean_new;
    const M2_new = M2 + delta * delta2;
    const std_dev_new = n_new >= 2 ? Math.sqrt(M2_new / n_new) : 0;

    let z_score: number | null = null;
    let insufficient_data = true;
    let outlier = false;
    let outlier_direction: "over" | "under" | "normal" = "normal";

    if (std_dev !== 0 && n >= 10) {
      z_score = parseFloat(((actual_hours - mean) / std_dev).toFixed(3));
      outlier = Math.abs(z_score) > threshold_k;
      outlier_direction = z_score > threshold_k ? "over" : (z_score < -threshold_k ? "under" : "normal");
      insufficient_data = false;
    }

    const pct_deviation = parseFloat((((actual_hours - mean) / mean) * 100).toFixed(2));

    return res.json({
      feature: "efficiency",
      task_type,
      actual_hours,
      benchmark_hours: mean,
      z_score,
      pct_deviation,
      outlier,
      outlier_direction,
      insufficient_data,
      updated_stats: {
        n: n_new,
        mean: parseFloat(mean_new.toFixed(4)),
        M2: parseFloat(M2_new.toFixed(4)),
        std_dev: parseFloat(std_dev_new.toFixed(4))
      }
    });
  }

  // 5. Feature B: performance
  if (feature === "performance") {
    const {
      consultant_id,
      period,
      billable_hours,
      non_billable_hours,
      available_hours,
      days_present,
      working_days,
      planned_hours,
      actual_hours
    } = req.body;

    // Validation
    if (consultant_id === undefined || typeof consultant_id !== "string") {
      return res.status(400).json({ error: "INVALID_INPUT", field: "consultant_id", reason: "consultant_id is required and must be a string" });
    }
    if (!period || typeof period !== "object" || !period.from || !period.to) {
      return res.status(400).json({ error: "INVALID_INPUT", field: "period", reason: "period object with from/to is required" });
    }
    const fromDate = new Date(period.from);
    const toDate = new Date(period.to);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()) || fromDate >= toDate) {
      return res.status(400).json({ error: "INVALID_INPUT", field: "period", reason: "period.from must be chronologically before period.to" });
    }
    if (working_days === undefined || !Number.isInteger(working_days) || working_days <= 0) {
      return res.status(400).json({ error: "INVALID_INPUT", field: "working_days", reason: "working_days must be an integer > 0" });
    }
    if (available_hours === undefined || typeof available_hours !== "number" || available_hours <= 0 || available_hours > working_days * 12) {
      return res.status(400).json({ error: "INVALID_INPUT", field: "available_hours", reason: "available_hours must be > 0 and <= working_days * 12" });
    }
    if (days_present === undefined || !Number.isInteger(days_present) || days_present < 0 || days_present > working_days) {
      return res.status(400).json({ error: "INVALID_INPUT", field: "days_present", reason: "days_present must be between 0 and working_days" });
    }
    if (planned_hours === undefined || typeof planned_hours !== "number" || planned_hours <= 0 || planned_hours > working_days * 24) {
      return res.status(400).json({ error: "INVALID_INPUT", field: "planned_hours", reason: "planned_hours must be > 0 and <= working_days * 24" });
    }
    if (actual_hours === undefined || typeof actual_hours !== "number" || actual_hours <= 0 || actual_hours > working_days * 24) {
      return res.status(400).json({ error: "INVALID_INPUT", field: "actual_hours", reason: "actual_hours must be > 0 and <= working_days * 24" });
    }
    if (billable_hours === undefined || typeof billable_hours !== "number" || billable_hours < 0) {
      return res.status(400).json({ error: "INVALID_INPUT", field: "billable_hours", reason: "billable_hours must be >= 0" });
    }
    if (non_billable_hours === undefined || typeof non_billable_hours !== "number" || non_billable_hours < 0) {
      return res.status(400).json({ error: "INVALID_INPUT", field: "non_billable_hours", reason: "non_billable_hours must be >= 0" });
    }

    // Computation
    let utilisation_val: number | null = null;
    let utilisation_reason: string | null = null;
    if (available_hours === 0) {
      utilisation_reason = "available_hours_zero";
    } else {
      utilisation_val = parseFloat(Math.min(100, (billable_hours / available_hours) * 100).toFixed(2));
    }

    let attendance_val: number | null = null;
    let attendance_reason: string | null = null;
    if (working_days === 0) {
      attendance_reason = "working_days_zero";
    } else {
      attendance_val = parseFloat(Math.min(100, (days_present / working_days) * 100).toFixed(2));
    }

    let efficiency_val: number | null = null;
    let efficiency_raw: number | null = null;
    let efficiency_reason: string | null = null;
    if (actual_hours === 0) {
      efficiency_reason = "actual_hours_zero";
    } else {
      efficiency_raw = parseFloat(((planned_hours / actual_hours) * 100).toFixed(2));
      efficiency_val = parseFloat(Math.min(100, (planned_hours / actual_hours) * 100).toFixed(2));
    }

    // Health score
    let overall_health: "green" | "amber" | "red" = "green";
    if (utilisation_val === null || attendance_val === null || efficiency_val === null || utilisation_val < 60 || attendance_val < 75 || efficiency_val < 70) {
      overall_health = "red";
    } else if (utilisation_val < 80 || attendance_val < 90 || efficiency_val < 85) {
      overall_health = "amber";
    }

    return res.json({
      feature: "performance",
      consultant_id,
      period: { from: period.from, to: period.to },
      utilisation: {
        value: utilisation_val,
        billable_hours,
        available_hours,
        null_reason: utilisation_reason
      },
      attendance: {
        value: attendance_val,
        days_present,
        working_days,
        null_reason: attendance_reason
      },
      efficiency: {
        value: efficiency_val,
        raw_value: efficiency_raw,
        planned_hours,
        actual_hours,
        null_reason: efficiency_reason
      },
      overall_health
    });
  }
});

// GET /api/timesheets - Retrieve timesheets
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    let timesheets: any[] = [];

    const hasApprovePermission = await checkPermission(req.user.id, req.user.role, "Approve Timesheets");
    const hasCrossProject = await checkPermission(req.user.id, req.user.role, "Cross-Project Visibility");
    const isElevated = req.user.role === "super_admin" || req.user.role === "accounts" || hasApprovePermission || hasCrossProject;

    if (isElevated) {
      // Elevated roles see all timesheets
      timesheets = await prisma.timesheet.findMany({
        include: { entries: true },
      });
    } else if (req.user.role === "project_manager" || req.user.role === "senior_consultant") {
      // PMs and Senior Consultants see timesheets containing entries for their assigned projects
      const assignedProjects = await prisma.projectAssignment.findMany({
        where: { userId: req.user.id },
        select: { projectId: true }
      });
      const projectIds = assignedProjects.map(a => a.projectId);

      timesheets = await prisma.timesheet.findMany({
        where: {
          entries: {
            some: {
              projectId: { in: projectIds }
            }
          }
        },
        include: {
          entries: {
            where: {
              projectId: { in: projectIds }
            }
          }
        }
      });
    } else {
      // Consultant sees only their own timesheets
      timesheets = await prisma.timesheet.findMany({
        where: { consultantId: req.user.id },
        include: { entries: true },
      });
    }

    // Format to match Next.js store structure
    const formatted = timesheets.map((ts) => ({
      consultant: ts.consultantId,
      week: ts.week,
      entries: ts.entries.map((e: any) => ({
        day: e.day,
        project: e.projectId,
        task: e.task,
        hours: e.hours,
        billable: e.billable,
      })),
    }));

    return res.json(formatted);
  } catch (error) {
    console.error("GET /timesheets error:", error);
    return res.status(500).json({ message: "Internal server error retrieving timesheets" });
  }
});

// POST /api/timesheets - Save/Submit timesheet entries (idempotent overwrite)
router.post("/", validateCsrf, async (req: AuthenticatedRequest, res) => {
  try {
    const { consultant, week, entries } = req.body;

    if (!consultant || !week || !Array.isArray(entries)) {
      return res.status(400).json({ message: "consultant, week, and entries array are required" });
    }

    for (const e of entries) {
      const hours = parseFloat(e.hours);
      if (isNaN(hours) || hours < 0 || hours > 24) {
        return res.status(400).json({ 
          message: "Invalid hours: must be between 0 and 24" 
        });
      }
    }

    // Ownership check: non-admin roles can only log timesheets for themselves
    if (req.user.role !== "super_admin" && req.user.id !== consultant) {
      return res.status(403).json({ message: "Forbidden: You can only log timesheets for yourself" });
    }

    const timesheet = await prisma.$transaction(async (tx) => {
      const entryData = entries.map((e: any) => ({
        day: e.day,
        projectId: e.project,
        task: e.task,
        hours: parseFloat(e.hours),
        billable: e.billable !== undefined ? e.billable : true,
      }));

      // Use a single, nested upsert statement to prevent contention from delete-then-insert
      const ts = await tx.timesheet.upsert({
        where: {
          consultantId_week: {
            consultantId: consultant,
            week: week,
          },
        },
        update: {
          entries: {
            deleteMany: {},
            create: entryData,
          },
        },
        create: {
          consultantId: consultant,
          week: week,
          entries: {
            create: entryData,
          },
        },
      });

      // Log Centralized Audit Event
      await logAuditEvent({
        userEmail: req.user.email,
        action: "TIMESHEET_SUBMITTED",
        resource: `timesheet:${ts.id}`,
        detail: `Submitted timesheet for week of ${week}`,
        ip: req.ip || "127.0.0.1",
      }, tx);

      // Log Activity Feed
      await tx.activity.create({
        data: {
          userId: req.user.id,
          action: "Submitted timesheet",
          subject: `Week of ${week}`,
          projectId: null,
          type: "timesheet",
        },
      });

      return ts;
    });

    // Invalidate dashboard cache since timesheet data changed
    invalidateDashboardCache();

    return res.json({ success: true, message: "Timesheet saved successfully" });
  } catch (error) {
    console.error("POST /timesheets error:", error);
    return res.status(500).json({ message: "Internal server error saving timesheet" });
  }
});

// --- Punch Session API ---

// POST /api/timesheets/punch-in
router.post("/punch-in", async (req: AuthenticatedRequest, res) => {
  try {
    const { project, task, location, workNotes, date } = req.body;
    
    // Auto-close any active sessions
    const activeSession = await prisma.punchSession.findFirst({
      where: { consultantId: req.user.id, punchOut: null }
    });
    
    if (activeSession) {
      await prisma.punchSession.update({
        where: { id: activeSession.id },
        data: { punchOut: new Date() }
      });
    }

    const session = await prisma.punchSession.create({
      data: {
        consultantId: req.user.id,
        punchIn: new Date(),
        project: project || "Internal Operations",
        task: task || "",
        location: location || "",
        workNotes: workNotes || "",
        date: date || new Date().toISOString().split("T")[0]
      }
    });

    return res.json({ success: true, session });
  } catch (error) {
    console.error("POST /punch-in error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/timesheets/punch-out
router.post("/punch-out", async (req: AuthenticatedRequest, res) => {
  try {
    const { workNotes, isTaskCompleted } = req.body;
    
    const activeSession = await prisma.punchSession.findFirst({
      where: { consultantId: req.user.id, punchOut: null },
      orderBy: { punchIn: 'desc' }
    });

    if (!activeSession) {
      return res.status(400).json({ success: false, message: "No active punch session found." });
    }

    const updated = await prisma.punchSession.update({
      where: { id: activeSession.id },
      data: { 
        punchOut: new Date(),
        ...(workNotes ? { workNotes } : {})
      }
    });

    if (isTaskCompleted && activeSession.project) {
      await prisma.task.updateMany({
        where: {
          title: activeSession.project,
          assigneeId: req.user.id
        },
        data: {
          status: "done",
          progress: 100,
          actualCompletionDate: new Date().toISOString()
        }
      });
    }

    return res.json({ success: true, session: updated });
  } catch (error) {
    console.error("POST /punch-out error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/timesheets/punch-sessions
router.get("/punch-sessions", async (req: AuthenticatedRequest, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let whereClause: any = { consultantId: req.user.id };
    
    if (startDate && endDate) {
      whereClause.date = {
        gte: String(startDate),
        lte: String(endDate)
      };
    }

    const sessions = await prisma.punchSession.findMany({
      where: whereClause,
      orderBy: { punchIn: 'asc' }
    });

    return res.json({ success: true, sessions });
  } catch (error) {
    console.error("GET /punch-sessions error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
