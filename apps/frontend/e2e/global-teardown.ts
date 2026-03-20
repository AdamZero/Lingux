import { FullConfig } from "@playwright/test";
import { APIClient } from "./utils/api-client";
import { cleanupTestData } from "./utils/test-data";

async function globalTeardown(config: FullConfig) {
  console.log(" Starting global teardown...");

  const apiClient = new APIClient("http://localhost:3000");

  try {
    await apiClient.devLogin();
    await cleanupTestData(apiClient);
    console.log("✅ Test data cleanup complete");
  } catch (error) {
    console.warn("⚠️  Cleanup failed:", error);
  }

  console.log("✨ Global teardown complete");
}

export default globalTeardown;
