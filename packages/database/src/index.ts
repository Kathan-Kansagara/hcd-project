import { PrismaClient } from '@prisma/client';

// Export all Prisma types
export * from '@prisma/client';

// Create singleton Prisma client instance
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Export a function to disconnect (useful for serverless)
export async function disconnectPrisma() {
  await prisma.$disconnect();
}
