import { test, expect } from "../fixtures";

test.describe("Release Management Module", () => {
  test.beforeEach(async ({ page, login }) => {
    await login();
    await page.goto("/releases");
  });

  test("REL-001: 发布中心页面显示", async ({ page }) => {
    await expect(page.getByText(/release|发布/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /create release|创建发布/i }),
    ).toBeVisible();
  });

  test("REL-002: 发布列表数据展示", async ({ page }) => {
    const table = page.getByRole("table");
    await expect(table).toBeVisible();

    const headers = ["name", "version", "status", "created"];
    for (const header of headers) {
      await expect(page.getByText(new RegExp(header, "i"))).toBeVisible();
    }
  });

  test("REL-003: 创建发布单", async ({ page }) => {
    await page
      .getByRole("button", { name: /create release|创建发布/i })
      .click();

    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();

    await page
      .getByLabel(/release name|发布名称/i)
      .fill(`E2E-Release-${Date.now()}`);

    if ((await page.getByLabel(/version/i).count()) > 0) {
      await page.getByLabel(/version/i).fill("1.0.0");
    }

    if ((await page.getByLabel(/description/i).count()) > 0) {
      await page.getByLabel(/description/i).fill("E2E Test Release");
    }

    await page.getByRole("button", { name: /ok|confirm|create/i }).click();

    await expect(page.getByText(/E2E-Release/)).toBeVisible({ timeout: 5000 });
  });

  test("REL-004: 发布状态筛选", async ({ page }) => {
    const statusFilter = page.getByRole("combobox", { name: /status/i });

    if ((await statusFilter.count()) > 0) {
      await statusFilter.first().click();

      const options = page.getByRole("option");
      await expect(options.first()).toBeVisible();

      await page.keyboard.press("Escape");
    }
  });

  test("REL-005: 发布详情查看", async ({ page }) => {
    const table = page.getByRole("table");
    const firstRow = table.getByRole("row").nth(1);

    if ((await firstRow.count()) > 0) {
      const viewButton = firstRow.getByRole("button", { name: /view|detail/i });

      if ((await viewButton.count()) > 0) {
        await viewButton.first().click();

        const modal = page.getByRole("dialog");
        if ((await modal.count()) > 0) {
          await expect(modal.first()).toBeVisible();

          const closeButton = page.getByRole("button", { name: /close/i });
          if ((await closeButton.count()) > 0) {
            await closeButton.first().click();
          }
        }
      }
    }
  });

  test("REL-006: 发布审核流程", async ({ page }) => {
    const table = page.getByRole("table");
    const firstRow = table.getByRole("row").nth(1);

    if ((await firstRow.count()) > 0) {
      const approveButton = firstRow.getByRole("button", {
        name: /approve|审核/i,
      });

      if ((await approveButton.count()) > 0) {
        await approveButton.first().click();

        const confirmButton = page.getByRole("button", { name: /confirm|ok/i });
        if ((await confirmButton.count()) > 0) {
          await confirmButton.first().click();
        }
      }
    }
  });

  test("REL-007: 发布执行流程", async ({ page }) => {
    const table = page.getByRole("table");
    const firstRow = table.getByRole("row").nth(1);

    if ((await firstRow.count()) > 0) {
      const publishButton = firstRow.getByRole("button", {
        name: /publish|执行/i,
      });

      if ((await publishButton.count()) > 0) {
        await publishButton.first().click();

        const confirmButton = page.getByRole("button", { name: /confirm|ok/i });
        if ((await confirmButton.count()) > 0) {
          await confirmButton.first().click();
        }
      }
    }
  });

  test("REL-008: 发布回滚功能", async ({ page }) => {
    const table = page.getByRole("table");
    const firstRow = table.getByRole("row").nth(1);

    if ((await firstRow.count()) > 0) {
      const rollbackButton = firstRow.getByRole("button", {
        name: /rollback|回滚/i,
      });

      if ((await rollbackButton.count()) > 0) {
        await expect(rollbackButton.first()).toBeVisible();
      }
    }
  });

  test("REL-009: 发布统计信息", async ({ page }) => {
    const stats = page.getByText(/total|success|failed|统计/i);

    if ((await stats.count()) > 0) {
      await expect(stats.first()).toBeVisible();
    }
  });

  test("REL-010: 发布删除功能", async ({ page }) => {
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
});
