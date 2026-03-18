import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('Workspace, Config, and Reviews API Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  // Mock user data for testing
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
  };

  const generateToken = (userId: string) => {
    return jwtService.sign({ userId, email: mockUser.email });
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    prisma = moduleRef.get<PrismaService>(PrismaService);
    jwtService = moduleRef.get<JwtService>(JwtService);
    configService = moduleRef.get<ConfigService>(ConfigService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Workspace API', () => {
    let projectId: string;
    let token: string;

    beforeAll(() => {
      token = generateToken(mockUser.id);
    });

    beforeEach(async () => {
      // Create a test project for workspace tests
      const project = await prisma.project.create({
        data: {
          name: 'Integration Test Project',
          description: 'Test project for integration tests',
          owner: {
            connect: {
              id: mockUser.id,
            },
          },
          users: {
            connect: {
              id: mockUser.id,
            },
          },
        },
      });
      projectId = project.id;
    });

    afterEach(async () => {
      // Clean up test data
      await prisma.translation.deleteMany({
        where: {
          key: {
            namespace: {
              projectId,
            },
          },
        },
      });
      await prisma.key.deleteMany({
        where: {
          namespace: {
            projectId,
          },
        },
      });
      await prisma.namespace.deleteMany({
        where: {
          projectId,
        },
      });
      await prisma.project.delete({
        where: {
          id: projectId,
        },
      });
    });

    it('GET /workspace/stats - should return workspace statistics', async () => {
      // Create some test data
      const namespace = await prisma.namespace.create({
        data: {
          name: 'test-namespace',
          projectId,
        },
      });

      const key = await prisma.key.create({
        data: {
          name: 'test-key',
          namespaceId: namespace.id,
        },
      });

      await prisma.translation.createMany({
        data: [
          {
            content: 'Test translation 1',
            status: 'PENDING',
            keyId: key.id,
            localeId: 'locale-en', // Assuming this locale exists
          },
          {
            content: 'Test translation 2',
            status: 'REVIEWING',
            keyId: key.id,
            localeId: 'locale-en',
          },
          {
            content: 'Test translation 3',
            status: 'APPROVED',
            keyId: key.id,
            localeId: 'locale-en',
          },
        ],
      });

      return request(app.getHttpServer())
        .get(`/workspace/stats?projectId=${projectId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .then((response) => {
          expect(response.body).toHaveProperty('code', 0);
          expect(response.body).toHaveProperty('message', 'success');
          expect(response.body.data).toHaveProperty('pending');
          expect(response.body.data).toHaveProperty('reviewing');
          expect(response.body.data).toHaveProperty('approved');
        });
    });

    it('GET /workspace/tasks - should return paginated tasks', async () => {
      // Create test data
      const namespace = await prisma.namespace.create({
        data: {
          name: 'test-namespace',
          projectId,
        },
      });

      const key = await prisma.key.create({
        data: {
          name: 'test-key',
          namespaceId: namespace.id,
        },
      });

      await prisma.translation.create({
        data: {
          content: 'Test translation',
          status: 'PENDING',
          keyId: key.id,
          localeId: 'locale-en',
        },
      });

      return request(app.getHttpServer())
        .get(`/workspace/tasks?projectId=${projectId}&page=1&pageSize=10`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .then((response) => {
          expect(response.body).toHaveProperty('code', 0);
          expect(response.body).toHaveProperty('message', 'success');
          expect(response.body.data).toHaveProperty('items');
          expect(response.body.data).toHaveProperty('total');
          expect(response.body.data).toHaveProperty('page');
          expect(response.body.data).toHaveProperty('pageSize');
          expect(response.body.data).toHaveProperty('totalPages');
        });
    });
  });

  describe('Config API', () => {
    let token: string;

    beforeAll(() => {
      token = generateToken(mockUser.id);
    });

    it('GET /config/features - should return feature flags', async () => {
      return request(app.getHttpServer())
        .get('/config/features')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .then((response) => {
          expect(response.body).toHaveProperty('code', 0);
          expect(response.body).toHaveProperty('message', 'success');
          expect(Array.isArray(response.body.data)).toBe(true);
        });
    });

    it('POST /config/features/:key - should update a feature flag', async () => {
      // First ensure a feature flag exists
      await prisma.config.upsert({
        where: { key: 'feature.test-integration' },
        update: { value: { enabled: false } },
        create: {
          key: 'feature.test-integration',
          value: { enabled: false },
          description: 'Test feature for integration',
        },
      });

      return request(app.getHttpServer())
        .post('/config/features/test-integration')
        .set('Authorization', `Bearer ${token}`)
        .send({ enabled: true })
        .expect(201)
        .then((response) => {
          expect(response.body).toHaveProperty('code', 0);
          expect(response.body).toHaveProperty('message', 'success');
          expect(response.body.data).toHaveProperty('key', 'test-integration');
          expect(response.body.data).toHaveProperty('enabled', true);
        });
    });
  });

  describe('Reviews API', () => {
    let projectId: string;
    let translationId: string;
    let token: string;

    beforeAll(() => {
      token = generateToken(mockUser.id);
    });

    beforeEach(async () => {
      // Create test project and translation
      const project = await prisma.project.create({
        data: {
          name: 'Reviews Test Project',
          description: 'Test project for reviews API',
          owner: {
            connect: {
              id: mockUser.id,
            },
          },
          users: {
            connect: {
              id: mockUser.id,
            },
          },
        },
      });
      projectId = project.id;

      const namespace = await prisma.namespace.create({
        data: {
          name: 'test-namespace',
          projectId,
        },
      });

      const key = await prisma.key.create({
        data: {
          name: 'test-key',
          namespaceId: namespace.id,
        },
      });

      const locale = await prisma.locale.create({
        data: {
          code: 'zh-CN',
          name: 'Chinese',
        },
      });

      const translation = await prisma.translation.create({
        data: {
          content: 'Test translation for review',
          status: 'PENDING',
          keyId: key.id,
          localeId: locale.id,
        },
      });
      translationId = translation.id;
    });

    afterEach(async () => {
      // Clean up test data
      await prisma.translation.deleteMany({
        where: {
          key: {
            namespace: {
              projectId,
            },
          },
        },
      });
      await prisma.key.deleteMany({
        where: {
          namespace: {
            projectId,
          },
        },
      });
      await prisma.namespace.deleteMany({
        where: {
          projectId,
        },
      });
      await prisma.locale.deleteMany({
        where: {
          code: 'zh-CN',
        },
      });
      await prisma.project.delete({
        where: {
          id: projectId,
        },
      });
    });

    it('GET /reviews - should return review tasks', async () => {
      return request(app.getHttpServer())
        .get(`/reviews?projectId=${projectId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .then((response) => {
          expect(response.body).toHaveProperty('code', 0);
          expect(response.body).toHaveProperty('message', 'success');
          expect(response.body.data).toHaveProperty('items');
          expect(response.body.data).toHaveProperty('total');
          expect(response.body.data).toHaveProperty('page');
          expect(response.body.data).toHaveProperty('pageSize');
          expect(response.body.data).toHaveProperty('totalPages');
        });
    });

    it('POST /reviews/:id/approve - should approve a review', async () => {
      // First update translation to REVIEWING status so it can be approved
      await prisma.translation.update({
        where: { id: translationId },
        data: { status: 'REVIEWING' },
      });

      return request(app.getHttpServer())
        .post(`/reviews/${translationId}/approve`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(201)
        .then((response) => {
          expect(response.body).toHaveProperty('code', 0);
          expect(response.body).toHaveProperty('message', 'success');
          expect(response.body.data).toHaveProperty('status', 'APPROVED');
        });
    });

    it('POST /reviews/:id/reject - should reject a review', async () => {
      // First update translation to REVIEWING status so it can be rejected
      await prisma.translation.update({
        where: { id: translationId },
        data: { status: 'REVIEWING' },
      });

      return request(app.getHttpServer())
        .post(`/reviews/${translationId}/reject`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Quality issue', suggestion: 'Fix grammar' })
        .expect(201)
        .then((response) => {
          expect(response.body).toHaveProperty('code', 0);
          expect(response.body).toHaveProperty('message', 'success');
          expect(response.body.data).toHaveProperty('status', 'PENDING');
          expect(response.body.data).toHaveProperty(
            'reviewComment',
            'Quality issue',
          );
        });
    });
  });
});
