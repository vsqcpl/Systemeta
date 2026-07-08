import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tsEntries = await prisma.timesheetEntry.findMany({
    where: {
      OR: [
        { task: { contains: 'Foreign survey', mode: 'insensitive' } },
        { projectId: { contains: 'Foreign survey', mode: 'insensitive' } }
      ]
    },
    include: { timesheet: { include: { consultant: true } } }
  });

  const punchSessions = await prisma.punchSession.findMany({
    where: {
      OR: [
        { task: { contains: 'Foreign survey', mode: 'insensitive' } },
        { project: { contains: 'Foreign survey', mode: 'insensitive' } }
      ]
    },
    include: { consultant: true }
  });

  console.log('Timesheet Entries:', JSON.stringify(tsEntries, null, 2));
  console.log('Punch Sessions:', JSON.stringify(punchSessions, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
