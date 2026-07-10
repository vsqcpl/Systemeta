import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.js";
import { authMiddleware } from "../middlewares/auth.js";
import { invalidateDashboardCache } from "../lib/dashboardCache.js";

const router = Router();

// ─── RBAC Gate ────────────────────────────────────────────────────────────────
function requireClientManager(req: Request, res: Response, next: Function) {
  const role = (req as any).user?.role;
  // Allow read-only (GET) requests for all authenticated roles so dashboard/sync succeeds
  if (req.method === "GET") {
    return next();
  }
  if (role !== "client_manager" && role !== "super_admin") {
    return res.status(403).json({ error: "Access denied. Client Manager role required." });
  }
  next();
}

// Apply auth + role gate to all routes in this file
router.use(authMiddleware, requireClientManager as any);

// Helper to check if a user can access a client
async function checkClientAccess(clientId: string, userId: string, isSuperAdmin: boolean): Promise<boolean> {
  if (isSuperAdmin) return true;
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  return client?.createdBy === userId;
}

// Helper to create notifications in the database
async function createClientActivityNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  category: string = "general"
) {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        category,
        createdAt: new Date().toISOString(),
      },
    });
    invalidateDashboardCache();
  } catch (error) {
    console.error("Failed to create client activity notification:", error);
  }
}

// Helper to notify both client manager and client contacts
async function notifyClientActivity(
  clientId: string,
  creatorId: string,
  type: string,
  title: string,
  message: string
) {
  // 1. Notify the Client Manager
  await createClientActivityNotification(creatorId, type, title, message, "general");

  // 2. Notify the Client Contact associated with this client
  try {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (client) {
      const contacts = await prisma.user.findMany({
        where: {
          role: { in: ["client_contact", "Client Contact"] },
          OR: [
            { clientId: client.id },
            { clientId: client.name },
          ],
        },
      });
      for (const contact of contacts) {
        await createClientActivityNotification(contact.id, type, title, message, "general");
      }
    }
  } catch (err) {
    console.error("Failed to find and notify client contacts:", err);
  }
}

// Helper to check if a user can access a child record
async function checkRecordAccess(
  table: "contact" | "call" | "meeting" | "followUp" | "requirement" | "opportunity" | "escalation",
  id: string,
  userId: string,
  isSuperAdmin: boolean
): Promise<boolean> {
  if (isSuperAdmin) return true;
  const record = await (prisma[table] as any).findUnique({ where: { id } });
  if (!record) return false;
  const client = await prisma.client.findUnique({ where: { id: record.clientId } });
  return client?.createdBy === userId;
}

// ─── CLIENTS ──────────────────────────────────────────────────────────────────

