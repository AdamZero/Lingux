import { test as base } from "@playwright/test";
import { APIClient } from "./utils/api-client";
import { cleanupTestData } from "./utils/test-data";

export interface Fixtures {
  apiClient: APIClient;
  login: (email?: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const test = base.extend<Fixtures>({
  apiClient: async ({ page }, use) => {
    const apiClient = new APIClient("http://localhost:3000");
    await use(apiClient);
  },

  login: async ({ page, apiClient }, use) => {
    const loginFunction = async (email: string = "test@example.com") => {
      const loginResult = await apiClient.devLogin(email);

      await page.goto("/");

      // 使用 zustand persist 格式设置存储
      const storageData = {
        state: {
          token: loginResult.access_token,
          user: loginResult.user,
          theme: "light",
          sidebarCollapsed: false,
          _hasHydrated: true,
        },
        version: 0,
      };

      await page.evaluate((data) => {
        localStorage.setItem("lingux-app-storage", JSON.stringify(data));
      }, storageData);

      await page.reload();
      // 等待页面加载完成
      await page.waitForLoadState("networkidle");
    };

    await use(loginFunction);
  },

  logout: async ({ page }, use) => {
    const logoutFunction = async () => {
      await page.evaluate(() => {
        localStorage.removeItem("lingux-app-storage");
      });
      await page.goto("/login");
    };

    await use(logoutFunction);
  },
});

export { expect } from "@playwright/test";
