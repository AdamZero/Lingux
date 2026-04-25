import { test, expect } from "@playwright/test";

test.describe("Lingux 认证流程测试", () => {
  test("1. 未登录用户访问首页应重定向到登录页", async ({ page }) => {
    // 清除 localStorage 确保未登录状态
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // 应该被重定向到登录页
    await expect(page).toHaveURL(/login/);
    await expect(page.locator("h2")).toContainText("Login");
  });

  test("2. 模拟登录回调后应正确跳转到项目页", async ({ page }) => {
    // 模拟登录回调 URL
    const mockToken = "test-token-123";
    const mockUser = JSON.stringify({
      id: "test-user-id",
      username: "Test User",
      role: "ADMIN",
    });

    // 访问带有 token 和 user 的登录页（模拟 OAuth 回调）
    await page.goto(
      `/login#token=${mockToken}&user=${encodeURIComponent(mockUser)}`,
    );

    // 等待导航完成
    await page.waitForURL("/projects", { timeout: 5000 });

    // 验证已跳转到项目页
    await expect(page).toHaveURL("/projects");

    // 验证 localStorage 中已保存 token
    const storedToken = await page.evaluate(() =>
      localStorage.getItem("lingux-app-storage"),
    );
    expect(storedToken).toContain(mockToken);
  });

  test("3. 已登录用户访问登录页应自动跳转到项目页", async ({ page }) => {
    // 先设置登录状态
    await page.goto("/");
    await page.evaluate(() => {
      const state = {
        state: {
          token: "existing-token",
          user: { id: "user-1", username: "Existing User", role: "EDITOR" },
          theme: "light",
          sidebarCollapsed: false,
          _hasHydrated: true,
        },
        version: 0,
      };
      localStorage.setItem("lingux-app-storage", JSON.stringify(state));
    });

    // 访问登录页
    await page.goto("/login");

    // 应该被自动重定向到项目页
    await page.waitForURL("/projects", { timeout: 5000 });
    await expect(page).toHaveURL("/projects");
  });

  test("4. 已登录用户访问受保护路由应正常访问", async ({ page }) => {
    // 设置登录状态
    await page.goto("/");
    await page.evaluate(() => {
      const state = {
        state: {
          token: "existing-token",
          user: { id: "user-1", username: "Existing User", role: "EDITOR" },
          theme: "light",
          sidebarCollapsed: false,
          _hasHydrated: true,
        },
        version: 0,
      };
      localStorage.setItem("lingux-app-storage", JSON.stringify(state));
    });

    // 访问工作台
    await page.goto("/workspace");

    // 应该保持在页面而不是被重定向到登录页
    await expect(page).not.toHaveURL(/login/);
  });
});
