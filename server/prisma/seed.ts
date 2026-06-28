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

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash("Admin123", saltRounds);

  console.log("Creating users...");
  const usersData = [
    { id: "U001", name: "Super Admin", email: "admin@vsqc.com", role: "super_admin", mfa: true },
    { id: "U002", name: "Senior Consultant", email: "seniorconsultant@vsqc.com", role: "senior_consultant", mfa: false },
    { id: "U003", name: "Client Manager", email: "clientmanager@vsqc.com", role: "client_manager", mfa: false },
    { id: "U004", name: "Project Manager", email: "projectmanager@vsqc.com", role: "project_manager", mfa: false },
    { id: "U005", name: "Consultant", email: "consultant@vsqc.com", role: "consultant", mfa: false },
    { id: "U006", name: "Accounts", email: "accounts@vsqc.com", role: "accounts", mfa: false },
    { id: "U007", name: "Client Contact", email: "client@vsqc.com", role: "client_contact", mfa: false },
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

  console.log("Creating CRM Clients...");
  const clientA = await prisma.client.create({
    data: {
      id: "C001",
      name: "Vanguard Group",
      industry: "Financial Services",
      website: "https://vanguard.com",
      address: "Malvern, Pennsylvania, US",
      status: "active",
      tier: "enterprise",
      createdBy: "U003",
    },
  });

  const clientB = await prisma.client.create({
    data: {
      id: "C002",
      name: "Bhau Tech",
      industry: "Technology",
      website: "https://bhautech.com",
      address: "Pune, Maharashtra, India",
      status: "active",
      tier: "standard",
      createdBy: "U003",
    },
  });

  console.log("Creating CRM Contacts...");
  await prisma.contact.create({
    data: {
      clientId: "C001",
      name: "John Doe",
      email: "johndoe@vanguard.com",
      phone: "+1-555-0199",
      role: "Fintech Manager",
      isPrimary: true,
    },
  });

  await prisma.contact.create({
    data: {
      clientId: "C002",
      name: "Bhau Patil",
      email: "bhau@bhautech.com",
      phone: "+91-9876543210",
      role: "CEO",
      isPrimary: true,
    },
  });

  console.log("Creating Projects...");
  await prisma.project.create({
    data: {
      id: "P001",
      name: "Enterprise Cloud Migration",
      client: "Vanguard Group",
      status: "active",
      health: "on-track",
      progress: 60,
      budget: 500000,
      spent: 120000,
      dueDate: "2026-08-15",
      managerName: "Project Manager",
      priority: "high",
      type: "Cloud",
    },
  });

  await prisma.project.create({
    data: {
      id: "P002",
      name: "ERP Implementation Phase 1",
      client: "Vanguard Group",
      status: "active",
      health: "at-risk",
      progress: 40,
      budget: 1000000,
      spent: 400000,
      dueDate: "2026-07-01",
      managerName: "Super Admin",
      priority: "high",
      type: "Transformation",
    },
  });

  await prisma.project.create({
    data: {
      id: "P003",
      name: "Security Audit Demo",
      client: "Bhau Tech",
      status: "active",
      health: "on-track",
      progress: 15,
      budget: 350000,
      spent: 50000,
      dueDate: "2026-06-30",
      managerName: "Senior Consultant",
      priority: "medium",
      type: "Security",
    },
  });

  console.log("Creating Project Assignments...");
  const assignments = [
    { userId: "U001", projectId: "P002" },
    { userId: "U002", projectId: "P003" },
    { userId: "U002", projectId: "P002" },
    { userId: "U002", projectId: "P001" },
    { userId: "U004", projectId: "P001" },
    { userId: "U005", projectId: "P002" },
  ];
  for (const a of assignments) {
    await prisma.projectAssignment.create({ data: a });
  }

  console.log("Creating Tasks (with scheduling conflicts)...");
  await prisma.task.create({
    data: {
      id: "T001",
      title: "Database Migration Schema Design",
      projectId: "P002",
      assigneeId: "U002",
      priority: "high",
      dueDate: "2026-06-25",
      estimate: 10,
      progress: 50,
      status: "inprogress",
      tags: "Database, Migration",
    },
  });

  await prisma.task.create({
    data: {
      id: "T002",
      title: "AWS IAM Security Mapping",
      projectId: "P001",
      assigneeId: "U002",
      priority: "high",
      dueDate: "2026-06-26",
      estimate: 8,
      progress: 30,
      status: "inprogress",
      tags: "Security, AWS",
    },
  });

  await prisma.task.create({
    data: {
      id: "T003",
      title: "React Component Optimization",
      projectId: "P002",
      assigneeId: "U005",
      priority: "medium",
      dueDate: "2026-06-25",
      estimate: 12,
      progress: 40,
      status: "inprogress",
      tags: "Frontend, Optimization",
    },
  });

  await prisma.task.create({
    data: {
      id: "T004",
      title: "Write API Unit Tests",
      projectId: "P002",
      assigneeId: "U005",
      priority: "low",
      dueDate: "2026-06-25",
      estimate: 6,
      progress: 10,
      status: "inprogress",
      tags: "Testing, API",
    },
  });

  console.log("Creating Milestones...");
  await prisma.milestone.create({
    data: {
      id: "M001",
      projectId: "P001",
      title: "Cloud Infrastructure Setup",
      date: "2026-07-10",
      status: "upcoming",
      amount: 100000,
    },
  });

  await prisma.milestone.create({
    data: {
      id: "M002",
      projectId: "P002",
      title: "ERP Architecture Approval",
      date: "2026-06-28",
      status: "delayed",
      amount: 250000,
    },
  });

  await prisma.milestone.create({
    data: {
      id: "M003",
      projectId: "P003",
      title: "Initial Vulnerability Scan",
      date: "2026-06-30",
      status: "upcoming",
      amount: 50000,
    },
  });

  console.log("Creating Leave Requests...");
  const leaves = [
    { id: "L001", consultantId: "U002", type: "Annual Leave", start: "2026-07-05", end: "2026-07-07", days: 3, status: "pending", reason: "Family vacation" },
    { id: "L002", consultantId: "U005", type: "Sick Leave", start: "2026-06-24", end: "2026-06-26", days: 3, status: "pending", reason: "High fever" },
  ];
  for (const l of leaves) {
    await prisma.leaveRequest.create({ data: l });
  }

  console.log("Creating Expenses...");
  await prisma.expense.create({
    data: {
      id: "E001",
      consultantId: "U002",
      projectId: "P001",
      category: "Travel",
      description: "Flight tickets to client site",
      amount: 24500,
      currency: "INR",
      date: "2026-06-22",
      status: "pending",
      receipt: "https://rjkvifpgwuluctgbocxr.supabase.co/storage/v1/object/public/receipts/expenses/receipt.pdf",
    },
  });

  console.log("Creating CRM Meetings & Opportunities...");
  await prisma.meeting.create({
    data: {
      clientId: "C001",
      organizedBy: "U003",
      title: "ERP Requirements Alignment",
      agenda: "Align on phase 1 timeline and resource availability",
      notes: "Discussed budget adjustments",
      platform: "teams",
      status: "scheduled",
      scheduledAt: new Date(Date.now() + 86400000),
    },
  });

  await prisma.opportunity.create({
    data: {
      clientId: "C001",
      title: "Cloud Migration Phase 2",
      value: 750000,
      stage: "proposal",
      probability: 70,
      ownedBy: "U003",
      expectedClose: new Date(Date.now() + 30 * 86400000),
    },
  });

  console.log("Database seeded successfully with rich test data!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
