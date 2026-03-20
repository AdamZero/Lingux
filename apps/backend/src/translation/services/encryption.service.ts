import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * 加密服务
 * 用于加密/解密翻译供应商的API密钥等敏感信息
 */
@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly authTagLength = 16;
  private readonly encryptionKey: Buffer;

  constructor() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    // 使用SHA-256将密钥哈希为32字节
    this.encryptionKey = crypto.createHash('sha256').update(key).digest();
  }

  /**
   * 加密文本
   * @param text 要加密的明文
   * @returns 加密后的密文（base64格式）
   */
  encrypt(text: string): string {
    if (!text) {
      return text;
    }

    try {
      // 生成随机IV
      const iv = crypto.randomBytes(this.ivLength);

      // 创建加密器
      const cipher = crypto.createCipheriv(
        this.algorithm,
        this.encryptionKey,
        iv,
      );

      // 加密数据
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // 获取认证标签
      const authTag = cipher.getAuthTag();

      // 组合: IV + AuthTag + EncryptedData
      const result = Buffer.concat([
        iv,
        authTag,
        Buffer.from(encrypted, 'hex'),
      ]).toString('base64');

      return result;
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * 解密文本
   * @param encryptedData 要解密的密文（base64格式）
   * @returns 解密后的明文
   */
  decrypt(encryptedData: string): string {
    if (!encryptedData) {
      return encryptedData;
    }

    try {
      // 解码base64
      const buffer = Buffer.from(encryptedData, 'base64');

      // 提取IV、AuthTag和加密数据
      const iv = buffer.subarray(0, this.ivLength);
      const authTag = buffer.subarray(
        this.ivLength,
        this.ivLength + this.authTagLength,
      );
      const encrypted = buffer.subarray(this.ivLength + this.authTagLength);

      // 创建解密器
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.encryptionKey,
        iv,
      );
      decipher.setAuthTag(authTag);

      // 解密数据
      let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * 批量加密多个文本
   * @param texts 要加密的文本数组
   * @returns 加密后的文本数组
   */
  encryptMany(texts: string[]): string[] {
    return texts.map((text) => this.encrypt(text));
  }

  /**
   * 批量解密多个文本
   * @param encryptedTexts 要解密的密文数组
   * @returns 解密后的明文数组
   */
  decryptMany(encryptedTexts: string[]): string[] {
    return encryptedTexts.map((text) => this.decrypt(text));
  }

  /**
   * 生成安全的随机密钥
   * @returns 32字节的随机密钥（base64格式）
   */
  static generateKey(): string {
    return crypto.randomBytes(32).toString('base64');
  }

  /**
   * 验证加密数据格式是否有效
   * @param encryptedData 加密数据
   * @returns 是否有效
   */
  isValidEncryptedFormat(encryptedData: string): boolean {
    if (!encryptedData) {
      return false;
    }

    try {
      const buffer = Buffer.from(encryptedData, 'base64');
      // 最小长度 = IV + AuthTag + 至少1字节数据
      const minLength = this.ivLength + this.authTagLength + 1;
      return buffer.length >= minLength;
    } catch {
      return false;
    }
  }
}
