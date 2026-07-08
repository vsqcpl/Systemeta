import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const session = await prisma.punchSession.findFirst({
    where: { project: 'P891' }
  });

  if (session) {
    console.log('Reverting task for session', session.id);
    await prisma.punchSession.update({
      where: { id: session.id },
      data: { project: 'Foreign survey', task: '' }
    });
    console.log('Done!');
  } else {
    console.log('Session not found!');
  }
}

main().finally(() => prisma.$disconnect());
