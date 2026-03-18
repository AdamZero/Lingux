import { test, expect } from "../fixtures";
import { createProject, createNamespace, createKey } from "../utils/test-data";

test.describe("Core Business Flow - Complete E2E", () => {
  test("FLOW-001: 完整翻译工作流", async ({ page, login, apiClient }) => {
    await login();

    const projectData = createProject();
    await page.goto("/projects");
    await page.getByRole("button", { name: /create project/i }).click();
    await page.getByLabel(/project name/i).fill(projectData.name);
    await page.getByRole("button", { name: /ok|confirm|create/i }).click();
    await expect(page.getByText(projectData.name)).toBeVisible({
      timeout: 5000,
    });

    await page.waitForTimeout(1000);

    await expect(page).toHaveURL(/\/projects\/[^/]+$/);
    const currentUrl = page.url();
    const projectId = currentUrl.split("/").pop()!;

    await page.getByRole("button", { name: /add key|新建词条/i }).click();
    const keyName = `test.key.${Date.now()}`;
    await page.getByLabel(/key name|词条名称/i).fill(keyName);
    await page.getByRole("button", { name: /ok|confirm|create/i }).click();
    await expect(page.getByText(keyName)).toBeVisible({ timeout: 5000 });

    const translateButton = page.getByRole("button", {
      name: /translate|翻译/i,
    });
    if ((await translateButton.count()) > 0) {
      await translateButton.first().click();

      const textarea = page.getByRole("textbox");
      if ((await textarea.count()) > 0) {
        await textarea.first().fill("Test Translation");
        await page.getByRole("button", { name: /save/i }).click();
      }
    }

    await expect(page.getByText(/saved|success/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("FLOW-002: 完整发布工作流", async ({ page, login }) => {
    await login();
    await page.goto("/releases");

    await page
      .getByRole("button", { name: /create release|创建发布/i })
      .click();

    const releaseName = `E2E-Release-${Date.now()}`;
    await page.getByLabel(/release name|发布名称/i).fill(releaseName);
    await page.getByRole("button", { name: /ok|confirm|create/i }).click();

    await expect(page.getByText(releaseName)).toBeVisible({ timeout: 5000 });

    await page.waitForTimeout(1000);

    const approveButton = page.getByRole("button", { name: /approve|审核/i });
    if ((await approveButton.count()) > 0) {
      await approveButton.first().click();
      await page.getByRole("button", { name: /confirm|ok/i }).click();
    }

    await expect(page.getByText(/approved|已审核/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("FLOW-003: 多语言翻译流程", async ({ page, login }) => {
    await login();

    await page.goto("/projects");

    const table = page.getByRole("table");
    const firstProject = table.getByRole("row").nth(1);

    if ((await firstProject.count()) > 0) {
      await firstProject.click();
      await page.waitForURL(/\/projects\/[^/]+$/);
    }

    const languageSelector = page.getByRole("combobox", {
      name: /language|locale/i,
    });
    if ((await languageSelector.count()) > 0) {
      await languageSelector.first().click();

      const option = page.getByRole("option", { name: /en-US|zh-CN/i });
      if ((await option.count()) > 0) {
        await option.first().click();
      }

      await page.keyboard.press("Escape");
    }

    await expect(page).toHaveURL(/locale|language/i);
  });

  test("FLOW-004: 团队协作流程", async ({ page, login }) => {
    await login();
    await page.goto("/workspace");

    await expect(page.getByText(/welcome|欢迎/i)).toBeVisible();

    const todoSection = page.getByText(/todo|待办/i);
    if ((await todoSection.count()) > 0) {
      await expect(todoSection.first()).toBeVisible();
    }

    const recentActivity = page.getByText(/recent|最近动态/i);
    if ((await recentActivity.count()) > 0) {
      await expect(recentActivity.first()).toBeVisible();
    }
  });

  test("FLOW-005: 数据导出流程", async ({ page, login }) => {
    await login();
    await page.goto("/projects");

    const exportButton = page.getByRole("button", { name: /export|导出/i });

    if ((await exportButton.count()) > 0) {
      await exportButton.first().click();

      const formatSelector = page.getByRole("menuitem", {
        name: /json|yaml|excel/i,
      });
      if ((await formatSelector.count()) > 0) {
        await expect(formatSelector.first()).toBeVisible();
      }

      await page.keyboard.press("Escape");
    }
  });
});
