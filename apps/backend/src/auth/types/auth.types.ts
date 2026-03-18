// 认证用户类型 - 统一整个应用使用的用户类型
export interface AuthUser {
  id: string;
  username: string;
  name?: string;
  role: string;
}

// JWT Payload 类型
export interface JwtPayload {
  sub: string; // user id
  username: string;
  role: string;
}

// 扩展 Express Request 类型 - 与 passport 类型兼容
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends AuthUser {}
  }
}
