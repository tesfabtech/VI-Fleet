
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set in the environment.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function readHidden(prompt: string): Promise<string> {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    throw new Error(
      "Hidden password input requires an interactive terminal. Run this script directly in PowerShell."
    );
  }

  stdout.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();

  return new Promise((resolve, reject) => {
    let value = "";
    let settled = false;

    const cleanup = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdout.write("\n");
    };

    const onData = (chunk: Buffer) => {
      const key = chunk.toString("utf8");

      if (key === "\u0003") {
        settled = true;
        cleanup();
        reject(new Error("Cancelled by user."));
        return;
      }

      if (key === "\r" || key === "\n") {
        settled = true;
        cleanup();
        resolve(value);
        return;
      }

      if (key === "\u007f" || key === "\b") {
        value = value.slice(0, -1);
        return;
      }

      if (key >= " " && key !== "\u001b") {
        value += key;
      }
    };

    stdin.on("data", onData);

    // Avoid leaving the terminal in raw mode if input is interrupted.
    stdin.once("end", () => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error("Input ended before the password was entered."));
      }
    });
  });
}


async function main() {
  const terminal = createInterface({ input: stdin, output: stdout });

  let firstName: string;
  let middleName: string;
  let lastName: string;
  let email: string;

  try {
    firstName = (
      await terminal.question("Your name: ")
    ).trim();

    middleName = (
      await terminal.question("Father's name: ")
    ).trim();

    lastName = (
      await terminal.question("Grandfather's name: ")
    ).trim();

    email = (
      await terminal.question("Administrator email address: ")
    ).trim().toLowerCase();
  } finally {
    terminal.close();
  }

  for (const [label, value] of [
    ["Your name", firstName],
    ["Father's name", middleName],
    ["Grandfather's name", lastName],
  ]) {
    if (!value || value.length > 150) {
      throw new Error(
        `${label} is required and must be at most 150 characters.`
      );
    }
  }

  if (
    email.length > 255 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error("Enter a valid email address.");
  }

  const password = await readHidden("Create administrator password: ");

  if (password.length < 12) {
    throw new Error("Use a password with at least 12 characters.");
  }

  const confirmation = await readHidden("Confirm password: ");

  if (password !== confirmation) {
    throw new Error("Passwords do not match.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('LOCK TABLE "users" IN EXCLUSIVE MODE');

    const existingAdmin = await tx.user.findFirst({
      where: { role: "SYSTEM_ADMINISTRATOR" },
      select: { id: true },
    });

    if (existingAdmin) {
      throw new Error(
        "A system administrator already exists. Bootstrap aborted."
      );
    }

    return tx.user.create({
      data: {
        firstName,
        middleName,
        lastName,
        email,
        passwordHash,
        role: "SYSTEM_ADMINISTRATOR",
        status: "ACTIVE",
        organizationId: null,
        departmentId: null,
      },
      select: {
        id: true,
        firstName: true,
        middleName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
      },
    });
  });

  console.log("\nInitial system administrator created successfully.");
  console.log(`ID: ${admin.id}`);
  console.log(
    `Name: ${admin.firstName} ${admin.middleName} ${admin.lastName}`
  );
  console.log(`Email: ${admin.email}`);
  console.log(`Role: ${admin.role}`);
  console.log(`Status: ${admin.status}`);
}




main()
  .catch((error: unknown) => {
    console.error(
      "Bootstrap failed:",
      error instanceof Error ? error.message : "Unexpected error."
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