router.get("/clients", async (req: Request, res: Response) => {
  try {
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const isClientContact = (req as any).user?.role === "client_contact" || (req as any).user?.role === "Client Contact";
    const userId = (req as any).user?.id;
    const userClientId = (req as any).user?.clientId;
    const clients = await prisma.client.findMany({
      where: isSuperAdmin
        ? undefined
        : isClientContact
        ? { id: userClientId || undefined }
        : { createdBy: userId },
      include: { contacts: true, _count: { select: { opportunities: true, requirements: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(clients);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/clients", async (req: Request, res: Response) => {
  try {
    const { name, industry, website, address, status, tier } = req.body;
    const userId = (req as any).user?.id ?? "system";
    const client = await prisma.client.create({
      data: { name, industry, website, address, status, tier, createdBy: userId },
    });
    await createClientActivityNotification(userId, "success", "Client Created", `Client "${name}" has been created.`, "general");
    res.status(201).json(client);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/clients/:id", async (req: Request, res: Response) => {
  try {
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const userId = (req as any).user?.id;
    const client = await prisma.client.findUnique({
      where: { id: req.params.id },
      include: {
        contacts: true,
        calls: { orderBy: { scheduledAt: "desc" } },
        meetings: { orderBy: { scheduledAt: "desc" } },
        followUps: { orderBy: { dueDate: "asc" } },
        requirements: { orderBy: { createdAt: "desc" } },
        opportunities: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!client) return res.status(404).json({ error: "Client not found" });
    if (!isSuperAdmin && client.createdBy !== userId) {
      return res.status(403).json({ error: "Access denied. You do not own this client record." });
    }
    res.json(client);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/clients/:id", async (req: Request, res: Response) => {
  try {
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const userId = (req as any).user?.id;
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client) return res.status(404).json({ error: "Client not found" });
    if (!isSuperAdmin && client.createdBy !== userId) {
      return res.status(403).json({ error: "Access denied. You do not own this client record." });
    }

    const { name, industry, website, address, status, tier } = req.body;
    const updated = await prisma.client.update({
      where: { id: req.params.id },
      data: { name, industry, website, address, status, tier },
    });
    await createClientActivityNotification(userId, "info", "Client Updated", `Client "${name}" details have been updated.`, "general");
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/clients/:id", async (req: Request, res: Response) => {
  try {
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const userId = (req as any).user?.id;
    const client = await prisma.client.findUnique({ where: { id: req.params.id } });
    if (!client) return res.status(404).json({ error: "Client not found" });
    if (!isSuperAdmin && client.createdBy !== userId) {
      return res.status(403).json({ error: "Access denied. You do not own this client record." });
    }

    await prisma.client.delete({ where: { id: req.params.id } });
    await createClientActivityNotification(userId, "alert", "Client Deleted", `Client "${client.name}" has been deleted.`, "general");
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── CONTACTS ─────────────────────────────────────────────────────────────────

router.get("/contacts", async (req: Request, res: Response) => {
  try {
    const { clientId } = req.query;
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const isClientContact = (req as any).user?.role === "client_contact" || (req as any).user?.role === "Client Contact";
    const userId = (req as any).user?.id;
    const userClientId = (req as any).user?.clientId;
    const contacts = await prisma.contact.findMany({
      where: {
        ...(clientId ? { clientId: String(clientId) } : {}),
        client: isSuperAdmin
          ? undefined
          : isClientContact
          ? { id: userClientId || undefined }
          : { createdBy: userId },
      },
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(contacts);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/contacts", async (req: Request, res: Response) => {
  try {
    const { clientId, name, email, phone, role, isPrimary } = req.body;
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const userId = (req as any).user?.id;
    if (!(await checkClientAccess(clientId, userId, isSuperAdmin))) {
      return res.status(403).json({ error: "Access denied. You do not own this client." });
    }
    const contact = await prisma.contact.create({ data: { clientId, name, email, phone, role, isPrimary } });
    await notifyClientActivity(clientId, userId, "success", "Contact Added", `Contact "${name}" has been added.`);
    res.status(201).json(contact);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/contacts/:id", async (req: Request, res: Response) => {
  try {
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const userId = (req as any).user?.id;
    if (!(await checkRecordAccess("contact", req.params.id, userId, isSuperAdmin))) {
      return res.status(403).json({ error: "Access denied. You do not own the client for this contact." });
    }
    const { name, email, phone, role, isPrimary } = req.body;
    const contact = await prisma.contact.update({ where: { id: req.params.id }, data: { name, email, phone, role, isPrimary } });
    await notifyClientActivity(contact.clientId, userId, "info", "Contact Updated", `Contact "${name}" details have been updated.`);
    res.json(contact);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/contacts/:id", async (req: Request, res: Response) => {
  try {
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const userId = (req as any).user?.id;
    if (!(await checkRecordAccess("contact", req.params.id, userId, isSuperAdmin))) {
      return res.status(403).json({ error: "Access denied. You do not own the client for this contact." });
    }
    const contact = await prisma.contact.findUnique({ where: { id: req.params.id } });
    if (contact) {
      await notifyClientActivity(contact.clientId, userId, "alert", "Contact Deleted", `Contact "${contact.name}" has been deleted.`);
    }
    await prisma.contact.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── CALLS ────────────────────────────────────────────────────────────────────

router.get("/calls", async (req: Request, res: Response) => {
  try {
    const { clientId } = req.query;
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const isClientContact = (req as any).user?.role === "client_contact" || (req as any).user?.role === "Client Contact";
    const userId = (req as any).user?.id;
    const userClientId = (req as any).user?.clientId;
    const calls = await prisma.call.findMany({
      where: {
        ...(clientId ? { clientId: String(clientId) } : {}),
        client: isSuperAdmin
          ? undefined
          : isClientContact
          ? { id: userClientId || undefined }
          : { createdBy: userId },
      },
      include: { client: { select: { name: true } } },
      orderBy: { scheduledAt: "desc" },
    });
    res.json(calls);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/calls", async (req: Request, res: Response) => {
  try {
    const { clientId, subject, notes, outcome, duration, scheduledAt } = req.body;
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const userId = (req as any).user?.id;
    if (!(await checkClientAccess(clientId, userId, isSuperAdmin))) {
      return res.status(403).json({ error: "Access denied. You do not own this client." });
    }
    const conductorName = (req as any).user?.name ?? "Unknown";
    const call = await prisma.call.create({
      data: { clientId, subject, notes, outcome, duration, scheduledAt: new Date(scheduledAt), conductedBy: conductorName },
    });
    await notifyClientActivity(clientId, userId, "success", "Call Logged", `Call logged for subject "${subject}".`);
    res.status(201).json(call);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/calls/:id", async (req: Request, res: Response) => {
  try {
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const userId = (req as any).user?.id;
    if (!(await checkRecordAccess("call", req.params.id, userId, isSuperAdmin))) {
      return res.status(403).json({ error: "Access denied. You do not own the client for this call." });
    }
    const { subject, notes, outcome, duration, scheduledAt } = req.body;
    const call = await prisma.call.update({
      where: { id: req.params.id },
      data: { subject, notes, outcome, duration, scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined },
    });
    await notifyClientActivity(call.clientId, userId, "info", "Call Updated", `Call logged for subject "${subject}" has been updated.`);
    res.json(call);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/calls/:id", async (req: Request, res: Response) => {
  try {
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const userId = (req as any).user?.id;
    if (!(await checkRecordAccess("call", req.params.id, userId, isSuperAdmin))) {
      return res.status(403).json({ error: "Access denied. You do not own the client for this call." });
    }
    const call = await prisma.call.findUnique({ where: { id: req.params.id } });
    if (call) {
      await notifyClientActivity(call.clientId, userId, "alert", "Call Deleted", `Call logged for subject "${call.subject}" has been deleted.`);
    }
    await prisma.call.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── MEETINGS ─────────────────────────────────────────────────────────────────

router.get("/meetings", async (req: Request, res: Response) => {
  try {
    const { clientId } = req.query;
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const isClientContact = (req as any).user?.role === "client_contact" || (req as any).user?.role === "Client Contact";
    const userId = (req as any).user?.id;
    const userClientId = (req as any).user?.clientId;
    const meetings = await prisma.meeting.findMany({
      where: {
        ...(clientId ? { clientId: String(clientId) } : {}),
        client: isSuperAdmin
          ? undefined
          : isClientContact
          ? { id: userClientId || undefined }
          : { createdBy: userId },
      },
      include: { client: { select: { name: true } } },
      orderBy: { scheduledAt: "desc" },
    });
    res.json(meetings);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/meetings", async (req: Request, res: Response) => {
  try {
    const { clientId, title, agenda, notes, platform, meetLink, status, scheduledAt } = req.body;
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const userId = (req as any).user?.id;
    if (!(await checkClientAccess(clientId, userId, isSuperAdmin))) {
      return res.status(403).json({ error: "Access denied. You do not own this client." });
    }
    const organizerName = (req as any).user?.name ?? "Unknown";
    const meeting = await prisma.meeting.create({
      data: { clientId, title, agenda, notes, platform, meetLink, status, scheduledAt: new Date(scheduledAt), organizedBy: organizerName },
    });
    await notifyClientActivity(clientId, userId, "success", "Meeting Scheduled", `Meeting scheduled: "${title}".`);
    res.status(201).json(meeting);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/meetings/:id", async (req: Request, res: Response) => {
  try {
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const userId = (req as any).user?.id;
    if (!(await checkRecordAccess("meeting", req.params.id, userId, isSuperAdmin))) {
      return res.status(403).json({ error: "Access denied. You do not own the client for this meeting." });
    }
    const { title, agenda, notes, platform, meetLink, status, scheduledAt } = req.body;
    const meeting = await prisma.meeting.update({
      where: { id: req.params.id },
      data: { title, agenda, notes, platform, meetLink, status, scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined },
    });
    await notifyClientActivity(meeting.clientId, userId, "info", "Meeting Updated", `Meeting "${title}" details have been updated.`);
    res.json(meeting);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/meetings/:id", async (req: Request, res: Response) => {
  try {
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const userId = (req as any).user?.id;
    if (!(await checkRecordAccess("meeting", req.params.id, userId, isSuperAdmin))) {
      return res.status(403).json({ error: "Access denied. You do not own the client for this meeting." });
    }
    const meeting = await prisma.meeting.findUnique({ where: { id: req.params.id } });
    if (meeting) {
      await notifyClientActivity(meeting.clientId, userId, "alert", "Meeting Cancelled", `Meeting "${meeting.title}" has been cancelled.`);
    }
    await prisma.meeting.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── FOLLOW-UPS ───────────────────────────────────────────────────────────────

router.get("/follow-ups", async (req: Request, res: Response) => {
  try {
    const { clientId } = req.query;
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const isClientContact = (req as any).user?.role === "client_contact" || (req as any).user?.role === "Client Contact";
    const userId = (req as any).user?.id;
    const userClientId = (req as any).user?.clientId;
    const followUps = await prisma.followUp.findMany({
      where: {
        ...(clientId ? { clientId: String(clientId) } : {}),
        client: isSuperAdmin
          ? undefined
          : isClientContact
          ? { id: userClientId || undefined }
          : { createdBy: userId },
      },
      include: { client: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
    });
    res.json(followUps);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/follow-ups", async (req: Request, res: Response) => {
  try {
    const { clientId, description, dueDate, priority, status } = req.body;
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const userId = (req as any).user?.id;
    if (!(await checkClientAccess(clientId, userId, isSuperAdmin))) {
      return res.status(403).json({ error: "Access denied. You do not own this client." });
    }
    const assigneeName = (req as any).user?.name ?? "Unknown";
    const followUp = await prisma.followUp.create({
      data: { clientId, description, dueDate: new Date(dueDate), priority, status, assignedTo: assigneeName },
    });
    await notifyClientActivity(clientId, userId, "success", "Follow Up Created", `Follow-up task created: "${description}".`);
    res.status(201).json(followUp);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/follow-ups/:id", async (req: Request, res: Response) => {
  try {
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const userId = (req as any).user?.id;
    if (!(await checkRecordAccess("followUp", req.params.id, userId, isSuperAdmin))) {
      return res.status(403).json({ error: "Access denied. You do not own the client for this follow-up." });
    }
    const { description, dueDate, priority, status } = req.body;
    const fu = await prisma.followUp.update({
      where: { id: req.params.id },
      data: { description, dueDate: dueDate ? new Date(dueDate) : undefined, priority, status },
    });
    await notifyClientActivity(fu.clientId, userId, "info", "Follow Up Updated", `Follow-up task "${description}" has been updated.`);
    res.json(fu);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/follow-ups/:id", async (req: Request, res: Response) => {
  try {
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const userId = (req as any).user?.id;
    if (!(await checkRecordAccess("followUp", req.params.id, userId, isSuperAdmin))) {
      return res.status(403).json({ error: "Access denied. You do not own the client for this follow-up." });
    }
    const fu = await prisma.followUp.findUnique({ where: { id: req.params.id } });
    if (fu) {
      await notifyClientActivity(fu.clientId, userId, "alert", "Follow Up Deleted", `Follow-up task "${fu.description}" has been deleted.`);
    }
    await prisma.followUp.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── REQUIREMENTS ─────────────────────────────────────────────────────────────

router.get("/requirements", async (req: Request, res: Response) => {
  try {
    const { clientId } = req.query;
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const isClientContact = (req as any).user?.role === "client_contact" || (req as any).user?.role === "Client Contact";
    const userId = (req as any).user?.id;
    const userClientId = (req as any).user?.clientId;
    const requirements = await prisma.requirement.findMany({
      where: {
        ...(clientId ? { clientId: String(clientId) } : {}),
        client: isSuperAdmin
          ? undefined
          : isClientContact
          ? { id: userClientId || undefined }
          : { createdBy: userId },
      },
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(requirements);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/requirements", async (req: Request, res: Response) => {
  try {
    const { clientId, title, description, category, priority, status, budget } = req.body;
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const userId = (req as any).user?.id;
    if (!(await checkClientAccess(clientId, userId, isSuperAdmin))) {
      return res.status(403).json({ error: "Access denied. You do not own this client." });
    }
    const raisedByName = (req as any).user?.name ?? "Unknown";
    const req2 = await prisma.requirement.create({
      data: { clientId, title, description, category, priority, status, budget, raisedBy: raisedByName },
    });
    await notifyClientActivity(clientId, userId, "success", "Requirement Added", `New requirement added: "${title}".`);
    res.status(201).json(req2);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/requirements/:id", async (req: Request, res: Response) => {
  try {
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const userId = (req as any).user?.id;
    if (!(await checkRecordAccess("requirement", req.params.id, userId, isSuperAdmin))) {
      return res.status(403).json({ error: "Access denied. You do not own the client for this requirement." });
    }
    const { title, description, category, priority, status, budget } = req.body;
    const r = await prisma.requirement.update({ where: { id: req.params.id }, data: { title, description, category, priority, status, budget } });
    await notifyClientActivity(r.clientId, userId, "info", "Requirement Updated", `Requirement "${title}" has been updated.`);
    res.json(r);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/requirements/:id", async (req: Request, res: Response) => {
  try {
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const userId = (req as any).user?.id;
    if (!(await checkRecordAccess("requirement", req.params.id, userId, isSuperAdmin))) {
      return res.status(403).json({ error: "Access denied. You do not own the client for this requirement." });
    }
    const r = await prisma.requirement.findUnique({ where: { id: req.params.id } });
    if (r) {
      await notifyClientActivity(r.clientId, userId, "alert", "Requirement Deleted", `Requirement "${r.title}" has been deleted.`);
    }
    await prisma.requirement.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── OPPORTUNITIES ────────────────────────────────────────────────────────────

router.get("/opportunities", async (req: Request, res: Response) => {
  try {
    const { clientId } = req.query;
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const isClientContact = (req as any).user?.role === "client_contact" || (req as any).user?.role === "Client Contact";
    const userId = (req as any).user?.id;
    const userClientId = (req as any).user?.clientId;
    const opps = await prisma.opportunity.findMany({
      where: {
        ...(clientId ? { clientId: String(clientId) } : {}),
        client: isSuperAdmin
          ? undefined
          : isClientContact
          ? { id: userClientId || undefined }
          : { createdBy: userId },
      },
      include: { client: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json(opps);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/opportunities", async (req: Request, res: Response) => {
  try {
    const { clientId, title, value, stage, probability, expectedClose, notes } = req.body;
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const userId = (req as any).user?.id;
    if (!(await checkClientAccess(clientId, userId, isSuperAdmin))) {
      return res.status(403).json({ error: "Access denied. You do not own this client." });
    }
    const ownerName = (req as any).user?.name ?? "Unknown";
    const opp = await prisma.opportunity.create({
      data: {
        clientId, title, value, stage, probability,
        expectedClose: expectedClose ? new Date(expectedClose) : undefined,
        notes, ownedBy: ownerName,
      },
    });
    await notifyClientActivity(clientId, userId, "success", "Opportunity Created", `Opportunity created: "${title}".`);
    res.status(201).json(opp);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/opportunities/:id", async (req: Request, res: Response) => {
  try {
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const userId = (req as any).user?.id;
    if (!(await checkRecordAccess("opportunity", req.params.id, userId, isSuperAdmin))) {
      return res.status(403).json({ error: "Access denied. You do not own the client for this opportunity." });
    }
    const { title, value, stage, probability, expectedClose, notes } = req.body;
    const opp = await prisma.opportunity.update({
      where: { id: req.params.id },
      data: { title, value, stage, probability, expectedClose: expectedClose ? new Date(expectedClose) : undefined, notes },
    });
    await notifyClientActivity(opp.clientId, userId, "info", "Opportunity Updated", `Opportunity "${title}" details have been updated.`);
    res.json(opp);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/opportunities/:id", async (req: Request, res: Response) => {
  try {
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const userId = (req as any).user?.id;
    if (!(await checkRecordAccess("opportunity", req.params.id, userId, isSuperAdmin))) {
      return res.status(403).json({ error: "Access denied. You do not own the client for this opportunity." });
    }
    const opp = await prisma.opportunity.findUnique({ where: { id: req.params.id } });
    if (opp) {
      await notifyClientActivity(opp.clientId, userId, "alert", "Opportunity Deleted", `Opportunity "${opp.title}" has been deleted.`);
    }
    await prisma.opportunity.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── ESCALATIONS ──────────────────────────────────────────────────────────────

router.get("/escalations", async (req: Request, res: Response) => {
  try {
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const isClientContact = (req as any).user?.role === "client_contact" || (req as any).user?.role === "Client Contact";
    const userId = (req as any).user?.id;
    const userClientId = (req as any).user?.clientId;
    
    let escalations;
    if (isSuperAdmin) {
      escalations = await prisma.escalation.findMany({ orderBy: { createdAt: "desc" } });
    } else {
      // Find clients owned by user or matched client contact id
      const ownedClients = await prisma.client.findMany({
        where: isClientContact
          ? { id: userClientId || undefined }
          : { createdBy: userId },
        select: { id: true },
      });
      const clientIds = ownedClients.map(c => c.id);
      escalations = await prisma.escalation.findMany({
        where: { clientId: { in: clientIds } },
        orderBy: { createdAt: "desc" },
      });
    }
    res.json(escalations);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/escalations", async (req: Request, res: Response) => {
  try {
    const { clientId, title, description, severity, assignedTo } = req.body;
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const userId = (req as any).user?.id;
    if (!(await checkClientAccess(clientId, userId, isSuperAdmin))) {
      return res.status(403).json({ error: "Access denied. You do not own this client." });
    }
    const raisedByName = (req as any).user?.name ?? "Unknown";
    const esc = await prisma.escalation.create({ data: { clientId, title, description, severity, assignedTo, raisedBy: raisedByName } });
    await notifyClientActivity(clientId, userId, "alert", "Escalation Raised", `Escalation raised: "${title}".`);
    res.status(201).json(esc);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/escalations/:id", async (req: Request, res: Response) => {
  try {
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const userId = (req as any).user?.id;
    if (!(await checkRecordAccess("escalation", req.params.id, userId, isSuperAdmin))) {
      return res.status(403).json({ error: "Access denied. You do not own the client for this escalation." });
    }
    const { title, description, severity, status, assignedTo, resolvedAt } = req.body;
    const esc = await prisma.escalation.update({
      where: { id: req.params.id },
      data: { title, description, severity, status, assignedTo, resolvedAt: resolvedAt ? new Date(resolvedAt) : undefined },
    });
    await notifyClientActivity(esc.clientId, userId, "info", "Escalation Updated", `Escalation "${title}" status has been updated to "${status}".`);
    res.json(esc);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DASHBOARD SUMMARY ────────────────────────────────────────────────────────

router.get("/dashboard-summary", async (req: Request, res: Response) => {
  try {
    const isSuperAdmin = (req as any).user?.role === "super_admin";
    const isClientContact = (req as any).user?.role === "client_contact" || (req as any).user?.role === "Client Contact";
    const userId = (req as any).user?.id;
    const userClientId = (req as any).user?.clientId;

    // Build the query where clauses
    const clientWhere = isSuperAdmin
      ? {}
      : isClientContact
      ? { id: userClientId || undefined }
      : { createdBy: userId };

    const childWhere = isSuperAdmin
      ? {}
      : isClientContact
      ? { client: { id: userClientId || undefined } }
      : { client: { createdBy: userId } };

    // Since Escalation does not have a direct client relation, we query by clientIds
    let escalationWhere: any = { status: { in: ["open", "in-progress"] } };
    if (!isSuperAdmin) {
      const ownedClients = await prisma.client.findMany({
        where: isClientContact
          ? { id: userClientId || undefined }
          : { createdBy: userId },
        select: { id: true },
      });
      escalationWhere.clientId = { in: ownedClients.map(c => c.id) };
    }

    const [
      totalClients,
      activeClients,
      openOpps,
      openFollowUps,
      openRequirements,
      openEscalations,
      recentCalls,
      upcomingMeetings,
    ] = await Promise.all([
      prisma.client.count({ where: clientWhere }),
      prisma.client.count({ where: { ...clientWhere, status: "active" } }),
      prisma.opportunity.count({ where: { ...childWhere, stage: { notIn: ["won", "lost"] } } }),
      prisma.followUp.count({ where: { ...childWhere, status: { in: ["open", "in-progress"] } } }),
      prisma.requirement.count({ where: { ...childWhere, status: { notIn: ["won", "lost"] } } }),
      prisma.escalation.count({ where: escalationWhere }),
      prisma.call.findMany({
        where: childWhere,
        orderBy: { scheduledAt: "desc" },
        take: 5,
        include: { client: { select: { name: true } } }
      }),
      prisma.meeting.findMany({
        where: {
          ...childWhere,
          scheduledAt: { gte: new Date() },
          status: "scheduled"
        },
        orderBy: { scheduledAt: "asc" },
        take: 5,
        include: { client: { select: { name: true } } },
      }),
    ]);

    res.json({
      stats: { totalClients, activeClients, openOpps, openFollowUps, openRequirements, openEscalations },
      recentCalls,
      upcomingMeetings,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
