import { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import prisma from "../lib/prisma.js";

export interface AuthenticatedRequest extends Request {
  user?: any;
  session?: any;
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      return res.status(401).json({ message: "Unauthorized: No active session" });
    }

    if (session.session?.expiresAt && new Date(session.session.expiresAt) <= new Date()) {
      try {
        await prisma.session.delete({ where: { id: session.session.id } });
      } catch (_) {}
      return res.status(401).json({ message: "Unauthorized: Session has expired" });
    }

    // Load full user details from DB to make sure we have latest info like custom fields
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!dbUser) {
      return res.status(401).json({ message: "Unauthorized: User not found in database" });
    }

    if (dbUser.status !== "active") {
      return res.status(403).json({ message: "Forbidden: Account is inactive or invited but not yet activated" });
    }

    req.user = dbUser;
    // Normalize role to lowercase with underscores for backend compatibility (e.g., "Client Manager" -> "client_manager")
    if (req.user.role) {
      req.user.role = req.user.role.toLowerCase().replace(/[\s_]+/g, "_");
    }
    req.session = session.session;

    // Enforce first-login password reset on all protected routes
    // except for changing password route itself
    if (dbUser.mustChangePassword && !req.path.endsWith("/change-password")) {
      return res.status(403).json({
        message: "Password change required on first login",
        mustChangePassword: true,
      });
    }

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({ message: "Internal server error during authentication" });
  }
}
