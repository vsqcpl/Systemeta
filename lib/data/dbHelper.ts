import fs from "fs";
import path from "path";
import crypto from "crypto";
import { NextRequest } from "next/server";

const DB_PATH = path.join(process.cwd(), "lib/data/users_db.json");

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  status: "active" | "inactive" | "Invited";
  mfa: boolean;
  last_login_at: string;
  must_change_password: boolean;
  projectIds?: string[];
  clientIds?: string[];
  clientId?: string;
  reporteeIds?: string[];
  reporteeOf?: string;
}

export interface AuditLogRecord {
  timestamp: string;
  user: string;
  action: string;
  resource: string;
  detail: string;
  ip: string;
}

export interface DbSchema {
  users: UserRecord[];
  auditLogs: AuditLogRecord[];
}

export function readDb(): DbSchema {
  if (!fs.existsSync(DB_PATH)) {
    return { users: [], auditLogs: [] };
  }
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  return JSON.parse(raw);
}

export function writeDb(data: DbSchema): void {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.warn("Could not write to users_db.json on read-only FS.");
  }
}

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function getSessionUser(req: NextRequest): UserRecord | null {
  const sessionCookie = req.cookies.get("session")?.value;
  if (!sessionCookie) return null;
  const db = readDb();
  return db.users.find((u) => u.id === sessionCookie && u.status === "active") ?? null;
}

export function writeAuditLog(actorEmail: string, action: string, targetId: string, detail: string, req?: NextRequest): void {
  const db = readDb();
  let ip = "127.0.0.1";
  if (req) {
    const forwarded = req.headers.get("x-forwarded-for");
    ip = forwarded ? forwarded.split(",")[0] : "127.0.0.1";
  }
  db.auditLogs.unshift({
    timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
    user: actorEmail,
    action,
    resource: targetId,
    detail,
    ip,
  });
  writeDb(db);
}
