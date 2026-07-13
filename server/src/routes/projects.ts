import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth.js";
import { checkPermission, requirePermission } from "../middlewares/rbac.js";
import { logAuditEvent } from "../lib/auditLogger.js";
import { invalidateDashboardCache } from "../lib/dashboardCache.js";
import ExcelJS from "exceljs";

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
          projectId: project.id,
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
            projectId: project.id,
          },
        });
      }

      // Log Activity
      await tx.activity.create({
        data: {
          userId: req.user.id,
          action: "Created project",
          subject: name,
          projectId: project.id,
          type: "task",
        },
      });

      // Log Audit
      await logAuditEvent({
        userEmail: req.user.email,
        action: "PROJECT_CREATED",
        resource: `project:${project.id}`,
        detail: `Created project ${name} with budget ${budget}`,
        ip: req.ip || "127.0.0.1",
      }, tx);

      return project;
    });

    invalidateDashboardCache();

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
    await logAuditEvent({
      userEmail: req.user.email,
      action: "PROJECT_DELETED",
      resource: `project:${id}`,
      detail: `Deleted project ${project.name}`,
      ip: req.ip || "127.0.0.1",
    });

    invalidateDashboardCache();

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

    const milestone = await prisma.milestone.create({
      data: {
        projectId,
        title,
        date,
        amount: parseFloat(String(amount)),
        status: status || "upcoming"
      }
    });

    invalidateDashboardCache();

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

// POST /api/projects/:id/members - Add a user to project team
router.post("/:id/members", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // PM only adds to own projects; Super Admin can add to any
    if (req.user.role !== "super_admin") {
      if (req.user.role !== "project_manager") {
        return res.status(403).json({ message: "Forbidden: Only Project Managers and Super Admins can add members" });
      }
      const isAssigned = await prisma.projectAssignment.findFirst({
        where: { projectId: id, userId: req.user.id }
      });
      if (!isAssigned) {
        return res.status(403).json({ message: "Forbidden: You do not manage this project" });
      }
    }

    // Create the assignment if not already exists
    const existing = await prisma.projectAssignment.findUnique({
      where: {
        userId_projectId: { userId, projectId: id }
      }
    });

    if (!existing) {
      await prisma.projectAssignment.create({
        data: { userId, projectId: id }
      });
    }

    invalidateDashboardCache();

    // Return the updated project with team member list
    const updatedProject = await prisma.project.findUnique({
      where: { id },
      include: {
        users: { select: { userId: true } }
      }
    });

    const formatted = {
      ...updatedProject,
      manager: updatedProject?.managerName || "",
      team: updatedProject?.users.map((u) => u.userId) || []
    };

    return res.json(formatted);
  } catch (error) {
    console.error("POST /projects/:id/members error:", error);
    return res.status(500).json({ message: "Internal server error adding member to project" });
  }
});

