import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient, ProcedureTypeCode, RoleName } from '@prisma/client';
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
            firstName: 'Super',
            lastName: 'Admin',
            roleName: RoleName.SUPERADMIN,
        },
        {
            email: 'encargado@gmail.com',
            firstName: 'Encargado',
            lastName: 'User',
            roleName: RoleName.ENCARGADO,
        },
        {
            email: 'secretaria@gmail.com',
            firstName: 'Secretaria',
            lastName: 'User',
            roleName: RoleName.SECRETARIA,
        },
        {
            email: 'inspector@gmail.com',
            firstName: 'Inspector',
            lastName: 'User',
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
                    firstName: userData.firstName,
                    lastName: userData.lastName,
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

    // 3. Seed ProcedureTypes
    const procedureTypes = [
        {
            code: ProcedureTypeCode.RAI,
            name: 'Registro Ambiental Industrial',
            allowsObservations: true,
            allowsReentry: true,
        },
        {
            code: ProcedureTypeCode.MAI_PMA,
            name: 'Manifiesto Ambiental Industrial / Plan de Manejo',
            allowsObservations: true,
            allowsReentry: true,
        },
        {
            code: ProcedureTypeCode.IAA,
            name: 'Informe Ambiental Anual',
            allowsObservations: true,
            allowsReentry: true,
        },
        {
            code: ProcedureTypeCode.CIERRE,
            name: 'Plan de Cierre / Abandono',
            allowsObservations: false,
            allowsReentry: false,
        },
    ];

    for (const pt of procedureTypes) {
        await prisma.procedureType.upsert({
            where: { code: pt.code },
            update: { name: pt.name, allowsObservations: pt.allowsObservations, allowsReentry: pt.allowsReentry },
            create: pt,
        });
    }
    console.log('ProcedureTypes seeded.');

    // 4. Seed DeadlineConfig
    const deadlineConfigs = [
        { procedureType: ProcedureTypeCode.RAI,     cycleNumber: 0, deadlineDays: 5,  description: 'RAI — primera revisión (5 días hábiles)' },
        { procedureType: ProcedureTypeCode.RAI,     cycleNumber: 1, deadlineDays: 10, description: 'RAI — revisión de reingresos (10 días hábiles)' },
        { procedureType: ProcedureTypeCode.MAI_PMA, cycleNumber: 0, deadlineDays: 15, description: 'MAI_PMA — primera revisión (15 días hábiles)' },
        { procedureType: ProcedureTypeCode.MAI_PMA, cycleNumber: 1, deadlineDays: 15, description: 'MAI_PMA — revisión de reingresos (15 días hábiles)' },
        { procedureType: ProcedureTypeCode.IAA,     cycleNumber: 0, deadlineDays: 10, description: 'IAA — primera revisión (10 días hábiles)' },
        { procedureType: ProcedureTypeCode.IAA,     cycleNumber: 1, deadlineDays: 10, description: 'IAA — revisión de reingresos (10 días hábiles)' },
        { procedureType: ProcedureTypeCode.CIERRE,  cycleNumber: 0, deadlineDays: 10, description: 'Cierre/Abandono — única revisión (10 días hábiles)' },
    ];

    for (const dc of deadlineConfigs) {
        await prisma.deadlineConfig.upsert({
            where: { procedureType_cycleNumber: { procedureType: dc.procedureType, cycleNumber: dc.cycleNumber } },
            update: { deadlineDays: dc.deadlineDays, description: dc.description },
            create: dc,
        });
    }
    console.log('DeadlineConfig seeded.');

    // 5. Seed NonWorkingDays (Bolivia 2025 — stable national holidays)
    const nonWorkingDays2025 = [
        { date: '2025-01-01', description: 'Año Nuevo',                                   type: 'NACIONAL' },
        { date: '2025-01-22', description: 'Fundación del Estado Plurinacional',           type: 'NACIONAL' },
        { date: '2025-03-03', description: 'Lunes de Carnaval',                            type: 'NACIONAL' },
        { date: '2025-03-04', description: 'Martes de Carnaval',                           type: 'NACIONAL' },
        { date: '2025-04-18', description: 'Viernes Santo',                                type: 'NACIONAL' },
        { date: '2025-05-01', description: 'Día del Trabajo',                              type: 'NACIONAL' },
        { date: '2025-06-19', description: 'Corpus Christi',                               type: 'NACIONAL' },
        { date: '2025-06-21', description: 'Año Nuevo Aymara',                             type: 'NACIONAL' },
        { date: '2025-08-06', description: 'Día de la Independencia',                      type: 'NACIONAL' },
        { date: '2025-09-14', description: 'Día del Departamento de Cochabamba',           type: 'DEPARTAMENTAL' },
        { date: '2025-11-02', description: 'Día de Difuntos',                              type: 'NACIONAL' },
        { date: '2025-12-25', description: 'Navidad',                                      type: 'NACIONAL' },
    ];

    for (const nwd of nonWorkingDays2025) {
        const date = new Date(nwd.date);
        await prisma.nonWorkingDay.upsert({
            where: { date },
            update: { description: nwd.description, type: nwd.type },
            create: { date, description: nwd.description, type: nwd.type, createdBy: 'seed' },
        });
    }
    console.log('NonWorkingDays 2025 seeded.');

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
