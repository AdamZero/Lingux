/**
 * Feishu OAuth2 API Response Types
 */

export interface FeishuTokenResponse {
  code: number;
  msg: string;
  data: {
    access_token: string;
    token_type: string;
    expires_in: number;
    open_id: string;
    refresh_token?: string;
  };
}

export interface FeishuUserInfo {
  code: number;
  msg: string;
  data: {
    open_id: string;
    union_id: string;
    user_id?: string;
    name: string;
    en_name?: string;
    email?: string;
    mobile?: string;
    avatar_url?: string;
    avatar_thumb?: string;
    avatar_middle?: string;
    avatar_big?: string;
    tenant_key: string;
  };
}

export interface FeishuUser {
  name: string;
  email?: string;
  avatar?: string;
  mobile?: string;
}
