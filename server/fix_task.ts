import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const session = await prisma.punchSession.findFirst({
    where: { project: 'Foreign survey' }
  });

  if (session) {
    console.log('Updating task for session', session.id);
    await prisma.punchSession.update({
      where: { id: session.id },
      data: { task: 'Foreign survey', project: 'P891' }
    });
    console.log('Done!');
  } else {
    console.log('Session not found!');
  }
}

main().finally(() => prisma.$disconnect());
