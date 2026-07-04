import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findUnique({where: {email: 'admin@vsqc.com'}});
  console.log('User:', user);
  const account = await prisma.account.findFirst({where: {userId: user?.id}});
  console.log('Account:', account);
}
main().finally(() => prisma.$disconnect());
