import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth.js";

const router = Router();

router.use(authMiddleware);

// ─── IP-based rate limiter for /groq endpoint ─────────────────────────────────
const GROQ_WINDOW_MS = 60_000;
const GROQ_MAX_CALLS = 20;
const groqIpLog = new Map<string, number[]>();
function isGroqRateLimited(ip: string): boolean {
  const now = Date.now();
  const calls = (groqIpLog.get(ip) || []).filter(t => t > now - GROQ_WINDOW_MS);
  if (calls.length >= GROQ_MAX_CALLS) { groqIpLog.set(ip, calls); return true; }
  calls.push(now); groqIpLog.set(ip, calls); return false;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, calls] of groqIpLog.entries()) {
    const fresh = calls.filter(t => t > now - GROQ_WINDOW_MS);
    if (!fresh.length) groqIpLog.delete(ip); else groqIpLog.set(ip, fresh);
  }
}, 5 * 60_000);

// POST /api/ai/groq - Generic Groq LLM proxy for frontend features
router.post("/groq", async (req: AuthenticatedRequest, res) => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  if (isGroqRateLimited(ip)) return res.status(429).json({ error: "Rate limit exceeded. Max 20 AI calls per minute." });
  const { prompt, systemPrompt } = req.body as { prompt?: string; systemPrompt?: string };
  if (!prompt || typeof prompt !== "string") return res.status(400).json({ error: "prompt is required." });
  try {
    const content = await callGroq([{ role: "system", content: systemPrompt || "You are a helpful project management AI assistant. Be concise and actionable." }, { role: "user", content: prompt }]);
    return res.json({ content });
  } catch (err: any) {
    console.error("[/api/ai/groq error]", err);
    return res.status(500).json({ error: err.message || "Groq API failed." });
  }
});



// Generic Groq API caller using fetch with NVIDIA NIM fallback
async function callGroq(messages: any[], jsonMode = false) {
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  // Use NVIDIA if available and groq is placeholder or absent
  if (nvidiaKey && (!groqKey || groqKey.includes("placeholder"))) {
    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${nvidiaKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "nvidia/llama-3.1-nemotron-70b-instruct",
        messages,
        temperature: 0.1,
      }),
    });

    if (res.ok) {
      const data = await res.json() as any;
      const content = data.choices[0].message.content;
      
      if (jsonMode) {
        let cleanContent = content.trim();
        if (cleanContent.startsWith("```json")) {
          cleanContent = cleanContent.substring(7, cleanContent.length - 3).trim();
        } else if (cleanContent.startsWith("```")) {
          cleanContent = cleanContent.substring(3, cleanContent.length - 3).trim();
        }
        try {
          return JSON.parse(cleanContent);
        } catch (e) {
          console.warn("Nvidia JSON parse failed, returning raw content:", cleanContent);
          return { error: "JSON_PARSE_FAILED", content: cleanContent };
        }
      }
      return content;
    } else {
      console.warn("Nvidia NIM API call failed, falling back to Groq...");
    }
  }

  const apiKey = groqKey || "gsk_placeholder_replace_with_real_key";
  if (!apiKey || apiKey.includes("placeholder")) {
    throw new Error("No configured LLM API key found (GROQ or NVIDIA).");
  }
  
  const body: any = {
    model: "llama3-8b-8192",
    messages,
    temperature: 0.1,
  };
  
  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }
  
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Groq API error: ${res.statusText} - ${errorText}`);
  }
  
  const data = await res.json() as any;
  const content = data.choices[0].message.content;
  return jsonMode ? JSON.parse(content) : content;
}

// Helper function to generate dynamic insights based on current DB state
export async function generateDynamicInsights() {
  // Clear existing insights first
  await prisma.aIInsight.deleteMany();

  const insightsToCreate: any[] = [];

  // Gather database state
  const todayStr = new Date().toISOString().split("T")[0];
  const [projects, overdueTasks, timesheets] = await Promise.all([
    prisma.project.findMany({ where: { status: "active" } }),
    prisma.task.findMany({
      where: {
        status: { in: ["todo", "inprogress", "review"] },
        dueDate: { lt: todayStr }
      },
      include: { project: true }
    }),
    prisma.timesheet.findMany({
      include: {
        entries: true,
        consultant: true
      }
    })
  ]);

  if (projects.length === 0) {
    // If there are no active projects, there's no data to compute insights. Return early.
    return;
  }

  const weeklyAllocation: Record<string, { name: string; hours: number; week: string }> = {};
  timesheets.forEach((ts) => {
    const key = `${ts.consultantId}_${ts.week}`;
    const totalHours = ts.entries.reduce((sum, entry) => sum + entry.hours, 0);
    if (weeklyAllocation[key]) {
      weeklyAllocation[key].hours += totalHours;
    } else {
      weeklyAllocation[key] = {
        name: ts.consultant.name,
        hours: totalHours,
        week: ts.week
      };
    }
  });

  try {
    // Attempt real LLM generation
    const systemPrompt = "You are an AI Operations Analyst for VSQC Platform, an IT consulting and professional services firm. Your job is to analyze active projects, overdue tasks, and consultant weekly timesheets to output operational risks, resource issues, or performance alerts.";
    const userPrompt = `Analyze the current state of our projects, tasks, and resource timesheets. Output a list of actionable operational insights.
