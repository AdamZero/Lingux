import {
  SENSITIVE_FIELDS,
  PARTIAL_MASK_FIELDS,
} from '../constants/sensitive-fields';

export function maskSensitiveData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return maskString(data);
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item));
  }

  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (isSensitiveField(lowerKey)) {
      masked[key] = maskValue(key, value);
    } else if (typeof value === 'object') {
      masked[key] = maskSensitiveData(value);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

function isSensitiveField(key: string): boolean {
  return SENSITIVE_FIELDS.some((field) => key.includes(field.toLowerCase()));
}

function maskValue(key: string, value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const strValue = String(value);

  // 完全隐藏
  if (!isPartialMaskField(key)) {
    return '***';
  }

  // 部分脱敏
  return partialMask(strValue);
}

function isPartialMaskField(key: string): boolean {
  return PARTIAL_MASK_FIELDS.some((field) =>
    key.toLowerCase().includes(field.toLowerCase()),
  );
}

function partialMask(value: string): string {
  if (value.length <= 4) {
    return '*'.repeat(value.length);
  }

  const start = value.slice(0, 3);
  const end = value.slice(-4);
  const middle = '*'.repeat(Math.min(value.length - 7, 6));

  return `${start}${middle}${end}`;
}

function maskString(value: string): string {
  // 检测是否是敏感信息格式（如 token、密码等）
  if (value.length > 20 && /^[A-Za-z0-9_-]+$/.test(value)) {
    return `${value.slice(0, 6)}...${value.slice(-4)}`;
  }
  return value;
}
