import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/db/prisma.service';
import { RoleName, CompanyCategory } from '@prisma/client';
import * as bcrypt from 'bcrypt';

describe('CompaniesController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let httpServer: any;

  // Tokens para cada rol
  let superadminToken: string;
  let encargadoToken: string;
  let secretariaToken: string;
  let inspectorToken: string;

  // IDs de prueba
  let testCompanyId: string;
  let anotherCompanyId: string;

  const testPassword = 'passwds12345';
  const passwordHash = bcrypt.hashSync(testPassword, 12);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);
    httpServer = app.getHttpServer();

    await app.init();
  });

  beforeEach(async () => {
    // 1. Primero eliminar refresh tokens de usuarios de prueba
    await prisma.refreshToken.deleteMany({
        where: { user: { email: { contains: 'test-' } } },
    });

    // 2. Luego eliminar relaciones userRole
    await prisma.userRole.deleteMany({
        where: { user: { email: { contains: 'test-' } } },
    });

    // 3. Ahora sí eliminar usuarios
    await prisma.user.deleteMany({
        where: { email: { contains: 'test-' } },
    });

    // 4. Eliminar empresas de prueba
    await prisma.company.deleteMany({
        where: {
        legalName: { contains: 'TEST-' },
        },
    });

    // 5. Asegurar que los roles existen
    const roles = await Promise.all(
        Object.values(RoleName).map((name) =>
        prisma.role.upsert({
            where: { name },
            update: {},
            create: { name },
        }),
        ),
    );

    // 6. Crear usuarios de prueba con cada rol
    const users = [
        { email: 'test-superadmin@test.com', firstName: 'Test', lastName: 'SuperAdmin', role: RoleName.SUPERADMIN },
        { email: 'test-encargado@test.com', firstName: 'Test', lastName: 'Encargado', role: RoleName.ENCARGADO },
        { email: 'test-secretaria@test.com', firstName: 'Test', lastName: 'Secretaria', role: RoleName.SECRETARIA },
        { email: 'test-inspector@test.com', firstName: 'Test', lastName: 'Inspector', role: RoleName.INSPECTOR },
    ];

    for (const userData of users) {
        const role = roles.find((r) => r.name === userData.role);
        if (!role) {
        throw new Error(`Role ${userData.role} not found`);
        }
        const user = await prisma.user.create({
        data: {
            email: userData.email,
            passwordHash,
            firstName: userData.firstName,
            lastName: userData.lastName,
            isActive: true,
        },
        });
        await prisma.userRole.create({
        data: {
            userId: user.id,
            roleId: role.id,
        },
        });
    }

    // 7. Hacer login para obtener tokens
    const login = async (email: string) => {
        const res = await request(httpServer)
        .post('/auth/login')
        .send({ email, password: testPassword });
        return res.body.accessToken;
    };

    superadminToken = await login('test-superadmin@test.com');
    encargadoToken = await login('test-encargado@test.com');
    secretariaToken = await login('test-secretaria@test.com');
    inspectorToken = await login('test-inspector@test.com');

    // 8. Crear una empresa de prueba (usando secretaria)
    const createRes = await request(httpServer)
        .post('/companies')
        .set('Authorization', `Bearer ${secretariaToken}`)
        .send({
        legalName: 'TEST-EMPRESA UNO S.A.',
        nit: '123456789',
        category: CompanyCategory.C4,
        address: 'Calle Falsa 123',
        phone: '+59144123456',
        email: 'test1@test.com',
        caebCodes: ['12345'],
        municipality: 'Sacaba',
        });
    testCompanyId = createRes.body.id;

    // 9. Crear otra empresa para pruebas de duplicados
    const createRes2 = await request(httpServer)
        .post('/companies')
        .set('Authorization', `Bearer ${secretariaToken}`)
        .send({
        legalName: 'TEST-EMPRESA DOS S.A.',
        nit: '987654321',
        category: CompanyCategory.C3,
        raiNumber: '999999999',
        address: 'Avenida Siempre Viva 742',
        phone: '+59144987654',
        email: 'test2@test.com',
        caebCodes: ['54321'],
        municipality: 'Cochabamba',
        });
    anotherCompanyId = createRes2.body.id;
  });

  afterAll(async () => {
    // Limpiar refresh tokens de prueba
    await prisma.refreshToken.deleteMany({
        where: { user: { email: { contains: 'test-' } } },
    });
    await prisma.userRole.deleteMany({
        where: { user: { email: { contains: 'test-' } } },
    });
    await prisma.user.deleteMany({
        where: { email: { contains: 'test-' } },
    });
    await prisma.company.deleteMany({
        where: { legalName: { contains: 'TEST-' } },
    });
    await prisma.$disconnect();
    await app.close();
  });

  // -----------------------------------------------------------------
  // PRUEBAS DE CREACIÓN (POST /companies)
  // -----------------------------------------------------------------
  describe('POST /companies', () => {
    const validCompany = {
      legalName: 'TEST-NUEVA EMPRESA S.R.L.',
      nit: '111222333',
      category: CompanyCategory.C4,
      address: 'Zona Industrial',
      phone: '+59177123456',
      email: 'nueva@test.com',
      caebCodes: ['11111'],
    };

    it('debe permitir a SUPERADMIN crear empresa', async () => {
      const res = await request(httpServer)
        .post('/companies')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send(validCompany)
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.legalName).toBe(validCompany.legalName);
    });

    it('debe permitir a ENCARGADO crear empresa', async () => {
      await request(httpServer)
        .post('/companies')
        .set('Authorization', `Bearer ${encargadoToken}`)
        .send(validCompany)
        .expect(201);
    });

    it('debe permitir a SECRETARIA crear empresa', async () => {
      await request(httpServer)
        .post('/companies')
        .set('Authorization', `Bearer ${secretariaToken}`)
        .send(validCompany)
        .expect(201);
    });

    it('debe denegar a INSPECTOR crear empresa (403)', async () => {
      await request(httpServer)
        .post('/companies')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send(validCompany)
        .expect(403);
    });

    it('debe validar campos obligatorios (400)', async () => {
      await request(httpServer)
        .post('/companies')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({ legalName: 'Solo nombre' }) // falta category
        .expect(400);
    });

    it('debe rechazar RAI duplicado (409)', async () => {
      await request(httpServer)
        .post('/companies')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({
          ...validCompany,
          raiNumber: '999999999', // ya existe en otraCompany
        })
        .expect(409);
    });

    it('debe asignar municipio por defecto "Sacaba" si no se envía', async () => {
      const res = await request(httpServer)
        .post('/companies')
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({ ...validCompany, municipality: undefined })
        .expect(201);
      expect(res.body.municipality).toBe('Sacaba');
    });
  });

  // -----------------------------------------------------------------
  // PRUEBAS DE LISTADO (GET /companies)
  // -----------------------------------------------------------------
  describe('GET /companies', () => {
    it('debe listar empresas para todos los roles', async () => {
      const roles = [superadminToken, encargadoToken, secretariaToken, inspectorToken];
      for (const token of roles) {
        const res = await request(httpServer)
          .get('/companies?limit=10')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('meta');
        expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('debe permitir búsqueda por nombre', async () => {
      const res = await request(httpServer)
        .get('/companies?search=UNO')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .expect(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].legalName).toContain('UNO');
    });

    it('debe filtrar por categoría', async () => {
      const res = await request(httpServer)
        .get('/companies?category=C3')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .expect(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].category).toBe('C3');
    });

    it('debe filtrar por hasRaiNumber', async () => {
      const res = await request(httpServer)
        .get('/companies?hasRaiNumber=true')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .expect(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].raiNumber).toBe('999999999');
    });

    it('debe paginar correctamente', async () => {
      const res = await request(httpServer)
        .get('/companies?page=1&limit=1')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .expect(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.meta.total).toBe(2);
      expect(res.body.meta.hasNextPage).toBe(true);
    });

    it('debe ordenar por createdAt descendente', async () => {
      const res = await request(httpServer)
        .get('/companies?sortBy=createdAt&sortOrder=desc')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .expect(200);
      const fechas = res.body.data.map(c => new Date(c.createdAt).getTime());
      expect(fechas).toEqual([...fechas].sort((a, b) => b - a));
    });
  });

  // -----------------------------------------------------------------
  // PRUEBAS DE OBTENER UNA EMPRESA (GET /companies/:id)
  // -----------------------------------------------------------------
  describe('GET /companies/:id', () => {
    it('debe obtener empresa por id', async () => {
      const res = await request(httpServer)
        .get(`/companies/${testCompanyId}`)
        .set('Authorization', `Bearer ${inspectorToken}`)
        .expect(200);
      expect(res.body.id).toBe(testCompanyId);
    });

    it('debe incluir caseFile si se solicita', async () => {
      const res = await request(httpServer)
        .get(`/companies/${testCompanyId}?include=caseFile`)
        .set('Authorization', `Bearer ${inspectorToken}`)
        .expect(200);
      expect(res.body).toHaveProperty('caseFile');
    });

    it('debe devolver 404 si no existe', async () => {
      await request(httpServer)
        .get('/companies/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${inspectorToken}`)
        .expect(404);
    });
  });

  // -----------------------------------------------------------------
  // PRUEBAS DE ACTUALIZACIÓN (PATCH /companies/:id)
  // -----------------------------------------------------------------
  describe('PATCH /companies/:id', () => {
    it('debe permitir a SUPERADMIN actualizar', async () => {
      const res = await request(httpServer)
        .patch(`/companies/${testCompanyId}`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({ phone: '+59170000000' })
        .expect(200);
      expect(res.body.phone).toBe('+59170000000');
    });

    it('debe permitir a ENCARGADO actualizar', async () => {
      const res = await request(httpServer)
        .patch(`/companies/${testCompanyId}`)
        .set('Authorization', `Bearer ${encargadoToken}`)
        .send({ email: 'actualizado@test.com' })
        .expect(200);
      expect(res.body.email).toBe('actualizado@test.com');
    });

    it('debe permitir a SECRETARIA actualizar', async () => {
      const res = await request(httpServer)
        .patch(`/companies/${testCompanyId}`)
        .set('Authorization', `Bearer ${secretariaToken}`)
        .send({ legalRepName: 'Nuevo Representante' })
        .expect(200);
      expect(res.body.legalRepName).toBe('Nuevo Representante');
    });

    it('debe denegar a INSPECTOR actualizar (403)', async () => {
      await request(httpServer)
        .patch(`/companies/${testCompanyId}`)
        .set('Authorization', `Bearer ${inspectorToken}`)
        .send({ phone: '+59111111111' })
        .expect(403);
    });

    it('debe rechazar RAI duplicado en actualización (409)', async () => {
      await request(httpServer)
        .patch(`/companies/${testCompanyId}`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({ raiNumber: '999999999' }) // ya existe en otraCompany
        .expect(409);
    });

    it('debe permitir actualización parcial sin errores', async () => {
      await request(httpServer)
        .patch(`/companies/${testCompanyId}`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .send({ observations: 'Solo observación' })
        .expect(200);
    });
  });

  // -----------------------------------------------------------------
  // PRUEBAS DE ELIMINACIÓN (DELETE /companies/:id)
  // -----------------------------------------------------------------
  describe('DELETE /companies/:id', () => {
    it('debe permitir a SUPERADMIN eliminar', async () => {
      const res = await request(httpServer)
        .delete(`/companies/${testCompanyId}`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(200);
      expect(res.body.message).toContain('deleted');
    });

    it('debe permitir a ENCARGADO eliminar', async () => {
      const res = await request(httpServer)
        .delete(`/companies/${anotherCompanyId}`)
        .set('Authorization', `Bearer ${encargadoToken}`)
        .expect(200);
      expect(res.body.message).toContain('deleted');
    });

    it('debe denegar a SECRETARIA eliminar (403)', async () => {
      await request(httpServer)
        .delete(`/companies/${testCompanyId}`)
        .set('Authorization', `Bearer ${secretariaToken}`)
        .expect(403);
    });

    it('debe denegar a INSPECTOR eliminar (403)', async () => {
      await request(httpServer)
        .delete(`/companies/${testCompanyId}`)
        .set('Authorization', `Bearer ${inspectorToken}`)
        .expect(403);
    });

    it('debe devolver 409 si la empresa ya está inactiva', async () => {
      // Primero eliminar
      await request(httpServer)
        .delete(`/companies/${testCompanyId}`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(200);
      // Intentar eliminar otra vez
      await request(httpServer)
        .delete(`/companies/${testCompanyId}`)
        .set('Authorization', `Bearer ${superadminToken}`)
        .expect(409);
    });
  });

  // -----------------------------------------------------------------
  // PRUEBAS DE CASE-FILE (GET /companies/:id/case-file)
  // -----------------------------------------------------------------
  describe('GET /companies/:id/case-file', () => {
    it('debe devolver 404 si no tiene case-file', async () => {
      await request(httpServer)
        .get(`/companies/${testCompanyId}/case-file`)
        .set('Authorization', `Bearer ${inspectorToken}`)
        .expect(404);
    });

    // Si hubiera un case-file, se probaría que lo devuelve
  });
});