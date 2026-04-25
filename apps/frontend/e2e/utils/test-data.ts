const timestamp = Date.now();

export function generateTestName(prefix: string = "test"): string {
  return `${prefix}-${timestamp}-${Math.random().toString(36).substring(7)}`;
}

export function createProject(
  overrides: Partial<{
    name: string;
    description: string;
    baseLocale: string;
    supportedLocales: string[];
  }> = {},
) {
  return {
    name: overrides.name || generateTestName("test-project"),
    description: overrides.description || "E2E Test Project",
    baseLocale: overrides.baseLocale || "zh-CN",
    supportedLocales: overrides.supportedLocales || ["zh-CN", "en-US"],
  };
}

export function createNamespace(
  projectId: string,
  overrides: Partial<{
    name: string;
    description: string;
  }> = {},
) {
  return {
    projectId,
    name: overrides.name || generateTestName("test-namespace"),
    description: overrides.description || "E2E Test Namespace",
  };
}

export function createKey(
  namespaceId: string,
  overrides: Partial<{
    key: string;
    description: string;
    labels: string[];
  }> = {},
) {
  return {
    namespaceId,
    key: overrides.key || generateTestName("test.key"),
    description: overrides.description || "E2E Test Key",
    labels: overrides.labels || ["e2e", "test"],
  };
}

export function createTranslation(
  keyId: string,
  locale: string = "en-US",
  overrides: Partial<{
    value: string;
    status: string;
  }> = {},
) {
  return {
    keyId,
    locale,
    value: overrides.value || `Translation for ${locale}`,
    status: overrides.status || "PENDING",
  };
}

export function createRelease(
  projectId: string,
  overrides: Partial<{
    name: string;
    description: string;
    version: string;
  }> = {},
) {
  return {
    projectId,
    name: overrides.name || generateTestName("test-release"),
    description: overrides.description || "E2E Test Release",
    version: overrides.version || "1.0.0",
  };
}

export async function cleanupTestData(api: any): Promise<void> {
  try {
    const projects = await api.getProjects();
    const projectList = projects.data.data || projects.data || [];

    for (const project of projectList) {
      if (project.name && project.name.includes("test-")) {
        try {
          await api.deleteProject(project.id);
          console.log(`Deleted test project: ${project.name}`);
        } catch (error) {
          console.error(`Failed to delete project ${project.name}:`, error);
        }
      }
    }
  } catch (error) {
    console.error("Cleanup failed:", error);
  }
}
