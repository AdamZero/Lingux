import { test, expect } from "@playwright/test";

test.describe("Lingux 核心用户流程", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("1. 登录流程", async ({ page }) => {
    await expect(page).toHaveURL(/login/);
    await expect(page.locator("h2")).toContainText("登录");
  });

  test("2. 工作台跳转", async ({ page }) => {
    await page.goto("/workspace");
    await expect(page.locator("text=欢迎回来")).toBeVisible();
  });

  test("3. 项目列表页", async ({ page }) => {
    await page.goto("/projects");
    await expect(page.locator("text=Projects")).toBeVisible();
  });

  test("4. 发布中心页", async ({ page }) => {
    await page.goto("/releases");
    await expect(page.locator("text=发布中心")).toBeVisible();
  });
});