You must return a JSON object containing a list under the key "insights". Each insight must strictly follow this JSON schema:
{
  "insights": [
    {
      "type": "risk" | "resource" | "revenue" | "prediction" | "performance",
      "severity": "high" | "medium" | "low" | "info",
      "title": "Short title",
      "description": "Detailed description of the warning, alert, or improvement opportunity",
      "action": "Clear recommended next step or corrective action"
    }
  ]
}

Database Context:
- Active Projects: ${JSON.stringify(projects.map(p => ({ id: p.id, name: p.name, client: p.client, budget: p.budget, spent: p.spent, health: p.health })))}
- Overdue Tasks: ${JSON.stringify(overdueTasks.map(t => ({ id: t.id, title: t.title, project: t.project.name, dueDate: t.dueDate, assigneeId: t.assigneeId })))}
- Resource Weekly Allocation: ${JSON.stringify(Object.values(weeklyAllocation))}

Return ONLY valid JSON matching the specified schema.`;

    const result = await callGroq([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ], true);

    if (result && Array.isArray(result.insights)) {
      insightsToCreate.push(...result.insights);
    }
  } catch (error) {
    console.warn("Groq insight generation failed, falling back to rule-based generation:", error);
    
    // Fallback: Rule-based generation
    overdueTasks.forEach((task) => {
      insightsToCreate.push({
        type: "risk",
        severity: "high",
        title: `Overdue Task: ${task.title}`,
        description: `Task "${task.title}" in project "${task.project.name}" was due on ${task.dueDate} and is currently delayed.`,
        action: `Reassign from assignee ID ${task.assigneeId} or extend deadline.`
      });
    });

    projects.forEach((proj) => {
      const ratio = proj.spent / proj.budget;
      if (ratio >= 1.0) {
        insightsToCreate.push({
          type: "revenue",
          severity: "high",
          title: `Budget Overrun: ${proj.name}`,
          description: `Project "${proj.name}" has spent ₹${proj.spent.toLocaleString("en-IN")} of its ₹${proj.budget.toLocaleString("en-IN")} budget (${Math.round(ratio * 100)}%).`,
          action: "Review milestones and halt non-essential billable hours."
        });
      } else if (ratio >= 0.85) {
        insightsToCreate.push({
          type: "revenue",
          severity: "medium",
          title: `Budget Risk: ${proj.name}`,
          description: `Project "${proj.name}" has consumed ${Math.round(ratio * 100)}% of its allocated budget.`,
          action: "Conduct scope review with the client and verify billing milestones."
        });
      }
    });

    Object.values(weeklyAllocation).forEach((alloc) => {
      if (alloc.hours > 45) {
        insightsToCreate.push({
          type: "resource",
          severity: "high",
          title: `Over-allocated: ${alloc.name}`,
          description: `${alloc.name} has recorded ${alloc.hours} hours in week of ${alloc.week}, exceeding standard utilization limits.`,
          action: "Redistribute project tasks to avoid consultant burnout."
        });
      } else if (alloc.hours < 25 && alloc.hours > 0) {
        insightsToCreate.push({
          type: "resource",
          severity: "medium",
          title: `Under-allocated: ${alloc.name}`,
          description: `${alloc.name} recorded only ${alloc.hours} hours in week of ${alloc.week}, below target billable threshold.`,
          action: "Reallocate to higher priority active pipelines."
        });
      }
    });
  }

  // Add default baseline insights if none exist and active projects exist
  if (insightsToCreate.length === 0 && projects.length > 0) {
    insightsToCreate.push({
      type: "performance",
      severity: "info",
      title: "Team utilization healthy",
      description: "Overall team utilization and budget usage levels are within normal parameters.",
      action: "No action required. Performance indicators are green."
    });
  }

  // Save to database
  if (insightsToCreate.length > 0) {
    await prisma.aIInsight.createMany({
      data: insightsToCreate
    });
  }
}

// POST /api/ai/insights/generate - Trigger insights rebuild
router.post("/insights/generate", async (req: AuthenticatedRequest, res) => {
  try {
    await generateDynamicInsights();
    const insights = await prisma.aIInsight.findMany();
    return res.json(insights);
  } catch (error) {
    console.error("Generate insights error:", error);
    return res.status(500).json({ message: "Internal server error generating insights" });
  }
});

// POST /api/ai/estimate-time - Task time estimation
router.post("/estimate-time", async (req: AuthenticatedRequest, res) => {
  try {
    const { taskName, priority, teamSize } = req.body;
    if (!taskName || !priority || !teamSize) {
      return res.status(400).json({ message: "Task name, priority, and team size are required" });
    }

    const size = parseInt(teamSize, 10) || 1;

    // Search historical completed tasks
    const matchedTasks = await prisma.task.findMany({
      where: {
        title: { contains: taskName, mode: "insensitive" }
      }
    });

    try {
      // Attempt real LLM estimation
      const systemPrompt = "You are an expert project planner and estimator for IT consulting and software engineering teams.";
      const userPrompt = `Estimate the completion time for the task described below, given its priority and team size.
