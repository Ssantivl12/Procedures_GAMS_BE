import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient, RoleName } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
})

const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({
    adapter,
})

async function main() {
    console.log('Seeding database...');

    // 1. Seed Roles
    const roles: RoleName[] = [
        RoleName.SUPERADMIN,
        RoleName.ENCARGADO,
        RoleName.SECRETARIA,
        RoleName.INSPECTOR,
    ];

    for (const roleName of roles) {
        await prisma.role.upsert({
            where: { name: roleName },
            update: {},
            create: { name: roleName },
        });
    }
    console.log('Roles seeded.');

    // Common password for all users
    const passwordHash = await bcrypt.hash('passwds12345', 12);

    // 2. Define users to seed (one per role)
    const usersToSeed = [
        {
            email: 'superadmin@gmail.com',
            fullName: 'Super Admin User',
            roleName: RoleName.SUPERADMIN,
        },
        {
            email: 'encargado@gmail.com',
            fullName: 'Encargado User',
            roleName: RoleName.ENCARGADO,
        },
        {
            email: 'secretaria@gmail.com',
            fullName: 'Secretaria User',
            roleName: RoleName.SECRETARIA,
        },
        {
            email: 'inspector@gmail.com',
            fullName: 'Inspector User',
            roleName: RoleName.INSPECTOR,
        },
    ];

    for (const userData of usersToSeed) {
        const role = await prisma.role.findUnique({
            where: { name: userData.roleName },
        });

        if (!role) {
            console.warn(`Role ${userData.roleName} not found. Skipping user ${userData.email}.`);
            continue;
        }

        const existingUser = await prisma.user.findUnique({
            where: { email: userData.email },
        });

        if (!existingUser) {
            const newUser = await prisma.user.create({
                data: {
                    email: userData.email,
                    passwordHash: passwordHash,
                    fullName: userData.fullName,
                    isActive: true,
                },
            });

            await prisma.userRole.create({
                data: {
                    userId: newUser.id,
                    roleId: role.id,
                },
            });
            console.log(`Created user: ${userData.email} with role ${userData.roleName}`);
        } else {
            console.log(`User already exists: ${userData.email}`);
        }
    }

    console.log('Seeding completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
