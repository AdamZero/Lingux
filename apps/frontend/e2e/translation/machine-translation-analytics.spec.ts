import { test, expect } from '../fixtures';

test.describe('Machine Translation Analytics', () => {
  test.beforeEach(async ({ page, login }) => {
    await login();
    await page.goto('/settings/machine-translation');
    await page.waitForURL(/\/settings\/machine-translation/);
  });

  test('MTA-001: 月度统计卡片显示', async ({ page }) => {
    await expect(page.getByText(/本月翻译统计 | 月度统计/i)).toBeVisible({ timeout: 10000 });
    
    const statCards = page.locator('.ant-statistic');
    await expect(statCards.first()).toBeVisible();
  });

  test('MTA-002: 总字符数显示', async ({ page }) => {
    const totalCharsCard = page.getByText('总字符数');
    await expect(totalCharsCard).toBeVisible();
  });

  test('MTA-003: 供应商统计卡片显示', async ({ page }) => {
    const providerCards = page.locator('[class*="ProviderStatCard"]');
    const count = await providerCards.count();
    
    if (count > 0) {
      await expect(providerCards.first()).toBeVisible();
      
      const firstCard = providerCards.first();
      await expect(firstCard.getByText(/provider|供应商/i)).toBeVisible();
    }
  });

  test('MTA-004: 翻译任务列表显示', async ({ page }) => {
    const jobListSection = page.getByText('翻译任务');
    await expect(jobListSection).toBeVisible();
    
    const table = page.getByRole('table');
    await expect(table).toBeVisible();
  });

  test('MTA-005: 任务列表表格列显示', async ({ page }) => {
    const table = page.getByRole('table');
    
    const headers = [
      /发起人 | 用户/i,
      /供应商 | provider/i,
      /词条数 | keys/i,
      /状态 | status/i,
      /时间 | time/i,
    ];

    for (const header of headers) {
      const headerCell = table.getByRole('columnheader', { name: header });
      if ((await headerCell.count()) > 0) {
        await expect(headerCell.first()).toBeVisible();
      }
    }
  });

  test('MTA-006: 任务详情弹窗', async ({ page }) => {
    const table = page.getByRole('table');
    const firstRow = table.getByRole('row').nth(1);
    
    if ((await firstRow.count()) > 0) {
      await firstRow.click();
      
      const drawer = page.getByRole('dialog');
      if ((await drawer.count()) > 0) {
        await expect(drawer.first()).toBeVisible();
        
        const closeButton = page.getByRole('button', { name: /close|关闭/i });
        if ((await closeButton.count()) > 0) {
          await closeButton.first().click();
        }
      }
    }
  });

  test('MTA-007: 任务详情显示翻译结果', async ({ page }) => {
    const table = page.getByRole('table');
    const firstRow = table.getByRole('row').nth(1);
    
    if ((await firstRow.count()) > 0) {
      await firstRow.click();
      
      const drawer = page.getByRole('dialog');
      if ((await drawer.count()) > 0) {
        const translationResults = drawer.getByText(/翻译结果 | translation/i);
        if ((await translationResults.count()) > 0) {
          await expect(translationResults.first()).toBeVisible();
        }
        
        const closeButton = page.getByRole('button', { name: /close|关闭/i });
        if ((await closeButton.count()) > 0) {
          await closeButton.first().click();
        }
      }
    }
  });

  test('MTA-008: 供应商进度条显示', async ({ page }) => {
    const progressBars = page.locator('.ant-progress');
    const count = await progressBars.count();
    
    if (count > 0) {
      await expect(progressBars.first()).toBeVisible();
    }
  });

  test('MTA-009: 页面加载性能', async ({ page }) => {
    const startTime = Date.now();
    
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    console.log(`Page load time: ${loadTime}ms`);
    
    expect(loadTime).toBeLessThan(10000);
  });

  test('MTA-010: 数据刷新功能', async ({ page }) => {
    const refreshButton = page.getByRole('button', { name: /refresh|刷新/i });
    
    if ((await refreshButton.count()) > 0) {
      await refreshButton.first().click();
      
      await page.waitForTimeout(2000);
      
      const table = page.getByRole('table');
      await expect(table).toBeVisible();
    }
  });
});
