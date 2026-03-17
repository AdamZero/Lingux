export const SENSITIVE_FIELDS = [
  // 认证相关
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'apiSecret',
  'authorization',
  'auth',
  'credential',
  'credentials',
  // 个人信息
  'phone',
  'mobile',
  'email',
  'idCard',
  'idNumber',
  'creditCard',
  'bankCard',
  'address',
  // 其他敏感字段
  'privateKey',
  'certificate',
  'passphrase',
];

export const PARTIAL_MASK_FIELDS = [
  'phone',
  'mobile',
  'email',
  'idCard',
  'idNumber',
  'creditCard',
  'bankCard',
];
