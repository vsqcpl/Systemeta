import { PrismaClient } from '@prisma/client'; 
const prisma = new PrismaClient(); 

async function main() { 
  try {
    console.log("Updating Invoice status check constraint...");
    await prisma.$executeRawUnsafe(`ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_status_check";`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_status_check" CHECK (status IN ('draft', 'pending', 'issued', 'partially_paid', 'paid', 'outstanding', 'overdue', 'cancelled', 'refunded'));`);
    console.log("Invoice status constraint updated successfully.");

    console.log("Updating Milestone status check constraint...");
    await prisma.$executeRawUnsafe(`ALTER TABLE "Milestone" DROP CONSTRAINT IF EXISTS "Milestone_status_check";`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_status_check" CHECK (status IN ('upcoming', 'pending', 'Pending', 'Invoice Generated', 'at-risk', 'at_risk', 'delayed', 'completed', 'Completed', 'paid', 'Paid', 'active', 'in-progress', 'in_progress', 'cancelled', 'on-hold', 'Not Started', 'In Progress'));`);
    console.log("Milestone status constraint updated successfully.");
  } catch (e) {
    console.error("Error updating database constraints:", e);
  } finally {
    await prisma.$disconnect();
  }
} 

main();
