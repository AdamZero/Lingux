import { test, expect } from "../fixtures";

test.describe("Authentication Module", () => {
  test("AUTH-001: 登录页面显示", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByText(/lingux/i)).toBeVisible();
    await expect(page.getByText(/sign in|login/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /feishu/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /qixin|wechat/i }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /dingtalk/i })).toBeVisible();
  });

  test("AUTH-002: Dev Login 快速登录", async ({ page, login }) => {
    await login();

    await expect(page).toHaveURL(/workspace/);
    await expect(page.getByText(/welcome|欢迎/i)).toBeVisible();
  });

  test("AUTH-003: 认证状态保持", async ({ page, login }) => {
    await login();

    await page.reload();
    await expect(page).toHaveURL(/workspace/);

    const token = await page.evaluate(() => localStorage.getItem("token"));
    expect(token).toBeTruthy();
  });

  test("AUTH-004: 未登录重定向", async ({ page }) => {
    await page.goto("/projects");

    await expect(page).toHaveURL(/login/);
  });

  test("AUTH-005: 登出功能", async ({ page, login, logout }) => {
    await login();
    await expect(page).toHaveURL(/workspace/);

    await logout();
    await expect(page).toHaveURL(/login/);

    const token = await page.evaluate(() => localStorage.getItem("token"));
    expect(token).toBeNull();
  });

  test("AUTH-006: 访问受保护页面需要登录", async ({ page }) => {
    const protectedRoutes = [
      "/projects",
      "/workspace",
      "/releases",
      "/settings",
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(/login/);
    }
  });
});
