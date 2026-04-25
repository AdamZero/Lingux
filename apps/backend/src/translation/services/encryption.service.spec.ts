import { Test, TestingModule } from '@nestjs/testing';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;
  const originalEnv = process.env;

  beforeEach(async () => {
    // 设置测试环境变量
    process.env = {
      ...originalEnv,
      ENCRYPTION_KEY: 'test-encryption-key-for-unit-tests-only',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [EncryptionService],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  afterEach(() => {
    // 恢复原始环境变量
    process.env = originalEnv;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt text correctly', () => {
      const originalText = 'Hello, World! 你好，世界！';

      const encrypted = service.encrypt(originalText);
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(originalText);
      expect(typeof encrypted).toBe('string');

      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(originalText);
    });

    it('should handle empty string', () => {
      const encrypted = service.encrypt('');
      expect(encrypted).toBe('');

      const decrypted = service.decrypt('');
      expect(decrypted).toBe('');
    });

    it('should handle null/undefined by returning as-is', () => {
      const encrypted = service.encrypt(null as any);
      expect(encrypted).toBeNull();

      const decrypted = service.decrypt(null as any);
      expect(decrypted).toBeNull();
    });

    it('should produce different encrypted values for same text (due to random IV)', () => {
      const text = 'Same text';

      const encrypted1 = service.encrypt(text);
      const encrypted2 = service.encrypt(text);

      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to the same value
      expect(service.decrypt(encrypted1)).toBe(text);
      expect(service.decrypt(encrypted2)).toBe(text);
    });

    it('should handle unicode characters', () => {
      const text = '🎉 Emoji test: 你好世界 Привет мир Hello 日本語';

      const encrypted = service.encrypt(text);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(text);
    });

    it('should handle long text', () => {
      const text = 'A'.repeat(10000);

      const encrypted = service.encrypt(text);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(text);
    });

    it('should handle special characters', () => {
      const text = '!@#$%^&*()_+-=[]{}|;\':",./<>?';

      const encrypted = service.encrypt(text);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(text);
    });
  });

  describe('encryptMany and decryptMany', () => {
    it('should encrypt and decrypt multiple texts', () => {
      const texts = ['Hello', 'World', '你好', '世界'];

      const encrypted = service.encryptMany(texts);
      expect(encrypted).toHaveLength(4);

      const decrypted = service.decryptMany(encrypted);
      expect(decrypted).toEqual(texts);
    });

    it('should handle empty array', () => {
      const encrypted = service.encryptMany([]);
      expect(encrypted).toEqual([]);

      const decrypted = service.decryptMany([]);
      expect(decrypted).toEqual([]);
    });
  });

  describe('generateKey', () => {
    it('should generate a key', () => {
      const key = EncryptionService.generateKey();

      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    });

    it('should generate unique keys', () => {
      const key1 = EncryptionService.generateKey();
      const key2 = EncryptionService.generateKey();

      expect(key1).not.toBe(key2);
    });
  });

  describe('isValidEncryptedFormat', () => {
    it('should return true for valid encrypted data', () => {
      const encrypted = service.encrypt('test');

      expect(service.isValidEncryptedFormat(encrypted)).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(service.isValidEncryptedFormat('')).toBe(false);
    });

    it('should return false for null', () => {
      expect(service.isValidEncryptedFormat(null as any)).toBe(false);
    });

    it('should return false for invalid base64', () => {
      expect(service.isValidEncryptedFormat('not-valid-base64!!!')).toBe(false);
    });

    it('should return false for too short data', () => {
      expect(service.isValidEncryptedFormat('dGVzdA==')).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should throw error when decrypting invalid data', () => {
      expect(() => {
        service.decrypt(
          'invalid-data-that-is-long-enough-to-pass-length-check-but-invalid',
        );
      }).toThrow();
    });
  });
});

describe('EncryptionService without ENCRYPTION_KEY', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // 清除 ENCRYPTION_KEY 环境变量
    process.env = {
      ...originalEnv,
      ENCRYPTION_KEY: undefined,
    };
  });

  afterEach(() => {
    // 恢复原始环境变量
    process.env = originalEnv;
  });

  it('should throw error when ENCRYPTION_KEY is not set', () => {
    expect(() => {
      new EncryptionService();
    }).toThrow('ENCRYPTION_KEY environment variable is required');
  });
});
