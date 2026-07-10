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
