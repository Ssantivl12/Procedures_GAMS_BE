import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import {
  PrismaClient,
  ProcedureTypeCode,
  RoleName,
  CompanyCategory,
  ProcedureKind,
  ProcedureStatus,
  DocumentGroup,
  ObservationCategory,
  ObservationPriority,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding database...');

  // ── 1. Roles ──────────────────────────────────────────────────────────────
  const roleNames: RoleName[] = [RoleName.SUPERADMIN, RoleName.ENCARGADO, RoleName.SECRETARIA, RoleName.INSPECTOR];
  for (const name of roleNames) {
    await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log('Roles seeded.');

  // ── 2. Users ───────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('passwds12345', 12);

  const usersData = [
    { email: 'superadmin@gmail.com',  firstName: 'Super',    lastName: 'Admin',    role: RoleName.SUPERADMIN },
    { email: 'encargado@gmail.com',   firstName: 'Carlos',   lastName: 'Encargado',role: RoleName.ENCARGADO },
    { email: 'encargado2@gams.bo',    firstName: 'María',    lastName: 'Vargas',   role: RoleName.ENCARGADO },
    { email: 'secretaria@gmail.com',  firstName: 'Lucía',    lastName: 'Peredo',   role: RoleName.SECRETARIA },
    { email: 'secretaria2@gams.bo',   firstName: 'Rosa',     lastName: 'Mercado',  role: RoleName.SECRETARIA },
    { email: 'inspector@gmail.com',   firstName: 'Carlos',   lastName: 'Mamani',   role: RoleName.INSPECTOR },
    { email: 'inspector2@gams.bo',    firstName: 'Patricia', lastName: 'Quispe',   role: RoleName.INSPECTOR },
    { email: 'inspector3@gams.bo',    firstName: 'Roberto',  lastName: 'Flores',   role: RoleName.INSPECTOR },
    { email: 'inspector4@gams.bo',    firstName: 'Ana',      lastName: 'Condori',  role: RoleName.INSPECTOR },
    { email: 'inspector5@gams.bo',    firstName: 'Miguel',   lastName: 'Torrez',   role: RoleName.INSPECTOR },
  ];

  const U: Record<string, any> = {};
  for (const u of usersData) {
    const roleRec = await prisma.role.findUnique({ where: { name: u.role } });
    let user = await prisma.user.findUnique({ where: { email: u.email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email: u.email, passwordHash, firstName: u.firstName, lastName: u.lastName, isActive: true },
      });
      await prisma.userRole.create({ data: { userId: user.id, roleId: roleRec!.id } });
      console.log(`  Created user: ${u.email}`);
    }
    U[u.email] = user;
  }
  const enc1 = U['encargado@gmail.com'];
  const enc2 = U['encargado2@gams.bo'];
  const sec1 = U['secretaria@gmail.com'];
  const sec2 = U['secretaria2@gams.bo'];
  const ins1 = U['inspector@gmail.com'];
  const ins2 = U['inspector2@gams.bo'];
  const ins3 = U['inspector3@gams.bo'];
  const ins4 = U['inspector4@gams.bo'];
  const ins5 = U['inspector5@gams.bo'];
  console.log('Users seeded.');

  // ── 3. ProcedureTypes ─────────────────────────────────────────────────────
  const procedureTypes = [
    { code: ProcedureTypeCode.RAI,     name: 'Registro Ambiental Industrial', allowsObservations: true, allowsReentry: true },
    { code: ProcedureTypeCode.MAI_PMA, name: 'Manifiesto Ambiental Industrial / Plan de Manejo', allowsObservations: true, allowsReentry: true },
    { code: ProcedureTypeCode.IAA,     name: 'Informe Ambiental Anual', allowsObservations: true, allowsReentry: true },
    { code: ProcedureTypeCode.CIERRE,  name: 'Plan de Cierre / Abandono', allowsObservations: false, allowsReentry: false },
  ];
  for (const pt of procedureTypes) {
    await prisma.procedureType.upsert({ where: { code: pt.code }, update: pt, create: pt });
  }
  const ptAll = await prisma.procedureType.findMany();
  const PT: Record<string, any> = {};
  for (const pt of ptAll) PT[pt.code] = pt;
  console.log('ProcedureTypes seeded.');

  // ── 4. DeadlineConfig ─────────────────────────────────────────────────────
  const deadlineConfigs = [
    { procedureType: ProcedureTypeCode.RAI,     cycleNumber: 0, deadlineDays: 5,  description: 'Revisión inicial' },
    { procedureType: ProcedureTypeCode.RAI,     cycleNumber: 1, deadlineDays: 10, description: 'Revisión de subsanación' },
    { procedureType: ProcedureTypeCode.MAI_PMA, cycleNumber: 0, deadlineDays: 15, description: 'Revisión inicial' },
    { procedureType: ProcedureTypeCode.MAI_PMA, cycleNumber: 1, deadlineDays: 15, description: 'Revisión de subsanación' },
    { procedureType: ProcedureTypeCode.IAA,     cycleNumber: 0, deadlineDays: 10, description: 'Revisión inicial' },
    { procedureType: ProcedureTypeCode.IAA,     cycleNumber: 1, deadlineDays: 10, description: 'Revisión de subsanación' },
    { procedureType: ProcedureTypeCode.CIERRE,  cycleNumber: 0, deadlineDays: 10, description: 'Revisión única del plan' },
  ];
  for (const dc of deadlineConfigs) {
    await prisma.deadlineConfig.upsert({
      where: { procedureType_cycleNumber: { procedureType: dc.procedureType, cycleNumber: dc.cycleNumber } },
      update: { deadlineDays: dc.deadlineDays, description: dc.description },
      create: dc,
    });
  }
  console.log('DeadlineConfig seeded.');

  // ── 5. NonWorkingDays 2025 + 2026 ─────────────────────────────────────────
  const holidays = [
    { date: '2025-01-01', description: 'Año Nuevo',                               type: 'NACIONAL' },
    { date: '2025-01-22', description: 'Fundación del Estado Plurinacional',      type: 'NACIONAL' },
    { date: '2025-03-03', description: 'Lunes de Carnaval',                       type: 'NACIONAL' },
    { date: '2025-03-04', description: 'Martes de Carnaval',                      type: 'NACIONAL' },
    { date: '2025-04-18', description: 'Viernes Santo',                           type: 'NACIONAL' },
    { date: '2025-05-01', description: 'Día del Trabajo',                         type: 'NACIONAL' },
    { date: '2025-06-19', description: 'Corpus Christi',                          type: 'NACIONAL' },
    { date: '2025-06-21', description: 'Año Nuevo Aymara',                        type: 'NACIONAL' },
    { date: '2025-08-06', description: 'Día de la Independencia',                 type: 'NACIONAL' },
    { date: '2025-09-14', description: 'Día del Departamento de Cochabamba',      type: 'DEPARTAMENTAL' },
    { date: '2025-11-02', description: 'Día de Difuntos',                         type: 'NACIONAL' },
    { date: '2025-12-25', description: 'Navidad',                                 type: 'NACIONAL' },
    { date: '2026-01-01', description: 'Año Nuevo',                               type: 'NACIONAL' },
    { date: '2026-01-22', description: 'Fundación del Estado Plurinacional',      type: 'NACIONAL' },
    { date: '2026-02-16', description: 'Lunes de Carnaval',                       type: 'NACIONAL' },
    { date: '2026-02-17', description: 'Martes de Carnaval',                      type: 'NACIONAL' },
    { date: '2026-04-03', description: 'Viernes Santo',                           type: 'NACIONAL' },
    { date: '2026-05-01', description: 'Día del Trabajo',                         type: 'NACIONAL' },
    { date: '2026-06-04', description: 'Corpus Christi',                          type: 'NACIONAL' },
    { date: '2026-06-21', description: 'Año Nuevo Aymara',                        type: 'NACIONAL' },
    { date: '2026-08-06', description: 'Día de la Independencia',                 type: 'NACIONAL' },
    { date: '2026-09-14', description: 'Día del Departamento de Cochabamba',      type: 'DEPARTAMENTAL' },
    { date: '2026-11-02', description: 'Día de Difuntos',                         type: 'NACIONAL' },
    { date: '2026-12-25', description: 'Navidad',                                 type: 'NACIONAL' },
  ];
  for (const h of holidays) {
    const date = new Date(`${h.date}T00:00:00Z`);
    await prisma.nonWorkingDay.upsert({
      where: { date },
      update: { description: h.description, type: h.type },
      create: { date, description: h.description, type: h.type, createdBy: 'seed' },
    });
  }
  console.log('NonWorkingDays seeded (2025–2026).');

  // ── 6. Companies + CaseFiles ───────────────────────────────────────────────
  type CompanySeed = {
    legalName: string; nit?: string; raiNumber?: string;
    category: CompanyCategory; address?: string; phone?: string;
    email?: string; legalRepName?: string; legalRepCi?: string;
    caebCodes: string[]; economicActivity?: string; municipality?: string;
    caseCode: string; fileNumber: string;
  };

  const companiesData: CompanySeed[] = [
    {
      legalName: 'Cervecería Nacional S.A.', nit: '1001234567', raiNumber: 'RAI-CBB-2021-001',
      category: CompanyCategory.C4, address: 'Av. Circunvalación Km. 3, Cochabamba',
      phone: '4-4521367', email: 'ambiental@cerveceria.com.bo',
      legalRepName: 'Jorge Suárez Rojas', legalRepCi: '3456789',
      caebCodes: ['1103'], economicActivity: 'Elaboración de cerveza', municipality: 'Cercado',
      caseCode: 'EXP-CBB-2021-001', fileNumber: 'GAMS-001-2021',
    },
    {
      legalName: 'Textiles del Sur S.R.L.', nit: '1007654321',
      category: CompanyCategory.C3, address: 'Zona Industrial Norte, Lote 45, Cochabamba',
      phone: '4-4612890', email: 'info@textilesdelsur.bo',
      legalRepName: 'Carmen Vidal López', legalRepCi: '5678901',
      caebCodes: ['1711', '1712'], economicActivity: 'Fabricación de textiles de algodón', municipality: 'Quillacollo',
      caseCode: 'EXP-CBB-2022-015', fileNumber: 'GAMS-015-2022',
    },
    {
      legalName: 'Industrias Plásticas Andinas Ltda.', nit: '1009876543', raiNumber: 'RAI-CBB-2020-033',
      category: CompanyCategory.C4, address: 'Parque Industrial Cochabamba, Calle 3 Nro. 12',
      phone: '4-4498712', email: 'medioambiente@plasticasandinas.bo',
      legalRepName: 'Álvaro Mendoza Rivas', legalRepCi: '6789012',
      caebCodes: ['2520'], economicActivity: 'Fabricación de productos plásticos', municipality: 'Sacaba',
      caseCode: 'EXP-CBB-2020-033', fileNumber: 'GAMS-033-2020',
    },
    {
      legalName: 'Frigorífico Los Andes S.A.', nit: '1002345678',
      category: CompanyCategory.C3, address: 'Km. 8 Carretera a Santa Cruz, Cochabamba',
      phone: '4-4335521', email: 'gerencia@frigorifico-losandes.bo',
      legalRepName: 'Roberto Mamani Choque', legalRepCi: '7890123',
      caebCodes: ['1511'], economicActivity: 'Producción, procesamiento y conservación de carne', municipality: 'Cercado',
      caseCode: 'EXP-CBB-2023-007', fileNumber: 'GAMS-007-2023',
    },
    {
      legalName: 'Pinturas Unidas Bolivia S.R.L.', nit: '1003456789', raiNumber: 'RAI-CBB-2019-008',
      category: CompanyCategory.C3, address: 'Av. Blanco Galindo Km. 5, Cochabamba',
      phone: '4-4412678', email: 'ambiental@pinturasunidas.bo',
      legalRepName: 'Elena Quiroga Saavedra', legalRepCi: '8901234',
      caebCodes: ['2422'], economicActivity: 'Fabricación de pinturas y barnices', municipality: 'Quillacollo',
      caseCode: 'EXP-CBB-2019-008', fileNumber: 'GAMS-008-2019',
    },
    {
      legalName: 'Cemento Andino S.A.', nit: '1004567890', raiNumber: 'RAI-CBB-2018-002',
      category: CompanyCategory.C4, address: 'Zona Industrial Vinto',
      phone: '2-5291456', email: 'ma@cementoandino.bo',
      legalRepName: 'Gustavo Ferrufino Bernal', legalRepCi: '9012345',
      caebCodes: ['2694'], economicActivity: 'Fabricación de cemento, cal y yeso', municipality: 'Vinto',
      caseCode: 'EXP-CBB-2018-002', fileNumber: 'GAMS-002-2018',
    },
    {
      legalName: 'Curtiembre El Cóndor S.R.L.', nit: '1005678901',
      category: CompanyCategory.C3, address: 'Barrio Temporal, Av. República Nro. 234, Cochabamba',
      phone: '4-4556123', email: 'curtiembre.condor@hotmail.com',
      legalRepName: 'Pedro Quispe Huanca', legalRepCi: '4567890',
      caebCodes: ['1911'], economicActivity: 'Curtido y terminación de cueros', municipality: 'Cercado',
      caseCode: 'EXP-CBB-2023-021', fileNumber: 'GAMS-021-2023',
    },
    {
      legalName: 'Agroindustrias Cochabamba S.A.', nit: '1008901234', raiNumber: 'RAI-CBB-2022-009',
      category: CompanyCategory.C4, address: 'Km. 12 Carretera a Oruro, Cochabamba',
      phone: '4-4611234', email: 'medioambiente@agroindustrias.bo',
      legalRepName: 'Sandra Torrico Alvarado', legalRepCi: '3210987',
      caebCodes: ['1512', '1521'], economicActivity: 'Elaboración y conservación de frutas y hortalizas', municipality: 'Sipe Sipe',
      caseCode: 'EXP-CBB-2022-009', fileNumber: 'GAMS-009-2022',
    },
    {
      legalName: 'Laboratorios Farmacéuticos Bolivia S.A.', nit: '1000123456', raiNumber: 'RAI-CBB-2020-017',
      category: CompanyCategory.C4, address: 'Parque Industrial, Calle 7 Nro. 89, Cochabamba',
      phone: '4-4489012', email: 'regulatorio@labfarma.bo',
      legalRepName: 'Marco Antezana Pedraza', legalRepCi: '2345678',
      caebCodes: ['2423'], economicActivity: 'Fabricación de productos farmacéuticos', municipality: 'Sacaba',
      caseCode: 'EXP-CBB-2020-017', fileNumber: 'GAMS-017-2020',
    },
    {
      legalName: 'Metalmecánica Oruro S.R.L.', nit: '1001357924',
      category: CompanyCategory.C3, address: 'Zona Industrial Oruro, Calle Metalúrgica Nro. 56',
      phone: '2-5281233', email: 'gerencia@metalmecanica-oruro.bo',
      legalRepName: 'Víctor Escalera Chávez', legalRepCi: '1234567',
      caebCodes: ['2891'], economicActivity: 'Fabricación de productos metálicos estructurales', municipality: 'Cercado',
      caseCode: 'EXP-CBB-2023-042', fileNumber: 'GAMS-042-2023',
    },
    {
      legalName: 'Ladrillera y Cerámica Andina S.R.L.', nit: '1002468135',
      category: CompanyCategory.C3, address: 'Comunidad Linde, Municipio de Tiquipaya',
      phone: '4-4412039', email: 'ladrillera.andina@gmail.com',
      legalRepName: 'Nilda Condori Apaza', legalRepCi: '8765432',
      caebCodes: ['2691'], economicActivity: 'Fabricación de cerámica no refractaria', municipality: 'Tiquipaya',
      caseCode: 'EXP-CBB-2024-003', fileNumber: 'GAMS-003-2024',
    },
    {
      legalName: 'Embotelladora Andina S.A.', nit: '1006543210', raiNumber: 'RAI-CBB-2017-005',
      category: CompanyCategory.C4, address: 'Av. Petrolera Km. 4.5, Cochabamba',
      phone: '4-4378901', email: 'ambiente@embotelladora-andina.bo',
      legalRepName: 'Rodrigo Balcázar Nunes', legalRepCi: '9876543',
      caebCodes: ['1554'], economicActivity: 'Elaboración de bebidas no alcohólicas', municipality: 'Cercado',
      caseCode: 'EXP-CBB-2017-005', fileNumber: 'GAMS-005-2017',
    },
  ];

  const CF: Record<string, any> = {};
  for (const cd of companiesData) {
    const { caseCode, fileNumber, ...fields } = cd;
    let company = await prisma.company.findFirst({ where: { legalName: fields.legalName } });
    if (!company) {
      company = await prisma.company.create({ data: fields });
      console.log(`  Created company: ${cd.legalName}`);
    }
    let caseFile = await prisma.caseFile.findUnique({ where: { companyId: company.id } });
    if (!caseFile) {
      caseFile = await prisma.caseFile.create({ data: { companyId: company.id, code: caseCode, fileNumber } });
    }
    CF[cd.legalName] = caseFile;
  }
  console.log('Companies and CaseFiles seeded.');

  // ── helpers ────────────────────────────────────────────────────────────────
  async function mkProcedure(opts: {
    company: string; ptCode: ProcedureTypeCode; kind: ProcedureKind;
    status: ProcedureStatus; cycleCount: number;
    receptionDate: Date; reviewStartDate?: Date; deadlineDate?: Date; obsPickedDate?: Date;
    routeSheetNumber: string; internalFileNumber?: string;
    inspector?: any; createdBy: any;
    generalNotes?: string; isOverdue?: boolean;
    approvalDate?: Date; approvalCertificate?: string; expirationDate?: Date;
    abandonReason?: string; closedAt?: Date;
  }) {
    const existing = await prisma.procedure.findFirst({ where: { routeSheetNumber: opts.routeSheetNumber } });
    if (existing) return existing;
    return prisma.procedure.create({
      data: {
        caseFileId: CF[opts.company].id,
        procedureTypeId: PT[opts.ptCode].id,
        procedureKind: opts.kind,
        currentStatus: opts.status,
        cycleCount: opts.cycleCount,
        receptionDate: opts.receptionDate,
        reviewStartDate: opts.reviewStartDate ?? null,
        deadlineDate: opts.deadlineDate ?? null,
        obsPickedDate: opts.obsPickedDate ?? null,
        routeSheetNumber: opts.routeSheetNumber,
        internalFileNumber: opts.internalFileNumber ?? null,
        generalNotes: opts.generalNotes ?? null,
        isOverdue: opts.isOverdue ?? false,
        assignedInspectorUserId: opts.inspector?.id ?? null,
        createdByUserId: opts.createdBy.id,
        approvalDate: opts.approvalDate ?? null,
        approvalCertificate: opts.approvalCertificate ?? null,
        expirationDate: opts.expirationDate ?? null,
        abandonReason: opts.abandonReason ?? null,
        closedAt: opts.closedAt ?? null,
      },
    });
  }

  async function mkCycle(procedureId: string, cycleNumber: number, opts: {
    openedAt?: Date; closedAt?: Date; note?: string;
    reentryDate?: Date; reviewDeadline?: Date;
  }) {
    return prisma.procedureCycle.upsert({
      where: { procedureId_cycleNumber: { procedureId, cycleNumber } },
      update: {},
      create: {
        procedureId, cycleNumber,
        openedAt: opts.openedAt ?? new Date(),
        closedAt: opts.closedAt ?? null,
        note: opts.note ?? null,
        reentryDate: opts.reentryDate ?? null,
        reviewDeadline: opts.reviewDeadline ?? null,
      },
    });
  }

  async function mkAudit(procedureId: string, from: ProcedureStatus | null, to: ProcedureStatus, by: any, at: Date, note?: string) {
    const exists = await prisma.procedureAudit.findFirst({ where: { procedureId, toStatus: to, changedAt: at } });
    if (!exists) {
      await prisma.procedureAudit.create({
        data: { procedureId, fromStatus: from, toStatus: to, changedByUserId: by.id, changedAt: at, note: note ?? null },
      });
    }
  }

  async function mkObs(opts: {
    procedureId: string; cycleId?: string;
    summary: string; details?: string;
    category: ObservationCategory; priority: ObservationPriority;
    issuedByUserId: string; issuedAt: Date;
    isResolved?: boolean; resolvedByUserId?: string; resolvedAt?: Date; resolutionNote?: string;
  }) {
    return prisma.observation.create({
      data: {
        procedureId: opts.procedureId, cycleId: opts.cycleId ?? null,
        summary: opts.summary, details: opts.details ?? null,
        category: opts.category, priority: opts.priority,
        issuedByUserId: opts.issuedByUserId, issuedAt: opts.issuedAt,
        isResolved: opts.isResolved ?? false,
        resolvedByUserId: opts.resolvedByUserId ?? null,
        resolvedAt: opts.resolvedAt ?? null,
        resolutionNote: opts.resolutionNote ?? null,
      },
    });
  }

  async function mkDoc(opts: {
    procedureId: string; cycleId?: string; docGroup: DocumentGroup;
    fileName: string; storageKey: string; mimeType: string; fileSize: bigint;
    description: string; uploadedByUserId: string; uploadedAt: Date; version?: number;
  }) {
    const v = opts.version ?? 1;
    const exists = await prisma.document.findFirst({
      where: { procedureId: opts.procedureId, docGroup: opts.docGroup, version: v },
    });
    if (!exists) {
      await prisma.document.create({
        data: {
          procedureId: opts.procedureId, cycleId: opts.cycleId ?? null,
          docGroup: opts.docGroup, fileName: opts.fileName, storageKey: opts.storageKey,
          mimeType: opts.mimeType, fileSize: opts.fileSize, description: opts.description,
          uploadedByUserId: opts.uploadedByUserId, uploadedAt: opts.uploadedAt, version: v,
        },
      });
    }
  }

  // ── 7. Procedures ──────────────────────────────────────────────────────────
  // RECIBIDO (3)
  const p1 = await mkProcedure({
    company: 'Ladrillera y Cerámica Andina S.R.L.', ptCode: ProcedureTypeCode.RAI, kind: ProcedureKind.NUEVO,
    status: ProcedureStatus.RECIBIDO, cycleCount: 0,
    receptionDate: new Date('2026-03-15'),
    routeSheetNumber: 'HR-2026-0312', internalFileNumber: 'EXP-INT-2026-001',
    createdBy: sec1, generalNotes: 'Expediente recibido completo según checklist.',
  });
  const p2 = await mkProcedure({
    company: 'Metalmecánica Oruro S.R.L.', ptCode: ProcedureTypeCode.MAI_PMA, kind: ProcedureKind.NUEVO,
    status: ProcedureStatus.RECIBIDO, cycleCount: 0,
    receptionDate: new Date('2026-03-18'),
    routeSheetNumber: 'HR-2026-0318', internalFileNumber: 'EXP-INT-2026-002',
    createdBy: sec2,
  });
  await mkProcedure({
    company: 'Curtiembre El Cóndor S.R.L.', ptCode: ProcedureTypeCode.IAA, kind: ProcedureKind.NUEVO,
    status: ProcedureStatus.RECIBIDO, cycleCount: 0,
    receptionDate: new Date('2026-03-19'),
    routeSheetNumber: 'HR-2026-0319', internalFileNumber: 'EXP-INT-2026-003',
    createdBy: sec1, generalNotes: 'Pendiente asignación de inspector.',
  });

  // EN_REVISION (3)
  const p4 = await mkProcedure({
    company: 'Frigorífico Los Andes S.A.', ptCode: ProcedureTypeCode.RAI, kind: ProcedureKind.NUEVO,
    status: ProcedureStatus.EN_REVISION, cycleCount: 0,
    receptionDate: new Date('2026-02-20'), reviewStartDate: new Date('2026-02-25'), deadlineDate: new Date('2026-03-05'),
    routeSheetNumber: 'HR-2026-0245', internalFileNumber: 'EXP-INT-2026-004',
    inspector: ins2, createdBy: sec1, isOverdue: true,
    generalNotes: 'En revisión técnica. Plazo vencido por complejidad del expediente.',
  });
  const p5 = await mkProcedure({
    company: 'Textiles del Sur S.R.L.', ptCode: ProcedureTypeCode.MAI_PMA, kind: ProcedureKind.NUEVO,
    status: ProcedureStatus.EN_REVISION, cycleCount: 0,
    receptionDate: new Date('2026-03-01'), reviewStartDate: new Date('2026-03-05'), deadlineDate: new Date('2026-03-26'),
    routeSheetNumber: 'HR-2026-0278', internalFileNumber: 'EXP-INT-2026-005',
    inspector: ins3, createdBy: sec2,
  });
  const p6 = await mkProcedure({
    company: 'Laboratorios Farmacéuticos Bolivia S.A.', ptCode: ProcedureTypeCode.IAA, kind: ProcedureKind.NUEVO,
    status: ProcedureStatus.EN_REVISION, cycleCount: 1,
    receptionDate: new Date('2026-01-15'), reviewStartDate: new Date('2026-02-20'), deadlineDate: new Date('2026-03-10'),
    routeSheetNumber: 'HR-2026-0156', internalFileNumber: 'EXP-INT-2026-006',
    inspector: ins1, createdBy: sec1, isOverdue: true,
    generalNotes: 'Segunda revisión tras subsanación de observaciones documentales.',
  });

  // OBSERVADO_PENDIENTE_RECOJO (2)
  const p7 = await mkProcedure({
    company: 'Pinturas Unidas Bolivia S.R.L.', ptCode: ProcedureTypeCode.RAI, kind: ProcedureKind.RENOVACION,
    status: ProcedureStatus.OBSERVADO_PENDIENTE_RECOJO, cycleCount: 0,
    receptionDate: new Date('2026-01-10'), reviewStartDate: new Date('2026-01-15'), deadlineDate: new Date('2026-01-22'),
    routeSheetNumber: 'HR-2026-0089', internalFileNumber: 'EXP-INT-2026-007',
    inspector: ins4, createdBy: sec2,
    generalNotes: 'Observaciones emitidas. Empresa debe recoger carta de observación.',
  });
  const p8 = await mkProcedure({
    company: 'Agroindustrias Cochabamba S.A.', ptCode: ProcedureTypeCode.MAI_PMA, kind: ProcedureKind.NUEVO,
    status: ProcedureStatus.OBSERVADO_PENDIENTE_RECOJO, cycleCount: 0,
    receptionDate: new Date('2026-02-01'), reviewStartDate: new Date('2026-02-06'), deadlineDate: new Date('2026-02-27'),
    routeSheetNumber: 'HR-2026-0201', internalFileNumber: 'EXP-INT-2026-008',
    inspector: ins5, createdBy: sec1,
  });

  // SUBSANACION_PENDIENTE_REINGRESO (2)
  const p9 = await mkProcedure({
    company: 'Industrias Plásticas Andinas Ltda.', ptCode: ProcedureTypeCode.RAI, kind: ProcedureKind.RENOVACION,
    status: ProcedureStatus.SUBSANACION_PENDIENTE_REINGRESO, cycleCount: 1,
    receptionDate: new Date('2025-11-10'), reviewStartDate: new Date('2025-11-15'), obsPickedDate: new Date('2025-11-28'),
    routeSheetNumber: 'HR-2025-1102', internalFileNumber: 'EXP-INT-2025-089',
    inspector: ins2, createdBy: sec1,
    generalNotes: 'Empresa recogió carta de observación el 28/11/2025. Pendiente reingreso.',
  });
  const p10 = await mkProcedure({
    company: 'Cemento Andino S.A.', ptCode: ProcedureTypeCode.MAI_PMA, kind: ProcedureKind.RENOVACION,
    status: ProcedureStatus.SUBSANACION_PENDIENTE_REINGRESO, cycleCount: 1,
    receptionDate: new Date('2025-12-05'), reviewStartDate: new Date('2025-12-10'), obsPickedDate: new Date('2025-12-30'),
    routeSheetNumber: 'HR-2025-1198', internalFileNumber: 'EXP-INT-2025-098',
    inspector: ins3, createdBy: sec2,
    generalNotes: 'Observaciones técnicas recogidas. En espera de reingreso con subsanaciones.',
  });

  // CERRADO (4)
  const p11 = await mkProcedure({
    company: 'Cervecería Nacional S.A.', ptCode: ProcedureTypeCode.RAI, kind: ProcedureKind.RENOVACION,
    status: ProcedureStatus.CERRADO, cycleCount: 0,
    receptionDate: new Date('2025-09-01'), reviewStartDate: new Date('2025-09-05'), deadlineDate: new Date('2025-09-12'),
    routeSheetNumber: 'HR-2025-0891', internalFileNumber: 'EXP-INT-2025-067',
    inspector: ins1, createdBy: sec1,
    approvalDate: new Date('2025-09-10'), approvalCertificate: 'CERT-RAI-2025-001',
    expirationDate: new Date('2027-09-10'), closedAt: new Date('2025-09-10T14:30:00Z'),
  });
  const p12 = await mkProcedure({
    company: 'Embotelladora Andina S.A.', ptCode: ProcedureTypeCode.IAA, kind: ProcedureKind.NUEVO,
    status: ProcedureStatus.CERRADO, cycleCount: 1,
    receptionDate: new Date('2025-07-10'), reviewStartDate: new Date('2025-07-16'), obsPickedDate: new Date('2025-07-30'),
    routeSheetNumber: 'HR-2025-0712', internalFileNumber: 'EXP-INT-2025-052',
    inspector: ins4, createdBy: sec2,
    approvalDate: new Date('2025-09-05'), approvalCertificate: 'CERT-IAA-2025-014',
    expirationDate: new Date('2026-09-05'), closedAt: new Date('2025-09-05T11:00:00Z'),
    generalNotes: 'Aprobado tras subsanación de observaciones documentales.',
  });
  const p13 = await mkProcedure({
    company: 'Laboratorios Farmacéuticos Bolivia S.A.', ptCode: ProcedureTypeCode.MAI_PMA, kind: ProcedureKind.NUEVO,
    status: ProcedureStatus.CERRADO, cycleCount: 0,
    receptionDate: new Date('2025-05-05'), reviewStartDate: new Date('2025-05-10'), deadlineDate: new Date('2025-05-30'),
    routeSheetNumber: 'HR-2025-0498', internalFileNumber: 'EXP-INT-2025-038',
    inspector: ins1, createdBy: sec1,
    approvalDate: new Date('2025-05-25'), approvalCertificate: 'CERT-MAI-2025-008',
    closedAt: new Date('2025-05-25T09:00:00Z'),
  });
  const p14 = await mkProcedure({
    company: 'Cemento Andino S.A.', ptCode: ProcedureTypeCode.CIERRE, kind: ProcedureKind.NUEVO,
    status: ProcedureStatus.CERRADO, cycleCount: 0,
    receptionDate: new Date('2025-03-01'), reviewStartDate: new Date('2025-03-06'), deadlineDate: new Date('2025-03-18'),
    routeSheetNumber: 'HR-2025-0289', internalFileNumber: 'EXP-INT-2025-021',
    inspector: ins3, createdBy: sec2,
    approvalDate: new Date('2025-03-15'), approvalCertificate: 'CERT-CIERRE-2025-001',
    closedAt: new Date('2025-03-15T16:45:00Z'),
    generalNotes: 'Plan de cierre para sección de molienda aprobado.',
  });

  // ABANDONADO (2)
  const p15 = await mkProcedure({
    company: 'Curtiembre El Cóndor S.R.L.', ptCode: ProcedureTypeCode.MAI_PMA, kind: ProcedureKind.NUEVO,
    status: ProcedureStatus.ABANDONADO, cycleCount: 1,
    receptionDate: new Date('2025-04-10'), reviewStartDate: new Date('2025-04-15'), obsPickedDate: new Date('2025-05-02'),
    routeSheetNumber: 'HR-2025-0401', internalFileNumber: 'EXP-INT-2025-029',
    inspector: ins5, createdBy: sec1,
    abandonReason: 'Empresa no realizó reingreso en el plazo máximo de 30 días hábiles.',
    closedAt: new Date('2025-06-02T08:00:00Z'),
  });
  const p16 = await mkProcedure({
    company: 'Textiles del Sur S.R.L.', ptCode: ProcedureTypeCode.IAA, kind: ProcedureKind.NUEVO,
    status: ProcedureStatus.ABANDONADO, cycleCount: 0,
    receptionDate: new Date('2025-08-20'), reviewStartDate: new Date('2025-08-25'),
    routeSheetNumber: 'HR-2025-0823', internalFileNumber: 'EXP-INT-2025-060',
    inspector: ins2, createdBy: sec2,
    abandonReason: 'Empresa solicitó desistimiento voluntario del trámite.',
    closedAt: new Date('2025-09-01T10:00:00Z'),
  });
  console.log('Procedures seeded (16 total).');

  // ── 8. ProcedureCycles ────────────────────────────────────────────────────
  // p6 — IAA en revisión ciclo 1
  const p6c0 = await mkCycle(p6.id, 0, { openedAt: new Date('2026-01-15'), closedAt: new Date('2026-02-10'), reviewDeadline: new Date('2026-01-28'), note: 'Ciclo inicial cerrado por observaciones.' });
  await mkCycle(p6.id, 1, { openedAt: new Date('2026-02-18'), reentryDate: new Date('2026-02-18'), reviewDeadline: new Date('2026-03-10') });
  // p7 — OBSERVADO
  const p7c0 = await mkCycle(p7.id, 0, { openedAt: new Date('2026-01-15'), reviewDeadline: new Date('2026-01-22') });
  // p8 — OBSERVADO
  const p8c0 = await mkCycle(p8.id, 0, { openedAt: new Date('2026-02-06'), reviewDeadline: new Date('2026-02-27') });
  // p9 — SUBSANACION
  const p9c0 = await mkCycle(p9.id, 0, { openedAt: new Date('2025-11-15'), closedAt: new Date('2025-11-28'), reviewDeadline: new Date('2025-11-24'), note: 'Ciclo inicial. Se emitió carta de observaciones.' });
  await mkCycle(p9.id, 1, { openedAt: new Date('2025-11-28'), note: 'Esperando reingreso con subsanaciones.' });
  // p10 — SUBSANACION
  const p10c0 = await mkCycle(p10.id, 0, { openedAt: new Date('2025-12-10'), closedAt: new Date('2025-12-30'), reviewDeadline: new Date('2025-12-28') });
  await mkCycle(p10.id, 1, { openedAt: new Date('2025-12-30') });
  // p12 — CERRADO ciclo completo
  const p12c0 = await mkCycle(p12.id, 0, { openedAt: new Date('2025-07-16'), closedAt: new Date('2025-07-30'), reviewDeadline: new Date('2025-07-28'), note: 'Ciclo inicial con observaciones documentales.' });
  const p12c1 = await mkCycle(p12.id, 1, { openedAt: new Date('2025-08-15'), closedAt: new Date('2025-09-05'), reentryDate: new Date('2025-08-15'), reviewDeadline: new Date('2025-09-01'), note: 'Reingreso con correcciones. Aprobado.' });
  // p15 — ABANDONADO
  const p15c0 = await mkCycle(p15.id, 0, { openedAt: new Date('2025-04-15'), closedAt: new Date('2025-05-02'), reviewDeadline: new Date('2025-05-01') });
  await mkCycle(p15.id, 1, { openedAt: new Date('2025-05-02'), closedAt: new Date('2025-06-02') });
  console.log('ProcedureCycles seeded.');

  // ── 9. ProcedureAudits ────────────────────────────────────────────────────
  const R = ProcedureStatus.RECIBIDO, ER = ProcedureStatus.EN_REVISION,
        OPR = ProcedureStatus.OBSERVADO_PENDIENTE_RECOJO,
        SPR = ProcedureStatus.SUBSANACION_PENDIENTE_REINGRESO,
        C = ProcedureStatus.CERRADO, AB = ProcedureStatus.ABANDONADO;

  await mkAudit(p4.id, null, R,  sec1, new Date('2026-02-20T09:00:00Z'));
  await mkAudit(p4.id, R,   ER,  enc1, new Date('2026-02-25T10:00:00Z'), 'Asignado a inspectora Patricia Quispe.');

  await mkAudit(p7.id, null, R,  sec2, new Date('2026-01-10T08:30:00Z'));
  await mkAudit(p7.id, R,   ER,  enc1, new Date('2026-01-15T09:00:00Z'));
  await mkAudit(p7.id, ER,  OPR, ins4, new Date('2026-01-22T14:00:00Z'), 'Se emitieron 3 observaciones técnicas y documentales.');

  await mkAudit(p9.id, null, R,  sec1, new Date('2025-11-10T08:00:00Z'));
  await mkAudit(p9.id, R,   ER,  enc2, new Date('2025-11-15T09:30:00Z'));
  await mkAudit(p9.id, ER,  OPR, ins2, new Date('2025-11-24T11:00:00Z'), 'Observaciones emitidas.');
  await mkAudit(p9.id, OPR, SPR, ins2, new Date('2025-11-28T10:00:00Z'), 'Empresa recogió carta de observaciones.');

  await mkAudit(p10.id, null, R,  sec2, new Date('2025-12-05T08:00:00Z'));
  await mkAudit(p10.id, R,   ER,  enc1, new Date('2025-12-10T09:00:00Z'));
  await mkAudit(p10.id, ER,  OPR, ins3, new Date('2025-12-28T14:30:00Z'), 'Observaciones técnicas emitidas.');
  await mkAudit(p10.id, OPR, SPR, ins3, new Date('2025-12-30T09:00:00Z'));

  await mkAudit(p11.id, null, R,  sec1, new Date('2025-09-01T08:00:00Z'));
  await mkAudit(p11.id, R,   ER,  enc1, new Date('2025-09-05T09:00:00Z'));
  await mkAudit(p11.id, ER,  C,   ins1, new Date('2025-09-10T14:30:00Z'), 'Aprobado sin observaciones. RAI renovado.');

  await mkAudit(p12.id, null, R,  sec2, new Date('2025-07-10T08:00:00Z'));
  await mkAudit(p12.id, R,   ER,  enc2, new Date('2025-07-16T09:00:00Z'));
  await mkAudit(p12.id, ER,  OPR, ins4, new Date('2025-07-28T15:00:00Z'), 'Observaciones documentales emitidas.');
  await mkAudit(p12.id, OPR, SPR, ins4, new Date('2025-08-05T10:00:00Z'));
  await mkAudit(p12.id, SPR, ER,  sec2, new Date('2025-08-15T09:00:00Z'), 'Reingreso recibido con subsanaciones.');
  await mkAudit(p12.id, ER,  C,   ins4, new Date('2025-09-05T11:00:00Z'), 'Subsanaciones aceptadas. IAA aprobado.');

  await mkAudit(p13.id, null, R,  sec1, new Date('2025-05-05T08:00:00Z'));
  await mkAudit(p13.id, R,   ER,  enc1, new Date('2025-05-10T09:00:00Z'));
  await mkAudit(p13.id, ER,  C,   ins1, new Date('2025-05-25T09:00:00Z'), 'MAI/PMA aprobado en primera revisión.');

  await mkAudit(p14.id, null, R,  sec2, new Date('2025-03-01T08:00:00Z'));
  await mkAudit(p14.id, R,   ER,  enc2, new Date('2025-03-06T09:00:00Z'));
  await mkAudit(p14.id, ER,  C,   ins3, new Date('2025-03-15T16:45:00Z'), 'Plan de Cierre aprobado.');

  await mkAudit(p15.id, null, R,  sec1, new Date('2025-04-10T08:00:00Z'));
  await mkAudit(p15.id, R,   ER,  enc1, new Date('2025-04-15T09:00:00Z'));
  await mkAudit(p15.id, ER,  OPR, ins5, new Date('2025-05-01T14:00:00Z'), 'Observaciones críticas emitidas.');
  await mkAudit(p15.id, OPR, SPR, ins5, new Date('2025-05-02T10:00:00Z'));
  await mkAudit(p15.id, SPR, AB,  enc2, new Date('2025-06-02T08:00:00Z'), 'Plazo de reingreso vencido sin presentación.');

  await mkAudit(p16.id, null, R,  sec2, new Date('2025-08-20T08:00:00Z'));
  await mkAudit(p16.id, R,   ER,  enc1, new Date('2025-08-25T09:00:00Z'));
  await mkAudit(p16.id, ER,  AB,  enc1, new Date('2025-09-01T10:00:00Z'), 'Empresa solicitó desistimiento voluntario.');
  console.log('ProcedureAudits seeded.');

  // ── 10. Observations ──────────────────────────────────────────────────────
  // p7 – Pinturas – OBSERVADO (3 obs sin resolver)
  if (await prisma.observation.count({ where: { procedureId: p7.id } }) === 0) {
    await mkObs({ procedureId: p7.id, cycleId: p7c0.id, category: ObservationCategory.TECNICA, priority: ObservationPriority.ALTA, issuedByUserId: ins4.id, issuedAt: new Date('2026-01-22T13:00:00Z'), summary: 'Plan de Monitoreo incompleto', details: 'El PMA no incluye parámetros para control de emisiones de COVs conforme al Reglamento de Contaminación Atmosférica (DS 24176, Anexo 7).' });
    await mkObs({ procedureId: p7.id, cycleId: p7c0.id, category: ObservationCategory.DOCUMENTAL, priority: ObservationPriority.MEDIA, issuedByUserId: ins4.id, issuedAt: new Date('2026-01-22T13:15:00Z'), summary: 'Falta firma del Representante Legal en formulario RAI-02', details: 'El formulario RAI-02 no presenta firma original con sello de empresa.' });
    await mkObs({ procedureId: p7.id, cycleId: p7c0.id, category: ObservationCategory.ADMINISTRATIVA, priority: ObservationPriority.BAJA, issuedByUserId: ins4.id, issuedAt: new Date('2026-01-22T13:30:00Z'), summary: 'Cronograma de inversiones ambientales desactualizado', details: 'El cronograma data del año 2022 y no refleja las inversiones proyectadas para el período 2026–2028.' });
  }

  // p8 – Agroindustrias – OBSERVADO (3 obs sin resolver)
  if (await prisma.observation.count({ where: { procedureId: p8.id } }) === 0) {
    await mkObs({ procedureId: p8.id, cycleId: p8c0.id, category: ObservationCategory.TECNICA, priority: ObservationPriority.ALTA, issuedByUserId: ins5.id, issuedAt: new Date('2026-02-25T10:00:00Z'), summary: 'Sistema de tratamiento de aguas residuales no documentado', details: 'El expediente no incluye memoria técnica del sistema TARI ni resultados de análisis de efluentes de los últimos 6 meses.' });
    await mkObs({ procedureId: p8.id, cycleId: p8c0.id, category: ObservationCategory.LEGAL, priority: ObservationPriority.ALTA, issuedByUserId: ins5.id, issuedAt: new Date('2026-02-25T10:15:00Z'), summary: 'Certificado SENASAG vencido', details: 'La certificación sanitaria SENASAG presentada venció el 15/01/2026. Debe adjuntarse certificado vigente.' });
    await mkObs({ procedureId: p8.id, cycleId: p8c0.id, category: ObservationCategory.DOCUMENTAL, priority: ObservationPriority.MEDIA, issuedByUserId: ins5.id, issuedAt: new Date('2026-02-25T10:30:00Z'), summary: 'Mapa de ubicación sin coordenadas UTM', details: 'El mapa no incluye coordenadas UTM en sistema WGS84 exigido por la normativa municipal.' });
  }

  // p9 – Industrias Plásticas – SUBSANACION (2 obs sin resolver)
  if (await prisma.observation.count({ where: { procedureId: p9.id } }) === 0) {
    await mkObs({ procedureId: p9.id, cycleId: p9c0.id, category: ObservationCategory.TECNICA, priority: ObservationPriority.ALTA, issuedByUserId: ins2.id, issuedAt: new Date('2025-11-20T11:00:00Z'), summary: 'Plan de Gestión de Residuos Peligrosos incompleto', details: 'El PGRSP no identifica los residuos de solventes clorados ni su disposición final conforme al DS 28631.' });
    await mkObs({ procedureId: p9.id, cycleId: p9c0.id, category: ObservationCategory.ADMINISTRATIVA, priority: ObservationPriority.MEDIA, issuedByUserId: ins2.id, issuedAt: new Date('2025-11-20T11:20:00Z'), summary: 'Contrato de disposición de residuos sin registrar ante GAMS', details: 'El contrato con la empresa gestora no está registrado en el sistema de la GAMS.' });
  }

  // p10 – Cemento – SUBSANACION (2 obs sin resolver)
  if (await prisma.observation.count({ where: { procedureId: p10.id } }) === 0) {
    await mkObs({ procedureId: p10.id, cycleId: p10c0.id, category: ObservationCategory.TECNICA, priority: ObservationPriority.ALTA, issuedByUserId: ins3.id, issuedAt: new Date('2025-12-20T10:00:00Z'), summary: 'Monitoreo de emisiones atmosféricas incompleto', details: 'No se presentan resultados de monitoreo de PM10 y SO₂ para el período julio–diciembre 2025.' });
    await mkObs({ procedureId: p10.id, cycleId: p10c0.id, category: ObservationCategory.LEGAL, priority: ObservationPriority.MEDIA, issuedByUserId: ins3.id, issuedAt: new Date('2025-12-20T10:20:00Z'), summary: 'Permiso de aprovechamiento de agua sin renovar', details: 'El permiso de aprovechamiento de agua superficial venció en agosto 2025.' });
  }

  // p6 – Lab. Farmacéuticos – EN_REVISION ciclo 1 (obs ciclo 0 resueltas)
  if (await prisma.observation.count({ where: { procedureId: p6.id } }) === 0) {
    await mkObs({ procedureId: p6.id, cycleId: p6c0.id, category: ObservationCategory.TECNICA, priority: ObservationPriority.ALTA, issuedByUserId: ins1.id, issuedAt: new Date('2026-01-25T11:00:00Z'), summary: 'Indicadores del IAA no corresponden al período declarado', details: 'Los indicadores presentados son de 2023 en lugar del período 2024–2025 exigido.', isResolved: true, resolvedByUserId: ins1.id, resolvedAt: new Date('2026-02-19T09:00:00Z'), resolutionNote: 'Empresa presentó indicadores del período correcto 2024–2025.' });
    await mkObs({ procedureId: p6.id, cycleId: p6c0.id, category: ObservationCategory.DOCUMENTAL, priority: ObservationPriority.MEDIA, issuedByUserId: ins1.id, issuedAt: new Date('2026-01-25T11:30:00Z'), summary: 'Balance de materiales sin auditoría externa', details: 'El balance de materias primas no cuenta con verificación de auditor ambiental externo autorizado.', isResolved: true, resolvedByUserId: ins1.id, resolvedAt: new Date('2026-02-19T09:15:00Z'), resolutionNote: 'Se adjuntó informe de auditor ambiental Ing. Carlos Vera (Reg. MA-0445).' });
  }

  // p12 – Embotelladora – CERRADO (obs resueltas)
  if (await prisma.observation.count({ where: { procedureId: p12.id } }) === 0) {
    await mkObs({ procedureId: p12.id, cycleId: p12c0.id, category: ObservationCategory.DOCUMENTAL, priority: ObservationPriority.MEDIA, issuedByUserId: ins4.id, issuedAt: new Date('2025-07-28T14:00:00Z'), summary: 'Formularios IAA con fecha incorrecta', details: 'Los formularios IAA-01 e IAA-02 presentan fecha de suscripción 2024 cuando correspondía 2025.', isResolved: true, resolvedByUserId: ins4.id, resolvedAt: new Date('2025-09-02T10:00:00Z'), resolutionNote: 'Se presentaron formularios corregidos con firma del representante legal.' });
    await mkObs({ procedureId: p12.id, cycleId: p12c0.id, category: ObservationCategory.TECNICA, priority: ObservationPriority.ALTA, issuedByUserId: ins4.id, issuedAt: new Date('2025-07-28T14:20:00Z'), summary: 'Falta reporte de monitoreo Q2 2025', details: 'No se adjuntó el reporte de monitoreo ambiental correspondiente al segundo trimestre de 2025.', isResolved: true, resolvedByUserId: ins4.id, resolvedAt: new Date('2025-09-02T10:15:00Z'), resolutionNote: 'Se adjuntó reporte Q2 2025 emitido por laboratorio certificado.' });
  }

  // p15 – Curtiembre – ABANDONADO (obs sin resolver)
  if (await prisma.observation.count({ where: { procedureId: p15.id } }) === 0) {
    await mkObs({ procedureId: p15.id, cycleId: p15c0.id, category: ObservationCategory.TECNICA, priority: ObservationPriority.ALTA, issuedByUserId: ins5.id, issuedAt: new Date('2025-05-01T13:00:00Z'), summary: 'Plan de Manejo de Efluentes de Curtiembre incompleto', details: 'El plan no incluye tratamiento para cromo hexavalente presente en los efluentes del proceso de curtido.' });
    await mkObs({ procedureId: p15.id, cycleId: p15c0.id, category: ObservationCategory.LEGAL, priority: ObservationPriority.ALTA, issuedByUserId: ins5.id, issuedAt: new Date('2025-05-01T13:20:00Z'), summary: 'Licencia municipal de funcionamiento vencida', details: 'La licencia de funcionamiento municipal venció en enero 2025 y no se adjunta renovación.' });
  }
  console.log('Observations seeded.');

  // ── 11. Documents ─────────────────────────────────────────────────────────
  // p1 – Ladrillera – RECIBIDO
  await mkDoc({ procedureId: p1.id, docGroup: DocumentGroup.INGRESO, fileName: 'formulario_solicitud_RAI.pdf', storageKey: `procedures/${p1.id}/ingreso/formulario_solicitud_RAI_v1.pdf`, mimeType: 'application/pdf', fileSize: BigInt(412000), description: 'Formulario de solicitud RAI firmado', uploadedByUserId: sec1.id, uploadedAt: new Date('2026-03-15T09:15:00Z') });
  await mkDoc({ procedureId: p1.id, docGroup: DocumentGroup.ANEXO, fileName: 'memoria_descriptiva.pdf', storageKey: `procedures/${p1.id}/anexo/memoria_descriptiva_v1.pdf`, mimeType: 'application/pdf', fileSize: BigInt(1850000), description: 'Memoria descriptiva de la actividad industrial', uploadedByUserId: sec1.id, uploadedAt: new Date('2026-03-15T09:20:00Z') });

  // p2 – Metalmecánica – RECIBIDO
  await mkDoc({ procedureId: p2.id, docGroup: DocumentGroup.INGRESO, fileName: 'solicitud_MAI_PMA.pdf', storageKey: `procedures/${p2.id}/ingreso/solicitud_v1.pdf`, mimeType: 'application/pdf', fileSize: BigInt(534000), description: 'Formulario solicitud MAI/PMA', uploadedByUserId: sec2.id, uploadedAt: new Date('2026-03-18T09:00:00Z') });

  // p4 – Frigorífico – EN_REVISION
  await mkDoc({ procedureId: p4.id, docGroup: DocumentGroup.INGRESO, fileName: 'solicitud_RAI_frigorifico.pdf', storageKey: `procedures/${p4.id}/ingreso/solicitud_v1.pdf`, mimeType: 'application/pdf', fileSize: BigInt(389000), description: 'Solicitud RAI inicial', uploadedByUserId: sec1.id, uploadedAt: new Date('2026-02-20T08:45:00Z') });
  await mkDoc({ procedureId: p4.id, docGroup: DocumentGroup.ANEXO, fileName: 'plano_instalaciones.pdf', storageKey: `procedures/${p4.id}/anexo/plano_instalaciones_v1.pdf`, mimeType: 'application/pdf', fileSize: BigInt(2100000), description: 'Plano de instalaciones y distribución de planta', uploadedByUserId: sec1.id, uploadedAt: new Date('2026-02-20T08:50:00Z') });

  // p5 – Textiles – EN_REVISION
  await mkDoc({ procedureId: p5.id, docGroup: DocumentGroup.INGRESO, fileName: 'solicitud_MAI_textiles.pdf', storageKey: `procedures/${p5.id}/ingreso/solicitud_v1.pdf`, mimeType: 'application/pdf', fileSize: BigInt(467000), description: 'Solicitud MAI/PMA Textiles del Sur', uploadedByUserId: sec2.id, uploadedAt: new Date('2026-03-01T08:30:00Z') });

  // p7 – Pinturas – OBSERVADO
  await mkDoc({ procedureId: p7.id, cycleId: p7c0.id, docGroup: DocumentGroup.INGRESO, fileName: 'solicitud_renovacion_RAI_pinturas.pdf', storageKey: `procedures/${p7.id}/ingreso/solicitud_v1.pdf`, mimeType: 'application/pdf', fileSize: BigInt(456000), description: 'Solicitud de renovación RAI', uploadedByUserId: sec2.id, uploadedAt: new Date('2026-01-10T09:00:00Z') });
  await mkDoc({ procedureId: p7.id, cycleId: p7c0.id, docGroup: DocumentGroup.OBSERVACIONES, fileName: 'carta_observaciones_HR-2026-0089.pdf', storageKey: `procedures/${p7.id}/observaciones/carta_obs_v1.pdf`, mimeType: 'application/pdf', fileSize: BigInt(234000), description: 'Carta de observaciones emitida al administrado', uploadedByUserId: ins4.id, uploadedAt: new Date('2026-01-22T14:30:00Z') });

  // p9 – Industrias Plásticas – SUBSANACION
  await mkDoc({ procedureId: p9.id, cycleId: p9c0.id, docGroup: DocumentGroup.INGRESO, fileName: 'solicitud_renovacion_RAI_plasticas.pdf', storageKey: `procedures/${p9.id}/ingreso/solicitud_v1.pdf`, mimeType: 'application/pdf', fileSize: BigInt(502000), description: 'Solicitud de renovación RAI Industrias Plásticas', uploadedByUserId: sec1.id, uploadedAt: new Date('2025-11-10T08:30:00Z') });
  await mkDoc({ procedureId: p9.id, cycleId: p9c0.id, docGroup: DocumentGroup.OBSERVACIONES, fileName: 'carta_obs_HR-2025-1102.pdf', storageKey: `procedures/${p9.id}/observaciones/carta_obs_v1.pdf`, mimeType: 'application/pdf', fileSize: BigInt(198000), description: 'Carta de observaciones ciclo 0', uploadedByUserId: ins2.id, uploadedAt: new Date('2025-11-24T11:30:00Z') });

  // p11 – Cervecería – CERRADO
  await mkDoc({ procedureId: p11.id, docGroup: DocumentGroup.INGRESO, fileName: 'solicitud_renovacion_RAI_cerveceria.pdf', storageKey: `procedures/${p11.id}/ingreso/solicitud_v1.pdf`, mimeType: 'application/pdf', fileSize: BigInt(634000), description: 'Solicitud de renovación RAI Cervecería Nacional', uploadedByUserId: sec1.id, uploadedAt: new Date('2025-09-01T08:15:00Z') });
  await mkDoc({ procedureId: p11.id, docGroup: DocumentGroup.INFORME, fileName: 'informe_tecnico_RAI_CBB-2021-001.pdf', storageKey: `procedures/${p11.id}/informe/informe_tecnico_v1.pdf`, mimeType: 'application/pdf', fileSize: BigInt(1240000), description: 'Informe técnico de inspección y revisión', uploadedByUserId: ins1.id, uploadedAt: new Date('2025-09-09T16:00:00Z') });
  await mkDoc({ procedureId: p11.id, docGroup: DocumentGroup.RESULTADO_FINAL, fileName: 'certificado_CERT-RAI-2025-001.pdf', storageKey: `procedures/${p11.id}/resultado/certificado_v1.pdf`, mimeType: 'application/pdf', fileSize: BigInt(378000), description: 'Certificado de aprobación RAI', uploadedByUserId: enc1.id, uploadedAt: new Date('2025-09-10T14:45:00Z') });

  // p12 – Embotelladora – CERRADO con reingreso
  await mkDoc({ procedureId: p12.id, cycleId: p12c0.id, docGroup: DocumentGroup.INGRESO, fileName: 'solicitud_IAA_embotelladora.pdf', storageKey: `procedures/${p12.id}/ingreso/solicitud_v1.pdf`, mimeType: 'application/pdf', fileSize: BigInt(523000), description: 'Solicitud IAA Embotelladora Andina', uploadedByUserId: sec2.id, uploadedAt: new Date('2025-07-10T08:30:00Z') });
  await mkDoc({ procedureId: p12.id, cycleId: p12c0.id, docGroup: DocumentGroup.OBSERVACIONES, fileName: 'carta_obs_HR-2025-0712.pdf', storageKey: `procedures/${p12.id}/observaciones/carta_obs_v1.pdf`, mimeType: 'application/pdf', fileSize: BigInt(210000), description: 'Carta de observaciones documentales', uploadedByUserId: ins4.id, uploadedAt: new Date('2025-07-28T15:30:00Z') });
  await mkDoc({ procedureId: p12.id, cycleId: p12c1.id, docGroup: DocumentGroup.REINGRESO, fileName: 'reingreso_subsanacion_IAA.pdf', storageKey: `procedures/${p12.id}/reingreso/subsanacion_v1.pdf`, mimeType: 'application/pdf', fileSize: BigInt(892000), description: 'Documentación de subsanación - reingreso', uploadedByUserId: sec2.id, uploadedAt: new Date('2025-08-15T09:30:00Z') });
  await mkDoc({ procedureId: p12.id, docGroup: DocumentGroup.RESULTADO_FINAL, fileName: 'certificado_CERT-IAA-2025-014.pdf', storageKey: `procedures/${p12.id}/resultado/certificado_v1.pdf`, mimeType: 'application/pdf', fileSize: BigInt(412000), description: 'Certificado de aprobación IAA', uploadedByUserId: enc2.id, uploadedAt: new Date('2025-09-05T11:30:00Z') });

  // p13 – Lab. Farmacéuticos – CERRADO
  await mkDoc({ procedureId: p13.id, docGroup: DocumentGroup.INGRESO, fileName: 'solicitud_MAI_PMA_labfarma.pdf', storageKey: `procedures/${p13.id}/ingreso/solicitud_v1.pdf`, mimeType: 'application/pdf', fileSize: BigInt(789000), description: 'Solicitud MAI/PMA Laboratorios Farmacéuticos Bolivia', uploadedByUserId: sec1.id, uploadedAt: new Date('2025-05-05T08:30:00Z') });
  await mkDoc({ procedureId: p13.id, docGroup: DocumentGroup.RESULTADO_FINAL, fileName: 'certificado_CERT-MAI-2025-008.pdf', storageKey: `procedures/${p13.id}/resultado/certificado_v1.pdf`, mimeType: 'application/pdf', fileSize: BigInt(445000), description: 'Certificado de aprobación MAI/PMA', uploadedByUserId: enc1.id, uploadedAt: new Date('2025-05-25T09:30:00Z') });

  // p14 – Cemento CIERRE – CERRADO
  await mkDoc({ procedureId: p14.id, docGroup: DocumentGroup.INGRESO, fileName: 'plan_cierre_cemento_andino.pdf', storageKey: `procedures/${p14.id}/ingreso/plan_cierre_v1.pdf`, mimeType: 'application/pdf', fileSize: BigInt(2340000), description: 'Plan de Cierre y Abandono de Sección Molienda', uploadedByUserId: sec2.id, uploadedAt: new Date('2025-03-01T09:00:00Z') });
  await mkDoc({ procedureId: p14.id, docGroup: DocumentGroup.RESULTADO_FINAL, fileName: 'certificado_CERT-CIERRE-2025-001.pdf', storageKey: `procedures/${p14.id}/resultado/certificado_v1.pdf`, mimeType: 'application/pdf', fileSize: BigInt(356000), description: 'Certificado de aprobación Plan de Cierre', uploadedByUserId: enc1.id, uploadedAt: new Date('2025-03-15T17:00:00Z') });

  // p15 – Curtiembre – ABANDONADO
  await mkDoc({ procedureId: p15.id, cycleId: p15c0.id, docGroup: DocumentGroup.INGRESO, fileName: 'solicitud_MAI_curtiembre.pdf', storageKey: `procedures/${p15.id}/ingreso/solicitud_v1.pdf`, mimeType: 'application/pdf', fileSize: BigInt(623000), description: 'Solicitud MAI/PMA Curtiembre El Cóndor', uploadedByUserId: sec1.id, uploadedAt: new Date('2025-04-10T08:30:00Z') });

  console.log('Documents seeded.');

  console.log('\n✓ Seeding completed successfully.');
  console.log('  Users:      10 (1 superadmin, 2 encargados, 2 secretarias, 5 inspectores)');
  console.log('  Companies:  12 (7 C3, 5 C4) + 12 CaseFiles');
  console.log('  Procedures: 16 (RECIBIDO:3, EN_REVISION:3, OBSERVADO:2, SUBSANACION:2, CERRADO:4, ABANDONADO:2)');
  console.log('  Cycles:     11 | Audits: ~25 | Observations: ~17 | Documents: ~22');
  console.log('  Holidays:   24 (2025 + 2026)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
