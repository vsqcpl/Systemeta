import { Prisma } from "@prisma/client";
import prisma from "./prisma.js";

interface AuditLogOptions {
  userEmail: string;
  action: string;
  resource: string;
  detail: string;
  ip: string;
}

export async function logAuditEvent(
  { userEmail, action, resource, detail, ip }: AuditLogOptions,
  tx?: Prisma.TransactionClient
) {
  try {
    const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);
    const client = tx || prisma;
    
    // Save to Database
    const log = await client.auditLog.create({
      data: {
        timestamp,
        userEmail,
        action,
        resource,
        detail,
        ip,
      },
    });

    // Structured JSON log to stdout
    console.log(JSON.stringify({
      logType: "AUDIT",
      id: log.id,
      timestamp,
      userEmail,
      action,
      resource,
      detail,
      ip,
    }));

    return log;
  } catch (error) {
    console.error("Centralized Audit Logger failed:", error);
  }
}
