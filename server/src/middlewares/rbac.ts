import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth.js";
import prisma from "../lib/prisma.js";

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  "Admin Panel Access": ["super_admin"],
  "View AI Insights": ["super_admin", "client_manager", "project_manager", "senior_consultant", "consultant", "accounts"],
  "Approve Expenses": ["super_admin", "project_manager", "accounts"],
  "Approve Timesheets": ["super_admin", "project_manager", "senior_consultant"],
  "Approve Leave": ["super_admin", "project_manager", "senior_consultant"],
  "Create Projects": ["super_admin", "project_manager"],
  "Unlock Project Plans": ["super_admin", "project_manager"],
  "Emergency Project Access": ["super_admin"],
  "Cross-Project Visibility": ["super_admin"],
  "CRM Access": ["super_admin", "client_manager"],
};

export async function checkPermission(
  userId: string,
  role: string,
  permissionKey: string
): Promise<boolean> {
  const now = new Date();

  // 1. Check active override permissions first (secondary)
  const activeOverride = await prisma.permissionOverride.findFirst({
    where: {
      userId: userId,
      permissionKey: permissionKey,
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
    },
  });

  if (activeOverride !== null) {
    return activeOverride.granted; // Can be true (grant) or false (restrict)
  }

  // 2. Check default User Role Permissions (primary)
  const allowedRoles = DEFAULT_ROLE_PERMISSIONS[permissionKey] || [];
  return allowedRoles.includes(role);
}

export function requirePermission(permissionKey: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const hasAccess = await checkPermission(req.user.id, req.user.role, permissionKey);
    if (!hasAccess) {
      return res.status(403).json({ message: `Forbidden: Insufficient permissions for ${permissionKey}` });
    }

    next();
  };
}

// Basic role membership check (fallback/legacy compatibility)
export function requireRoles(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
    }

    next();
  };
}

// Verifies if the authenticated user has access to a specific project.
// Super Admin has access to all projects.
// Project Managers, Consultants, and Senior Consultants must have an assignment.
// Client Contacts must have a matching clientId in the project or matching assignments.
export async function checkProjectAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const projectId = req.params.projectId || req.body.projectId || req.query.projectId;

    if (!projectId) {
      return next(); // If no project is being accessed, skip check
    }

    // 1. Check Cross-Project Visibility override (or super_admin)
    const hasCrossProject = await checkPermission(req.user.id, req.user.role, "Cross-Project Visibility");
    if (hasCrossProject) {
      return next();
    }

    // 2. Check Emergency Project Access override
    const hasEmergencyAccess = await checkPermission(req.user.id, req.user.role, "Emergency Project Access");
    if (hasEmergencyAccess) {
      return next();
    }

    // Check project assignment
    const assignment = await prisma.projectAssignment.findFirst({
      where: {
        userId: req.user.id,
        projectId: projectId,
      },
    });

    // Special check for client contacts
    if (req.user.role === "client_contact" && req.user.clientId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });
      if (project && project.client === req.user.clientId) {
        return next();
      }
    }

    if (!assignment) {
      return res.status(403).json({
        message: "Forbidden: You do not have access to this project",
      });
    }

    next();
  } catch (error) {
    console.error("checkProjectAccess middleware error:", error);
    return res.status(500).json({ message: "Internal server error during project check" });
  }
}

