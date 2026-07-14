import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const invoice = await prisma.invoice.findFirst();
  if (!invoice) {
    console.log('No invoices found.');
    process.exit(0);
  }
  console.log('Using invoice:', invoice.id);
  
  try {
    await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: 10,
        date: new Date().toISOString().split('T')[0],
        method: 'Bank Transfer',
        recordedBy: 'Super Admin',
      }
    });
    console.log('Payment created successfully!');
  } catch (e) {
    console.error('Error creating payment:', e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
