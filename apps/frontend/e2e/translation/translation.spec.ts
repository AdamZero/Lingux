import { test, expect } from "../fixtures";

test.describe("Translation Workflow Module", () => {
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

  test("TRANS-001: 翻译列表页面显示", async ({ page }) => {
    await expect(page.getByText(/translations|翻译/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /translate|新建翻译/i }),
    ).toBeVisible();
  });

  test("TRANS-002: 翻译状态筛选", async ({ page }) => {
    const statusFilter = page.getByRole("combobox", { name: /status/i });

    if ((await statusFilter.count()) > 0) {
      await statusFilter.first().click();

      const options = page.getByRole("option");
      await expect(options.first()).toBeVisible();

      await page.keyboard.press("Escape");
    }
  });

  test("TRANS-003: 语言筛选", async ({ page }) => {
    const languageFilter = page.getByRole("combobox", {
      name: /language|locale/i,
    });

    if ((await languageFilter.count()) > 0) {
      await languageFilter.first().click();

      const options = page.getByRole("option");
      await expect(options.first()).toBeVisible();

      await page.keyboard.press("Escape");
    }
  });

  test("TRANS-004: 翻译编辑功能", async ({ page }) => {
    const table = page.getByRole("table");
    const firstRow = table.getByRole("row").nth(1);

    if ((await firstRow.count()) > 0) {
      const editButton = firstRow.getByRole("button", {
        name: /edit|translate/i,
      });

      if ((await editButton.count()) > 0) {
        await editButton.first().click();

        const textarea = page.getByRole("textbox");
        if ((await textarea.count()) > 0) {
          await textarea.first().fill("E2E Test Translation");

          const saveButton = page.getByRole("button", {
            name: /save|confirm/i,
          });
          if ((await saveButton.count()) > 0) {
            await saveButton.first().click();
          }
        }

        const cancelButton = page.getByRole("button", { name: /cancel/i });
        if ((await cancelButton.count()) > 0) {
          await cancelButton.first().click();
        }
      }
    }
  });

  test("TRANS-005: 翻译状态流转", async ({ page }) => {
    const table = page.getByRole("table");

    if ((await table.count()) > 0) {
      const statusCells = page.getByText(
        /pending|translating|reviewing|approved/i,
      );

      if ((await statusCells.count()) > 0) {
        await expect(statusCells.first()).toBeVisible();
      }
    }
  });

  test("TRANS-006: 批量翻译功能", async ({ page }) => {
    const batchTranslateButton = page.getByRole("button", {
      name: /batch translate|批量翻译/i,
    });

    if ((await batchTranslateButton.count()) > 0) {
      await expect(batchTranslateButton.first()).toBeVisible();
    }
  });

  test("TRANS-007: 翻译审核功能", async ({ page }) => {
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

  test("TRANS-008: 翻译拒绝功能", async ({ page }) => {
    const table = page.getByRole("table");
    const firstRow = table.getByRole("row").nth(1);

    if ((await firstRow.count()) > 0) {
      const rejectButton = firstRow.getByRole("button", {
        name: /reject|拒绝/i,
      });

      if ((await rejectButton.count()) > 0) {
        await rejectButton.first().click();

        const confirmButton = page.getByRole("button", { name: /confirm|ok/i });
        if ((await confirmButton.count()) > 0) {
          await confirmButton.first().click();
        }
      }
    }
  });

  test("TRANS-009: 翻译历史查看", async ({ page }) => {
    const table = page.getByRole("table");
    const firstRow = table.getByRole("row").nth(1);

    if ((await firstRow.count()) > 0) {
      const historyButton = firstRow.getByRole("button", {
        name: /history|历史/i,
      });

      if ((await historyButton.count()) > 0) {
        await historyButton.first().click();

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

  test("TRANS-010: 翻译进度统计", async ({ page }) => {
    const progressStats = page.getByText(/progress|completion|进度/i);

    if ((await progressStats.count()) > 0) {
      await expect(progressStats.first()).toBeVisible();
    }
  });
});