We have some historical tasks of similar nature for your reference.
Return a JSON object containing:
- "time": estimated completion time as a string (e.g. "14 days", "6 days")
- "historical": the number of historical matched tasks provided (${matchedTasks.length})
- "confidence": confidence level of the estimate as a percentage string (e.g. "90%")

Task Details:
- Name: "${taskName}"
- Priority: "${priority}"
- Team Size: ${size}

Historical Tasks Context:
${JSON.stringify(matchedTasks.map(t => ({ title: t.title, estimate: t.estimate, status: t.status })))}

Return ONLY a valid JSON object matching the keys "time", "historical", and "confidence".`;

      const result = await callGroq([
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ], true);

      if (result && result.time && result.confidence) {
        return res.json({
          time: result.time,
          historical: matchedTasks.length,
          confidence: result.confidence
        });
      }
    } catch (error) {
      console.warn("Groq time estimation failed, falling back to rule-based heuristic:", error);
    }

    // Fallback: Rule-based heuristic
    let baseDays = 10;
    if (priority.toLowerCase() === "critical") baseDays = 20;
    else if (priority.toLowerCase() === "high") baseDays = 15;
    else if (priority.toLowerCase() === "medium") baseDays = 10;
    else baseDays = 5;

    const estDays = Math.max(1, Math.round(baseDays / Math.sqrt(size)));
    const confidence = matchedTasks.length > 0 ? Math.min(95, 75 + matchedTasks.length * 3) : 70;

    return res.json({
      time: `${estDays} days`,
      historical: matchedTasks.length,
      confidence: `${confidence}%`
    });
  } catch (error) {
    console.error("Estimate time error:", error);
    return res.status(500).json({ message: "Internal server error estimating task time" });
  }
});

// POST /api/ai/predict-deadline - Predict deadline
router.post("/predict-deadline", async (req: AuthenticatedRequest, res) => {
  try {
    const { taskName, startDate, teamSize, complexity } = req.body;
    if (!taskName || !startDate || !teamSize || !complexity) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const size = parseInt(teamSize, 10) || 1;
    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      return res.status(400).json({ message: "Invalid start date format" });
    }

    try {
      // Attempt real LLM prediction
      const systemPrompt = "You are an AI scheduling and project delivery assistant.";
      const userPrompt = `Predict a realistic completion deadline date starting from ${startDate} for the task described below. Consider the team size, complexity, and add a reasonable buffer.
