import 'dotenv/config';
import { PrismaClient, AdminPosition } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import * as bcrypt from 'bcryptjs';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const email = 'admin@nuvylux.com';
  const password = 'Password';
  const hashedPassword = await bcrypt.hash(password, 10);

  // Upsert the admin user
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      password: hashedPassword,
      firstName: 'Nuvylux',
      lastName: 'Admin',
      username: 'admin',
      role: 'ADMINISTRATOR',
      onboardingCompleted: true,
      emailVerified: true,
    },
  });

  // Upsert the admin record
  await prisma.admin.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      position: AdminPosition.SUPER_ADMIN,
    },
  });

  console.log(`Seeded admin user: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
