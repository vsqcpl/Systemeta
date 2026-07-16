import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@vsqc.in";
  const password = "admin123";

  console.log("Seeding database with default super_admin...");

  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Check if the admin user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!existingUser) {
    const user = await prisma.user.create({
      data: {
        name: "Super Admin",
        email: email.toLowerCase(),
        emailVerified: true,
        passwordHash: passwordHash,
        role: "super_admin",
        status: "active",
        mustChangePassword: false,
      },
    });

    // Create the corresponding Better Auth account record
    await prisma.account.create({
      data: {
        id: `account-${user.id}`,
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: passwordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log(`Successfully created default admin user: ${email}`);
  } else {
    console.log(`Admin user with email ${email} already exists.`);
  }
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