// GET /api/projects/:id/export-wbs - Export project's WBS to Excel
router.get("/:id/export-wbs", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // Check project exists
    const project = await prisma.project.findUnique({
      where: { id },
    });
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // Retrieve tasks and subtasks
    const tasks = await prisma.task.findMany({
      where: { projectId: id },
      include: {
        assignee: true,
        subtasks: true,
      },
    });

    if (tasks.length === 0) {
      return res.status(400).json({ message: "No WBS/Tasks exist for the selected project" });
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("WBS Structure");

    // Define column keys and default widths (no header attribute to prevent automatic row 1 writing)
    worksheet.columns = [
      { key: "wbsId", width: 15 },
      { key: "parentTask", width: 25 },
      { key: "wbsName", width: 35 },
      { key: "description", width: 40 },
      { key: "level", width: 10 },
      { key: "phase", width: 20 },
      { key: "priority", width: 12 },
      { key: "status", width: 15 },
      { key: "assignedTo", width: 20 },
      { key: "estimatedHours", width: 18 },
      { key: "startDate", width: 15 },
      { key: "endDate", width: 15 },
      { key: "dependencies", width: 20 },
      { key: "progress", width: 15 },
    ];

    // 1. Add WBS Title block (merged cells A1:N1)
    worksheet.mergeCells("A1:N1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = `WORK BREAKDOWN STRUCTURE (WBS) - ${project.name.toUpperCase()}`;
    titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" }, // Navy Dark Blue
    };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    worksheet.getRow(1).height = 35;

    // 2. Add WBS Metadata block (merged cells A2:N2)
    worksheet.mergeCells("A2:N2");
    const metaCell = worksheet.getCell("A2");
    metaCell.value = `Project ID: ${project.id}   |   Client: ${project.client}   |   Manager: ${project.managerName}   |   Export Date: ${new Date().toISOString().split("T")[0]}`;
    metaCell.font = { name: "Arial", size: 10, italic: true, color: { argb: "FF1E293B" } };
    metaCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2E8F0" }, // Light slate
    };
    metaCell.alignment = { vertical: "middle", horizontal: "center" };
    worksheet.getRow(2).height = 22;

    // 3. Row 3 is blank spacer
    worksheet.getRow(3).height = 10;

    // 4. Header Row on Row 4
    const headerRow = worksheet.getRow(4);
    headerRow.values = [
      "WBS ID",
      "Parent Task",
      "WBS Name", // Renamed Task Name -> WBS Name
      "Description",
      "Level",
      "Phase",
      "Priority",
      "Status",
      "Assigned To",
      "Estimated Hours",
      "Start Date",
      "End Date",
      "Dependencies",
      "Progress (%)"
    ];
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2563EB" }, // Brand blue
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 25;

    // Freeze top 4 rows
    worksheet.views = [
      { state: "frozen", ySplit: 4, xSplit: 0, activeCell: "A5" }
    ];

    // Helper to extract phase from tags
    const getPhase = (tags: string) => {
      if (!tags) return "Default Phase";
      const match = tags.match(/phase:(.+?)(?:,|$)/);
      if (match) return match[1];
      if (tags.startsWith("phase:")) return tags.replace("phase:", "");
      return tags.split(",")[0] || "Default Phase";
    };

    // Helper to extract dependencies from tags
    const getDependencies = (tags: string) => {
      if (!tags) return "";
      const match = tags.match(/(?:dep|predecessor|parent):([T\d_]+)/i);
      if (match) return match[1];
      return "";
    };

    // Helper to calculate start date
    const getStartDate = (dueDate: string | undefined | null) => {
      if (!dueDate) return "";
      const date = new Date(dueDate);
      date.setDate(date.getDate() - 14);
      return date.toISOString().split("T")[0];
    };

    // Populate rows starting from row 5
    const sortedTasks = [...tasks].sort((a, b) => a.id.localeCompare(b.id));

    sortedTasks.forEach((t) => {
      const cleanWbsId = t.id.includes("_") ? t.id.split("_")[1] : t.id;
      const phase = getPhase(t.tags);
      const dependencies = getDependencies(t.tags);
      const startDate = getStartDate(t.dueDate);

      // Add parent task row
      const parentRow = worksheet.addRow({
        wbsId: cleanWbsId,
        parentTask: "",
        wbsName: t.title,
        description: t.isMilestone ? "Milestone Task" : "Main Task",
        level: 1,
        phase: phase,
        priority: t.priority.charAt(0).toUpperCase() + t.priority.slice(1),
        status: t.status === "todo" ? "To Do" : t.status === "inprogress" ? "In Progress" : t.status === "review" ? "In Review" : "Completed",
        assignedTo: t.assignee ? t.assignee.name : "Unassigned",
        estimatedHours: t.estimate,
        startDate: startDate,
        endDate: t.dueDate,
        dependencies: dependencies,
        progress: t.progress,
      });

      parentRow.getCell("wbsName").font = { bold: true };
      if (t.isMilestone) {
        parentRow.getCell("wbsId").font = { bold: true, color: { argb: "FF2563EB" } };
      }

      // Add subtasks
      if (t.subtasks && t.subtasks.length > 0) {
        t.subtasks.forEach((sub, subIdx) => {
          const subWbsId = `${cleanWbsId}.${subIdx + 1}`;
          const subStatus = sub.status === "Completed" ? "Completed" : sub.status === "In Progress" ? "In Progress" : "Not Started";
          const subProgress = sub.status === "Completed" ? 100 : sub.status === "In Progress" ? 50 : 0;
          const subStartDate = getStartDate(sub.dueDate || t.dueDate);

          const subRow = worksheet.addRow({
            wbsId: subWbsId,
            parentTask: t.title,
            wbsName: sub.title,
            description: sub.description || "Subtask",
            level: 2,
            phase: phase,
            priority: t.priority.charAt(0).toUpperCase() + t.priority.slice(1),
            status: subStatus,
            assignedTo: t.assignee ? t.assignee.name : "Unassigned",
            estimatedHours: "",
            startDate: subStartDate,
            endDate: sub.dueDate || t.dueDate,
            dependencies: "",
            progress: subProgress,
          });

          subRow.getCell("wbsName").font = { italic: true };
          subRow.getCell("wbsName").alignment = { indent: 1 };
        });
      }
    });

    // Apply basic cell styles (borders, alignments, zebra-striping)
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber < 4) return; // Skip title and metadata

      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };

        if (rowNumber === 4) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
        } else {
          const colKey = worksheet.columns[colNumber - 1].key;
          if (colKey && ["wbsId", "level", "priority", "status", "startDate", "endDate", "progress", "estimatedHours"].includes(colKey)) {
            cell.alignment = { vertical: "middle", horizontal: "center" };
          } else {
            cell.alignment = { vertical: "middle", horizontal: "left" };
          }
        }
      });
      
      if (rowNumber > 4) {
        const fillColor = rowNumber % 2 === 0 ? "FFF8FAFC" : "FFFFFFFF";
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: fillColor }
        };
        row.height = 20;
      }
    });

    // Auto-size columns based on values row 4 onwards
    worksheet.columns.forEach((column) => {
      let maxLen = 12; // default min width
      column.eachCell && column.eachCell({ includeEmpty: false }, (cell, rowNumber) => {
        if (rowNumber < 4) return; // Skip title and metadata block
        const valStr = cell.value ? cell.value.toString() : "";
        if (valStr.length > maxLen) {
          maxLen = valStr.length;
        }
      });
      column.width = Math.min(50, maxLen + 4);
    });

    // Write file to response stream
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=WBS_${project.id}_${project.name.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("WBS Excel export error:", error);
    return res.status(500).json({ message: "Internal server error generating WBS Excel report" });
  }
});

export default router;
