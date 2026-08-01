import { PrismaClient } from '@prisma/client'; 

const prisma = new PrismaClient(); 

async function main() { 
  try {
    console.log("Starting Subtask database schema check and constraint update...");
    // Add assignees column if not exists
    await prisma.$executeRawUnsafe(`ALTER TABLE "Subtask" ADD COLUMN IF NOT EXISTS "assignees" TEXT[] DEFAULT '{}';`);
    console.log("Verified 'assignees' column on Subtask table.");

    // Drop existing status check constraint
    await prisma.$executeRawUnsafe(`ALTER TABLE "Subtask" DROP CONSTRAINT IF EXISTS "Subtask_status_check";`);
    
    // Add updated check constraint allowing new statuses
    await prisma.$executeRawUnsafe(`ALTER TABLE "Subtask" ADD CONSTRAINT "Subtask_status_check" CHECK ("status" IN ('Not Started', 'To Do', 'In Progress', 'In Review', 'Done', 'Completed'));`);
    console.log("Subtask_status_check constraint updated successfully to permit To Do, In Progress, In Review, and Done.");
  } catch (e) {
    console.error("Error migrating Subtask constraints:", e);
  } finally {
    await prisma.$disconnect();
  }
} 

main();
