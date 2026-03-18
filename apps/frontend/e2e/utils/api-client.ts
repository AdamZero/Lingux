import axios, { AxiosInstance } from "axios";

export interface LoginResult {
  access_token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export interface Project {
  id?: string;
  name: string;
  description?: string;
  baseLocale: string;
  supportedLocales: string[];
}

export interface Namespace {
  id?: string;
  projectId: string;
  name: string;
  description?: string;
}

export interface Key {
  id?: string;
  namespaceId: string;
  key: string;
  description?: string;
  labels?: string[];
}

export interface Translation {
  id?: string;
  keyId: string;
  locale: string;
  value: string;
  status?: "PENDING" | "TRANSLATING" | "REVIEWING" | "APPROVED" | "REJECTED";
}

export class APIClient {
  private http: AxiosInstance;
  private token: string = "";

  constructor(baseURL: string = "http://localhost:3001") {
    this.http = axios.create({
      baseURL,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.http.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });
  }

  setToken(token: string) {
    this.token = token;
  }

  async devLogin(email: string = "test@example.com"): Promise<LoginResult> {
    const response = await this.http.get("/api/v1/auth/dev-login", {
      params: { email },
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
    });

    const redirectUrl = response.headers.location;
    if (!redirectUrl) {
      throw new Error("Dev login failed: no redirect URL");
    }

    const hash = redirectUrl.split("#")[1];
    const params = new URLSearchParams(hash);
    const token = params.get("token");
    const userStr = params.get("user");

    if (!token || !userStr) {
      throw new Error("Dev login failed: no token or user in redirect");
    }

    this.token = token;
    const user = JSON.parse(userStr);

    return { access_token: token, user };
  }

  async getProjects() {
    return this.http.get("/api/v1/projects");
  }

  async createProject(data: Project) {
    return this.http.post("/api/v1/projects", data);
  }

  async getProject(id: string) {
    return this.http.get(`/api/v1/projects/${id}`);
  }

  async updateProject(id: string, data: Partial<Project>) {
    return this.http.patch(`/api/v1/projects/${id}`, data);
  }

  async deleteProject(id: string) {
    return this.http.delete(`/api/v1/projects/${id}`);
  }

  async getNamespaces(projectId: string) {
    return this.http.get(`/api/v1/projects/${projectId}/namespaces`);
  }

  async createNamespace(projectId: string, data: Namespace) {
    return this.http.post(`/api/v1/projects/${projectId}/namespaces`, data);
  }

  async deleteNamespace(id: string) {
    return this.http.delete(`/api/v1/namespaces/${id}`);
  }

  async getKeys(namespaceId: string) {
    return this.http.get(`/api/v1/namespaces/${namespaceId}/keys`);
  }

  async createKey(namespaceId: string, data: Key) {
    return this.http.post(`/api/v1/namespaces/${namespaceId}/keys`, data);
  }

  async deleteKey(id: string) {
    return this.http.delete(`/api/v1/keys/${id}`);
  }

  async createTranslation(keyId: string, data: Translation) {
    return this.http.post(`/api/v1/keys/${keyId}/translations`, data);
  }

  async getTranslation(keyId: string, locale: string) {
    return this.http.get(`/api/v1/keys/${keyId}/translations/${locale}`);
  }

  async updateTranslationStatus(id: string, status: string) {
    return this.http.patch(`/api/v1/translations/${id}/status`, { status });
  }

  async getReleases(projectId: string) {
    return this.http.get(`/api/v1/projects/${projectId}/releases`);
  }

  async createRelease(projectId: string, data: any) {
    return this.http.post(`/api/v1/projects/${projectId}/releases`, data);
  }

  async approveRelease(id: string) {
    return this.http.post(`/api/v1/releases/${id}/approve`);
  }

  async publishRelease(id: string) {
    return this.http.post(`/api/v1/releases/${id}/publish`);
  }

  async deleteRelease(id: string) {
    return this.http.delete(`/api/v1/releases/${id}`);
  }
}
