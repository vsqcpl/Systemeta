import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth.js";
import { checkPermission, requirePermission } from "../middlewares/rbac.js";

const router = Router();

router.use(authMiddleware);

// GET /api/projects - Get projects assigned to the user
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    let projects: any[] = [];

    const hasCrossProject = await checkPermission(req.user.id, req.user.role, "Cross-Project Visibility");

    if (req.user.role === "super_admin" || req.user.role === "accounts" || hasCrossProject) {
      // Super Admin, Accounts, or Cross-Project Visibility see all projects
      projects = await prisma.project.findMany({
        include: {
          users: {
            select: { userId: true },
          },
        },
      });
    } else if (req.user.role === "client_manager") {
      // Client Managers see projects belonging to clients they created
      const clients = await prisma.client.findMany({
        where: { createdBy: req.user.id },
        select: { name: true },
      });
      const clientNames = clients.map((c) => c.name);
      projects = await prisma.project.findMany({
        where: {
          client: { in: clientNames },
        },
        include: {
          users: {
            select: { userId: true },
          },
        },
      });
    } else if (req.user.role === "client_contact" && req.user.clientId) {
      // Client Contacts see projects matching their clientId
      projects = await prisma.project.findMany({
        where: { client: req.user.clientId },
        include: {
          users: {
            select: { userId: true },
          },
        },
      });
    } else {
      // Consultants, Senior Consultants, PMs see projects they are assigned to
      const assignments = await prisma.projectAssignment.findMany({
        where: { userId: req.user.id },
        include: {
          project: {
            include: {
              users: {
                select: { userId: true },
              },
            },
          },
        },
      });
      projects = assignments.map((a) => a.project);
    }

    // Format team field as string array of User IDs
    const formatted = projects.map((p) => {
      const { users, ...proj } = p;
      return {
        ...proj,
        manager: p.managerName || "",
        team: users.map((u: any) => u.userId),
      };
    });

    return res.json(formatted);
  } catch (error) {
    console.error("GET /projects error:", error);
    return res.status(500).json({ message: "Internal server error retrieving projects" });
  }
});

// POST /api/projects - Create project. Accessible by super_admin or project_manager (or override).
router.post("/", requirePermission("Create Projects"), async (req: AuthenticatedRequest, res) => {
  try {
    const { name, client, type, budget, dueDate, manager, priority } = req.body;

    if (!name || !client || !budget || !dueDate || !manager || !priority) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Generate unique ID using max existing ID to avoid collisions on deletion
    const lastProject = await prisma.project.findFirst({ orderBy: { id: "desc" } });
    const lastNum = lastProject ? parseInt(lastProject.id.replace("P", "") || "0", 10) : 0;
    const nextId = "P" + String(lastNum + 1).padStart(3, "0");

    const newProject = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          id: nextId,
          name,
          client,
          status: "active",
          health: "on-track",
          progress: 0,
          budget: parseFloat(budget),
          spent: 0,
          dueDate,
          managerName: manager,
          priority,
          type,
        },
      });

      // Default assign the manager and the current user to the project
      await tx.projectAssignment.create({
        data: {
          userId: req.user.id,
          projectId: nextId,
        },
      });

      // If manager name maps to an existing user ID, assign them too
      const managerUser = await tx.user.findFirst({
        where: { name: manager },
      });
      if (managerUser && managerUser.id !== req.user.id) {
        await tx.projectAssignment.create({
          data: {
            userId: managerUser.id,
            projectId: nextId,
          },
        });
      }

      // Log Activity
      await tx.activity.create({
        data: {
          userId: req.user.id,
          action: "Created project",
          subject: name,
          projectId: nextId,
          type: "task",
        },
      });

      // Log Audit
      await tx.auditLog.create({
        data: {
          timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
          userEmail: req.user.email,
          action: "PROJECT_CREATED",
          resource: `project:${nextId}`,
          detail: `Created project ${name} with budget ${budget}`,
          ip: req.ip || "127.0.0.1",
        },
      });

      return project;
    });

    return res.status(201).json({
      ...newProject,
      manager: newProject.managerName || "",
      team: [req.user.id],
    });
  } catch (error) {
    console.error("POST /projects error:", error);
    return res.status(500).json({ message: "Internal server error creating project" });
  }
});

// DELETE /api/projects/:id
router.delete("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== "super_admin" && req.user.role !== "project_manager") {
      return res.status(403).json({ message: "Forbidden: Insufficient permissions to delete projects" });
    }

    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const assignment = await prisma.projectAssignment.findFirst({
      where: {
        projectId: id,
        userId: req.user.id
      }
    });
    if (!assignment && req.user.role !== "super_admin") {
      return res.status(403).json({ 
        message: "Forbidden: You can only delete projects you manage" 
      });
    }

    await prisma.project.delete({
      where: { id },
    });

    // Log Audit
    await prisma.auditLog.create({
      data: {
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
        userEmail: req.user.email,
        action: "PROJECT_DELETED",
        resource: `project:${id}`,
        detail: `Deleted project ${project.name}`,
        ip: req.ip || "127.0.0.1",
      },
    });

    return res.json({ success: true, message: "Project deleted successfully" });
  } catch (error) {
    console.error("DELETE /projects/:id error:", error);
    return res.status(500).json({ message: "Internal server error deleting project" });
  }
});

// GET /api/projects/:id/milestones
router.get("/:id/milestones", async (req: AuthenticatedRequest, res) => {
  try {
    const milestones = await prisma.milestone.findMany({
      where: { projectId: req.params.id },
      orderBy: { date: "asc" }
    });
    return res.json(milestones);
  } catch (error) {
    console.error("GET milestones error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/projects/:id/milestones
router.post("/:id/milestones", async (req: AuthenticatedRequest, res) => {
  try {
    const { id: projectId } = req.params;
    const { title, date, amount, status } = req.body;

    if (!title || !date || !amount) {
      return res.status(400).json({ message: "Title, date, and amount are required." });
    }

    // Auto-generate a project-scoped ID
    const existing = await prisma.milestone.findMany({ where: { projectId } });
    const nextNum = existing.length + 1;
    const milestoneId = `${projectId}_M${String(nextNum).padStart(3, "0")}`;

    const milestone = await prisma.milestone.create({
      data: {
        id: milestoneId,
        projectId,
        title,
        date,
        amount: parseFloat(String(amount)),
        status: status || "upcoming"
      }
    });

    return res.status(201).json(milestone);
  } catch (error) {
    console.error("POST milestone error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/projects/:id/milestones/:milestoneId
router.delete("/:id/milestones/:milestoneId", async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user.role !== "super_admin" && req.user.role !== "project_manager") {
      return res.status(403).json({ message: "Forbidden" });
    }
    await prisma.milestone.delete({ where: { id: req.params.milestoneId } });
    return res.json({ success: true });
  } catch (error) {
    console.error("DELETE milestone error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
