import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth.js";
import { requireRoles } from "../middlewares/rbac.js";

const router = Router();

router.use(authMiddleware);

// GET /api/tasks - Retrieve all tasks grouped by status or flat
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    let projectsFilter: string[] = [];
    const isSpecialRole = req.user.role === "super_admin" || req.user.role === "accounts";

    if (!isSpecialRole) {
      if (req.user.role === "client_manager") {
        const clients = await prisma.client.findMany({
          where: { createdBy: req.user.id },
          select: { name: true },
        });
        const clientNames = clients.map((c) => c.name);
        const projects = await prisma.project.findMany({
          where: { client: { in: clientNames } },
          select: { id: true },
        });
        projectsFilter = projects.map((p) => p.id);
      } else {
        const assignments = await prisma.projectAssignment.findMany({
          where: { userId: req.user.id },
          select: { projectId: true },
        });
        projectsFilter = assignments.map((a) => a.projectId);
      }
    }

    const tasks = await prisma.task.findMany({
      where: isSpecialRole ? {} : { projectId: { in: projectsFilter } },
      include: {
        comments: true,
        subtasks: true,
      },
    });

    // Format tasks to match what Next.js frontend expects (flat project fields)
    const formattedTasks = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      project: t.projectId,
      assignee: t.assigneeId,
      priority: t.priority,
      dueDate: t.dueDate,
      estimate: t.estimate,
      progress: t.progress,
      status: t.status,
      tags: t.tags,
      isMilestone: t.isMilestone,
      actualCompletionDate: t.actualCompletionDate || undefined,
      comments: t.comments.map((c) => ({
        id: c.id,
        user: c.userName,
        avatar: c.avatar,
        color: c.color,
        role: c.role,
        text: c.text,
        time: c.createdAt.toISOString(),
      })),
      subtasks: t.subtasks.map((s) => ({
        title: s.title,
        dueDate: s.dueDate,
        description: s.description || undefined,
        isMilestone: s.isMilestone,
        status: s.status as any,
      })),
    }));

    // Group by status
    const grouped = {
      todo: formattedTasks.filter((t) => t.status === "todo"),
      inprogress: formattedTasks.filter((t) => t.status === "inprogress"),
      review: formattedTasks.filter((t) => t.status === "review"),
      done: formattedTasks.filter((t) => t.status === "done"),
    };

    return res.json(grouped);
  } catch (error) {
    console.error("GET /tasks error:", error);
    return res.status(500).json({ message: "Internal server error retrieving tasks" });
  }
});

// POST /api/tasks - Create a task
router.post("/", requireRoles(["super_admin", "project_manager"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { title, project, assignee, priority, dueDate, estimate, status, tags, isMilestone } = req.body;

    if (!title || !project || !assignee || !priority || !dueDate || !estimate) {
      return res.status(400).json({ message: "Required fields are missing" });
    }

    const lastTask = await prisma.task.findFirst({ orderBy: { id: "desc" } });
    const lastNum = lastTask ? parseInt(lastTask.id.replace("T", "") || "0", 10) : 0;
    const nextId = "T" + String(lastNum + 1).padStart(3, "0");

    const newTask = await prisma.task.create({
      data: {
        id: nextId,
        title,
        projectId: project,
        assigneeId: assignee,
        priority,
        dueDate,
        estimate: parseFloat(estimate),
        status: status || "todo",
        tags: tags ? (Array.isArray(tags) ? tags.join(", ") : String(tags)) : "",
        isMilestone: isMilestone || false,
      },
    });

    return res.status(201).json({
      id: newTask.id,
      title: newTask.title,
      project: newTask.projectId,
      assignee: newTask.assigneeId,
      priority: newTask.priority,
      dueDate: newTask.dueDate,
      estimate: newTask.estimate,
      progress: newTask.progress,
      status: newTask.status,
      tags: newTask.tags,
      isMilestone: newTask.isMilestone,
      comments: [],
      subtasks: [],
    });
  } catch (error) {
    console.error("POST /tasks error:", error);
    return res.status(500).json({ message: "Internal server error creating task" });
  }
});

// PATCH /api/tasks/:id - Move task / Update task status & progress
router.patch("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { status, progress, actualCompletionDate } = req.body;

    const task = await prisma.task.findUnique({ 
      where: { id }
    });
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const membership = await prisma.projectAssignment.findFirst({
      where: { projectId: task.projectId, userId: req.user.id }
    });
    if (!membership && req.user.role !== "super_admin") {
      return res.status(403).json({ 
        message: "Forbidden: You are not assigned to this project" 
      });
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        status: status || undefined,
        progress: progress !== undefined ? parseInt(progress) : undefined,
        actualCompletionDate: actualCompletionDate !== undefined ? actualCompletionDate : undefined,
      },
    });

    return res.json(updatedTask);
  } catch (error) {
    console.error("PATCH /tasks/:id error:", error);
    return res.status(500).json({ message: "Internal server error updating task" });
  }
});

// POST /api/tasks/:id/comments - Add a comment to a task
router.post("/:id/comments", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ message: "Comment text is required" });
    }

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const membership = await prisma.projectAssignment.findFirst({
      where: { projectId: task.projectId, userId: req.user.id }
    });
    if (!membership && req.user.role !== "super_admin") {
      return res.status(403).json({ 
        message: "Forbidden: You are not assigned to this project" 
      });
    }

    // Get commenter's consultant avatar and color
    const comment = await prisma.taskComment.create({
      data: {
        taskId: id,
        userName: req.user.name,
        avatar: req.user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2),
        color: "#6366f1", // default color
        role: req.user.role,
        text,
      },
    });

    return res.status(201).json({
      id: comment.id,
      user: comment.userName,
      avatar: comment.avatar,
      color: comment.color,
      role: comment.role,
      text: comment.text,
      time: comment.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("POST /tasks/:id/comments error:", error);
    return res.status(500).json({ message: "Internal server error adding comment" });
  }
});

// POST /api/tasks/:id/subtasks - Add a subtask to an existing task
router.post("/:id/subtasks", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { title, dueDate, description, isMilestone, status } = req.body;

    if (!title || !dueDate) {
      return res.status(400).json({ message: "Subtask title and dueDate are required" });
    }

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const subtask = await prisma.subtask.create({
      data: {
        taskId: id,
        title,
        dueDate,
        description: description || null,
        isMilestone: isMilestone || false,
        status: status || "Not Started",
      },
    });

    return res.status(201).json(subtask);
  } catch (error) {
    console.error("POST /tasks/:id/subtasks error:", error);
    return res.status(500).json({ message: "Internal server error adding subtask" });
  }
});

export default router;
