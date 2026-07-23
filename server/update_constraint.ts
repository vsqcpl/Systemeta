import { PrismaClient } from '@prisma/client'; 
const prisma = new PrismaClient(); 
async function main() { 
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Task" DROP CONSTRAINT "Task_priority_check";`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Task" ADD CONSTRAINT "Task_priority_check" CHECK (priority IN ('critical', 'high', 'medium', 'low', 'none', 'None', ''));`);
    console.log("Constraint updated successfully.");
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
} 
main();
