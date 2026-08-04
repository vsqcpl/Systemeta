import { Router } from "express";
import { randomUUID } from "crypto";
import prisma from "../lib/prisma.js";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth.js";
import { requireRoles } from "../middlewares/rbac.js";
import { invalidateDashboardCache } from "../lib/dashboardCache.js";

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
      where: isSpecialRole
        ? {}
        : {
            OR: [
              { projectId: { in: projectsFilter } },
              { assigneeId: req.user.id },
              { assignees: { some: { userId: req.user.id } } },
              { subtasks: { some: { assignees: { has: req.user.id } } } },
              { subtasks: { some: { assignees: { has: req.user.name || "" } } } },
            ],
          },
      include: {
        comments: true,
        subtasks: true,
        assignees: {
          select: { userId: true },
        },
      },
    });

    // Format tasks to match what Next.js frontend expects (flat project fields)
    const formattedTasks = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      project: t.projectId,
      assignee: t.assigneeId,
      assignees: t.assignees.map((a) => a.userId),
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
        id: s.id,
        title: s.title,
        dueDate: s.dueDate,
        description: s.description || undefined,
        isMilestone: s.isMilestone,
        status: s.status as any,
        assignees: s.assignees || [],
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
    const { title, project, assignee, priority, dueDate, estimate, status, tags, isMilestone, assignees, subtasks } = req.body;

    if (!title || !project || !assignee) {
      return res.status(400).json({ message: "Required fields are missing" });
    }

    let projectRecord = await prisma.project.findFirst({
      where: {
        OR: [
          { id: project },
          { name: project },
          { code: project },
        ],
      },
    });
    if (!projectRecord) {
      const allProjects = await prisma.project.findMany();
      projectRecord = allProjects.find((p) => p.client ? `${p.name} (${p.client})` === project : false) || null;
    }
    const resolvedProjectId = projectRecord ? projectRecord.id : project;

    const rawAssigneeList = assignees && Array.isArray(assignees) && assignees.length > 0 ? assignees : [assignee];
    const uniqueCandidateIds = Array.from(new Set(rawAssigneeList.filter(Boolean))) as string[];

    const existingUsers = await prisma.user.findMany({
      where: {
        OR: [
          { id: { in: uniqueCandidateIds } },
          { name: { in: uniqueCandidateIds } },
          { email: { in: uniqueCandidateIds } },
        ],
      },
    });
    const validUserIds = existingUsers.map((u) => u.id);

    // If candidate assignees are not in User table, try fallback to avoid foreign key crash
    const resolvedAssignee = validUserIds.includes(assignee)
      ? assignee
      : validUserIds.length > 0
      ? validUserIds[0]
      : req.user.id;
    const resolvedAssignees = validUserIds.length > 0 ? validUserIds : [req.user.id];

    const newTask = await prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          id: randomUUID(),
          title,
          projectId: resolvedProjectId,
          assigneeId: resolvedAssignee,
          priority: priority || "None",
          dueDate: dueDate || "",
          estimate: estimate != null && estimate !== "" ? parseFloat(estimate) : 0,
          status: status || "todo",
          tags: tags ? (Array.isArray(tags) ? tags.join(", ") : String(tags)) : "",
          isMilestone: isMilestone || false,
        },
      });

      await tx.taskAssignment.createMany({
        data: resolvedAssignees.map((uId: string) => ({
          taskId: task.id,
          userId: uId,
        })),
        skipDuplicates: true,
      });

      if (task.isMilestone) {
        await tx.milestone.create({
          data: {
            projectId: resolvedProjectId,
            title: task.title,
            date: task.dueDate || new Date().toISOString().split("T")[0],
            amount: 0,
            status: "Pending",
            description: `Milestone linked from task: ${task.title}`,
            taskId: task.id,
          } as any,
        });
      }

      let createdSubtasks: any[] = [];
      if (subtasks && Array.isArray(subtasks) && subtasks.length > 0) {
        for (const sub of subtasks) {
          if (!sub.title) continue;
          const newSub = await tx.subtask.create({
            data: {
              taskId: task.id,
              title: sub.title,
              dueDate: sub.dueDate || task.dueDate || new Date().toISOString().split("T")[0],
              description: sub.description || null,
              isMilestone: Boolean(sub.isMilestone),
              status: sub.status || "To Do",
              assignees: Array.isArray(sub.assignees) ? sub.assignees : [],
            },
          });
          createdSubtasks.push({
            id: newSub.id,
            title: newSub.title,
            dueDate: newSub.dueDate,
            description: newSub.description || undefined,
            isMilestone: newSub.isMilestone,
            status: newSub.status,
            assignees: newSub.assignees || [],
          });
        }
      }

      return {
        ...task,
        assignees: resolvedAssignees,
        subtasks: createdSubtasks,
      };
    });

    invalidateDashboardCache();

    return res.status(201).json({
      id: newTask.id,
      title: newTask.title,
      project: newTask.projectId,
      assignee: newTask.assigneeId,
      assignees: newTask.assignees,
      priority: newTask.priority,
      dueDate: newTask.dueDate,
      estimate: newTask.estimate,
      progress: newTask.progress,
      status: newTask.status,
      tags: newTask.tags,
      isMilestone: newTask.isMilestone,
      comments: [],
      subtasks: (newTask as any).subtasks || [],
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
    const { status, progress, actualCompletionDate, assigneeId, assignee, estimate, priority, dueDate, title, assignees, isMilestone } = req.body;

    const task = await prisma.task.findUnique({ 
      where: { id },
      include: { assignees: true }
    });
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const isAssignee = task.assigneeId === req.user.id || task.assignees.some((a) => a.userId === req.user.id);
    const project = await prisma.project.findUnique({ where: { id: task.projectId } });
    const isProjectManager = project && project.managerName === req.user.name;

    const membership = await prisma.projectAssignment.findFirst({
      where: { projectId: task.projectId, userId: req.user.id }
    });
    if (!membership && req.user.role !== "super_admin" && !isAssignee && !isProjectManager) {
      return res.status(403).json({ 
        message: "Forbidden: You are not assigned to this project or task" 
      });
    }

    // Enforce In Review status gate:
    if (status && status !== task.status) {
      const isPM = req.user.role === "project_manager";
      const isSuperAdmin = req.user.role === "super_admin";
      const isManagerRole = isSuperAdmin || isPM;

      if (!isManagerRole) {
        if (status === "done") {
          return res.status(403).json({ message: "Forbidden: Only Project Managers and Super Admins can set tasks to Done" });
        }
      }

      // Check if the PM manages this project
      if (isPM && !isSuperAdmin) {
        const isAssignedPM = await prisma.projectAssignment.findFirst({
          where: { projectId: task.projectId, userId: req.user.id }
        });
        if (!isAssignedPM && !isProjectManager) {
          return res.status(403).json({ message: "Forbidden: You do not manage this project" });
        }
      }
    }

    let finalAssigneeId = assigneeId || assignee;
    if (finalAssigneeId) {
      const exists = await prisma.user.findUnique({ where: { id: finalAssigneeId } });
      if (!exists) finalAssigneeId = undefined;
    }

    const updatedTask = await prisma.$transaction(async (tx) => {
      if (assignees !== undefined && Array.isArray(assignees)) {
        await tx.taskAssignment.deleteMany({
          where: { taskId: id },
        });
        if (assignees.length > 0) {
          const uniqueIds = Array.from(new Set(assignees.filter(Boolean))) as string[];
          const validUsers = await prisma.user.findMany({
            where: {
              OR: [
                { id: { in: uniqueIds } },
                { name: { in: uniqueIds } },
                { email: { in: uniqueIds } },
              ],
            },
          });
          const validIds = validUsers.map((u) => u.id);
          if (validIds.length > 0) {
            if (!finalAssigneeId) {
              finalAssigneeId = validIds[0];
            }
            await tx.taskAssignment.createMany({
              data: validIds.map((userId: string) => ({
                taskId: id,
                userId: userId,
              })),
              skipDuplicates: true,
            });
          }
        }
      }

      const updated = await tx.task.update({
        where: { id },
        data: {
          status: status || undefined,
          progress: progress !== undefined ? parseInt(progress) : undefined,
          actualCompletionDate: actualCompletionDate !== undefined ? actualCompletionDate : undefined,
          assigneeId: finalAssigneeId || undefined,
          estimate: estimate != null ? (estimate !== "" ? parseFloat(estimate) : 0) : undefined,
          priority: priority || undefined,
          dueDate: dueDate || undefined,
          title: title || undefined,
          isMilestone: isMilestone !== undefined ? Boolean(isMilestone) : undefined,
        },
        include: {
          comments: true,
          subtasks: true,
          assignees: {
            select: { userId: true },
          },
        },
      });

      if (isMilestone !== undefined) {
        if (Boolean(isMilestone)) {
          const existing = await tx.milestone.findFirst({
            where: {
              OR: [
                { taskId: id } as any,
                { projectId: task.projectId, title: title || task.title }
              ]
            }
          });
          if (!existing) {
            await tx.milestone.create({
              data: {
                projectId: task.projectId,
                title: title || task.title,
                date: dueDate || task.dueDate || new Date().toISOString().split("T")[0],
                amount: 0,
                status: "Pending",
                description: `Milestone linked from task: ${title || task.title}`,
                taskId: id,
              } as any,
            });
          }
        } else {
          await tx.milestone.deleteMany({
            where: {
              OR: [
                { taskId: id } as any,
                { projectId: task.projectId, title: title || task.title }
              ]
            }
          });
        }
      }

      return updated;
    });

    const formattedUpdatedTask = {
      id: updatedTask.id,
      title: updatedTask.title,
      project: updatedTask.projectId,
      assignee: updatedTask.assigneeId,
      assignees: updatedTask.assignees.map((a) => a.userId),
      priority: updatedTask.priority,
      dueDate: updatedTask.dueDate,
      estimate: updatedTask.estimate,
      progress: updatedTask.progress,
      status: updatedTask.status,
      tags: updatedTask.tags,
      isMilestone: updatedTask.isMilestone,
      actualCompletionDate: updatedTask.actualCompletionDate || undefined,
      subtasks: (updatedTask.subtasks || []).map((s: any) => ({
        id: s.id,
        title: s.title,
        dueDate: s.dueDate,
        description: s.description || undefined,
        isMilestone: s.isMilestone,
        status: s.status as any,
        assignees: s.assignees || [],
      })),
    };

    invalidateDashboardCache();

    return res.json(formattedUpdatedTask);
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

    const task = await prisma.task.findUnique({ 
      where: { id },
      include: { assignees: true }
    });
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const isAssignee = task.assigneeId === req.user.id || task.assignees.some((a) => a.userId === req.user.id);

    const membership = await prisma.projectAssignment.findFirst({
      where: { projectId: task.projectId, userId: req.user.id }
    });
    if (!membership && req.user.role !== "super_admin" && !isAssignee) {
      return res.status(403).json({ 
        message: "Forbidden: You are not assigned to this project or task" 
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

// DELETE /api/tasks/:id/comments - Delete comments authored by the current user
router.delete("/:id/comments", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { commentIds } = req.body;

    if (!commentIds || !Array.isArray(commentIds) || commentIds.length === 0) {
      return res.status(400).json({ message: "Comment IDs are required" });
    }

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Verify all comments exist and belong to the current user
    const comments = await prisma.taskComment.findMany({
      where: {
        id: { in: commentIds },
        taskId: id,
      }
    });

    if (comments.length !== commentIds.length) {
      return res.status(404).json({ message: "One or more comments not found" });
    }

    const unauthorized = comments.some(c => c.userName !== req.user.name);
    if (unauthorized) {
      return res.status(403).json({ message: "Forbidden: You can only delete your own comments" });
    }

    // Perform deletion
    await prisma.taskComment.deleteMany({
      where: {
        id: { in: commentIds },
        taskId: id,
      }
    });

    return res.status(200).json({ message: "Comments deleted successfully" });
  } catch (error) {
    console.error("DELETE /tasks/:id/comments error:", error);
    return res.status(500).json({ message: "Internal server error deleting comments" });
  }
});

// POST /api/tasks/:id/subtasks - Add a subtask to an existing task
router.post("/:id/subtasks", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { title, dueDate, description, isMilestone, status, assignees } = req.body;

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
        status: status || "To Do",
        assignees: Array.isArray(assignees) ? assignees : [],
      },
    });

    invalidateDashboardCache();

    return res.status(201).json({
      id: subtask.id,
      title: subtask.title,
      dueDate: subtask.dueDate,
      description: subtask.description || undefined,
      isMilestone: subtask.isMilestone,
      status: subtask.status,
      assignees: subtask.assignees || [],
    });
  } catch (error) {
    console.error("POST /tasks/:id/subtasks error:", error);
    return res.status(500).json({ message: "Internal server error adding subtask" });
  }
});