Return a JSON object containing:
- "deadline": the predicted completion date formatted as Day Month Year (e.g. "25 June 2026")
- "risk": risk level assessment ("Low" | "Medium" | "High")
- "buffer": buffer size added (e.g. "3 days", "5 days")

Task Details:
- Name: "${taskName}"
- Complexity: "${complexity}"
- Team Size: ${size}
- Start Date: ${startDate}

Return ONLY a valid JSON object matching the keys "deadline", "risk", and "buffer".`;

      const result = await callGroq([
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ], true);

      if (result && result.deadline && result.risk && result.buffer) {
        return res.json(result);
      }
    } catch (error) {
      console.warn("Groq deadline prediction failed, falling back to rule-based heuristic:", error);
    }

    // Fallback: Rule-based heuristic
    let complexityDays = 10;
    let buffer = 2;
    let risk = "Low";

    if (complexity.toLowerCase() === "high") {
      complexityDays = 25;
      buffer = 5;
      risk = size <= 2 ? "High" : "Medium";
    } else if (complexity.toLowerCase() === "medium") {
      complexityDays = 15;
      buffer = 3;
      risk = size <= 1 ? "Medium" : "Low";
    } else {
      complexityDays = 8;
      buffer = 1;
      risk = "Low";
    }

    const totalDays = Math.ceil(complexityDays / Math.sqrt(size)) + buffer;
    const predDate = new Date(start);
    predDate.setDate(predDate.getDate() + totalDays);

    const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };
    const formattedDeadline = predDate.toLocaleDateString("en-US", options);

    return res.json({
      deadline: formattedDeadline,
      risk,
      buffer: `${buffer} days`
    });
  } catch (error) {
    console.error("Predict deadline error:", error);
    return res.status(500).json({ message: "Internal server error predicting deadline" });
  }
});

// GET /api/ai/weekly-summary - Aggregate statistics for operations summary
router.get("/weekly-summary", async (req: AuthenticatedRequest, res) => {
  try {
    // Generate fresh insights first
    await generateDynamicInsights();

    const [projects, insights] = await Promise.all([
      prisma.project.findMany(),
      prisma.aIInsight.findMany()
    ]);

    // Compute basic aggregates
    let healthScore = 100;
    if (projects.length > 0) {
      const totalScore = projects.reduce((sum, p) => {
        if (p.health === "on-track") return sum + 100;
        if (p.health === "at-risk") return sum + 50;
        return sum;
      }, 0);
      healthScore = Math.round((totalScore / projects.length) * 10) / 10;
    }

    const highCount = insights.filter(i => i.severity === "high").length;
    const medCount = insights.filter(i => i.severity === "medium").length;
    const lowCount = insights.filter(i => i.severity === "low" || i.severity === "info").length;

    const targetRevenue = projects.reduce((s, p) => s + p.budget, 0);
    const actualSpent = projects.reduce((s, p) => s + p.spent, 0);
    const forecastRevenue = actualSpent + (targetRevenue - actualSpent) * 0.95;

    try {
      // Attempt LLM Weekly Summary
      const systemPrompt = "You are a professional PMO Director summarizing corporate operations performance.";
      const userPrompt = `Generate a weekly operational summary report. Analyze the project budget status, team utilization health score, and recent AI recommendations.
Return a JSON object containing:
- "healthScore": overall health score (e.g. "${healthScore}%")
- "activeAlertsCount": total alerts (${insights.length})
- "insightsDistribution": { "high": ${highCount}, "medium": ${medCount}, "low": ${lowCount} }
- "revenue": { "target": ${targetRevenue}, "spent": ${actualSpent}, "forecast": ${forecastRevenue} }
- "insights": a list of top 3 insight objects (matching the database AIInsight schema: type, severity, title, description, action)

