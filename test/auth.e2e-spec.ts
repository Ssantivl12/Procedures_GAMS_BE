// test para probar las funcionalidades de auth
// lo que sale en rojo es debido a que no puede generar el audit para esas consultas
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/db/prisma.service';
import * as bcrypt from 'bcrypt';

const request = require('supertest');

describe('AuthController (e2e) - BD real', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let httpServer: any;

  const testUser = {
    email: 'auth-test@example.com',
    password: '12345678',
    firstName: 'Auth',
    lastName: 'Test',
  };

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
    // Limpiar SOLO datos de prueba (no borra todo)
    await prisma.refreshToken.deleteMany({
      where: { user: { email: testUser.email } },
    });
    await prisma.userRole.deleteMany({
      where: { user: { email: testUser.email } },
    });
    await prisma.user.deleteMany({
      where: { email: testUser.email },
    });

    // Asegurar que el rol SUPERADMIN existe
    await prisma.role.upsert({
      where: { name: 'SUPERADMIN' },
      update: {},
      create: { name: 'SUPERADMIN' },
    });

    // Crear usuario de prueba
    const passwordHash = await bcrypt.hash(testUser.password, 12);
    await prisma.user.create({
      data: {
        email: testUser.email,
        passwordHash,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        isActive: true,
        roles: {
          create: {
            role: { connect: { name: 'SUPERADMIN' } },
            assignedAt: new Date(),
          },
        },
      },
    });
  });

  afterAll(async () => {
    // Limpieza final opcional
    await prisma.refreshToken.deleteMany({
      where: { user: { email: testUser.email } },
    });
    await prisma.userRole.deleteMany({
      where: { user: { email: testUser.email } },
    });
    await prisma.user.deleteMany({
      where: { email: testUser.email },
    });

    await prisma.$disconnect();
    await app.close();
  });

  it('POST /auth/login - éxito', async () => {
    const response = await request(httpServer)
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      })
      .expect(200);

    expect(response.body).toHaveProperty('accessToken');
    expect(response.body).toHaveProperty('refreshToken');
    expect(response.body.user.email).toBe(testUser.email);
  });

  it('POST /auth/login - credenciales inválidas', async () => {
    await request(httpServer)
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: 'wrong',
      })
      .expect(401);
  });

  it('POST /auth/refresh - rotación de tokens', async () => {
    // Login para obtener refresh token
    const login = await request(httpServer)
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    const oldRefreshToken = login.body.refreshToken;

    const response = await request(httpServer)
      .post('/auth/refresh')
      .send({ refreshToken: oldRefreshToken })
      .expect(200);

    expect(response.body.refreshToken).not.toBe(oldRefreshToken);
  });

  it('POST /auth/refresh - token inválido', async () => {
    await request(httpServer)
      .post('/auth/refresh')
      .send({ refreshToken: 'token-falso' })
      .expect(401);
  });

  it('POST /auth/logout - cierre de sesión', async () => {
    const login = await request(httpServer)
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    await request(httpServer)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ refreshToken: login.body.refreshToken })
      .expect(204);
  });

  it('POST /auth/change-password - cambio exitoso', async () => {
    const login = await request(httpServer)
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    await request(httpServer)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({
        currentPassword: testUser.password,
        newPassword: 'newpass123',
        confirmPassword: 'newpass123',
      })
      .expect(204);

    // Login con nueva contraseña
    await request(httpServer)
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: 'newpass123',
      })
      .expect(200);
  });

  it('POST /auth/change-password - contraseña actual incorrecta', async () => {
    const login = await request(httpServer)
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    await request(httpServer)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({
        currentPassword: 'wrong',
        newPassword: 'newpass123',
        confirmPassword: 'newpass123',
      })
      .expect(401);
  });
});