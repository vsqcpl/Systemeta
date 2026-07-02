const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Expenses:");
  const expenses = await prisma.expense.findMany();
  console.log(expenses);
  console.log("\nAdmin User:");
  const admin = await prisma.user.findFirst({ where: { email: 'admin@vsqc.com' } });
  console.log(admin);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
