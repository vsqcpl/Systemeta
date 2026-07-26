import dotenv from "dotenv";
dotenv.config();

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./dev.db";
}

import { PrismaClient } from "@prisma/client";

const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
});

export default prisma;
