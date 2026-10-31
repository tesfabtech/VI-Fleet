import "dotenv/config";
import { prisma } from "./lib/prisma";

async function main() {
  const result = await prisma.$queryRaw<
    { current_database: string; current_user: string }[]
  >`
    SELECT
      current_database() AS current_database,
      current_user AS current_user
  `;

  console.log("Database connection successful:", result);
}

main()
  .catch((error) => {
    console.error("Database connection failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
