import { test, expect } from "../fixtures";

test.describe("Authentication Module", () => {
  test("AUTH-001: 登录页面显示", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByText(/lingux/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /login/i })).toBeVisible();
    // 使用中文按钮文本
    await expect(
      page.getByRole("button", { name: /飞书|feishu/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /企信|qixin/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /钉钉|dingtalk/i }),
    ).toBeVisible();
  });

  test("AUTH-002: Dev Login 快速登录", async ({ page, login }) => {
    await login();

    // 检查登录成功后的页面（可能是 workspace 或 projects）
    const url = page.url();
    expect(url).toMatch(/workspace|projects/);

    // 检查页面内容显示正常
    await expect(page.locator("body")).toBeVisible();
  });

  test("AUTH-003: 认证状态保持", async ({ page, login }) => {
    await login();

    await page.reload();

    // 检查页面仍然可访问（不是登录页）
    const url = page.url();
    expect(url).not.toMatch(/login/);

    const storage = await page.evaluate(() =>
      localStorage.getItem("lingux-app-storage"),
    );
    const data = storage ? JSON.parse(storage) : null;
    expect(data?.state?.token).toBeTruthy();
  });

  test("AUTH-004: 未登录重定向", async ({ page }) => {
    await page.goto("/projects");

    await expect(page).toHaveURL(/login/);
  });

  test("AUTH-005: 登出功能", async ({ page, login, logout }) => {
    await login();

    // 确认已登录（不在登录页）
    let url = page.url();
    expect(url).not.toMatch(/login/);

    await logout();

    // 确认已登出
    url = page.url();
    expect(url).toMatch(/login/);

    const storage = await page.evaluate(() =>
      localStorage.getItem("lingux-app-storage"),
    );
    const data = storage ? JSON.parse(storage) : null;
    // logout 后 token 应该为 null
    expect(data?.state?.token).toBeNull();
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
