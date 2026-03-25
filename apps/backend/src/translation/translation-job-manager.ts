/**
 * 翻译任务管理器
 * 管理并发控制和任务状态
 */

// 全局 Map 用于存储正在翻译的 namespace（并发控制）
// namespaceId -> jobId
const processingNamespaces = new Map<string, string>();

export class TranslationJobManager {
  /**
   * 检查 namespace 是否正在翻译
   */
  static isProcessing(namespaceId: string): boolean {
    return processingNamespaces.has(namespaceId);
  }

  /**
   * 获取正在处理的任务 ID
   */
  static getJobId(namespaceId: string): string | undefined {
    return processingNamespaces.get(namespaceId);
  }

  /**
   * 开始处理 namespace
   */
  static startProcessing(namespaceId: string, jobId: string): void {
    processingNamespaces.set(namespaceId, jobId);
  }

  /**
   * 完成处理 namespace
   */
  static finishProcessing(namespaceId: string): void {
    processingNamespaces.delete(namespaceId);
  }

  /**
   * 获取所有正在处理的 namespace
   */
  static getAllProcessing(): Map<string, string> {
    return new Map(processingNamespaces);
  }
}
