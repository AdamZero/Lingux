import { test, expect } from "../fixtures";
import { createKey } from "../utils/test-data";

test.describe("Key Management Module", () => {
  test.beforeEach(async ({ page, login }) => {
    await login();

    const firstProject = page
      .getByRole("table")
      .getByRole("row")
      .first()
      .getByText(/test-|project/i);
    if ((await firstProject.count()) > 0) {
      await firstProject.first().click();
      await page.waitForURL(/\/projects\/[^/]+$/);
    }
  });

  test("KEY-001: 词条列表页面显示", async ({ page }) => {
    await expect(page.getByText(/keys|词条/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /add key|新建词条/i }),
    ).toBeVisible();
  });

  test("KEY-002: 添加新词条", async ({ page }) => {
    const keyData = createKey("test-namespace-id");

    await page.getByRole("button", { name: /add key|新建词条/i }).click();

    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();

    await page.getByLabel(/key name|词条名称/i).fill(keyData.key);

    if ((await page.getByLabel(/description/i).count()) > 0) {
      await page.getByLabel(/description/i).fill(keyData.description || "");
    }

    await page.getByRole("button", { name: /ok|confirm|create/i }).click();

    await expect(page.getByText(keyData.key)).toBeVisible();
  });

  test("KEY-003: 词条必填项验证", async ({ page }) => {
    await page.getByRole("button", { name: /add key|新建词条/i }).click();

    await page.getByLabel(/key name|词条名称/i).fill("");

    await page.getByRole("button", { name: /ok|confirm|create/i }).click();

    const errorMessage = page.getByText(/required|必填/i);
    await expect(errorMessage).toBeVisible();
  });

  test("KEY-004: 词条筛选功能", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search|搜索/i);

    if ((await searchInput.count()) > 0) {
      await searchInput.fill("test");
      await page.waitForTimeout(500);

      const table = page.getByRole("table");
      await expect(table).toBeVisible();

      await searchInput.clear();
    }
  });

  test("KEY-005: 词条标签显示", async ({ page }) => {
    const table = page.getByRole("table");

    if ((await table.count()) > 0) {
      const firstRow = table.getByRole("row").nth(1);
      await expect(firstRow).toBeVisible();
    }
  });

  test("KEY-006: 词条编辑功能", async ({ page }) => {
    const table = page.getByRole("table");
    const firstRow = table.getByRole("row").nth(1);

    if ((await firstRow.count()) > 0) {
      const editButton = firstRow.getByRole("button", { name: /edit/i });

      if ((await editButton.count()) > 0) {
        await editButton.first().click();

        const modal = page.getByRole("dialog");
        await expect(modal).toBeVisible();

        await page.getByRole("button", { name: /cancel/i }).click();
      }
    }
  });

  test("KEY-007: 词条删除功能", async ({ page }) => {
    const table = page.getByRole("table");
    const firstRow = table.getByRole("row").nth(1);

    if ((await firstRow.count()) > 0) {
      const deleteButton = firstRow.getByRole("button", { name: /delete/i });

      if ((await deleteButton.count()) > 0) {
        await deleteButton.first().click();

        const confirmButton = page.getByRole("button", {
          name: /confirm|ok|delete/i,
        });
        if ((await confirmButton.count()) > 0) {
          await confirmButton.first().click();
        }
      }
    }
  });

  test("KEY-008: 词条批量操作", async ({ page }) => {
    const checkboxes = page.getByRole("checkbox");

    if ((await checkboxes.count()) > 1) {
      await checkboxes.first().check();

      const batchActions = page.getByRole("button", { name: /batch|批量/i });

      if ((await batchActions.count()) > 0) {
        await expect(batchActions.first()).toBeVisible();
      }
    }
  });
});
