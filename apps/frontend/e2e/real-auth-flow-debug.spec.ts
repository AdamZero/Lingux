import { test, expect } from "@playwright/test";

test.describe("实际授权流程调试", () => {
  test("调试授权回调流程 - 添加详细日志", async ({ page }) => {
    // 监听 console 日志
    const consoleLogs: string[] = [];
    page.on("console", (msg) => {
      const log = `[${msg.type()}] ${msg.text()}`;
      consoleLogs.push(log);
      console.log(log);
    });

    // 先访问页面，然后手动设置 hash
    await page.goto("http://localhost:8081/login");
    await page.evaluate(() => localStorage.clear());
    console.log("[测试] 已加载登录页并清除 localStorage");

    // 等待页面完全加载
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // 检查初始状态
    const initialState = await page.evaluate(() => {
      const storage = localStorage.getItem("lingux-app-storage");
      return {
        storage: storage ? JSON.parse(storage) : null,
        hash: window.location.hash,
        pathname: window.location.pathname,
      };
    });
    console.log("[测试] 初始状态:", JSON.stringify(initialState, null, 2));

    // 手动设置 hash 来模拟回调
    const mockToken = "test-debug-token";
    const mockUser = JSON.stringify({
      id: "user-debug",
      username: "Debug User",
      role: "ADMIN",
    });

    console.log("[测试] 设置 hash...");
    await page.evaluate(
      ({ token, user }) => {
        window.location.hash = `token=${token}&user=${encodeURIComponent(user)}`;
      },
      { token: mockToken, user: mockUser },
    );

    // 等待一段时间
    await page.waitForTimeout(3000);

    // 检查最终状态
    const finalState = await page.evaluate(() => {
      const storage = localStorage.getItem("lingux-app-storage");
      return {
        storage: storage ? JSON.parse(storage) : null,
        hash: window.location.hash,
        pathname: window.location.pathname,
        url: window.location.href,
      };
    });
    console.log("[测试] 最终状态:", JSON.stringify(finalState, null, 2));

    // 截图
    await page.screenshot({
      path: "c:\\code\\Lingux\\test-results\\debug-auth-result.png",
      fullPage: true,
    });

    // 验证
    if (finalState.url.includes("/projects")) {
      console.log("✅ 成功跳转到项目页");
    } else {
      console.log("❌ 仍停留在登录页");
      console.log("URL:", finalState.url);
    }

    if (finalState.storage?.state?.token) {
      console.log("✅ Token 已保存到 localStorage");
    } else {
      console.log("❌ Token 未保存到 localStorage");
    }
  });
});
