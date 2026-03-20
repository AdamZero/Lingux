import { FullConfig } from "@playwright/test";
import { APIClient } from "./utils/api-client";
import { cleanupTestData } from "./utils/test-data";

async function globalSetup(config: FullConfig) {
  console.log(" Starting global setup...");

  const apiClient = new APIClient("http://localhost:3000");

  try {
    await apiClient.devLogin();
    console.log("✅ Dev login successful");
  } catch (error) {
    console.warn("⚠️  Dev login failed (backend may not be running):", error);
  }

  console.log("✨ Global setup complete");
}

export default globalSetup;
