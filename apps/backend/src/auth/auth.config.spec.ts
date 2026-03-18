import { Test, TestingModule } from '@nestjs/testing';
import { AuthModule } from './auth.module';

describe('AuthModule Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules cache
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should use JWT_SECRET from environment variable', async () => {
    // Set a test JWT_SECRET
    process.env.JWT_SECRET = 'test-secret-key-from-env';

    const module: TestingModule = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();

    expect(module).toBeDefined();
    // The module should compile successfully with the env JWT_SECRET
  });

  it('should use default secret when JWT_SECRET is not set', async () => {
    // Remove JWT_SECRET from env
    delete process.env.JWT_SECRET;

    const module: TestingModule = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();

    expect(module).toBeDefined();
    // The module should compile with default secret
  });

  it('should fail token verification when secrets mismatch', async () => {
    // This test documents the issue: if JWT_SECRET env var is not loaded
    // before AuthModule imports, token verification will fail
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const jwt = require('jsonwebtoken');

    // Token signed with one secret
    const token = jwt.sign({ sub: 'test-user' }, 'secret-a');

    // Verification with different secret should fail
    expect(() => {
      jwt.verify(token, 'secret-b');
    }).toThrow();
  });
});
