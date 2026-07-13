import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const amish = await prisma.user.findFirst({
    where: { name: { contains: 'Amish', mode: 'insensitive' } }
  });

  if (!amish) {
    console.log('Amish not found');
    return;
  }

  // Look for PunchSessions related to Amish and testing
  const sessions = await prisma.punchSession.findMany({
    where: {
      consultantId: amish.id,
      OR: [
        { project: { contains: 'testing', mode: 'insensitive' } },
        { task: { contains: 'testing', mode: 'insensitive' } }
      ]
    }
  });

  if (sessions.length === 0) {
    console.log('No punch sessions found for testing');
    const allSessions = await prisma.punchSession.findMany({
        where: { consultantId: amish.id }
    });
    console.log('All Amish sessions:', allSessions);
    return;
  }

  console.log(`Found ${sessions.length} sessions.`);
  for (const session of sessions) {
      if (session.punchIn && session.punchOut) {
          const currentHours = (session.punchOut.getTime() - session.punchIn.getTime()) / (1000 * 60 * 60);
          console.log(`Session ID ${session.id}: ${currentHours} hours`);
      }
  }

  const targetSession = sessions[0];
  if (!targetSession.punchIn) {
      console.log('Session has no punchIn');
      return;
  }

  const newPunchOutTime = new Date(targetSession.punchIn.getTime() + (5.5 * 60 * 60 * 1000));

  await prisma.punchSession.update({
      where: { id: targetSession.id },
      data: { punchOut: newPunchOutTime }
  });

  console.log(`Updated Session ${targetSession.id} punchOut to ${newPunchOutTime.toISOString()} (5.5 hours).`);

  if (sessions.length > 1) {
      for (let i = 1; i < sessions.length; i++) {
          await prisma.punchSession.delete({
              where: { id: sessions[i].id }
          });
      }
      console.log(`Deleted ${sessions.length - 1} extra sessions.`);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
