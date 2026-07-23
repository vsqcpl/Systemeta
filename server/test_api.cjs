const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const ts = await prisma.timesheet.findMany({ include: { entries: true, consultant: true } });
  console.log(JSON.stringify(ts, null, 2));
}
main().finally(() => prisma.$disconnect());
