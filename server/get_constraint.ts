import { PrismaClient } from '@prisma/client'; 
const prisma = new PrismaClient(); 
async function main() { 
  const res = await prisma.$queryRaw`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'Task_priority_check'`; 
  console.log(res); 
} 
main();
