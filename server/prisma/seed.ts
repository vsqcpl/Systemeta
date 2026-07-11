import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database with full production-ready test data...");

  // Clean existing data
  await prisma.permissionOverride.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.aIInsight.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.timesheetEntry.deleteMany();
  await prisma.timesheet.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.subtask.deleteMany();
  await prisma.task.deleteMany();
  await prisma.projectAssignment.deleteMany();
  await prisma.project.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();

  // CRM tables
  await prisma.contact.deleteMany();
  await prisma.call.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.followUp.deleteMany();
  await prisma.requirement.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.escalation.deleteMany();
  await prisma.client.deleteMany();

  await prisma.user.deleteMany();

  const saltRounds = 12;
  const passwordHash = await bcrypt.hash("Admin123", saltRounds);

  console.log("Creating users...");
  const usersData = [
    { id: "U001", name: "Super Admin", email: "admin@vsqc.com", role: "super_admin", mfa: true, clientId: null },
    { id: "U002", name: "Senior Consultant", email: "seniorconsultant@vsqc.com", role: "senior_consultant", mfa: false, clientId: null },
    { id: "U003", name: "Client Manager", email: "clientmanager@vsqc.com", role: "client_manager", mfa: false, clientId: null },
    { id: "U004", name: "Project Manager", email: "projectmanager@vsqc.com", role: "project_manager", mfa: false, clientId: null },
    { id: "U005", name: "Consultant", email: "consultant@vsqc.com", role: "consultant", mfa: false, clientId: null },
    { id: "U006", name: "Accounts", email: "accounts@vsqc.com", role: "accounts", mfa: false, clientId: null },
    { id: "U007", name: "Client Contact", email: "client@vsqc.com", role: "client_contact", mfa: false, clientId: "Global Tech Corp" },
  ];

  for (const u of usersData) {
    await prisma.user.create({
      data: {
        id: u.id,
        name: u.name,
        email: u.email,
        passwordHash,
        role: u.role,
        status: "active",
        mfa: u.mfa,
        mustChangePassword: false,
        clientId: u.clientId,
      },
    });

    await prisma.account.create({
      data: {
        id: `account-${u.id}`,
        accountId: u.id,
        providerId: "credential",
        userId: u.id,
        password: passwordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  console.log("Creating clients...");
  await prisma.client.createMany({
    data: [
      { id: "C001", name: "Global Tech Corp", industry: "Technology", website: "https://globaltech.com", address: "123 Innovation Way, San Jose, CA", status: "active", tier: "enterprise", createdBy: "U003" },
      { id: "C002", name: "Apex Retail", industry: "Retail", website: "https://apexretail.com", address: "456 Commerce Blvd, Chicago, IL", status: "active", tier: "premium", createdBy: "U003" },
      { id: "C003", name: "Aero Industries", industry: "Aerospace", website: "https://aeroind.com", address: "789 Jetstream Rd, Seattle, WA", status: "active", tier: "standard", createdBy: "U003" },
    ],
  });

  console.log("Creating contacts...");
  await prisma.contact.create({
    data: {
      id: "CT001",
      clientId: "C001",
      name: "Sarah Jenkins",
      email: "client@vsqc.com",
      phone: "555-0199",
      role: "IT Director",
      isPrimary: true,
    },
  });

  console.log("Creating projects...");
  await prisma.project.createMany({
    data: [
      { id: "P001", name: "Cloud ERP Migration", client: "Global Tech Corp", status: "active", health: "on-track", progress: 65, budget: 150000.0, spent: 95000.0, dueDate: "2026-10-15", managerName: "Project Manager", priority: "high", type: "Transformation" },
      { id: "P002", name: "Security Audit & Hardening", client: "Apex Retail", status: "active", health: "at-risk", progress: 40, budget: 75000.0, spent: 45000.0, dueDate: "2026-08-30", managerName: "Senior Consultant", priority: "critical", type: "Security" },
      { id: "P003", name: "AI Supply Chain Analytics", client: "Aero Industries", status: "planning", health: "on-track", progress: 10, budget: 200000.0, spent: 15000.0, dueDate: "2026-12-20", managerName: "Project Manager", priority: "medium", type: "Data" },
      { id: "P004", name: "CRM Implementation", client: "Global Tech Corp", status: "completed", health: "on-track", progress: 100, budget: 90000.0, spent: 88000.0, dueDate: "2026-06-01", managerName: "Project Manager", priority: "medium", type: "Transformation" },
    ],
  });

  console.log("Creating project assignments...");
  await prisma.projectAssignment.createMany({
    data: [
      { userId: "U001", projectId: "P001" },
      { userId: "U004", projectId: "P001" },
      { userId: "U005", projectId: "P001" },
      { userId: "U002", projectId: "P002" },
      { userId: "U005", projectId: "P002" },
      { userId: "U004", projectId: "P003" },
      { userId: "U002", projectId: "P003" },
      { userId: "U007", projectId: "P001" },
    ],
  });

  console.log("Creating tasks...");
  await prisma.task.createMany({
    data: [
      { id: "T001", title: "Assess Existing ERP Architecture", projectId: "P001", assigneeId: "U005", priority: "high", dueDate: "2026-07-25", estimate: 40, progress: 100, status: "done", tags: "ERP,Architecture" },
      { id: "T002", title: "Configure Cloud Environments", projectId: "P001", assigneeId: "U005", priority: "high", dueDate: "2026-08-10", estimate: 60, progress: 50, status: "inprogress", tags: "Cloud,DevOps" },
      { id: "T003", title: "Data Migration Scripting", projectId: "P001", assigneeId: "U004", priority: "medium", dueDate: "2026-08-20", estimate: 80, progress: 10, status: "todo", tags: "Data" },
      { id: "T004", title: "Penetration Testing", projectId: "P002", assigneeId: "U002", priority: "critical", dueDate: "2026-07-05", estimate: 30, progress: 80, status: "inprogress", tags: "Security,PenTest" },
      { id: "T005", title: "Remediation Plan Approval", projectId: "P002", assigneeId: "U002", priority: "high", dueDate: "2026-07-20", estimate: 15, progress: 0, status: "todo", tags: "Compliance" },
      { id: "T006", title: "Baseline Requirements Gathering", projectId: "P003", assigneeId: "U004", priority: "medium", dueDate: "2026-08-01", estimate: 40, progress: 20, status: "inprogress", tags: "Requirements" },
    ],
  });

  console.log("Creating milestones...");
  await prisma.milestone.createMany({
    data: [
      { id: "M001", projectId: "P001", title: "Initial Assessment & Architecture Design", date: "2026-07-30", status: "upcoming", amount: 30000.0 },
      { id: "M002", projectId: "P001", title: "Data Migration & Config Completed", date: "2026-09-15", status: "upcoming", amount: 50000.0 },
      { id: "M003", projectId: "P002", title: "Security Vulnerability Report Deliverable", date: "2026-07-15", status: "at-risk", amount: 25000.0 },
    ],
  });

  console.log("Creating invoices...");
  await prisma.invoice.createMany({
    data: [
      { id: "I001", projectId: "P004", client: "Global Tech Corp", amount: 45000.0, status: "paid", issued: "2026-05-01", due: "2026-05-31", paid: "2026-05-28" },
      { id: "I002", projectId: "P004", client: "Global Tech Corp", amount: 45000.0, status: "paid", issued: "2026-06-01", due: "2026-06-30", paid: "2026-06-15" },
      { id: "I003", projectId: "P001", client: "Global Tech Corp", amount: 30000.0, status: "outstanding", issued: "2026-07-01", due: "2026-07-31" },
    ],
  });

  console.log("Creating timesheets...");
  const ts1 = await prisma.timesheet.create({
    data: {
      id: "TS001",
      consultantId: "U005",
      week: "2026-07-06",
    },
  });

  await prisma.timesheetEntry.createMany({
    data: [
      { timesheetId: ts1.id, day: 1, projectId: "P001", task: "Assess Existing ERP Architecture", hours: 8.0, billable: true },
      { timesheetId: ts1.id, day: 2, projectId: "P001", task: "Assess Existing ERP Architecture", hours: 8.0, billable: true },
      { timesheetId: ts1.id, day: 3, projectId: "P001", task: "Configure Cloud Environments", hours: 8.0, billable: true },
      { timesheetId: ts1.id, day: 4, projectId: "P001", task: "Configure Cloud Environments", hours: 8.0, billable: true },
      { timesheetId: ts1.id, day: 5, projectId: "P001", task: "Configure Cloud Environments", hours: 8.0, billable: true },
    ],
  });

  const ts2 = await prisma.timesheet.create({
    data: {
      id: "TS002",
      consultantId: "U004",
      week: "2026-07-06",
    },
  });

  await prisma.timesheetEntry.createMany({
    data: [
      { timesheetId: ts2.id, day: 1, projectId: "P001", task: "Project Management", hours: 4.0, billable: true },
      { timesheetId: ts2.id, day: 2, projectId: "P001", task: "Project Management", hours: 4.0, billable: true },
      { timesheetId: ts2.id, day: 3, projectId: "P001", task: "Project Management", hours: 4.0, billable: true },
      { timesheetId: ts2.id, day: 4, projectId: "P001", task: "Project Management", hours: 4.0, billable: true },
      { timesheetId: ts2.id, day: 5, projectId: "P001", task: "Project Management", hours: 4.0, billable: true },
    ],
  });

  console.log("Creating AI Insights...");
  await prisma.aIInsight.createMany({
    data: [
      { id: "AI001", type: "risk", severity: "high", title: "Schedule Delay Risk", description: 'Security Audit & Hardening (P002) has a critical task "Penetration Testing" that is overdue by 6 days.', action: "Allocate additional consultant hours to speed up testing." },
      { id: "AI002", type: "resource", severity: "medium", title: "Underutilization Detected", description: "Senior Consultant is currently allocated at 40% compared to target 80% this month.", action: "Assign to AI Supply Chain Analytics (P003) project which is starting soon." },
    ],
  });

  console.log("Creating Activities...");
  await prisma.activity.createMany({
    data: [
      { userId: "U004", action: "Created project", subject: "AI Supply Chain Analytics", projectId: "P003", type: "task" },
      { userId: "U005", action: "Submitted timesheet", subject: "Week of July 6", projectId: "P001", type: "timesheet" },
    ],
  });

  console.log("Database seeded successfully with default users!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
