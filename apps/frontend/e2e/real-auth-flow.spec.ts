import { test, expect } from "@playwright/test";

test.describe("实际授权流程测试", () => {
  test("模拟飞书授权回调流程", async ({ page }) => {
    // 监听 console 日志
    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    // 监听页面错误
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    // 监听导航事件
    page.on("framenavigated", (frame) => {
      console.log(`[导航] ${frame.url()}`);
    });

    // 清除 localStorage
    await page.goto("http://localhost:8081/login");
    await page.evaluate(() => localStorage.clear());
    console.log("[测试] 已清除 localStorage");

    // 模拟飞书授权回调 URL (带 hash)
    const mockToken = "test-feishu-token-123";
    const mockUser = JSON.stringify({
      id: "user-123",
      username: "Test User",
      role: "ADMIN",
    });
    const callbackUrl = `http://localhost:8081/login#token=${mockToken}&user=${encodeURIComponent(mockUser)}`;

    console.log(`[测试] 访问回调 URL: ${callbackUrl}`);

    // 访问回调 URL
    await page.goto(callbackUrl);

    // 等待一段时间观察行为
    await page.waitForTimeout(3000);

    // 打印当前 URL
    const currentUrl = page.url();
    console.log(`[测试] 当前 URL: ${currentUrl}`);

    // 打印 localStorage
    const localStorage = await page.evaluate(() =>
      JSON.stringify(window.localStorage.getItem("lingux-app-storage")),
    );
    console.log(`[测试] localStorage: ${localStorage}`);

    // 打印所有 console 日志
    console.log("[测试] === Console 日志 ===");
    consoleLogs.forEach((log) => console.log(log));

    // 打印页面错误
    if (pageErrors.length > 0) {
      console.log("[测试] === 页面错误 ===");
      pageErrors.forEach((err) => console.log(err));
    }

    // 截图
    await page.screenshot({
      path: "c:\\code\\Lingux\\test-results\\auth-callback-result.png",
      fullPage: true,
    });

    // 验证期望行为
    console.log("[测试] === 验证结果 ===");
    if (currentUrl.includes("/projects")) {
      console.log("✅ 成功跳转到项目页");
    } else if (currentUrl.includes("/login")) {
      console.log("❌ 仍停留在登录页");
    } else {
      console.log(`⚠️ 在其他页面: ${currentUrl}`);
    }
  });

  test("测试 hash 变化时的处理", async ({ page }) => {
    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    // 先访问普通登录页
    await page.goto("http://localhost:8081/login");
    await page.evaluate(() => localStorage.clear());
    console.log("[测试] 已加载登录页");

    // 等待页面完全加载
    await page.waitForLoadState("networkidle");

    // 然后通过设置 hash 模拟回调
    const mockToken = "test-token-hash-change";
    const mockUser = JSON.stringify({
      id: "user-456",
      username: "Hash Change User",
      role: "EDITOR",
    });

    console.log("[测试] 设置 window.location.hash 模拟回调");
    await page.evaluate(
      ({ token, user }) => {
        window.location.hash = `token=${token}&user=${user}`;
      },
      { token: mockToken, user: encodeURIComponent(mockUser) },
    );

    // 等待观察
    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    console.log(`[测试] 当前 URL: ${currentUrl}`);

    console.log("[测试] === Console 日志 ===");
    consoleLogs.forEach((log) => console.log(log));

    await page.screenshot({
      path: "c:\\code\\Lingux\\test-results\\hash-change-result.png",
      fullPage: true,
    });
  });
});