Projects context:
${JSON.stringify(projects.map(p => ({ name: p.name, budget: p.budget, spent: p.spent, health: p.health })))}
Recent insights context:
${JSON.stringify(insights.slice(0, 5).map(i => ({ title: i.title, severity: i.severity, type: i.type, description: i.description, action: i.action })))}

Return ONLY a valid JSON object matching the described fields.`;

      const result = await callGroq([
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ], true);

      if (result && result.healthScore && result.revenue && Array.isArray(result.insights)) {
        return res.json(result);
      }
    } catch (error) {
      console.warn("Groq weekly summary generation failed, falling back to database aggregates:", error);
    }

    // Fallback: Local database aggregates
    return res.json({
      healthScore: `${healthScore}%`,
      activeAlertsCount: insights.length,
      insightsDistribution: {
        high: highCount,
        medium: medCount,
        low: lowCount
      },
      revenue: {
        target: targetRevenue,
        spent: actualSpent,
        forecast: forecastRevenue
      },
      insights: insights.slice(0, 5)
    });
  } catch (error) {
    console.error("Weekly summary error:", error);
    return res.status(500).json({ message: "Internal server error preparing weekly summary" });
  }
});

// POST /api/ai/email-summary - Simulate emailing summary
router.post("/email-summary", async (req: AuthenticatedRequest, res) => {
  try {
    const { recipients } = req.body;
    if (!recipients) {
      return res.status(400).json({ message: "Recipients selection is required" });
    }

    const recipientList = [];
    if (recipients.pm) recipientList.push("Project Manager");
    if (recipients.client) recipientList.push("Client");
    if (recipients.teamLead) recipientList.push("Team Lead");

    const emailSentDetail = `Weekly AI summary emailed to: ${recipientList.join(", ")}`;

    // Log Activity
    await prisma.activity.create({
      data: {
        userId: req.user.id,
        action: "Emailed Summary",
        subject: recipientList.join(", "),
        type: "ai"
      }
    });

    // Log Audit
    await prisma.auditLog.create({
      data: {
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
        userEmail: req.user.email,
        action: "AI_SUMMARY_EMAILED",
        resource: "ai:summary",
        detail: emailSentDetail,
        ip: req.ip || "127.0.0.1"
      }
    });

    // Create Notification
    const count = await prisma.notification.count();
    await prisma.notification.create({
      data: {
        id: `N${String(count + 1).padStart(3, "0")}`,
        userId: req.user.id,
        type: "success",
        title: "AI Summary Emailed",
        message: emailSentDetail,
        createdAt: new Date().toISOString(),
        read: false,
        category: "general"
      }
    });

    return res.json({ success: true, message: "Weekly summary emailed successfully." });
  } catch (error) {
    console.error("Email summary error:", error);
    return res.status(500).json({ message: "Internal server error during email dispatch" });
  }
});

// POST /api/ai/push-expenses - Push travel expenses to billing
router.post("/push-expenses", async (req: AuthenticatedRequest, res) => {
  try {
    const { expenseIds } = req.body;
    if (!expenseIds || !Array.isArray(expenseIds)) {
      return res.status(400).json({ message: "Expense IDs list is required" });
    }

    // Approve the selected expenses in the DB
    const updated = await prisma.expense.updateMany({
      where: {
        id: { in: expenseIds }
      },
      data: {
        status: "approved"
      }
    });

    // Log Activity
    await prisma.activity.create({
      data: {
        userId: req.user.id,
        action: "Auto-pushed expenses",
        subject: `${expenseIds.length} travel logs pushed to billing queue`,
        type: "timesheet"
      }
    });

    // Log Audit
    await prisma.auditLog.create({
      data: {
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
        userEmail: req.user.email,
        action: "EXPENSE_AUTO_PUSHED",
        resource: `expensesCount:${expenseIds.length}`,
        detail: `Auto-approved and pushed expenses to billing: ${expenseIds.join(", ")}`,
        ip: req.ip || "127.0.0.1"
      }
    });

    return res.json({ success: true, count: updated.count });
  } catch (error) {
    console.error("Push expenses error:", error);
    return res.status(500).json({ message: "Internal server error pushing expenses to billing" });
  }
});

export default router;
