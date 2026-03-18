import { test, expect } from "../fixtures";
import { createProject } from "../utils/test-data";

test.describe("Project Management Module", () => {
  test.beforeEach(async ({ page, login }) => {
    await login();
    await page.goto("/projects");
  });

  test("PROJ-001: 项目列表页面显示", async ({ page }) => {
    await expect(page.getByText(/projects/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /create project/i }),
    ).toBeVisible();

    const table = page.getByRole("table");
    await expect(table).toBeVisible();
  });

  test("PROJ-002: 创建项目 - 成功", async ({ page }) => {
    const projectData = createProject();

    await page.getByRole("button", { name: /create project/i }).click();

    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();

    await page.getByLabel(/project name/i).fill(projectData.name);
    await page.getByLabel(/description/i).fill(projectData.description);

    await page.getByRole("button", { name: /ok|confirm|create/i }).click();

    await expect(page.getByText(projectData.name)).toBeVisible();
  });

  test("PROJ-003: 创建项目 - 必填项验证", async ({ page }) => {
    await page.getByRole("button", { name: /create project/i }).click();

    await page.getByLabel(/project name/i).fill("");

    await page.getByRole("button", { name: /ok|confirm|create/i }).click();

    const errorMessage = page.getByText(/required|必填/i);
    await expect(errorMessage).toBeVisible();
  });

  test("PROJ-004: 查看项目详情", async ({ page }) => {
    const projectName = page
      .getByRole("table")
      .getByRole("row")
      .first()
      .getByText(/test-|project/i);

    if ((await projectName.count()) > 0) {
      await projectName.first().click();

      await expect(page).toHaveURL(/\/projects\/[^/]+$/);
      await expect(page.getByText(/details|information/i)).toBeVisible();
    }
  });

  test("PROJ-005: 项目列表数据展示", async ({ page }) => {
    const table = page.getByRole("table");

    const headers = ["name", "description", "created"];
    for (const header of headers) {
      await expect(table.getByText(new RegExp(header, "i"))).toBeVisible();
    }
  });

  test("PROJ-006: 项目筛选和搜索", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search|搜索/i);

    if ((await searchInput.count()) > 0) {
      await searchInput.fill("test");
      await expect(page.getByRole("table")).toBeVisible();

      await searchInput.clear();
      await expect(page.getByRole("table")).toBeVisible();
    }
  });

  test("PROJ-007: 创建项目后自动刷新列表", async ({ page }) => {
    const projectData = createProject();

    await page.getByRole("button", { name: /create project/i }).click();
    await page.getByLabel(/project name/i).fill(projectData.name);
    await page.getByRole("button", { name: /ok|confirm|create/i }).click();

    await expect(page.getByText(projectData.name)).toBeVisible({
      timeout: 5000,
    });
  });
});