// PATCH /api/tasks/:taskId/subtasks/:subtaskId - Update subtask status or details
router.patch("/:taskId/subtasks/:subtaskId", async (req: AuthenticatedRequest, res) => {
  try {
    const { taskId, subtaskId } = req.params;
    const { title, dueDate, description, isMilestone, status, assignees } = req.body;

    let existing = await prisma.subtask.findFirst({
      where: { id: subtaskId, taskId },
    });
    if (!existing) {
      const allSubtasks = await prisma.subtask.findMany({ where: { taskId } });
      const idx = parseInt(subtaskId, 10);
      if (!isNaN(idx) && allSubtasks[idx]) {
        existing = allSubtasks[idx];
      } else {
        const found = allSubtasks.find((s) => s.id === subtaskId || s.title === subtaskId);
        if (found) {
          existing = found;
        } else {
          return res.status(404).json({ message: "Subtask not found" });
        }
      }
    }

    if (status && status !== existing.status) {
      const userRole = (req.user?.role || "").toLowerCase();
      const isManager = userRole === "super_admin" || userRole === "project_manager";
      const isAssignee = Array.isArray(existing.assignees) && (existing.assignees.includes(req.user.id) || (req.user.name && existing.assignees.includes(req.user.name)));
      
      if (!isManager) {
        if (!isAssignee) {
          return res.status(403).json({ message: "Forbidden: You do not have permission to update this subtask." });
        }
        if (status.toLowerCase() === "done" || status.toLowerCase() === "completed") {
          return res.status(403).json({ message: "Forbidden: Only Project Managers and Super Admins can set subtasks to Done." });
        }
      }
    }

    const updated = await prisma.subtask.update({
      where: { id: existing.id },
      data: {
        title: title !== undefined ? title : undefined,
        dueDate: dueDate !== undefined ? dueDate : undefined,
        description: description !== undefined ? description : undefined,
        isMilestone: isMilestone !== undefined ? Boolean(isMilestone) : undefined,
        status: status !== undefined ? status : undefined,
        assignees: assignees !== undefined && Array.isArray(assignees) ? assignees : undefined,
      },
    });

    invalidateDashboardCache();

    return res.json({
      id: updated.id,
      title: updated.title,
      dueDate: updated.dueDate,
      description: updated.description || undefined,
      isMilestone: updated.isMilestone,
      status: updated.status,
      assignees: updated.assignees || [],
    });
  } catch (error) {
    console.error("PATCH /tasks/:taskId/subtasks/:subtaskId error:", error);
    return res.status(500).json({ message: "Internal server error updating subtask" });
  }
});

export default router;
