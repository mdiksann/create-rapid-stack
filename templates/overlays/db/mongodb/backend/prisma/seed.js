import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: {
      email: "demo@example.com",
      name: "Demo User",
      posts: {
        create: [
          {
            title: "Welcome to your MongoDB stack",
            content: "Scaffolded with create-rapid-stack.",
            published: true,
          },
        ],
      },
    },
  });

  await prisma.item.create({
    data: {
      title: "First sample item",
      description: "Created by prisma/seed.js",
    },
  });

  console.log("Seeded database with user:", user.email);
}

main()
  .catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

