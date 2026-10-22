import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

type GlobalDb = typeof globalThis & {
  __stripePaymentsPrisma?: PrismaClient;
};

const globalDb = globalThis as GlobalDb;

export function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

let prisma: PrismaClient;

if (process.env.NODE_ENV === "production") {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
} else {
  const cached = globalDb.__stripePaymentsPrisma;
  if (cached) {
    // `prisma generate` rewrites the generated module while the dev server is
    // running; Turbopack reloads it, so the cached instance ends up on the old
    // generated class and is missing newly added model delegates. Rebuild
    // whenever the class changed so schema edits pick up on hot reload.
    if (cached.constructor !== PrismaClient) {
      cached.$disconnect().catch(() => {});
      delete globalDb.__stripePaymentsPrisma;
    }
  }

  prisma =
    globalDb.__stripePaymentsPrisma ??
    new PrismaClient({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
      }),
    });

  globalDb.__stripePaymentsPrisma = prisma;
}

export { prisma };
