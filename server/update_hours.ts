import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const superAdmin = await prisma.user.findFirst({
    where: { name: 'Super Admin' }
  });

  if (!superAdmin) {
    console.log('Super Admin not found');
    return;
  }

  // Look for PunchSessions related to Super Admin and Foreign survey
  const sessions = await prisma.punchSession.findMany({
    where: {
      consultantId: superAdmin.id,
      OR: [
        { project: { contains: 'Foreign survey', mode: 'insensitive' } },
        { task: { contains: 'Foreign survey', mode: 'insensitive' } }
      ]
    }
  });

  if (sessions.length === 0) {
    console.log('No punch sessions found for Foreign survey');
    const allSessions = await prisma.punchSession.findMany({
        where: { consultantId: superAdmin.id }
    });
    console.log('All Super Admin sessions:', allSessions);
    return;
  }

  console.log(`Found ${sessions.length} sessions.`);
  for (const session of sessions) {
      if (session.punchIn && session.punchOut) {
          const currentHours = (session.punchOut.getTime() - session.punchIn.getTime()) / (1000 * 60 * 60);
          console.log(`Session ID ${session.id}: ${currentHours} hours`);
      }
  }

  // To make the total 8.5 hours, let's just update the first session's punchOut time.
  const targetSession = sessions[0];
  if (!targetSession.punchIn) {
      console.log('Session has no punchIn');
      return;
  }

  const newPunchOutTime = new Date(targetSession.punchIn.getTime() + (8.5 * 60 * 60 * 1000));

  await prisma.punchSession.update({
      where: { id: targetSession.id },
      data: { punchOut: newPunchOutTime }
  });

  console.log(`Updated Session ${targetSession.id} punchOut to ${newPunchOutTime.toISOString()} (8.5 hours).`);

  // We should also delete any other sessions for this task so it's exactly 8.5 hours total.
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
