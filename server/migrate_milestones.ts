import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Checking and adding columns to Milestone and Invoice...");
    await prisma.$executeRawUnsafe(`ALTER TABLE "Milestone" ADD COLUMN IF NOT EXISTS "description" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Milestone" ADD COLUMN IF NOT EXISTS "taskId" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "lineItems" TEXT;`);

    console.log("Updating check constraints for Milestone and Invoice status...");
    await prisma.$executeRawUnsafe(`ALTER TABLE "Milestone" DROP CONSTRAINT IF EXISTS "Milestone_status_check";`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_status_check" CHECK (status IN ('upcoming', 'pending', 'Pending', 'Invoice Generated', 'at-risk', 'at_risk', 'delayed', 'completed', 'Completed', 'paid', 'Paid', 'active', 'in-progress', 'in_progress', 'cancelled', 'on-hold', 'Not Started', 'In Progress', 'Achieved', 'achieved', 'Invoiced', 'invoiced'));`);
    console.log("Database schema migration completed successfully.");
  } catch (e) {
    console.error("Migration error:", e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
