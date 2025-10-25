/**
 * 全局任务控制管理器
 * 用于取消正在运行的审计任务
 */

class TaskControlManager {
  private cancelledTasks: Set<string> = new Set();

  /**
   * 取消任务
   */
  cancelTask(taskId: string) {
    this.cancelledTasks.add(taskId);
    console.log(`🛑 任务 ${taskId} 已标记为取消`);
  }

  /**
   * 检查任务是否被取消
   */
  isCancelled(taskId: string): boolean {
    return this.cancelledTasks.has(taskId);
  }

  /**
   * 清理已完成任务的控制状态
   */
  cleanupTask(taskId: string) {
    this.cancelledTasks.delete(taskId);
  }
}

// 导出单例
export const taskControl = new TaskControlManager();

