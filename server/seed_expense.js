const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function seed() {
  const user = await prisma.user.findFirst();
  const project = await prisma.project.findFirst();
  if (!user || !project) {
    console.log("No user or project found");
    return;
  }
  const exp = await prisma.expense.create({
    data: {
      consultantId: user.id,
      projectId: project.id,
      category: "Travel",
      description: "Flight to client site",
      amount: 15000,
      currency: "INR",
      date: "2026-06-15",
      status: "approved",
      reimbursementStage: "Pending",
      receipt: "receipt_001.pdf"
    }
  });
  console.log("Seeded expense:", exp.id);
}
seed().catch(console.error).finally(() => prisma.$disconnect());
