import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const invoice = await prisma.invoice.findFirst();
  if (!invoice) return console.log("No invoice found");
  console.log("Invoice ID:", invoice.id);
  
  try {
    const payment = await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: 100,
        date: new Date().toISOString().split('T')[0],
        method: "Bank Transfer",
        recordedBy: "Test Script"
      }
    });
    console.log("Payment created:", payment.id);
  } catch (e: any) {
    console.error("Error creating payment:", e);
  }
}
main().finally(() => prisma.$disconnect());
