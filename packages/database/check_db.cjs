const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const materials = await prisma.rawMaterial.findMany({
    select: { category: true },
    distinct: ['category'],
  });
  console.log("RM Categories:", materials);

  const products = await prisma.product.findMany();
  console.log("Products:", products);
  
  const rmFinished = await prisma.rawMaterial.findMany({
    where: { category: 'FINISHED_PRODUCT' }
  });
  console.log("RM FINISHED_PRODUCT:", rmFinished);
}

main().catch(console.error).finally(() => prisma.$disconnect());
