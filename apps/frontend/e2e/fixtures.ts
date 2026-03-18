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
    const apiClient = new APIClient("http://localhost:3001");
    await use(apiClient);
  },

  login: async ({ page, apiClient }, use) => {
    const loginFunction = async (email: string = "test@example.com") => {
      const loginResult = await apiClient.devLogin(email);

      await page.goto("/");
      await page.evaluate(
        (data) => {
          localStorage.setItem("token", data.token);
          localStorage.setItem("user", data.user);
        },
        {
          token: loginResult.access_token,
          user: JSON.stringify(loginResult.user),
        },
      );

      await page.reload();
      await page.waitForURL("/workspace");
    };

    await use(loginFunction);
  },

  logout: async ({ page }, use) => {
    const logoutFunction = async () => {
      await page.evaluate(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      });
      await page.goto("/login");
    };

    await use(logoutFunction);
  },
});

export { expect } from "@playwright/test";
